/**
 * Puzzle Generation Web Worker
 *
 * Runs puzzle generation in a separate thread to prevent UI blocking
 * for large board sizes (12x12, 16x16).
 *
 * @module core/puzzle-worker
 */

// ---- board-config inline ----
const BOARD_CONFIGS = {
    4:  { size: 4,  blockRows: 2, blockCols: 2 },
    6:  { size: 6,  blockRows: 2, blockCols: 3 },
    9:  { size: 9,  blockRows: 3, blockCols: 3 },
    12: { size: 12, blockRows: 3, blockCols: 4 },
    16: { size: 16, blockRows: 4, blockCols: 4 },
};

const DIFFICULTY_RANGES_BY_SIZE = {
    4:  { easy: [5, 6], normal: [7, 8], hard: [9, 10], expert: [10, 11], master: [11, 12] },
    6:  { easy: [14, 16], normal: [17, 20], hard: [21, 24], expert: [25, 28], master: [29, 32] },
    9:  { easy: [36, 40], normal: [41, 46], hard: [47, 51], expert: [52, 55], master: [56, 60] },
    12: { easy: [60, 72], normal: [73, 88], hard: [89, 103], expert: [104, 115], master: [116, 126] },
    16: { easy: [110, 128], normal: [129, 154], hard: [155, 179], expert: [180, 200], master: [201, 220] },
};

function getBlockSize(boardSize) {
    const config = BOARD_CONFIGS[boardSize];
    if (!config) throw new Error(`Unsupported board size: ${boardSize}`);
    return { rows: config.blockRows, cols: config.blockCols };
}

function getDifficultyRange(boardSize, difficulty) {
    const ranges = DIFFICULTY_RANGES_BY_SIZE[boardSize];
    if (!ranges) throw new Error(`Unsupported board size: ${boardSize}`);
    return ranges[difficulty] || ranges.easy;
}

// ---- variant-rules inline ----
// Mirrors core/variant-rules.js getExtraCells() for use inside the Worker.
// Each entry returns extra constrained cells (excluding the cell itself).
const VARIANT_EXTRA_CELLS = {
    standard: () => [],
    diagonal: (row, col, boardSize) => {
        const cells = [];
        if (row === col) {
            for (let i = 0; i < boardSize; i++) {
                if (i !== row) cells.push({ row: i, col: i });
            }
        }
        if (row + col === boardSize - 1) {
            for (let i = 0; i < boardSize; i++) {
                if (i !== row) cells.push({ row: i, col: boardSize - 1 - i });
            }
        }
        return cells;
    },
    'anti-knight': (row, col, boardSize) => {
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        return offsets
            .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
            .filter(c => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
    },
    'anti-king': (row, col, boardSize) => {
        const offsets = [[-1,-1],[-1,1],[1,-1],[1,1]];
        return offsets
            .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
            .filter(c => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
    },
    'even-odd': () => [],
    killer: (row, col, boardSize, extraData) => {
        if (!extraData || !extraData.cages) return [];
        for (const cage of extraData.cages) {
            if (cage.cells.some(c => c.row === row && c.col === col)) {
                return cage.cells.filter(c => c.row !== row || c.col !== col);
            }
        }
        return [];
    },
    windoku: (row, col, boardSize) => {
        if (boardSize !== 9) return [];
        const windows = [
            { rStart: 1, cStart: 1 },
            { rStart: 1, cStart: 5 },
            { rStart: 5, cStart: 1 },
            { rStart: 5, cStart: 5 },
        ];
        const cells = [];
        for (const w of windows) {
            if (row >= w.rStart && row < w.rStart + 3 && col >= w.cStart && col < w.cStart + 3) {
                for (let r = w.rStart; r < w.rStart + 3; r++) {
                    for (let c = w.cStart; c < w.cStart + 3; c++) {
                        if (r !== row || c !== col) cells.push({ row: r, col: c });
                    }
                }
            }
        }
        return cells;
    },
};

function getExtraCellsWorker(variant, row, col, boardSize) {
    const fn = VARIANT_EXTRA_CELLS[variant];
    return fn ? fn(row, col, boardSize) : [];
}

// ---- solver inline ----
function isValid(board, row, col, num, boardSize, blockSize, variant) {
    for (let c = 0; c < boardSize; c++) {
        if (board[row][c] === num) return false;
    }
    for (let r = 0; r < boardSize; r++) {
        if (board[r][col] === num) return false;
    }
    const br = Math.floor(row / blockSize.rows) * blockSize.rows;
    const bc = Math.floor(col / blockSize.cols) * blockSize.cols;
    for (let r = br; r < br + blockSize.rows; r++) {
        for (let c = bc; c < bc + blockSize.cols; c++) {
            if (board[r][c] === num) return false;
        }
    }
    // Variant-specific extra cells
    const extraCells = getExtraCellsWorker(variant, row, col, boardSize);
    for (const cell of extraCells) {
        if (board[cell.row][cell.col] === num) return false;
    }
    return true;
}

function getCandidates(board, row, col, boardSize, blockSize, variant) {
    const candidates = new Set();
    if (board[row][col] !== 0) return candidates;
    for (let num = 1; num <= boardSize; num++) {
        if (isValid(board, row, col, num, boardSize, blockSize, variant)) candidates.add(num);
    }
    return candidates;
}

function countSolutions(board, boardSize, blockSize, limit, variant) {
    if (limit === undefined) limit = 2;
    const copy = board.map(r => [...r]);
    const counter = { count: 0 };

    function findBest(b) {
        let best = null, min = boardSize + 1;
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (b[r][c] === 0) {
                    const cnt = getCandidates(b, r, c, boardSize, blockSize, variant).size;
                    if (cnt < min) { min = cnt; best = { row: r, col: c }; if (cnt === 1) return best; }
                }
            }
        }
        return best;
    }

    function solve(b) {
        if (counter.count >= limit) return;
        const cell = findBest(b);
        if (!cell) { counter.count++; return; }
        const cands = getCandidates(b, cell.row, cell.col, boardSize, blockSize, variant);
        for (const num of cands) {
            if (counter.count >= limit) return;
            b[cell.row][cell.col] = num;
            solve(b);
            b[cell.row][cell.col] = 0;
        }
    }

    solve(copy);
    return counter.count;
}

// ---- generator inline ----
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePuzzleWorker(difficulty, boardSize, variant) {
    const blockSize = getBlockSize(boardSize);
    const range = getDifficultyRange(boardSize, difficulty);
    const [minRemove, maxRemove] = range;
    const cellsToRemove = randomInt(minRemove, maxRemove);
    const totalCells = boardSize * boardSize;

    // Generate complete board
    const board = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));

    function fill(pos) {
        if (pos === totalCells) return true;
        const row = Math.floor(pos / boardSize);
        const col = pos % boardSize;
        const nums = shuffle(Array.from({ length: boardSize }, (_, i) => i + 1));
        for (const num of nums) {
            if (isValid(board, row, col, num, boardSize, blockSize, variant)) {
                board[row][col] = num;
                if (fill(pos + 1)) return true;
                board[row][col] = 0;
            }
        }
        return false;
    }

    fill(0);
    const solution = board.map(r => [...r]);

    // Remove cells
    const positions = shuffle(Array.from({ length: totalCells }, (_, i) => ({
        row: Math.floor(i / boardSize),
        col: i % boardSize,
    })));

    let removed = 0;
    for (const { row, col } of positions) {
        if (removed >= cellsToRemove) break;
        const backup = board[row][col];
        if (backup === 0) continue;
        board[row][col] = 0;
        if (countSolutions(board, boardSize, blockSize, 2, variant) !== 1) {
            board[row][col] = backup;
            continue;
        }
        removed++;
    }

    const given = board.map(r => r.map(v => v !== 0));

    const result = { board, solution, given, difficulty, variant };

    // Generate evenOddMap for even-odd variant
    if (variant === 'even-odd') {
        result.evenOddMap = generateEvenOddMap(solution, boardSize);
    }

    // Generate cages for killer variant
    if (variant === 'killer') {
        result.cages = generateCagesWorker(solution, boardSize);
    }

    return result;
}

/**
 * Generate an even/odd constraint map from the solution.
 * Marks ~35% of ALL cells with their parity (1=odd, 2=even).
 */
function generateEvenOddMap(solution, boardSize) {
    const map = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (Math.random() < 0.35) {
                map[r][c] = solution[r][c] % 2 === 0 ? 2 : 1; // 2=even, 1=odd
            }
        }
    }
    return map;
}

// ---- cage generation (killer) ----
function getNeighborsWorker(row, col, boardSize) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return dirs
        .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
        .filter(c => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
}

function generateCagesWorker(solution, boardSize) {
    const assigned = Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
    const cages = [];
    const allCells = shuffle(
        Array.from({ length: boardSize * boardSize }, (_, i) => ({
            row: Math.floor(i / boardSize),
            col: i % boardSize,
        }))
    );

    for (const start of allCells) {
        if (assigned[start.row][start.col]) continue;
        const cageSize = randomInt(2, 4);
        const cage = [start];
        assigned[start.row][start.col] = true;
        const frontier = getNeighborsWorker(start.row, start.col, boardSize)
            .filter(n => !assigned[n.row][n.col]);
        shuffle(frontier);
        while (cage.length < cageSize && frontier.length > 0) {
            const next = frontier.pop();
            if (assigned[next.row][next.col]) continue;
            cage.push(next);
            assigned[next.row][next.col] = true;
            const newNeighbors = getNeighborsWorker(next.row, next.col, boardSize)
                .filter(n => !assigned[n.row][n.col]);
            for (const n of shuffle(newNeighbors)) {
                frontier.push(n);
            }
        }
        const sum = cage.reduce((s, c) => s + solution[c.row][c.col], 0);
        cages.push({ cells: cage, sum });
    }
    return cages;
}

// ---- Worker message handler ----
self.onmessage = function(e) {
    try {
        const { difficulty, boardSize, variant } = e.data;
        const result = generatePuzzleWorker(difficulty, boardSize, variant || 'standard');
        self.postMessage({ success: true, puzzle: result });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};

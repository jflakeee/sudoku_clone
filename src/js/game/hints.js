/**
 * Hint System
 *
 * Analyses the current board state and provides the most helpful hint
 * available, prioritising "educational" hints (techniques the player can
 * learn from) over simple reveals.
 *
 * Priority order:
 *  1. Last empty cell in a row
 *  2. Last empty cell in a column
 *  3. Last empty cell in a block
 *  3.5. Last empty cell in variant group
 *  4. Hidden single (number has only one possible cell in a unit)
 *  5. Naked single (cell with exactly one candidate)
 *  6. Naked pair (two cells with identical 2-candidate sets)
 *  7. Pointing pair (number restricted to one row/col in a block)
 *  8. Fallback — reveal a random empty cell from the solution
 *
 * Supports multiple board sizes (4x4, 6x6, 9x9, 12x12, 16x16).
 *
 * @module game/hints
 */

import { getCandidates } from '../core/solver.js';
import { getBlockSize } from '../core/board-config.js';
import { getVariantRule } from '../core/variant-rules.js';

// ---------------------------------------------------------------------------
// Hint types
// ---------------------------------------------------------------------------

/** @typedef {'lastInRow' | 'lastInCol' | 'lastInBlock' | 'lastInVariantGroup' | 'hiddenSingle' | 'nakedSingle' | 'nakedPair' | 'pointingPair' | 'direct'} HintType */

/**
 * @typedef {Object} Hint
 * @property {HintType} type   - Category of the hint.
 * @property {number}   row    - Target row.
 * @property {number}   col    - Target column.
 * @property {number}   value  - The correct digit.
 * @property {string}   message - Human-readable description (Korean).
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine the best available hint for the current game state.
 *
 * @param {number[][]} board    - Current board (0 = empty).
 * @param {number[][]} solution - Full solution.
 * @param {import('./notes.js').Notes} [notes] - Optional notes instance.
 * @param {number} [boardSize=9] - Board dimension.
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions.
 * @param {boolean} [useSmartHints=true] - Whether to use smart hint strategies.
 * @returns {Hint | null} A hint object, or `null` if the board is already complete.
 */
export function getHint(board, solution, notes, boardSize = 9, blockSize = null, useSmartHints = true, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    if (!useSmartHints) {
        return findDirectReveal(board, solution, boardSize);
    }

    // 1. Last empty cell in a row
    const rowHint = findLastInRow(board, solution, boardSize);
    if (rowHint) return rowHint;

    // 2. Last empty cell in a column
    const colHint = findLastInCol(board, solution, boardSize);
    if (colHint) return colHint;

    // 3. Last empty cell in a block
    const blockHint = findLastInBlock(board, solution, boardSize, blockSize);
    if (blockHint) return blockHint;

    // 3.5. Last empty cell in a variant-specific group
    const variantRule = getVariantRule(variant);
    if (variantRule && variant !== 'standard') {
        const variantHint = findLastInVariantGroup(board, solution, boardSize, variantRule);
        if (variantHint) return variantHint;
    }

    // 4. Hidden single (number has only one possible cell in a unit)
    const hiddenHint = findHiddenSingle(board, solution, boardSize, blockSize, variant);
    if (hiddenHint) return hiddenHint;

    // 5. Naked single (only one candidate)
    const nakedHint = findNakedSingle(board, solution, boardSize, blockSize, variant);
    if (nakedHint) return nakedHint;

    // 6. Naked pair
    const pairHint = findNakedPair(board, solution, boardSize, blockSize, variant);
    if (pairHint) return pairHint;

    // 7. Pointing pair
    const pointingHint = findPointingPair(board, solution, boardSize, blockSize, variant);
    if (pointingHint) return pointingHint;

    // 8. Fallback — pick a random empty cell and reveal from solution
    return findDirectReveal(board, solution, boardSize);
}

/**
 * Return a Korean-language description for the given hint.
 *
 * @param {Hint} hint
 * @returns {string}
 */
export function getHintMessage(hint) {
    if (!hint) return '';
    return hint.message;
}

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

/**
 * Scan every row for one that has exactly one empty cell.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @returns {Hint | null}
 */
function findLastInRow(board, solution, boardSize = 9) {
    for (let r = 0; r < boardSize; r++) {
        let emptyCol = -1;
        let emptyCount = 0;

        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === 0) {
                emptyCol = c;
                emptyCount++;
                if (emptyCount > 1) break;
            }
        }

        if (emptyCount === 1) {
            const value = solution[r][emptyCol];
            return {
                type: 'lastInRow',
                row: r,
                col: emptyCol,
                value,
                message: `${r + 1}행에 빈 칸이 하나 남았습니다. 정답은 ${value}입니다.`,
            };
        }
    }

    return null;
}

/**
 * Scan every column for one that has exactly one empty cell.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @returns {Hint | null}
 */
function findLastInCol(board, solution, boardSize = 9) {
    for (let c = 0; c < boardSize; c++) {
        let emptyRow = -1;
        let emptyCount = 0;

        for (let r = 0; r < boardSize; r++) {
            if (board[r][c] === 0) {
                emptyRow = r;
                emptyCount++;
                if (emptyCount > 1) break;
            }
        }

        if (emptyCount === 1) {
            const value = solution[emptyRow][c];
            return {
                type: 'lastInCol',
                row: emptyRow,
                col: c,
                value,
                message: `${c + 1}열에 빈 칸이 하나 남았습니다. 정답은 ${value}입니다.`,
            };
        }
    }

    return null;
}

/**
 * Scan every block for one that has exactly one empty cell.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @param {{rows: number, cols: number}} [blockSize=null]
 * @returns {Hint | null}
 */
function findLastInBlock(board, solution, boardSize = 9, blockSize = null) {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const blockRowCount = boardSize / blockSize.rows;
    const blockColCount = boardSize / blockSize.cols;

    for (let blockR = 0; blockR < blockRowCount; blockR++) {
        for (let blockC = 0; blockC < blockColCount; blockC++) {
            const startR = blockR * blockSize.rows;
            const startC = blockC * blockSize.cols;

            let emptyRow = -1;
            let emptyCol = -1;
            let emptyCount = 0;

            for (let r = startR; r < startR + blockSize.rows; r++) {
                for (let c = startC; c < startC + blockSize.cols; c++) {
                    if (board[r][c] === 0) {
                        emptyRow = r;
                        emptyCol = c;
                        emptyCount++;
                        if (emptyCount > 1) break;
                    }
                }
                if (emptyCount > 1) break;
            }

            if (emptyCount === 1) {
                const value = solution[emptyRow][emptyCol];
                return {
                    type: 'lastInBlock',
                    row: emptyRow,
                    col: emptyCol,
                    value,
                    message: `블록에 빈 칸이 하나 남았습니다. 정답은 ${value}입니다.`,
                };
            }
        }
    }

    return null;
}

/**
 * Find a cell whose candidates list (from `getCandidates`) has exactly one
 * entry — a "naked single".
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @param {{rows: number, cols: number}} [blockSize=null]
 * @returns {Hint | null}
 */
function findNakedSingle(board, solution, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] !== 0) continue;

            const candidates = getCandidates(board, r, c, boardSize, blockSize, variant);
            if (candidates.size === 1) {
                const value = [...candidates][0];
                return {
                    type: 'nakedSingle',
                    row: r,
                    col: c,
                    value,
                    message: `이 칸에 들어갈 수 있는 숫자는 ${value} 하나뿐입니다.`,
                };
            }
        }
    }

    return null;
}

/**
 * Scan variant-specific groups (e.g. diagonals) for one that has exactly
 * one empty cell. Uses the variant rule's getExtraCells to discover groups.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @param {import('../core/variant-rules.js').VariantRule} variantRule
 * @returns {Hint | null}
 */
function findLastInVariantGroup(board, solution, boardSize = 9, variantRule) {
    // Collect unique groups: for each cell, getExtraCells returns the
    // other cells in the same group. We identify groups by checking all cells
    // and deduplicating by a canonical group key.
    const checkedGroups = new Set();

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const extra = variantRule.getExtraCells(r, c, boardSize);
            if (extra.length === 0) continue;

            // Build the full group (including this cell)
            const group = [{ row: r, col: c }, ...extra];
            // Canonical key: sorted positions
            const key = group.map(p => p.row * boardSize + p.col).sort((a, b) => a - b).join(',');
            if (checkedGroups.has(key)) continue;
            checkedGroups.add(key);

            // Check if this group has exactly one empty cell
            let emptyRow = -1, emptyCol = -1, emptyCount = 0;
            for (const cell of group) {
                if (board[cell.row][cell.col] === 0) {
                    emptyRow = cell.row;
                    emptyCol = cell.col;
                    emptyCount++;
                    if (emptyCount > 1) break;
                }
            }

            if (emptyCount === 1) {
                const value = solution[emptyRow][emptyCol];
                return {
                    type: 'lastInVariantGroup',
                    row: emptyRow,
                    col: emptyCol,
                    value,
                    message: `${variantRule.label} 그룹에 빈 칸이 하나 남았습니다. 정답은 ${value}입니다.`,
                };
            }
        }
    }

    return null;
}

/**
 * Hidden single: a number has only one possible cell within a unit (row, col, or block).
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @param {{rows: number, cols: number}} [blockSize=null]
 * @param {string} [variant='standard']
 * @returns {Hint | null}
 */
function findHiddenSingle(board, solution, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    // Helper to check a group of cells for a hidden single
    function checkUnit(cells, unitName) {
        for (let num = 1; num <= boardSize; num++) {
            // Skip if num already placed in this unit
            if (cells.some(c => board[c.row][c.col] === num)) continue;

            // Find empty cells that can hold this number
            const possible = [];
            for (const c of cells) {
                if (board[c.row][c.col] !== 0) continue;
                const cands = getCandidates(board, c.row, c.col, boardSize, blockSize, variant);
                if (cands.has(num)) {
                    possible.push(c);
                }
            }

            if (possible.length === 1) {
                const { row, col } = possible[0];
                return {
                    type: 'hiddenSingle',
                    row,
                    col,
                    value: solution[row][col],
                    message: `이 ${unitName}에서 ${num}이(가) 들어갈 수 있는 위치는 이곳뿐입니다.`,
                };
            }
        }
        return null;
    }

    // Check rows
    for (let r = 0; r < boardSize; r++) {
        const cells = [];
        for (let c = 0; c < boardSize; c++) cells.push({ row: r, col: c });
        const hint = checkUnit(cells, `${r + 1}행`);
        if (hint) return hint;
    }

    // Check columns
    for (let c = 0; c < boardSize; c++) {
        const cells = [];
        for (let r = 0; r < boardSize; r++) cells.push({ row: r, col: c });
        const hint = checkUnit(cells, `${c + 1}열`);
        if (hint) return hint;
    }

    // Check blocks
    const blockRowCount = boardSize / blockSize.rows;
    const blockColCount = boardSize / blockSize.cols;
    for (let br = 0; br < blockRowCount; br++) {
        for (let bc = 0; bc < blockColCount; bc++) {
            const cells = [];
            const startR = br * blockSize.rows;
            const startC = bc * blockSize.cols;
            for (let r = startR; r < startR + blockSize.rows; r++) {
                for (let c = startC; c < startC + blockSize.cols; c++) {
                    cells.push({ row: r, col: c });
                }
            }
            const hint = checkUnit(cells, '블록');
            if (hint) return hint;
        }
    }

    return null;
}

/**
 * Naked pair: two cells in a unit with identical 2-candidate sets.
 * Returns a hint for a cell that can be solved as a result of the elimination.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @param {{rows: number, cols: number}} [blockSize=null]
 * @param {string} [variant='standard']
 * @returns {Hint | null}
 */
function findNakedPair(board, solution, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    function getUnits() {
        const units = [];
        // Rows
        for (let r = 0; r < boardSize; r++) {
            const cells = [];
            for (let c = 0; c < boardSize; c++) cells.push({ row: r, col: c });
            units.push({ cells, name: `${r + 1}행` });
        }
        // Columns
        for (let c = 0; c < boardSize; c++) {
            const cells = [];
            for (let r = 0; r < boardSize; r++) cells.push({ row: r, col: c });
            units.push({ cells, name: `${c + 1}열` });
        }
        // Blocks
        const blockRowCount = boardSize / blockSize.rows;
        const blockColCount = boardSize / blockSize.cols;
        for (let br = 0; br < blockRowCount; br++) {
            for (let bc = 0; bc < blockColCount; bc++) {
                const cells = [];
                const startR = br * blockSize.rows;
                const startC = bc * blockSize.cols;
                for (let r = startR; r < startR + blockSize.rows; r++) {
                    for (let c = startC; c < startC + blockSize.cols; c++) {
                        cells.push({ row: r, col: c });
                    }
                }
                units.push({ cells, name: '블록' });
            }
        }
        return units;
    }

    for (const unit of getUnits()) {
        // Get candidates for empty cells
        const emptyCells = unit.cells.filter(c => board[c.row][c.col] === 0);
        const cellCands = emptyCells.map(c => ({
            ...c,
            cands: getCandidates(board, c.row, c.col, boardSize, blockSize, variant),
        }));

        // Find pairs: two cells with identical 2-element candidate sets
        for (let i = 0; i < cellCands.length; i++) {
            if (cellCands[i].cands.size !== 2) continue;
            for (let j = i + 1; j < cellCands.length; j++) {
                if (cellCands[j].cands.size !== 2) continue;

                const candsI = [...cellCands[i].cands];
                const candsJ = [...cellCands[j].cands];
                if (candsI[0] !== candsJ[0] || candsI[1] !== candsJ[1]) continue;

                // Found a naked pair! Check if any other cell in the unit
                // has one of these candidates and can be solved
                const [n1, n2] = candsI;
                for (const other of cellCands) {
                    if ((other.row === cellCands[i].row && other.col === cellCands[i].col) ||
                        (other.row === cellCands[j].row && other.col === cellCands[j].col)) continue;

                    if (other.cands.has(n1) || other.cands.has(n2)) {
                        // This cell has candidates affected by the pair.
                        // Return the solution hint for this cell.
                        return {
                            type: 'nakedPair',
                            row: other.row,
                            col: other.col,
                            value: solution[other.row][other.col],
                            message: `${unit.name}에서 두 칸에만 ${n1},${n2}가 가능하여 다른 칸에서 제거할 수 있습니다.`,
                        };
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Pointing pair: a number's candidates in a block are all in one row or column,
 * so it can be eliminated from that row/col outside the block.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @param {{rows: number, cols: number}} [blockSize=null]
 * @param {string} [variant='standard']
 * @returns {Hint | null}
 */
function findPointingPair(board, solution, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const blockRowCount = boardSize / blockSize.rows;
    const blockColCount = boardSize / blockSize.cols;

    for (let br = 0; br < blockRowCount; br++) {
        for (let bc = 0; bc < blockColCount; bc++) {
            const startR = br * blockSize.rows;
            const startC = bc * blockSize.cols;

            for (let num = 1; num <= boardSize; num++) {
                // Find cells in this block that can hold num
                const possible = [];
                for (let r = startR; r < startR + blockSize.rows; r++) {
                    for (let c = startC; c < startC + blockSize.cols; c++) {
                        if (board[r][c] !== 0) continue;
                        const cands = getCandidates(board, r, c, boardSize, blockSize, variant);
                        if (cands.has(num)) possible.push({ row: r, col: c });
                    }
                }

                if (possible.length < 2) continue;

                // Check if all in same row
                const allSameRow = possible.every(p => p.row === possible[0].row);
                if (allSameRow) {
                    const row = possible[0].row;
                    // Check if num can be eliminated from this row outside the block
                    for (let c = 0; c < boardSize; c++) {
                        if (c >= startC && c < startC + blockSize.cols) continue;
                        if (board[row][c] !== 0) continue;
                        const cands = getCandidates(board, row, c, boardSize, blockSize, variant);
                        if (cands.has(num)) {
                            return {
                                type: 'pointingPair',
                                row,
                                col: c,
                                value: solution[row][c],
                                message: `블록에서 ${num}은(는) ${row + 1}행에만 가능하므로, 같은 행의 다른 칸에서 제거할 수 있습니다.`,
                            };
                        }
                    }
                }

                // Check if all in same column
                const allSameCol = possible.every(p => p.col === possible[0].col);
                if (allSameCol) {
                    const col = possible[0].col;
                    for (let r = 0; r < boardSize; r++) {
                        if (r >= startR && r < startR + blockSize.rows) continue;
                        if (board[r][col] !== 0) continue;
                        const cands = getCandidates(board, r, col, boardSize, blockSize, variant);
                        if (cands.has(num)) {
                            return {
                                type: 'pointingPair',
                                row: r,
                                col,
                                value: solution[r][col],
                                message: `블록에서 ${num}은(는) ${col + 1}열에만 가능하므로, 같은 열의 다른 칸에서 제거할 수 있습니다.`,
                            };
                        }
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Fallback: pick a random empty cell and reveal its value from the solution.
 *
 * @param {number[][]} board
 * @param {number[][]} solution
 * @param {number} [boardSize=9]
 * @returns {Hint | null} `null` only when the board has no empty cells.
 */
function findDirectReveal(board, solution, boardSize = 9) {
    /** @type {{ row: number, col: number }[]} */
    const emptyCells = [];

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === 0) {
                emptyCells.push({ row: r, col: c });
            }
        }
    }

    if (emptyCells.length === 0) return null;

    const idx = Math.floor(Math.random() * emptyCells.length);
    const { row, col } = emptyCells[idx];
    const value = solution[row][col];

    return {
        type: 'direct',
        row,
        col,
        value,
        message: `이 칸의 정답은 ${value}입니다.`,
    };
}

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
 *  4. Naked single (cell with exactly one candidate)
 *  5. Fallback — reveal a random empty cell from the solution
 *
 * Supports multiple board sizes (4x4, 6x6, 9x9, 12x12, 16x16).
 *
 * @module game/hints
 */

import { getCandidates } from '../core/solver.js';
import { getBlockSize } from '../core/board-config.js';

// ---------------------------------------------------------------------------
// Hint types
// ---------------------------------------------------------------------------

/** @typedef {'lastInRow' | 'lastInCol' | 'lastInBlock' | 'nakedSingle' | 'direct'} HintType */

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
export function getHint(board, solution, notes, boardSize = 9, blockSize = null, useSmartHints = true) {
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

    // 4. Naked single (only one candidate)
    const nakedHint = findNakedSingle(board, solution, boardSize, blockSize);
    if (nakedHint) return nakedHint;

    // 5. Fallback — pick a random empty cell and reveal from solution
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
function findNakedSingle(board, solution, boardSize = 9, blockSize = null) {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] !== 0) continue;

            const candidates = getCandidates(board, r, c, boardSize, blockSize);
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

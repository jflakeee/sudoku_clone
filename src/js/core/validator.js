/**
 * Sudoku Input Validator
 *
 * Provides move validation, conflict detection, and cell-group helpers
 * for the game engine. Supports multiple board sizes.
 *
 * @module validator
 */

import { getBlockSize } from './board-config.js';
import { getExtraCells } from './variant-rules.js';

/**
 * Get all cell positions in the given row.
 *
 * @param {number} row - Row index
 * @param {number} [boardSize=9] - Board dimension
 * @returns {{row: number, col: number}[]} Array of cell positions
 */
export function getRowCells(row, boardSize = 9) {
    const cells = [];
    for (let c = 0; c < boardSize; c++) {
        cells.push({ row, col: c });
    }
    return cells;
}

/**
 * Get all cell positions in the given column.
 *
 * @param {number} col - Column index
 * @param {number} [boardSize=9] - Board dimension
 * @returns {{row: number, col: number}[]} Array of cell positions
 */
export function getColCells(col, boardSize = 9) {
    const cells = [];
    for (let r = 0; r < boardSize; r++) {
        cells.push({ row: r, col });
    }
    return cells;
}

/**
 * Get all cell positions in the block that contains (row, col).
 *
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {{row: number, col: number}[]} Array of cell positions
 */
export function getBlockCells(row, col, boardSize = 9, blockSize = null) {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const cells = [];
    const blockRow = Math.floor(row / blockSize.rows) * blockSize.rows;
    const blockCol = Math.floor(col / blockSize.cols) * blockSize.cols;

    for (let r = blockRow; r < blockRow + blockSize.rows; r++) {
        for (let c = blockCol; c < blockCol + blockSize.cols; c++) {
            cells.push({ row: r, col: c });
        }
    }

    return cells;
}

/**
 * Get all cells on the same diagonal(s) as (row, col).
 * Returns cells from the main diagonal (row===col) and/or anti-diagonal
 * (row+col===boardSize-1) if the cell lies on them.
 *
 * NOTE: This is now a thin wrapper around getExtraCells('diagonal', ...).
 * It includes the cell itself in the result (matching original behavior)
 * for backward compatibility with callers like HighlightUI.
 *
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} [boardSize=9] - Board dimension
 * @returns {{row: number, col: number}[]} Array of cell positions
 */
export function getDiagonalCells(row, col, boardSize = 9) {
    const extra = getExtraCells('diagonal', row, col, boardSize);
    if (extra.length === 0) return [];
    // getExtraCells excludes the cell itself; getDiagonalCells includes it
    return [{ row, col }, ...extra];
}

/**
 * Find all cells that conflict with placing `num` at (row, col).
 * A conflict means another cell in the same row, column, or block
 * already contains the same number.
 *
 * The target cell itself is never included in the result.
 *
 * @param {number[][]} board - Sudoku board (0 = empty)
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} num - Number to check
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @param {string} [variant='standard'] - Game variant ('standard' or 'diagonal')
 * @param {object} [extraData] - Extra variant data (e.g. cages for killer)
 * @returns {{row: number, col: number}[]} Array of conflicting cell positions
 */
export function checkConflicts(board, row, col, num, boardSize = 9, blockSize = null, variant = 'standard', extraData = null) {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    if (num < 1 || num > boardSize) return [];

    const conflicts = [];
    const seen = new Set();

    /**
     * Helper to add a conflict if the cell holds the same number and
     * isn't the target cell itself.
     */
    const check = (r, c) => {
        if (r === row && c === col) return;
        const key = r * boardSize + c;
        if (seen.has(key)) return;
        if (board[r][c] === num) {
            seen.add(key);
            conflicts.push({ row: r, col: c });
        }
    };

    // Row
    for (let c = 0; c < boardSize; c++) check(row, c);

    // Column
    for (let r = 0; r < boardSize; r++) check(r, col);

    // Block
    const blockRow = Math.floor(row / blockSize.rows) * blockSize.rows;
    const blockCol = Math.floor(col / blockSize.cols) * blockSize.cols;
    for (let r = blockRow; r < blockRow + blockSize.rows; r++) {
        for (let c = blockCol; c < blockCol + blockSize.cols; c++) {
            check(r, c);
        }
    }

    // Variant-specific extra cells
    const extraCells = getExtraCells(variant, row, col, boardSize, extraData);
    for (const cell of extraCells) {
        check(cell.row, cell.col);
    }

    return conflicts;
}

/**
 * Validate a player's move by comparing it to the known solution.
 *
 * @param {number[][]} board - Current board state
 * @param {number[][]} solution - Complete solution
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} num - Number the player entered
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {{valid: boolean, complete: boolean}} Result object
 */
export function validateMove(board, solution, row, col, num, boardSize = 9, blockSize = null) {
    const valid = solution[row][col] === num;

    // If the move is valid, check whether it completes the board.
    // We simulate placing the number first so isBoardComplete can see it.
    let complete = false;
    if (valid) {
        const prev = board[row][col];
        board[row][col] = num;
        complete = isBoardComplete(board, solution, boardSize);
        board[row][col] = prev;
    }

    return { valid, complete };
}

/**
 * Check whether every cell on the board matches the solution.
 *
 * @param {number[][]} board - Current board state
 * @param {number[][]} solution - Complete solution
 * @param {number} [boardSize=9] - Board dimension
 * @returns {boolean} True if all cells match the solution
 */
export function isBoardComplete(board, solution, boardSize = 9) {
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] !== solution[r][c]) {
                return false;
            }
        }
    }
    return true;
}

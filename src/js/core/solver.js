/**
 * Sudoku Solver
 *
 * Backtracking-based solver for Sudoku puzzles.
 * Board representation: NxN array of integers, 0 = empty cell.
 * Supports multiple board sizes (4x4, 6x6, 9x9, 12x12, 16x16).
 *
 * @module solver
 */

import { getBlockSize } from './board-config.js';

/**
 * Check whether placing `num` at (row, col) is valid according to
 * standard Sudoku rules (no duplicate in row, column, or block).
 *
 * @param {number[][]} board - Sudoku board (0 = empty)
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} num - Number to test
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {boolean} True if the placement is valid
 */
export function isValid(board, row, col, num, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    // Check row
    for (let c = 0; c < boardSize; c++) {
        if (board[row][c] === num) return false;
    }

    // Check column
    for (let r = 0; r < boardSize; r++) {
        if (board[r][col] === num) return false;
    }

    // Check block
    const blockRow = Math.floor(row / blockSize.rows) * blockSize.rows;
    const blockCol = Math.floor(col / blockSize.cols) * blockSize.cols;
    for (let r = blockRow; r < blockRow + blockSize.rows; r++) {
        for (let c = blockCol; c < blockCol + blockSize.cols; c++) {
            if (board[r][c] === num) return false;
        }
    }

    // Check diagonals
    if (variant === 'diagonal') {
        if (row === col) {
            for (let i = 0; i < boardSize; i++) {
                if (i !== row && board[i][i] === num) return false;
            }
        }
        if (row + col === boardSize - 1) {
            for (let i = 0; i < boardSize; i++) {
                if (i !== row && board[i][boardSize - 1 - i] === num) return false;
            }
        }
    }

    return true;
}

/**
 * Get the set of valid candidate numbers for a given empty cell.
 *
 * @param {number[][]} board - Sudoku board (0 = empty)
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {Set<number>} Set of valid numbers that can be placed
 */
export function getCandidates(board, row, col, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const candidates = new Set();

    if (board[row][col] !== 0) {
        return candidates;
    }

    for (let num = 1; num <= boardSize; num++) {
        if (isValid(board, row, col, num, boardSize, blockSize, variant)) {
            candidates.add(num);
        }
    }

    return candidates;
}

/**
 * Find the next empty cell on the board, using the MRV (Minimum Remaining
 * Values) heuristic: pick the empty cell with the fewest candidates first.
 * This dramatically prunes the search tree.
 *
 * @param {number[][]} board - Sudoku board
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {{row: number, col: number} | null} Position of the best empty cell, or null if none
 */
function findBestEmptyCell(board, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    let bestCell = null;
    let minCandidates = boardSize + 1;

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === 0) {
                const count = getCandidates(board, r, c, boardSize, blockSize, variant).size;
                if (count < minCandidates) {
                    minCandidates = count;
                    bestCell = { row: r, col: c };
                    // Can't do better than 1
                    if (count === 1) return bestCell;
                }
            }
        }
    }

    return bestCell;
}

/**
 * Solve a Sudoku puzzle using backtracking with MRV heuristic.
 * The input board is not modified; a new solved board is returned.
 *
 * @param {number[][]} board - Sudoku board (0 = empty)
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {number[][] | null} Solved board, or null if no solution exists
 */
export function solve(board, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    // Deep copy the board so we don't mutate the original
    const copy = board.map(row => [...row]);

    if (solveInPlace(copy, boardSize, blockSize, variant)) {
        return copy;
    }

    return null;
}

/**
 * Internal recursive solver that mutates the board in place.
 *
 * @param {number[][]} board - Board (mutated in place)
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {boolean} True if the board was solved successfully
 */
function solveInPlace(board, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const cell = findBestEmptyCell(board, boardSize, blockSize, variant);

    // No empty cell means the puzzle is complete
    if (!cell) return true;

    const { row, col } = cell;
    const candidates = getCandidates(board, row, col, boardSize, blockSize, variant);

    for (const num of candidates) {
        board[row][col] = num;

        if (solveInPlace(board, boardSize, blockSize, variant)) {
            return true;
        }

        board[row][col] = 0;
    }

    return false;
}

/**
 * Count the number of solutions for a given board, stopping early once
 * the count reaches `limit`. This is used to verify puzzle uniqueness
 * (a proper Sudoku puzzle must have exactly 1 solution).
 *
 * @param {number[][]} board - Sudoku board (0 = empty)
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @param {number} [limit=2] - Stop counting once this many solutions are found
 * @returns {number} Number of solutions found (capped at `limit`)
 */
export function countSolutions(board, boardSize = 9, blockSize = null, limit = 2, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    // Deep copy to avoid mutating the original
    const copy = board.map(row => [...row]);
    const counter = { count: 0 };

    countSolutionsRecursive(copy, limit, counter, boardSize, blockSize, variant);

    return counter.count;
}

/**
 * Internal recursive solution counter.
 *
 * @param {number[][]} board - Board (mutated in place during recursion)
 * @param {number} limit - Maximum solutions to count
 * @param {{count: number}} counter - Mutable counter object
 * @param {number} boardSize - Board dimension
 * @param {{rows: number, cols: number}} blockSize - Block dimensions
 */
function countSolutionsRecursive(board, limit, counter, boardSize, blockSize, variant = 'standard') {
    if (counter.count >= limit) return;

    const cell = findBestEmptyCell(board, boardSize, blockSize, variant);

    // No empty cell — we found a complete valid solution
    if (!cell) {
        counter.count++;
        return;
    }

    const { row, col } = cell;
    const candidates = getCandidates(board, row, col, boardSize, blockSize, variant);

    for (const num of candidates) {
        if (counter.count >= limit) return;

        board[row][col] = num;
        countSolutionsRecursive(board, limit, counter, boardSize, blockSize, variant);
        board[row][col] = 0;
    }
}

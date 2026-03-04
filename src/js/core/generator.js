/**
 * Sudoku Puzzle Generator
 *
 * Generates valid Sudoku puzzles with a unique solution at the
 * requested difficulty level.
 *
 * Algorithm:
 *   1. Build a complete, valid board via backtracking with randomisation.
 *   2. Remove cells one at a time (in random order), verifying after each
 *      removal that the puzzle still has exactly one solution.
 *   3. Stop removing when the target number of empty cells is reached.
 *
 * Supports multiple board sizes (4x4, 6x6, 9x9, 12x12, 16x16).
 *
 * @module generator
 */

import { isValid, countSolutions } from './solver.js';
import { getBlockSize, getDifficultyRange } from './board-config.js';

/**
 * Difficulty presets (9x9 fallback).
 * Each entry defines the [min, max] number of cells to remove (make empty).
 *
 * @type {Record<string, [number, number]>}
 */
const DIFFICULTY_RANGES = {
    easy:   [36, 40],
    normal: [41, 46],
    hard:   [47, 51],
    expert: [52, 55],
    master: [56, 60],
};

/**
 * Pick a random integer in [min, max] (inclusive).
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle an array in place using Fisher-Yates.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T[]} The same array, shuffled
 */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Create an empty board (all zeros).
 *
 * @param {number} [boardSize=9] - Board dimension
 * @returns {number[][]}
 */
function createEmptyBoard(boardSize = 9) {
    return Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
}

/**
 * Generate a complete, valid Sudoku board using backtracking with
 * randomised candidate ordering so that each call produces a different board.
 *
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {number[][]} A fully filled valid board
 */
function generateCompleteBoard(boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const board = createEmptyBoard(boardSize);
    const totalCells = boardSize * boardSize;

    /**
     * Recursively fill the board cell by cell (left-to-right, top-to-bottom).
     *
     * @param {number} pos - Linear position
     * @returns {boolean}
     */
    function fill(pos) {
        if (pos === totalCells) return true;

        const row = Math.floor(pos / boardSize);
        const col = pos % boardSize;

        // Try digits 1..boardSize in random order
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
    return board;
}

/**
 * Remove cells from a complete board to create a puzzle, ensuring that
 * the puzzle retains a unique solution after each removal.
 *
 * @param {number[][]} board - Complete board (will be mutated)
 * @param {number} cellsToRemove - Target number of cells to blank out
 * @param {number} [boardSize=9] - Board dimension
 * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
 * @returns {number} Actual number of cells removed (may be less than target
 *                   if uniqueness can't be maintained)
 */
function removeCells(board, cellsToRemove, boardSize = 9, blockSize = null, variant = 'standard') {
    if (!blockSize) blockSize = getBlockSize(boardSize);

    const totalCells = boardSize * boardSize;

    // Build a list of all positions and shuffle them
    const positions = shuffle(
        Array.from({ length: totalCells }, (_, i) => ({
            row: Math.floor(i / boardSize),
            col: i % boardSize,
        }))
    );

    let removed = 0;

    for (const { row, col } of positions) {
        if (removed >= cellsToRemove) break;

        const backup = board[row][col];
        if (backup === 0) continue; // Already removed

        board[row][col] = 0;

        // Verify that the puzzle still has exactly one solution
        if (countSolutions(board, boardSize, blockSize, 2, variant) !== 1) {
            // Removal would create multiple solutions — put it back
            board[row][col] = backup;
            continue;
        }

        removed++;
    }

    return removed;
}

/**
 * Generate a Sudoku puzzle at the given difficulty level.
 *
 * @param {string} difficulty - One of 'easy', 'normal', 'hard', 'expert', 'master'
 * @param {number} [boardSize=9] - Board dimension
 * @param {string} [dailyDate=null] - Reserved for future daily-challenge seeding
 * @returns {{
 *   board: number[][],
 *   solution: number[][],
 *   given: boolean[][],
 *   difficulty: string
 * }} Puzzle data
 * @throws {Error} If an invalid difficulty string is provided
 */
export function generatePuzzle(difficulty, boardSize = 9, dailyDate = null, variant = 'standard') {
    const blockSize = getBlockSize(boardSize);

    // Get range from centralized config; fall back to local 9x9 ranges
    let range;
    try {
        range = getDifficultyRange(boardSize, difficulty);
    } catch {
        range = DIFFICULTY_RANGES[difficulty];
    }

    if (!range) {
        throw new Error(
            `Invalid difficulty "${difficulty}". ` +
            `Expected one of: ${Object.keys(DIFFICULTY_RANGES).join(', ')}`
        );
    }

    const [minRemove, maxRemove] = range;
    const cellsToRemove = randomInt(minRemove, maxRemove);

    // 1. Generate a full valid board
    const solution = generateCompleteBoard(boardSize, blockSize, variant);

    // 2. Deep-copy for the player board, then remove cells
    const board = solution.map(row => [...row]);
    removeCells(board, cellsToRemove, boardSize, blockSize, variant);

    // 3. Build the "given" mask
    const given = board.map(row => row.map(cell => cell !== 0));

    const result = {
        board,
        solution,
        given,
        difficulty,
        variant,
    };

    // Generate evenOddMap for even-odd variant
    if (variant === 'even-odd') {
        result.evenOddMap = generateEvenOddMap(solution, boardSize);
    }

    // Generate cages for killer variant
    if (variant === 'killer') {
        result.cages = generateCages(solution, boardSize);
    }

    return result;
}

/**
 * Generate cages for killer sudoku by grouping adjacent cells.
 * Each cage has 2-4 cells with a target sum from the solution.
 *
 * @param {number[][]} solution - Complete solution board
 * @param {number} boardSize - Board dimension
 * @returns {{cells: {row: number, col: number}[], sum: number}[]}
 */
export function generateCages(solution, boardSize) {
    const assigned = Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
    const cages = [];

    // Shuffle all cell positions
    const allCells = shuffle(
        Array.from({ length: boardSize * boardSize }, (_, i) => ({
            row: Math.floor(i / boardSize),
            col: i % boardSize,
        }))
    );

    for (const start of allCells) {
        if (assigned[start.row][start.col]) continue;

        // BFS to grow cage from start cell
        const cageSize = randomInt(2, 4);
        const cage = [start];
        assigned[start.row][start.col] = true;

        const frontier = getNeighbors(start.row, start.col, boardSize)
            .filter(n => !assigned[n.row][n.col]);
        shuffle(frontier);

        while (cage.length < cageSize && frontier.length > 0) {
            const next = frontier.pop();
            if (assigned[next.row][next.col]) continue;

            cage.push(next);
            assigned[next.row][next.col] = true;

            // Add new neighbors to frontier
            const newNeighbors = getNeighbors(next.row, next.col, boardSize)
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

/**
 * Get orthogonally adjacent cells.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} boardSize
 * @returns {{row: number, col: number}[]}
 */
function getNeighbors(row, col, boardSize) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return dirs
        .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
        .filter(c => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
}

/**
 * Generate an even/odd constraint map from the solution.
 * Marks ~35% of ALL cells with their parity (1=odd, 2=even).
 *
 * @param {number[][]} solution - Complete solution board
 * @param {number} boardSize - Board dimension
 * @returns {number[][]} Map where 0=none, 1=odd, 2=even
 */
function generateEvenOddMap(solution, boardSize) {
    const map = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (Math.random() < 0.35) {
                map[r][c] = solution[r][c] % 2 === 0 ? 2 : 1;
            }
        }
    }
    return map;
}

/**
 * Sudoku Puzzle Generator
 *
 * Generates valid Sudoku puzzles with a unique solution at the
 * requested difficulty level.
 *
 * Algorithm:
 *   1. Build a complete, valid 9x9 board via backtracking with randomisation.
 *   2. Remove cells one at a time (in random order), verifying after each
 *      removal that the puzzle still has exactly one solution.
 *   3. Stop removing when the target number of empty cells is reached.
 *
 * @module generator
 */

import { isValid, countSolutions } from './solver.js';

/**
 * Difficulty presets.
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
 * Create an empty 9x9 board (all zeros).
 *
 * @returns {number[][]}
 */
function createEmptyBoard() {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
}

/**
 * Generate a complete, valid 9x9 Sudoku board using backtracking with
 * randomised candidate ordering so that each call produces a different board.
 *
 * @returns {number[][]} A fully filled valid board
 */
function generateCompleteBoard() {
    const board = createEmptyBoard();

    /**
     * Recursively fill the board cell by cell (left-to-right, top-to-bottom).
     *
     * @param {number} pos - Linear position 0..80
     * @returns {boolean}
     */
    function fill(pos) {
        if (pos === 81) return true;

        const row = Math.floor(pos / 9);
        const col = pos % 9;

        // Try digits 1-9 in random order
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

        for (const num of nums) {
            if (isValid(board, row, col, num)) {
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
 * @param {number[][]} board - Complete 9x9 board (will be mutated)
 * @param {number} cellsToRemove - Target number of cells to blank out
 * @returns {number} Actual number of cells removed (may be less than target
 *                   if uniqueness can't be maintained)
 */
function removeCells(board, cellsToRemove) {
    // Build a list of all 81 positions and shuffle them
    const positions = shuffle(
        Array.from({ length: 81 }, (_, i) => ({
            row: Math.floor(i / 9),
            col: i % 9,
        }))
    );

    let removed = 0;

    for (const { row, col } of positions) {
        if (removed >= cellsToRemove) break;

        const backup = board[row][col];
        if (backup === 0) continue; // Already removed

        board[row][col] = 0;

        // Verify that the puzzle still has exactly one solution
        if (countSolutions(board, 2) !== 1) {
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
 * @returns {{
 *   board: number[][],
 *   solution: number[][],
 *   given: boolean[][],
 *   difficulty: string
 * }} Puzzle data:
 *   - board: 9x9 array with 0s for empty cells the player must fill
 *   - solution: 9x9 complete solution
 *   - given: 9x9 boolean array (true = pre-filled / immutable cell)
 *   - difficulty: the difficulty string passed in
 * @throws {Error} If an invalid difficulty string is provided
 */
export function generatePuzzle(difficulty) {
    const range = DIFFICULTY_RANGES[difficulty];
    if (!range) {
        throw new Error(
            `Invalid difficulty "${difficulty}". ` +
            `Expected one of: ${Object.keys(DIFFICULTY_RANGES).join(', ')}`
        );
    }

    const [minRemove, maxRemove] = range;
    const cellsToRemove = randomInt(minRemove, maxRemove);

    // 1. Generate a full valid board
    const solution = generateCompleteBoard();

    // 2. Deep-copy for the player board, then remove cells
    const board = solution.map(row => [...row]);
    removeCells(board, cellsToRemove);

    // 3. Build the "given" mask
    const given = board.map(row => row.map(cell => cell !== 0));

    return {
        board,
        solution,
        given,
        difficulty,
    };
}

/**
 * Board – Central Game State Manager
 *
 * Owns the authoritative game state: the puzzle board, solution, given flags,
 * notes, history stack, timer, score, and mistake count.  All mutations to
 * game data flow through this class so that a single serialisable snapshot
 * can be saved/restored at any time.
 *
 * @module game/board
 */

import { generatePuzzle } from '../core/generator.js';
import { validateMove, isBoardComplete, checkConflicts } from '../core/validator.js';
import { calculateCellScore, calculateCompletionBonus } from '../core/scorer.js';
import { Notes } from './notes.js';
import { History } from './history.js';
import { Timer } from './timer.js';
import { getDailySeed, seededRandom } from '../utils/daily-seed.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum mistakes before game-over (when the limit is enabled). */
const MAX_MISTAKES = 3;

/** Default hints available per game. */
const DEFAULT_HINTS = 3;

/** Difficulty key to Korean label mapping. */
const DIFFICULTY_LABELS = {
    easy:   '쉬움',
    normal: '보통',
    medium: '보통',
    hard:   '어려움',
    expert: '전문가',
    master: '마스터',
};

// ---------------------------------------------------------------------------
// Board class
// ---------------------------------------------------------------------------

/**
 * @class Board
 */
export class Board {
    /**
     * Initialise an empty Board. Call {@link newGame} or {@link loadState} to
     * populate it with actual puzzle data.
     */
    constructor() {
        /** @type {number[][]} 9x9 current player board (0 = empty). */
        this._board = Board._emptyGrid();

        /** @type {number[][]} 9x9 complete solution. */
        this._solution = Board._emptyGrid();

        /** @type {boolean[][]} 9x9 – true for pre-filled (immutable) cells. */
        this._given = Board._emptyBoolGrid();

        /** @type {Notes} Pencil-mark manager. */
        this.notes = new Notes();

        /** @type {History} Undo stack. */
        this.history = new History();

        /** @type {Timer} Elapsed-time tracker. */
        this.timer = new Timer();

        /** @type {string} Difficulty key. */
        this._difficulty = 'easy';

        /** @type {number} Accumulated score. */
        this._score = 0;

        /** @type {number} Number of mistakes made so far. */
        this._mistakes = 0;

        /** @type {number} Remaining hint uses. */
        this._hints = DEFAULT_HINTS;

        /** @type {string|null} ISO date string for daily-challenge puzzles. */
        this._dailyDate = null;

        /** @type {boolean} Whether the game is over (complete or failed). */
        this._gameOver = false;
    }

    // -----------------------------------------------------------------------
    // Game lifecycle
    // -----------------------------------------------------------------------

    /**
     * Generate a brand-new puzzle and reset all game state.
     *
     * @param {string} difficulty - One of 'easy', 'normal', 'hard', 'expert', 'master'.
     * @param {string} [dailyDate] - Optional ISO date string (e.g. '2026-02-26')
     *   to generate the deterministic daily puzzle for that date.
     */
    newGame(difficulty, dailyDate) {
        // Generate the puzzle ---------------------------------------------------
        // For daily challenges we seed Math.random via a temporary override so
        // that the generator produces the same board for every player on a given
        // date.  The generator internally uses Math.random, so we monkey-patch it
        // for the duration of the call and restore it afterwards.
        let puzzle;

        if (dailyDate) {
            const date = new Date(dailyDate);
            const seed = getDailySeed(date);
            const rng = seededRandom(seed);
            const origRandom = Math.random;
            Math.random = rng;
            try {
                puzzle = generatePuzzle(difficulty);
            } finally {
                Math.random = origRandom;
            }
        } else {
            puzzle = generatePuzzle(difficulty);
        }

        // Reset state -----------------------------------------------------------
        this._board = puzzle.board;
        this._solution = puzzle.solution;
        this._given = puzzle.given;
        this._difficulty = puzzle.difficulty;
        this._score = 0;
        this._mistakes = 0;
        this._hints = DEFAULT_HINTS;
        this._dailyDate = dailyDate || null;
        this._gameOver = false;

        this.notes = new Notes();
        this.history = new History();
        this.timer.reset();
        this.timer.start();
    }

    /**
     * Restore game state from a previously saved snapshot.
     *
     * @param {object} savedState - Object produced by {@link getState}.
     */
    loadState(savedState) {
        if (!savedState) return;

        this._board = savedState.board || Board._emptyGrid();
        this._solution = savedState.solution || Board._emptyGrid();
        this._given = savedState.given || Board._emptyBoolGrid();
        this._difficulty = savedState.difficulty || 'easy';
        this._score = savedState.score || 0;
        this._mistakes = savedState.mistakes || 0;
        this._hints = typeof savedState.hints === 'number' ? savedState.hints : DEFAULT_HINTS;
        this._dailyDate = savedState.dailyDate || null;
        this._gameOver = savedState.gameOver || false;

        // Notes
        this.notes = new Notes();
        if (savedState.notes) {
            this.notes.fromJSON(savedState.notes);
        }

        // History
        this.history = new History();
        if (savedState.history) {
            this.history.fromJSON(savedState.history);
        }

        // Timer – restore elapsed seconds but don't auto-start
        this.timer = new Timer();
        if (typeof savedState.time === 'number') {
            this.timer.setElapsed(savedState.time);
        }
    }

    /**
     * Return a plain, JSON-serialisable snapshot of the entire game state
     * suitable for persistence.
     *
     * @returns {object}
     */
    getState() {
        return {
            board: this._board.map(r => [...r]),
            solution: this._solution.map(r => [...r]),
            given: this._given.map(r => [...r]),
            difficulty: this._difficulty,
            score: this._score,
            mistakes: this._mistakes,
            maxMistakes: MAX_MISTAKES,
            hints: this._hints,
            time: this.timer.getElapsed(),
            notes: this.notes.toJSON(),
            history: this.history.toJSON(),
            dailyDate: this._dailyDate,
            gameOver: this._gameOver,
        };
    }

    // -----------------------------------------------------------------------
    // Cell accessors
    // -----------------------------------------------------------------------

    /**
     * Get the current value of a cell.
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     * @returns {number} 1-9 if filled, 0 if empty.
     */
    getCellValue(row, col) {
        return this._board[row][col];
    }

    /**
     * Set a cell value (player input), validate it against the solution, and
     * return the result.
     *
     * This method also handles:
     * - recording the action in the undo history
     * - updating the mistake counter
     * - auto-clearing related notes
     * - computing the earned score
     *
     * @param {number} row
     * @param {number} col
     * @param {number} num - Digit 1-9.
     * @returns {{
     *   valid: boolean,
     *   complete: boolean,
     *   conflicts: {row: number, col: number}[],
     *   score: number
     * }}
     */
    setCellValue(row, col, num) {
        if (this._gameOver) {
            return { valid: false, complete: false, conflicts: [], score: 0 };
        }

        // Cannot overwrite given cells
        if (this._given[row][col]) {
            return { valid: false, complete: false, conflicts: [], score: 0 };
        }

        const prevValue = this._board[row][col];
        const prevNotes = [...this.notes.get(row, col)];

        // Record undo action
        this.history.push({
            type: 'input',
            row,
            col,
            prevValue,
            newValue: num,
            prevNotes,
            newNotes: [],
        });

        // Place the value
        this._board[row][col] = num;

        // Clear notes on this cell
        this.notes.clear(row, col);

        // Validate against solution
        const { valid, complete } = validateMove(
            this._board, this._solution, row, col, num
        );

        // Get conflicts for visual feedback
        const conflicts = checkConflicts(this._board, row, col, num);

        let score = 0;

        if (valid) {
            // Auto-clear the placed digit from related cells' notes
            this.notes.removeFromRelated(row, col, num);

            // Calculate score
            const hasNotes = prevNotes.length > 0;
            score = calculateCellScore(
                this._difficulty,
                hasNotes,
                this.timer.getElapsed()
            );
            this._score += score;

            // Completion bonus
            if (complete) {
                const bonus = calculateCompletionBonus(
                    this._difficulty,
                    this._mistakes,
                    this.timer.getElapsed()
                );
                this._score += bonus;
                score += bonus;
                this._gameOver = true;
                this.timer.pause();
            }
        } else {
            // Wrong answer – increment mistake count
            this._mistakes++;

            if (this._mistakes >= MAX_MISTAKES) {
                this._gameOver = true;
                this.timer.pause();
            }
        }

        return { valid, complete, conflicts, score };
    }

    /**
     * Whether a cell is a pre-filled (given / immutable) cell.
     *
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    isGiven(row, col) {
        return this._given[row][col];
    }

    /**
     * Whether a cell is currently empty (value 0).
     *
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    isEmpty(row, col) {
        return this._board[row][col] === 0;
    }

    /**
     * Erase a user-entered value (not a given cell). Records the action in
     * history for undo support.
     *
     * @param {number} row
     * @param {number} col
     * @returns {number} The value that was erased (0 if cell was already empty
     *   or is a given cell).
     */
    erase(row, col) {
        if (this._given[row][col]) return 0;

        const prevValue = this._board[row][col];
        const prevNotes = [...this.notes.get(row, col)];

        if (prevValue === 0 && prevNotes.length === 0) return 0;

        // Record undo
        this.history.push({
            type: 'erase',
            row,
            col,
            prevValue,
            newValue: 0,
            prevNotes,
            newNotes: [],
        });

        this._board[row][col] = 0;
        this.notes.clear(row, col);

        return prevValue;
    }

    // -----------------------------------------------------------------------
    // Game info
    // -----------------------------------------------------------------------

    /**
     * Current mistake count and the maximum allowed.
     *
     * @returns {{ current: number, max: number }}
     */
    getMistakes() {
        return { current: this._mistakes, max: MAX_MISTAKES };
    }

    /**
     * Current accumulated score.
     *
     * @returns {number}
     */
    getScore() {
        return this._score;
    }

    /**
     * Add points to the score (e.g. from hints that auto-fill a cell).
     *
     * @param {number} points
     */
    addScore(points) {
        this._score += points;
    }

    /**
     * Whether the game is fully completed (all cells correct).
     *
     * @returns {boolean}
     */
    isComplete() {
        return isBoardComplete(this._board, this._solution);
    }

    /**
     * Whether the game is over (completed or max mistakes reached).
     *
     * @returns {boolean}
     */
    isGameOver() {
        return this._gameOver;
    }

    /**
     * The difficulty key string (e.g. 'easy', 'hard').
     *
     * @returns {string}
     */
    getDifficulty() {
        return this._difficulty;
    }

    /**
     * The Korean label for the current difficulty.
     *
     * @returns {string}
     */
    getDifficultyLabel() {
        return DIFFICULTY_LABELS[this._difficulty] || this._difficulty;
    }

    /**
     * Raw 9x9 board array. Returns the internal reference for read-only use.
     *
     * @returns {number[][]}
     */
    getBoard() {
        return this._board;
    }

    /**
     * Full 9x9 solution array.
     *
     * @returns {number[][]}
     */
    getSolution() {
        return this._solution;
    }

    /**
     * 9x9 given-flag array.
     *
     * @returns {boolean[][]}
     */
    getGiven() {
        return this._given;
    }

    /**
     * Count how many times a specific digit appears on the current board.
     * Used by the number-pad to fade out completed digits (count >= 9).
     *
     * @param {number} num - Digit 1-9.
     * @returns {number}
     */
    getNumberCount(num) {
        let count = 0;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this._board[r][c] === num) count++;
            }
        }
        return count;
    }

    /**
     * Number of remaining hint uses.
     *
     * @returns {number}
     */
    getHintCount() {
        return this._hints;
    }

    /**
     * Consume one hint use. Returns `false` if no hints remain.
     *
     * @returns {boolean}
     */
    useHint() {
        if (this._hints <= 0) return false;
        this._hints--;
        return true;
    }

    /**
     * The ISO date string for this game if it is a daily challenge,
     * otherwise `null`.
     *
     * @returns {string|null}
     */
    getDailyDate() {
        return this._dailyDate;
    }

    // -----------------------------------------------------------------------
    // Serialisation alias (used by app.js auto-save)
    // -----------------------------------------------------------------------

    /**
     * Alias of {@link getState} for compatibility with `app.js` which calls
     * `board.toJSON()`.
     *
     * @returns {object}
     */
    toJSON() {
        return this.getState();
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Create an empty 9x9 number grid.
     *
     * @returns {number[][]}
     * @private
     */
    static _emptyGrid() {
        return Array.from({ length: 9 }, () => Array(9).fill(0));
    }

    /**
     * Create a 9x9 grid of `false`.
     *
     * @returns {boolean[][]}
     * @private
     */
    static _emptyBoolGrid() {
        return Array.from({ length: 9 }, () => Array(9).fill(false));
    }
}

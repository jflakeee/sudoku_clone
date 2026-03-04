/**
 * Board – Central Game State Manager
 *
 * Owns the authoritative game state: the puzzle board, solution, given flags,
 * notes, history stack, timer, score, and mistake count.  All mutations to
 * game data flow through this class so that a single serialisable snapshot
 * can be saved/restored at any time.
 *
 * Supports multiple board sizes (4x4, 6x6, 9x9, 12x12, 16x16).
 *
 * @module game/board
 */

import { generatePuzzle } from '../core/generator.js';
import { validateMove, isBoardComplete, checkConflicts } from '../core/validator.js';
import { calculateCellScore, calculateCompletionBonus } from '../core/scorer.js';
import { getBlockSize } from '../core/board-config.js';
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
        /** @type {number} Board dimension. */
        this.boardSize = 9;

        /** @type {{rows: number, cols: number}} Block dimensions. */
        this.blockSize = getBlockSize(9);

        /** @type {number[][]} Current player board (0 = empty). */
        this._board = Board._emptyGrid(this.boardSize);

        /** @type {number[][]} Complete solution. */
        this._solution = Board._emptyGrid(this.boardSize);

        /** @type {boolean[][]} True for pre-filled (immutable) cells. */
        this._given = Board._emptyBoolGrid(this.boardSize);

        /** @type {Notes} Pencil-mark manager. */
        this.notes = new Notes(this.boardSize, this.blockSize);

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

        /** @type {string} Game mode ('classic', 'timeAttack', etc.). */
        this.mode = 'classic';

        /** @type {number[][]|null} Snapshot of the initial puzzle (before player input). */
        this._initialPuzzle = null;

        /** @type {string} Game variant ('standard' or 'diagonal'). */
        this.variant = 'standard';

        /** @type {number[][]|null} Cell color markings (0 = none, 1-6 = color index). */
        this._cellColors = null;

        /** @type {number[][]|null} Even/Odd constraint map (0=none, 1=odd, 2=even). */
        this._evenOddMap = null;

        /** @type {Array<{cells: {row: number, col: number}[], sum: number}>|null} Killer cages. */
        this._cages = null;
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
     * @param {string} [mode='classic'] - Game mode ('classic', 'timeAttack', etc.).
     * @param {object} [options={}] - Additional mode-specific options.
     */
    newGame(difficulty, dailyDate, mode = 'classic', options = {}) {
        // Update board size if specified
        if (options.boardSize) {
            this.boardSize = options.boardSize;
            this.blockSize = getBlockSize(this.boardSize);
        }

        this.variant = options.variant || 'standard';

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
                puzzle = generatePuzzle(difficulty, this.boardSize, null, this.variant);
            } finally {
                Math.random = origRandom;
            }
        } else {
            puzzle = generatePuzzle(difficulty, this.boardSize, null, this.variant);
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
        this.mode = mode;
        this._initialPuzzle = this._board.map(r => [...r]);
        this._cellColors = null;
        this._evenOddMap = puzzle.evenOddMap || null;
        this._cages = puzzle.cages || null;

        this.notes = new Notes(this.boardSize, this.blockSize, this.variant);
        if (this.variant === 'killer' && this._cages) this.notes.extraData = { cages: this._cages };
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

        this.boardSize = savedState.boardSize || 9;
        this.blockSize = getBlockSize(this.boardSize);
        this.variant = savedState.variant || 'standard';

        this._board = savedState.board || Board._emptyGrid(this.boardSize);
        this._solution = savedState.solution || Board._emptyGrid(this.boardSize);
        this._given = savedState.given || Board._emptyBoolGrid(this.boardSize);
        this._initialPuzzle = savedState.initialPuzzle || null;
        this._difficulty = savedState.difficulty || 'easy';
        this._score = savedState.score || 0;
        this._mistakes = savedState.mistakes || 0;
        this._hints = typeof savedState.hints === 'number' ? savedState.hints : DEFAULT_HINTS;
        this._dailyDate = savedState.dailyDate || null;
        this._gameOver = savedState.gameOver || false;
        this.mode = savedState.mode || 'classic';
        this._cellColors = savedState.cellColors || null;
        this._evenOddMap = savedState.evenOddMap || null;
        this._cages = savedState.cages || null;

        // Notes
        this.notes = new Notes(this.boardSize, this.blockSize, this.variant);
        if (this.variant === 'killer' && this._cages) this.notes.extraData = { cages: this._cages };
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
            initialPuzzle: this._initialPuzzle ? this._initialPuzzle.map(r => [...r]) : null,
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
            mode: this.mode,
            boardSize: this.boardSize,
            variant: this.variant,
            cellColors: this._cellColors ? this._cellColors.map(r => [...r]) : null,
            evenOddMap: this._evenOddMap ? this._evenOddMap.map(r => [...r]) : null,
            cages: this._cages ? this._cages.map(c => ({
                cells: c.cells.map(cell => ({ ...cell })),
                sum: c.sum,
            })) : null,
        };
    }

    // -----------------------------------------------------------------------
    // Cell accessors
    // -----------------------------------------------------------------------

    /**
     * Get the current value of a cell.
     *
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     * @returns {number} 1-N if filled, 0 if empty.
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
     * @param {number} num - Digit 1-N.
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
            this._board, this._solution, row, col, num,
            this.boardSize, this.blockSize
        );

        // Get conflicts for visual feedback
        const extraData = this.variant === 'killer' && this._cages ? { cages: this._cages } : null;
        const conflicts = checkConflicts(
            this._board, row, col, num,
            this.boardSize, this.blockSize, this.variant, extraData
        );

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
     * Calculate the current game progress as a percentage (0-100).
     * Based on how many non-given cells have been filled.
     *
     * @returns {number}
     */
    getProgress() {
        let filled = 0;
        let total = 0;
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                if (!this._given[r][c]) {
                    total++;
                    if (this._board[r][c] > 0) filled++;
                }
            }
        }
        return total === 0 ? 100 : Math.round((filled / total) * 100);
    }

    /**
     * Whether the game is fully completed (all cells correct).
     *
     * @returns {boolean}
     */
    isComplete() {
        return isBoardComplete(this._board, this._solution, this.boardSize);
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
     * Raw board array. Returns the internal reference for read-only use.
     *
     * @returns {number[][]}
     */
    getBoard() {
        return this._board;
    }

    /**
     * Full solution array.
     *
     * @returns {number[][]}
     */
    getSolution() {
        return this._solution;
    }

    /**
     * Given-flag array.
     *
     * @returns {boolean[][]}
     */
    getGiven() {
        return this._given;
    }

    /**
     * Even/Odd constraint map (0=none, 1=odd, 2=even).
     *
     * @returns {number[][]|null}
     */
    getEvenOddMap() {
        return this._evenOddMap;
    }

    /**
     * Killer cages array.
     *
     * @returns {Array<{cells: {row: number, col: number}[], sum: number}>|null}
     */
    getCages() {
        return this._cages;
    }

    /**
     * Count how many times a specific digit appears on the current board.
     * Used by the number-pad to fade out completed digits.
     *
     * @param {number} num - Digit.
     * @returns {number}
     */
    getNumberCount(num) {
        let count = 0;
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
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

    /**
     * Get the initial puzzle snapshot (before any player input).
     *
     * @returns {number[][]|null}
     */
    getInitialPuzzle() {
        return this._initialPuzzle;
    }

    /**
     * Start a new game from a pre-existing puzzle (used for replay mode).
     *
     * @param {number[][]} puzzle - The initial puzzle board.
     * @param {number[][]} solution - The complete solution.
     * @param {boolean[][]} given - Given cell flags.
     * @param {string} difficulty - Difficulty key.
     * @param {string} [mode='classic'] - Game mode.
     * @param {object} [options={}] - Additional options (boardSize, duration, etc.).
     */
    newGameFromPuzzle(puzzle, solution, given, difficulty, mode = 'classic', options = {}) {
        if (options.boardSize) {
            this.boardSize = options.boardSize;
            this.blockSize = getBlockSize(this.boardSize);
        }

        this.variant = options.variant || 'standard';

        this._board = puzzle.map(r => [...r]);
        this._solution = solution.map(r => [...r]);
        this._given = given.map(r => [...r]);
        this._initialPuzzle = puzzle.map(r => [...r]);
        this._difficulty = difficulty;
        this._score = 0;
        this._mistakes = 0;
        this._hints = DEFAULT_HINTS;
        this._dailyDate = options.dailyDate || null;
        this._gameOver = false;
        this.mode = mode;
        this._cellColors = null;
        this._evenOddMap = options.evenOddMap || null;
        this._cages = options.cages || null;

        this.notes = new Notes(this.boardSize, this.blockSize, this.variant);
        if (this.variant === 'killer' && this._cages) this.notes.extraData = { cages: this._cages };
        this.history = new History();
        this.timer.reset();
        this.timer.start();
    }

    // -----------------------------------------------------------------------
    // Async game generation (Web Worker for large boards)
    // -----------------------------------------------------------------------

    /**
     * Generate a puzzle asynchronously using a Web Worker.
     * Used for large board sizes (12x12, 16x16) to prevent UI blocking.
     *
     * @param {string} difficulty - One of 'easy', 'normal', 'hard', 'expert', 'master'.
     * @param {string} [dailyDate] - Optional ISO date string for daily challenge.
     * @param {string} [mode='classic'] - Game mode.
     * @param {object} [options={}] - Additional options.
     * @returns {Promise<void>}
     */
    async newGameAsync(difficulty, dailyDate, mode = 'classic', options = {}) {
        if (options.boardSize) {
            this.boardSize = options.boardSize;
            this.blockSize = getBlockSize(this.boardSize);
        }

        this.variant = options.variant || 'standard';

        return new Promise((resolve, reject) => {
            const worker = new Worker('./js/core/puzzle-worker.js');

            worker.onmessage = (e) => {
                worker.terminate();
                if (e.data.success) {
                    const puzzle = e.data.puzzle;
                    this._board = puzzle.board;
                    this._solution = puzzle.solution;
                    this._given = puzzle.given;
                    this._difficulty = puzzle.difficulty;
                    this._score = 0;
                    this._mistakes = 0;
                    this._hints = DEFAULT_HINTS;
                    this._dailyDate = dailyDate || null;
                    this._gameOver = false;
                    this.mode = mode;
                    this._initialPuzzle = this._board.map(r => [...r]);
                    this._cellColors = null;
                    this._evenOddMap = puzzle.evenOddMap || null;
                    this._cages = puzzle.cages || null;
                    this.notes = new Notes(this.boardSize, this.blockSize, this.variant);
                    if (this.variant === 'killer' && this._cages) this.notes.extraData = { cages: this._cages };
                    this.history = new History();
                    this.timer.reset();
                    this.timer.start();
                    resolve();
                } else {
                    reject(new Error(e.data.error));
                }
            };

            worker.onerror = (err) => {
                worker.terminate();
                reject(err);
            };

            worker.postMessage({ difficulty, boardSize: this.boardSize, variant: this.variant });
        });
    }

    // -----------------------------------------------------------------------
    // Cell color marking
    // -----------------------------------------------------------------------

    /**
     * Set a color marking on a cell.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} colorIdx - 0 to clear, 1-6 for a color.
     */
    setCellColor(row, col, colorIdx) {
        if (!this._cellColors) {
            if (colorIdx === 0) return;
            this._cellColors = Array.from({ length: this.boardSize },
                () => Array(this.boardSize).fill(0));
        }
        this._cellColors[row][col] = colorIdx;
    }

    /**
     * Get the color marking of a cell.
     *
     * @param {number} row
     * @param {number} col
     * @returns {number} 0 if no color, 1-6 for a color index.
     */
    getCellColor(row, col) {
        if (!this._cellColors) return 0;
        return this._cellColors[row][col] || 0;
    }

    /**
     * Clear all color markings.
     */
    clearAllColors() {
        this._cellColors = null;
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
     * Create an empty number grid.
     *
     * @param {number} [boardSize=9] - Board dimension
     * @returns {number[][]}
     * @private
     */
    static _emptyGrid(boardSize = 9) {
        return Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    }

    /**
     * Create a grid of `false`.
     *
     * @param {number} [boardSize=9] - Board dimension
     * @returns {boolean[][]}
     * @private
     */
    static _emptyBoolGrid(boardSize = 9) {
        return Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
    }
}

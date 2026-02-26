/**
 * Input Handler
 *
 * Bridges user interactions (cell clicks, number-pad presses, toolbar actions)
 * with the central {@link Board} state and the various UI components. All
 * game-relevant events are dispatched as CustomEvents on `document` so that
 * screen controllers can react without tight coupling.
 *
 * Dispatched events:
 *  - `cell-updated`   – detail: { row, col, value, state, notes }
 *  - `score-changed`  – detail: { score, delta }
 *  - `mistake`        – detail: { current, max }
 *  - `game-complete`  – detail: { score, time }
 *  - `hint-used`      – detail: { row, col, value, hintsLeft }
 *
 * @module game/input
 */

import { getHint } from './hints.js';

// ---------------------------------------------------------------------------
// InputHandler class
// ---------------------------------------------------------------------------

/**
 * @class InputHandler
 */
export class InputHandler {
    /**
     * @param {import('./board.js').Board} board - The authoritative game state.
     */
    constructor(board) {
        /** @type {import('./board.js').Board} */
        this._board = board;

        /** @type {{ row: number, col: number } | null} Currently selected cell. */
        this._selectedCell = null;

        /** @type {boolean} Whether note (pencil-mark) mode is active. */
        this._noteMode = false;
    }

    // -----------------------------------------------------------------------
    // Cell selection
    // -----------------------------------------------------------------------

    /**
     * Handle a cell being selected (tapped / clicked).
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     */
    selectCell(row, col) {
        this._selectedCell = { row, col };
    }

    /**
     * Get the currently selected cell position.
     *
     * @returns {{ row: number, col: number } | null}
     */
    getSelectedCell() {
        return this._selectedCell;
    }

    // -----------------------------------------------------------------------
    // Number input
    // -----------------------------------------------------------------------

    /**
     * Handle a number being input on the currently selected cell.
     * In note mode, toggles the pencil mark; otherwise places a definitive
     * value and validates it.
     *
     * @param {number} num - Digit 1-9.
     */
    inputNumber(num) {
        if (!this._selectedCell) return;

        const { row, col } = this._selectedCell;

        // Cannot modify given cells
        if (this._board.isGiven(row, col)) return;

        // Game already over
        if (this._board.isGameOver()) return;

        if (this._noteMode) {
            this._handleNoteInput(row, col, num);
        } else {
            this._handleValueInput(row, col, num);
        }
    }

    // -----------------------------------------------------------------------
    // Toolbar actions
    // -----------------------------------------------------------------------

    /**
     * Toggle note (pencil-mark) mode on/off.
     *
     * @returns {boolean} The new note-mode state.
     */
    toggleNotes() {
        this._noteMode = !this._noteMode;
        return this._noteMode;
    }

    /**
     * Whether note mode is currently active.
     *
     * @returns {boolean}
     */
    isNoteMode() {
        return this._noteMode;
    }

    /**
     * Erase the value or notes of the currently selected cell.
     */
    erase() {
        if (!this._selectedCell) return;

        const { row, col } = this._selectedCell;

        if (this._board.isGiven(row, col)) return;
        if (this._board.isGameOver()) return;

        const erased = this._board.erase(row, col);

        // Dispatch update
        this._dispatch('cell-updated', {
            row,
            col,
            value: 0,
            state: '',
            notes: [...this._board.notes.get(row, col)],
        });
    }

    /**
     * Undo the last action.
     */
    undo() {
        const action = this._board.history.pop();
        if (!action) return;

        const { row, col, prevValue, prevNotes, type } = action;

        // Restore the cell value
        // We directly set the internal board to avoid re-validation.
        // This is intentional: undo should restore state, not re-score.
        this._board.getBoard()[row][col] = prevValue;

        // Restore notes if present
        if (prevNotes && prevNotes.length > 0) {
            this._board.notes.clear(row, col);
            for (const n of prevNotes) {
                if (!this._board.notes.hasNote(row, col, n)) {
                    this._board.notes.toggle(row, col, n);
                }
            }
        } else {
            this._board.notes.clear(row, col);
        }

        // Determine visual state
        let state = '';
        if (prevValue !== 0) {
            state = 'user-input';
        }

        this._dispatch('cell-updated', {
            row,
            col,
            value: prevValue,
            state,
            notes: [...this._board.notes.get(row, col)],
        });
    }

    /**
     * Apply a hint: find the best available hint and auto-fill the cell.
     */
    useHint() {
        if (this._board.isGameOver()) return;

        // Check if hints remain
        if (!this._board.useHint()) return;

        const hint = getHint(
            this._board.getBoard(),
            this._board.getSolution(),
            this._board.notes
        );

        if (!hint) return;

        const { row, col, value } = hint;

        // Record the hint as an input action for undo
        const prevValue = this._board.getBoard()[row][col];
        const prevNotes = [...this._board.notes.get(row, col)];

        this._board.history.push({
            type: 'input',
            row,
            col,
            prevValue,
            newValue: value,
            prevNotes,
            newNotes: [],
        });

        // Place the value directly (hints are always correct)
        this._board.getBoard()[row][col] = value;
        this._board.notes.clear(row, col);
        this._board.notes.removeFromRelated(row, col, value);

        // Select the hinted cell
        this._selectedCell = { row, col };

        // Check completion
        const complete = this._board.isComplete();
        if (complete) {
            this._board._gameOver = true;
            this._board.timer.pause();
        }

        this._dispatch('cell-updated', {
            row,
            col,
            value,
            state: 'user-input',
            notes: [],
        });

        this._dispatch('hint-used', {
            row,
            col,
            value,
            message: hint.message,
            hintsLeft: this._board.getHintCount(),
        });

        if (complete) {
            this._dispatch('game-complete', {
                score: this._board.getScore(),
                time: this._board.timer.getElapsed(),
            });
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Handle note-mode input: toggle pencil mark on the selected cell.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} num
     * @private
     */
    _handleNoteInput(row, col, num) {
        // Only allow notes on empty cells
        if (!this._board.isEmpty(row, col)) return;

        const prevNotes = [...this._board.notes.get(row, col)];
        const { added } = this._board.notes.toggle(row, col, num);
        const newNotes = [...this._board.notes.get(row, col)];

        // Record for undo
        this._board.history.push({
            type: 'note',
            row,
            col,
            prevValue: 0,
            newValue: 0,
            prevNotes,
            newNotes,
        });

        this._dispatch('cell-updated', {
            row,
            col,
            value: 0,
            state: '',
            notes: newNotes,
        });
    }

    /**
     * Handle definitive value input: place the number and validate.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} num
     * @private
     */
    _handleValueInput(row, col, num) {
        const result = this._board.setCellValue(row, col, num);

        const state = result.valid ? 'user-input' : 'error';

        this._dispatch('cell-updated', {
            row,
            col,
            value: num,
            state,
            notes: [],
            conflicts: result.conflicts,
        });

        if (result.score > 0) {
            this._dispatch('score-changed', {
                score: this._board.getScore(),
                delta: result.score,
            });
        }

        if (!result.valid) {
            const { current, max } = this._board.getMistakes();
            this._dispatch('mistake', { current, max });
        }

        if (result.complete) {
            this._dispatch('game-complete', {
                score: this._board.getScore(),
                time: this._board.timer.getElapsed(),
            });
        }
    }

    /**
     * Dispatch a named CustomEvent on `document`.
     *
     * @param {string} eventName
     * @param {object} detail
     * @private
     */
    _dispatch(eventName, detail) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
}

/**
 * Notes (Pencil-Mark) Manager
 *
 * Manages a 9x9 grid of note Sets. Each cell can hold any subset of the
 * digits 1-9 as candidate pencil marks. The manager also supports the
 * "auto-clear related notes" behaviour: when a definitive number is placed
 * in a cell, that digit is removed from the notes of every cell in the same
 * row, column, and 3x3 block.
 *
 * @module game/notes
 */

/**
 * @class Notes
 */
export class Notes {
    /**
     * Initialise a blank 9x9 notes grid.
     */
    constructor() {
        /** @type {Set<number>[][]} 9x9 array of Sets. */
        this._grid = Notes._createEmptyGrid();
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Toggle a pencil-mark number in a cell. If the number is already
     * present it is removed; otherwise it is added.
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     * @param {number} num - Digit to toggle (1-9).
     * @returns {{ added: boolean, num: number }} Whether the number was added
     *   (true) or removed (false), and the digit concerned.
     */
    toggle(row, col, num) {
        const cell = this._grid[row][col];
        if (cell.has(num)) {
            cell.delete(num);
            return { added: false, num };
        }
        cell.add(num);
        return { added: true, num };
    }

    /**
     * Retrieve the current set of notes for a cell.
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     * @returns {Set<number>} Set of note digits.
     */
    get(row, col) {
        return this._grid[row][col];
    }

    /**
     * Remove all notes from a cell.
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     */
    clear(row, col) {
        this._grid[row][col].clear();
    }

    /**
     * When a definitive number is placed at (row, col), remove that number
     * from the notes of every related cell (same row, same column, and same
     * 3x3 block).
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     * @param {number} num - The placed digit (1-9).
     */
    removeFromRelated(row, col, num) {
        // Same row
        for (let c = 0; c < 9; c++) {
            this._grid[row][c].delete(num);
        }

        // Same column
        for (let r = 0; r < 9; r++) {
            this._grid[r][col].delete(num);
        }

        // Same 3x3 block
        const blockRow = Math.floor(row / 3) * 3;
        const blockCol = Math.floor(col / 3) * 3;
        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                this._grid[r][c].delete(num);
            }
        }
    }

    /**
     * Check whether a specific note exists in a cell.
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     * @param {number} num - Digit (1-9).
     * @returns {boolean}
     */
    hasNote(row, col, num) {
        return this._grid[row][col].has(num);
    }

    /**
     * Check whether a cell has no notes at all.
     *
     * @param {number} row - Row index (0-8).
     * @param {number} col - Column index (0-8).
     * @returns {boolean}
     */
    isEmpty(row, col) {
        return this._grid[row][col].size === 0;
    }

    /**
     * Serialise the entire notes grid to a plain JSON-safe structure
     * (2D array of sorted number arrays).
     *
     * @returns {number[][][]} 9x9 array of sorted digit arrays.
     */
    toJSON() {
        return this._grid.map(row =>
            row.map(cell => [...cell].sort((a, b) => a - b))
        );
    }

    /**
     * Restore the notes grid from data previously produced by `toJSON()`.
     *
     * @param {number[][][]} data - 9x9 array of digit arrays.
     */
    fromJSON(data) {
        if (!Array.isArray(data) || data.length !== 9) {
            this._grid = Notes._createEmptyGrid();
            return;
        }

        this._grid = data.map(row => {
            if (!Array.isArray(row) || row.length !== 9) {
                return Array.from({ length: 9 }, () => new Set());
            }
            return row.map(cell => {
                if (!Array.isArray(cell)) return new Set();
                return new Set(cell.filter(n => n >= 1 && n <= 9));
            });
        });
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Create a fresh 9x9 grid of empty Sets.
     *
     * @returns {Set<number>[][]}
     * @private
     */
    static _createEmptyGrid() {
        return Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set())
        );
    }
}

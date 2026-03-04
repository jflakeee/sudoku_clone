/**
 * Notes (Pencil-Mark) Manager
 *
 * Manages a grid of note Sets. Each cell can hold any subset of the
 * valid digits as candidate pencil marks. The manager also supports the
 * "auto-clear related notes" behaviour: when a definitive number is placed
 * in a cell, that digit is removed from the notes of every cell in the same
 * row, column, and block.
 *
 * Supports multiple board sizes (4x4, 6x6, 9x9, 12x12, 16x16).
 *
 * @module game/notes
 */

import { getBlockSize } from '../core/board-config.js';
import { getExtraCells } from '../core/variant-rules.js';

/**
 * @class Notes
 */
export class Notes {
    /**
     * Initialise a blank notes grid.
     *
     * @param {number} [boardSize=9] - Board dimension
     * @param {{rows: number, cols: number}} [blockSize=null] - Block dimensions
     */
    constructor(boardSize = 9, blockSize = null, variant = 'standard') {
        /** @type {number} */
        this.boardSize = boardSize;

        /** @type {{rows: number, cols: number}} */
        this.blockSize = blockSize || getBlockSize(boardSize);

        /** @type {string} */
        this.variant = variant;

        /** @type {object|null} Extra variant data (e.g. cages for killer) */
        this.extraData = null;

        /** @type {Set<number>[][]} Array of Sets. */
        this._grid = Notes._createEmptyGrid(this.boardSize);
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Toggle a pencil-mark number in a cell. If the number is already
     * present it is removed; otherwise it is added.
     *
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     * @param {number} num - Digit to toggle.
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
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     * @returns {Set<number>} Set of note digits.
     */
    get(row, col) {
        return this._grid[row][col];
    }

    /**
     * Remove all notes from a cell.
     *
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     */
    clear(row, col) {
        this._grid[row][col].clear();
    }

    /**
     * When a definitive number is placed at (row, col), remove that number
     * from the notes of every related cell (same row, same column, and same
     * block).
     *
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     * @param {number} num - The placed digit.
     */
    removeFromRelated(row, col, num) {
        // Same row
        for (let c = 0; c < this.boardSize; c++) {
            this._grid[row][c].delete(num);
        }

        // Same column
        for (let r = 0; r < this.boardSize; r++) {
            this._grid[r][col].delete(num);
        }

        // Same block
        const blockRow = Math.floor(row / this.blockSize.rows) * this.blockSize.rows;
        const blockCol = Math.floor(col / this.blockSize.cols) * this.blockSize.cols;
        for (let r = blockRow; r < blockRow + this.blockSize.rows; r++) {
            for (let c = blockCol; c < blockCol + this.blockSize.cols; c++) {
                this._grid[r][c].delete(num);
            }
        }

        // Variant-specific extra cells
        const extraCells = getExtraCells(this.variant, row, col, this.boardSize, this.extraData);
        for (const cell of extraCells) {
            this._grid[cell.row][cell.col].delete(num);
        }
    }

    /**
     * Check whether a specific note exists in a cell.
     *
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     * @param {number} num - Digit.
     * @returns {boolean}
     */
    hasNote(row, col, num) {
        return this._grid[row][col].has(num);
    }

    /**
     * Check whether a cell has no notes at all.
     *
     * @param {number} row - Row index.
     * @param {number} col - Column index.
     * @returns {boolean}
     */
    isEmpty(row, col) {
        return this._grid[row][col].size === 0;
    }

    /**
     * Serialise the entire notes grid to a plain JSON-safe structure
     * (2D array of sorted number arrays).
     *
     * @returns {number[][][]} Array of sorted digit arrays.
     */
    toJSON() {
        return this._grid.map(row =>
            row.map(cell => [...cell].sort((a, b) => a - b))
        );
    }

    /**
     * Restore the notes grid from data previously produced by `toJSON()`.
     *
     * @param {number[][][]} data - Array of digit arrays.
     */
    fromJSON(data) {
        if (!Array.isArray(data) || data.length !== this.boardSize) {
            this._grid = Notes._createEmptyGrid(this.boardSize);
            return;
        }

        this._grid = data.map(row => {
            if (!Array.isArray(row) || row.length !== this.boardSize) {
                return Array.from({ length: this.boardSize }, () => new Set());
            }
            return row.map(cell => {
                if (!Array.isArray(cell)) return new Set();
                return new Set(cell.filter(n => n >= 1 && n <= this.boardSize));
            });
        });
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Create a fresh grid of empty Sets.
     *
     * @param {number} [boardSize=9] - Board dimension
     * @returns {Set<number>[][]}
     * @private
     */
    static _createEmptyGrid(boardSize = 9) {
        return Array.from({ length: boardSize }, () =>
            Array.from({ length: boardSize }, () => new Set())
        );
    }
}

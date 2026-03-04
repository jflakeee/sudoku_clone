/**
 * Grid UI – DOM Renderer
 *
 * Creates and manages the cell elements inside the Sudoku grid container.
 * Supports dynamic board sizes (4, 6, 9, 12, 16).
 * All cell interactions use a single event-delegated listener on the grid for
 * optimal performance.
 *
 * @module ui/grid
 */

import { getBlockSize } from '../core/board-config.js';
import { getCSSClass } from '../core/variant-rules.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Cell marking color palette (index -> CSS background color).
 * Index 0 means no marking; indices 1-6 map to distinct translucent colors
 * used for manual cell highlighting by the player.
 * @type {(string|null)[]}
 */
const MARKING_COLORS = [
    null,                       // 0: none
    'rgba(255, 235, 59, 0.35)', // 1: yellow
    'rgba(76, 175, 80, 0.35)',  // 2: green
    'rgba(33, 150, 243, 0.35)', // 3: blue
    'rgba(255, 152, 0, 0.35)',  // 4: orange
    'rgba(156, 39, 176, 0.35)', // 5: purple
    'rgba(244, 67, 54, 0.35)',  // 6: red
];

// ---------------------------------------------------------------------------
// GridUI class
// ---------------------------------------------------------------------------

/**
 * @class GridUI
 */
export class GridUI {
    /**
     * @param {HTMLElement} containerEl - The `.sudoku-grid` container element.
     * @param {number} [gridSize=9] - Board dimension (4, 6, 9, 12, 16).
     */
    constructor(containerEl, gridSize = 9, variant = 'standard') {
        /** @type {HTMLElement} */
        this._container = containerEl;

        /** @type {number} */
        this._gridSize = gridSize;

        /** @type {{ rows: number, cols: number }} */
        this._blockSize = getBlockSize(gridSize);

        /** @type {string} */
        this._variant = variant;

        /**
         * Flat lookup: cells[row * gridSize + col] → cell element.
         * @type {HTMLElement[]}
         */
        this._cells = [];

        this._buildGrid();
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    /**
     * Render (or re-render) the entire board.
     *
     * @param {number[][]} board - 9x9 board values (0 = empty).
     * @param {boolean[][]} given - 9x9 given flags.
     */
    renderBoard(board, given) {
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const value = board[r][c];
                const state = given[r][c] ? 'given' : (value !== 0 ? 'user-input' : '');
                this.updateCell(r, c, value, state);
                // Clear any leftover notes when rendering full board
                this._clearNotes(r, c);
            }
        }
    }

    /**
     * Update a single cell's displayed value and visual state.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} value - 0 to clear, 1-9 to show a digit.
     * @param {string} state - CSS modifier: 'given', 'user-input', 'error', or '' to reset.
     */
    updateCell(row, col, value, state) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const valueEl = cell.querySelector('.cell-value');
        const notesEl = cell.querySelector('.cell-notes');

        // Set displayed value
        if (value !== 0) {
            valueEl.textContent = String(value);
            valueEl.style.display = '';
            notesEl.style.display = 'none';
        } else {
            valueEl.textContent = '';
            valueEl.style.display = 'none';
            // Notes visibility is controlled by showNotes
        }

        // State classes
        cell.classList.remove('given', 'user-input', 'error');
        if (state) {
            cell.classList.add(state);
        }

        // ARIA: update label to reflect current cell state
        const r = parseInt(cell.getAttribute('data-row'), 10);
        const c = parseInt(cell.getAttribute('data-col'), 10);
        if (value !== 0) {
            const stateLabel = state === 'given' ? '주어진 값' : '입력값';
            cell.setAttribute('aria-label', `행 ${r + 1}, 열 ${c + 1}, ${stateLabel} ${value}`);
        } else {
            cell.setAttribute('aria-label', `행 ${r + 1}, 열 ${c + 1}, 빈 셀`);
        }
    }

    /**
     * Play an input-bounce animation on the cell value element.
     *
     * @param {number} row
     * @param {number} col
     */
    animateValueBounce(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const valueEl = cell.querySelector('.cell-value');
        if (!valueEl) return;

        valueEl.classList.remove('animate-in');
        void valueEl.offsetWidth;
        valueEl.classList.add('animate-in');

        valueEl.addEventListener('animationend', () => {
            valueEl.classList.remove('animate-in');
        }, { once: true });
    }

    /**
     * Display notes (pencil marks) inside a cell as a 3x3 mini-grid.
     *
     * @param {number} row
     * @param {number} col
     * @param {Set<number>|number[]} notes - The set/array of note digits (1-9).
     */
    showNotes(row, col, notes, animate = false) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const valueEl = cell.querySelector('.cell-value');
        const notesEl = cell.querySelector('.cell-notes');

        const noteSet = notes instanceof Set ? notes : new Set(notes);

        // Hide the main value, show the notes container
        valueEl.style.display = 'none';
        notesEl.style.display = '';

        for (let n = 1; n <= this._gridSize; n++) {
            const noteSpan = notesEl.querySelector(`.note-${n}`);
            if (noteSpan) {
                const had = noteSpan.textContent !== '';
                const has = noteSet.has(n);
                noteSpan.textContent = has ? String(n) : '';

                // Animate newly appearing notes
                if (animate && has && !had) {
                    noteSpan.classList.remove('animate-note');
                    void noteSpan.offsetWidth;
                    noteSpan.classList.add('animate-note');
                    noteSpan.addEventListener('animationend', () => {
                        noteSpan.classList.remove('animate-note');
                    }, { once: true });
                }
            }
        }
    }

    /**
     * Clear all content from a cell (value and notes).
     *
     * @param {number} row
     * @param {number} col
     */
    clearCell(row, col) {
        this.updateCell(row, col, 0, '');
        this._clearNotes(row, col);
    }

    /**
     * Get the DOM element for a specific cell.
     *
     * @param {number} row
     * @param {number} col
     * @returns {HTMLElement|null}
     */
    getCell(row, col) {
        return this._cells[row * this._gridSize + col] || null;
    }

    // -----------------------------------------------------------------------
    // Animations
    // -----------------------------------------------------------------------

    /**
     * Play a quick "pop" (scale-up-then-back) animation on a cell.
     *
     * @param {number} row
     * @param {number} col
     */
    animatePop(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        cell.classList.remove('pop');
        // Force reflow so the animation restarts even if the class was just removed
        void cell.offsetWidth;
        cell.classList.add('pop');

        cell.addEventListener('animationend', () => {
            cell.classList.remove('pop');
        }, { once: true });
    }

    /**
     * Play a sequential "wave" animation across all cells (used on game
     * completion). Each cell gets a staggered delay.
     *
     * @param {Function} [callback] - Called after the wave finishes.
     */
    animateWave(callback) {
        const totalCells = this._gridSize * this._gridSize;
        const delayPerCell = 30; // ms
        let finished = 0;

        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = this.getCell(r, c);
                if (!cell) {
                    finished++;
                    continue;
                }

                const delay = (r + c) * delayPerCell;

                setTimeout(() => {
                    cell.classList.add('wave');

                    cell.addEventListener('animationend', () => {
                        cell.classList.remove('wave');
                        finished++;
                        if (finished >= totalCells && callback) {
                            callback();
                        }
                    }, { once: true });
                }, delay);
            }
        }
    }

    /**
     * Play a shake animation on a cell (used for wrong input).
     *
     * @param {number} row
     * @param {number} col
     */
    animateError(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        cell.classList.remove('shake');
        void cell.offsetWidth;
        cell.classList.add('shake');

        cell.addEventListener('animationend', () => {
            cell.classList.remove('shake');
        }, { once: true });
    }

    /**
     * Show a floating "+250" score text above a cell that floats upward
     * and fades out.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} score - The score value to display.
     */
    showScoreFloat(row, col, score) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const float = document.createElement('span');
        float.className = 'score-float';
        float.textContent = `+${score}`;

        cell.appendChild(float);

        float.addEventListener('animationend', () => {
            float.remove();
        }, { once: true });

        // Fallback removal in case animationend doesn't fire
        setTimeout(() => {
            if (float.parentNode) float.remove();
        }, 1500);
    }

    // -----------------------------------------------------------------------
    // Cell color marking
    // -----------------------------------------------------------------------

    /** @see MARKING_COLORS module-level constant */
    static MARKING_COLORS = MARKING_COLORS;

    /**
     * Set the marking color on a cell's DOM element.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} colorIdx - 0 to clear, 1-6 for a color.
     */
    setCellColor(row, col, colorIdx) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        // Remove any existing marking-color-* class
        for (let i = 1; i <= 6; i++) {
            cell.classList.remove(`marking-color-${i}`);
        }

        if (colorIdx > 0 && colorIdx <= 6) {
            cell.classList.add(`marking-color-${colorIdx}`);
        }
    }

    /**
     * Render all cell color markings from a Board instance.
     *
     * @param {import('../game/board.js').Board} board
     */
    renderAllColors(board) {
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                this.setCellColor(r, c, board.getCellColor(r, c));
            }
        }
    }

    // -----------------------------------------------------------------------
    // Event delegation
    // -----------------------------------------------------------------------

    /**
     * Register a callback for cell click events using event delegation.
     * The callback receives (row, col) of the clicked cell.
     *
     * @param {(row: number, col: number) => void} callback
     */
    onCellClick(callback) {
        this._container.addEventListener('click', (e) => {
            const cellEl = /** @type {HTMLElement} */ (e.target).closest('.cell');
            if (!cellEl) return;

            const row = parseInt(cellEl.getAttribute('data-row'), 10);
            const col = parseInt(cellEl.getAttribute('data-col'), 10);

            if (!isNaN(row) && !isNaN(col)) {
                callback(row, col);
            }
        });
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Build the 81 cell DOM elements inside the grid container.
     * @private
     */
    _buildGrid() {
        this._container.innerHTML = '';
        this._cells = [];

        // Set dynamic grid template
        this._container.style.gridTemplateColumns = `repeat(${this._gridSize}, 1fr)`;
        this._container.style.gridTemplateRows = `repeat(${this._gridSize}, 1fr)`;

        // ARIA: mark the grid as a grid landmark
        this._container.setAttribute('role', 'grid');
        this._container.setAttribute('aria-label', `${this._gridSize}x${this._gridSize} 스도쿠 그리드`);

        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.setAttribute('data-row', String(r));
                cell.setAttribute('data-col', String(c));

                // ARIA: gridcell role with descriptive label
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('tabindex', '-1');
                cell.setAttribute('aria-label', `행 ${r + 1}, 열 ${c + 1}, 빈 셀`);

                // Add block-boundary classes for thicker CSS borders
                if (c % this._blockSize.cols === 0 && c !== 0) cell.classList.add('block-left');
                if (r % this._blockSize.rows === 0 && r !== 0) cell.classList.add('block-top');

                // Last row/col classes for border removal
                if (c === this._gridSize - 1) cell.classList.add('last-col');
                if (r === this._gridSize - 1) cell.classList.add('last-row');

                // Variant-specific CSS class
                const variantClass = getCSSClass(this._variant, r, c, this._gridSize);
                if (variantClass) cell.classList.add(variantClass);

                // Value element
                const valueSpan = document.createElement('span');
                valueSpan.className = 'cell-value';
                cell.appendChild(valueSpan);

                // Notes container (dynamic mini-grid)
                const notesDiv = document.createElement('div');
                notesDiv.className = 'cell-notes';
                notesDiv.style.display = 'none';
                notesDiv.style.gridTemplateColumns = `repeat(${this._blockSize.cols}, 1fr)`;
                notesDiv.style.gridTemplateRows = `repeat(${this._blockSize.rows}, 1fr)`;

                for (let n = 1; n <= this._gridSize; n++) {
                    const noteSpan = document.createElement('span');
                    noteSpan.className = `note note-${n}`;
                    notesDiv.appendChild(noteSpan);
                }

                cell.appendChild(notesDiv);
                this._container.appendChild(cell);
                this._cells.push(cell);
            }
        }
    }

    /**
     * Clear all note indicators in a cell.
     *
     * @param {number} row
     * @param {number} col
     * @private
     */
    _clearNotes(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const notesEl = cell.querySelector('.cell-notes');
        if (notesEl) {
            notesEl.style.display = 'none';
            for (let n = 1; n <= this._gridSize; n++) {
                const noteSpan = notesEl.querySelector(`.note-${n}`);
                if (noteSpan) noteSpan.textContent = '';
            }
        }
    }

    /**
     * Render killer cages on the grid with dashed borders and sum labels.
     *
     * @param {Array<{cells: {row: number, col: number}[], sum: number}>} cages
     */
    renderCages(cages) {
        if (!cages || cages.length === 0) return;

        this.clearCages();

        for (const cage of cages) {
            const cellSet = new Set(cage.cells.map(c => c.row * this._gridSize + c.col));

            for (const { row, col } of cage.cells) {
                const cell = this.getCell(row, col);
                if (!cell) continue;

                cell.classList.add('cage-cell');

                if (!cellSet.has((row - 1) * this._gridSize + col)) {
                    cell.classList.add('cage-border-top');
                }
                if (!cellSet.has((row + 1) * this._gridSize + col)) {
                    cell.classList.add('cage-border-bottom');
                }
                if (!cellSet.has(row * this._gridSize + (col - 1))) {
                    cell.classList.add('cage-border-left');
                }
                if (!cellSet.has(row * this._gridSize + (col + 1))) {
                    cell.classList.add('cage-border-right');
                }
            }

            const sorted = [...cage.cells].sort((a, b) => a.row - b.row || a.col - b.col);
            const firstCell = this.getCell(sorted[0].row, sorted[0].col);
            if (firstCell) {
                const sumEl = document.createElement('span');
                sumEl.className = 'cage-sum';
                sumEl.textContent = String(cage.sum);
                firstCell.appendChild(sumEl);
            }
        }
    }

    /**
     * Clear all cage-related classes and elements.
     */
    clearCages() {
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = this.getCell(r, c);
                if (!cell) continue;
                cell.classList.remove('cage-cell', 'cage-border-top', 'cage-border-bottom', 'cage-border-left', 'cage-border-right');
                const sumEl = cell.querySelector('.cage-sum');
                if (sumEl) sumEl.remove();
            }
        }
    }

    /**
     * Apply even/odd CSS classes based on an evenOddMap.
     *
     * @param {number[][]|null} evenOddMap - 0=none, 1=odd, 2=even
     */
    applyEvenOddMap(evenOddMap) {
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const cell = this.getCell(r, c);
                if (!cell) continue;
                cell.classList.remove('cell-even', 'cell-odd');
                if (evenOddMap && evenOddMap[r] && evenOddMap[r][c] === 2) {
                    cell.classList.add('cell-even');
                } else if (evenOddMap && evenOddMap[r] && evenOddMap[r][c] === 1) {
                    cell.classList.add('cell-odd');
                }
            }
        }
    }

    /**
     * Rebuild the grid for a new board size.
     *
     * @param {number} gridSize - New board dimension (4, 6, 9, 12, 16).
     */
    rebuild(gridSize, variant) {
        this._gridSize = gridSize;
        this._blockSize = getBlockSize(gridSize);
        if (variant !== undefined) this._variant = variant;
        this._container.innerHTML = '';
        this._cells = [];
        this._buildGrid();
    }
}

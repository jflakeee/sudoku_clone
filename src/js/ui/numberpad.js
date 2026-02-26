/**
 * Number Pad UI Controller
 *
 * Manages the 1-9 number buttons at the bottom of the game screen.
 * Handles:
 *  - Click events (delegated to a single callback)
 *  - Completed-number feedback: adds a `completed` class when a digit has
 *    been placed 9 times on the board
 *  - Active-number highlighting
 *
 * Button selector: `.num-btn[data-number]`
 *
 * @module ui/numberpad
 */

// ---------------------------------------------------------------------------
// NumberpadUI class
// ---------------------------------------------------------------------------

/**
 * @class NumberpadUI
 */
export class NumberpadUI {
    /**
     * @param {HTMLElement} containerEl - The `#numberpad` container element.
     */
    constructor(containerEl) {
        /** @type {HTMLElement} */
        this._container = containerEl;

        /** @type {HTMLElement[]} Buttons indexed 0-8 for digits 1-9. */
        this._buttons = [];

        // Cache button references
        for (let n = 1; n <= 9; n++) {
            const btn = this._container.querySelector(`.num-btn[data-number="${n}"]`);
            this._buttons.push(btn);
        }
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Update the visual state of each number button based on how many times
     * each digit appears on the board. When a digit reaches a count of 9,
     * the `completed` class is added to fade/hide the button.
     *
     * @param {import('../game/board.js').Board} board - Current game board.
     */
    updateCounts(board) {
        for (let n = 1; n <= 9; n++) {
            const btn = this._buttons[n - 1];
            if (!btn) continue;

            const count = board.getNumberCount(n);

            if (count >= 9) {
                btn.classList.add('completed');
            } else {
                btn.classList.remove('completed');
            }
        }
    }

    /**
     * Register a callback for when a number button is clicked.
     * Uses event delegation on the container.
     *
     * @param {(num: number) => void} callback - Receives the digit 1-9.
     */
    onNumberClick(callback) {
        this._container.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement} */ (e.target).closest('.num-btn[data-number]');
            if (!btn) return;

            // Ignore completed buttons
            if (btn.classList.contains('completed')) return;

            const num = parseInt(btn.getAttribute('data-number'), 10);
            if (num >= 1 && num <= 9) {
                callback(num);
            }
        });
    }

    /**
     * Visually highlight a specific number button (e.g. when a cell with
     * that digit is selected).
     *
     * @param {number} num - Digit 1-9 to highlight, or 0 to clear.
     */
    highlightNumber(num) {
        this.clearHighlight();

        if (num >= 1 && num <= 9) {
            const btn = this._buttons[num - 1];
            if (btn) {
                btn.classList.add('active');
            }
        }
    }

    /**
     * Remove the active highlight from all number buttons.
     */
    clearHighlight() {
        for (const btn of this._buttons) {
            if (btn) {
                btn.classList.remove('active');
            }
        }
    }
}

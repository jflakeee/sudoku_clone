/**
 * Game Timer
 *
 * Tracks elapsed play time with start/pause/reset support. The timer
 * accounts for real wall-clock drift so that even if `setInterval` fires
 * late the displayed time stays accurate.
 *
 * @module game/timer
 */

/**
 * @class Timer
 */
export class Timer {
    /**
     * Create a new Timer instance starting at 0 seconds.
     */
    constructor() {
        /** @type {number} Total elapsed time in milliseconds accumulated before the current run. */
        this._elapsed = 0;

        /** @type {number | null} `performance.now()` timestamp when the timer was last started. */
        this._startTimestamp = null;

        /** @type {number | null} setInterval ID. */
        this._intervalId = null;

        /** @type {boolean} Whether the timer is currently running. */
        this._running = false;

        /** @type {((formatted: string) => void) | null} Tick callback. */
        this._onTick = null;
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Start or resume the timer.
     * Has no effect if the timer is already running.
     */
    start() {
        if (this._running) return;

        this._running = true;
        this._startTimestamp = performance.now();

        this._intervalId = setInterval(() => {
            if (this._onTick) {
                this._onTick(this.getFormatted());
            }
        }, 1000);
    }

    /**
     * Pause the timer, freezing the elapsed value.
     * Has no effect if the timer is not running.
     */
    pause() {
        if (!this._running) return;

        this._running = false;
        this._elapsed += performance.now() - this._startTimestamp;
        this._startTimestamp = null;

        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /**
     * Reset elapsed time back to zero and stop the timer.
     */
    reset() {
        this.pause();
        this._elapsed = 0;
    }

    /**
     * Get the total elapsed time in whole seconds.
     *
     * @returns {number} Elapsed seconds (floored).
     */
    getElapsed() {
        let total = this._elapsed;
        if (this._running && this._startTimestamp !== null) {
            total += performance.now() - this._startTimestamp;
        }
        return Math.floor(total / 1000);
    }

    /**
     * Get a human-friendly "MM:SS" representation of the elapsed time.
     *
     * @returns {string} Formatted time string, e.g. "09:21".
     */
    getFormatted() {
        const totalSeconds = this.getElapsed();
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Restore elapsed time from a saved game state.
     *
     * @param {number} seconds - Previously accumulated seconds.
     */
    setElapsed(seconds) {
        this._elapsed = seconds * 1000;

        // If the timer is currently running, restart the reference point
        // so that the new base is applied immediately.
        if (this._running) {
            this._startTimestamp = performance.now();
        }
    }

    /**
     * Register a callback that is invoked roughly every second while the
     * timer is running. The callback receives the current formatted time
     * string ("MM:SS").
     *
     * Only one callback is supported at a time; calling `onTick` again
     * replaces any previously registered callback.
     *
     * @param {(formatted: string) => void} callback
     */
    onTick(callback) {
        this._onTick = callback;
    }
}

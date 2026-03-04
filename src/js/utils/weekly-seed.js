/**
 * Weekly Challenge Seed Utilities
 *
 * Provides deterministic, week-based challenge generation.
 * Each week features a rotating difficulty and variant combination.
 *
 * @module utils/weekly-seed
 */

// ---------------------------------------------------------------------------
// Epoch: Monday of week 0
// ---------------------------------------------------------------------------

const EPOCH = new Date('2026-01-05T00:00:00');

// ---------------------------------------------------------------------------
// Rotation tables
// ---------------------------------------------------------------------------

const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'hard'];
const VARIANTS = ['standard', 'diagonal', 'standard', 'standard', 'standard'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the week number for a given date (weeks since epoch).
 *
 * @param {Date} [date] - Date to query (default: today).
 * @returns {number}
 */
export function getWeekNumber(date) {
    const d = date instanceof Date ? date : new Date();
    const diff = d.getTime() - EPOCH.getTime();
    return Math.max(0, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * Get a deterministic seed string for the current week.
 *
 * @param {Date} [date] - Date to query (default: today).
 * @returns {string}
 */
export function getWeeklySeed(date) {
    const week = getWeekNumber(date);
    return `weekly-${week}-sudoku-league`;
}

/**
 * Get the weekly challenge configuration for a given date.
 *
 * @param {Date} [date] - Date to query (default: today).
 * @returns {{
 *   week: number,
 *   seed: string,
 *   difficulty: string,
 *   variant: string,
 *   boardSize: number,
 *   weekStart: string,
 *   weekEnd: string,
 * }}
 */
export function getWeeklyConfig(date) {
    const d = date instanceof Date ? date : new Date();
    const week = getWeekNumber(d);

    const difficulty = DIFFICULTIES[week % DIFFICULTIES.length];
    const variant = VARIANTS[week % VARIANTS.length];

    // Calculate week start (Monday) and end (Sunday)
    const weekStart = new Date(EPOCH.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
        week,
        seed: getWeeklySeed(d),
        difficulty,
        variant,
        boardSize: 9,
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(weekEnd),
    };
}

/**
 * Derive a numeric seed from the weekly seed string.
 * Uses DJB2 hash, same approach as daily-seed.js.
 *
 * @param {Date} [date] - Date to query (default: today).
 * @returns {number} Unsigned 32-bit integer seed.
 */
export function getWeeklyNumericSeed(date) {
    const str = getWeeklySeed(date);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as "YYYY-MM-DD".
 *
 * @param {Date} d
 * @returns {string}
 */
function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

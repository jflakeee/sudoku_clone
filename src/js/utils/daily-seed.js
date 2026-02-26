/**
 * Daily-Challenge Seed Utilities
 *
 * Provides deterministic, date-based random number generation so that every
 * player sees the same daily puzzle for a given date.
 *
 * @module utils/daily-seed
 */

// ---------------------------------------------------------------------------
// Difficulty cycle
// ---------------------------------------------------------------------------

/** @type {string[]} */
const DIFFICULTY_CYCLE = ['easy', 'normal', 'hard', 'expert', 'master'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive a numeric seed from a date.
 *
 * The seed is computed by hashing the ISO date string ("YYYY-MM-DD") into a
 * 32-bit unsigned integer. When called without arguments the current local
 * date is used.
 *
 * @param {Date} [date] - Date to derive the seed from (default: today).
 * @returns {number} A non-negative 32-bit integer seed.
 */
export function getDailySeed(date) {
    const d = date instanceof Date ? date : new Date();
    const dateString = formatDateString(d);
    return hashString(dateString);
}

/**
 * Create a deterministic pseudo-random number generator seeded with `seed`.
 *
 * Uses the Mulberry32 PRNG algorithm which yields a full 2^32 period and
 * passes common statistical randomness tests.
 *
 * @param {number} seed - 32-bit integer seed.
 * @returns {() => number} A function that returns a new pseudo-random float
 *   in the range [0, 1) on every call.
 */
export function seededRandom(seed) {
    let s = seed | 0;

    return function mulberry32() {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Return the daily-challenge difficulty for a given date.
 *
 * The difficulty cycles through the list
 * `['easy', 'normal', 'hard', 'expert', 'master']` based on the day of
 * the month (1-indexed), so day 1 is "easy", day 2 is "normal", etc.
 *
 * @param {Date} [date] - Date to query (default: today).
 * @returns {string} One of 'easy' | 'normal' | 'hard' | 'expert' | 'master'.
 */
export function getDailyDifficulty(date) {
    const d = date instanceof Date ? date : new Date();
    const dayOfMonth = d.getDate(); // 1-31
    return DIFFICULTY_CYCLE[(dayOfMonth - 1) % DIFFICULTY_CYCLE.length];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as "YYYY-MM-DD" using local time.
 *
 * @param {Date} d
 * @returns {string}
 */
function formatDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Simple string-to-32-bit-integer hash (DJB2 variant).
 *
 * @param {string} str
 * @returns {number} Unsigned 32-bit integer.
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        // hash * 33 + charCode
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return hash >>> 0; // ensure unsigned
}

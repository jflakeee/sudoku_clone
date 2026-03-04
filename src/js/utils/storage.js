/**
 * LocalStorage Wrapper
 *
 * Provides typed save/load helpers for all persistent game data:
 * current game state, statistics, settings, and daily challenge progress.
 *
 * Every public function catches JSON parse errors and returns a sensible
 * default so the rest of the app never has to worry about corrupt storage.
 *
 * @module utils/storage
 */

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEYS = {
    CURRENT_GAME: 'sudoku_currentGame',
    STATS: 'sudoku_stats',
    SETTINGS: 'sudoku_settings',
    DAILY_CHALLENGE: 'sudoku_dailyChallenge',
    GAME_HISTORY: 'sudoku_gameHistory',
    STREAK: 'sudoku_streak',
    USER_XP: 'sudoku_userXP',
    WEEKLY: 'sudoku_weekly',
    ACTIVE_TITLE: 'sudoku_activeTitle',
};

const MAX_HISTORY_ENTRIES = 200;

// ---------------------------------------------------------------------------
// Difficulties used for per-difficulty stat initialisation
// ---------------------------------------------------------------------------

const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'master'];

// ---------------------------------------------------------------------------
// Default objects
// ---------------------------------------------------------------------------

/**
 * Returns a fresh default settings object.
 *
 * @returns {{
 *   sound: boolean,
 *   vibration: boolean,
 *   autoLock: boolean,
 *   timer: boolean,
 *   scoreAnimation: boolean,
 *   statsMessage: boolean,
 *   smartHints: boolean,
 *   numberFirst: boolean,
 *   mistakeLimit: boolean
 * }}
 */
function getDefaultSettings() {
    return {
        sound: true,
        vibration: true,
        autoLock: false,
        timer: true,
        scoreAnimation: true,
        statsMessage: true,
        smartHints: true,
        numberFirst: false,
        mistakeLimit: true,
        darkMode: false,
        theme: 'default',
        autoCheckMistakes: false,
        animations: true,
        locale: 'ko',
        highContrast: false,
        volume: 50,
    };
}

/**
 * Returns a fresh default stat block for a single difficulty level.
 *
 * @returns {{
 *   gamesStarted: number,
 *   gamesWon: number,
 *   noMistakeWins: number,
 *   bestTime: number,
 *   totalTime: number,
 *   currentStreak: number,
 *   bestStreak: number,
 *   highScores: {today: number, thisWeek: number, thisMonth: number, allTime: number}
 * }}
 */
function getDefaultDifficultyStats() {
    return {
        gamesStarted: 0,
        gamesWon: 0,
        noMistakeWins: 0,
        bestTime: 0,
        totalTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        highScores: {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            allTime: 0,
            lastDate: '',
        },
    };
}

/**
 * Returns a fresh default stats object keyed by difficulty.
 *
 * @returns {Record<string, ReturnType<typeof getDefaultDifficultyStats>>}
 */
function getDefaultStats() {
    /** @type {Record<string, ReturnType<typeof getDefaultDifficultyStats>>} */
    const stats = {};
    for (const diff of DIFFICULTIES) {
        stats[diff] = getDefaultDifficultyStats();
    }
    return stats;
}

/**
 * Returns a fresh default daily-challenge data object.
 *
 * @returns {{ completed: string[], streak: number }}
 */
function getDefaultDailyChallenge() {
    return {
        completed: [],
        streak: 0,
    };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely read and JSON-parse a localStorage value.
 *
 * @param {string} key - localStorage key
 * @returns {*} Parsed value, or `null` when the key is missing / corrupt.
 */
function readJSON(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * JSON-stringify and persist a value to localStorage.
 *
 * @param {string} key - localStorage key
 * @param {*} value - Serialisable value
 */
function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota exceeded or other storage error — silently ignore.
    }
}

// ---------------------------------------------------------------------------
// Current game
// ---------------------------------------------------------------------------

/**
 * Save the current game state.
 *
 * @param {object} gameState - Full game state object (board, solution, given,
 *   notes, difficulty, score, mistakes, time, history, etc.)
 */
export function saveGame(gameState) {
    writeJSON(KEYS.CURRENT_GAME, gameState);
}

/**
 * Load the previously saved game state.
 *
 * @returns {object | null} Parsed game state, or `null` if none exists.
 */
export function loadGame() {
    return readJSON(KEYS.CURRENT_GAME);
}

/**
 * Remove the saved current-game entry.
 */
export function clearGame() {
    try {
        localStorage.removeItem(KEYS.CURRENT_GAME);
    } catch {
        // Ignore errors.
    }
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Get the localStorage key for stats based on game mode, board size, and variant.
 *
 * @param {string} mode - Game mode ('classic', 'timeAttack', etc.).
 * @param {number} [boardSize=9] - Board size (4, 6, 9, 12, 16).
 * @param {string} [variant='standard'] - Variant ('standard', 'diagonal', etc.).
 * @returns {string} The storage key.
 */
export function getStatsKey(mode = 'classic', boardSize = 9, variant = 'standard') {
    let key = KEYS.STATS;
    if (mode && mode !== 'classic') {
        key = `${KEYS.STATS}_${mode}`;
    }
    // Only add suffix for non-default boardSize/variant
    if (boardSize !== 9 || variant !== 'standard') {
        key += `_${boardSize}_${variant}`;
    }
    return key;
}

/**
 * Save statistics.
 *
 * @param {object} stats - Stats object keyed by difficulty.
 * @param {string} [mode='classic'] - Game mode.
 * @param {number} [boardSize=9] - Board size.
 * @param {string} [variant='standard'] - Variant.
 */
export function saveStats(stats, mode = 'classic', boardSize = 9, variant = 'standard') {
    writeJSON(getStatsKey(mode, boardSize, variant), stats);
}

/**
 * Load statistics, falling back to a full default stats object when nothing
 * has been persisted yet.
 *
 * @param {string} [mode='classic'] - Game mode.
 * @param {number} [boardSize=9] - Board size.
 * @param {string} [variant='standard'] - Variant.
 * @returns {Record<string, object>} Per-difficulty stats.
 */
export function loadStats(mode = 'classic', boardSize = 9, variant = 'standard') {
    const stored = readJSON(getStatsKey(mode, boardSize, variant));
    if (!stored || typeof stored !== 'object') {
        return getDefaultStats();
    }

    // Ensure every expected difficulty key exists (forward-compatible).
    const merged = getDefaultStats();
    for (const diff of DIFFICULTIES) {
        if (stored[diff] && typeof stored[diff] === 'object') {
            merged[diff] = { ...merged[diff], ...stored[diff] };
            // Also ensure nested highScores is complete.
            merged[diff].highScores = {
                ...getDefaultDifficultyStats().highScores,
                ...(stored[diff].highScores || {}),
            };
        }
    }

    return merged;
}

/**
 * Load aggregate statistics across all boardSize/variant combos for a mode.
 * Merges stats by summing counts and taking best values.
 *
 * @param {string} [mode='classic'] - Game mode.
 * @param {string} [filterSize='all'] - Board size filter ('all' or number string).
 * @param {string} [filterVariant='all'] - Variant filter ('all' or variant string).
 * @returns {Record<string, object>} Aggregated per-difficulty stats.
 */
export function loadAggregateStats(mode = 'classic', filterSize = 'all', filterVariant = 'all') {
    const sizes = [4, 6, 9, 12, 16];
    const variants = ['standard', 'diagonal', 'anti-knight', 'anti-king', 'windoku', 'even-odd'];

    const targetSizes = filterSize === 'all' ? sizes : [Number(filterSize)];
    const targetVariants = filterVariant === 'all' ? variants : [filterVariant];

    const aggregate = getDefaultStats();

    for (const sz of targetSizes) {
        for (const v of targetVariants) {
            const stats = loadStats(mode, sz, v);
            for (const diff of DIFFICULTIES) {
                const src = stats[diff];
                const dst = aggregate[diff];
                if (!src) continue;
                dst.gamesStarted += src.gamesStarted || 0;
                dst.gamesWon += src.gamesWon || 0;
                dst.noMistakeWins += src.noMistakeWins || 0;
                dst.totalTime += src.totalTime || 0;
                if (src.bestTime > 0 && (dst.bestTime === 0 || src.bestTime < dst.bestTime)) {
                    dst.bestTime = src.bestTime;
                }
                if ((src.currentStreak || 0) > dst.currentStreak) dst.currentStreak = src.currentStreak;
                if ((src.bestStreak || 0) > dst.bestStreak) dst.bestStreak = src.bestStreak;
                const srcHs = src.highScores || {};
                const dstHs = dst.highScores;
                if ((srcHs.today || 0) > dstHs.today) dstHs.today = srcHs.today;
                if ((srcHs.thisWeek || 0) > dstHs.thisWeek) dstHs.thisWeek = srcHs.thisWeek;
                if ((srcHs.thisMonth || 0) > dstHs.thisMonth) dstHs.thisMonth = srcHs.thisMonth;
                if ((srcHs.allTime || 0) > dstHs.allTime) dstHs.allTime = srcHs.allTime;
            }
        }
    }

    // Also include legacy keys (old format without boardSize/variant suffix)
    if (filterSize === 'all' || filterSize === '9') {
        if (filterVariant === 'all' || filterVariant === 'standard') {
            const legacyKey = mode === 'classic' ? KEYS.STATS : `${KEYS.STATS}_${mode}`;
            const legacy = readJSON(legacyKey);
            if (legacy && typeof legacy === 'object') {
                for (const diff of DIFFICULTIES) {
                    const src = legacy[diff];
                    const dst = aggregate[diff];
                    if (!src || typeof src !== 'object') continue;
                    dst.gamesStarted += src.gamesStarted || 0;
                    dst.gamesWon += src.gamesWon || 0;
                    dst.noMistakeWins += src.noMistakeWins || 0;
                    dst.totalTime += src.totalTime || 0;
                    if (src.bestTime > 0 && (dst.bestTime === 0 || src.bestTime < dst.bestTime)) {
                        dst.bestTime = src.bestTime;
                    }
                    if ((src.currentStreak || 0) > dst.currentStreak) dst.currentStreak = src.currentStreak;
                    if ((src.bestStreak || 0) > dst.bestStreak) dst.bestStreak = src.bestStreak;
                    const srcHs = src.highScores || {};
                    const dstHs = dst.highScores;
                    if ((srcHs.today || 0) > dstHs.today) dstHs.today = srcHs.today;
                    if ((srcHs.thisWeek || 0) > dstHs.thisWeek) dstHs.thisWeek = srcHs.thisWeek;
                    if ((srcHs.thisMonth || 0) > dstHs.thisMonth) dstHs.thisMonth = srcHs.thisMonth;
                    if ((srcHs.allTime || 0) > dstHs.allTime) dstHs.allTime = srcHs.allTime;
                }
            }
        }
    }

    return aggregate;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Save user settings.
 *
 * @param {object} settings - Settings object.
 */
export function saveSettings(settings) {
    writeJSON(KEYS.SETTINGS, settings);
}

/**
 * Load user settings, falling back to defaults for any missing keys.
 *
 * @returns {ReturnType<typeof getDefaultSettings>} Merged settings.
 */
export function loadSettings() {
    const stored = readJSON(KEYS.SETTINGS);
    if (!stored || typeof stored !== 'object') {
        return getDefaultSettings();
    }

    return { ...getDefaultSettings(), ...stored };
}

// ---------------------------------------------------------------------------
// High score period reset
// ---------------------------------------------------------------------------

/**
 * Get ISO week number for a given date.
 *
 * @param {Date} date
 * @returns {number}
 */
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Check if high scores need to be reset based on date changes.
 * Resets today/thisWeek/thisMonth scores when the period changes.
 *
 * @param {object} hs - The highScores object to check and mutate.
 */
export function checkAndResetHighScores(hs) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (!hs.lastDate || hs.lastDate === todayStr) {
        hs.lastDate = todayStr;
        return;
    }

    const last = new Date(hs.lastDate + 'T00:00:00');

    // Different day → reset today
    if (todayStr !== hs.lastDate) {
        hs.today = 0;
    }

    // Different ISO week → reset thisWeek
    if (getISOWeek(now) !== getISOWeek(last) || now.getFullYear() !== last.getFullYear()) {
        hs.thisWeek = 0;
    }

    // Different month → reset thisMonth
    if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
        hs.thisMonth = 0;
    }

    hs.lastDate = todayStr;
}

// ---------------------------------------------------------------------------
// Daily challenge
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Data migration
// ---------------------------------------------------------------------------

const CURRENT_STORAGE_VERSION = 2;

/**
 * Run any needed data migrations on localStorage.
 *
 * Called once during app init. Uses the `sudoku_version` key to track
 * which migrations have already been applied.
 */
export function migrateStorageIfNeeded() {
    const versionKey = 'sudoku_version';
    const storedVersion = parseInt(localStorage.getItem(versionKey) || '0', 10);

    if (storedVersion >= CURRENT_STORAGE_VERSION) return;

    // --- Migration v0 → v1: add mode / boardSize defaults to saved game ---
    if (storedVersion < 1) {
        const game = readJSON(KEYS.CURRENT_GAME);
        if (game && typeof game === 'object') {
            let changed = false;
            if (!game.mode) { game.mode = 'classic'; changed = true; }
            if (!game.boardSize) { game.boardSize = 9; changed = true; }
            if (changed) writeJSON(KEYS.CURRENT_GAME, game);
        }
    }

    // --- Migration v1 → v2: initialise gameHistory key ---
    if (storedVersion < 2) {
        if (readJSON(KEYS.GAME_HISTORY) === null) {
            writeJSON(KEYS.GAME_HISTORY, []);
        }
    }

    // Stamp current version
    try {
        localStorage.setItem(versionKey, String(CURRENT_STORAGE_VERSION));
    } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Daily challenge
// ---------------------------------------------------------------------------

/**
 * Save daily-challenge progress data.
 *
 * @param {{ completed: string[], streak: number }} data
 */
export function saveDailyChallenge(data) {
    writeJSON(KEYS.DAILY_CHALLENGE, data);
}

/**
 * Load daily-challenge progress, falling back to defaults.
 *
 * @returns {{ completed: string[], streak: number }}
 */
export function loadDailyChallenge() {
    const stored = readJSON(KEYS.DAILY_CHALLENGE);
    if (!stored || typeof stored !== 'object') {
        return getDefaultDailyChallenge();
    }

    return {
        completed: Array.isArray(stored.completed) ? stored.completed : [],
        streak: typeof stored.streak === 'number' ? stored.streak : 0,
    };
}

// ---------------------------------------------------------------------------
// Game history archive
// ---------------------------------------------------------------------------

/**
 * Save a completed game entry to the history archive.
 * Entries are capped at MAX_HISTORY_ENTRIES (oldest entries are pruned).
 *
 * @param {object} entry - Game history entry with id, puzzle, solution, etc.
 */
export function saveGameHistory(entry) {
    const history = loadGameHistory();
    history.unshift(entry);
    if (history.length > MAX_HISTORY_ENTRIES) {
        history.length = MAX_HISTORY_ENTRIES;
    }
    writeJSON(KEYS.GAME_HISTORY, history);
}

/**
 * Load the full game history array.
 *
 * @returns {object[]}
 */
export function loadGameHistory() {
    const stored = readJSON(KEYS.GAME_HISTORY);
    return Array.isArray(stored) ? stored : [];
}

/**
 * Find a specific game history entry by its id.
 *
 * @param {string} id - Entry id.
 * @returns {object | null}
 */
export function getGameHistoryById(id) {
    const history = loadGameHistory();
    return history.find(e => e.id === id) || null;
}

/**
 * Clear all game history.
 */
export function clearGameHistory() {
    writeJSON(KEYS.GAME_HISTORY, []);
}

// ---------------------------------------------------------------------------
// Streak (daily puzzle-solving streak)
// ---------------------------------------------------------------------------

/**
 * Returns a fresh default streak object.
 *
 * @returns {{ current: number, best: number, lastDate: string | null }}
 */
function getDefaultStreak() {
    return { current: 0, best: 0, lastDate: null };
}

/**
 * Save streak data.
 *
 * @param {{ current: number, best: number, lastDate: string | null }} data
 */
export function saveStreak(data) {
    writeJSON(KEYS.STREAK, data);
}

/**
 * Load streak data, falling back to defaults.
 *
 * @returns {{ current: number, best: number, lastDate: string | null }}
 */
export function loadStreak() {
    const stored = readJSON(KEYS.STREAK);
    if (!stored || typeof stored !== 'object') {
        return getDefaultStreak();
    }
    return {
        current: typeof stored.current === 'number' ? stored.current : 0,
        best: typeof stored.best === 'number' ? stored.best : 0,
        lastDate: typeof stored.lastDate === 'string' ? stored.lastDate : null,
    };
}

// ---------------------------------------------------------------------------
// Weekly challenge
// ---------------------------------------------------------------------------

/**
 * Save weekly challenge progress.
 *
 * @param {{ completed: boolean, time: number, mistakes: number, week: number, score: number }} data
 */
export function saveWeekly(data) {
    writeJSON(KEYS.WEEKLY, data);
}

/**
 * Load weekly challenge progress.
 *
 * @returns {{ completed: boolean, time: number, mistakes: number, week: number, score: number } | null}
 */
export function loadWeekly() {
    return readJSON(KEYS.WEEKLY);
}

// ---------------------------------------------------------------------------
// Active title
// ---------------------------------------------------------------------------

/**
 * Save the user's active title id.
 *
 * @param {string} titleId
 */
export function saveActiveTitle(titleId) {
    writeJSON(KEYS.ACTIVE_TITLE, titleId);
}

/**
 * Load the user's active title id.
 *
 * @returns {string}
 */
export function loadActiveTitle() {
    const stored = readJSON(KEYS.ACTIVE_TITLE);
    return typeof stored === 'string' ? stored : 'beginner';
}

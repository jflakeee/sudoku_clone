/**
 * XP / Level System
 *
 * Provides experience point calculation, level management, and persistence.
 * XP is earned after completing games and accumulates over time.
 *
 * @module utils/xp
 */

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sudoku_userXP';

// ---------------------------------------------------------------------------
// Level table (quadratic growth)
// Level N requires cumulative XP = sum of (k*50 + (k-1)*25) for k=2..N
// Max level: 99
// ---------------------------------------------------------------------------

/** @type {number[]} Cumulative XP thresholds. LEVEL_TABLE[i] = XP needed for level i. */
const LEVEL_TABLE = [0]; // Level 0 placeholder (unused)

// Build table: Level 1 = 0 XP, Level 2 = 100 XP, etc.
(function buildLevelTable() {
    let cumulative = 0;
    LEVEL_TABLE.push(0); // Level 1: 0 XP
    for (let n = 2; n <= 99; n++) {
        // XP needed to go from level n-1 to level n
        const increment = n * 50 + (n - 1) * 25;
        cumulative += increment;
        LEVEL_TABLE.push(cumulative);
    }
})();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the cumulative XP required to reach a given level.
 *
 * @param {number} level - Target level (1-99).
 * @returns {number} Cumulative XP required.
 */
export function getXPForLevel(level) {
    if (level <= 1) return 0;
    if (level >= 99) return LEVEL_TABLE[99];
    return LEVEL_TABLE[level];
}

/**
 * Derive level info from a total XP value.
 *
 * @param {number} xp - Total accumulated XP.
 * @returns {{ level: number, currentXP: number, nextLevelXP: number, progress: number }}
 */
export function getLevelFromXP(xp) {
    let level = 1;
    for (let i = 2; i <= 99; i++) {
        if (xp >= LEVEL_TABLE[i]) {
            level = i;
        } else {
            break;
        }
    }

    const currentLevelXP = LEVEL_TABLE[level];
    const nextLevelXP = level < 99 ? LEVEL_TABLE[level + 1] : LEVEL_TABLE[99];
    const xpIntoLevel = xp - currentLevelXP;
    const xpForNextLevel = nextLevelXP - currentLevelXP;
    const progress = xpForNextLevel > 0 ? Math.min(xpIntoLevel / xpForNextLevel, 1) : 1;

    return {
        level,
        currentXP: xpIntoLevel,
        nextLevelXP: xpForNextLevel,
        progress,
    };
}

// ---------------------------------------------------------------------------
// Median times by difficulty (seconds) - for time bonus calculation
// ---------------------------------------------------------------------------

const MEDIAN_TIMES = {
    easy: 300,      // 5 min
    medium: 600,    // 10 min
    normal: 600,    // 10 min
    hard: 900,      // 15 min
    expert: 1200,   // 20 min
    master: 1800,   // 30 min
};

/**
 * Calculate XP earned for a completed game.
 *
 * @param {string} difficulty - Difficulty key.
 * @param {string} mode - Game mode ('classic', 'timeAttack').
 * @param {string} variant - Variant ('standard', 'diagonal', etc.).
 * @param {number} boardSize - Board size (4, 6, 9, 12, 16).
 * @param {number} mistakes - Number of mistakes made.
 * @param {number} timeSeconds - Time taken in seconds.
 * @returns {number} XP earned (rounded integer).
 */
export function calculateGameXP(difficulty, mode, variant, boardSize, mistakes, timeSeconds) {
    // Base XP by difficulty
    const BASE_XP = {
        easy: 20,
        medium: 40,
        normal: 40,
        hard: 70,
        expert: 100,
        master: 150,
    };

    let baseXP = BASE_XP[difficulty] || 20;

    // Mode multiplier
    let multiplier = 1;
    if (mode === 'timeAttack') {
        multiplier *= 1.5;
    }

    // Variant bonus (non-standard)
    if (variant && variant !== 'standard') {
        multiplier *= 1.3;
    }

    // Board size bonus
    if (boardSize === 12) {
        multiplier *= 1.2;
    } else if (boardSize === 16) {
        multiplier *= 1.5;
    }

    // Perfect bonus (0 mistakes)
    if (mistakes === 0) {
        multiplier *= 1.5;
    }

    // Time bonus: under median time for difficulty
    const median = MEDIAN_TIMES[difficulty] || 600;
    if (timeSeconds > 0 && timeSeconds < median) {
        multiplier *= 1.2;
    }

    return Math.round(baseXP * multiplier);
}

/**
 * Load user XP data from localStorage.
 *
 * @returns {{ totalXP: number, level: number }}
 */
export function loadUserXP() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data && typeof data.totalXP === 'number') {
                const info = getLevelFromXP(data.totalXP);
                return { totalXP: data.totalXP, level: info.level };
            }
        }
    } catch { /* ignore */ }
    return { totalXP: 0, level: 1 };
}

/**
 * Save user XP data to localStorage.
 *
 * @param {{ totalXP: number }} data
 */
export function saveUserXP(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
}

/**
 * Add earned XP and persist. Returns info about the new state.
 *
 * @param {number} earnedXP - XP to add.
 * @returns {{ totalXP: number, level: number, leveledUp: boolean, oldLevel: number, earnedXP: number }}
 */
export function addXP(earnedXP) {
    const current = loadUserXP();
    const oldLevel = current.level;
    const newTotalXP = current.totalXP + earnedXP;

    saveUserXP({ totalXP: newTotalXP });

    const info = getLevelFromXP(newTotalXP);

    return {
        totalXP: newTotalXP,
        level: info.level,
        leveledUp: info.level > oldLevel,
        oldLevel,
        earnedXP,
    };
}

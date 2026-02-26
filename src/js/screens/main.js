/**
 * Main Screen Controller
 *
 * Manages the home screen that shows the daily challenge card, best score,
 * continue-game button, and new-game button.
 *
 * @module screens/main
 */

import { loadGame, loadStats, loadDailyChallenge } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Difficulty label helper
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = {
    easy: '쉬움',
    medium: '보통',
    normal: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

// ---------------------------------------------------------------------------
// DOM references (resolved once during init)
// ---------------------------------------------------------------------------

/** @type {HTMLElement | null} */
let screenEl = null;
/** @type {HTMLElement | null} */
let dailyCardDate = null;
/** @type {HTMLElement | null} */
let bestScoreNumber = null;
/** @type {HTMLElement | null} */
let btnContinue = null;
/** @type {HTMLElement | null} */
let btnContinueSub = null;
/** @type {HTMLElement | null} */
let btnNewGame = null;
/** @type {HTMLElement | null} */
let streakCount = null;

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------

/**
 * Initialise the main screen controller.
 *
 * @param {object} app - Global app reference.
 */
export function initMainScreen(app) {
    screenEl = document.getElementById('screen-main');
    if (!screenEl) return;

    dailyCardDate = screenEl.querySelector('.daily-card-date');
    bestScoreNumber = screenEl.querySelector('.best-score-number');
    btnContinue = screenEl.querySelector('.btn-continue-game');
    btnContinueSub = screenEl.querySelector('.btn-continue-game .btn-sub');
    btnNewGame = screenEl.querySelector('.btn-new-game');
    streakCount = screenEl.querySelector('.streak-count');

    // --- Continue game button ---
    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            app.navigate('game', { loadSaved: true });
        });
    }

    // --- New game button (opens difficulty modal) ---
    if (btnNewGame) {
        btnNewGame.addEventListener('click', (e) => {
            // Prevent the global data-action handler from also firing
            e.stopPropagation();
            app.showDifficultyModal();
        });
    }

    // --- Daily challenge card (navigate handled via data-navigate="daily") ---

    // --- Update UI when this screen is shown ---
    document.addEventListener('screen-show', (e) => {
        if (/** @type {CustomEvent} */ (e).detail.screen === 'main') {
            refresh();
        }
    });

    // Initial paint
    refresh();
}

// ---------------------------------------------------------------------------
// Internal: refresh UI state
// ---------------------------------------------------------------------------

/**
 * Update all dynamic elements on the main screen.
 */
function refresh() {
    updateDailyCard();
    updateBestScore();
    updateContinueButton();
    updateStreak();
}

/**
 * Set the daily challenge card's date to today.
 */
function updateDailyCard() {
    if (!dailyCardDate) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    dailyCardDate.textContent = `${month}월 ${day}일`;
}

/**
 * Show the all-time best score across all difficulties.
 */
function updateBestScore() {
    if (!bestScoreNumber) return;

    const stats = loadStats();
    let best = 0;

    for (const diff of Object.keys(stats)) {
        const hs = stats[diff]?.highScores;
        if (hs && hs.allTime > best) {
            best = hs.allTime;
        }
    }

    bestScoreNumber.textContent = best.toLocaleString();
}

/**
 * Show or hide the "게임 계속하기" button based on whether a saved game exists.
 */
function updateContinueButton() {
    const saved = loadGame();

    if (!btnContinue) return;

    if (saved && saved.board) {
        btnContinue.style.display = '';

        // Show time and difficulty in subtitle
        if (btnContinueSub) {
            const time = formatTime(saved.time || 0);
            const diffLabel = DIFFICULTY_LABELS[saved.difficulty] || saved.difficulty;
            btnContinueSub.textContent = `${time} - ${diffLabel}`;
        }
    } else {
        btnContinue.style.display = 'none';
    }
}

/**
 * Update the streak badge from daily challenge data.
 */
function updateStreak() {
    if (!streakCount) return;

    const daily = loadDailyChallenge();
    streakCount.textContent = String(daily.streak || 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format seconds as "MM:SS".
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

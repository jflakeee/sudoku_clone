/**
 * Main Screen Controller
 *
 * Manages the home screen that shows the daily challenge card, best score,
 * continue-game button, and new-game button.
 *
 * @module screens/main
 */

import { loadGame, loadStats, loadDailyChallenge, loadStreak, loadWeekly } from '../utils/storage.js';
import { loadUserXP } from '../utils/xp.js';
import { getWeeklyConfig, getWeekNumber } from '../utils/weekly-seed.js';
import { getActiveTitleLabel } from '../utils/titles.js';
import { decodePuzzle } from '../utils/puzzle-share.js';
import { DIFFICULTY_LABELS, VARIANT_LABELS } from '../utils/constants.js';

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
/** @type {HTMLElement | null} */
let levelNumberEl = null;
/** @type {HTMLElement | null} */
let mainTitleLabel = null;

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
    levelNumberEl = screenEl.querySelector('.level-number');
    mainTitleLabel = screenEl.querySelector('.main-title-label');

    // --- Weekly challenge card ---
    const weeklyCard = screenEl.querySelector('.weekly-challenge-card');
    if (weeklyCard) {
        weeklyCard.addEventListener('click', (e) => {
            e.stopPropagation();
            startWeeklyChallenge(app);
        });
    }

    // --- Continue game button ---
    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            app.navigate('game', { loadSaved: true });
        });
    }

    // --- New game button (opens mode-select screen) ---
    if (btnNewGame) {
        btnNewGame.addEventListener('click', (e) => {
            // Prevent the global data-action handler from also firing
            e.stopPropagation();
            app.navigate('mode-select');
        });
    }

    // --- Print new puzzles button ---
    const btnPrint = screenEl.querySelector('[data-action="print-new"]');
    if (btnPrint) {
        btnPrint.addEventListener('click', (e) => {
            e.stopPropagation();
            app.navigate('mode-select', { forPrint: true });
        });
    }

    // --- Import puzzle button ---
    const btnImport = screenEl.querySelector('[data-action="import-puzzle"]');
    if (btnImport) {
        btnImport.addEventListener('click', (e) => {
            e.stopPropagation();
            showImportModal();
        });
    }

    // --- Import modal handlers ---
    const importModal = document.getElementById('puzzle-import-modal');
    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) hideImportModal();
        });

        const cancelBtn = document.getElementById('btn-import-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => hideImportModal());
        }

        const startBtn = document.getElementById('btn-import-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const input = document.getElementById('puzzle-import-input');
                const errorEl = document.getElementById('puzzle-import-error');
                if (!input) return;

                const code = input.value.trim();
                if (!code) return;

                // If the user pasted a full URL, extract the puzzle code
                let puzzleCode = code;
                try {
                    const url = new URL(code);
                    const p = url.searchParams.get('puzzle');
                    if (p) puzzleCode = p;
                } catch {
                    // Not a URL, treat as raw code
                }

                const decoded = decodePuzzle(puzzleCode);
                if (!decoded) {
                    if (errorEl) errorEl.style.display = '';
                    return;
                }

                hideImportModal();
                app.navigate('game', {
                    sharedPuzzle: decoded,
                    difficulty: 'normal',
                    mode: 'classic',
                    boardSize: decoded.boardSize,
                    variant: decoded.variant,
                });
            });
        }
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
    updateWeeklyCard();
    updateBestScore();
    updateContinueButton();
    updateStreak();
    updateLevel();
    updateTitle();
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
 * Update the streak badge from streak data.
 */
function updateStreak() {
    if (!streakCount) return;

    const streak = loadStreak();
    streakCount.textContent = String(streak.current || 0);
}

/**
 * Update the level badge from user XP data.
 */
function updateLevel() {
    if (!levelNumberEl) return;

    const xpData = loadUserXP();
    levelNumberEl.textContent = String(xpData.level || 1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Update the weekly challenge card.
 */
function updateWeeklyCard() {
    if (!screenEl) return;

    const config = getWeeklyConfig();
    const weekly = loadWeekly();
    const currentWeek = getWeekNumber();

    const diffEl = screenEl.querySelector('.weekly-card-difficulty');
    const variantEl = screenEl.querySelector('.weekly-card-variant');
    const periodEl = screenEl.querySelector('.weekly-card-period');
    const statusEl = screenEl.querySelector('.weekly-card-status');

    if (diffEl) diffEl.textContent = DIFFICULTY_LABELS[config.difficulty] || config.difficulty;
    if (variantEl) {
        variantEl.textContent = VARIANT_LABELS[config.variant] || config.variant;
    }
    if (periodEl) {
        periodEl.textContent = `${config.weekStart} ~ ${config.weekEnd}`;
    }
    if (statusEl) {
        const isCompleted = weekly && weekly.week === currentWeek && weekly.completed;
        statusEl.textContent = isCompleted ? '완료' : '도전';
        statusEl.className = `weekly-card-status ${isCompleted ? 'completed' : ''}`;
    }
}

/**
 * Update the title display on the main screen.
 */
function updateTitle() {
    if (!mainTitleLabel) return;
    mainTitleLabel.textContent = getActiveTitleLabel();
}

/**
 * Start a weekly challenge game.
 *
 * @param {object} app
 */
function startWeeklyChallenge(app) {
    const config = getWeeklyConfig();
    const weekly = loadWeekly();
    const currentWeek = getWeekNumber();

    // Already completed this week
    if (weekly && weekly.week === currentWeek && weekly.completed) {
        return;
    }

    app.navigate('game', {
        difficulty: config.difficulty,
        mode: 'classic',
        boardSize: config.boardSize,
        variant: config.variant,
        isWeekly: true,
        weekNumber: currentWeek,
    });
}

/**
 * Show the puzzle import modal.
 */
function showImportModal() {
    const modal = document.getElementById('puzzle-import-modal');
    if (modal) {
        modal.style.display = '';
        const input = document.getElementById('puzzle-import-input');
        if (input) {
            input.value = '';
            input.focus();
        }
        const errorEl = document.getElementById('puzzle-import-error');
        if (errorEl) errorEl.style.display = 'none';
    }
}

/**
 * Hide the puzzle import modal.
 */
function hideImportModal() {
    const modal = document.getElementById('puzzle-import-modal');
    if (modal) modal.style.display = 'none';
}

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

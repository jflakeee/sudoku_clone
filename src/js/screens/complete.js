/**
 * Game Complete Screen Controller
 *
 * Displays the end-of-game results: final score (with count-up animation),
 * time, difficulty, high-score table, and confetti celebration.
 *
 * @module screens/complete
 */

import { loadStats, saveStats, clearGame, loadDailyChallenge, saveDailyChallenge, checkAndResetHighScores, saveGameHistory } from '../utils/storage.js';
import { createConfetti, animateScoreCountUp } from '../ui/animations.js';
import { calculateTimeAttackBonus } from '../core/scorer.js';
import { checkAchievements } from '../utils/achievements.js';

// ---------------------------------------------------------------------------
// Difficulty label map
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
// DOM references
// ---------------------------------------------------------------------------

/** @type {HTMLElement | null} */
let screenEl = null;
/** @type {HTMLElement | null} */
let scoreEl = null;
/** @type {HTMLElement | null} */
let timeEl = null;
/** @type {HTMLElement | null} */
let difficultyEl = null;
/** @type {HTMLElement | null} */
let messageEl = null;
/** @type {HTMLElement | null} */
let confettiArea = null;

/** @type {object | null} */
let _app = null;

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------

/**
 * Initialise the game complete screen controller.
 *
 * @param {object} app - Global app reference.
 */
export function initCompleteScreen(app) {
    _app = app;

    screenEl = document.getElementById('screen-complete');
    if (!screenEl) return;

    scoreEl = screenEl.querySelector('.complete-score');
    timeEl = screenEl.querySelector('.complete-time');
    difficultyEl = screenEl.querySelector('.complete-difficulty');
    messageEl = screenEl.querySelector('.complete-message');
    confettiArea = document.getElementById('confetti-area');

    // --- Button handlers ---
    const newGameBtn = screenEl.querySelector('[data-action="new-game"]');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            _app.navigate('mode-select');
        });
    }

    // "메인" button is handled by global data-navigate="main"

    // --- Screen show listener ---
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'complete') {
            onShow(detail.params || {});
        }
    });
}

// ---------------------------------------------------------------------------
// Screen lifecycle
// ---------------------------------------------------------------------------

/**
 * Called when the complete screen becomes visible.
 *
 * @param {object} params - Parameters from navigation.
 * @param {number}  params.score      - Final total score.
 * @param {number}  params.time       - Elapsed time in seconds.
 * @param {string}  params.difficulty - Difficulty key.
 * @param {number}  params.mistakes   - Total mistakes made.
 * @param {boolean} [params.isDaily]  - Whether this was a daily challenge.
 */
function onShow(params) {
    const {
        score = 0,
        time = 0,
        difficulty = 'easy',
        mistakes = 0,
        isDaily = false,
        mode = 'classic',
        success = true,
        remainingTime = 0,
        totalTime = 0,
        message = '',
    } = params;

    // --- Display basic info ---
    if (difficultyEl) {
        difficultyEl.textContent = DIFFICULTY_LABELS[difficulty] || difficulty;
    }
    if (timeEl) {
        timeEl.textContent = formatTime(time);
    }

    // --- Score count-up animation ---
    if (scoreEl) {
        scoreEl.textContent = '0';
        animateScoreCountUp(scoreEl, score, 1500);
    }

    // --- Update stats ---
    const recordMessage = updateStats(difficulty, score, time, mistakes, mode);

    // --- Display message ---
    if (messageEl) {
        if (mode === 'timeAttack') {
            if (success) {
                messageEl.textContent = `${remainingTime}초 남기고 완료!`;
            } else {
                messageEl.textContent = message || '시간 초과!';
            }
        } else if (_app.settings.statsMessage) {
            messageEl.textContent = recordMessage || '';
        } else {
            messageEl.textContent = '';
        }
    }

    // --- Time-attack bonus ---
    const bonusEl = screenEl?.querySelector('.complete-bonus');
    if (bonusEl) {
        if (mode === 'timeAttack' && success && remainingTime > 0) {
            const bonus = calculateTimeAttackBonus(difficulty, remainingTime, totalTime, mistakes);
            bonusEl.textContent = `타임어택 보너스: +${bonus.toLocaleString()}`;
            bonusEl.style.display = '';
        } else {
            bonusEl.style.display = 'none';
        }
    }

    // --- Update high-score display ---
    updateHighScoreDisplay(difficulty, mode);

    // --- Daily challenge completion ---
    if (isDaily) {
        markDailyCompleted(params.dailyDate);
    }

    // --- Archive to game history (successful games only) ---
    if (success !== false && _app?.board) {
        try {
            const board = _app.board;
            const historyEntry = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                date: new Date().toISOString(),
                difficulty,
                mode,
                boardSize: board.boardSize || 9,
                variant: board.variant || 'standard',
                score,
                time,
                mistakes,
                puzzle: board.getInitialPuzzle(),
                solution: board.getSolution()?.map(r => [...r]) || null,
                given: board.getGiven()?.map(r => [...r]) || null,
                dailyDate: params.dailyDate || board.getDailyDate() || null,
            };
            saveGameHistory(historyEntry);
        } catch { /* ignore archive errors */ }
    }

    // --- Clear saved game ---
    clearGame();

    // --- Achievement check ---
    const { newlyUnlocked } = checkAchievements();
    if (newlyUnlocked.length > 0) {
        showAchievementToast(newlyUnlocked[0]);
    }

    // --- Confetti (skip on time-attack failure) ---
    if (confettiArea) {
        confettiArea.innerHTML = '';
        if (mode !== 'timeAttack' || success) {
            createConfetti(confettiArea, 50);
        }
    }
}

// ---------------------------------------------------------------------------
// Achievement toast
// ---------------------------------------------------------------------------

/**
 * Show an achievement toast notification at the top of the screen.
 *
 * @param {{ icon: string, title: string, desc: string }} achievement
 */
function showAchievementToast(achievement) {
    const toast = document.getElementById('achievement-toast');
    if (!toast) return;

    const iconEl = toast.querySelector('.achievement-toast-icon');
    const titleEl = toast.querySelector('.achievement-toast-title');
    const descEl = toast.querySelector('.achievement-toast-desc');

    if (iconEl) iconEl.textContent = achievement.icon;
    if (titleEl) titleEl.textContent = achievement.title;
    if (descEl) descEl.textContent = '업적 달성!';

    toast.style.display = '';
    toast.classList.remove('hide');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            toast.style.display = 'none';
            toast.classList.remove('hide');
        }, 400);
    }, 3000);
}

// ---------------------------------------------------------------------------
// Stats update
// ---------------------------------------------------------------------------

/**
 * Update persistent stats after a completed game.
 *
 * @param {string} difficulty
 * @param {number} score
 * @param {number} time
 * @param {number} mistakes
 * @returns {string} A record-breaking message, or empty string.
 */
function updateStats(difficulty, score, time, mistakes, mode = 'classic') {
    const stats = loadStats(mode);
    const ds = stats[difficulty];
    if (!ds) return '';

    let message = '';

    // Games won
    ds.gamesWon++;

    // No-mistake wins
    if (mistakes === 0) {
        ds.noMistakeWins++;
    }

    // Total time
    ds.totalTime += time;

    // Best time
    if (ds.bestTime === 0 || time < ds.bestTime) {
        ds.bestTime = time;
        const diffLabel = DIFFICULTY_LABELS[difficulty] || difficulty;
        message = `${diffLabel} 난이도에서 최고 시간을 경신했습니다: ${formatTime(time)}!`;
    }

    // Streaks
    ds.currentStreak++;
    if (ds.currentStreak > ds.bestStreak) {
        ds.bestStreak = ds.currentStreak;
    }

    // High scores
    const hs = ds.highScores;
    checkAndResetHighScores(hs);

    // Today
    if (score > hs.today) {
        hs.today = score;
    }
    // This week
    if (score > hs.thisWeek) {
        hs.thisWeek = score;
    }
    // This month
    if (score > hs.thisMonth) {
        hs.thisMonth = score;
    }
    // All time
    if (score > hs.allTime) {
        hs.allTime = score;
        if (!message) {
            const diffLabel = DIFFICULTY_LABELS[difficulty] || difficulty;
            message = `${diffLabel} 난이도에서 통산 최고 점수를 경신했습니다!`;
        }
    }

    saveStats(stats, mode);

    return message;
}

/**
 * Update the high-score grid display on the complete screen.
 *
 * @param {string} difficulty
 */
function updateHighScoreDisplay(difficulty, mode = 'classic') {
    if (!screenEl) return;

    const stats = loadStats(mode);
    const hs = stats[difficulty]?.highScores || {};

    const mappings = {
        today: hs.today || 0,
        week: hs.thisWeek || 0,
        month: hs.thisMonth || 0,
        alltime: hs.allTime || 0,
    };

    for (const [key, value] of Object.entries(mappings)) {
        const el = screenEl.querySelector(`[data-hs="${key}"]`);
        if (el) {
            el.textContent = value.toLocaleString();
        }
    }
}

/**
 * Mark a daily challenge date as completed and update streak.
 *
 * @param {string} [dateStr] - The date to mark (YYYY-MM-DD). Defaults to today.
 */
function markDailyCompleted(dateStr) {
    const daily = loadDailyChallenge();
    const todayStr = dateStr || new Date().toISOString().slice(0, 10);

    if (!daily.completed.includes(todayStr)) {
        daily.completed.push(todayStr);
    }

    // Update streak: check if yesterday was also completed
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (daily.completed.includes(yesterdayStr)) {
        daily.streak++;
    } else {
        daily.streak = 1;
    }

    saveDailyChallenge(daily);
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

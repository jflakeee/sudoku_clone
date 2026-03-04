/**
 * Game Complete Screen Controller
 *
 * Displays the end-of-game results: final score (with count-up animation),
 * time, difficulty, high-score table, and confetti celebration.
 *
 * @module screens/complete
 */

import { loadStats, saveStats, clearGame, loadDailyChallenge, saveDailyChallenge, checkAndResetHighScores, saveGameHistory, loadStreak, saveStreak, saveWeekly } from '../utils/storage.js';
import { createConfetti, animateScoreCountUp } from '../ui/animations.js';
import { ConfettiEffect } from '../ui/confetti.js';
import { calculateTimeAttackBonus } from '../core/scorer.js';
import { checkAchievements } from '../utils/achievements.js';
import { calculateGameXP, addXP, getLevelFromXP, loadUserXP } from '../utils/xp.js';
import { generateShareText, shareResult } from '../utils/share.js';
import { encodePuzzle } from '../utils/puzzle-share.js';
import { DIFFICULTY_LABELS } from '../utils/constants.js';

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

/** @type {ConfettiEffect | null} */
let _confettiEffect = null;

/** @type {object | null} */
let _app = null;

/** Cached params for share button. @type {object|null} */
let _lastCompleteParams = null;

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

    // --- Canvas-based confetti ---
    const confettiCanvas = document.getElementById('confetti-canvas');
    if (confettiCanvas) {
        _confettiEffect = new ConfettiEffect(confettiCanvas);
    }

    // --- Button handlers ---
    const newGameBtn = screenEl.querySelector('[data-action="new-game"]');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            _app.navigate('mode-select');
        });
    }

    // --- Share button handler ---
    const shareBtn = document.getElementById('btn-share-result');
    if (shareBtn) {
        shareBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!_lastCompleteParams || !_app?.board) return;

            const { difficulty, mode, time, mistakes } = _lastCompleteParams;
            const variant = _app.board.variant || 'standard';
            const text = generateShareText(_app.board, difficulty, mode, variant, time, mistakes);
            const result = await shareResult(text);

            if (result === 'copied') {
                showShareToast('\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
            } else if (result === 'failed') {
                showShareToast('\uACF5\uC720\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
            }
        });
    }

    // --- Puzzle share button handler ---
    const puzzleShareBtn = document.getElementById('btn-share-puzzle');
    if (puzzleShareBtn) {
        puzzleShareBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!_app?.board) return;

            const board = _app.board;
            const puzzle = board.getInitialPuzzle();
            const solution = board.getSolution();
            if (!puzzle || !solution) return;

            const code = encodePuzzle(puzzle, solution, board.boardSize, board.variant);
            const url = `${window.location.origin}${window.location.pathname}?puzzle=${code}`;

            try {
                await navigator.clipboard.writeText(url);
                showShareToast('\uD37C\uC990 \uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
            } catch {
                showShareToast('\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
            }
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
    const boardSize = _app?.board?.boardSize || 9;
    const variant = _app?.board?.variant || 'standard';
    const recordMessage = updateStats(difficulty, score, time, mistakes, mode, boardSize, variant);

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

    // --- Weekly challenge completion ---
    if (params.isWeekly && success !== false) {
        saveWeekly({
            completed: true,
            time,
            mistakes,
            score,
            week: params.weekNumber || 0,
        });
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
                evenOddMap: board.getEvenOddMap() || null,
                cages: board.getCages() || null,
            };
            saveGameHistory(historyEntry);
        } catch { /* ignore archive errors */ }
    }

    // --- Update streak ---
    let streak = null;
    if (success !== false) {
        streak = updateStreak();
    }

    // --- Display streak on complete screen ---
    const streakEl = screenEl?.querySelector('.complete-streak');
    if (streakEl) {
        if (streak && streak.current > 0) {
            streakEl.textContent = `\uD83D\uDD25 ${streak.current}일 연속!`;
            streakEl.style.display = '';
        } else {
            streakEl.style.display = 'none';
        }
    }

    // --- XP Calculation ---
    if (success !== false) {
        const board = _app?.board;
        const variant = board?.variant || 'standard';
        const boardSize = board?.boardSize || 9;
        const earnedXP = calculateGameXP(difficulty, mode, variant, boardSize, mistakes, time);
        const xpResult = addXP(earnedXP);
        const levelInfo = getLevelFromXP(xpResult.totalXP);
        displayXP(xpResult, levelInfo);
    } else {
        // Hide XP display on failure
        const xpEl = screenEl?.querySelector('.complete-xp');
        if (xpEl) xpEl.style.display = 'none';
    }

    // --- Cache params for share button ---
    _lastCompleteParams = { score, time, difficulty, mistakes, mode, success };

    // --- Clear saved game ---
    clearGame();

    // --- Achievement check ---
    const { newlyUnlocked } = checkAchievements();
    if (newlyUnlocked.length > 0) {
        showAchievementToast(newlyUnlocked[0]);
    }

    // --- Confetti (skip on time-attack failure or animations off) ---
    const animationsOn = _app?.settings?.animations !== false;
    if (animationsOn && (mode !== 'timeAttack' || success)) {
        // Canvas-based confetti
        if (_confettiEffect) {
            _confettiEffect.start(3000);
        }
        // DOM-based confetti fallback
        if (confettiArea) {
            confettiArea.innerHTML = '';
            createConfetti(confettiArea, 50);
        }
    } else {
        if (_confettiEffect) _confettiEffect.stop();
        if (confettiArea) confettiArea.innerHTML = '';
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
// XP display
// ---------------------------------------------------------------------------

/**
 * Update the XP display on the complete screen.
 *
 * @param {{ totalXP: number, level: number, leveledUp: boolean, oldLevel: number, earnedXP: number }} xpResult
 * @param {{ level: number, currentXP: number, nextLevelXP: number, progress: number }} levelInfo
 */
function displayXP(xpResult, levelInfo) {
    const xpEl = screenEl?.querySelector('.complete-xp');
    if (!xpEl) return;

    xpEl.style.display = '';

    const earnedEl = xpEl.querySelector('.xp-earned');
    const levelEl = xpEl.querySelector('.xp-level');
    const barFill = xpEl.querySelector('.xp-bar-fill');
    const levelUpEl = xpEl.querySelector('.xp-levelup');

    if (earnedEl) earnedEl.textContent = `+${xpResult.earnedXP} XP`;
    if (levelEl) levelEl.textContent = `Lv. ${levelInfo.level}`;
    if (barFill) {
        barFill.style.width = '0%';
        // Animate the bar fill after a short delay
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                barFill.style.width = `${Math.round(levelInfo.progress * 100)}%`;
            });
        });
    }

    if (levelUpEl) {
        if (xpResult.leveledUp) {
            levelUpEl.textContent = `\uB808\uBCA8 \uC5C5! Lv. ${xpResult.oldLevel} \u2192 Lv. ${levelInfo.level}`;
            levelUpEl.style.display = '';
        } else {
            levelUpEl.style.display = 'none';
        }
    }
}

// ---------------------------------------------------------------------------
// Share toast
// ---------------------------------------------------------------------------

/**
 * Show a brief toast notification for share result.
 *
 * @param {string} message
 */
function showShareToast(message) {
    const toast = document.getElementById('share-toast');
    if (!toast) return;

    toast.textContent = message;
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
    }, 2000);
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
function updateStats(difficulty, score, time, mistakes, mode = 'classic', boardSize = 9, variant = 'standard') {
    const stats = loadStats(mode, boardSize, variant);
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

    saveStats(stats, mode, boardSize, variant);

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
// Streak update
// ---------------------------------------------------------------------------

/**
 * Update the daily puzzle-solving streak.
 * Called once per successful game completion.
 *
 * @returns {{ current: number, best: number, lastDate: string }}
 */
function updateStreak() {
    const streak = loadStreak();
    const today = new Date().toISOString().slice(0, 10);

    if (streak.lastDate === today) {
        return streak; // already counted today
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (streak.lastDate === yesterday) {
        streak.current += 1;
    } else {
        streak.current = 1;
    }

    streak.best = Math.max(streak.best, streak.current);
    streak.lastDate = today;
    saveStreak(streak);
    return streak;
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

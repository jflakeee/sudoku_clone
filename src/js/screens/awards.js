/**
 * Awards Screen
 *
 * Displays trophies earned from daily challenges organised by year and month,
 * and a challenges tab for achievement-style progress.
 *
 * @module screens/awards
 */

import { loadDailyChallenge, loadStats } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월',
];

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {string} Currently active tab: 'trophies' or 'challenges' */
let _activeTab = 'trophies';

/** @type {number} Currently displayed year */
let _displayYear = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count completed daily challenges per month for a given year.
 *
 * @param {number} year
 * @returns {number[]} Array of 12 counts (index 0 = January).
 */
function countTrophiesByMonth(year) {
    const dailyData = loadDailyChallenge();
    const counts = new Array(12).fill(0);

    dailyData.completed.forEach((dateStr) => {
        const parts = dateStr.split('-').map(Number);
        if (parts[0] === year) {
            counts[parts[1] - 1]++;
        }
    });

    return counts;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the trophies grid showing monthly trophy counts.
 */
function renderTrophies() {
    const grid = document.getElementById('awards-months-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const counts = countTrophiesByMonth(_displayYear);

    counts.forEach((count, i) => {
        const item = document.createElement('div');
        item.className = 'award-month';

        const icon = document.createElement('span');
        icon.className = 'award-month-icon';
        icon.textContent = '\uD83C\uDFC6';

        const label = document.createElement('span');
        label.className = 'award-month-label';
        label.textContent = MONTH_NAMES[i];

        const value = document.createElement('span');
        value.className = 'award-month-count';
        value.textContent = String(count);

        if (count > 0) {
            item.classList.add('has-awards');
        }

        item.appendChild(icon);
        item.appendChild(label);
        item.appendChild(value);
        grid.appendChild(item);
    });

    // Update year label
    const yearLabel = document.querySelector('#screen-awards .awards-year-label');
    if (yearLabel) {
        yearLabel.textContent = String(_displayYear);
    }
}

/**
 * Render the challenges tab content.
 */
function renderChallenges() {
    const grid = document.getElementById('awards-months-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const dailyData = loadDailyChallenge();
    const totalCompleted = dailyData.completed.length;
    const currentStreak = dailyData.streak;

    // Compute overall stats across all difficulties
    const allStats = loadStats();
    let totalWins = 0;
    let totalNoMistake = 0;
    let bestOverallStreak = 0;
    for (const diff of Object.values(allStats)) {
        totalWins += diff.gamesWon || 0;
        totalNoMistake += diff.noMistakeWins || 0;
        if ((diff.bestStreak || 0) > bestOverallStreak) {
            bestOverallStreak = diff.bestStreak;
        }
    }

    const achievements = [
        { icon: '\uD83C\uDF1F', title: '첫 도전', desc: '일일 도전 1회 완료', done: totalCompleted >= 1 },
        { icon: '\u2694\uFE0F', title: '주간 전사', desc: '일일 도전 7회 완료', done: totalCompleted >= 7 },
        { icon: '\uD83D\uDC51', title: '월간 마스터', desc: '일일 도전 30회 완료', done: totalCompleted >= 30 },
        { icon: '\uD83D\uDD25', title: '연승 3일', desc: '3일 연속 도전 완료', done: currentStreak >= 3 },
        { icon: '\u26A1', title: '연승 7일', desc: '7일 연속 도전 완료', done: currentStreak >= 7 },
        { icon: '\uD83C\uDF0B', title: '연승 30일', desc: '30일 연속 도전 완료', done: currentStreak >= 30 },
        { icon: '\uD83C\uDFC5', title: '10승 달성', desc: '총 10번 승리', done: totalWins >= 10 },
        { icon: '\uD83D\uDCAF', title: '완벽주의자', desc: '실수 없이 5번 승리', done: totalNoMistake >= 5 },
    ];

    achievements.forEach((ach) => {
        const item = document.createElement('div');
        item.className = 'award-month challenge-item';
        if (ach.done) item.classList.add('achieved');

        const icon = document.createElement('span');
        icon.className = 'award-month-icon';
        icon.textContent = ach.icon;

        const title = document.createElement('span');
        title.className = 'award-month-label';
        title.textContent = ach.title;

        const desc = document.createElement('span');
        desc.className = 'award-month-count';
        desc.style.fontSize = '0.65rem';
        desc.textContent = ach.done ? '\u2705 달성' : ach.desc;

        item.appendChild(icon);
        item.appendChild(title);
        item.appendChild(desc);
        grid.appendChild(item);
    });
}

/**
 * Render the current tab content.
 */
function renderContent() {
    if (_activeTab === 'trophies') {
        renderTrophies();
    } else {
        renderChallenges();
    }
}

/**
 * Update active tab styling.
 */
function updateTabUI() {
    const tabs = document.querySelectorAll('#screen-awards .awards-tab');
    tabs.forEach((tab) => {
        if (tab.getAttribute('data-tab') === _activeTab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Show/hide year navigation for trophies tab
    const yearEl = document.querySelector('#screen-awards .awards-year');
    if (yearEl) {
        yearEl.style.display = _activeTab === 'trophies' ? '' : 'none';
    }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle tab switching.
 *
 * @param {Event} e
 */
function onTabClick(e) {
    const tab = e.target.closest('.awards-tab');
    if (!tab) return;

    const tabName = tab.getAttribute('data-tab');
    if (tabName && (tabName === 'trophies' || tabName === 'challenges')) {
        _activeTab = tabName;
        updateTabUI();
        renderContent();
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the awards screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initAwardsScreen(app) {
    _app = app;
    _activeTab = 'trophies';
    _displayYear = new Date().getFullYear();

    // Tab switching
    const tabsContainer = document.querySelector('#screen-awards .awards-tabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', onTabClick);
    }

    updateTabUI();
    renderContent();

    // Re-render when the screen becomes visible
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'awards') {
            renderContent();
        }
    });
}

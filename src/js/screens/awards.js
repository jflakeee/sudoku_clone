/**
 * Awards Screen
 *
 * Displays trophies earned from daily challenges organised by year and month,
 * and a challenges tab for achievement-style progress with categories.
 *
 * @module screens/awards
 */

import { loadDailyChallenge } from '../utils/storage.js';
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS, loadUnlocked } from '../utils/achievements.js';

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
 * Render the challenges tab content with categories and progress bar.
 */
function renderChallenges() {
    const grid = document.getElementById('awards-months-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const unlocked = loadUnlocked();
    const totalCount = ACHIEVEMENTS.length;
    const unlockedCount = ACHIEVEMENTS.filter(a => !!unlocked[a.id]).length;

    // --- Progress bar ---
    const progressEl = document.createElement('div');
    progressEl.className = 'achievements-progress';

    const progressLabel = document.createElement('span');
    progressLabel.className = 'achievements-progress-label';
    progressLabel.textContent = `${unlockedCount}/${totalCount} 달성`;

    const progressBarOuter = document.createElement('div');
    progressBarOuter.className = 'achievements-progress-bar';

    const progressBarFill = document.createElement('div');
    progressBarFill.className = 'achievements-progress-fill';
    progressBarFill.style.width = `${totalCount > 0 ? (unlockedCount / totalCount * 100) : 0}%`;

    progressBarOuter.appendChild(progressBarFill);
    progressEl.appendChild(progressLabel);
    progressEl.appendChild(progressBarOuter);
    grid.appendChild(progressEl);

    // --- Categories ---
    for (const cat of ACHIEVEMENT_CATEGORIES) {
        const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat.key);
        if (catAchievements.length === 0) continue;

        // Category header
        const header = document.createElement('div');
        header.className = 'achievements-category-header';
        header.textContent = cat.label;
        grid.appendChild(header);

        // Achievement items grid
        const itemsGrid = document.createElement('div');
        itemsGrid.className = 'achievements-items-grid';

        for (const ach of catAchievements) {
            const isUnlocked = !!unlocked[ach.id];

            const item = document.createElement('div');
            item.className = 'award-month challenge-item';
            if (isUnlocked) item.classList.add('achieved');

            const icon = document.createElement('span');
            icon.className = 'award-month-icon';
            icon.textContent = ach.icon;

            const title = document.createElement('span');
            title.className = 'award-month-label';
            title.textContent = ach.title;

            const desc = document.createElement('span');
            desc.className = 'award-month-count';
            desc.style.fontSize = '0.65rem';
            desc.textContent = isUnlocked ? '\u2705 달성' : ach.desc;

            item.appendChild(icon);
            item.appendChild(title);
            item.appendChild(desc);
            itemsGrid.appendChild(item);
        }

        grid.appendChild(itemsGrid);
    }
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

    // Year navigation
    const prevYearBtn = document.querySelector('#screen-awards .awards-year-prev');
    const nextYearBtn = document.querySelector('#screen-awards .awards-year-next');
    if (prevYearBtn) {
        prevYearBtn.addEventListener('click', () => {
            _displayYear--;
            renderContent();
        });
    }
    if (nextYearBtn) {
        nextYearBtn.addEventListener('click', () => {
            if (_displayYear < new Date().getFullYear()) {
                _displayYear++;
                renderContent();
            }
        });
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

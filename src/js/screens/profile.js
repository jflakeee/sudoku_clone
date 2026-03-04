/**
 * Profile (Me) Screen
 *
 * Handles navigation from the profile menu items. Each menu item has a
 * `data-navigate` attribute pointing to the target screen name. Clicking
 * a menu item calls `app.navigate()` with that screen name.
 *
 * Also manages the title selector and solve time chart.
 *
 * @module screens/profile
 */

import { loadUserXP, getLevelFromXP } from '../utils/xp.js';
import { loadGameHistory } from '../utils/storage.js';
import { getAllTitles, getUnlockedTitles, getActiveTitle, setActiveTitle, getActiveTitleLabel } from '../utils/titles.js';
import { loadUnlocked } from '../utils/achievements.js';
import { TimeChart } from '../ui/time-chart.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {TimeChart|null} */
let _timeChart = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the profile screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initProfileScreen(app) {
    _app = app;
    // Menu item navigation is handled by the global data-navigate click handler in app.js.

    // --- Title selector toggle ---
    const screenEl = document.getElementById('screen-profile');
    if (screenEl) {
        const toggleBtn = screenEl.querySelector('[data-action="toggle-title-selector"]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const selector = screenEl.querySelector('.title-selector');
                if (selector) {
                    const isHidden = selector.style.display === 'none';
                    selector.style.display = isHidden ? '' : 'none';
                    if (isHidden) renderTitleGrid();
                }
            });
        }

        // Title grid click delegation
        const titleGrid = screenEl.querySelector('.title-grid');
        if (titleGrid) {
            titleGrid.addEventListener('click', (e) => {
                const item = e.target.closest('.title-item');
                if (!item || item.classList.contains('title-locked')) return;
                const titleId = item.dataset.titleId;
                if (titleId) {
                    setActiveTitle(titleId);
                    refreshTitle();
                    renderTitleGrid();
                }
            });
        }
    }

    // --- Initialize time chart ---
    const canvas = document.getElementById('time-chart');
    if (canvas) {
        _timeChart = new TimeChart(canvas);
    }

    // --- Update display when profile screen is shown ---
    document.addEventListener('screen-show', (e) => {
        if (/** @type {CustomEvent} */ (e).detail.screen === 'profile') {
            refreshXP();
            refreshTitle();
            refreshTimeChart();
        }
    });
}

// ---------------------------------------------------------------------------
// Internal: refresh XP display
// ---------------------------------------------------------------------------

/**
 * Update the XP card on the profile screen.
 */
function refreshXP() {
    const screenEl = document.getElementById('screen-profile');
    if (!screenEl) return;

    const xpData = loadUserXP();
    const levelInfo = getLevelFromXP(xpData.totalXP);

    const levelNum = screenEl.querySelector('.profile-level-number');
    const xpText = screenEl.querySelector('.profile-xp-text');
    const barFill = screenEl.querySelector('.profile-xp-bar-fill');

    if (levelNum) levelNum.textContent = String(levelInfo.level);
    if (xpText) xpText.textContent = `${levelInfo.currentXP} / ${levelInfo.nextLevelXP} XP`;
    if (barFill) barFill.style.width = `${Math.round(levelInfo.progress * 100)}%`;
}

// ---------------------------------------------------------------------------
// Internal: refresh title display
// ---------------------------------------------------------------------------

/**
 * Update the current title label on the profile screen.
 */
function refreshTitle() {
    const screenEl = document.getElementById('screen-profile');
    if (!screenEl) return;

    const titleLabel = screenEl.querySelector('.current-title-label');
    if (titleLabel) {
        titleLabel.textContent = getActiveTitleLabel();
    }
}

/**
 * Render the title grid with unlocked/locked states.
 */
function renderTitleGrid() {
    const screenEl = document.getElementById('screen-profile');
    if (!screenEl) return;

    const grid = screenEl.querySelector('.title-grid');
    if (!grid) return;

    const xpData = loadUserXP();
    const levelInfo = getLevelFromXP(xpData.totalXP);
    const achievements = loadUnlocked();
    const unlocked = getUnlockedTitles(levelInfo.level, achievements);
    const unlockedIds = new Set(unlocked.map(t => t.id));
    const activeId = getActiveTitle();
    const allTitles = getAllTitles();

    grid.innerHTML = '';

    allTitles.forEach(t => {
        const isUnlocked = unlockedIds.has(t.id);
        const isActive = t.id === activeId;

        const item = document.createElement('div');
        item.className = `title-item${isUnlocked ? '' : ' title-locked'}${isActive ? ' title-active' : ''}`;
        item.dataset.titleId = t.id;

        const condition = t.minLevel
            ? `Lv. ${t.minLevel} 달성`
            : t.requires
                ? '업적 달성'
                : '';

        item.innerHTML = `
            <div class="title-item-label">${t.label}</div>
            <div class="title-item-desc">${isUnlocked ? t.description : condition}</div>
        `;

        grid.appendChild(item);
    });
}

// ---------------------------------------------------------------------------
// Internal: refresh time chart
// ---------------------------------------------------------------------------

/**
 * Redraw the time chart with recent game data.
 */
function refreshTimeChart() {
    if (!_timeChart) return;

    const history = loadGameHistory();
    // Take recent 20 games, in chronological order
    const recent = history.slice(0, 20).reverse();
    const data = recent.map(entry => ({
        date: entry.date || '',
        time: entry.time || 0,
    }));

    _timeChart.draw(data);
}

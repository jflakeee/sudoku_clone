/**
 * App Entry Point & Screen Router
 *
 * Bootstraps the Sudoku application: initialises all UI components,
 * registers screen controllers, and provides navigation between screens.
 *
 * Loaded as the sole ES Module entry point from index.html.
 *
 * @module app
 */

import { Board } from './game/board.js';
import { InputHandler } from './game/input.js';
import { GridUI } from './ui/grid.js';
import { HighlightUI } from './ui/highlight.js';
import { NumberpadUI } from './ui/numberpad.js';
import { ToolbarUI } from './ui/toolbar.js';
import { loadSettings, saveSettings, loadGame, saveGame, loadStats, saveStats } from './utils/storage.js';
import { SoundManager } from './utils/sound.js';
import { initMainScreen } from './screens/main.js';
import { initGameScreen } from './screens/game.js';
import { initCompleteScreen } from './screens/complete.js';
import { initDailyScreen } from './screens/daily.js';
import { initProfileScreen } from './screens/profile.js';
import { initStatsScreen } from './screens/stats.js';
import { initAwardsScreen } from './screens/awards.js';
import { initSettingsScreen } from './screens/settings.js';
import { initTutorialScreen } from './screens/tutorial.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Screens that show the bottom navbar (main tab screens). */
const NAVBAR_SCREENS = new Set(['main', 'daily', 'profile']);

/** Auto-save interval in milliseconds. */
const AUTO_SAVE_INTERVAL = 30_000;

/** Difficulty label map (key → Korean). */
const DIFFICULTY_LABELS = {
    easy: '쉬움',
    medium: '보통',
    normal: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

/**
 * The global application object exposed to all screen controllers.
 * Populated during `init()`.
 */
const app = {
    /** Navigate to a named screen with optional parameters. */
    navigate: null,
    /** Go back to the previous screen. */
    goBack: null,

    // Game logic
    /** @type {Board | null} */
    board: null,
    /** @type {InputHandler | null} */
    input: null,

    // UI components
    /** @type {GridUI | null} */
    gridUI: null,
    /** @type {HighlightUI | null} */
    highlightUI: null,
    /** @type {NumberpadUI | null} */
    numberpadUI: null,
    /** @type {ToolbarUI | null} */
    toolbarUI: null,

    // Persistent data helpers (re-exported for convenience)
    settings: null,
    sound: null,

    // Utility references
    DIFFICULTY_LABELS,
};

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** @type {string[]} Screen history stack for back navigation. */
let screenHistory = [];

/** @type {string} Currently active screen name. */
let currentScreen = 'main';

/** @type {number | null} Auto-save interval id. */
let autoSaveId = null;

/**
 * Navigate to a screen.
 *
 * @param {string} screenName - Target screen identifier (e.g. 'main', 'game').
 * @param {object}  [params]  - Optional parameters forwarded to the screen's
 *                               `onShow` handler.
 */
function navigate(screenName, params) {
    const target = document.getElementById(`screen-${screenName}`);
    if (!target) {
        console.warn(`[app] Unknown screen: ${screenName}`);
        return;
    }

    // Push current screen to history (unless navigating to same)
    if (currentScreen && currentScreen !== screenName) {
        screenHistory.push(currentScreen);
    }

    showScreen(screenName, params);
}

/**
 * Go back to the previous screen in the history stack.
 */
function goBack() {
    const prev = screenHistory.pop();
    if (prev) {
        showScreen(prev);
    } else {
        showScreen('main');
    }
}

/**
 * Internal helper: activate a screen, hide all others, update navbar.
 *
 * @param {string} screenName
 * @param {object} [params]
 */
function showScreen(screenName, params) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    // Show target screen
    const target = document.getElementById(`screen-${screenName}`);
    if (target) {
        target.classList.add('active');
    }

    currentScreen = screenName;

    // Navbar visibility & active tab
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = NAVBAR_SCREENS.has(screenName) ? '' : 'none';

        // Update active tab
        navbar.querySelectorAll('.nav-tab').forEach(tab => {
            const tabTarget = tab.getAttribute('data-navigate');
            tab.classList.toggle('active', tabTarget === screenName);
        });
    }

    // Dispatch custom event that screens can listen on
    document.dispatchEvent(new CustomEvent('screen-show', {
        detail: { screen: screenName, params: params || {} },
    }));

    // Auto-save management: only active when on game screen
    manageAutoSave(screenName);
}

/**
 * Start or stop the periodic auto-save depending on the active screen.
 *
 * @param {string} screenName
 */
function manageAutoSave(screenName) {
    if (screenName === 'game') {
        if (!autoSaveId) {
            autoSaveId = setInterval(() => {
                try {
                    if (app.board) {
                        saveGame(app.board.toJSON());
                    }
                } catch { /* ignore save failures */ }
            }, AUTO_SAVE_INTERVAL);
        }
    } else {
        if (autoSaveId) {
            clearInterval(autoSaveId);
            autoSaveId = null;
        }
    }
}

// ---------------------------------------------------------------------------
// Difficulty modal
// ---------------------------------------------------------------------------

/**
 * Show the difficulty selection modal.
 */
function showDifficultyModal() {
    const modal = document.getElementById('difficulty-modal');
    if (modal) modal.style.display = '';
}

/**
 * Hide the difficulty selection modal.
 */
function hideDifficultyModal() {
    const modal = document.getElementById('difficulty-modal');
    if (modal) modal.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Pause overlay
// ---------------------------------------------------------------------------

/**
 * Show the pause overlay and pause the game timer.
 */
function showPauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = '';
    if (app.board && app.board.timer) {
        app.board.timer.pause();
    }
}

/**
 * Hide the pause overlay and resume the game timer.
 */
function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = 'none';
    if (app.board && app.board.timer) {
        app.board.timer.start();
    }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Bootstrap the entire application.  Called once on DOMContentLoaded.
 */
function init() {
    // ----- Settings & sound -----
    app.settings = loadSettings();

    try {
        app.sound = new SoundManager(app.settings);
    } catch {
        app.sound = null;
    }

    // ----- Core game instances -----
    app.board = new Board();
    app.input = new InputHandler(app.board);

    // ----- UI components -----
    const gridEl = document.getElementById('sudoku-grid');
    const numpadEl = document.getElementById('numberpad');
    const toolbarEl = document.querySelector('.toolbar');

    app.gridUI = new GridUI(gridEl);
    app.highlightUI = new HighlightUI(app.gridUI);
    app.numberpadUI = new NumberpadUI(numpadEl);
    app.toolbarUI = new ToolbarUI(toolbarEl);

    // ----- Navigation helpers on the app object -----
    app.navigate = navigate;
    app.goBack = goBack;
    app.showDifficultyModal = showDifficultyModal;
    app.hideDifficultyModal = hideDifficultyModal;
    app.showPauseOverlay = showPauseOverlay;
    app.hidePauseOverlay = hidePauseOverlay;

    // ----- Initialise screen controllers -----
    initMainScreen(app);
    initGameScreen(app);
    initCompleteScreen(app);
    initDailyScreen(app);
    initProfileScreen(app);
    initStatsScreen(app);
    initAwardsScreen(app);
    initSettingsScreen(app);
    initTutorialScreen(app);

    // ----- Global event delegation -----
    document.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target.closest('[data-navigate]'));
        if (target) {
            const screen = target.getAttribute('data-navigate');
            // Let individual screens handle special cases via their own listeners
            // but also do generic navigation
            navigate(screen);
            return;
        }

        const actionTarget = /** @type {HTMLElement} */ (e.target.closest('[data-action]'));
        if (actionTarget) {
            const action = actionTarget.getAttribute('data-action');
            handleGlobalAction(action, actionTarget);
        }
    });

    // ----- Difficulty modal events -----
    const difficultyModal = document.getElementById('difficulty-modal');
    if (difficultyModal) {
        // Click overlay background to close
        difficultyModal.addEventListener('click', (e) => {
            if (e.target === difficultyModal) {
                hideDifficultyModal();
            }
        });

        // Difficulty option selected
        difficultyModal.querySelectorAll('.difficulty-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const difficulty = btn.getAttribute('data-difficulty');
                hideDifficultyModal();
                navigate('game', { difficulty, daily: false, loadSaved: false });
            });
        });
    }

    // ----- Initial screen -----
    showScreen('main');
}

/**
 * Handle global data-action clicks that are not screen-specific.
 *
 * @param {string} action
 * @param {HTMLElement} target
 */
function handleGlobalAction(action, target) {
    switch (action) {
        case 'back':
            goBack();
            break;

        case 'new-game':
            showDifficultyModal();
            break;

        case 'pause':
            showPauseOverlay();
            break;

        case 'resume':
            hidePauseOverlay();
            break;

        // Toolbar actions are handled by InputHandler / ToolbarUI,
        // but we provide sound feedback here.
        case 'undo':
        case 'erase':
        case 'notes':
        case 'hint':
            // Handled by screen-specific logic; no global override needed.
            break;

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

// Expose for screen modules
export default app;

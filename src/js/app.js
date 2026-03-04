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
import { loadSettings, saveSettings, loadGame, saveGame, loadStats, saveStats, migrateStorageIfNeeded } from './utils/storage.js';
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
import { initModeSelectScreen } from './screens/mode-select.js';
import { initRankingScreen } from './screens/ranking.js';
import { initHistoryScreen } from './screens/history.js';
import { initPrintScreen } from './screens/print.js';
import { generatePuzzle } from './core/generator.js';
import { decodePuzzle } from './utils/puzzle-share.js';
import { setLocale } from './utils/i18n.js';

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

    // Pending mode parameters from mode-select screen
    _pendingModeParams: {},

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

/** @type {number} Screen transition generation counter to invalidate stale cleanups. */
let transitionGen = 0;

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

    showScreen(screenName, params, 'forward');
}

/**
 * Go back to the previous screen in the history stack.
 */
function goBack() {
    const prev = screenHistory.pop();
    if (prev) {
        showScreen(prev, undefined, 'back');
    } else {
        showScreen('main', undefined, 'back');
    }
}

/**
 * Internal helper: activate a screen, hide all others, update navbar.
 *
 * @param {string} screenName
 * @param {object} [params]
 * @param {string} [direction] - 'forward', 'back', or undefined (no animation).
 */
function showScreen(screenName, params, direction) {
    const target = document.getElementById(`screen-${screenName}`);

    // Clear any in-progress animations first to prevent race conditions
    const animClasses = ['screen-enter', 'screen-exit', 'screen-enter-back', 'screen-exit-back'];
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove(...animClasses);
        if (s.id !== `screen-${screenName}`) {
            s.classList.remove('active');
        }
    });

    const prevScreenEl = currentScreen
        ? document.getElementById(`screen-${currentScreen}`)
        : null;

    // Skip animation for navbar-tab switches between main tabs
    const isTabSwitch = NAVBAR_SCREENS.has(screenName) && NAVBAR_SCREENS.has(currentScreen);

    // Increment generation to invalidate any pending cleanup from prior transition
    const gen = ++transitionGen;

    if (direction && prevScreenEl && target && prevScreenEl !== target && !isTabSwitch) {
        // Animate transition
        const enterClass = direction === 'back' ? 'screen-enter-back' : 'screen-enter';
        const exitClass = direction === 'back' ? 'screen-exit-back' : 'screen-exit';

        // Show both for the duration of the animation
        prevScreenEl.classList.add('active');
        target.classList.add('active', enterClass);
        prevScreenEl.classList.add(exitClass);

        const cleanup = () => {
            // Skip if a newer transition has started
            if (gen !== transitionGen) return;
            prevScreenEl.classList.remove('active', exitClass);
            target.classList.remove(enterClass);
        };

        target.addEventListener('animationend', cleanup, { once: true });
        // Fallback cleanup
        setTimeout(cleanup, 350);
    } else {
        // No animation: just switch
        if (target) {
            target.classList.add('active');
        }
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
 *
 * @param {object} [modeParams] - Optional mode parameters from mode-select screen.
 */
function showDifficultyModal(modeParams) {
    if (modeParams) {
        app._pendingModeParams = modeParams;
    }
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
    // ----- Settings & migration -----
    app.settings = loadSettings();
    migrateStorageIfNeeded();

    // Apply dark mode from saved settings
    if (app.settings.darkMode) {
        document.body.classList.add('dark-mode');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#1E1E30');
    }

    // Apply saved theme
    document.body.setAttribute('data-theme', app.settings.theme || 'default');

    // Apply saved locale
    setLocale(app.settings.locale || 'ko');

    // Apply high contrast mode from saved settings
    if (app.settings.highContrast) {
        document.body.classList.add('high-contrast');
    }

    try {
        app.sound = new SoundManager(app.settings);
    } catch {
        app.sound = null;
    }

    // ----- Core game instances -----
    app.board = new Board();
    app.input = new InputHandler(app.board, app.settings);

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
    initModeSelectScreen(app);
    initRankingScreen(app);
    initHistoryScreen(app);
    initPrintScreen(app);

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

    // ----- Keyboard input (PC) -----
    document.addEventListener('keydown', (e) => {
        // Only handle keys when on the game screen
        if (currentScreen !== 'game') return;
        // Ignore if a modal/overlay is visible
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay && pauseOverlay.style.display !== 'none') return;
        const diffModal = document.getElementById('difficulty-modal');
        if (diffModal && diffModal.style.display !== 'none') return;

        const key = e.key;

        // Number keys 1-9 (keyboard only supports up to 9)
        const maxNum = app.board?.boardSize || 9;
        if (key >= '1' && key <= '9' && parseInt(key, 10) <= maxNum) {
            e.preventDefault();
            if (app.input) {
                app.input.inputNumber(parseInt(key, 10));
                try { app.sound?.play('place'); } catch { /* ignore */ }
            }
            return;
        }

        // Arrow keys - move selection
        if (key.startsWith('Arrow') && app.input && app.board) {
            e.preventDefault();
            const boardSize = app.board.boardSize || 9;
            const midIdx = Math.floor(boardSize / 2);
            const maxIdx = boardSize - 1;
            const sel = app.input.getSelectedCell();
            let row = sel ? sel.row : midIdx;
            let col = sel ? sel.col : midIdx;

            switch (key) {
                case 'ArrowUp':    row = Math.max(0, row - 1); break;
                case 'ArrowDown':  row = Math.min(maxIdx, row + 1); break;
                case 'ArrowLeft':  col = Math.max(0, col - 1); break;
                case 'ArrowRight': col = Math.min(maxIdx, col + 1); break;
            }

            app.input.selectCell(row, col);
            if (app.highlightUI) {
                app.highlightUI.highlightSelection(row, col, app.board.getBoard());
            }
            if (app.numberpadUI) {
                app.numberpadUI.highlightNumber(app.board.getCellValue(row, col));
            }
            try { app.sound?.play('tap'); } catch { /* ignore */ }
            return;
        }

        // Backspace/Delete - erase
        if (key === 'Backspace' || key === 'Delete') {
            e.preventDefault();
            if (app.input) {
                app.input.erase();
                try { app.sound?.play('tap'); } catch { /* ignore */ }
            }
            return;
        }

        // Ctrl+Z - undo
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            e.preventDefault();
            if (app.input) {
                app.input.undo();
                try { app.sound?.play('undo'); } catch { /* ignore */ }
            }
            return;
        }

        // N - toggle notes
        if (key === 'n' || key === 'N') {
            e.preventDefault();
            if (app.input) {
                const isOn = app.input.toggleNotes();
                if (app.toolbarUI) {
                    app.toolbarUI.setNoteMode(isOn);
                }
            }
            return;
        }

        // H - hint
        if (key === 'h' || key === 'H') {
            e.preventDefault();
            if (app.input) {
                app.input.useHint();
            }
            return;
        }

        // Tab / Shift+Tab - move to next/previous empty cell
        if (key === 'Tab' && app.input && app.board) {
            e.preventDefault();
            const boardSize = app.board.boardSize || 9;
            const sel = app.input.getSelectedCell();
            let row = sel ? sel.row : 0;
            let col = sel ? sel.col : -1;
            const forward = !e.shiftKey;
            const totalCells = boardSize * boardSize;
            let startIdx = row * boardSize + col;

            for (let i = 0; i < totalCells; i++) {
                startIdx = forward ? startIdx + 1 : startIdx - 1;
                if (startIdx >= totalCells) startIdx = 0;
                if (startIdx < 0) startIdx = totalCells - 1;

                const r = Math.floor(startIdx / boardSize);
                const c = startIdx % boardSize;
                if (app.board.isEmpty(r, c) && !app.board.isGiven(r, c)) {
                    app.input.selectCell(r, c);
                    if (app.highlightUI) {
                        app.highlightUI.highlightSelection(r, c, app.board.getBoard());
                    }
                    if (app.numberpadUI) {
                        app.numberpadUI.highlightNumber(0);
                    }
                    // Focus the cell element for screen readers
                    if (app.gridUI) {
                        const cellEl = app.gridUI.getCell(r, c);
                        if (cellEl) cellEl.focus();
                    }
                    break;
                }
            }
            return;
        }

        // Escape - deselect
        if (key === 'Escape') {
            e.preventDefault();
            if (app.input) {
                app.input.selectCell(-1, -1);
            }
            if (app.highlightUI) {
                app.highlightUI.clearAll();
            }
            if (app.numberpadUI) {
                app.numberpadUI.clearHighlight();
            }
            return;
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

        // Recommended durations per difficulty for time-attack mode (seconds)
        const RECOMMENDED_DURATION = {
            easy: 600,
            normal: 900,
            hard: 1200,
            expert: 1500,
            master: 1800,
        };

        // Difficulty option selected
        difficultyModal.querySelectorAll('.difficulty-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const difficulty = btn.getAttribute('data-difficulty');
                hideDifficultyModal();

                const params = { difficulty, daily: false, loadSaved: false, ...app._pendingModeParams };

                if (params.forPrint) {
                    // Print mode: generate N puzzles and navigate to print screen
                    const count = params.printCount || 1;
                    const boardSize = params.boardSize || 9;
                    const variant = params.variant || 'standard';
                    const entries = [];
                    for (let i = 0; i < count; i++) {
                        const puzzle = generatePuzzle(difficulty, boardSize, null, variant);
                        entries.push({
                            id: 'print-' + Date.now() + '-' + i,
                            puzzle: puzzle.board,
                            solution: puzzle.solution,
                            boardSize,
                            difficulty,
                            variant,
                        });
                    }
                    navigate('print', { entries });
                } else {
                    // Apply recommended duration for time-attack if user didn't pick a custom time
                    if (params.mode === 'timeAttack' && params.duration === 600 && RECOMMENDED_DURATION[difficulty]) {
                        params.duration = RECOMMENDED_DURATION[difficulty];
                    }

                    navigate('game', params);
                }
                // Remove mode-select from history so back from game/print goes to main
                screenHistory = screenHistory.filter(s => s !== 'mode-select');
                app._pendingModeParams = {};
            });
        });
    }

    // ----- Check for shared puzzle URL parameter -----
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleCode = urlParams.get('puzzle');
    if (puzzleCode) {
        const decoded = decodePuzzle(puzzleCode);
        if (decoded) {
            // Clean the URL without reload
            window.history.replaceState({}, '', window.location.pathname);
            showScreen('main');
            navigate('game', {
                sharedPuzzle: decoded,
                difficulty: 'normal',
                mode: 'classic',
                boardSize: decoded.boardSize,
                variant: decoded.variant,
            });
            return;
        }
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
            navigate('mode-select');
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
        case 'marking':
            // Handled by screen-specific logic; no global override needed.
            break;

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// PWA Install Prompt
// ---------------------------------------------------------------------------

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'flex';
});

document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('btn-install');
    if (installBtn) {
        installBtn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => {
                    const banner = document.getElementById('install-banner');
                    if (banner) banner.style.display = 'none';
                    deferredPrompt = null;
                });
            }
        });
    }

    const dismissBtn = document.getElementById('btn-install-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            const banner = document.getElementById('install-banner');
            if (banner) banner.style.display = 'none';
            deferredPrompt = null;
        });
    }
});

// ---------------------------------------------------------------------------
// Service Worker registration
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // SW registration failed – app works fine without it.
        });
    });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

// Expose for screen modules
export default app;

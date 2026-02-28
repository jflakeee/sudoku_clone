/**
 * Game Screen Controller
 *
 * Manages the active game play screen: puzzle lifecycle, timer, score,
 * mistakes, toolbar interactions, and game-over / completion flow.
 *
 * @module screens/game
 */

import { loadGame, saveGame, clearGame, loadStats, saveStats } from '../utils/storage.js';
import { animateCompletionWave } from '../ui/animations.js';

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
let scoreValueEl = null;
/** @type {HTMLElement | null} */
let difficultyValueEl = null;
/** @type {HTMLElement | null} */
let mistakesValueEl = null;
/** @type {HTMLElement | null} */
let timerValueEl = null;
/** @type {HTMLElement | null} */
let hintBadgeEl = null;

// ---------------------------------------------------------------------------
// Game-level state
// ---------------------------------------------------------------------------

/** @type {boolean} Whether the current game is a daily challenge. */
let isDaily = false;

/** @type {string|null} Daily challenge date string (YYYY-MM-DD). */
let dailyDate = null;

/** @type {object | null} Reference to global app object. */
let _app = null;

/** @type {number} Locked number for number-first input mode (0 = none). */
let lockedNumber = 0;

/** @type {object | null} Wake Lock sentinel for auto-lock prevention. */
let wakeLockSentinel = null;

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------

/**
 * Initialise the game screen controller.
 *
 * @param {object} app - Global app reference.
 */
export function initGameScreen(app) {
    _app = app;

    screenEl = document.getElementById('screen-game');
    if (!screenEl) return;

    scoreValueEl = screenEl.querySelector('.score-value');
    difficultyValueEl = screenEl.querySelector('.difficulty-value');
    mistakesValueEl = screenEl.querySelector('.mistakes-value');
    timerValueEl = screenEl.querySelector('.timer-value');
    hintBadgeEl = screenEl.querySelector('.tool-badge');

    // --- Toolbar button handlers (via event delegation on toolbar) ---
    const toolbar = screenEl.querySelector('.toolbar');
    if (toolbar) {
        toolbar.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement} */ (e.target.closest('[data-action]'));
            if (!btn) return;
            e.stopPropagation(); // prevent global handler from double-firing
            const action = btn.getAttribute('data-action');
            handleToolbarAction(action);
        });
    }

    // --- Screen show listener ---
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'game') {
            onShow(detail.params || {});
            requestWakeLock();
        } else {
            // Pause timer if we leave the game screen
            if (_app.board && _app.board.timer) {
                _app.board.timer.pause();
            }
            releaseWakeLock();
        }
    });

    // --- Re-acquire wake lock on visibility change (tab refocus) ---
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen && activeScreen.id === 'screen-game') {
                requestWakeLock();
            }
        }
    });

    // --- Wire up InputHandler events (dispatched on document as CustomEvents) ---
    document.addEventListener('cell-updated', (e) => onCellUpdated(e.detail));
    document.addEventListener('score-changed', (e) => onScoreChanged(e.detail));
    document.addEventListener('mistake', (e) => onMistake(e.detail));
    document.addEventListener('game-complete', (e) => onGameComplete(e.detail));
    document.addEventListener('hint-used', (e) => onHintUsed(e.detail));

    // --- Grid cell selection (forward to InputHandler) ---
    if (app.gridUI) {
        app.gridUI.onCellClick((row, col) => {
            if (app.input) {
                app.input.selectCell(row, col);
            }
            if (app.highlightUI) {
                app.highlightUI.highlightSelection(row, col, app.board.getBoard());
            }
            // Number-first mode: auto-input locked number on cell click
            if (_app.settings.numberFirst && lockedNumber > 0 && app.input) {
                app.input.inputNumber(lockedNumber);
                try { app.sound?.play('place'); } catch { /* ignore */ }
            } else {
                // Update numberpad highlight
                if (app.numberpadUI) {
                    const val = app.board.getCellValue(row, col);
                    app.numberpadUI.highlightNumber(val);
                }
            }
            // Sound feedback
            try { app.sound?.play('tap'); } catch { /* ignore */ }
        });
    }

    // --- Number pad clicks ---
    if (app.numberpadUI) {
        app.numberpadUI.onNumberClick((num) => {
            if (_app.settings.numberFirst) {
                // Number-first mode: lock/unlock number
                if (lockedNumber === num) {
                    lockedNumber = 0;
                    app.numberpadUI.unlockNumber();
                } else {
                    lockedNumber = num;
                    app.numberpadUI.lockNumber(num);
                }
                try { app.sound?.play('tap'); } catch { /* ignore */ }
            } else {
                // Default mode: input number on selected cell
                if (app.input) {
                    app.input.inputNumber(num);
                }
                try { app.sound?.play('place'); } catch { /* ignore */ }
            }
        });
    }
}

// ---------------------------------------------------------------------------
// Screen lifecycle
// ---------------------------------------------------------------------------

/**
 * Called when the game screen becomes visible.
 *
 * @param {object} params - Navigation parameters.
 * @param {string}  [params.difficulty] - Difficulty key.
 * @param {boolean} [params.daily]      - Whether this is a daily challenge.
 * @param {string}  [params.date]       - Daily challenge date string.
 * @param {boolean} [params.loadSaved]  - Whether to restore a saved game.
 */
function onShow(params) {
    if (!_app || !_app.board) return;

    isDaily = !!params.daily;
    dailyDate = params.date || null;

    if (params.loadSaved) {
        restoreSavedGame();
    } else if (params.daily) {
        const date = params.date || new Date().toISOString().slice(0, 10);
        startNewGame(params.difficulty || 'easy', date, params.mode || 'classic', params);
    } else if (params.difficulty) {
        startNewGame(params.difficulty, null, params.mode || 'classic', params);
    }
}

// ---------------------------------------------------------------------------
// Game start / restore helpers
// ---------------------------------------------------------------------------

/**
 * Generate and start a new puzzle at the given difficulty.
 * For large boards (12x12+), uses a Web Worker to avoid blocking the UI.
 *
 * @param {string} difficulty
 * @param {string} [dailyDate] - ISO date for daily challenge.
 * @param {string} [mode='classic'] - Game mode.
 * @param {object} [options={}] - Additional options.
 */
async function startNewGame(difficulty, dailyDate, mode = 'classic', options = {}) {
    const boardSize = options.boardSize || 9;

    // Large boards: show loading UI + async generation via Web Worker
    if (boardSize >= 12) {
        showPuzzleLoading();
        try {
            await _app.board.newGameAsync(difficulty, dailyDate, mode, options);
        } catch {
            hidePuzzleLoading();
            // Fallback: synchronous generation (slow but works)
            _app.board.newGame(difficulty, dailyDate, mode, options);
        }
        hidePuzzleLoading();
    } else {
        _app.board.newGame(difficulty, dailyDate, mode, options);
    }

    // Rebuild UI for the current board size
    const actualSize = _app.board.boardSize || 9;
    document.body.dataset.gridSize = String(actualSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(actualSize);
    if (_app.highlightUI) _app.highlightUI._gridSize = actualSize;
    if (_app.numberpadUI?.rebuild) _app.numberpadUI.rebuild(actualSize);

    // Setup countdown for time-attack mode
    if (mode === 'timeAttack') {
        const duration = options.duration || 600;
        _app.board.timer.setCountdown(true);
        _app.board.timer.setDuration(duration);
        _app.board.timer.onTimeUp(() => handleTimeUp());
    }

    // Setup timer tick callback
    _app.board.timer.onTick((formatted) => {
        if (timerValueEl && _app.settings.timer) {
            timerValueEl.textContent = formatted;
        }
        if (_app.board.mode === 'timeAttack') {
            const remaining = _app.board.timer.getRemaining();
            const timerContainer = timerValueEl?.closest('.info-timer');
            if (timerContainer) {
                timerContainer.classList.toggle('timer-warning', remaining <= 30 && remaining > 10);
                timerContainer.classList.toggle('timer-danger', remaining <= 10);
            }
        }
    });

    // Reset UI
    resetGameUI(difficulty);
    renderFullGrid();

    // Update stats: gamesStarted
    updateGamesStarted(difficulty);
}

/**
 * Restore the game from localStorage saved state.
 */
function restoreSavedGame() {
    const saved = loadGame();
    if (!saved || !saved.board) {
        // No saved game; fall back to main screen
        _app.navigate('main');
        return;
    }

    _app.board.loadState(saved);

    // Rebuild UI for the loaded board size
    const boardSize = _app.board.boardSize || 9;
    document.body.dataset.gridSize = String(boardSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(boardSize);
    if (_app.highlightUI) _app.highlightUI._gridSize = boardSize;
    if (_app.numberpadUI?.rebuild) _app.numberpadUI.rebuild(boardSize);

    // Setup timer tick callback
    _app.board.timer.onTick((formatted) => {
        if (timerValueEl && _app.settings.timer) {
            timerValueEl.textContent = formatted;
        }
        if (_app.board.mode === 'timeAttack') {
            const remaining = _app.board.timer.getRemaining();
            const timerContainer = timerValueEl?.closest('.info-timer');
            if (timerContainer) {
                timerContainer.classList.toggle('timer-warning', remaining <= 30 && remaining > 10);
                timerContainer.classList.toggle('timer-danger', remaining <= 10);
            }
        }
    });

    // Restore countdown callback for time-attack
    if (_app.board.mode === 'timeAttack') {
        _app.board.timer.onTimeUp(() => handleTimeUp());
    }

    // Start the timer
    _app.board.timer.start();

    const difficulty = _app.board.getDifficulty();
    resetGameUI(difficulty);
    renderFullGrid();

    // Restore score display
    if (scoreValueEl) {
        scoreValueEl.textContent = _app.board.getScore().toLocaleString();
    }

    // Restore mistakes display
    const { current, max } = _app.board.getMistakes();
    if (mistakesValueEl) {
        if (_app.settings.mistakeLimit) {
            mistakesValueEl.textContent = `${current}/${max}`;
            mistakesValueEl.parentElement.style.display = '';
        } else {
            mistakesValueEl.parentElement.style.display = 'none';
        }
    }

    // Restore timer display
    if (timerValueEl) {
        timerValueEl.textContent = _app.board.timer.getFormatted();
    }

    // Restore hint count
    updateHintBadge();

    // Restore notes on grid
    renderAllNotes();
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Reset game screen UI elements for a fresh or loaded game.
 *
 * @param {string} difficulty
 */
function resetGameUI(difficulty) {
    if (difficultyValueEl) {
        difficultyValueEl.textContent = DIFFICULTY_LABELS[difficulty] || difficulty;
    }
    if (scoreValueEl) {
        scoreValueEl.textContent = '0';
    }
    if (mistakesValueEl) {
        if (_app.settings.mistakeLimit) {
            mistakesValueEl.textContent = '0/3';
            mistakesValueEl.parentElement.style.display = '';
        } else {
            mistakesValueEl.parentElement.style.display = 'none';
        }
    }
    if (timerValueEl) {
        timerValueEl.textContent = '00:00';
    }

    // Reset notes toggle status
    const notesStatus = screenEl?.querySelector('.tool-status');
    if (notesStatus) {
        notesStatus.textContent = 'OFF';
    }
    const notesBtn = screenEl?.querySelector('[data-action="notes"]');
    if (notesBtn) {
        notesBtn.classList.remove('active');
    }

    // Reset hint badge
    updateHintBadge();

    // Reset number-first lock
    lockedNumber = 0;
    if (_app.numberpadUI) {
        _app.numberpadUI.unlockNumber();
    }
}

/**
 * Render the entire 9x9 grid via GridUI.
 */
function renderFullGrid() {
    if (_app.gridUI && _app.board) {
        _app.gridUI.renderBoard(_app.board.getBoard(), _app.board.getGiven());
    }
    if (_app.numberpadUI && _app.board) {
        _app.numberpadUI.updateCounts(_app.board);
    }
}

/**
 * Render all notes on the grid (used when restoring saved game).
 */
function renderAllNotes() {
    if (!_app.gridUI || !_app.board) return;

    const size = _app.board.boardSize || 9;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const notes = _app.board.notes.get(r, c);
            if (notes.size > 0) {
                _app.gridUI.showNotes(r, c, notes);
            }
        }
    }
}

/**
 * Update the hint badge display.
 */
function updateHintBadge() {
    if (!hintBadgeEl || !_app.board) return;
    hintBadgeEl.textContent = String(_app.board.getHintCount());
}

/**
 * Increment gamesStarted stat for the given difficulty.
 *
 * @param {string} difficulty
 */
function updateGamesStarted(difficulty) {
    try {
        const stats = loadStats();
        if (stats[difficulty]) {
            stats[difficulty].gamesStarted++;
            saveStats(stats);
        }
    } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// InputHandler event callbacks
// ---------------------------------------------------------------------------

/**
 * A cell value or notes were updated.
 *
 * @param {object} detail - {row, col, value, state, notes, conflicts}
 */
function onCellUpdated(detail) {
    if (!_app.board) return;

    if (_app.gridUI) {
        // Update the cell display
        if (detail.value !== 0) {
            _app.gridUI.updateCell(detail.row, detail.col, detail.value, detail.state);
            if (detail.state === 'user-input' || detail.state === 'error') {
                _app.gridUI.animatePop(detail.row, detail.col);
            }
            if (detail.state === 'error') {
                _app.gridUI.animateError(detail.row, detail.col);
            }
        } else if (detail.notes && detail.notes.length > 0) {
            _app.gridUI.showNotes(detail.row, detail.col, new Set(detail.notes));
        } else {
            _app.gridUI.clearCell(detail.row, detail.col);
        }
    }

    if (_app.numberpadUI) {
        _app.numberpadUI.updateCounts(_app.board);
    }

    // Re-apply highlight on selected cell
    if (_app.highlightUI && _app.input) {
        const sel = _app.input.getSelectedCell();
        if (sel) {
            _app.highlightUI.highlightSelection(sel.row, sel.col, _app.board.getBoard());
        }
    }

    // Auto-save on each move
    try {
        if (_app.board) {
            saveGame(_app.board.toJSON());
        }
    } catch { /* ignore */ }
}

/**
 * Score was updated.
 *
 * @param {{ score: number, delta: number }} detail
 */
function onScoreChanged(detail) {
    if (!scoreValueEl) return;

    scoreValueEl.textContent = detail.score.toLocaleString();

    // Animate a floating "+delta" near the selected cell
    if (_app.settings.scoreAnimation && detail.delta > 0 && _app.gridUI && _app.input) {
        const sel = _app.input.getSelectedCell();
        if (sel) {
            _app.gridUI.showScoreFloat(sel.row, sel.col, detail.delta);
        }
    }
}

/**
 * Player made a mistake.
 *
 * @param {{ current: number, max: number }} detail
 */
function onMistake(detail) {
    if (mistakesValueEl) {
        mistakesValueEl.textContent = `${detail.current}/${detail.max}`;
    }

    // Sound feedback
    try { _app.sound?.play('error'); } catch { /* ignore */ }

    // Check game over only if mistake limit is enabled
    if (_app.settings.mistakeLimit && detail.current >= detail.max) {
        if (_app.board && _app.board.timer) {
            _app.board.timer.pause();
        }
        handleGameOver();
    }
}

/**
 * The puzzle is complete.
 *
 * @param {{ score: number, time: number }} detail
 */
function onGameComplete(detail) {
    if (_app.board && _app.board.timer) {
        _app.board.timer.pause();
    }

    const elapsed = detail.time;
    const difficulty = _app.board ? _app.board.getDifficulty() : 'easy';
    const mistakes = _app.board ? _app.board.getMistakes().current : 0;
    const score = detail.score;

    // Sound
    try { _app.sound?.play('complete'); } catch { /* ignore */ }

    // Trigger wave animation, then navigate to complete screen
    const completeParams = {
        score,
        time: elapsed,
        difficulty,
        mistakes,
        isDaily,
        dailyDate: dailyDate || _app.board?.getDailyDate(),
        mode: _app.board?.mode || 'classic',
    };

    if (_app.board?.mode === 'timeAttack') {
        completeParams.remainingTime = _app.board.timer.getRemaining();
        completeParams.totalTime = _app.board.timer._duration / 1000;
        completeParams.success = true;
    }

    if (_app.gridUI) {
        animateCompletionWave(_app.gridUI, () => {
            _app.navigate('complete', completeParams);
        });
    } else {
        _app.navigate('complete', completeParams);
    }
}

/**
 * A hint was used.
 *
 * @param {object} detail - {row, col, value, hintsLeft}
 */
function onHintUsed(detail) {
    updateHintBadge();
    try { _app.sound?.play('hint'); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------

/**
 * Handle toolbar button clicks.
 *
 * @param {string} action
 */
function handleToolbarAction(action) {
    if (!_app.input || !_app.board) return;

    switch (action) {
        case 'undo':
            _app.input.undo();
            try { _app.sound?.play('undo'); } catch { /* ignore */ }
            break;

        case 'erase':
            _app.input.erase();
            try { _app.sound?.play('tap'); } catch { /* ignore */ }
            break;

        case 'notes': {
            const isOn = _app.input.toggleNotes();
            if (_app.toolbarUI) {
                _app.toolbarUI.setNoteMode(isOn);
            }
            break;
        }

        case 'hint': {
            _app.input.useHint();
            break;
        }

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// Puzzle loading overlay (for large boards)
// ---------------------------------------------------------------------------

/**
 * Show the puzzle generation loading overlay.
 */
function showPuzzleLoading() {
    const overlay = screenEl?.querySelector('.puzzle-loading');
    if (overlay) overlay.style.display = '';
}

/**
 * Hide the puzzle generation loading overlay.
 */
function hidePuzzleLoading() {
    const overlay = screenEl?.querySelector('.puzzle-loading');
    if (overlay) overlay.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

/**
 * Handle time-attack mode time expiry.
 */
function handleTimeUp() {
    if (_app.board && _app.board.timer) {
        _app.board.timer.pause();
    }
    clearGame();

    const difficulty = _app.board ? _app.board.getDifficulty() : 'easy';
    const score = _app.board ? _app.board.getScore() : 0;
    const mistakes = _app.board ? _app.board.getMistakes().current : 0;

    _app.navigate('complete', {
        mode: 'timeAttack',
        success: false,
        score,
        difficulty,
        mistakes,
        message: '시간 초과!',
    });
}

/**
 * Handle the game-over scenario (3 mistakes).
 */
function handleGameOver() {
    clearGame();

    // Brief delay so the player sees the last mistake, then go to main
    setTimeout(() => {
        _app.navigate('main');
    }, 1500);
}

// ---------------------------------------------------------------------------
// Wake Lock (auto-lock prevention)
// ---------------------------------------------------------------------------

/**
 * Request a screen wake lock if the autoLock setting is enabled.
 */
async function requestWakeLock() {
    if (!_app?.settings?.autoLock) return;
    if (!('wakeLock' in navigator)) return;

    try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
            wakeLockSentinel = null;
        });
    } catch {
        // Browser denied the request or API not supported — ignore.
    }
}

/**
 * Release the screen wake lock if held.
 */
function releaseWakeLock() {
    if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => { /* ignore */ });
        wakeLockSentinel = null;
    }
}

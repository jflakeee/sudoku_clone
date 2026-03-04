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
import { getCandidates } from '../core/solver.js';

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

/** @type {boolean} Whether the current game is a weekly challenge. */
let isWeekly = false;

/** @type {number} Weekly challenge week number. */
let weekNumber = 0;

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
    document.addEventListener('auto-notes-undone', () => onAutoNotesUndone());
    document.addEventListener('cell-color-changed', (e) => onCellColorChanged(e.detail));

    // --- Color palette event handling ---
    const colorPalette = document.getElementById('color-palette');
    if (colorPalette) {
        colorPalette.addEventListener('click', (e) => {
            const swatch = /** @type {HTMLElement} */ (e.target).closest('.color-swatch');
            if (!swatch) return;

            const colorIdx = parseInt(swatch.getAttribute('data-color'), 10);
            if (isNaN(colorIdx)) return;

            if (app.input) {
                app.input.setMarkingColor(colorIdx);
            }

            // Update active state on swatches
            colorPalette.querySelectorAll('.color-swatch').forEach(s =>
                s.classList.toggle('active', parseInt(s.getAttribute('data-color'), 10) === colorIdx));
        });
    }

    // --- Grid cell selection (forward to InputHandler) ---
    if (app.gridUI) {
        app.gridUI.onCellClick((row, col) => {
            if (app.input) {
                app.input.selectCell(row, col);
            }
            if (app.highlightUI) {
                app.highlightUI.highlightSelection(row, col, app.board.getBoard());
            }

            // Marking mode: apply color to cell on click
            if (app.input && app.input.isMarkingMode()) {
                app.input.applyMarking();
                try { app.sound?.play('tap'); } catch { /* ignore */ }
                return;
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
    isWeekly = !!params.isWeekly;
    weekNumber = params.weekNumber || 0;

    if (params.sharedPuzzle) {
        startSharedGame(params);
    } else if (params.replay) {
        startReplayGame(params);
    } else if (params.loadSaved) {
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
    const variant = _app.board.variant || 'standard';
    document.body.dataset.gridSize = String(actualSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(actualSize, variant);
    if (_app.highlightUI) {
        _app.highlightUI._gridSize = actualSize;
        _app.highlightUI._variant = variant;
        _app.highlightUI._extraData = (variant === 'killer' && _app.board?.getCages()) ? { cages: _app.board.getCages() } : null;
    }
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
 * Start a game from a shared puzzle (URL or import).
 *
 * @param {object} params - Parameters including sharedPuzzle decoded data.
 */
function startSharedGame(params) {
    const { sharedPuzzle } = params;
    const boardSize = sharedPuzzle.boardSize || 9;
    const variant = sharedPuzzle.variant || 'standard';
    const mode = params.mode || 'classic';

    // Convert given from number[][] (0/1) to boolean[][]
    const givenBool = sharedPuzzle.given.map(row => row.map(v => !!v));

    _app.board.newGameFromPuzzle(
        sharedPuzzle.puzzle,
        sharedPuzzle.solution,
        givenBool,
        params.difficulty || 'normal',
        mode,
        { boardSize, variant }
    );

    // Rebuild UI for the board size
    document.body.dataset.gridSize = String(boardSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(boardSize, variant);
    if (_app.highlightUI) {
        _app.highlightUI._gridSize = boardSize;
        _app.highlightUI._variant = variant;
        _app.highlightUI._extraData = (variant === 'killer' && _app.board?.getCages()) ? { cages: _app.board.getCages() } : null;
    }
    if (_app.numberpadUI?.rebuild) _app.numberpadUI.rebuild(boardSize);

    // Setup timer tick callback
    _app.board.timer.onTick((formatted) => {
        if (timerValueEl && _app.settings.timer) {
            timerValueEl.textContent = formatted;
        }
    });

    // Reset UI
    resetGameUI(params.difficulty || 'normal');
    renderFullGrid();
}

/**
 * Start a replay game from a previously completed puzzle.
 *
 * @param {object} params - Replay parameters (puzzle, solution, given, difficulty, mode, boardSize).
 */
function startReplayGame(params) {
    const boardSize = params.boardSize || 9;
    const mode = params.mode || 'classic';

    const variant = params.variant || 'standard';

    _app.board.newGameFromPuzzle(
        params.puzzle,
        params.solution,
        params.given,
        params.difficulty || 'easy',
        mode,
        { boardSize, dailyDate: params.dailyDate, variant, evenOddMap: params.evenOddMap, cages: params.cages }
    );

    // Rebuild UI for the board size
    document.body.dataset.gridSize = String(boardSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(boardSize, variant);
    if (_app.highlightUI) {
        _app.highlightUI._gridSize = boardSize;
        _app.highlightUI._variant = variant;
        _app.highlightUI._extraData = (variant === 'killer' && _app.board?.getCages()) ? { cages: _app.board.getCages() } : null;
    }
    if (_app.numberpadUI?.rebuild) _app.numberpadUI.rebuild(boardSize);

    // Setup timer tick callback
    _app.board.timer.onTick((formatted) => {
        if (timerValueEl && _app.settings.timer) {
            timerValueEl.textContent = formatted;
        }
    });

    // Reset UI
    resetGameUI(params.difficulty || 'easy');
    renderFullGrid();
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
    const variant = _app.board.variant || 'standard';
    document.body.dataset.gridSize = String(boardSize);
    if (_app.gridUI?.rebuild) _app.gridUI.rebuild(boardSize, variant);
    if (_app.highlightUI) {
        _app.highlightUI._gridSize = boardSize;
        _app.highlightUI._variant = variant;
        _app.highlightUI._extraData = (variant === 'killer' && _app.board?.getCages()) ? { cages: _app.board.getCages() } : null;
    }
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

    // Variant info display
    const variantEl = screenEl?.querySelector('.info-variant');
    const variantValueEl = screenEl?.querySelector('.variant-value');
    if (variantEl) {
        const v = _app.board?.variant;
        if (v && v !== 'standard') {
            variantEl.style.display = '';
            if (variantValueEl) {
                const VARIANT_LABELS = { diagonal: '대각선', 'anti-knight': '안티나이트', 'anti-king': '안티킹', 'even-odd': '짝홀', windoku: '윈도쿠', killer: '킬러' };
                variantValueEl.textContent = VARIANT_LABELS[v] || v;
            }
        } else {
            variantEl.style.display = 'none';
        }
    }

    // Reset number-first lock
    lockedNumber = 0;
    if (_app.numberpadUI) {
        _app.numberpadUI.unlockNumber();
    }

    // Reset marking mode
    if (_app.toolbarUI) {
        _app.toolbarUI.setMarkingMode(false);
    }
    hideColorPalette();

    // Reset progress bar
    updateProgressBar();
}

/**
 * Render the entire 9x9 grid via GridUI.
 */
function renderFullGrid() {
    if (_app.gridUI && _app.board) {
        _app.gridUI.renderBoard(_app.board.getBoard(), _app.board.getGiven());
        _app.gridUI.renderAllColors(_app.board);
        // Apply even/odd markers if variant is even-odd
        if (_app.board.variant === 'even-odd' && _app.gridUI.applyEvenOddMap) {
            _app.gridUI.applyEvenOddMap(_app.board.getEvenOddMap());
        }
        // Apply cage rendering for killer variant
        if (_app.board.variant === 'killer' && _app.gridUI.renderCages) {
            _app.gridUI.renderCages(_app.board.getCages());
        }
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
 * Update the progress bar display based on current board state.
 */
function updateProgressBar() {
    if (!_app.board || !screenEl) return;
    const progress = _app.board.getProgress();
    const fillEl = screenEl.querySelector('.progress-fill');
    const barEl = screenEl.querySelector('.info-progress');
    if (fillEl) {
        fillEl.style.width = `${progress}%`;
    }
    if (barEl) {
        barEl.setAttribute('aria-valuenow', String(progress));
    }
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
        const animationsOn = _app.settings?.animations !== false;

        // Update the cell display
        if (detail.value !== 0) {
            _app.gridUI.updateCell(detail.row, detail.col, detail.value, detail.state);
            if (animationsOn && (detail.state === 'user-input' || detail.state === 'error')) {
                _app.gridUI.animateValueBounce(detail.row, detail.col);
            }
            if (animationsOn && detail.state === 'error') {
                _app.gridUI.animateError(detail.row, detail.col);
            }

            // Auto-check mistakes: mark cell if wrong
            applyAutoMistakeCheck(detail.row, detail.col, detail.value, detail.state);
        } else if (detail.notes && detail.notes.length > 0) {
            _app.gridUI.showNotes(detail.row, detail.col, new Set(detail.notes), animationsOn);
        } else {
            _app.gridUI.clearCell(detail.row, detail.col);
            // Remove auto-mistake class when cell is cleared
            removeAutoMistakeClass(detail.row, detail.col);
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

    // Update progress bar
    updateProgressBar();

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
        variant: _app.board?.variant || 'standard',
        isWeekly,
        weekNumber,
    };

    if (_app.board?.mode === 'timeAttack') {
        completeParams.remainingTime = _app.board.timer.getRemaining();
        completeParams.totalTime = _app.board.timer._duration / 1000;
        completeParams.success = true;
    }

    if (_app.gridUI && _app.settings?.animations !== false) {
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
                // Turn off marking when notes is on
                if (isOn) {
                    _app.toolbarUI.setMarkingMode(false);
                    hideColorPalette();
                }
            }
            break;
        }

        case 'marking': {
            const markingOn = _app.input.toggleMarking();
            if (_app.toolbarUI) {
                _app.toolbarUI.setMarkingMode(markingOn);
                // Turn off notes when marking is on
                if (markingOn) {
                    _app.toolbarUI.setNoteMode(false);
                }
            }
            if (markingOn) {
                showColorPalette();
            } else {
                hideColorPalette();
            }
            break;
        }

        case 'hint': {
            _app.input.useHint();
            break;
        }

        case 'auto-notes': {
            autoFillNotes();
            break;
        }

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// Auto-fill notes
// ---------------------------------------------------------------------------

/**
 * Fill all empty cells with candidate notes based on current board state.
 * Supports undo: saves a snapshot of all notes before overwriting.
 */
function autoFillNotes() {
    if (!_app.board || _app.board.isGameOver()) return;

    const board = _app.board.getBoard();
    const size = _app.board.boardSize || 9;
    const blockSize = _app.board.blockSize;
    const variant = _app.board.variant || 'standard';

    // Snapshot current notes for undo
    const prevNotesSnapshot = _app.board.notes.toJSON();

    let changed = false;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] !== 0) continue;
            if (_app.board.isGiven(r, c)) continue;

            const candidates = getCandidates(board, r, c, size, blockSize, variant);
            const currentNotes = _app.board.notes.get(r, c);

            // Check if notes would change
            if (candidates.size !== currentNotes.size || ![...candidates].every(n => currentNotes.has(n))) {
                changed = true;
            }

            // Clear and set new candidates
            _app.board.notes.clear(r, c);
            for (const n of candidates) {
                if (!_app.board.notes.hasNote(r, c, n)) {
                    _app.board.notes.toggle(r, c, n);
                }
            }

            // Update grid display
            if (_app.gridUI) {
                if (candidates.size > 0) {
                    _app.gridUI.showNotes(r, c, candidates);
                } else {
                    _app.gridUI.clearCell(r, c);
                }
            }
        }
    }

    if (changed) {
        // Push a composite undo entry for the entire auto-notes action
        _app.board.history.push({
            type: 'auto-notes',
            row: -1,
            col: -1,
            prevValue: 0,
            newValue: 0,
            prevNotes: [],
            newNotes: [],
            prevNotesSnapshot,
        });
    }

    // Auto-save
    try {
        if (_app.board) saveGame(_app.board.toJSON());
    } catch { /* ignore */ }

    try { _app.sound?.play('tap'); } catch { /* ignore */ }
}

/**
 * Handle undo of auto-notes: re-render all notes from the restored snapshot.
 */
function onAutoNotesUndone() {
    if (!_app.board || !_app.gridUI) return;

    const size = _app.board.boardSize || 9;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (_app.board.getBoard()[r][c] !== 0) continue;
            const notes = _app.board.notes.get(r, c);
            if (notes.size > 0) {
                _app.gridUI.showNotes(r, c, notes);
            } else {
                _app.gridUI.clearCell(r, c);
            }
        }
    }

    // Auto-save
    try {
        if (_app.board) saveGame(_app.board.toJSON());
    } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Auto-check mistakes
// ---------------------------------------------------------------------------

/**
 * Apply auto-mistake visual indicator if setting is enabled.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} value - The placed value.
 * @param {string} state - Current cell state ('user-input', 'error', etc.)
 */
function applyAutoMistakeCheck(row, col, value, state) {
    if (!_app.gridUI || !_app.board) return;

    const cell = _app.gridUI.getCell(row, col);
    if (!cell) return;

    // Only apply to user-input cells (not given, not already error state)
    if (_app.board.isGiven(row, col)) {
        cell.classList.remove('auto-mistake');
        return;
    }

    if (!_app.settings?.autoCheckMistakes) {
        cell.classList.remove('auto-mistake');
        return;
    }

    const solution = _app.board.getSolution();
    if (value !== 0 && value !== solution[row][col]) {
        cell.classList.add('auto-mistake');
    } else {
        cell.classList.remove('auto-mistake');
    }
}

/**
 * Remove auto-mistake class from a cell.
 *
 * @param {number} row
 * @param {number} col
 */
function removeAutoMistakeClass(row, col) {
    if (!_app.gridUI) return;
    const cell = _app.gridUI.getCell(row, col);
    if (cell) cell.classList.remove('auto-mistake');
}

// ---------------------------------------------------------------------------
// Color marking helpers
// ---------------------------------------------------------------------------

/**
 * Show the color palette bar.
 */
function showColorPalette() {
    const palette = document.getElementById('color-palette');
    if (palette) {
        palette.style.display = '';
        // Set default active swatch (color 1)
        const defaultSwatch = palette.querySelector('.color-swatch[data-color="1"]');
        if (defaultSwatch && !palette.querySelector('.color-swatch.active')) {
            defaultSwatch.classList.add('active');
        }
    }
}

/**
 * Hide the color palette bar.
 */
function hideColorPalette() {
    const palette = document.getElementById('color-palette');
    if (palette) palette.style.display = 'none';
}

/**
 * Cell color was changed (from input handler or undo).
 *
 * @param {{ row: number, col: number, colorIdx: number }} detail
 */
function onCellColorChanged(detail) {
    if (_app.gridUI) {
        _app.gridUI.setCellColor(detail.row, detail.col, detail.colorIdx);
    }

    // Auto-save
    try {
        if (_app.board) saveGame(_app.board.toJSON());
    } catch { /* ignore */ }
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

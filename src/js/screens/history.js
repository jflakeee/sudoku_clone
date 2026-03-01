/**
 * Game History Screen Controller
 *
 * Displays completed games with filtering, and allows replay, print, or batch print.
 *
 * @module screens/history
 */

import { loadGameHistory, getGameHistoryById } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = {
    easy: '쉬움',
    medium: '보통',
    normal: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

const MODE_LABELS = {
    classic: '클래식',
    timeAttack: '타임어택',
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {string} Current filter key. */
let _currentFilter = 'all';

/** @type {Set<string>} Selected history entry IDs for batch print. */
let _selectedIds = new Set();

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the history list based on current filter.
 */
function renderHistoryList() {
    const container = document.getElementById('history-list');
    if (!container) return;

    const allHistory = loadGameHistory();
    const filtered = _currentFilter === 'all'
        ? allHistory
        : _currentFilter === 'daily'
            ? allHistory.filter(e => !!e.dailyDate)
            : allHistory.filter(e => e.mode === _currentFilter && !e.dailyDate);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="history-empty">게임 기록이 없습니다.</div>';
        updateBatchPrintBtn();
        return;
    }

    container.innerHTML = '';

    filtered.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';
        if (_selectedIds.has(entry.id)) {
            item.classList.add('selected');
        }

        const dateStr = formatDate(entry.date);
        const diffLabel = DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty;
        const modeLabel = entry.dailyDate
            ? '일일도전'
            : MODE_LABELS[entry.mode] || entry.mode;
        const sizeLabel = entry.boardSize ? `${entry.boardSize}×${entry.boardSize}` : '9×9';
        const checked = _selectedIds.has(entry.id) ? 'checked' : '';

        item.innerHTML = `
            <input type="checkbox" class="history-check" data-history-id="${entry.id}" ${checked}>
            <div class="history-item-info">
                <div class="history-item-title">${diffLabel} · ${modeLabel}</div>
                <div class="history-item-meta">${dateStr} · ${sizeLabel} · ${formatTime(entry.time)} · ${(entry.score || 0).toLocaleString()}점</div>
            </div>
            <div class="history-item-actions">
                <button class="btn-sm btn-replay" data-history-id="${entry.id}" title="재도전">재도전</button>
                <button class="btn-sm btn-print-single" data-history-id="${entry.id}" title="인쇄">인쇄</button>
            </div>
        `;

        container.appendChild(item);
    });

    updateBatchPrintBtn();
}

/**
 * Update the batch print bar visibility and button text.
 */
function updateBatchPrintBtn() {
    const bar = document.getElementById('history-batch-bar');
    const btn = document.getElementById('btn-batch-print');
    if (!bar || !btn) return;

    if (_selectedIds.size > 0) {
        bar.style.display = '';
        btn.textContent = `${_selectedIds.size}개 인쇄`;
    } else {
        bar.style.display = 'none';
    }
}

/**
 * Format ISO date string to a readable Korean date.
 *
 * @param {string} isoStr
 * @returns {string}
 */
function formatDate(isoStr) {
    try {
        const d = new Date(isoStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch {
        return isoStr;
    }
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

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle filter click.
 *
 * @param {string} filter
 */
function setFilter(filter) {
    _currentFilter = filter;

    const filterBtns = document.querySelectorAll('#history-filters .history-filter');
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    renderHistoryList();
}

/**
 * Handle replay button click.
 *
 * @param {string} entryId
 */
function handleReplay(entryId) {
    const entry = getGameHistoryById(entryId);
    if (!entry || !entry.puzzle || !entry.solution || !entry.given) return;

    _app.navigate('game', {
        replay: true,
        puzzle: entry.puzzle,
        solution: entry.solution,
        given: entry.given,
        difficulty: entry.difficulty,
        mode: entry.mode || 'classic',
        boardSize: entry.boardSize || 9,
        dailyDate: entry.dailyDate || null,
    });
}

/**
 * Handle single-entry print button click.
 *
 * @param {string} entryId
 */
function handlePrintSingle(entryId) {
    const entry = getGameHistoryById(entryId);
    if (!entry) return;

    _app.navigate('print', { entries: [entry] });
}

/**
 * Handle batch print button click.
 */
function handleBatchPrint() {
    const allHistory = loadGameHistory();
    const entries = allHistory.filter(e => _selectedIds.has(e.id));
    if (entries.length === 0) return;

    _app.navigate('print', { entries });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the game history screen.
 *
 * @param {object} app - Application context.
 */
export function initHistoryScreen(app) {
    _app = app;

    // Filter buttons
    const filtersEl = document.getElementById('history-filters');
    if (filtersEl) {
        filtersEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.history-filter');
            if (btn && btn.dataset.filter) {
                setFilter(btn.dataset.filter);
            }
        });
    }

    // List delegation for replay/print/checkbox
    const listEl = document.getElementById('history-list');
    if (listEl) {
        listEl.addEventListener('click', (e) => {
            const replayBtn = e.target.closest('.btn-replay');
            if (replayBtn) {
                handleReplay(replayBtn.dataset.historyId);
                return;
            }

            const printBtn = e.target.closest('.btn-print-single');
            if (printBtn) {
                handlePrintSingle(printBtn.dataset.historyId);
                return;
            }

            const checkbox = e.target.closest('.history-check');
            if (checkbox) {
                const id = checkbox.dataset.historyId;
                const item = checkbox.closest('.history-item');
                if (checkbox.checked) {
                    _selectedIds.add(id);
                    if (item) item.classList.add('selected');
                } else {
                    _selectedIds.delete(id);
                    if (item) item.classList.remove('selected');
                }
                updateBatchPrintBtn();
            }
        });
    }

    // Batch print button
    const batchBtn = document.getElementById('btn-batch-print');
    if (batchBtn) {
        batchBtn.addEventListener('click', handleBatchPrint);
    }

    // Screen show listener
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'history') {
            _currentFilter = 'all';
            _selectedIds.clear();
            const filterBtns = document.querySelectorAll('#history-filters .history-filter');
            filterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === 'all');
            });
            renderHistoryList();
        }
    });
}

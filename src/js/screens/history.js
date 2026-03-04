/**
 * Game History Screen Controller
 *
 * Displays completed games with filtering, and allows replay, print, or batch print.
 *
 * @module screens/history
 */

import { loadGameHistory, getGameHistoryById } from '../utils/storage.js';
import { encodePuzzle } from '../utils/puzzle-share.js';
import { DIFFICULTY_LABELS } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


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
        const VARIANT_BADGES = {
            diagonal: '<span class="badge-diagonal">대각선</span>',
            'anti-knight': '<span class="badge-anti-knight">안티나이트</span>',
            'anti-king': '<span class="badge-anti-king">안티킹</span>',
            'even-odd': '<span class="badge-even-odd">짝홀</span>',
            windoku: '<span class="badge-windoku">윈도쿠</span>',
            killer: '<span class="badge-killer">킬러</span>',
        };
        const variantBadge = VARIANT_BADGES[entry.variant] ? ' · ' + VARIANT_BADGES[entry.variant] : '';
        const checked = _selectedIds.has(entry.id) ? 'checked' : '';

        item.innerHTML = `
            <input type="checkbox" class="history-check" data-history-id="${entry.id}" ${checked}>
            <div class="history-item-info">
                <div class="history-item-title">${diffLabel} · ${modeLabel}${variantBadge}</div>
                <div class="history-item-meta">${dateStr} · ${sizeLabel} · ${formatTime(entry.time)} · ${(entry.score || 0).toLocaleString()}점</div>
            </div>
            <div class="history-item-actions">
                <button class="btn-sm btn-share-puzzle" data-history-id="${entry.id}" title="퍼즐 공유">공유</button>
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
        variant: entry.variant || 'standard',
        evenOddMap: entry.evenOddMap || null,
        cages: entry.cages || null,
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
 * Handle puzzle share button click.
 *
 * @param {string} entryId
 */
async function handleSharePuzzle(entryId) {
    const entry = getGameHistoryById(entryId);
    if (!entry || !entry.puzzle || !entry.solution) return;

    const code = encodePuzzle(entry.puzzle, entry.solution, entry.boardSize || 9, entry.variant || 'standard');
    const url = `${window.location.origin}${window.location.pathname}?puzzle=${code}`;

    try {
        await navigator.clipboard.writeText(url);
        showHistoryToast('\uD37C\uC990 \uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
    } catch {
        showHistoryToast('\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
    }
}

/**
 * Show a brief toast notification for the history screen.
 *
 * @param {string} message
 */
function showHistoryToast(message) {
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
            const shareBtn = e.target.closest('.btn-share-puzzle');
            if (shareBtn) {
                handleSharePuzzle(shareBtn.dataset.historyId);
                return;
            }

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

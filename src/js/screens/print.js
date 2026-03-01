/**
 * Print Screen Controller
 *
 * Renders puzzle grids for printing (single, dual, quad, six, eight layout on A4).
 *
 * @module screens/print
 */

import { getBlockSize } from '../core/board-config.js';

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

const LAYOUT_LIMITS = {
    single: 1,
    dual: 2,
    quad: 4,
    six: 6,
    eight: 8,
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {string} Current layout key. */
let _layout = 'single';

/** @type {object[]} Entries to print. */
let _entries = [];

/** @type {boolean} Whether to show answer key (full solution). */
let _showAnswerKey = false;

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

/**
 * Create a printable grid table from a puzzle entry.
 *
 * @param {object} entry - History entry with puzzle, boardSize, difficulty.
 * @returns {HTMLElement}
 */
function createPrintGrid(entry) {
    const size = entry.boardSize || 9;
    const block = getBlockSize(size);
    const source = _showAnswerKey && entry.solution ? entry.solution : entry.puzzle;
    const wrapper = document.createElement('div');
    wrapper.className = 'print-grid-wrapper';

    // Header
    const header = document.createElement('div');
    header.className = 'print-grid-header';
    const diffLabel = DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty;
    header.textContent = `${diffLabel} · ${size}×${size}${_showAnswerKey ? ' (정답)' : ''}`;
    wrapper.appendChild(header);

    // Table
    const table = document.createElement('table');
    table.className = 'print-grid';
    table.dataset.size = String(size);

    for (let r = 0; r < size; r++) {
        const tr = document.createElement('tr');

        for (let c = 0; c < size; c++) {
            const td = document.createElement('td');
            td.className = 'print-cell';

            // Block borders
            if (c > 0 && c % block.cols === 0) {
                td.classList.add('block-left');
            }
            if (r > 0 && r % block.rows === 0) {
                td.classList.add('block-top');
            }

            const val = source[r]?.[c] || 0;
            if (val > 0) {
                td.textContent = String(val);
                td.classList.add('given');
            }

            tr.appendChild(td);
        }

        table.appendChild(tr);
    }

    wrapper.appendChild(table);
    return wrapper;
}

/**
 * Render the print preview area.
 */
function renderPreview() {
    const preview = document.getElementById('print-preview');
    if (!preview) return;

    preview.innerHTML = '';
    preview.className = `print-preview layout-${_layout}`;

    if (_entries.length === 0) {
        preview.innerHTML = '<div class="history-empty">인쇄할 퍼즐이 없습니다.</div>';
        return;
    }

    const limit = LAYOUT_LIMITS[_layout] || 1;
    const entriesToRender = _entries.slice(0, limit);

    entriesToRender.forEach(entry => {
        if (entry.puzzle) {
            preview.appendChild(createPrintGrid(entry));
        }
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the print screen.
 *
 * @param {object} app - Application context.
 */
export function initPrintScreen(app) {
    _app = app;

    const printScreen = document.getElementById('screen-print');
    const answerCheckbox = document.getElementById('print-answer-key');

    if (printScreen) {
        // Layout toggle buttons
        printScreen.addEventListener('click', (e) => {
            const layoutBtn = e.target.closest('.print-layout-btn');
            if (layoutBtn && layoutBtn.dataset.layout) {
                _layout = layoutBtn.dataset.layout;
                printScreen.querySelectorAll('.print-layout-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.layout === _layout);
                });
                renderPreview();
                return;
            }

            const printBtn = e.target.closest('[data-action="do-print"]');
            if (printBtn) {
                window.print();
            }
        });
    }

    // Answer key checkbox
    if (answerCheckbox) {
        answerCheckbox.addEventListener('change', () => {
            _showAnswerKey = answerCheckbox.checked;
            renderPreview();
        });
    }

    // Screen show listener
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'print') {
            _entries = detail.params?.entries || [];
            _layout = 'single';
            _showAnswerKey = false;
            if (answerCheckbox) answerCheckbox.checked = false;
            if (printScreen) {
                printScreen.querySelectorAll('.print-layout-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.layout === 'single');
                });
            }
            renderPreview();
        }
    });
}

/**
 * Ranking Screen Controller
 *
 * Displays personal best records from gameHistory, filterable by
 * period, difficulty, and game mode. Sorted by score descending.
 *
 * @module screens/ranking
 */

import { loadGameHistory, loadStats } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFF_LABELS = {
    easy: '쉬움',
    normal: '보통',
    medium: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'master'];

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _period = 'all';
let _difficulty = 'all';
let _mode = 'all';

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Filter entries by time period.
 *
 * @param {object[]} entries
 * @param {string} period - 'all' | 'month' | 'week' | 'today'
 * @returns {object[]}
 */
function filterByPeriod(entries, period) {
    if (period === 'all') return entries;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === 'today') {
        return entries.filter(e => {
            const d = new Date(e.date);
            return d >= todayStart;
        });
    }

    if (period === 'week') {
        // ISO week: Monday start
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1; // days since Monday
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - diff);
        return entries.filter(e => {
            const d = new Date(e.date);
            return d >= weekStart;
        });
    }

    if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return entries.filter(e => {
            const d = new Date(e.date);
            return d >= monthStart;
        });
    }

    return entries;
}

/**
 * Apply all active filters and sort.
 *
 * @param {object[]} entries
 * @returns {object[]}
 */
function filterEntries(entries) {
    let result = filterByPeriod(entries, _period);
    if (_difficulty !== 'all') {
        result = result.filter(e => e.difficulty === _difficulty);
    }
    if (_mode !== 'all') {
        result = result.filter(e => e.mode === _mode);
    }
    return result.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.time || 0) - (b.time || 0));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the 3 summary cards using stats data.
 */
function renderSummary() {
    const container = document.getElementById('ranking-summary');
    if (!container) return;

    let bestScore = 0;
    let bestTime = 0;
    let bestStreak = 0;

    for (const mode of ['classic', 'timeAttack']) {
        const stats = loadStats(mode);
        for (const diff of DIFFICULTIES) {
            const s = stats[diff];
            if (!s) continue;
            const hs = s.highScores?.allTime || 0;
            if (hs > bestScore) bestScore = hs;
            if (s.bestTime > 0 && (bestTime === 0 || s.bestTime < bestTime)) {
                bestTime = s.bestTime;
            }
            if (s.bestStreak > bestStreak) bestStreak = s.bestStreak;
        }
    }

    const timeStr = bestTime > 0 ? formatTime(bestTime) : '--:--';

    container.innerHTML = `
        <div class="ranking-summary-card">
            <div class="ranking-summary-icon">\u{1F3C6}</div>
            <div class="ranking-summary-value">${bestScore.toLocaleString()}</div>
            <div class="ranking-summary-label">최고 점수</div>
        </div>
        <div class="ranking-summary-card">
            <div class="ranking-summary-icon">\u23F1</div>
            <div class="ranking-summary-value">${timeStr}</div>
            <div class="ranking-summary-label">최단 시간</div>
        </div>
        <div class="ranking-summary-card">
            <div class="ranking-summary-icon">\u{1F525}</div>
            <div class="ranking-summary-value">${bestStreak}</div>
            <div class="ranking-summary-label">최장 연승</div>
        </div>
    `;
}

/**
 * Render the filtered & sorted ranking list.
 *
 * @param {object[]} entries
 */
function renderList(entries) {
    const container = document.getElementById('ranking-list');
    if (!container) return;

    if (entries.length === 0) {
        container.innerHTML = '<div class="ranking-empty">기록이 없습니다</div>';
        return;
    }

    let html = '';
    entries.forEach((entry, i) => {
        const rank = i + 1;
        let rankLabel;
        if (rank === 1) rankLabel = '\u{1F947}';
        else if (rank === 2) rankLabel = '\u{1F948}';
        else if (rank === 3) rankLabel = '\u{1F949}';
        else rankLabel = String(rank);

        const diffLabel = DIFF_LABELS[entry.difficulty] || entry.difficulty;
        const sizeLabel = entry.boardSize ? `${entry.boardSize}\u00D7${entry.boardSize}` : '9\u00D79';
        const score = (entry.score || 0).toLocaleString();
        const time = formatTime(entry.time || 0);
        const mistakes = entry.mistakes ?? 0;
        const dateStr = formatShortDate(entry.date);

        html += `
            <div class="ranking-row">
                <div class="ranking-rank">${rankLabel}</div>
                <div class="ranking-info">
                    <div class="ranking-info-main">${diffLabel} \u00B7 ${sizeLabel}</div>
                    <div class="ranking-info-sub">${time} \u00B7 \uC2E4\uC218 ${mistakes} \u00B7 ${dateStr}</div>
                </div>
                <div class="ranking-score">${score}</div>
            </div>
        `;
    });

    container.innerHTML = html;
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

/**
 * Format ISO date string to "M/D".
 *
 * @param {string} isoStr
 * @returns {string}
 */
function formatShortDate(isoStr) {
    try {
        const d = new Date(isoStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
        return '';
    }
}

/**
 * Refresh the entire ranking view.
 */
function refresh() {
    const history = loadGameHistory();
    const filtered = filterEntries(history);
    renderSummary();
    renderList(filtered);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the ranking screen.
 *
 * @param {object} app - Application context.
 */
export function initRankingScreen(app) {
    // Period tab clicks
    const tabsEl = document.getElementById('ranking-period-tabs');
    if (tabsEl) {
        tabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.ranking-tab');
            if (!btn || !btn.dataset.period) return;
            _period = btn.dataset.period;
            tabsEl.querySelectorAll('.ranking-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.period === _period);
            });
            refresh();
        });
    }

    // Difficulty select
    const diffSelect = document.getElementById('ranking-difficulty');
    if (diffSelect) {
        diffSelect.addEventListener('change', () => {
            _difficulty = diffSelect.value;
            refresh();
        });
    }

    // Mode select
    const modeSelect = document.getElementById('ranking-mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            _mode = modeSelect.value;
            refresh();
        });
    }

    // Screen show listener
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'ranking') {
            // Reset filters
            _period = 'all';
            _difficulty = 'all';
            _mode = 'all';

            if (tabsEl) {
                tabsEl.querySelectorAll('.ranking-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.period === 'all');
                });
            }
            if (diffSelect) diffSelect.value = 'all';
            if (modeSelect) modeSelect.value = 'all';

            refresh();
        }
    });
}

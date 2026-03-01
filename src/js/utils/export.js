/**
 * Export utility – save print puzzles as PNG or SVG images.
 * Pure browser implementation (Canvas API + SVG DOM), no external libraries.
 *
 * @module utils/export
 */

import { getBlockSize } from '../core/board-config.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const LAYOUT_COLS = { single: 1, dual: 1, quad: 2, six: 2, eight: 2 };
const LAYOUT_ROWS = { single: 1, dual: 2, quad: 2, six: 3, eight: 4 };

const DIFFICULTY_LABELS = {
    easy: '쉬움',
    medium: '보통',
    normal: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

/** System font stack matching the app's CSS */
const FONT_FAMILY = '"Segoe UI", system-ui, -apple-system, sans-serif';

const HEADER_HEIGHT = 28;
const PADDING = 24;
const GAP = 28;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cell pixel size – larger values yield better print quality. */
function getCellSize(boardSize) {
    if (boardSize <= 4) return 80;
    if (boardSize <= 6) return 70;
    if (boardSize <= 9) return 60;
    if (boardSize <= 12) return 50;
    return 38;
}

/**
 * Number font size.
 * Matches actual CSS ratio: 16px font in ~44px cell ≈ 0.36.
 */
function getFontSize(cellSize) {
    return Math.max(11, Math.round(cellSize * 0.36));
}

function headerText(entry, showAnswer) {
    const sz = entry.boardSize || 9;
    const lbl = DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty;
    return `${lbl} · ${sz}×${sz}${showAnswer ? ' (정답)' : ''}`;
}

function entryGridPixels(entry) {
    const sz = entry.boardSize || 9;
    return sz * getCellSize(sz);
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Canvas (PNG)
// ---------------------------------------------------------------------------

function drawGrid(ctx, entry, x, y, showAnswer) {
    const boardSize = entry.boardSize || 9;
    const block = getBlockSize(boardSize);
    const cell = getCellSize(boardSize);
    const src = showAnswer && entry.solution ? entry.solution : entry.puzzle;
    const gp = boardSize * cell;

    // Header (matches CSS: 0.85rem ≈ 14px, weight 600)
    ctx.fillStyle = '#000';
    ctx.font = `600 14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headerText(entry, showAnswer), x + gp / 2, y + HEADER_HEIGHT / 2);

    const gx = x;
    const gy = y + HEADER_HEIGHT;

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(gx, gy, gp, gp);

    // Given cell backgrounds (#ededed) – drawn before borders so lines stay on top
    const puzzle = entry.puzzle;
    ctx.fillStyle = '#ededed';
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (puzzle[r]?.[c]) {
                ctx.fillRect(gx + c * cell, gy + r * cell, cell, cell);
            }
        }
    }

    // Thin cell borders (print CSS: 1px solid #666)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let i = 1; i < boardSize; i++) {
        if (i % block.rows !== 0) {
            ctx.beginPath();
            ctx.moveTo(gx, gy + i * cell + 0.5);
            ctx.lineTo(gx + gp, gy + i * cell + 0.5);
            ctx.stroke();
        }
        if (i % block.cols !== 0) {
            ctx.beginPath();
            ctx.moveTo(gx + i * cell + 0.5, gy);
            ctx.lineTo(gx + i * cell + 0.5, gy + gp);
            ctx.stroke();
        }
    }

    // Thick block borders (print CSS: 2px solid #000)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    for (let i = 1; i < boardSize; i++) {
        if (i % block.rows === 0) {
            ctx.beginPath();
            ctx.moveTo(gx, gy + i * cell);
            ctx.lineTo(gx + gp, gy + i * cell);
            ctx.stroke();
        }
        if (i % block.cols === 0) {
            ctx.beginPath();
            ctx.moveTo(gx + i * cell, gy);
            ctx.lineTo(gx + i * cell, gy + gp);
            ctx.stroke();
        }
    }

    // Outer border (print CSS: 2px solid #000)
    ctx.strokeRect(gx, gy, gp, gp);

    // Numbers (print CSS: font-weight 700, color #000)
    const fs = getFontSize(cell);
    ctx.font = `700 ${fs}px ${FONT_FAMILY}`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const v = src[r]?.[c] || 0;
            if (v) {
                ctx.fillText(
                    String(v),
                    gx + c * cell + cell / 2,
                    gy + r * cell + cell / 2,
                );
            }
        }
    }
}

/**
 * Export current print entries as a PNG image.
 *
 * @param {object[]} entries - Puzzle entries with puzzle, boardSize, difficulty, solution.
 * @param {string}   layout  - Layout key (single, dual, quad, six, eight).
 * @param {boolean}  showAnswerKey - Whether to render full solution.
 */
export function exportAsPng(entries, layout, showAnswerKey) {
    const items = entries.filter(e => e.puzzle);
    if (!items.length) return;

    const cols = LAYOUT_COLS[layout] || 1;
    const rows = LAYOUT_ROWS[layout] || 1;

    let maxW = 0;
    let maxH = 0;
    for (const e of items) {
        const gp = entryGridPixels(e);
        if (gp > maxW) maxW = gp;
        if (gp + HEADER_HEIGHT > maxH) maxH = gp + HEADER_HEIGHT;
    }

    const w = PADDING * 2 + cols * maxW + Math.max(0, cols - 1) * GAP;
    const h = PADDING * 2 + rows * maxH + Math.max(0, rows - 1) * GAP;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    items.forEach((entry, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawGrid(
            ctx, entry,
            PADDING + col * (maxW + GAP),
            PADDING + row * (maxH + GAP),
            showAnswerKey,
        );
    });

    canvas.toBlob(blob => {
        if (blob) triggerDownload(blob, 'sudoku.png');
    }, 'image/png');
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

function svgGrid(entry, x, y, showAnswer) {
    const boardSize = entry.boardSize || 9;
    const block = getBlockSize(boardSize);
    const cell = getCellSize(boardSize);
    const src = showAnswer && entry.solution ? entry.solution : entry.puzzle;
    const gp = boardSize * cell;
    let s = '';

    // Header
    s += `<text x="${x + gp / 2}" y="${y + HEADER_HEIGHT / 2}" text-anchor="middle" `
       + `dominant-baseline="central" font-family="${FONT_FAMILY}" font-size="14" `
       + `font-weight="600" fill="#000">${escapeXml(headerText(entry, showAnswer))}</text>`;

    const gx = x;
    const gy = y + HEADER_HEIGHT;

    // Background + outer border
    s += `<rect x="${gx}" y="${gy}" width="${gp}" height="${gp}" fill="#fff" stroke="#000" stroke-width="2"/>`;

    // Given cell backgrounds – drawn before borders so lines stay on top
    const puzzle = entry.puzzle;
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (puzzle[r]?.[c]) {
                s += `<rect x="${gx + c * cell}" y="${gy + r * cell}" width="${cell}" height="${cell}" fill="#ededed"/>`;
            }
        }
    }

    // Thin cell borders
    for (let i = 1; i < boardSize; i++) {
        if (i % block.rows !== 0) {
            s += `<line x1="${gx}" y1="${gy + i * cell}" x2="${gx + gp}" y2="${gy + i * cell}" stroke="#666" stroke-width="1"/>`;
        }
        if (i % block.cols !== 0) {
            s += `<line x1="${gx + i * cell}" y1="${gy}" x2="${gx + i * cell}" y2="${gy + gp}" stroke="#666" stroke-width="1"/>`;
        }
    }

    // Thick block borders
    for (let i = 1; i < boardSize; i++) {
        if (i % block.rows === 0) {
            s += `<line x1="${gx}" y1="${gy + i * cell}" x2="${gx + gp}" y2="${gy + i * cell}" stroke="#000" stroke-width="2"/>`;
        }
        if (i % block.cols === 0) {
            s += `<line x1="${gx + i * cell}" y1="${gy}" x2="${gx + i * cell}" y2="${gy + gp}" stroke="#000" stroke-width="2"/>`;
        }
    }

    // Numbers
    const fs = getFontSize(cell);
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const v = src[r]?.[c] || 0;
            if (v) {
                s += `<text x="${gx + c * cell + cell / 2}" y="${gy + r * cell + cell / 2}" `
                   + `text-anchor="middle" dominant-baseline="central" font-family="${FONT_FAMILY}" `
                   + `font-size="${fs}" font-weight="700" fill="#000">${v}</text>`;
            }
        }
    }

    return s;
}

/**
 * Export current print entries as an SVG image.
 *
 * @param {object[]} entries - Puzzle entries with puzzle, boardSize, difficulty, solution.
 * @param {string}   layout  - Layout key (single, dual, quad, six, eight).
 * @param {boolean}  showAnswerKey - Whether to render full solution.
 */
export function exportAsSvg(entries, layout, showAnswerKey) {
    const items = entries.filter(e => e.puzzle);
    if (!items.length) return;

    const cols = LAYOUT_COLS[layout] || 1;
    const rows = LAYOUT_ROWS[layout] || 1;

    let maxW = 0;
    let maxH = 0;
    for (const e of items) {
        const gp = entryGridPixels(e);
        if (gp > maxW) maxW = gp;
        if (gp + HEADER_HEIGHT > maxH) maxH = gp + HEADER_HEIGHT;
    }

    const w = PADDING * 2 + cols * maxW + Math.max(0, cols - 1) * GAP;
    const h = PADDING * 2 + rows * maxH + Math.max(0, rows - 1) * GAP;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
    svg += `<rect width="100%" height="100%" fill="#fff"/>`;

    items.forEach((entry, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        svg += svgGrid(
            entry,
            PADDING + col * (maxW + GAP),
            PADDING + row * (maxH + GAP),
            showAnswerKey,
        );
    });

    svg += '</svg>';
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), 'sudoku.svg');
}

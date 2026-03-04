/**
 * Puzzle Result Sharing
 *
 * Generates a Wordle-style emoji grid for completed puzzles and handles
 * sharing via Web Share API or clipboard fallback.
 *
 * @module utils/share
 */

// ---------------------------------------------------------------------------
// Difficulty emoji map
// ---------------------------------------------------------------------------

const DIFF_EMOJI = {
    easy: '\uD83D\uDFE2',    // green circle
    normal: '\uD83D\uDFE1',  // yellow circle
    hard: '\uD83D\uDFE0',    // orange circle (actually large orange diamond, using orange circle)
    expert: '\uD83D\uDD34',  // red circle
    master: '\uD83D\uDC80',  // skull
};

const DIFF_LABELS = {
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    expert: 'Expert',
    master: 'Master',
};

const VARIANT_NAMES = {
    diagonal: '\uB300\uAC01\uC120',
    'anti-knight': '\uB098\uC774\uD2B8',
    'anti-king': '\uD0B9',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a Wordle-style share text for a completed puzzle.
 *
 * @param {object} board - Board instance with getBoard(), getGiven(), boardSize.
 * @param {string} difficulty - Difficulty key.
 * @param {string} mode - Game mode.
 * @param {string} variant - Variant name.
 * @param {number} time - Time in seconds.
 * @param {number} mistakes - Number of mistakes.
 * @returns {string} Share text.
 */
export function generateShareText(board, difficulty, mode, variant, time, mistakes) {
    const lines = [];

    // Header line
    const emoji = DIFF_EMOJI[difficulty] || '';
    const label = DIFF_LABELS[difficulty] || difficulty;
    lines.push(`\uD83E\uDDE9 \uC2A4\uB3C4\uCFE0 \uB9AC\uADF8 - ${label} ${emoji}`);

    // Variant line (only for non-standard)
    if (variant && variant !== 'standard') {
        const variantName = VARIANT_NAMES[variant] || variant;
        lines.push(`\uBCC0\uD615: ${variantName}`);
    }

    // Mode line (only for time attack)
    if (mode === 'timeAttack') {
        lines.push('\u26A1 \uD0C0\uC784\uC5B4\uD0DD');
    }

    // Stats line
    const timeStr = formatTime(time);
    lines.push(`\u23F1\uFE0F ${timeStr} | \uC2E4\uC218 ${mistakes}`);

    lines.push('');

    // Generate emoji grid
    const boardSize = board.boardSize || 9;
    const given = board.getGiven();

    if (given) {
        for (let r = 0; r < boardSize; r++) {
            let row = '';
            for (let c = 0; c < boardSize; c++) {
                row += given[r][c] ? '\uD83D\uDFE9' : '\u2B1B';
            }
            lines.push(row);
        }
    }

    return lines.join('\n');
}

/**
 * Share result text via Web Share API or clipboard fallback.
 *
 * @param {string} text - Text to share.
 * @returns {Promise<'shared'|'copied'|'failed'>}
 */
export async function shareResult(text) {
    // Try Web Share API first
    if (navigator.share) {
        try {
            await navigator.share({ text });
            return 'shared';
        } catch {
            // User cancelled or error, fall through to clipboard
        }
    }

    // Clipboard fallback
    try {
        await navigator.clipboard.writeText(text);
        return 'copied';
    } catch {
        // Final fallback: create a temporary textarea
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return 'copied';
        } catch {
            return 'failed';
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format seconds as "M:SS".
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

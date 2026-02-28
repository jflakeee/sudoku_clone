/**
 * Animation Utilities
 *
 * Provides reusable animation helpers for the Sudoku game:
 * - Confetti particle celebration
 * - Score count-up animation
 * - Completion wave animation on the grid
 *
 * @module ui/animations
 */

// ---------------------------------------------------------------------------
// Confetti
// ---------------------------------------------------------------------------

/** Confetti colour palette. */
const CONFETTI_COLORS = [
    '#2979FF', '#FF6D00', '#00C853', '#D500F9',
    '#FFD600', '#FF1744', '#00B0FF', '#76FF03',
];

/**
 * Create a burst of confetti particles inside the given container.
 *
 * Each particle is an absolutely positioned `<div>` with random colour,
 * size, starting position, and animation delay. The particles are removed
 * from the DOM after their animation ends.
 *
 * @param {HTMLElement} container - The DOM element to append particles to.
 * @param {number}      [count=50] - Number of confetti pieces to create.
 */
export function createConfetti(container, count = 50) {
    if (!container) return;

    // Ensure container is positioned for absolute children
    const computedPos = getComputedStyle(container).position;
    if (computedPos === 'static') {
        container.style.position = 'relative';
    }

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';

        // Random colour
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];

        // Random size between 6px and 12px
        const size = 6 + Math.random() * 6;

        // Random horizontal start position (0-100%)
        const startX = Math.random() * 100;

        // Random animation delay (0-1s) and duration (1.5-3s)
        const delay = Math.random() * 1;
        const duration = 1.5 + Math.random() * 1.5;

        // Random rotation
        const rotation = Math.random() * 360;

        // Random shape: ~50% square, ~50% circle
        const borderRadius = Math.random() > 0.5 ? '50%' : '2px';

        Object.assign(particle.style, {
            position: 'absolute',
            left: `${startX}%`,
            top: '-10px',
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            borderRadius: borderRadius,
            opacity: '1',
            transform: `rotate(${rotation}deg)`,
            animation: `confetti-fall ${duration}s ease-out ${delay}s forwards`,
            pointerEvents: 'none',
            zIndex: '1000',
        });

        container.appendChild(particle);

        // Remove particle after animation completes
        const totalTime = (duration + delay) * 1000 + 100;
        setTimeout(() => {
            if (particle.parentElement) {
                particle.remove();
            }
        }, totalTime);
    }

    // Inject keyframes if not already present
    injectConfettiKeyframes();
}

/**
 * Inject the CSS @keyframes for confetti-fall animation if they haven't
 * been added to the document yet.
 */
function injectConfettiKeyframes() {
    if (document.getElementById('confetti-keyframes')) return;

    const style = document.createElement('style');
    style.id = 'confetti-keyframes';
    style.textContent = `
        @keyframes confetti-fall {
            0% {
                transform: translateY(0) rotate(0deg) scale(1);
                opacity: 1;
            }
            25% {
                transform: translateY(25vh) translateX(${randomSign()}${20 + Math.random() * 30}px) rotate(${90 + Math.random() * 180}deg) scale(1);
                opacity: 1;
            }
            75% {
                opacity: 0.7;
            }
            100% {
                transform: translateY(80vh) translateX(${randomSign()}${40 + Math.random() * 60}px) rotate(${360 + Math.random() * 360}deg) scale(0.3);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Return a random sign character ('+' or '-').
 *
 * @returns {string}
 */
function randomSign() {
    return Math.random() > 0.5 ? '' : '-';
}

// ---------------------------------------------------------------------------
// Score count-up
// ---------------------------------------------------------------------------

/**
 * Animate a numeric value from 0 to the target score inside an element.
 *
 * Uses `requestAnimationFrame` for smooth 60fps animation with an
 * ease-out timing function.
 *
 * @param {HTMLElement} element      - The element whose `textContent` will be updated.
 * @param {number}      targetScore  - The final score to display.
 * @param {number}      [duration=1500] - Animation duration in milliseconds.
 */
export function animateScoreCountUp(element, targetScore, duration = 1500) {
    if (!element || targetScore <= 0) {
        if (element) element.textContent = String(targetScore || 0);
        return;
    }

    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic: 1 - (1-t)^3
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        const current = Math.floor(easedProgress * targetScore);
        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            element.textContent = targetScore.toLocaleString();
        }
    }

    requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Completion wave
// ---------------------------------------------------------------------------

/**
 * Trigger a wave animation across all grid cells, then invoke a callback.
 *
 * Each cell receives the `.wave` CSS class with a staggered delay so that
 * the animation radiates outward from the top-left. The callback is fired
 * after the last cell's animation finishes.
 *
 * @param {object}   gridUI   - The GridUI instance (must expose `getCellElement(row, col)`).
 * @param {Function} [callback] - Called after the full wave completes.
 */
export function animateCompletionWave(gridUI, callback) {
    if (!gridUI) {
        if (callback) callback();
        return;
    }

    const CELL_DELAY = 30; // ms between each cell
    const CELL_ANIM_DURATION = 400; // ms for each cell's animation
    let maxDelay = 0;

    const gridSize = gridUI._gridSize || 9;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cellEl = gridUI.getCell
                ? gridUI.getCell(r, c)
                : null;

            if (!cellEl) continue;

            const delay = (r + c) * CELL_DELAY;
            if (delay > maxDelay) maxDelay = delay;

            setTimeout(() => {
                cellEl.classList.add('wave');
            }, delay);

            // Remove class after animation
            setTimeout(() => {
                cellEl.classList.remove('wave');
            }, delay + CELL_ANIM_DURATION);
        }
    }

    // Fire callback after the last cell finishes
    const totalDuration = maxDelay + CELL_ANIM_DURATION + 100;
    if (callback) {
        setTimeout(callback, totalDuration);
    }

    // Inject wave keyframes if needed
    injectWaveKeyframes();
}

/**
 * Inject the CSS @keyframes for the wave animation if not already present.
 */
function injectWaveKeyframes() {
    if (document.getElementById('wave-keyframes')) return;

    const style = document.createElement('style');
    style.id = 'wave-keyframes';
    style.textContent = `
        .cell.wave {
            animation: cell-wave 0.4s ease-out forwards;
        }

        @keyframes cell-wave {
            0% {
                background-color: inherit;
                transform: scale(1);
            }
            50% {
                background-color: #5C7AEA;
                transform: scale(1.1);
            }
            100% {
                background-color: #7C9CF5;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
}

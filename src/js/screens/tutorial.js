/**
 * Interactive Tutorial Screen
 *
 * A step-by-step interactive tutorial that teaches sudoku basics
 * using 4x4 mini puzzles. Each step highlights a target cell and
 * waits for the correct input.
 *
 * @module screens/tutorial
 */

// ---------------------------------------------------------------------------
// Tutorial step definitions
// ---------------------------------------------------------------------------

const TUTORIAL_STEPS = [
    {
        title: '행 규칙',
        description: '각 행에는 1~4가 한 번씩만 들어갑니다. 빈 칸에 빠진 숫자를 찾아보세요.',
        board: [
            [1, 0, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        solution: [
            [1, 2, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        targetCell: { row: 0, col: 1 },
        targetValue: 2,
        hint: '첫 번째 행에 1, 3, 4가 있습니다. 빠진 숫자는?',
    },
    {
        title: '열 규칙',
        description: '각 열에도 1~4가 한 번씩만 들어갑니다.',
        board: [
            [1, 2, 3, 4],
            [3, 4, 0, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        solution: [
            [1, 2, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        targetCell: { row: 1, col: 2 },
        targetValue: 1,
        hint: '세 번째 열을 보세요: 3, ?, 4, 2. 빠진 숫자는?',
    },
    {
        title: '블록 규칙',
        description: '각 2x2 블록에도 1~4가 한 번씩만 들어갑니다.',
        board: [
            [1, 2, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 0],
            [4, 1, 2, 3],
        ],
        solution: [
            [1, 2, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        targetCell: { row: 2, col: 3 },
        targetValue: 1,
        hint: '오른쪽 아래 블록: 4, ?, 2, 3. 빠진 숫자는?',
    },
    {
        title: '종합 연습',
        description: '행, 열, 블록을 모두 살펴보고 빈 칸을 채워보세요.',
        board: [
            [0, 2, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        solution: [
            [1, 2, 3, 4],
            [3, 4, 1, 2],
            [2, 3, 4, 1],
            [4, 1, 2, 3],
        ],
        targetCell: { row: 0, col: 0 },
        targetValue: 1,
        hint: '행, 열, 블록 규칙을 모두 적용해보세요!',
    },
    {
        title: '튜토리얼 완료!',
        description: '스도쿠의 기본 규칙을 모두 배웠습니다. 이제 게임을 시작해보세요!',
        isComplete: true,
    },
];

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {number} Current step index (0-based). */
let _currentStep = 0;

/** @type {HTMLElement|null} */
let _contentEl = null;

/** @type {HTMLElement|null} */
let _progressEl = null;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the current tutorial step.
 */
function renderStep() {
    if (!_contentEl) return;

    const step = TUTORIAL_STEPS[_currentStep];
    if (!step) return;

    // Update progress
    if (_progressEl) {
        _progressEl.textContent = `${_currentStep + 1}/${TUTORIAL_STEPS.length}`;
    }

    if (step.isComplete) {
        renderCompletionStep(step);
        return;
    }

    const boardSize = 4;
    const cellSize = 64;
    const gridPx = boardSize * cellSize;

    let html = `
        <div class="tutorial-step-header">
            <h3 class="tutorial-step-title">${step.title}</h3>
            <p class="tutorial-step-desc">${step.description}</p>
        </div>
        <div class="tutorial-grid-wrap">
            <div class="tutorial-mini-grid" style="grid-template-columns: repeat(${boardSize}, ${cellSize}px); grid-template-rows: repeat(${boardSize}, ${cellSize}px); width: ${gridPx}px;">
    `;

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const val = step.board[r][c];
            const isTarget = step.targetCell.row === r && step.targetCell.col === c;
            const isGiven = val > 0;

            let classes = 't-cell';
            if (isGiven) classes += ' given';
            if (isTarget) classes += ' target';

            // Add thicker borders for 2x2 blocks
            let style = '';
            if (c === 2) style += 'border-left-width: 3px;';
            if (r === 2) style += 'border-top-width: 3px;';

            html += `<div class="${classes}" data-row="${r}" data-col="${c}" style="${style}">${isGiven ? val : ''}</div>`;
        }
    }

    html += `
            </div>
        </div>
        <div class="tutorial-hint-box">${step.hint}</div>
        <div class="tutorial-numberpad-mini">
    `;

    for (let n = 1; n <= boardSize; n++) {
        const isAnswer = n === step.targetValue;
        html += `<button class="t-num-btn${isAnswer ? ' correct-hint' : ''}" data-tnum="${n}">${n}</button>`;
    }

    html += '</div>';
    _contentEl.innerHTML = html;

    // Attach click handlers to numberpad
    _contentEl.querySelectorAll('.t-num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.getAttribute('data-tnum'), 10);
            handleInput(num);
        });
    });
}

/**
 * Render the completion step.
 *
 * @param {object} step
 */
function renderCompletionStep(step) {
    _contentEl.innerHTML = `
        <div class="tutorial-step-header">
            <div class="tutorial-complete-icon">&#x1F389;</div>
            <h3 class="tutorial-step-title">${step.title}</h3>
            <p class="tutorial-complete-msg">${step.description}</p>
        </div>
        <button class="btn btn-primary" id="btn-tutorial-start-game">새 게임 시작</button>
    `;

    const startBtn = _contentEl.querySelector('#btn-tutorial-start-game');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (_app) _app.navigate('mode-select');
        });
    }
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

/**
 * Handle number button input for the current step.
 *
 * @param {number} num
 */
function handleInput(num) {
    const step = TUTORIAL_STEPS[_currentStep];
    if (!step || step.isComplete) return;

    if (num === step.targetValue) {
        // Correct!
        const targetEl = _contentEl?.querySelector('.t-cell.target');
        if (targetEl) {
            targetEl.textContent = String(num);
            targetEl.classList.remove('target');
            targetEl.classList.add('correct');
        }

        // Advance to next step after a brief delay
        setTimeout(() => {
            _currentStep++;
            if (_currentStep < TUTORIAL_STEPS.length) {
                renderStep();
            }
        }, 600);
    } else {
        // Wrong - shake the target cell
        const targetEl = _contentEl?.querySelector('.t-cell.target');
        if (targetEl) {
            targetEl.style.animation = 'none';
            targetEl.offsetHeight; // Force reflow
            targetEl.style.animation = '';
            targetEl.classList.add('shake');
            setTimeout(() => targetEl.classList.remove('shake'), 400);
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the interactive tutorial screen.
 *
 * @param {object} app - Application context.
 */
export function initTutorialScreen(app) {
    _app = app;

    _contentEl = document.getElementById('tutorial-content');
    _progressEl = document.querySelector('.tutorial-progress');

    // Skip button
    const skipBtn = document.getElementById('btn-tutorial-skip');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            if (_app) _app.navigate('profile');
        });
    }

    // Re-render on screen show (reset to step 0)
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'tutorial') {
            _currentStep = 0;
            renderStep();
        }
    });
}

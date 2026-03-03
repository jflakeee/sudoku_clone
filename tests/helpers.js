/**
 * Shared test helpers for Sudoku E2E tests.
 */

/**
 * Clear localStorage and navigate to the app.
 * @param {import('@playwright/test').Page} page
 */
async function resetApp(page) {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#screen-main.active');
}

/**
 * Navigate to a specific screen via the UI.
 * @param {import('@playwright/test').Page} page
 * @param {string} screenName
 */
async function navigateToScreen(page, screenName) {
    const navTab = page.locator(`.nav-tab[data-navigate="${screenName}"]`);
    if (await navTab.isVisible()) {
        await navTab.click();
    }
    await page.waitForSelector(`#screen-${screenName}.active`);
}

/**
 * Start a new game at the given difficulty.
 * @param {import('@playwright/test').Page} page
 * @param {string} difficulty
 * @param {object} [options]
 * @param {string} [options.mode] - 'classic' or 'timeAttack'
 * @param {number} [options.duration] - time attack duration in seconds
 * @param {number} [options.boardSize] - board size (4, 6, 9, 12, 16)
 */
async function startNewGame(page, difficulty = 'easy', options = {}) {
    const { mode = 'classic', duration, boardSize, variant } = options;

    await page.click('.btn-new-game');
    await page.waitForSelector('#screen-mode-select.active');

    // Select mode if not classic
    if (mode !== 'classic') {
        await page.click(`.game-mode-option[data-game-mode="${mode}"]`);
    }

    // Select time attack duration
    if (mode === 'timeAttack' && duration) {
        await page.click(`.time-option[data-duration="${duration}"]`);
    }

    // Select board size if not default 9
    if (boardSize && boardSize !== 9) {
        const sizeBtn = page.locator(`.size-option[data-size="${boardSize}"]`);
        if (await sizeBtn.isVisible()) {
            await sizeBtn.click();
        }
    }

    // Select variant if not standard
    if (variant && variant !== 'standard') {
        await page.click(`.variant-option[data-variant="${variant}"]`);
    }

    await page.click('[data-action="select-mode"]');
    await page.waitForSelector('#difficulty-modal', { state: 'visible' });
    await page.click(`.difficulty-option[data-difficulty="${difficulty}"]`);
    await page.waitForSelector('#screen-game.active', { timeout: 15000 });
}

/**
 * Get the app module from the page context.
 * Returns a handle that can access app state.
 * @param {import('@playwright/test').Page} page
 */
async function getAppState(page) {
    return page.evaluate(async () => {
        const mod = await import('./js/app.js');
        const app = mod.default;
        return {
            boardEmpty: app.board.getBoard().flat().filter(v => v === 0).length,
            score: app.board.getScore(),
            mistakes: app.board.getMistakes(),
            difficulty: app.board.getDifficulty(),
        };
    });
}

/**
 * Fill all empty cells with the solution to complete the game.
 * Supports dynamic board sizes.
 * @param {import('@playwright/test').Page} page
 */
async function solveEntirePuzzle(page) {
    await page.evaluate(async () => {
        const mod = await import('./js/app.js');
        const app = mod.default;
        const board = app.board.getBoard();
        const solution = app.board.getSolution();
        const size = app.board.boardSize || 9;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 0) {
                    app.input.selectCell(r, c);
                    app.input.inputNumber(solution[r][c]);
                }
            }
        }
    });
}

module.exports = { resetApp, navigateToScreen, startNewGame, getAppState, solveEntirePuzzle };

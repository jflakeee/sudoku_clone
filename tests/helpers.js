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
 */
async function startNewGame(page, difficulty = 'easy') {
    await page.click('.btn-new-game');
    await page.waitForSelector('#difficulty-modal', { state: 'visible' });
    await page.click(`.difficulty-option[data-difficulty="${difficulty}"]`);
    await page.waitForSelector('#screen-game.active');
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
 * @param {import('@playwright/test').Page} page
 */
async function solveEntirePuzzle(page) {
    await page.evaluate(async () => {
        const mod = await import('./js/app.js');
        const app = mod.default;
        const board = app.board.getBoard();
        const solution = app.board.getSolution();

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    app.input.selectCell(r, c);
                    app.input.inputNumber(solution[r][c]);
                }
            }
        }
    });
}

module.exports = { resetApp, navigateToScreen, startNewGame, getAppState, solveEntirePuzzle };

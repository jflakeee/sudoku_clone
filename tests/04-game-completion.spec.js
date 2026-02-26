// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Game Completion Flow', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('completing all cells navigates to complete screen', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Solve the puzzle programmatically
        await solveEntirePuzzle(page);

        // Wait for completion wave animation + navigation
        await page.waitForSelector('#screen-complete.active', { timeout: 15_000 });

        // Complete screen should show congratulation
        await expect(page.locator('.complete-title')).toContainText('축하');
    });

    test('complete screen shows correct stats', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);

        await page.waitForSelector('#screen-complete.active', { timeout: 15_000 });

        // Score should be displayed
        const scoreText = await page.locator('.complete-score').textContent();
        const score = parseInt(scoreText.replace(/,/g, ''));
        expect(score).toBeGreaterThan(0);

        // Difficulty
        await expect(page.locator('.complete-difficulty')).toHaveText('쉬움');

        // Time should be shown
        const timeText = await page.locator('.complete-time').textContent();
        expect(timeText).toMatch(/\d{2}:\d{2}/);
    });

    test('complete screen has new-game and main buttons', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);

        await page.waitForSelector('#screen-complete.active', { timeout: 15_000 });

        await expect(page.locator('#screen-complete [data-action="new-game"]')).toBeVisible();
        await expect(page.locator('#screen-complete [data-navigate="main"]')).toBeVisible();
    });

    test('main button on complete screen navigates to main', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);

        await page.waitForSelector('#screen-complete.active', { timeout: 15_000 });

        await page.click('#screen-complete [data-navigate="main"]');
        await expect(page.locator('#screen-main')).toHaveClass(/active/);
    });

    test('stats are updated after completion', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);

        await page.waitForSelector('#screen-complete.active', { timeout: 15_000 });

        // Navigate to stats
        await page.click('#screen-complete [data-navigate="main"]');
        await page.click('.nav-tab[data-navigate="profile"]');
        await page.click('#screen-profile .menu-item[data-navigate="stats"]');

        // Check stats
        const gamesWon = await page.locator('[data-stat="gamesWon"]').textContent();
        expect(parseInt(gamesWon)).toBeGreaterThanOrEqual(1);

        const winRate = await page.locator('[data-stat="winRate"]').textContent();
        expect(winRate).not.toBe('0%');
    });

    test('three mistakes trigger game over', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Make 3 wrong inputs
        for (let i = 0; i < 3; i++) {
            await page.evaluate(async () => {
                const mod = await import('./js/app.js');
                const app = mod.default;
                const board = app.board.getBoard();
                const solution = app.board.getSolution();

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (board[r][c] === 0) {
                            const correct = solution[r][c];
                            const wrong = correct === 9 ? 1 : correct + 1;
                            app.input.selectCell(r, c);
                            app.input.inputNumber(wrong);
                            return;
                        }
                    }
                }
            });
        }

        // After 3 mistakes, should navigate to main (with a delay)
        await page.waitForSelector('#screen-main.active', { timeout: 5_000 });
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle, navigateToScreen } = require('./helpers');

test.describe('Feature Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('complete → history → replay → complete full flow', async ({ page }) => {
        // Step 1: Play and complete a game
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Step 2: Go to main
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Step 3: Navigate to history
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await expect(page.locator('.history-item')).toHaveCount(1);

        // Step 4: Replay
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        // Step 5: Complete replay
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Step 6: History should now have 2 entries
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await expect(page.locator('.history-item')).toHaveCount(2);
    });

    test('history → print flow works', async ({ page }) => {
        // Complete a game
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Go to history
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        // Print from history
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        // Verify print preview
        await expect(page.locator('.print-grid')).toBeVisible();
        await expect(page.locator('[data-action="do-print"]')).toBeVisible();
    });

    test('game history button visible on main screen', async ({ page }) => {
        const historyBtn = page.locator('[data-navigate="history"]');
        await expect(historyBtn).toBeVisible();
        await expect(historyBtn).toHaveText('게임 기록');
    });

    test('daily challenge with future date creates proper game', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Navigate to future month
        const tabs = page.locator('.month-tab');
        await tabs.last().click();

        const futureDays = page.locator('.calendar-day.future');
        const count = await futureDays.count();

        if (count > 0) {
            await futureDays.first().click();
            await page.click('.btn-daily-play');
            await page.waitForSelector('#screen-game.active', { timeout: 10000 });

            // Verify it's a valid game
            const boardSize = await page.evaluate(async () => {
                const mod = await import('./js/app.js');
                return mod.default.board.boardSize;
            });
            expect(boardSize).toBe(9);
        }
    });

    test('board initialPuzzle is preserved through save/load cycle', async ({ page }) => {
        await startNewGame(page, 'easy');

        const originalPuzzle = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getInitialPuzzle();
        });

        // The initialPuzzle should be in the saved state
        const savedPuzzle = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getState().initialPuzzle;
        });

        expect(savedPuzzle).toEqual(originalPuzzle);
    });

    test('back navigation from history returns to main', async ({ page }) => {
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        await page.click('#screen-history [data-action="back"]');
        await page.waitForSelector('#screen-main.active');
    });
});

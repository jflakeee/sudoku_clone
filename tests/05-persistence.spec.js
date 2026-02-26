// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Persistence & Save/Restore', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('game state is auto-saved to localStorage', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Make a move
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
                        return;
                    }
                }
            }
        });

        // Check that localStorage has saved game
        const hasSave = await page.evaluate(() => {
            return localStorage.getItem('sudoku_currentGame') !== null;
        });
        expect(hasSave).toBe(true);
    });

    test('continue button appears on main screen when game is saved', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Make a move so it saves
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
                        return;
                    }
                }
            }
        });

        // Go back to main
        await page.click('#screen-game [data-action="back"]');
        await page.waitForSelector('#screen-main.active');

        // Continue button should be visible
        await expect(page.locator('.btn-continue-game')).toBeVisible();
    });

    test('continue button restores the saved game', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Make a move and remember the score
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
                        return;
                    }
                }
            }
        });

        // Go back to main
        await page.click('#screen-game [data-action="back"]');
        await page.waitForSelector('#screen-main.active');

        // Click continue
        await page.click('.btn-continue-game');
        await page.waitForSelector('#screen-game.active');

        // Score should be restored (not 0)
        const score = await page.locator('.score-value').textContent();
        expect(parseInt(score.replace(/,/g, ''))).toBeGreaterThan(0);
    });

    test('settings persist across page reload', async ({ page }) => {
        // Navigate to settings and toggle sound off
        await page.click('.nav-tab[data-navigate="profile"]');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        // Toggle sound off (click the label since input is hidden by CSS)
        await page.locator('#screen-settings input[data-setting="sound"]').evaluate(el => el.click());

        // Reload page
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        // Check setting was persisted
        const soundSetting = await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            return settings.sound;
        });
        expect(soundSetting).toBe(false);
    });
});

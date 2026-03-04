// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, navigateToScreen } = require('./helpers');

/**
 * Navigate to settings screen via profile menu.
 */
async function goToSettings(page) {
    await navigateToScreen(page, 'profile');
    await page.click('#screen-profile .menu-item[data-navigate="settings"]');
    await page.waitForSelector('#screen-settings.active');
}

test.describe('Auto-check Mistakes', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('autoCheckMistakes setting toggle exists in settings', async ({ page }) => {
        await goToSettings(page);
        const toggle = page.locator('input[data-setting="autoCheckMistakes"]');
        await expect(toggle).toBeAttached();
    });

    test('autoCheckMistakes is off by default', async ({ page }) => {
        await goToSettings(page);
        const toggle = page.locator('input[data-setting="autoCheckMistakes"]');
        await expect(toggle).not.toBeChecked();
    });

    test('can toggle autoCheckMistakes on and off', async ({ page }) => {
        await goToSettings(page);

        // The input is hidden by CSS toggle-switch, click its parent label
        const toggleLabel = page.locator('input[data-setting="autoCheckMistakes"]').locator('..');
        const toggleInput = page.locator('input[data-setting="autoCheckMistakes"]');

        // Turn on
        await toggleLabel.click();
        await expect(toggleInput).toBeChecked();

        // Turn off
        await toggleLabel.click();
        await expect(toggleInput).not.toBeChecked();
    });

    test('wrong input shows auto-mistake class when setting is ON', async ({ page }) => {
        // Enable auto-check mistakes via localStorage
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            settings.autoCheckMistakes = true;
            localStorage.setItem('sudoku_settings', JSON.stringify(settings));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await startNewGame(page, 'easy');

        // Find an empty cell and input a wrong number
        const hasAutoMistake = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize || 9;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && !app.board.isGiven(r, c)) {
                        const correctNum = solution[r][c];
                        const wrongNum = correctNum === size ? 1 : correctNum + 1;

                        app.input.selectCell(r, c);
                        app.input.inputNumber(wrongNum);

                        const cell = app.gridUI.getCell(r, c);
                        return cell.classList.contains('auto-mistake');
                    }
                }
            }
            return false;
        });

        expect(hasAutoMistake).toBe(true);
    });

    test('correct input does not show auto-mistake class when setting is ON', async ({ page }) => {
        // Enable auto-check mistakes via localStorage
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            settings.autoCheckMistakes = true;
            localStorage.setItem('sudoku_settings', JSON.stringify(settings));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await startNewGame(page, 'easy');

        const hasAutoMistake = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize || 9;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && !app.board.isGiven(r, c)) {
                        const correctNum = solution[r][c];

                        app.input.selectCell(r, c);
                        app.input.inputNumber(correctNum);

                        const cell = app.gridUI.getCell(r, c);
                        return cell.classList.contains('auto-mistake');
                    }
                }
            }
            return false;
        });

        expect(hasAutoMistake).toBe(false);
    });

    test('wrong input does NOT show auto-mistake class when setting is OFF', async ({ page }) => {
        // Ensure autoCheckMistakes is OFF (default)
        await startNewGame(page, 'easy');

        const hasAutoMistake = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize || 9;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && !app.board.isGiven(r, c)) {
                        const correctNum = solution[r][c];
                        const wrongNum = correctNum === size ? 1 : correctNum + 1;

                        app.input.selectCell(r, c);
                        app.input.inputNumber(wrongNum);

                        const cell = app.gridUI.getCell(r, c);
                        return cell.classList.contains('auto-mistake');
                    }
                }
            }
            return false;
        });

        expect(hasAutoMistake).toBe(false);
    });

    test('setting persists across page reloads', async ({ page }) => {
        // Enable via localStorage
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            settings.autoCheckMistakes = true;
            localStorage.setItem('sudoku_settings', JSON.stringify(settings));
        });

        // Reload page
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        // Check setting is still on
        await goToSettings(page);
        const toggle = page.locator('input[data-setting="autoCheckMistakes"]');
        await expect(toggle).toBeChecked();
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Keyboard Input', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('number key 1-9 inputs correct value into selected cell', async ({ page }) => {
        // Find an empty cell and its correct value
        const cellInfo = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) {
                        return { row: r, col: c, value: solution[r][c] };
                    }
                }
            }
            return null;
        });

        if (!cellInfo) return;

        // Click cell to select it
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);

        // Press the correct number key
        await page.keyboard.press(String(cellInfo.value));

        // Cell should now have the value
        const cellValue = page.locator(
            `.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"] .cell-value`
        );
        await expect(cellValue).toHaveText(String(cellInfo.value));
    });

    test('arrow keys move cell selection', async ({ page }) => {
        // Select center cell (4,4) first
        await page.click('.cell[data-row="4"][data-col="4"]');

        // Press ArrowRight
        await page.keyboard.press('ArrowRight');

        // Cell (4,5) should be selected
        const selectedCell = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const sel = app.input.getSelectedCell();
            return sel ? { row: sel.row, col: sel.col } : null;
        });

        expect(selectedCell).toEqual({ row: 4, col: 5 });
    });

    test('arrow keys navigate in all directions', async ({ page }) => {
        // Select center cell
        await page.click('.cell[data-row="4"][data-col="4"]');

        // Press ArrowDown
        await page.keyboard.press('ArrowDown');
        let sel = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.input.getSelectedCell();
        });
        expect(sel).toEqual({ row: 5, col: 4 });

        // Press ArrowLeft
        await page.keyboard.press('ArrowLeft');
        sel = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.input.getSelectedCell();
        });
        expect(sel).toEqual({ row: 5, col: 3 });

        // Press ArrowUp
        await page.keyboard.press('ArrowUp');
        sel = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.input.getSelectedCell();
        });
        expect(sel).toEqual({ row: 4, col: 3 });
    });

    test('Backspace erases user input', async ({ page }) => {
        const cellInfo = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) {
                        return { row: r, col: c, value: solution[r][c] };
                    }
                }
            }
            return null;
        });

        if (!cellInfo) return;

        // Input a number
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        await page.keyboard.press(String(cellInfo.value));

        // Verify placed
        const cellValue = page.locator(
            `.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"] .cell-value`
        );
        await expect(cellValue).toHaveText(String(cellInfo.value));

        // Press Backspace to erase
        await page.keyboard.press('Backspace');
        await expect(cellValue).toHaveText('');
    });

    test('Ctrl+Z undoes last action', async ({ page }) => {
        const cellInfo = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) {
                        return { row: r, col: c, value: solution[r][c] };
                    }
                }
            }
            return null;
        });

        if (!cellInfo) return;

        // Input a number via keyboard
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        await page.keyboard.press(String(cellInfo.value));

        const cellValue = page.locator(
            `.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"] .cell-value`
        );
        await expect(cellValue).toHaveText(String(cellInfo.value));

        // Ctrl+Z
        await page.keyboard.press('Control+z');
        await expect(cellValue).toHaveText('');
    });

    test('N key toggles notes mode', async ({ page }) => {
        // Notes should be off initially
        const noteBtn = page.locator('[data-action="notes"]');
        await expect(noteBtn).not.toHaveClass(/active/);

        // Press N
        await page.keyboard.press('n');
        await expect(noteBtn).toHaveClass(/active/);

        // Press N again to toggle off
        await page.keyboard.press('n');
        await expect(noteBtn).not.toHaveClass(/active/);
    });

    test('Escape key deselects cell', async ({ page }) => {
        // Select a cell
        await page.click('.cell[data-row="4"][data-col="4"]');

        // Press Escape
        await page.keyboard.press('Escape');

        // No cell should be selected (returns null or {row: -1, col: -1})
        const sel = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.input.getSelectedCell();
        });
        const isDeselected = sel === null || (sel.row === -1 && sel.col === -1);
        expect(isDeselected).toBe(true);
    });

    test('keyboard input does not work outside game screen', async ({ page }) => {
        // Go back to main screen
        await page.click('#screen-game [data-action="back"]');
        await page.waitForSelector('#screen-main.active');

        // Press a number key - should not cause errors
        await page.keyboard.press('1');

        // Verify still on main screen
        await expect(page.locator('#screen-main')).toHaveClass(/active/);
    });
});

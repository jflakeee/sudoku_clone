// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Input & Toolbar', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('correct number input shows user-input style and adds score', async ({ page }) => {
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

        // Click the empty cell
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);

        // Click the correct number on the numpad
        await page.click(`.num-btn[data-number="${cellInfo.value}"]`);

        // Cell should have user-input class
        await expect(
            page.locator(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`)
        ).toHaveClass(/user-input/);

        // Score should increase
        const score = await page.locator('.score-value').textContent();
        expect(parseInt(score.replace(/,/g, ''))).toBeGreaterThan(0);

        // Mistakes should stay 0/3
        await expect(page.locator('.mistakes-value')).toHaveText('0/3');
    });

    test('wrong number input shows error and increments mistakes', async ({ page }) => {
        const cellInfo = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) {
                        // Find a wrong value
                        const correct = solution[r][c];
                        const wrong = correct === 9 ? 1 : correct + 1;
                        return { row: r, col: c, correct, wrong };
                    }
                }
            }
            return null;
        });

        if (!cellInfo) return;

        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        await page.click(`.num-btn[data-number="${cellInfo.wrong}"]`);

        // Cell should have error class
        await expect(
            page.locator(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`)
        ).toHaveClass(/error/);

        // Mistakes should be 1/3
        await expect(page.locator('.mistakes-value')).toHaveText('1/3');
    });

    test('undo reverts the last action', async ({ page }) => {
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
        await page.click(`.num-btn[data-number="${cellInfo.value}"]`);

        // Verify it was placed
        const cellValue = page.locator(
            `.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"] .cell-value`
        );
        await expect(cellValue).toHaveText(String(cellInfo.value));

        // Undo
        await page.click('[data-action="undo"]');

        // Cell should be empty again
        await expect(cellValue).toHaveText('');
    });

    test('erase removes a user-input value', async ({ page }) => {
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

        // Place a number
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        await page.click(`.num-btn[data-number="${cellInfo.value}"]`);

        // Select the cell again and erase
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        await page.click('[data-action="erase"]');

        // Cell should be empty
        const cellValue = page.locator(
            `.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"] .cell-value`
        );
        await expect(cellValue).toHaveText('');
    });

    test('notes mode toggles and places pencil marks', async ({ page }) => {
        const cellInfo = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) return { row: r, col: c };
                }
            }
            return null;
        });

        if (!cellInfo) return;

        // Toggle notes on
        await page.click('[data-action="notes"]');
        await expect(page.locator('[data-action="notes"]')).toHaveClass(/active/);

        // Select empty cell and add notes
        await page.click(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        await page.click('.num-btn[data-number="1"]');
        await page.click('.num-btn[data-number="5"]');

        // Check notes are displayed
        const cell = page.locator(`.cell[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
        const notesContainer = cell.locator('.cell-notes');
        await expect(notesContainer).toBeVisible();
        await expect(cell.locator('.note-1')).toHaveText('1');
        await expect(cell.locator('.note-5')).toHaveText('5');
        await expect(cell.locator('.note-3')).toHaveText('');
    });

    test('hint fills a correct cell and decrements hint count', async ({ page }) => {
        // Find an empty cell to select first
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();

            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) {
                        app.input.selectCell(r, c);
                        return;
                    }
                }
            }
        });

        // Check initial hint count
        const badge = page.locator('.tool-badge');
        await expect(badge).toHaveText('3');

        // Use hint
        await page.click('[data-action="hint"]');

        // Hint count should decrease
        await expect(badge).toHaveText('2');
    });
});

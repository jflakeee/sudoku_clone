// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Game Basics', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('game screen shows correct initial state', async ({ page }) => {
        await expect(page.locator('.difficulty-value')).toHaveText('쉬움');
        await expect(page.locator('.mistakes-value')).toHaveText('0/3');
        await expect(page.locator('.score-value')).toHaveText('0');
    });

    test('grid renders 81 cells', async ({ page }) => {
        const cells = page.locator('#sudoku-grid .cell');
        await expect(cells).toHaveCount(81);
    });

    test('given cells have given class', async ({ page }) => {
        const givenCells = page.locator('#sudoku-grid .cell.given');
        const count = await givenCells.count();
        // Easy puzzle: about 36-45 given cells
        expect(count).toBeGreaterThan(30);
        expect(count).toBeLessThan(55);
    });

    test('clicking a cell highlights row, column, and block', async ({ page }) => {
        // Click cell at (0,0)
        await page.click('.cell[data-row="0"][data-col="0"]');

        // Selected cell
        await expect(page.locator('.cell[data-row="0"][data-col="0"]')).toHaveClass(/selected/);

        // Same row cells should be highlighted
        await expect(page.locator('.cell[data-row="0"][data-col="1"]')).toHaveClass(/highlighted/);

        // Same column cells should be highlighted
        await expect(page.locator('.cell[data-row="1"][data-col="0"]')).toHaveClass(/highlighted/);
    });

    test('clicking same number highlights all matching cells', async ({ page }) => {
        // Find a given cell with a known value and click it
        const sameNumberCells = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();

            // Find a value that appears multiple times
            for (let v = 1; v <= 9; v++) {
                let positions = [];
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (board[r][c] === v) positions.push({ r, c });
                    }
                }
                if (positions.length >= 2) {
                    return { value: v, positions };
                }
            }
            return null;
        });

        if (sameNumberCells) {
            const first = sameNumberCells.positions[0];
            await page.click(`.cell[data-row="${first.r}"][data-col="${first.c}"]`);

            // All cells with the same value should have same-number class
            for (const pos of sameNumberCells.positions) {
                await expect(
                    page.locator(`.cell[data-row="${pos.r}"][data-col="${pos.c}"]`)
                ).toHaveClass(/same-number/);
            }
        }
    });

    test('timer starts and updates', async ({ page }) => {
        const timerEl = page.locator('.timer-value');
        const initial = await timerEl.textContent();

        // Wait a bit for timer to tick
        await page.waitForTimeout(2000);
        const updated = await timerEl.textContent();

        expect(updated).not.toBe('00:00');
    });

    test('pause overlay shows and resumes', async ({ page }) => {
        const pauseOverlay = page.locator('#pause-overlay');

        // Click pause button
        await page.click('[data-action="pause"]');
        await expect(pauseOverlay).toBeVisible();

        // Click resume
        await page.click('[data-action="resume"]');
        await expect(pauseOverlay).toBeHidden();
    });
});

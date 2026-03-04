/**
 * E2E tests for Game Progress Bar.
 */

const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Progress Bar', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('Progress bar exists in game screen', async ({ page }) => {
        const progressBar = page.locator('.info-progress');
        await expect(progressBar).toBeVisible();
    });

    test('Progress bar has progressbar role', async ({ page }) => {
        const progressBar = page.locator('.info-progress');
        await expect(progressBar).toHaveAttribute('role', 'progressbar');
    });

    test('Progress bar has aria attributes', async ({ page }) => {
        const progressBar = page.locator('.info-progress');
        await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        await expect(progressBar).toHaveAttribute('aria-label', '게임 진행률');
    });

    test('Progress fill element exists', async ({ page }) => {
        const fill = page.locator('.progress-fill');
        await expect(fill).toBeAttached();
    });

    test('Progress starts at 0%', async ({ page }) => {
        const width = await page.evaluate(() => {
            const fill = document.querySelector('.progress-fill');
            return fill ? fill.style.width : null;
        });
        expect(width).toBe('0%');
    });

    test('Progress updates when a cell is filled', async ({ page }) => {
        // Fill one cell with the correct value
        const progressAfter = await page.evaluate(async () => {
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
                        return app.board.getProgress();
                    }
                }
            }
            return 0;
        });

        expect(progressAfter).toBeGreaterThan(0);

        // Check that the DOM reflects the progress
        const fillWidth = await page.evaluate(() => {
            const fill = document.querySelector('.progress-fill');
            return fill ? fill.style.width : null;
        });
        expect(fillWidth).not.toBe('0%');
    });

    test('Board.getProgress returns correct percentage', async ({ page }) => {
        const progress = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.board.getProgress();
        });

        // At start of game with no user input, progress should be 0
        expect(progress).toBe(0);
    });

    test('Progress reaches 100% on completion', async ({ page }) => {
        await solveEntirePuzzle(page);

        // Wait a moment for the event to propagate
        await page.waitForTimeout(500);

        const progress = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.board.getProgress();
        });
        expect(progress).toBe(100);
    });

    test('Progress bar updates when cell is erased', async ({ page }) => {
        // Fill one cell first
        const { row, col } = await page.evaluate(async () => {
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
                        return { row: r, col: c };
                    }
                }
            }
            return { row: 0, col: 0 };
        });

        // Now erase it
        await page.evaluate(async (pos) => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            app.input.selectCell(pos.row, pos.col);
            app.input.erase();
        }, { row, col });

        const progressAfterErase = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.board.getProgress();
        });
        expect(progressAfterErase).toBe(0);
    });
});

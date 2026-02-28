// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Print Screen (F6)', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('print screen accessible from history', async ({ page }) => {
        // Seed a history entry
        await page.evaluate(() => {
            const entries = [{
                id: 'print-test',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                solution: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        await expect(page.locator('#screen-print')).toHaveClass(/active/);
    });

    test('print screen renders puzzle grid', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [{
                id: 'print-render',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                solution: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        // Check that a print grid is rendered
        await expect(page.locator('.print-grid')).toBeVisible();
        await expect(page.locator('.print-grid-header')).toBeVisible();
    });

    test('single layout shows one grid', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [{
                id: 'layout-test',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                solution: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        // Default layout is single
        await expect(page.locator('.print-preview')).toHaveClass(/layout-single/);
        await expect(page.locator('.print-grid-wrapper')).toHaveCount(1);
    });

    test('quad layout shows up to 4 grids', async ({ page }) => {
        await page.evaluate(() => {
            const makePuzzle = () => Array.from({ length: 9 }, (_, r) =>
                Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
            );
            const entries = [1, 2, 3, 4].map(i => ({
                id: `quad-${i}`,
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: makePuzzle(),
                solution: makePuzzle(),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }));
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        // Switch to quad layout
        await page.click('.print-layout-btn[data-layout="quad"]');

        await expect(page.locator('.print-preview')).toHaveClass(/layout-quad/);
        // Only 1 entry was passed so still 1 grid
        await expect(page.locator('.print-grid-wrapper')).toHaveCount(1);
    });

    test('layout toggle buttons work', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [{
                id: 'toggle-test',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                solution: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        // Single layout active by default
        await expect(page.locator('.print-layout-btn[data-layout="single"]')).toHaveClass(/active/);

        // Switch to quad
        await page.click('.print-layout-btn[data-layout="quad"]');
        await expect(page.locator('.print-layout-btn[data-layout="quad"]')).toHaveClass(/active/);
        await expect(page.locator('.print-layout-btn[data-layout="single"]')).not.toHaveClass(/active/);

        // Switch back to single
        await page.click('.print-layout-btn[data-layout="single"]');
        await expect(page.locator('.print-layout-btn[data-layout="single"]')).toHaveClass(/active/);
    });

    test('print screen shows empty message when no entries', async ({ page }) => {
        // Navigate directly to print screen with no entries (via URL hack)
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            mod.default.navigate('print', { entries: [] });
        });
        await page.waitForSelector('#screen-print.active');

        await expect(page.locator('.history-empty')).toBeVisible();
    });

    test('print grid has correct cell count for 9x9', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [{
                id: 'cell-count',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                solution: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        const cellCount = await page.locator('.print-cell').count();
        expect(cellCount).toBe(81); // 9x9
    });

    test('print button exists and is clickable', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [{
                id: 'btn-test',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 9,
                score: 100,
                time: 60,
                mistakes: 0,
                puzzle: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                solution: Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
                ),
                given: Array.from({ length: 9 }, () => Array(9).fill(true)),
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-print-single');
        await page.waitForSelector('#screen-print.active');

        const printBtn = page.locator('[data-action="do-print"]');
        await expect(printBtn).toBeVisible();
        await expect(printBtn).toHaveText('인쇄하기');
    });
});

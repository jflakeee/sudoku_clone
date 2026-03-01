// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Game History Archive', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('completed game is saved to history', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const history = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
        });

        expect(history.length).toBe(1);
        expect(history[0].difficulty).toBe('easy');
        expect(history[0].puzzle).toBeTruthy();
        expect(history[0].solution).toBeTruthy();
        expect(history[0].given).toBeTruthy();
        expect(history[0].id).toBeTruthy();
    });

    test('history entries have required fields', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const entry = await page.evaluate(() => {
            const h = JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
            return h[0];
        });

        expect(entry.id).toBeTruthy();
        expect(entry.date).toBeTruthy();
        expect(entry.difficulty).toBe('easy');
        expect(entry.mode).toBe('classic');
        expect(entry.boardSize).toBe(9);
        expect(typeof entry.score).toBe('number');
        expect(typeof entry.time).toBe('number');
        expect(typeof entry.mistakes).toBe('number');
        expect(Array.isArray(entry.puzzle)).toBe(true);
        expect(Array.isArray(entry.solution)).toBe(true);
    });

    test('multiple games are stored in order (newest first)', async ({ page }) => {
        // Play first game
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Play second game
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const history = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
        });

        expect(history.length).toBe(2);
        // Newest first
        expect(new Date(history[0].date).getTime()).toBeGreaterThanOrEqual(
            new Date(history[1].date).getTime()
        );
    });

    test('history is capped at 200 entries', async ({ page }) => {
        // Seed 205 entries directly
        await page.evaluate(() => {
            const entries = [];
            for (let i = 0; i < 205; i++) {
                entries.push({
                    id: `test-${i}`,
                    date: new Date().toISOString(),
                    difficulty: 'easy',
                    mode: 'classic',
                    boardSize: 9,
                    score: 100,
                    time: 60,
                    mistakes: 0,
                    puzzle: [[1]],
                    solution: [[1]],
                    given: [[true]],
                });
            }
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        // Play one more game to trigger cap
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const count = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]').length;
        });

        expect(count).toBeLessThanOrEqual(200);
    });

    test('history screen shows entries', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        const items = page.locator('.history-item');
        await expect(items).toHaveCount(1);
    });

    test('history screen shows empty message when no entries', async ({ page }) => {
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        await expect(page.locator('.history-empty')).toBeVisible();
    });

    test('storage migration v1→v2 initialises gameHistory', async ({ page }) => {
        // Set version to 1 (pre-migration)
        await page.evaluate(() => {
            localStorage.setItem('sudoku_version', '1');
            localStorage.removeItem('sudoku_gameHistory');
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        const history = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_gameHistory') || 'null');
        });

        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBe(0);
    });

    test('history items have checkboxes for batch selection', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [
                { id: 'chk1', date: new Date().toISOString(), difficulty: 'easy', mode: 'classic', boardSize: 9, score: 100, time: 60, mistakes: 0, puzzle: [[1]], solution: [[1]], given: [[true]] },
                { id: 'chk2', date: new Date().toISOString(), difficulty: 'hard', mode: 'classic', boardSize: 9, score: 200, time: 120, mistakes: 0, puzzle: [[2]], solution: [[2]], given: [[true]] },
            ];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        const checkboxes = page.locator('.history-check');
        await expect(checkboxes).toHaveCount(2);
    });

    test('checking items shows batch print bar', async ({ page }) => {
        await page.evaluate(() => {
            const entries = [
                { id: 'batch1', date: new Date().toISOString(), difficulty: 'easy', mode: 'classic', boardSize: 9, score: 100, time: 60, mistakes: 0, puzzle: [[1]], solution: [[1]], given: [[true]] },
                { id: 'batch2', date: new Date().toISOString(), difficulty: 'hard', mode: 'classic', boardSize: 9, score: 200, time: 120, mistakes: 0, puzzle: [[2]], solution: [[2]], given: [[true]] },
            ];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        // Batch bar should be hidden initially
        await expect(page.locator('#history-batch-bar')).toBeHidden();

        // Check first item
        await page.click('.history-check[data-history-id="batch1"]');
        await expect(page.locator('#history-batch-bar')).toBeVisible();
        await expect(page.locator('#btn-batch-print')).toContainText('1개 인쇄');

        // Check second item
        await page.click('.history-check[data-history-id="batch2"]');
        await expect(page.locator('#btn-batch-print')).toContainText('2개 인쇄');

        // Uncheck first item
        await page.click('.history-check[data-history-id="batch1"]');
        await expect(page.locator('#btn-batch-print')).toContainText('1개 인쇄');
    });

    test('batch print button navigates to print screen', async ({ page }) => {
        await page.evaluate(() => {
            const makePuzzle = () => Array.from({ length: 9 }, (_, r) =>
                Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
            );
            const entries = [
                { id: 'bp1', date: new Date().toISOString(), difficulty: 'easy', mode: 'classic', boardSize: 9, score: 100, time: 60, mistakes: 0, puzzle: makePuzzle(), solution: makePuzzle(), given: Array.from({ length: 9 }, () => Array(9).fill(true)) },
                { id: 'bp2', date: new Date().toISOString(), difficulty: 'hard', mode: 'classic', boardSize: 9, score: 200, time: 120, mistakes: 0, puzzle: makePuzzle(), solution: makePuzzle(), given: Array.from({ length: 9 }, () => Array(9).fill(true)) },
            ];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        // Select both items
        await page.click('.history-check[data-history-id="bp1"]');
        await page.click('.history-check[data-history-id="bp2"]');

        // Click batch print
        await page.click('#btn-batch-print');
        await page.waitForSelector('#screen-print.active');

        await expect(page.locator('#screen-print')).toHaveClass(/active/);
    });

    test('history filter buttons work', async ({ page }) => {
        // Seed history entries with different modes
        await page.evaluate(() => {
            const entries = [
                { id: 'c1', date: new Date().toISOString(), difficulty: 'easy', mode: 'classic', boardSize: 9, score: 100, time: 60, mistakes: 0, puzzle: [[1]], solution: [[1]], given: [[true]] },
                { id: 't1', date: new Date().toISOString(), difficulty: 'easy', mode: 'timeAttack', boardSize: 9, score: 200, time: 120, mistakes: 0, puzzle: [[2]], solution: [[2]], given: [[true]] },
                { id: 'd1', date: new Date().toISOString(), difficulty: 'easy', mode: 'classic', boardSize: 9, score: 150, time: 90, mistakes: 0, puzzle: [[3]], solution: [[3]], given: [[true]], dailyDate: '2026-02-28' },
            ];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        // All filter
        await expect(page.locator('.history-item')).toHaveCount(3);

        // Classic filter
        await page.click('.history-filter[data-filter="classic"]');
        await expect(page.locator('.history-item')).toHaveCount(1);

        // Time attack filter
        await page.click('.history-filter[data-filter="timeAttack"]');
        await expect(page.locator('.history-item')).toHaveCount(1);

        // Daily filter
        await page.click('.history-filter[data-filter="daily"]');
        await expect(page.locator('.history-item')).toHaveCount(1);
    });
});

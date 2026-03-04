// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Streak System', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('game completion starts streak at 1', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const streak = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_streak');
            return raw ? JSON.parse(raw) : null;
        });

        expect(streak).not.toBeNull();
        expect(streak.current).toBe(1);
        expect(streak.best).toBe(1);
        expect(streak.lastDate).toBeTruthy();
    });

    test('streak is displayed on main screen', async ({ page }) => {
        // Set streak data
        await page.evaluate(() => {
            localStorage.setItem('sudoku_streak', JSON.stringify({
                current: 5,
                best: 10,
                lastDate: new Date().toISOString().slice(0, 10),
            }));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        const streakText = await page.locator('.streak-count').textContent();
        expect(streakText).toBe('5');
    });

    test('same day completion does not increase streak', async ({ page }) => {
        // Pre-set streak for today
        const today = new Date().toISOString().slice(0, 10);
        await page.evaluate((todayStr) => {
            localStorage.setItem('sudoku_streak', JSON.stringify({
                current: 3,
                best: 5,
                lastDate: todayStr,
            }));
        }, today);

        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const streak = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_streak');
            return raw ? JSON.parse(raw) : null;
        });

        expect(streak.current).toBe(3); // unchanged
        expect(streak.best).toBe(5);    // unchanged
    });

    test('streak data is persisted to localStorage', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const hasStreak = await page.evaluate(() => {
            return localStorage.getItem('sudoku_streak') !== null;
        });
        expect(hasStreak).toBe(true);

        const streak = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_streak'));
        });
        expect(streak).toHaveProperty('current');
        expect(streak).toHaveProperty('best');
        expect(streak).toHaveProperty('lastDate');
    });

    test('streak is shown on complete screen', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const streakEl = page.locator('.complete-streak');
        await expect(streakEl).toBeVisible();
        const text = await streakEl.textContent();
        expect(text).toContain('1');
        expect(text).toContain('연속');
    });

    test('streak resets when a day is missed', async ({ page }) => {
        // Set streak to 2 days ago (missed yesterday)
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
        await page.evaluate((dateStr) => {
            localStorage.setItem('sudoku_streak', JSON.stringify({
                current: 10,
                best: 15,
                lastDate: dateStr,
            }));
        }, twoDaysAgo);

        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const streak = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_streak'));
        });

        expect(streak.current).toBe(1); // reset
        expect(streak.best).toBe(15);   // best preserved
    });

    test('streak continues from yesterday', async ({ page }) => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        await page.evaluate((dateStr) => {
            localStorage.setItem('sudoku_streak', JSON.stringify({
                current: 5,
                best: 5,
                lastDate: dateStr,
            }));
        }, yesterday);

        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const streak = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('sudoku_streak'));
        });

        expect(streak.current).toBe(6); // continued
        expect(streak.best).toBe(6);    // new best
    });

    test('main screen shows 0 when no streak data exists', async ({ page }) => {
        const streakText = await page.locator('.streak-count').textContent();
        expect(streakText).toBe('0');
    });
});

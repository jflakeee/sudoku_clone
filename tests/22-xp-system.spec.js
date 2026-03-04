// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle, navigateToScreen } = require('./helpers');

test.describe('XP / Level System', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('level badge is visible on main screen', async ({ page }) => {
        const badge = page.locator('#screen-main .level-badge');
        await expect(badge).toBeVisible();
        const levelNum = page.locator('#screen-main .level-number');
        await expect(levelNum).toHaveText('1');
    });

    test('XP is earned after completing a game', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // XP display should be visible
        const xpSection = page.locator('.complete-xp');
        await expect(xpSection).toBeVisible();

        // Should show earned XP
        const xpEarned = page.locator('.xp-earned');
        await expect(xpEarned).toBeVisible();
        const xpText = await xpEarned.textContent();
        expect(xpText).toMatch(/^\+\d+ XP$/);

        // XP should be positive
        const xpAmount = parseInt(xpText.replace(/[^\d]/g, ''), 10);
        expect(xpAmount).toBeGreaterThan(0);
    });

    test('XP bar is shown on complete screen', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const xpBar = page.locator('.xp-bar');
        await expect(xpBar).toBeVisible();

        const xpBarFill = page.locator('.xp-bar-fill');
        await expect(xpBarFill).toBeVisible();
    });

    test('level display shows on complete screen', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const xpLevel = page.locator('.xp-level');
        await expect(xpLevel).toBeVisible();
        const levelText = await xpLevel.textContent();
        expect(levelText).toMatch(/^Lv\. \d+$/);
    });

    test('XP accumulates across games', async ({ page }) => {
        // Play first game
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Read XP from localStorage
        const xpAfterFirst = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_userXP');
            return raw ? JSON.parse(raw).totalXP : 0;
        });
        expect(xpAfterFirst).toBeGreaterThan(0);

        // Go back to main and play another game
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const xpAfterSecond = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_userXP');
            return raw ? JSON.parse(raw).totalXP : 0;
        });
        expect(xpAfterSecond).toBeGreaterThan(xpAfterFirst);
    });

    test('XP calculation varies by difficulty', async ({ page }) => {
        // Play easy game
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const easyXP = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_userXP');
            return raw ? JSON.parse(raw).totalXP : 0;
        });

        // Clear XP and play normal game
        await page.evaluate(() => localStorage.removeItem('sudoku_userXP'));
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');
        await startNewGame(page, 'medium');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const normalXP = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_userXP');
            return raw ? JSON.parse(raw).totalXP : 0;
        });

        // Normal should give more XP than easy
        expect(normalXP).toBeGreaterThan(easyXP);
    });

    test('level badge updates on main screen after earning XP', async ({ page }) => {
        // Set high XP to ensure level > 1
        await page.evaluate(() => {
            localStorage.setItem('sudoku_userXP', JSON.stringify({ totalXP: 5000 }));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        const levelNum = page.locator('#screen-main .level-number');
        const level = await levelNum.textContent();
        expect(parseInt(level, 10)).toBeGreaterThan(1);
    });

    test('profile screen shows XP progress', async ({ page }) => {
        // Set some XP
        await page.evaluate(() => {
            localStorage.setItem('sudoku_userXP', JSON.stringify({ totalXP: 500 }));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await navigateToScreen(page, 'profile');
        await expect(page.locator('.profile-xp-card')).toBeVisible();
        await expect(page.locator('.profile-level-badge')).toBeVisible();
        await expect(page.locator('.profile-xp-bar')).toBeVisible();

        const xpText = await page.locator('.profile-xp-text').textContent();
        expect(xpText).toMatch(/\d+ \/ \d+ XP/);
    });

    test('XP is not earned on time-attack failure', async ({ page }) => {
        // Set initial XP
        await page.evaluate(() => {
            localStorage.setItem('sudoku_userXP', JSON.stringify({ totalXP: 100 }));
        });

        await startNewGame(page, 'easy', { mode: 'timeAttack', duration: 300 });

        // Force time-attack failure via JS
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            // Navigate to complete screen with failure
            app.navigate('complete', {
                score: 0,
                time: 300,
                difficulty: 'easy',
                mistakes: 0,
                mode: 'timeAttack',
                success: false,
                message: 'test time up',
            });
        });

        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // XP should not change
        const xpAfter = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_userXP');
            return raw ? JSON.parse(raw).totalXP : 0;
        });
        expect(xpAfter).toBe(100);
    });
});

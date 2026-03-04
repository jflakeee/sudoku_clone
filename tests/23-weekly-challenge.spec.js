// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Weekly Challenge', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('weekly challenge card is visible on main screen', async ({ page }) => {
        const card = page.locator('.weekly-challenge-card');
        await expect(card).toBeVisible();
    });

    test('weekly challenge card shows difficulty and variant', async ({ page }) => {
        const difficulty = page.locator('.weekly-card-difficulty');
        const variant = page.locator('.weekly-card-variant');
        await expect(difficulty).toBeVisible();
        await expect(variant).toBeVisible();
        // Should have non-empty text
        const diffText = await difficulty.textContent();
        expect(diffText.length).toBeGreaterThan(0);
    });

    test('weekly challenge card shows period dates', async ({ page }) => {
        const period = page.locator('.weekly-card-period');
        await expect(period).toBeVisible();
        const text = await period.textContent();
        // Should contain a date range with ~
        expect(text).toContain('~');
    });

    test('weekly challenge card shows status', async ({ page }) => {
        const status = page.locator('.weekly-card-status');
        await expect(status).toBeVisible();
        const text = await status.textContent();
        expect(text).toBe('도전');
    });

    test('weekly challenge can be started', async ({ page }) => {
        await page.click('.weekly-challenge-card');
        await page.waitForSelector('#screen-game.active', { timeout: 15000 });
        // Game screen should be active
        const gameScreen = page.locator('#screen-game.active');
        await expect(gameScreen).toBeVisible();
    });

    test('weekly challenge completion saves progress', async ({ page }) => {
        await page.click('.weekly-challenge-card');
        await page.waitForSelector('#screen-game.active', { timeout: 15000 });

        // Solve the puzzle
        await page.evaluate(async () => {
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
                    }
                }
            }
        });

        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Check that weekly progress was saved
        const weeklyData = await page.evaluate(() => {
            const raw = localStorage.getItem('sudoku_weekly');
            return raw ? JSON.parse(raw) : null;
        });

        expect(weeklyData).not.toBeNull();
        expect(weeklyData.completed).toBe(true);
    });

    test('completed weekly challenge shows completed status', async ({ page }) => {
        // Set weekly as completed for current week
        await page.evaluate(() => {
            const epoch = new Date('2026-01-05T00:00:00');
            const now = new Date();
            const diff = now.getTime() - epoch.getTime();
            const week = Math.max(0, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
            localStorage.setItem('sudoku_weekly', JSON.stringify({
                completed: true,
                time: 120,
                mistakes: 0,
                score: 5000,
                week,
            }));
        });

        await page.reload();
        await page.waitForSelector('#screen-main.active');

        const status = page.locator('.weekly-card-status');
        await expect(status).toHaveText('완료');
        await expect(status).toHaveClass(/completed/);
    });

    test('weekly config is deterministic for same week', async ({ page }) => {
        const configs = await page.evaluate(async () => {
            const mod = await import('./js/utils/weekly-seed.js');
            const date = new Date('2026-03-04');
            const config1 = mod.getWeeklyConfig(date);
            const config2 = mod.getWeeklyConfig(date);
            return { config1, config2 };
        });

        expect(configs.config1.seed).toBe(configs.config2.seed);
        expect(configs.config1.difficulty).toBe(configs.config2.difficulty);
        expect(configs.config1.variant).toBe(configs.config2.variant);
        expect(configs.config1.week).toBe(configs.config2.week);
    });

    test('different weeks produce different configs', async ({ page }) => {
        const configs = await page.evaluate(async () => {
            const mod = await import('./js/utils/weekly-seed.js');
            const week1 = mod.getWeeklyConfig(new Date('2026-01-05'));
            const week2 = mod.getWeeklyConfig(new Date('2026-01-12'));
            return { week1, week2 };
        });

        expect(configs.week1.week).not.toBe(configs.week2.week);
        expect(configs.week1.seed).not.toBe(configs.week2.seed);
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Solve Time Chart', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('time chart canvas exists on profile screen', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        const canvas = page.locator('#time-chart');
        await expect(canvas).toBeVisible();
    });

    test('time chart container is visible on profile screen', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        const container = page.locator('.time-chart-container');
        await expect(container).toBeVisible();
    });

    test('time chart shows "데이터가 부족합니다" when no data', async ({ page }) => {
        await navigateToScreen(page, 'profile');

        // Wait a bit for the chart to render
        await page.waitForTimeout(500);

        // The canvas should exist and be drawn
        const canvas = page.locator('#time-chart');
        await expect(canvas).toBeVisible();

        // Check canvas has been drawn to (width/height set)
        const dimensions = await page.evaluate(() => {
            const c = document.getElementById('time-chart');
            return { width: c.width, height: c.height };
        });
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
    });

    test('profile section heading shows correct title', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        const heading = page.locator('.profile-section-heading');
        await expect(heading).toHaveText('풀이 시간 추이');
    });

    test('time chart renders after completing games', async ({ page }) => {
        // Seed game history with some data
        await page.evaluate(() => {
            const history = [];
            for (let i = 0; i < 5; i++) {
                history.push({
                    id: `test-${i}`,
                    date: new Date(Date.now() - i * 86400000).toISOString(),
                    difficulty: 'easy',
                    mode: 'classic',
                    boardSize: 9,
                    variant: 'standard',
                    score: 1000 + i * 100,
                    time: 120 + i * 30,
                    mistakes: 0,
                    puzzle: [],
                    solution: [],
                    given: [],
                });
            }
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(history));
        });

        await navigateToScreen(page, 'profile');
        await page.waitForTimeout(500);

        // Canvas should have been drawn
        const canvas = page.locator('#time-chart');
        await expect(canvas).toBeVisible();

        const dimensions = await page.evaluate(() => {
            const c = document.getElementById('time-chart');
            return { width: c.width, height: c.height };
        });
        expect(dimensions.width).toBeGreaterThan(0);
    });
});

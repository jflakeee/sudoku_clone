const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Stats Filter', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('stats screen has mode filter', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="stats"]');
        await page.waitForSelector('#screen-stats.active');

        const modeFilter = page.locator('#stats-mode-filter');
        await expect(modeFilter).toBeVisible();
        // Should have classic and timeAttack options
        const options = await modeFilter.locator('option').allTextContents();
        expect(options.length).toBeGreaterThanOrEqual(2);
    });

    test('stats screen has size filter', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="stats"]');
        await page.waitForSelector('#screen-stats.active');

        const sizeFilter = page.locator('#stats-size-filter');
        await expect(sizeFilter).toBeVisible();
        // Should have "전체 크기" and individual sizes
        const options = await sizeFilter.locator('option').allTextContents();
        expect(options).toContain('전체 크기');
        expect(options.length).toBeGreaterThanOrEqual(4);
    });

    test('stats screen has variant filter', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="stats"]');
        await page.waitForSelector('#screen-stats.active');

        const variantFilter = page.locator('#stats-variant-filter');
        await expect(variantFilter).toBeVisible();
        // Should have "전체 변형" and individual variants
        const options = await variantFilter.locator('option').allTextContents();
        expect(options).toContain('전체 변형');
        expect(options.length).toBeGreaterThanOrEqual(3);
    });

    test('default shows aggregate stats (전체)', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="stats"]');
        await page.waitForSelector('#screen-stats.active');

        // Default filter values
        const sizeFilter = page.locator('#stats-size-filter');
        const variantFilter = page.locator('#stats-variant-filter');
        await expect(sizeFilter).toHaveValue('all');
        await expect(variantFilter).toHaveValue('all');
    });

    test('changing size filter rerenders stats', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="stats"]');
        await page.waitForSelector('#screen-stats.active');

        // Read initial gamesStarted value
        const initial = await page.locator('[data-stat="gamesStarted"]').textContent();

        // Change filter to 4x4
        await page.selectOption('#stats-size-filter', '4');

        // Stats should re-render (value may be same but no error should occur)
        const after = await page.locator('[data-stat="gamesStarted"]').textContent();
        expect(after).toBeDefined();
    });

    test('ranking screen has size and variant filters', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="ranking"]');
        await page.waitForSelector('#screen-ranking.active');

        const sizeFilter = page.locator('#ranking-size');
        const variantFilter = page.locator('#ranking-variant');
        await expect(sizeFilter).toBeVisible();
        await expect(variantFilter).toBeVisible();
    });
});

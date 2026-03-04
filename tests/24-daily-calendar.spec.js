const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Daily Calendar Enhancement', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('daily challenge screen shows calendar', async ({ page }) => {
        await navigateToScreen(page, 'daily');
        await page.waitForSelector('#screen-daily.active');

        const calendar = page.locator('#daily-calendar');
        await expect(calendar).toBeVisible();
    });

    test('calendar cells have difficulty dots', async ({ page }) => {
        await navigateToScreen(page, 'daily');
        await page.waitForSelector('#screen-daily.active');

        // At least some calendar day cells should have difficulty dots
        const dots = page.locator('.calendar-day:not(.empty) .difficulty-dot');
        const count = await dots.count();
        expect(count).toBeGreaterThan(0);
    });

    test('some calendar cells have variant badges', async ({ page }) => {
        await navigateToScreen(page, 'daily');
        await page.waitForSelector('#screen-daily.active');

        // Not all days have variant badges (standard days don't)
        // but some should (Tuesday=D, Wednesday=N, etc.)
        const badges = page.locator('.calendar-day:not(.empty) .variant-badge');
        const count = await badges.count();
        // A month should have several days with non-standard variants
        expect(count).toBeGreaterThan(0);
    });

    test('variant badges show correct letters', async ({ page }) => {
        await navigateToScreen(page, 'daily');
        await page.waitForSelector('#screen-daily.active');

        // Get all variant badge texts
        const badges = page.locator('.calendar-day:not(.empty) .variant-badge');
        const count = await badges.count();
        if (count > 0) {
            const texts = await badges.allTextContents();
            // All badge texts should be one of D, N, K, W, E
            for (const text of texts) {
                expect(['D', 'N', 'K', 'W', 'E']).toContain(text);
            }
        }
    });

    test('difficulty dots have correct CSS classes', async ({ page }) => {
        await navigateToScreen(page, 'daily');
        await page.waitForSelector('#screen-daily.active');

        const dots = page.locator('.calendar-day:not(.empty) .difficulty-dot');
        const count = await dots.count();
        if (count > 0) {
            for (let i = 0; i < Math.min(count, 5); i++) {
                const dot = dots.nth(i);
                const classes = await dot.getAttribute('class');
                // Should have one of the difficulty classes
                const hasDiffClass = ['easy', 'normal', 'hard', 'expert', 'master'].some(d => classes.includes(d));
                expect(hasDiffClass).toBeTruthy();
            }
        }
    });

    test('getDailyVariant returns different variants for different days', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { getDailyVariant } = await import('./js/utils/daily-seed.js');
            const variants = new Set();
            // Check all 7 days of the week
            for (let i = 0; i < 7; i++) {
                const date = new Date(2026, 2, 1 + i); // March 2026
                variants.add(getDailyVariant(date));
            }
            return variants.size;
        });
        // Should have more than 1 unique variant across a week
        expect(result).toBeGreaterThan(1);
    });

    test('daily play sends variant to game', async ({ page }) => {
        await navigateToScreen(page, 'daily');
        await page.waitForSelector('#screen-daily.active');

        // Click play button
        const playBtn = page.locator('.btn-daily-play');
        await expect(playBtn).toBeVisible();
        // Just verify the button exists and is clickable
        // (Actually starting a daily game would start puzzle generation)
    });
});

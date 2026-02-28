// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Daily Challenge - Future Dates (F5)', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('future month tabs are visible', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        const tabs = page.locator('.month-tab');
        const count = await tabs.count();

        // Should have past months + current + future months (6 + 1 + 2 = 9)
        expect(count).toBe(9);
    });

    test('future dates are clickable in calendar', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Click a future month tab (last tab)
        const tabs = page.locator('.month-tab');
        const lastTab = tabs.last();
        await lastTab.click();

        // Future day cells should be clickable
        const futureDays = page.locator('.calendar-day.future');
        const futureCount = await futureDays.count();

        if (futureCount > 0) {
            // Click on first future day
            await futureDays.first().click();
            // Verify it got selected
            await expect(futureDays.first()).toHaveClass(/selected/);
        }
    });

    test('future dates have correct opacity style', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Navigate to a future month
        const tabs = page.locator('.month-tab');
        await tabs.last().click();

        // Find a future day that is NOT selected (to avoid .selected override)
        const unselectedFuture = page.locator('.calendar-day.future:not(.selected)');
        const count = await unselectedFuture.count();

        if (count > 0) {
            const opacity = await unselectedFuture.first().evaluate(el => {
                return window.getComputedStyle(el).opacity;
            });
            // Should be reduced opacity (0.7)
            expect(parseFloat(opacity)).toBeLessThan(1);
        }
    });

    test('can play daily challenge for future date', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Navigate to a future month
        const tabs = page.locator('.month-tab');
        await tabs.last().click();

        const futureDays = page.locator('.calendar-day.future');
        const count = await futureDays.count();

        if (count > 0) {
            await futureDays.first().click();
            await page.click('.btn-daily-play');
            await page.waitForSelector('#screen-game.active', { timeout: 10000 });

            // Verify game screen is active
            await expect(page.locator('#screen-game')).toHaveClass(/active/);
        }
    });

    test('future daily puzzle is deterministic (same date = same puzzle)', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Navigate to future month
        const tabs = page.locator('.month-tab');
        await tabs.last().click();

        const futureDays = page.locator('.calendar-day.future');
        const count = await futureDays.count();

        if (count > 0) {
            await futureDays.first().click();
            await page.click('.btn-daily-play');
            await page.waitForSelector('#screen-game.active', { timeout: 10000 });

            const puzzle1 = await page.evaluate(async () => {
                const mod = await import('./js/app.js');
                return mod.default.board.getInitialPuzzle();
            });

            // Go back using the game screen's back button
            await page.click('#screen-game [data-action="back"]');
            await page.waitForSelector('#screen-daily.active', { timeout: 5000 });

            await tabs.last().click();
            await futureDays.first().click();
            await page.click('.btn-daily-play');
            await page.waitForSelector('#screen-game.active', { timeout: 10000 });

            const puzzle2 = await page.evaluate(async () => {
                const mod = await import('./js/app.js');
                return mod.default.board.getInitialPuzzle();
            });

            expect(puzzle1).toEqual(puzzle2);
        }
    });

    test('selected future date gets highlighted styling', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        const tabs = page.locator('.month-tab');
        await tabs.last().click();

        const futureDays = page.locator('.calendar-day.future');
        const count = await futureDays.count();

        if (count > 0) {
            await futureDays.first().click();
            const selectedDay = page.locator('.calendar-day.future.selected');
            await expect(selectedDay).toHaveCount(1);

            const opacity = await selectedDay.evaluate(el => {
                return window.getComputedStyle(el).opacity;
            });
            // Selected future days should have full opacity
            expect(parseFloat(opacity)).toBe(1);
        }
    });
});

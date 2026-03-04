// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Screen Content', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('main screen shows daily challenge card with today date', async ({ page }) => {
        const dailyCard = page.locator('.daily-challenge-card');
        await expect(dailyCard).toBeVisible();

        // Should contain today's date
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        await expect(dailyCard).toContainText(`${month}월 ${day}일`);
    });

    test('main screen shows best score section', async ({ page }) => {
        await expect(page.locator('.best-score-section')).toBeVisible();
    });

    test('daily challenge screen shows calendar', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Month tabs container should be visible
        await expect(page.locator('#daily-month-tabs')).toBeVisible();

        // Calendar should have day cells
        const calendarCells = page.locator('#daily-calendar .calendar-day');
        const count = await calendarCells.count();
        expect(count).toBeGreaterThan(20);
    });

    test('daily challenge screen highlights today', async ({ page }) => {
        await navigateToScreen(page, 'daily');

        // Today's cell should have today class
        await expect(page.locator('.calendar-day.today')).toBeVisible();
    });

    test('profile screen shows 6 menu items', async ({ page }) => {
        await navigateToScreen(page, 'profile');

        const menuItems = page.locator('#screen-profile .menu-item');
        await expect(menuItems).toHaveCount(6);
    });

    test('stats screen shows stat sections', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="stats"]');

        // Check sections exist
        await expect(page.locator('[data-stat="gamesStarted"]')).toBeVisible();
        await expect(page.locator('[data-stat="gamesWon"]')).toBeVisible();
        await expect(page.locator('[data-stat="winRate"]')).toBeVisible();
        await expect(page.locator('[data-stat="bestTime"]')).toBeVisible();
        await expect(page.locator('[data-stat="currentStreak"]')).toBeVisible();
    });

    test('settings screen has toggle switches', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        const toggles = page.locator('#screen-settings .toggle-switch');
        const count = await toggles.count();
        expect(count).toBeGreaterThanOrEqual(6);
    });

    test('awards screen has trophy and challenge tabs', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="awards"]');

        await expect(page.locator('#screen-awards .awards-tabs')).toBeVisible();
    });

    test('tutorial screen shows interactive steps', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // First step title visible
        await expect(page.locator('.tutorial-step-title')).toBeVisible();

        // Progress indicator
        await expect(page.locator('.tutorial-progress')).toContainText('1/5');

        // Mini grid and numberpad visible
        await expect(page.locator('.tutorial-mini-grid')).toBeVisible();
        await expect(page.locator('.t-num-btn').first()).toBeVisible();
    });

    test('difficulty modal has 5 difficulty options', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('[data-action="select-mode"]');
        await page.waitForSelector('#difficulty-modal', { state: 'visible' });

        const options = page.locator('.difficulty-option');
        await expect(options).toHaveCount(5);
    });
});

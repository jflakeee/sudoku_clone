// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Dark Mode', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('settings screen has dark mode toggle', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        const darkToggle = page.locator('#screen-settings input[data-setting="darkMode"]');
        await expect(darkToggle).toBeAttached();
    });

    test('toggling dark mode adds body class', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        // Initially not dark
        await expect(page.locator('body')).not.toHaveClass(/dark-mode/);

        // Toggle dark mode on
        await page.locator('#screen-settings input[data-setting="darkMode"]').evaluate(el => el.click());

        // Body should have dark-mode class
        await expect(page.locator('body')).toHaveClass(/dark-mode/);
    });

    test('dark mode updates theme-color meta tag', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        // Toggle dark mode on
        await page.locator('#screen-settings input[data-setting="darkMode"]').evaluate(el => el.click());

        const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
        expect(themeColor).toBe('#1E1E30');
    });

    test('dark mode persists across page reload', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        // Toggle dark mode on
        await page.locator('#screen-settings input[data-setting="darkMode"]').evaluate(el => el.click());
        await expect(page.locator('body')).toHaveClass(/dark-mode/);

        // Reload page
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        // Dark mode should still be applied
        await expect(page.locator('body')).toHaveClass(/dark-mode/);
    });

    test('toggling dark mode off removes body class', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        // Toggle on then off
        await page.locator('#screen-settings input[data-setting="darkMode"]').evaluate(el => el.click());
        await expect(page.locator('body')).toHaveClass(/dark-mode/);

        await page.locator('#screen-settings input[data-setting="darkMode"]').evaluate(el => el.click());
        await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
    });
});

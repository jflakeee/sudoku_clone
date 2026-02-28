// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Navigation & Screen Routing', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('main screen loads on startup', async ({ page }) => {
        await expect(page.locator('#screen-main')).toHaveClass(/active/);
        await expect(page.locator('#navbar')).toBeVisible();
        await expect(page.locator('.nav-tab.active')).toHaveAttribute('data-navigate', 'main');
    });

    test('navbar tabs switch screens correctly', async ({ page }) => {
        // Switch to daily
        await navigateToScreen(page, 'daily');
        await expect(page.locator('#screen-daily')).toHaveClass(/active/);
        await expect(page.locator('#screen-main')).not.toHaveClass(/active/);

        // Switch to profile
        await navigateToScreen(page, 'profile');
        await expect(page.locator('#screen-profile')).toHaveClass(/active/);

        // Switch back to main
        await navigateToScreen(page, 'main');
        await expect(page.locator('#screen-main')).toHaveClass(/active/);
    });

    test('navbar shows on main tabs, hidden on sub-screens', async ({ page }) => {
        // Navbar visible on main
        await expect(page.locator('#navbar')).toBeVisible();

        // Navigate to profile > stats (sub-screen)
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="stats"]');
        await expect(page.locator('#screen-stats')).toHaveClass(/active/);
        await expect(page.locator('#navbar')).toBeHidden();
    });

    test('back button returns to previous screen', async ({ page }) => {
        // Main -> Profile -> Stats -> Back -> Profile
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="stats"]');
        await expect(page.locator('#screen-stats')).toHaveClass(/active/);

        await page.click('#screen-stats .sub-header [data-action="back"]');
        await expect(page.locator('#screen-profile')).toHaveClass(/active/);
        await expect(page.locator('#navbar')).toBeVisible();
    });

    test('profile menu items navigate to sub-screens', async ({ page }) => {
        await navigateToScreen(page, 'profile');

        const screens = ['awards', 'stats', 'settings', 'tutorial'];
        for (const screen of screens) {
            await navigateToScreen(page, 'profile');
            await page.click(`#screen-profile .menu-item[data-navigate="${screen}"]`);
            await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);

            // Go back
            await page.click(`#screen-${screen} [data-action="back"]`);
            await expect(page.locator('#screen-profile')).toHaveClass(/active/);
        }
    });

    test('difficulty modal opens and closes', async ({ page }) => {
        const modal = page.locator('#difficulty-modal');
        await expect(modal).toBeHidden();

        // New game goes through mode-select screen first
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('[data-action="select-mode"]');
        await expect(modal).toBeVisible();

        // Close by clicking overlay background
        await modal.click({ position: { x: 10, y: 10 } });
        await expect(modal).toBeHidden();
    });
});

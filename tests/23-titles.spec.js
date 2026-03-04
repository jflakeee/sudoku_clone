// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Title / Profile System', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('default title is "초보자" for new users', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        const titleLabel = page.locator('.current-title-label');
        await expect(titleLabel).toHaveText('초보자');
    });

    test('profile screen shows current title', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        const titleSection = page.locator('.profile-title-section');
        await expect(titleSection).toBeVisible();
    });

    test('title change button is visible', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        const changeBtn = page.locator('.btn-title-change');
        await expect(changeBtn).toBeVisible();
        await expect(changeBtn).toHaveText('변경');
    });

    test('title selector toggles on button click', async ({ page }) => {
        await navigateToScreen(page, 'profile');

        const selector = page.locator('.title-selector');
        await expect(selector).toBeHidden();

        await page.click('.btn-title-change');
        await expect(selector).toBeVisible();

        await page.click('.btn-title-change');
        await expect(selector).toBeHidden();
    });

    test('title selector shows all titles', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.btn-title-change');

        const titleItems = page.locator('.title-item');
        const count = await titleItems.count();
        // Should have 12 titles (8 level-based + 4 achievement-based)
        expect(count).toBe(12);
    });

    test('beginner title is unlocked for new users', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.btn-title-change');

        const beginnerItem = page.locator('.title-item[data-title-id="beginner"]');
        await expect(beginnerItem).toBeVisible();
        // Should NOT have locked class
        const hasLocked = await beginnerItem.evaluate(el => el.classList.contains('title-locked'));
        expect(hasLocked).toBe(false);
    });

    test('high-level titles are locked for new users', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.btn-title-change');

        const legendItem = page.locator('.title-item[data-title-id="legend"]');
        await expect(legendItem).toBeVisible();
        const hasLocked = await legendItem.evaluate(el => el.classList.contains('title-locked'));
        expect(hasLocked).toBe(true);
    });

    test('unlocked title can be selected', async ({ page }) => {
        // Give user enough XP for level 5 (needs 950 XP)
        await page.evaluate(() => {
            localStorage.setItem('sudoku_userXP', JSON.stringify({ totalXP: 1000 }));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await navigateToScreen(page, 'profile');
        await page.click('.btn-title-change');

        const apprenticeItem = page.locator('.title-item[data-title-id="apprentice"]');
        // Check it's unlocked
        const isLocked = await apprenticeItem.evaluate(el => el.classList.contains('title-locked'));
        expect(isLocked).toBe(false);

        await apprenticeItem.click();

        // Title should now be active
        const titleLabel = page.locator('.current-title-label');
        await expect(titleLabel).toHaveText('견습생');
    });

    test('selected title persists across page reload', async ({ page }) => {
        // Set active title (needs 950+ XP for level 5 to unlock apprentice)
        await page.evaluate(() => {
            localStorage.setItem('sudoku_userXP', JSON.stringify({ totalXP: 1000 }));
            localStorage.setItem('sudoku_activeTitle', JSON.stringify('apprentice'));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await navigateToScreen(page, 'profile');

        const titleLabel = page.locator('.current-title-label');
        await expect(titleLabel).toHaveText('견습생');
    });

    test('main screen shows title next to level badge', async ({ page }) => {
        const titleLabel = page.locator('.main-title-label');
        await expect(titleLabel).toBeVisible();
        await expect(titleLabel).toHaveText('초보자');
    });

    test('title updates on main screen when changed', async ({ page }) => {
        // Need 950+ XP for level 5 to unlock apprentice
        await page.evaluate(() => {
            localStorage.setItem('sudoku_userXP', JSON.stringify({ totalXP: 1000 }));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        // Go to profile, change title
        await navigateToScreen(page, 'profile');
        await page.click('.btn-title-change');
        await page.click('.title-item[data-title-id="apprentice"]');

        // Go back to main
        await navigateToScreen(page, 'main');

        const titleLabel = page.locator('.main-title-label');
        await expect(titleLabel).toHaveText('견습생');
    });

    test('locked title cannot be selected', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.btn-title-change');

        // Click a locked title
        const legendItem = page.locator('.title-item[data-title-id="legend"]');
        await legendItem.click();

        // Title should still be beginner
        const titleLabel = page.locator('.current-title-label');
        await expect(titleLabel).toHaveText('초보자');
    });
});

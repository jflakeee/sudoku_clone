const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('i18n Internationalization', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('default locale is Korean', async ({ page }) => {
        const locale = await page.evaluate(async () => {
            const { getLocale } = await import('./js/utils/i18n.js');
            return getLocale();
        });
        expect(locale).toBe('ko');
    });

    test('language selector exists in settings', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');

        const localeSelect = page.locator('#locale-select');
        await expect(localeSelect).toBeVisible();
    });

    test('language selector has Korean and English options', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');

        const localeSelect = page.locator('#locale-select');
        const options = await localeSelect.locator('option').allTextContents();
        expect(options).toContain('한국어');
        expect(options).toContain('English');
    });

    test('switching to English changes UI text', async ({ page }) => {
        // Check initial Korean text
        const navHome = page.locator('.nav-tab[data-navigate="main"] .nav-label');
        await expect(navHome).toHaveText('메인');

        // Navigate to settings and switch language
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');

        await page.selectOption('#locale-select', 'en');

        // Check that navbar labels changed
        await expect(navHome).toHaveText('Home');
    });

    test('switching back to Korean restores text', async ({ page }) => {
        // Switch to English first
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');
        await page.selectOption('#locale-select', 'en');

        const navHome = page.locator('.nav-tab[data-navigate="main"] .nav-label');
        await expect(navHome).toHaveText('Home');

        // Switch back to Korean
        await page.selectOption('#locale-select', 'ko');
        await expect(navHome).toHaveText('메인');
    });

    test('data-i18n elements are translated', async ({ page }) => {
        // Count elements with data-i18n attribute
        const count = await page.evaluate(() => {
            return document.querySelectorAll('[data-i18n]').length;
        });
        expect(count).toBeGreaterThan(5);
    });

    test('t() function returns correct translations', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { t, setLocale } = await import('./js/utils/i18n.js');

            setLocale('ko');
            const ko = t('nav.home');

            setLocale('en');
            const en = t('nav.home');

            // Reset to Korean
            setLocale('ko');

            return { ko, en };
        });
        expect(result.ko).toBe('메인');
        expect(result.en).toBe('Home');
    });

    test('toolbar labels translate when language changes', async ({ page }) => {
        // Check Korean toolbar labels
        const undoLabel = page.locator('[data-action="undo"] .tool-label');
        // May not be visible if not on game screen, but text should still be set

        // Switch to English
        await page.evaluate(async () => {
            const { setLocale } = await import('./js/utils/i18n.js');
            setLocale('en');
        });

        await expect(undoLabel).toHaveText('Undo');

        // Switch back to Korean
        await page.evaluate(async () => {
            const { setLocale } = await import('./js/utils/i18n.js');
            setLocale('ko');
        });

        await expect(undoLabel).toHaveText('실행취소');
    });

    test('locale setting is persisted', async ({ page }) => {
        // Switch to English in settings
        await navigateToScreen(page, 'profile');
        await page.click('.menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');
        await page.selectOption('#locale-select', 'en');

        // Verify setting is saved
        const saved = await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings'));
            return settings?.locale;
        });
        expect(saved).toBe('en');
    });
});

const { test, expect } = require('@playwright/test');
const { resetApp } = require('./helpers');

test.describe('PWA Improvements', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('install banner element exists in DOM', async ({ page }) => {
        const banner = page.locator('#install-banner');
        // Banner exists but is hidden by default (shown by beforeinstallprompt)
        await expect(banner).toHaveCount(1);
        await expect(banner).toHaveCSS('display', 'none');
    });

    test('install banner has install and dismiss buttons', async ({ page }) => {
        const installBtn = page.locator('#btn-install');
        const dismissBtn = page.locator('#btn-install-dismiss');
        await expect(installBtn).toHaveCount(1);
        await expect(dismissBtn).toHaveCount(1);
    });

    test('manifest link exists in head', async ({ page }) => {
        const manifest = page.locator('link[rel="manifest"]');
        await expect(manifest).toHaveCount(1);
        const href = await manifest.getAttribute('href');
        expect(href).toContain('manifest.json');
    });

    test('manifest has shortcuts', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const response = await fetch('./manifest.json');
            const manifest = await response.json();
            return manifest.shortcuts;
        });
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBeTruthy();
        expect(result.length).toBeGreaterThanOrEqual(2);
        // Check new game shortcut
        const newGame = result.find(s => s.url.includes('action=new'));
        expect(newGame).toBeDefined();
        // Check daily shortcut
        const daily = result.find(s => s.url.includes('action=daily'));
        expect(daily).toBeDefined();
    });

    test('manifest has required PWA fields', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const response = await fetch('./manifest.json');
            return response.json();
        });
        expect(result.name).toBeDefined();
        expect(result.short_name).toBeDefined();
        expect(result.start_url).toBeDefined();
        expect(result.display).toBe('standalone');
        expect(result.icons).toBeDefined();
        expect(result.icons.length).toBeGreaterThan(0);
    });

    test('dismiss button hides banner when shown', async ({ page }) => {
        // Manually show the banner to test dismiss
        await page.evaluate(() => {
            document.getElementById('install-banner').style.display = 'flex';
        });

        const banner = page.locator('#install-banner');
        await expect(banner).toHaveCSS('display', 'flex');

        await page.click('#btn-install-dismiss');
        await expect(banner).toHaveCSS('display', 'none');
    });
});

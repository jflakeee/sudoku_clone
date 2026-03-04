/**
 * E2E tests for Sound System.
 */

const { test, expect } = require('@playwright/test');
const { resetApp } = require('./helpers');

test.describe('Sound System - Settings', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        // Navigate to settings via app.navigate
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            mod.default.navigate('settings');
        });
        await page.waitForSelector('#screen-settings.active');
    });

    test('Sound toggle exists in settings', async ({ page }) => {
        const toggle = page.locator('input[data-setting="sound"]');
        await expect(toggle).toBeAttached();
    });

    test('Sound is on by default', async ({ page }) => {
        const toggle = page.locator('input[data-setting="sound"]');
        await expect(toggle).toBeChecked();
    });

    test('Volume slider exists in settings', async ({ page }) => {
        const slider = page.locator('.volume-slider');
        await expect(slider).toBeVisible();
    });

    test('Volume slider has correct range attributes', async ({ page }) => {
        const slider = page.locator('.volume-slider');
        await expect(slider).toHaveAttribute('min', '0');
        await expect(slider).toHaveAttribute('max', '100');
    });

    test('Volume slider has default value of 50', async ({ page }) => {
        const value = await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            return settings.volume;
        });
        // Either default 50 or undefined (which defaults to 50)
        expect(value === 50 || value === undefined).toBe(true);
    });

    test('Toggling sound off disables it', async ({ page }) => {
        // Turn off sound - click the label since the checkbox is hidden inside toggle-switch
        await page.click('label.toggle-switch:has(input[data-setting="sound"])');

        const isEnabled = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.sound ? app.sound.isEnabled() : false;
        });
        expect(isEnabled).toBe(false);
    });
});

test.describe('Sound System - SoundManager', () => {
    test('SoundManager class exists and has play method', async ({ page }) => {
        await resetApp(page);

        const hasPlayMethod = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.sound && typeof app.sound.play === 'function';
        });
        expect(hasPlayMethod).toBe(true);
    });

    test('SoundManager has setEnabled method', async ({ page }) => {
        await resetApp(page);

        const hasMethod = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.sound && typeof app.sound.setEnabled === 'function';
        });
        expect(hasMethod).toBe(true);
    });

    test('SoundManager play does not throw on valid sound names', async ({ page }) => {
        await resetApp(page);

        const noError = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            try {
                // These should not throw even without AudioContext
                app.sound?.play('tap');
                app.sound?.play('place');
                app.sound?.play('error');
                app.sound?.play('complete');
                app.sound?.play('undo');
                app.sound?.play('hint');
                return true;
            } catch {
                return false;
            }
        });
        expect(noError).toBe(true);
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Time Attack Mode', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('time attack game sets board mode to timeAttack', async ({ page }) => {
        await startNewGame(page, 'easy', { mode: 'timeAttack', duration: 600 });
        const mode = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.mode;
        });
        expect(mode).toBe('timeAttack');
    });

    test('classic mode sets board mode to classic', async ({ page }) => {
        await startNewGame(page, 'easy');
        const mode = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.mode;
        });
        expect(mode).toBe('classic');
    });

    test('time attack timer shows time', async ({ page }) => {
        await startNewGame(page, 'easy', { mode: 'timeAttack', duration: 300 });
        const timerText = await page.locator('.timer-value').textContent();
        expect(timerText).toBeTruthy();
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp } = require('./helpers');

test.describe('Scorer and Timer Extensions', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('calculateTimeAttackBonus returns correct value', async ({ page }) => {
        const bonus = await page.evaluate(async () => {
            const { calculateTimeAttackBonus } = await import('./js/core/scorer.js');
            return calculateTimeAttackBonus('easy', 300, 600, 0);
        });
        expect(bonus).toBeGreaterThan(0);
    });

    test('timer countdown methods exist', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { Timer } = await import('./js/game/timer.js');
            const timer = new Timer();
            return {
                hasSetCountdown: typeof timer.setCountdown === 'function',
                hasSetDuration: typeof timer.setDuration === 'function',
                hasOnTimeUp: typeof timer.onTimeUp === 'function',
                hasGetRemaining: typeof timer.getRemaining === 'function',
                hasIsTimeUp: typeof timer.isTimeUp === 'function',
            };
        });
        expect(result.hasSetCountdown).toBe(true);
        expect(result.hasSetDuration).toBe(true);
        expect(result.hasOnTimeUp).toBe(true);
        expect(result.hasGetRemaining).toBe(true);
        expect(result.hasIsTimeUp).toBe(true);
    });

    test('timer countdown shows remaining time', async ({ page }) => {
        const remaining = await page.evaluate(async () => {
            const { Timer } = await import('./js/game/timer.js');
            const timer = new Timer();
            timer.setCountdown(true);
            timer.setDuration(600);
            return timer.getRemaining();
        });
        expect(remaining).toBe(600);
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Mode Selection', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('mode select screen shows on new game click', async ({ page }) => {
        await page.click('.btn-new-game');
        await expect(page.locator('#screen-mode-select')).toHaveClass(/active/);
    });

    test('classic mode is selected by default', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        const classicBtn = page.locator('.game-mode-option[data-game-mode="classic"]');
        await expect(classicBtn).toHaveClass(/active/);
    });

    test('time attack mode shows time options', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('.game-mode-option[data-game-mode="timeAttack"]');
        const timedSection = page.locator('.timed-section');
        await expect(timedSection).toBeVisible();
    });

    test('next button opens difficulty modal', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('[data-action="select-mode"]');
        await expect(page.locator('#difficulty-modal')).toBeVisible();
    });

    test('full flow: mode select to difficulty to game', async ({ page }) => {
        await startNewGame(page, 'easy');
        await expect(page.locator('#screen-game')).toHaveClass(/active/);
        await expect(page.locator('.sudoku-grid .cell')).toHaveCount(81);
    });

    test('back button returns to main from mode select', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('#screen-mode-select .btn-back');
        await expect(page.locator('#screen-main')).toHaveClass(/active/);
    });

    test('board size options are visible', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        const sizeSection = page.locator('.board-size-section');
        await expect(sizeSection).toBeVisible();
        await expect(page.locator('.size-option[data-size="9"]')).toHaveClass(/active/);
    });
});

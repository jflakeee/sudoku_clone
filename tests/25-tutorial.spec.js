// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, navigateToScreen } = require('./helpers');

test.describe('Interactive Tutorial', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('tutorial screen is accessible from profile', async ({ page }) => {
        // Navigate to profile
        await navigateToScreen(page, 'profile');

        // Click the tutorial menu item
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        const title = page.locator('.tutorial-title');
        await expect(title).toBeVisible();
    });

    test('tutorial shows first step with grid', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Check step title is visible
        const stepTitle = page.locator('.tutorial-step-title');
        await expect(stepTitle).toBeVisible();
        await expect(stepTitle).toContainText('행 규칙');

        // Check progress shows 1/5
        const progress = page.locator('.tutorial-progress');
        await expect(progress).toContainText('1/5');
    });

    test('tutorial grid renders correctly', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Check mini grid exists
        const grid = page.locator('.tutorial-mini-grid');
        await expect(grid).toBeVisible();

        // Check target cell exists
        const targetCell = page.locator('.t-cell.target');
        await expect(targetCell).toBeVisible();

        // Check given cells have values
        const givenCells = page.locator('.t-cell.given');
        const givenCount = await givenCells.count();
        expect(givenCount).toBeGreaterThan(0);
    });

    test('tutorial numberpad renders', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // 4 number buttons for 4x4 grid
        const numBtns = page.locator('.t-num-btn');
        await expect(numBtns).toHaveCount(4);
    });

    test('correct input advances to next step', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Step 1: answer is 2
        await page.click('.t-num-btn[data-tnum="2"]');

        // Wait for animation and step transition
        await page.waitForTimeout(800);

        // Should now be on step 2
        const progress = page.locator('.tutorial-progress');
        await expect(progress).toContainText('2/5');

        const stepTitle = page.locator('.tutorial-step-title');
        await expect(stepTitle).toContainText('열 규칙');
    });

    test('wrong input does not advance', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Step 1: wrong answer (should be 2)
        await page.click('.t-num-btn[data-tnum="3"]');

        await page.waitForTimeout(300);

        // Should still be on step 1
        const progress = page.locator('.tutorial-progress');
        await expect(progress).toContainText('1/5');
    });

    test('tutorial can be completed', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Step 1: answer 2
        await page.click('.t-num-btn[data-tnum="2"]');
        await page.waitForTimeout(800);

        // Step 2: answer 1
        await page.click('.t-num-btn[data-tnum="1"]');
        await page.waitForTimeout(800);

        // Step 3: answer 1
        await page.click('.t-num-btn[data-tnum="1"]');
        await page.waitForTimeout(800);

        // Step 4: answer 1
        await page.click('.t-num-btn[data-tnum="1"]');
        await page.waitForTimeout(800);

        // Should be on completion step (step 5/5)
        const progress = page.locator('.tutorial-progress');
        await expect(progress).toContainText('5/5');

        const completeIcon = page.locator('.tutorial-complete-icon');
        await expect(completeIcon).toBeVisible();

        const startBtn = page.locator('#btn-tutorial-start-game');
        await expect(startBtn).toBeVisible();
    });

    test('skip button returns to profile', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        await page.click('#btn-tutorial-skip');
        await page.waitForSelector('#screen-profile.active');
    });

    test('tutorial hint box is displayed', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        const hintBox = page.locator('.tutorial-hint-box');
        await expect(hintBox).toBeVisible();
        await expect(hintBox).toContainText('빠진 숫자');
    });

    test('tutorial resets when re-entered', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Advance to step 2
        await page.click('.t-num-btn[data-tnum="2"]');
        await page.waitForTimeout(800);

        const progress = page.locator('.tutorial-progress');
        await expect(progress).toContainText('2/5');

        // Go back using the tutorial screen's back button
        await page.click('#screen-tutorial [data-action="back"]');
        await page.waitForSelector('#screen-profile.active');

        // Re-enter
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // Should be back to step 1
        await expect(progress).toContainText('1/5');
    });

    test('correct answer button has highlight', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('[data-navigate="tutorial"]');
        await page.waitForSelector('#screen-tutorial.active');

        // The correct answer button should have a hint class
        const correctBtn = page.locator('.t-num-btn.correct-hint');
        await expect(correctBtn).toBeVisible();
        await expect(correctBtn).toContainText('2');
    });
});

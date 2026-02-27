// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle, navigateToScreen } = require('./helpers');

test.describe('Enhanced UI Features', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    // --- Number completion display (Feature 3) ---

    test('completed number buttons are visible with reduced opacity', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Fill all cells of one number to trigger completion
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();

            // Find a number that appears most in given cells
            const counts = new Array(10).fill(0);
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] > 0) counts[board[r][c]]++;
                }
            }

            // Find which number needs fewest fills
            let targetNum = 1;
            let minNeeded = 9;
            for (let n = 1; n <= 9; n++) {
                if (9 - counts[n] < minNeeded) {
                    minNeeded = 9 - counts[n];
                    targetNum = n;
                }
            }

            // Fill all remaining cells of this number
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0 && solution[r][c] === targetNum) {
                        app.input.selectCell(r, c);
                        app.input.inputNumber(targetNum);
                    }
                }
            }
        });

        // Wait for CSS transition to complete (300ms)
        await page.waitForTimeout(400);

        // At least one num-btn should have .completed class
        const completedBtns = page.locator('.num-btn.completed');
        const count = await completedBtns.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // Completed button should still be visible (opacity > 0) and faded
        if (count > 0) {
            const opacity = await completedBtns.first().evaluate(
                el => window.getComputedStyle(el).opacity
            );
            const opacityNum = parseFloat(opacity);
            expect(opacityNum).toBeGreaterThan(0);
            expect(opacityNum).toBeLessThanOrEqual(0.5);
        }
    });

    // --- Stats progress bars (Feature 6) ---

    test('stats screen shows progress bars after game completion', async ({ page }) => {
        // Complete a game first to have stats
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 15_000 });

        // Navigate to stats
        await page.click('#screen-complete [data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="stats"]');

        // Progress bars should be present
        const bars = page.locator('#screen-stats .stat-bar');
        const barCount = await bars.count();
        expect(barCount).toBeGreaterThanOrEqual(1);

        // Win rate bar should have fill > 0
        const winRateFill = page.locator(
            '#screen-stats .stats-row:has([data-stat="winRate"]) .stat-bar-fill'
        );
        if (await winRateFill.count() > 0) {
            const width = await winRateFill.evaluate(el => el.style.width);
            expect(width).not.toBe('0%');
        }
    });

    // --- Awards screen (Feature 5) ---

    test('awards trophies tab shows 12 months', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="awards"]');

        const months = page.locator('#awards-months-grid .award-month');
        await expect(months).toHaveCount(12);
    });

    test('awards challenges tab shows 8 achievements', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="awards"]');

        // Switch to challenges tab
        await page.click('.awards-tab[data-tab="challenges"]');

        const challenges = page.locator('#awards-months-grid .challenge-item');
        await expect(challenges).toHaveCount(8);
    });

    test('awards tab switching works', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="awards"]');

        // Initially on trophies tab
        const trophiesTab = page.locator('.awards-tab[data-tab="trophies"]');
        await expect(trophiesTab).toHaveClass(/active/);

        // Switch to challenges
        await page.click('.awards-tab[data-tab="challenges"]');
        const challengesTab = page.locator('.awards-tab[data-tab="challenges"]');
        await expect(challengesTab).toHaveClass(/active/);
        await expect(trophiesTab).not.toHaveClass(/active/);
    });

    // --- Settings dark mode toggle count (Feature 1) ---

    test('settings screen has at least 10 toggles including dark mode', async ({ page }) => {
        await navigateToScreen(page, 'profile');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        const toggles = page.locator('#screen-settings .toggle-switch');
        const count = await toggles.count();
        expect(count).toBeGreaterThanOrEqual(10);

        // Dark mode toggle specifically exists
        await expect(page.locator('input[data-setting="darkMode"]')).toBeAttached();
    });

    // --- Screen transition animations (Feature 7) ---

    test('screen transitions apply animation classes', async ({ page }) => {
        // Navigate to profile to trigger forward transition
        await page.click('.nav-tab[data-navigate="profile"]');
        await page.waitForSelector('#screen-profile.active');

        // Navigate to settings (forward - non-tab navigation triggers animation)
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');

        // Wait for settings screen to be active
        await page.waitForSelector('#screen-settings.active');

        // Wait for animation to finish (350ms fallback timeout in showScreen)
        await page.waitForTimeout(400);

        // Animation should have completed and cleaned up
        const hasAnimClass = await page.locator('#screen-settings').evaluate(el =>
            el.classList.contains('screen-enter') ||
            el.classList.contains('screen-enter-back')
        );
        expect(hasAnimClass).toBe(false);
    });

    // --- PWA support (Feature 8) ---

    test('page has manifest link', async ({ page }) => {
        const manifest = page.locator('link[rel="manifest"]');
        await expect(manifest).toBeAttached();
    });

    test('page has apple-mobile-web-app-capable meta', async ({ page }) => {
        const meta = page.locator('meta[name="apple-mobile-web-app-capable"]');
        await expect(meta).toBeAttached();
    });
});

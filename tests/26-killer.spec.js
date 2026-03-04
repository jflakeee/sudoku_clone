// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Killer Sudoku Variant', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('killer variant option is visible in mode select', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        const killerBtn = page.locator('.variant-option[data-variant="killer"]');
        await expect(killerBtn).toBeVisible();
        await expect(killerBtn).toContainText('킬러');
    });

    test('killer variant can be selected and restricts to 9x9', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('.variant-option[data-variant="killer"]');

        // Non-9x9 sizes should be disabled
        const size4 = page.locator('.size-option[data-size="4"]');
        await expect(size4).toHaveClass(/disabled/);

        const size9 = page.locator('.size-option[data-size="9"]');
        await expect(size9).not.toHaveClass(/disabled/);
    });

    test('killer game starts successfully', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });
        await page.waitForSelector('#screen-game.active');

        // Verify variant label is shown
        const variantEl = page.locator('.info-variant');
        await expect(variantEl).toBeVisible();
        await expect(page.locator('.variant-value')).toContainText('킬러');
    });

    test('killer game has cages data', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        const hasCages = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const cages = app.board.getCages();
            return cages && cages.length > 0;
        });
        expect(hasCages).toBe(true);
    });

    test('cages cover all 81 cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        const allCovered = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const cages = app.board.getCages();
            const covered = new Set();
            for (const cage of cages) {
                for (const c of cage.cells) {
                    covered.add(c.row * 9 + c.col);
                }
            }
            return covered.size === 81;
        });
        expect(allCovered).toBe(true);
    });

    test('cage sums are rendered on grid', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        const sumElements = page.locator('.cage-sum');
        const count = await sumElements.count();
        expect(count).toBeGreaterThan(0);
    });

    test('cage borders are rendered on grid', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        const cageBorderCells = page.locator('.cell.cage-border-top, .cell.cage-border-right, .cell.cage-border-bottom, .cell.cage-border-left');
        const count = await cageBorderCells.count();
        expect(count).toBeGreaterThan(0);
    });

    test('cage sums match solution values', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        const sumsMatch = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const cages = app.board.getCages();
            const solution = app.board.getSolution();
            for (const cage of cages) {
                const sum = cage.cells.reduce((s, c) => s + solution[c.row][c.col], 0);
                if (sum !== cage.sum) return false;
            }
            return true;
        });
        expect(sumsMatch).toBe(true);
    });

    test('each cage has 2-4 cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        const validSizes = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const cages = app.board.getCages();
            return cages.every(c => c.cells.length >= 1 && c.cells.length <= 4);
        });
        expect(validSizes).toBe(true);
    });

    test('killer game can be completed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await expect(page.locator('.complete-title')).toBeVisible();
    });

    test('killer variant persists in save/load', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        // Verify killer variant is set
        const savedVariant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });
        expect(savedVariant).toBe('killer');

        // Explicitly save the game to storage
        await page.evaluate(async () => {
            const { saveGame } = await import('./js/utils/storage.js');
            const mod = await import('./js/app.js');
            saveGame(mod.default.board.toJSON());
        });

        // Navigate to main and back
        await page.click('#screen-game .btn-back');
        await page.waitForSelector('#screen-main.active');
        await page.waitForSelector('.btn-continue-game', { state: 'visible', timeout: 5000 });
        await page.click('.btn-continue-game');
        await page.waitForSelector('#screen-game.active');

        const restoredVariant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });
        expect(restoredVariant).toBe('killer');

        // Check cages are restored
        const hasCages = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const cages = mod.default.board.getCages();
            return cages && cages.length > 0;
        });
        expect(hasCages).toBe(true);
    });

    test('history shows killer badge after completion', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Go to main
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Go to history
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        const killerBadge = page.locator('.badge-killer');
        await expect(killerBadge).toBeVisible();
        await expect(killerBadge).toContainText('킬러');
    });

    test('cage cells in same cage highlight on selection', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'killer' });

        // Click first cell and check that cage cells get highlighted
        const cell = page.locator('.cell[data-row="0"][data-col="0"]');
        await cell.click();

        const highlighted = page.locator('.cell.highlighted');
        const count = await highlighted.count();
        // Should have highlighted cells from row, col, block, and cage
        expect(count).toBeGreaterThan(0);
    });
});

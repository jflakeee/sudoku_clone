// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Puzzle Result Sharing', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('share button exists on complete screen', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const shareBtn = page.locator('#btn-share-result');
        await expect(shareBtn).toBeVisible();
        await expect(shareBtn).toContainText('결과 공유');
    });

    test('share text format is correct', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Generate share text directly
        const shareText = await page.evaluate(async () => {
            const { generateShareText } = await import('./js/utils/share.js');
            const appMod = await import('./js/app.js');
            const app = appMod.default;
            const board = app.board;
            return generateShareText(board, board.getDifficulty(), 'classic', board.variant || 'standard', 120, 0);
        });

        // Validate format
        expect(shareText).toContain('\uC2A4\uB3C4\uCFE0 \uB9AC\uADF8');
        expect(shareText).toContain('Easy');
        expect(shareText).toContain('\u23F1\uFE0F');
        expect(shareText).toContain('\uC2E4\uC218 0');

        // Should contain emoji grid rows
        const lines = shareText.split('\n');
        // Grid lines consist only of green/black square emojis
        const gridLines = lines.filter(l => /^[\uD83D\uDFE9\u2B1B]+$/.test(l.trim()) && l.trim().length > 0);
        expect(gridLines.length).toBe(9); // 9x9 grid
    });

    test('share text contains green squares for given cells', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const shareText = await page.evaluate(async () => {
            const { generateShareText } = await import('./js/utils/share.js');
            const appMod = await import('./js/app.js');
            const app = appMod.default;
            const board = app.board;
            return generateShareText(board, 'easy', 'classic', 'standard', 120, 0);
        });

        // Should contain both green (given) and black (filled) squares
        expect(shareText).toContain('\uD83D\uDFE9'); // green square
        expect(shareText).toContain('\u2B1B'); // black square
    });

    test('clipboard fallback works when share API unavailable', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Grant clipboard permissions
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        // Click share button
        const shareBtn = page.locator('#btn-share-result');
        await shareBtn.click();

        // Toast should appear
        const toast = page.locator('#share-toast');
        await expect(toast).toBeVisible({ timeout: 3000 });
    });

    test('share text includes variant info for diagonal', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const shareText = await page.evaluate(async () => {
            const { generateShareText } = await import('./js/utils/share.js');
            const appMod = await import('./js/app.js');
            const app = appMod.default;
            const board = app.board;
            return generateShareText(board, 'easy', 'classic', 'diagonal', 120, 0);
        });

        expect(shareText).toContain('\uBCC0\uD615: \uB300\uAC01\uC120');
    });

    test('share text includes time attack mode info', async ({ page }) => {
        const shareText = await page.evaluate(async () => {
            const { generateShareText } = await import('./js/utils/share.js');
            // Create a mock board object
            const mockBoard = {
                boardSize: 9,
                getGiven: () => {
                    const g = [];
                    for (let r = 0; r < 9; r++) {
                        g.push([]);
                        for (let c = 0; c < 9; c++) {
                            g[r].push((r + c) % 3 === 0 ? 1 : 0);
                        }
                    }
                    return g;
                },
            };
            return generateShareText(mockBoard, 'hard', 'timeAttack', 'standard', 300, 2);
        });

        expect(shareText).toContain('\u26A1 \uD0C0\uC784\uC5B4\uD0DD');
        expect(shareText).toContain('Hard');
        expect(shareText).toContain('\uC2E4\uC218 2');
    });
});

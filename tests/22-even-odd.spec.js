// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Even/Odd Variant', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    // --- Mode Select UI ---

    test('even-odd variant option is visible in mode select', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await expect(page.locator('.variant-option[data-variant="even-odd"]')).toBeVisible();
    });

    test('even-odd variant can be selected', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('.variant-option[data-variant="even-odd"]');
        const evenOddBtn = page.locator('.variant-option[data-variant="even-odd"]');
        await expect(evenOddBtn).toHaveClass(/active/);
        const standardBtn = page.locator('.variant-option[data-variant="standard"]');
        await expect(standardBtn).not.toHaveClass(/active/);
    });

    test('selecting even-odd forces 9x9 board size', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        // First select 4x4
        await page.click('.size-option[data-size="4"]');
        // Then select even-odd
        await page.click('.variant-option[data-variant="even-odd"]');
        // 9x9 should be active now
        const size9Btn = page.locator('.size-option[data-size="9"]');
        await expect(size9Btn).toHaveClass(/active/);
        // Other sizes should be disabled
        const size4Btn = page.locator('.size-option[data-size="4"]');
        await expect(size4Btn).toHaveClass(/disabled/);
    });

    // --- Puzzle Generation ---

    test('even-odd game starts successfully', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });
        expect(variant).toBe('even-odd');
    });

    test('even-odd game has evenOddMap', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        const hasMap = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const map = mod.default.board.getEvenOddMap();
            return map !== null && Array.isArray(map) && map.length === 9;
        });
        expect(hasMap).toBe(true);
    });

    test('evenOddMap has some marked cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        const markedCount = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const map = mod.default.board.getEvenOddMap();
            let count = 0;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (map[r][c] !== 0) count++;
                }
            }
            return count;
        });
        // ~35% of 81 cells = ~28 cells, should be > 10
        expect(markedCount).toBeGreaterThan(10);
    });

    test('evenOddMap values match solution parity', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        const allMatch = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const board = mod.default.board;
            const map = board.getEvenOddMap();
            const solution = board.getSolution();
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (map[r][c] === 1 && solution[r][c] % 2 !== 1) return false;
                    if (map[r][c] === 2 && solution[r][c] % 2 !== 0) return false;
                }
            }
            return true;
        });
        expect(allMatch).toBe(true);
    });

    // --- Visual: Even/Odd Markers ---

    test('even cells have cell-even CSS class', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        const evenCount = await page.locator('.cell.cell-even').count();
        expect(evenCount).toBeGreaterThan(0);
    });

    test('odd cells have cell-odd CSS class', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        const oddCount = await page.locator('.cell.cell-odd').count();
        expect(oddCount).toBeGreaterThan(0);
    });

    test('standard game has no even/odd CSS classes', async ({ page }) => {
        await startNewGame(page, 'easy');
        const evenCount = await page.locator('.cell.cell-even').count();
        const oddCount = await page.locator('.cell.cell-odd').count();
        expect(evenCount).toBe(0);
        expect(oddCount).toBe(0);
    });

    // --- Game Info Bar ---

    test('even-odd game shows variant info in info bar', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        await expect(page.locator('.info-variant')).toBeVisible();
        await expect(page.locator('.variant-value')).toHaveText('짝홀');
    });

    // --- Game Completion ---

    test('even-odd game can be completed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await expect(page.locator('.complete-title')).toBeVisible();
    });

    // --- Save / Load ---

    test('even-odd variant persists after save and restore', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });

        // Make a move so it saves
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === 0) {
                        app.input.selectCell(r, c);
                        app.input.inputNumber(solution[r][c]);
                        return;
                    }
                }
            }
        });

        // Go back to main
        await page.click('#screen-game [data-action="back"]');
        await page.waitForSelector('#screen-main.active');

        // Resume via continue button
        await page.click('.btn-continue-game');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });
        expect(variant).toBe('even-odd');

        // Even/odd markers should still be present
        const evenCount = await page.locator('.cell.cell-even').count();
        const oddCount = await page.locator('.cell.cell-odd').count();
        expect(evenCount + oddCount).toBeGreaterThan(0);
    });

    // --- History ---

    test('completed even-odd game appears in history with badge', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        await expect(page.locator('.badge-even-odd').first()).toBeVisible();
    });

    test('history entry stores even-odd variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'even-odd' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const historyVariant = await page.evaluate(() => {
            const history = JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
            return history[0]?.variant;
        });
        expect(historyVariant).toBe('even-odd');
    });
});

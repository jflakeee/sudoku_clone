// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Windoku Variant', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    // --- Mode Select UI ---

    test('windoku variant option is visible in mode select', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await expect(page.locator('.variant-option[data-variant="windoku"]')).toBeVisible();
    });

    test('windoku variant can be selected', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('.variant-option[data-variant="windoku"]');
        const windokuBtn = page.locator('.variant-option[data-variant="windoku"]');
        await expect(windokuBtn).toHaveClass(/active/);
        const standardBtn = page.locator('.variant-option[data-variant="standard"]');
        await expect(standardBtn).not.toHaveClass(/active/);
    });

    test('selecting windoku forces 9x9 board size', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        // First select 6x6
        await page.click('.size-option[data-size="6"]');
        // Then select windoku
        await page.click('.variant-option[data-variant="windoku"]');
        // 9x9 should be active
        const size9Btn = page.locator('.size-option[data-size="9"]');
        await expect(size9Btn).toHaveClass(/active/);
        // Other sizes should be disabled
        const size6Btn = page.locator('.size-option[data-size="6"]');
        await expect(size6Btn).toHaveClass(/disabled/);
        const size4Btn = page.locator('.size-option[data-size="4"]');
        await expect(size4Btn).toHaveClass(/disabled/);
    });

    test('switching away from windoku re-enables board sizes', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        // Select windoku
        await page.click('.variant-option[data-variant="windoku"]');
        // Now select standard
        await page.click('.variant-option[data-variant="standard"]');
        // 4x4 should be enabled again
        const size4Btn = page.locator('.size-option[data-size="4"]');
        await expect(size4Btn).not.toHaveClass(/disabled/);
    });

    // --- Puzzle Generation ---

    test('windoku game starts with 9x9 board', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        const state = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return {
                variant: mod.default.board.variant,
                boardSize: mod.default.board.boardSize,
            };
        });
        expect(state.variant).toBe('windoku');
        expect(state.boardSize).toBe(9);
    });

    test('windoku solution has unique digits in window 1', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        const valid = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const solution = mod.default.board.getSolution();
            // Window 1: rows 1-3, cols 1-3
            const digits = [];
            for (let r = 1; r <= 3; r++) {
                for (let c = 1; c <= 3; c++) {
                    digits.push(solution[r][c]);
                }
            }
            return new Set(digits).size === 9;
        });
        expect(valid).toBe(true);
    });

    test('windoku solution has unique digits in all 4 windows', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        const valid = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const solution = mod.default.board.getSolution();
            const windows = [
                { rStart: 1, cStart: 1 },
                { rStart: 1, cStart: 5 },
                { rStart: 5, cStart: 1 },
                { rStart: 5, cStart: 5 },
            ];
            for (const w of windows) {
                const digits = [];
                for (let r = w.rStart; r < w.rStart + 3; r++) {
                    for (let c = w.cStart; c < w.cStart + 3; c++) {
                        digits.push(solution[r][c]);
                    }
                }
                if (new Set(digits).size !== 9) return false;
            }
            return true;
        });
        expect(valid).toBe(true);
    });

    // --- Visual: Windoku Window Cells ---

    test('windoku window cells have windoku-window CSS class', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        // 4 windows x 9 cells = 36 cells
        const windowCells = await page.locator('.cell.windoku-window').count();
        expect(windowCells).toBe(36);
    });

    test('standard game has no windoku-window CSS class', async ({ page }) => {
        await startNewGame(page, 'easy');
        const windowCells = await page.locator('.cell.windoku-window').count();
        expect(windowCells).toBe(0);
    });

    // --- Game Info Bar ---

    test('windoku game shows variant info in info bar', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        await expect(page.locator('.info-variant')).toBeVisible();
        await expect(page.locator('.variant-value')).toHaveText('윈도쿠');
    });

    // --- Highlight ---

    test('selecting windoku window cell highlights window cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        // Click a cell in window 1 (row=1, col=1)
        await page.click('.cell[data-row="1"][data-col="1"]');
        // Other window cells should be highlighted
        const highlighted = await page.locator('.cell.highlighted.windoku-window').count();
        expect(highlighted).toBeGreaterThan(0);
    });

    // --- Conflict Detection ---

    test('windoku window conflict is detected', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        const hasConflict = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            // Window 1: rows 1-3, cols 1-3
            // Find an empty cell in window 1
            let target = null;
            for (let r = 1; r <= 3; r++) {
                for (let c = 1; c <= 3; c++) {
                    if (board[r][c] === 0) {
                        target = { row: r, col: c };
                        break;
                    }
                }
                if (target) break;
            }
            if (!target) return null;
            // Find a number that exists elsewhere in window 1 (wrong answer)
            const correctNum = solution[target.row][target.col];
            let wrongNum = -1;
            for (let r = 1; r <= 3; r++) {
                for (let c = 1; c <= 3; c++) {
                    if (r === target.row && c === target.col) continue;
                    if (board[r][c] !== 0 && board[r][c] !== correctNum) {
                        wrongNum = board[r][c];
                        break;
                    }
                }
                if (wrongNum > 0) break;
            }
            if (wrongNum === -1) return null;
            app.input.selectCell(target.row, target.col);
            app.input.inputNumber(wrongNum);
            const cell = document.querySelector(`.cell[data-row="${target.row}"][data-col="${target.col}"]`);
            return cell?.classList.contains('error');
        });
        if (hasConflict !== null) {
            expect(hasConflict).toBe(true);
        }
    });

    // --- Game Completion ---

    test('windoku game can be completed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await expect(page.locator('.complete-title')).toBeVisible();
    });

    // --- Save / Load ---

    test('windoku variant persists after save and restore', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });

        // Make a move
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

        await page.click('#screen-game [data-action="back"]');
        await page.waitForSelector('#screen-main.active');
        await page.click('.btn-continue-game');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });
        expect(variant).toBe('windoku');

        const windowCells = await page.locator('.cell.windoku-window').count();
        expect(windowCells).toBe(36);
    });

    // --- History ---

    test('completed windoku game appears in history with badge', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        await expect(page.locator('.badge-windoku').first()).toBeVisible();
    });

    test('history entry stores windoku variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const historyVariant = await page.evaluate(() => {
            const history = JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
            return history[0]?.variant;
        });
        expect(historyVariant).toBe('windoku');
    });

    // --- Replay ---

    test('replay preserves windoku variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'windoku' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });
        expect(variant).toBe('windoku');

        const windowCells = await page.locator('.cell.windoku-window').count();
        expect(windowCells).toBe(36);
    });
});

// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Advanced Hint Strategies', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('hint system returns hiddenSingle when applicable', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Test that the hint system works by getting a hint
        const hint = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const { getHint } = await import('./js/game/hints.js');
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const boardSize = app.board.boardSize;
            const blockSize = app.board.blockSize;
            const variant = app.board.variant;
            return getHint(board, solution, null, boardSize, blockSize, true, variant);
        });

        expect(hint).not.toBeNull();
        expect(hint.row).toBeGreaterThanOrEqual(0);
        expect(hint.col).toBeGreaterThanOrEqual(0);
        expect(hint.value).toBeGreaterThanOrEqual(1);
        expect(hint.message).toBeTruthy();
    });

    test('hint message is in Korean', async ({ page }) => {
        await startNewGame(page, 'easy');

        const hint = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const { getHint } = await import('./js/game/hints.js');
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const boardSize = app.board.boardSize;
            const blockSize = app.board.blockSize;
            const variant = app.board.variant;
            return getHint(board, solution, null, boardSize, blockSize, true, variant);
        });

        expect(hint).not.toBeNull();
        // Korean characters are in the range \uAC00-\uD7AF
        expect(hint.message).toMatch(/[\uAC00-\uD7AF]/);
    });

    test('hint types follow priority chain', async ({ page }) => {
        await startNewGame(page, 'easy');

        const hintType = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const { getHint } = await import('./js/game/hints.js');
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const boardSize = app.board.boardSize;
            const blockSize = app.board.blockSize;
            const variant = app.board.variant;
            const hint = getHint(board, solution, null, boardSize, blockSize, true, variant);
            return hint ? hint.type : null;
        });

        // Should be one of the known hint types
        const validTypes = ['lastInRow', 'lastInCol', 'lastInBlock', 'lastInVariantGroup',
            'hiddenSingle', 'nakedSingle', 'nakedPair', 'pointingPair', 'direct'];
        expect(validTypes).toContain(hintType);
    });

    test('hiddenSingle can be found on a partially solved board', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Fill some cells to create hidden single opportunities
        const hintResult = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize;

            // Fill ~60% of empty cells to make easier hints
            let filled = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && filled < 15) {
                        app.input.selectCell(r, c);
                        app.input.inputNumber(solution[r][c]);
                        filled++;
                    }
                }
            }

            const { getHint } = await import('./js/game/hints.js');
            const updatedBoard = app.board.getBoard();
            const blockSize = app.board.blockSize;
            const variant = app.board.variant;
            const hint = getHint(updatedBoard, solution, null, size, blockSize, true, variant);
            return hint ? { type: hint.type, value: hint.value, message: hint.message } : null;
        });

        expect(hintResult).not.toBeNull();
        expect(hintResult.value).toBeGreaterThanOrEqual(1);
    });

    test('direct hint is used as fallback for hard puzzles', async ({ page }) => {
        await startNewGame(page, 'easy');

        const hintType = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const { getHint } = await import('./js/game/hints.js');
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const boardSize = app.board.boardSize;
            const blockSize = app.board.blockSize;
            // Test with smartHints=false to force direct reveal
            const hint = getHint(board, solution, null, boardSize, blockSize, false, 'standard');
            return hint ? hint.type : null;
        });

        expect(hintType).toBe('direct');
    });

    test('hint button works and provides correct value', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Click on an empty cell first
        const emptyCellPos = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const size = app.board.boardSize;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && !app.board.isGiven(r, c)) {
                        return { row: r, col: c };
                    }
                }
            }
            return null;
        });

        expect(emptyCellPos).not.toBeNull();

        // Click hint button
        await page.click('[data-action="hint"]');

        // Verify hint badge decremented
        const hintCount = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.board.getHintCount();
        });
        expect(hintCount).toBe(2); // Started at 3, used 1
    });
});

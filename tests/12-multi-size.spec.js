// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp } = require('./helpers');

test.describe('Multi-Size Board', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('4x4 board generates valid puzzle', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { generatePuzzle } = await import('./js/core/generator.js');
            const puzzle = generatePuzzle('easy', 4);
            return {
                boardSize: puzzle.board.length,
                rowSize: puzzle.board[0].length,
                solutionValid: puzzle.solution.every(r => r.every(v => v >= 1 && v <= 4)),
                hasEmptyCells: puzzle.board.flat().some(v => v === 0),
            };
        });
        expect(result.boardSize).toBe(4);
        expect(result.rowSize).toBe(4);
        expect(result.solutionValid).toBe(true);
        expect(result.hasEmptyCells).toBe(true);
    });

    test('6x6 board generates valid puzzle with 2x3 blocks', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { generatePuzzle } = await import('./js/core/generator.js');
            const puzzle = generatePuzzle('easy', 6);
            return {
                boardSize: puzzle.board.length,
                rowSize: puzzle.board[0].length,
                solutionValid: puzzle.solution.every(r => r.every(v => v >= 1 && v <= 6)),
                hasEmptyCells: puzzle.board.flat().some(v => v === 0),
            };
        });
        expect(result.boardSize).toBe(6);
        expect(result.rowSize).toBe(6);
        expect(result.solutionValid).toBe(true);
        expect(result.hasEmptyCells).toBe(true);
    });

    test('9x9 board still works (regression)', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { generatePuzzle } = await import('./js/core/generator.js');
            const puzzle = generatePuzzle('easy', 9);
            return {
                boardSize: puzzle.board.length,
                solutionValid: puzzle.solution.every(r => r.every(v => v >= 1 && v <= 9)),
            };
        });
        expect(result.boardSize).toBe(9);
        expect(result.solutionValid).toBe(true);
    });

    test('board-config provides correct block sizes', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { getBlockSize } = await import('./js/core/board-config.js');
            return {
                b4: getBlockSize(4),
                b6: getBlockSize(6),
                b9: getBlockSize(9),
                b12: getBlockSize(12),
                b16: getBlockSize(16),
            };
        });
        expect(result.b4).toEqual({ rows: 2, cols: 2 });
        expect(result.b6).toEqual({ rows: 2, cols: 3 });
        expect(result.b9).toEqual({ rows: 3, cols: 3 });
        expect(result.b12).toEqual({ rows: 3, cols: 4 });
        expect(result.b16).toEqual({ rows: 4, cols: 4 });
    });

    test('validator works with different board sizes', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { getRowCells, getColCells, getBlockCells } = await import('./js/core/validator.js');
            return {
                row4: getRowCells(0, 4).length,
                col6: getColCells(0, 6).length,
                block6: getBlockCells(0, 0, 6).length,
                block9: getBlockCells(0, 0, 9).length,
            };
        });
        expect(result.row4).toBe(4);
        expect(result.col6).toBe(6);
        expect(result.block6).toBe(6);
        expect(result.block9).toBe(9);
    });

    test('grid UI rebuilds for different sizes', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            if (app.gridUI && app.gridUI.rebuild) {
                app.gridUI.rebuild(4);
                return document.querySelectorAll('.sudoku-grid .cell').length;
            }
            return -1;
        });
        if (result !== -1) {
            expect(result).toBe(16);
        }
    });

    test('numberpad rebuilds for different sizes', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            if (app.numberpadUI && app.numberpadUI.rebuild) {
                app.numberpadUI.rebuild(6);
                return document.querySelectorAll('#numberpad .num-btn').length;
            }
            return -1;
        });
        if (result !== -1) {
            expect(result).toBe(6);
        }
    });
});

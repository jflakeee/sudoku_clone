// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Replay Mode (Past Game Retry)', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('replay button starts game with same puzzle', async ({ page }) => {
        // Complete a game first
        await startNewGame(page, 'easy');

        // Get the initial puzzle before solving
        const originalPuzzle = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getInitialPuzzle();
        });

        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Navigate to history
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        // Click replay
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        // Verify the puzzle is the same
        const replayPuzzle = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getInitialPuzzle();
        });

        expect(replayPuzzle).toEqual(originalPuzzle);
    });

    test('replay game resets score and mistakes', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const state = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const board = mod.default.board;
            return {
                score: board.getScore(),
                mistakes: board.getMistakes().current,
            };
        });

        expect(state.score).toBe(0);
        expect(state.mistakes).toBe(0);
    });

    test('replay preserves difficulty', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const difficulty = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getDifficulty();
        });

        expect(difficulty).toBe('easy');
    });

    test('replay game can be completed', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        // Solve the replayed puzzle
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        await expect(page.locator('.complete-title')).toBeVisible();
    });

    test('replay from seeded history entry works', async ({ page }) => {
        // Seed a history entry with a simple 4x4 puzzle
        await page.evaluate(() => {
            const puzzle = [
                [1, 2, 0, 0],
                [0, 0, 1, 2],
                [2, 1, 0, 0],
                [0, 0, 2, 1],
            ];
            const solution = [
                [1, 2, 3, 4],
                [3, 4, 1, 2],
                [2, 1, 4, 3],
                [4, 3, 2, 1],
            ];
            const given = puzzle.map(r => r.map(v => v !== 0));
            const entries = [{
                id: 'test-replay',
                date: new Date().toISOString(),
                difficulty: 'easy',
                mode: 'classic',
                boardSize: 4,
                score: 100,
                time: 30,
                mistakes: 0,
                puzzle,
                solution,
                given,
            }];
            localStorage.setItem('sudoku_gameHistory', JSON.stringify(entries));
        });

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const boardSize = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.boardSize;
        });

        expect(boardSize).toBe(4);
    });

    test('replay preserves board size for 4x4', async ({ page }) => {
        await startNewGame(page, 'easy', { boardSize: 4 });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const boardSize = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.boardSize;
        });

        expect(boardSize).toBe(4);
    });

    test('newGameFromPuzzle sets timer running', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        // Wait a moment for timer to tick
        await page.waitForTimeout(1100);

        const elapsed = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.timer.getElapsed();
        });

        expect(elapsed).toBeGreaterThan(0);
    });

    test('replay game has empty cells to fill', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const emptyCells = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const board = mod.default.board.getBoard();
            return board.flat().filter(v => v === 0).length;
        });

        expect(emptyCells).toBeGreaterThan(0);
    });

    test('replaying same game produces same solution', async ({ page }) => {
        await startNewGame(page, 'easy');

        const originalSolution = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getSolution();
        });

        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const replaySolution = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.getSolution();
        });

        expect(replaySolution).toEqual(originalSolution);
    });
});

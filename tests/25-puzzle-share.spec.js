// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Puzzle URL Sharing', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('encodePuzzle and decodePuzzle round-trip works', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { encodePuzzle, decodePuzzle } = await import('./js/utils/puzzle-share.js');

            const puzzle = [
                [1, 0, 3, 4],
                [3, 4, 0, 2],
                [0, 3, 4, 1],
                [4, 1, 2, 0],
            ];
            const solution = [
                [1, 2, 3, 4],
                [3, 4, 1, 2],
                [2, 3, 4, 1],
                [4, 1, 2, 3],
            ];

            const code = encodePuzzle(puzzle, solution, 4, 'standard');
            const decoded = decodePuzzle(code);

            return {
                code: typeof code === 'string' && code.length > 0,
                decoded: decoded !== null,
                puzzleMatch: JSON.stringify(decoded.puzzle) === JSON.stringify(puzzle),
                solutionMatch: JSON.stringify(decoded.solution) === JSON.stringify(solution),
                boardSize: decoded.boardSize,
                variant: decoded.variant,
            };
        });

        expect(result.code).toBe(true);
        expect(result.decoded).toBe(true);
        expect(result.puzzleMatch).toBe(true);
        expect(result.solutionMatch).toBe(true);
        expect(result.boardSize).toBe(4);
        expect(result.variant).toBe('standard');
    });

    test('encodePuzzle preserves diagonal variant', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { encodePuzzle, decodePuzzle } = await import('./js/utils/puzzle-share.js');

            const puzzle = [[1, 0, 3, 4], [3, 4, 0, 2], [0, 3, 4, 1], [4, 1, 2, 0]];
            const solution = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 3, 4, 1], [4, 1, 2, 3]];

            const code = encodePuzzle(puzzle, solution, 4, 'diagonal');
            const decoded = decodePuzzle(code);
            return decoded.variant;
        });

        expect(result).toBe('diagonal');
    });

    test('decodePuzzle returns null for invalid code', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { decodePuzzle } = await import('./js/utils/puzzle-share.js');
            return {
                empty: decodePuzzle(''),
                garbage: decodePuzzle('not-base64!!'),
                badJson: decodePuzzle(btoa('not json')),
            };
        });

        expect(result.empty).toBeNull();
        expect(result.garbage).toBeNull();
        expect(result.badJson).toBeNull();
    });

    test('encodePuzzle works for 9x9 board', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { encodePuzzle, decodePuzzle } = await import('./js/utils/puzzle-share.js');

            // Create a simple 9x9 puzzle
            const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
            puzzle[0] = [5, 3, 0, 0, 7, 0, 0, 0, 0];
            const solution = Array.from({ length: 9 }, (_, r) =>
                Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1)
            );

            const code = encodePuzzle(puzzle, solution, 9, 'standard');
            const decoded = decodePuzzle(code);

            return {
                boardSize: decoded.boardSize,
                puzzleMatch: JSON.stringify(decoded.puzzle) === JSON.stringify(puzzle),
            };
        });

        expect(result.boardSize).toBe(9);
        expect(result.puzzleMatch).toBe(true);
    });

    test('puzzle share button exists on complete screen', async ({ page }) => {
        await startNewGame(page, 'easy', { boardSize: 4 });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const shareBtn = page.locator('#btn-share-puzzle');
        await expect(shareBtn).toBeVisible();
        await expect(shareBtn).toContainText('퍼즐 공유');
    });

    test('puzzle import button exists on main screen', async ({ page }) => {
        const btn = page.locator('[data-action="import-puzzle"]');
        await expect(btn).toBeVisible();
        await expect(btn).toContainText('퍼즐 불러오기');
    });

    test('import modal opens and closes', async ({ page }) => {
        await page.click('[data-action="import-puzzle"]');
        const modal = page.locator('#puzzle-import-modal');
        await expect(modal).toBeVisible();

        // Close by cancel button
        await page.click('#btn-import-cancel');
        await expect(modal).toBeHidden();
    });

    test('import modal shows error for invalid code', async ({ page }) => {
        await page.click('[data-action="import-puzzle"]');
        await page.fill('#puzzle-import-input', 'invalid-code');
        await page.click('#btn-import-start');

        const error = page.locator('#puzzle-import-error');
        await expect(error).toBeVisible();
    });

    test('import modal accepts valid puzzle code and starts game', async ({ page }) => {
        // First generate a valid code
        const code = await page.evaluate(async () => {
            const { encodePuzzle } = await import('./js/utils/puzzle-share.js');
            const puzzle = [
                [1, 0, 3, 4],
                [3, 4, 0, 2],
                [0, 3, 4, 1],
                [4, 1, 2, 0],
            ];
            const solution = [
                [1, 2, 3, 4],
                [3, 4, 1, 2],
                [2, 3, 4, 1],
                [4, 1, 2, 3],
            ];
            return encodePuzzle(puzzle, solution, 4, 'standard');
        });

        await page.click('[data-action="import-puzzle"]');
        await page.fill('#puzzle-import-input', code);
        await page.click('#btn-import-start');

        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        // Verify game is running with the imported puzzle
        const boardSize = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.boardSize;
        });
        expect(boardSize).toBe(4);
    });

    test('URL parameter puzzle= starts a game', async ({ page }) => {
        // Generate a valid code
        const code = await page.evaluate(async () => {
            const { encodePuzzle } = await import('./js/utils/puzzle-share.js');
            const puzzle = [
                [1, 0, 3, 4],
                [3, 4, 0, 2],
                [0, 3, 4, 1],
                [4, 1, 2, 0],
            ];
            const solution = [
                [1, 2, 3, 4],
                [3, 4, 1, 2],
                [2, 3, 4, 1],
                [4, 1, 2, 3],
            ];
            return encodePuzzle(puzzle, solution, 4, 'standard');
        });

        // Navigate with the puzzle parameter
        await page.goto(`/index.html?puzzle=${code}`);
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        const boardSize = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.boardSize;
        });
        expect(boardSize).toBe(4);
    });

    test('history share button exists', async ({ page }) => {
        // Complete a game to get history
        await startNewGame(page, 'easy', { boardSize: 4 });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Go to history
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        const shareBtn = page.locator('.btn-share-puzzle').first();
        await expect(shareBtn).toBeVisible();
        await expect(shareBtn).toContainText('공유');
    });

    test('given field is correctly generated from puzzle', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { encodePuzzle, decodePuzzle } = await import('./js/utils/puzzle-share.js');

            const puzzle = [
                [1, 0, 3, 0],
                [0, 4, 0, 2],
                [2, 0, 4, 0],
                [0, 1, 0, 3],
            ];
            const solution = [
                [1, 2, 3, 4],
                [3, 4, 1, 2],
                [2, 3, 4, 1],
                [4, 1, 2, 3],
            ];

            const code = encodePuzzle(puzzle, solution, 4, 'standard');
            const decoded = decodePuzzle(code);

            return decoded.given;
        });

        // given[r][c] should be 1 for non-zero cells, 0 for zero cells
        expect(result[0][0]).toBe(1); // 1
        expect(result[0][1]).toBe(0); // 0
        expect(result[0][2]).toBe(1); // 3
        expect(result[0][3]).toBe(0); // 0
    });
});

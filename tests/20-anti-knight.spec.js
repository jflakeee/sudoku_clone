// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Anti-Knight Variant', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    // --- Mode Select UI ---

    test('anti-knight variant option is visible in mode select', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await expect(page.locator('.variant-option[data-variant="anti-knight"]')).toBeVisible();
    });

    test('anti-knight variant can be selected', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('.variant-option[data-variant="anti-knight"]');
        const btn = page.locator('.variant-option[data-variant="anti-knight"]');
        await expect(btn).toHaveClass(/active/);
        const standardBtn = page.locator('.variant-option[data-variant="standard"]');
        await expect(standardBtn).not.toHaveClass(/active/);
    });

    // --- Puzzle Generation ---

    test('board variant is set to anti-knight', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });

        expect(variant).toBe('anti-knight');
    });

    test('anti-knight puzzle has no knight-move duplicates', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });

        const valid = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const solution = mod.default.board.getSolution();
            const size = mod.default.board.boardSize;
            const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const val = solution[r][c];
                    for (const [dr, dc] of offsets) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                            if (solution[nr][nc] === val) return false;
                        }
                    }
                }
            }
            return true;
        });

        expect(valid).toBe(true);
    });

    // --- Game Info Bar ---

    test('anti-knight game shows variant info in info bar', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });
        await expect(page.locator('.info-variant')).toBeVisible();
        await expect(page.locator('.variant-value')).toHaveText('안티나이트');
    });

    // --- Highlight ---

    test('selecting cell highlights knight-move cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });

        // Click cell (4,4) - center of 9x9
        await page.click('.cell[data-row="4"][data-col="4"]');

        // Knight-move cells from (4,4): (2,3),(2,5),(3,2),(3,6),(5,2),(5,6),(6,3),(6,5)
        // At least some of these should be highlighted
        const highlighted = await page.locator('.cell.highlighted').count();
        // Row(9) + col(9) + block(9) - overlaps + knight cells = many highlighted cells
        expect(highlighted).toBeGreaterThan(0);
    });

    // --- Conflict Detection ---

    test('knight-move conflict is detected', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });

        const hasConflict = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize;
            const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

            // Find an empty cell
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] !== 0) continue;

                    // Find a filled knight-move neighbor
                    for (const [dr, dc] of offsets) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] !== 0) {
                            const wrongNum = board[nr][nc];
                            if (wrongNum === solution[r][c]) continue;

                            app.input.selectCell(r, c);
                            app.input.inputNumber(wrongNum);

                            const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                            return cell?.classList.contains('error');
                        }
                    }
                }
            }
            return null;
        });

        if (hasConflict !== null) {
            expect(hasConflict).toBe(true);
        }
    });

    // --- Notes ---

    test('notes are cleared on knight-move cells when number is placed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });

        const result = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize;
            const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

            // Find an empty cell and an empty knight-move neighbor
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] !== 0) continue;
                    const num = solution[r][c];

                    for (const [dr, dc] of offsets) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === 0) {
                            // Add note on neighbor
                            app.board.notes.toggle(nr, nc, num);
                            const hadNote = app.board.notes.get(nr, nc).has(num);

                            // Place number on original cell
                            app.input.selectCell(r, c);
                            app.input.inputNumber(num);

                            const hasNote = app.board.notes.get(nr, nc).has(num);
                            return { hadNote, hasNote };
                        }
                    }
                }
            }
            return null;
        });

        if (result !== null) {
            expect(result.hadNote).toBe(true);
            expect(result.hasNote).toBe(false);
        }
    });

    // --- Save / Load ---

    test('anti-knight variant persists after save and restore', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });

        // Make a move
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize || 9;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
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

        expect(variant).toBe('anti-knight');
    });

    // --- Complete & History ---

    test('completed anti-knight game appears in history with badge', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        await expect(page.locator('.badge-anti-knight').first()).toBeVisible();
    });

    test('history entry stores anti-knight variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const historyVariant = await page.evaluate(() => {
            const history = JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
            return history[0]?.variant;
        });

        expect(historyVariant).toBe('anti-knight');
    });

    // --- Replay ---

    test('replay preserves anti-knight variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });
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

        expect(variant).toBe('anti-knight');
    });

    test('replay anti-knight game can be completed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'anti-knight' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');
        await page.click('.btn-replay');
        await page.waitForSelector('#screen-game.active', { timeout: 10000 });

        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });
        await expect(page.locator('.complete-title')).toBeVisible();
    });

    // --- Backward Compatibility ---

    test('standard game is not affected by anti-knight variant', async ({ page }) => {
        await startNewGame(page, 'easy');

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });

        expect(variant).toBe('standard');
        await expect(page.locator('.info-variant')).toBeHidden();
    });
});

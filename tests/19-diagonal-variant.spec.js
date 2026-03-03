// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Diagonal Variant', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    // --- Mode Select UI ---

    test('variant section is visible in mode select', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await expect(page.locator('.variant-section')).toBeVisible();
    });

    test('standard variant is selected by default', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        const standardBtn = page.locator('.variant-option[data-variant="standard"]');
        await expect(standardBtn).toHaveClass(/active/);
    });

    test('diagonal variant can be selected', async ({ page }) => {
        await page.click('.btn-new-game');
        await page.waitForSelector('#screen-mode-select.active');
        await page.click('.variant-option[data-variant="diagonal"]');
        const diagonalBtn = page.locator('.variant-option[data-variant="diagonal"]');
        await expect(diagonalBtn).toHaveClass(/active/);
        const standardBtn = page.locator('.variant-option[data-variant="standard"]');
        await expect(standardBtn).not.toHaveClass(/active/);
    });

    test('variant section is hidden in print mode', async ({ page }) => {
        await page.click('[data-action="print-new"]');
        await page.waitForSelector('#screen-mode-select.active');
        await expect(page.locator('.variant-section')).toBeHidden();
    });

    // --- Puzzle Generation ---

    test('diagonal puzzle has unique digits on main diagonal', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        const mainDiagValid = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const solution = mod.default.board.getSolution();
            const size = mod.default.board.boardSize;
            const diag = [];
            for (let i = 0; i < size; i++) diag.push(solution[i][i]);
            return new Set(diag).size === size;
        });

        expect(mainDiagValid).toBe(true);
    });

    test('diagonal puzzle has unique digits on anti-diagonal', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        const antiDiagValid = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const solution = mod.default.board.getSolution();
            const size = mod.default.board.boardSize;
            const diag = [];
            for (let i = 0; i < size; i++) diag.push(solution[i][size - 1 - i]);
            return new Set(diag).size === size;
        });

        expect(antiDiagValid).toBe(true);
    });

    test('board variant is set to diagonal', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });

        expect(variant).toBe('diagonal');
    });

    // --- Visual: Diagonal Cells ---

    test('diagonal cells have diagonal CSS class', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        // 9x9: main diagonal has 9 cells, anti-diagonal has 9 cells,
        // center cell (4,4) is on both = 17 unique cells
        const diagonalCells = await page.locator('.cell.diagonal').count();
        expect(diagonalCells).toBe(17);
    });

    test('standard game has no diagonal CSS class', async ({ page }) => {
        await startNewGame(page, 'easy');

        const diagonalCells = await page.locator('.cell.diagonal').count();
        expect(diagonalCells).toBe(0);
    });

    test('4x4 diagonal has correct number of diagonal cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal', boardSize: 4 });

        // 4x4: main diagonal 4 + anti-diagonal 4, overlap at (1,2) and (2,1)? No.
        // main: (0,0),(1,1),(2,2),(3,3)  anti: (0,3),(1,2),(2,1),(3,0)
        // No overlap for 4x4 → 8 cells
        const diagonalCells = await page.locator('.cell.diagonal').count();
        expect(diagonalCells).toBe(8);
    });

    // --- Game Info Bar ---

    test('diagonal game shows variant info in info bar', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });
        await expect(page.locator('.info-variant')).toBeVisible();
        await expect(page.locator('.variant-value')).toHaveText('대각선');
    });

    test('standard game hides variant info', async ({ page }) => {
        await startNewGame(page, 'easy');
        await expect(page.locator('.info-variant')).toBeHidden();
    });

    // --- Highlight ---

    test('selecting diagonal cell highlights diagonal cells', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        // Click a cell on the main diagonal (0,0)
        await page.click('.cell[data-row="0"][data-col="0"]');

        // Other main diagonal cells should be highlighted
        const highlighted = await page.locator('.cell.highlighted.diagonal').count();
        expect(highlighted).toBeGreaterThan(0);
    });

    // --- Conflict Detection ---

    test('diagonal conflict is detected', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        const hasConflict = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize;

            // Find an empty cell on the main diagonal
            let targetRow = -1;
            for (let i = 0; i < size; i++) {
                if (board[i][i] === 0) {
                    targetRow = i;
                    break;
                }
            }

            if (targetRow === -1) return null; // No empty diagonal cell

            // Find a number that's already on the diagonal (wrong answer)
            const correctNum = solution[targetRow][targetRow];
            let wrongNum = -1;
            for (let i = 0; i < size; i++) {
                if (i !== targetRow && board[i][i] !== 0) {
                    wrongNum = board[i][i];
                    // Make sure it's not also the correct number
                    if (wrongNum !== correctNum) break;
                    wrongNum = -1;
                }
            }

            if (wrongNum === -1) return null; // Can't find suitable wrong number

            app.input.selectCell(targetRow, targetRow);
            app.input.inputNumber(wrongNum);

            // Check if error class is applied
            const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetRow}"]`);
            return cell?.classList.contains('error');
        });

        // If we could test the conflict (found suitable cells)
        if (hasConflict !== null) {
            expect(hasConflict).toBe(true);
        }
    });

    // --- Notes ---

    test('notes are cleared on diagonal when number is placed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        const notesCleared = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize;

            // Find two empty cells on the main diagonal
            const emptyCells = [];
            for (let i = 0; i < size; i++) {
                if (board[i][i] === 0) emptyCells.push(i);
            }
            if (emptyCells.length < 2) return null;

            const cell1 = emptyCells[0];
            const cell2 = emptyCells[1];
            const num = solution[cell1][cell1];

            // Toggle note mode and add the number as a note on cell2
            app.board.notes.toggle(cell2, cell2, num);
            const hadNote = app.board.notes.get(cell2, cell2).has(num);

            // Place the number on cell1 (this should clear the note on cell2)
            app.input.selectCell(cell1, cell1);
            app.input.inputNumber(num);

            const hasNote = app.board.notes.get(cell2, cell2).has(num);
            return { hadNote, hasNote };
        });

        if (notesCleared !== null) {
            expect(notesCleared.hadNote).toBe(true);
            expect(notesCleared.hasNote).toBe(false);
        }
    });

    // --- Save / Load ---

    test('diagonal variant persists after save and restore', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });

        // Make a move so it saves
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

        expect(variant).toBe('diagonal');

        // Visual: diagonal cells should still be present
        const diagonalCells = await page.locator('.cell.diagonal').count();
        expect(diagonalCells).toBe(17);
    });

    // --- Complete & History ---

    test('completed diagonal game appears in history with variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        // Go to main
        await page.click('[data-navigate="main"]');
        await page.waitForSelector('#screen-main.active');

        // Navigate to history
        await page.click('[data-navigate="history"]');
        await page.waitForSelector('#screen-history.active');

        // Check that the history entry has diagonal badge
        await expect(page.locator('.badge-diagonal').first()).toBeVisible();
    });

    test('history entry stores variant field', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 10000 });

        const historyVariant = await page.evaluate(() => {
            const history = JSON.parse(localStorage.getItem('sudoku_gameHistory') || '[]');
            return history[0]?.variant;
        });

        expect(historyVariant).toBe('diagonal');
    });

    // --- Replay ---

    test('replay preserves diagonal variant', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });
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

        expect(variant).toBe('diagonal');

        // Diagonal cells should be visible
        const diagonalCells = await page.locator('.cell.diagonal').count();
        expect(diagonalCells).toBe(17);
    });

    test('replay diagonal game can be completed', async ({ page }) => {
        await startNewGame(page, 'easy', { variant: 'diagonal' });
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

    // --- Standard variant backward compatibility ---

    test('standard game has variant set to standard', async ({ page }) => {
        await startNewGame(page, 'easy');

        const variant = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            return mod.default.board.variant;
        });

        expect(variant).toBe('standard');
    });

    test('standard game solution does not need diagonal constraint', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Standard game may or may not have valid diagonals - just verify game works
        const state = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const board = mod.default.board;
            return {
                variant: board.variant,
                hasBoard: board.getBoard().flat().length > 0,
            };
        });

        expect(state.variant).toBe('standard');
        expect(state.hasBoard).toBe(true);
    });
});

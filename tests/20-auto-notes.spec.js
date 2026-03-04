// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Auto-fill Notes', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    test('auto-notes button is visible in the toolbar', async ({ page }) => {
        await startNewGame(page, 'easy');
        const autoNotesBtn = page.locator('[data-action="auto-notes"]');
        await expect(autoNotesBtn).toBeVisible();
        await expect(autoNotesBtn).toContainText('자동메모');
    });

    test('clicking auto-notes fills empty cells with candidate notes', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Click auto-notes button
        await page.click('[data-action="auto-notes"]');

        // Check that at least some empty cells now have notes displayed
        const notesVisible = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const size = app.board.boardSize || 9;
            let cellsWithNotes = 0;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0) {
                        const notes = app.board.notes.get(r, c);
                        if (notes.size > 0) cellsWithNotes++;
                    }
                }
            }
            return cellsWithNotes;
        });

        expect(notesVisible).toBeGreaterThan(0);
    });

    test('auto-notes does not fill cells that already have values', async ({ page }) => {
        await startNewGame(page, 'easy');

        await page.click('[data-action="auto-notes"]');

        // Given cells should not have notes
        const givenCellsWithNotes = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const size = app.board.boardSize || 9;
            let count = 0;

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (app.board.isGiven(r, c)) {
                        const notes = app.board.notes.get(r, c);
                        if (notes.size > 0) count++;
                    }
                }
            }
            return count;
        });

        expect(givenCellsWithNotes).toBe(0);
    });

    test('auto-notes can be undone with undo button', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Count notes before auto-notes
        const notesBefore = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const size = app.board.boardSize || 9;
            let count = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (app.board.notes.get(r, c).size > 0) count++;
                }
            }
            return count;
        });

        expect(notesBefore).toBe(0);

        // Apply auto-notes
        await page.click('[data-action="auto-notes"]');

        // Verify notes were added
        const notesAfter = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const size = app.board.boardSize || 9;
            let count = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (app.board.notes.get(r, c).size > 0) count++;
                }
            }
            return count;
        });

        expect(notesAfter).toBeGreaterThan(0);

        // Undo
        await page.click('[data-action="undo"]');

        // Notes should be back to 0
        const notesAfterUndo = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const size = app.board.boardSize || 9;
            let count = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (app.board.notes.get(r, c).size > 0) count++;
                }
            }
            return count;
        });

        expect(notesAfterUndo).toBe(0);
    });

    test('auto-notes fills correct candidates based on constraints', async ({ page }) => {
        await startNewGame(page, 'easy');

        await page.click('[data-action="auto-notes"]');

        // Verify that candidates are correct for a random empty cell
        const valid = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const { getCandidates } = await import('./js/core/solver.js');
            const board = app.board.getBoard();
            const size = app.board.boardSize || 9;
            const blockSize = app.board.blockSize;
            const variant = app.board.variant || 'standard';

            // Find an empty cell
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0) {
                        const expected = getCandidates(board, r, c, size, blockSize, variant);
                        const actual = app.board.notes.get(r, c);

                        if (expected.size !== actual.size) return false;
                        for (const n of expected) {
                            if (!actual.has(n)) return false;
                        }
                        return true;
                    }
                }
            }
            return true;
        });

        expect(valid).toBe(true);
    });

    test('auto-notes works with different board sizes', async ({ page }) => {
        await startNewGame(page, 'easy', { boardSize: 4 });

        await page.click('[data-action="auto-notes"]');

        const notesCount = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const size = app.board.boardSize || 4;
            let count = 0;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (app.board.getBoard()[r][c] === 0 && app.board.notes.get(r, c).size > 0) {
                        count++;
                    }
                }
            }
            return count;
        });

        expect(notesCount).toBeGreaterThan(0);
    });
});

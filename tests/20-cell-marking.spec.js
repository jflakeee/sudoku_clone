/**
 * E2E Tests for Cell Color Marking Feature
 *
 * Tests the marking tool that lets players color-code cells
 * for visual reasoning during puzzle solving.
 */
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Cell Color Marking', () => {

    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('marking button exists in toolbar', async ({ page }) => {
        const markingBtn = page.locator('.tool-btn[data-action="marking"]');
        await expect(markingBtn).toBeVisible();
        await expect(markingBtn).toHaveText(/마킹/);
    });

    test('clicking marking button toggles marking mode', async ({ page }) => {
        const markingBtn = page.locator('.tool-btn[data-action="marking"]');

        // Initially not active
        await expect(markingBtn).not.toHaveClass(/active/);

        // Click to activate
        await markingBtn.click();
        await expect(markingBtn).toHaveClass(/active/);

        // Click again to deactivate
        await markingBtn.click();
        await expect(markingBtn).not.toHaveClass(/active/);
    });

    test('color palette appears when marking mode is active', async ({ page }) => {
        const palette = page.locator('#color-palette');
        await expect(palette).toBeHidden();

        await page.click('.tool-btn[data-action="marking"]');
        await expect(palette).toBeVisible();

        // Should have 7 swatches (6 colors + 1 eraser)
        const swatches = palette.locator('.color-swatch');
        await expect(swatches).toHaveCount(7);
    });

    test('color palette hides when marking mode is deactivated', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');
        const palette = page.locator('#color-palette');
        await expect(palette).toBeVisible();

        await page.click('.tool-btn[data-action="marking"]');
        await expect(palette).toBeHidden();
    });

    test('clicking a cell in marking mode applies color', async ({ page }) => {
        // Activate marking mode
        await page.click('.tool-btn[data-action="marking"]');

        // Click a cell
        const firstCell = page.locator('.cell[data-row="0"][data-col="0"]');
        await firstCell.click();

        // The cell should have a marking color class
        await expect(firstCell).toHaveClass(/marking-color-1/);
    });

    test('selecting different color and applying to cell', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Select green (color 2)
        await page.click('.color-swatch[data-color="2"]');

        // Click a cell
        const cell = page.locator('.cell[data-row="1"][data-col="1"]');
        await cell.click();

        await expect(cell).toHaveClass(/marking-color-2/);
    });

    test('changing color on already-marked cell', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Apply color 1 (yellow)
        const cell = page.locator('.cell[data-row="0"][data-col="0"]');
        await cell.click();
        await expect(cell).toHaveClass(/marking-color-1/);

        // Change to color 3 (blue)
        await page.click('.color-swatch[data-color="3"]');
        await cell.click();
        await expect(cell).toHaveClass(/marking-color-3/);
        await expect(cell).not.toHaveClass(/marking-color-1/);
    });

    test('erasing cell color with clear button', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Apply color
        const cell = page.locator('.cell[data-row="0"][data-col="0"]');
        await cell.click();
        await expect(cell).toHaveClass(/marking-color-1/);

        // Click clear swatch (color 0)
        await page.click('.color-swatch[data-color="0"]');
        await cell.click();

        // Color should be removed
        await expect(cell).not.toHaveClass(/marking-color-/);
    });

    test('marking mode turns off notes mode', async ({ page }) => {
        // Activate notes mode first
        await page.click('.tool-btn[data-action="notes"]');
        const notesBtn = page.locator('.tool-btn[data-action="notes"]');
        await expect(notesBtn).toHaveClass(/active/);

        // Activate marking mode
        await page.click('.tool-btn[data-action="marking"]');
        const markingBtn = page.locator('.tool-btn[data-action="marking"]');
        await expect(markingBtn).toHaveClass(/active/);

        // Notes should be deactivated
        await expect(notesBtn).not.toHaveClass(/active/);
    });

    test('notes mode turns off marking mode', async ({ page }) => {
        // Activate marking mode first
        await page.click('.tool-btn[data-action="marking"]');
        const markingBtn = page.locator('.tool-btn[data-action="marking"]');
        const palette = page.locator('#color-palette');
        await expect(markingBtn).toHaveClass(/active/);
        await expect(palette).toBeVisible();

        // Activate notes mode
        await page.click('.tool-btn[data-action="notes"]');

        // Marking should be deactivated and palette hidden
        await expect(markingBtn).not.toHaveClass(/active/);
        await expect(palette).toBeHidden();
    });

    test('undo reverts marking color change', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Apply color to a cell
        const cell = page.locator('.cell[data-row="2"][data-col="2"]');
        await cell.click();
        await expect(cell).toHaveClass(/marking-color-1/);

        // Undo
        await page.click('.tool-btn[data-action="undo"]');
        await expect(cell).not.toHaveClass(/marking-color-/);
    });

    test('cell colors persist after save/load', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Apply color to cells
        const cell1 = page.locator('.cell[data-row="0"][data-col="0"]');
        await cell1.click();
        await page.click('.color-swatch[data-color="4"]');
        const cell2 = page.locator('.cell[data-row="1"][data-col="1"]');
        await cell2.click();

        // Turn off marking to deselect
        await page.click('.tool-btn[data-action="marking"]');

        // Reload page (restore saved game)
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        // Click "continue game"
        const continueBtn = page.locator('.btn-continue-game');
        if (await continueBtn.isVisible()) {
            await continueBtn.click();
            await page.waitForSelector('#screen-game.active');

            // Verify colors are restored
            const restoredCell1 = page.locator('.cell[data-row="0"][data-col="0"]');
            await expect(restoredCell1).toHaveClass(/marking-color-1/);
            const restoredCell2 = page.locator('.cell[data-row="1"][data-col="1"]');
            await expect(restoredCell2).toHaveClass(/marking-color-4/);
        }
    });

    test('multiple cells can have different colors', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Apply different colors to different cells
        await page.click('.color-swatch[data-color="1"]');
        await page.click('.cell[data-row="0"][data-col="0"]');

        await page.click('.color-swatch[data-color="2"]');
        await page.click('.cell[data-row="0"][data-col="1"]');

        await page.click('.color-swatch[data-color="5"]');
        await page.click('.cell[data-row="0"][data-col="2"]');

        await expect(page.locator('.cell[data-row="0"][data-col="0"]')).toHaveClass(/marking-color-1/);
        await expect(page.locator('.cell[data-row="0"][data-col="1"]')).toHaveClass(/marking-color-2/);
        await expect(page.locator('.cell[data-row="0"][data-col="2"]')).toHaveClass(/marking-color-5/);
    });

    test('active color swatch shows visual indicator', async ({ page }) => {
        await page.click('.tool-btn[data-action="marking"]');

        // Default color 1 should be active
        await expect(page.locator('.color-swatch[data-color="1"]')).toHaveClass(/active/);

        // Click color 3
        await page.click('.color-swatch[data-color="3"]');
        await expect(page.locator('.color-swatch[data-color="3"]')).toHaveClass(/active/);
        await expect(page.locator('.color-swatch[data-color="1"]')).not.toHaveClass(/active/);
    });

    test('normal cell input still works when marking mode is off', async ({ page }) => {
        // Ensure marking mode is off
        const markingBtn = page.locator('.tool-btn[data-action="marking"]');
        await expect(markingBtn).not.toHaveClass(/active/);

        // Find an empty cell and input a number
        const emptyCellPos = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const size = app.board.boardSize;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0) return { row: r, col: c };
                }
            }
            return null;
        });

        if (emptyCellPos) {
            const cell = page.locator(`.cell[data-row="${emptyCellPos.row}"][data-col="${emptyCellPos.col}"]`);
            await cell.click();

            // Press number 1
            await page.click('.num-btn[data-number="1"]');

            // Cell should NOT get marking color but should show a number
            await expect(cell).not.toHaveClass(/marking-color-/);
            const cellValue = await cell.locator('.cell-value').textContent();
            expect(cellValue).toBeTruthy();
        }
    });
});

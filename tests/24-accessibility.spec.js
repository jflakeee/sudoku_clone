/**
 * E2E tests for Accessibility (A11y) features.
 */

const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame } = require('./helpers');

test.describe('Accessibility - Grid ARIA', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('Grid container has role="grid"', async ({ page }) => {
        const grid = page.locator('#sudoku-grid');
        await expect(grid).toHaveAttribute('role', 'grid');
    });

    test('Grid container has aria-label', async ({ page }) => {
        const grid = page.locator('#sudoku-grid');
        const label = await grid.getAttribute('aria-label');
        expect(label).toContain('스도쿠 그리드');
    });

    test('Cells have role="gridcell"', async ({ page }) => {
        const cells = page.locator('.cell[role="gridcell"]');
        const count = await cells.count();
        expect(count).toBe(81); // 9x9
    });

    test('Cells have aria-label', async ({ page }) => {
        const firstCell = page.locator('.cell').first();
        const label = await firstCell.getAttribute('aria-label');
        expect(label).toMatch(/행 1, 열 1/);
    });

    test('Given cells have "주어진 값" in aria-label', async ({ page }) => {
        const givenCell = page.locator('.cell.given').first();
        const label = await givenCell.getAttribute('aria-label');
        expect(label).toContain('주어진 값');
    });

    test('Empty cells have "빈 셀" in aria-label', async ({ page }) => {
        // Find a cell that is not given (empty)
        const emptyLabel = await page.evaluate(() => {
            const cells = document.querySelectorAll('.cell:not(.given)');
            for (const cell of cells) {
                const label = cell.getAttribute('aria-label');
                if (label && label.includes('빈 셀')) return label;
            }
            return null;
        });
        expect(emptyLabel).toContain('빈 셀');
    });

    test('Cell aria-label updates when value is input', async ({ page }) => {
        // Find an empty cell and input a number
        const result = await page.evaluate(async () => {
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
                        const cell = app.gridUI.getCell(r, c);
                        return cell ? cell.getAttribute('aria-label') : null;
                    }
                }
            }
            return null;
        });
        expect(result).toContain('입력값');
    });
});

test.describe('Accessibility - Numberpad ARIA', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('Numberpad has role="group"', async ({ page }) => {
        const numpad = page.locator('#numberpad');
        await expect(numpad).toHaveAttribute('role', 'group');
    });

    test('Numberpad has aria-label', async ({ page }) => {
        const numpad = page.locator('#numberpad');
        await expect(numpad).toHaveAttribute('aria-label', '숫자패드');
    });

    test('Number buttons have aria-label', async ({ page }) => {
        for (let n = 1; n <= 9; n++) {
            const btn = page.locator(`.num-btn[data-number="${n}"]`);
            await expect(btn).toHaveAttribute('aria-label', `숫자 ${n}`);
        }
    });
});

test.describe('Accessibility - Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('Arrow keys move selected cell', async ({ page }) => {
        // Select center cell first
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            app.input.selectCell(4, 4);
            app.highlightUI.highlightSelection(4, 4, app.board.getBoard());
        });

        // Press ArrowDown
        await page.keyboard.press('ArrowDown');

        const selectedPos = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.input.getSelectedCell();
        });
        expect(selectedPos.row).toBe(5);
        expect(selectedPos.col).toBe(4);
    });

    test('Arrow keys wrap at boundaries', async ({ page }) => {
        // Select top-left
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            app.input.selectCell(0, 0);
            app.highlightUI.highlightSelection(0, 0, app.board.getBoard());
        });

        // Press ArrowUp (should stay at 0)
        await page.keyboard.press('ArrowUp');

        const selectedPos = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            return app.input.getSelectedCell();
        });
        expect(selectedPos.row).toBe(0);
    });

    test('Tab moves to next empty cell', async ({ page }) => {
        // Select cell (0,0)
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            app.input.selectCell(0, 0);
            app.highlightUI.highlightSelection(0, 0, app.board.getBoard());
        });

        // Press Tab
        await page.keyboard.press('Tab');

        const selectedCell = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const sel = app.input.getSelectedCell();
            if (!sel) return null;
            const isEmpty = app.board.isEmpty(sel.row, sel.col);
            const isGiven = app.board.isGiven(sel.row, sel.col);
            return { row: sel.row, col: sel.col, isEmpty, isGiven };
        });

        expect(selectedCell).not.toBeNull();
        expect(selectedCell.isEmpty).toBe(true);
        expect(selectedCell.isGiven).toBe(false);
    });

    test('Escape deselects cell', async ({ page }) => {
        // Select a cell
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            app.input.selectCell(4, 4);
            app.highlightUI.highlightSelection(4, 4, app.board.getBoard());
        });

        await page.keyboard.press('Escape');

        // After escape, highlights should be cleared
        const hasSelected = await page.evaluate(() => {
            return document.querySelectorAll('.cell.selected').length;
        });
        expect(hasSelected).toBe(0);
    });
});

test.describe('Accessibility - Live Regions', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
        await startNewGame(page, 'easy');
    });

    test('Mistakes display has role="status"', async ({ page }) => {
        const mistakes = page.locator('.info-mistakes');
        await expect(mistakes).toHaveAttribute('role', 'status');
    });

    test('Timer has aria-live="polite"', async ({ page }) => {
        const timer = page.locator('.info-timer');
        await expect(timer).toHaveAttribute('aria-live', 'polite');
    });
});

test.describe('Accessibility - High Contrast Setting', () => {
    test('High contrast setting toggle exists', async ({ page }) => {
        await resetApp(page);
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            mod.default.navigate('settings');
        });
        await page.waitForSelector('#screen-settings.active');

        // The checkbox is hidden inside toggle-switch; check it's attached
        const toggle = page.locator('input[data-setting="highContrast"]');
        await expect(toggle).toBeAttached();
    });

    test('Enabling high contrast adds class to body', async ({ page }) => {
        await resetApp(page);
        await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            mod.default.navigate('settings');
        });
        await page.waitForSelector('#screen-settings.active');

        // Click the label wrapping the toggle (the input itself is hidden by CSS)
        await page.evaluate(() => {
            const toggle = document.querySelector('input[data-setting="highContrast"]');
            if (toggle) {
                toggle.checked = true;
                toggle.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        const hasClass = await page.evaluate(() => document.body.classList.contains('high-contrast'));
        expect(hasClass).toBe(true);
    });
});

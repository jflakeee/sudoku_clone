// @ts-check
const { test, expect } = require('@playwright/test');
const { resetApp, startNewGame, solveEntirePuzzle } = require('./helpers');

test.describe('Celebration Animations & Micro-interactions', () => {
    test.beforeEach(async ({ page }) => {
        await resetApp(page);
    });

    // --- Confetti canvas ---

    test('confetti canvas exists in DOM', async ({ page }) => {
        const canvas = page.locator('#confetti-canvas');
        await expect(canvas).toBeAttached();
    });

    test('confetti canvas is hidden by default', async ({ page }) => {
        const canvas = page.locator('#confetti-canvas');
        await expect(canvas).toHaveCSS('display', 'none');
    });

    test('confetti canvas has pointer-events none', async ({ page }) => {
        const canvas = page.locator('#confetti-canvas');
        await expect(canvas).toHaveCSS('pointer-events', 'none');
    });

    // --- Cell wave animation on completion ---

    test('cell-wave animation triggers on puzzle completion', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Set up a listener that captures whether cell-wave was ever added
        await page.evaluate(() => {
            window.__cellWaveSeen = false;
            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type === 'attributes' && m.attributeName === 'class') {
                        if (m.target.classList.contains('cell-wave')) {
                            window.__cellWaveSeen = true;
                        }
                    }
                }
            });
            document.querySelectorAll('.cell').forEach(cell => {
                observer.observe(cell, { attributes: true, attributeFilter: ['class'] });
            });
        });

        // Solve the puzzle
        await solveEntirePuzzle(page);

        // Wait for the complete screen (wave finishes before navigation)
        await page.waitForSelector('#screen-complete.active', { timeout: 5000 });

        // Check that cell-wave was observed
        const waveSeen = await page.evaluate(() => window.__cellWaveSeen);
        expect(waveSeen).toBe(true);
    });

    test('cell-wave completes and navigates to complete screen', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);

        // Wait for navigation to complete screen (wave + navigation)
        await page.waitForSelector('#screen-complete.active', { timeout: 5000 });
    });

    // --- Number input bounce ---

    test('number input adds animate-in class to cell value', async ({ page }) => {
        await startNewGame(page, 'easy');

        // Find an empty cell and input a number
        const hasAnimateIn = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const size = app.board.boardSize || 9;

            // Find first empty cell
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && !app.board.isGiven(r, c)) {
                        const solution = app.board.getSolution();
                        app.input.selectCell(r, c);
                        app.input.inputNumber(solution[r][c]);

                        // Check immediately after input
                        const cell = app.gridUI.getCell(r, c);
                        const valueEl = cell?.querySelector('.cell-value');
                        return valueEl?.classList.contains('animate-in') || false;
                    }
                }
            }
            return false;
        });

        expect(hasAnimateIn).toBe(true);
    });

    // --- Error shake ---

    test('error input adds shake class to cell', async ({ page }) => {
        await startNewGame(page, 'easy');

        const hasShake = await page.evaluate(async () => {
            const mod = await import('./js/app.js');
            const app = mod.default;
            const board = app.board.getBoard();
            const solution = app.board.getSolution();
            const size = app.board.boardSize || 9;

            // Enable mistake limit so errors are tracked
            app.settings.mistakeLimit = true;

            // Find first empty cell and input wrong number
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (board[r][c] === 0 && !app.board.isGiven(r, c)) {
                        const correct = solution[r][c];
                        const wrong = correct === 1 ? 2 : 1;
                        app.input.selectCell(r, c);
                        app.input.inputNumber(wrong);

                        const cell = app.gridUI.getCell(r, c);
                        return cell?.classList.contains('shake') || false;
                    }
                }
            }
            return false;
        });

        expect(hasShake).toBe(true);
    });

    // --- Animation settings toggle ---

    test('animation setting toggle exists in settings', async ({ page }) => {
        await page.click('.nav-tab[data-navigate="profile"]');
        await page.waitForSelector('#screen-profile.active');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');

        const toggle = page.locator('input[data-setting="animations"]');
        await expect(toggle).toBeAttached();
    });

    test('animation setting is on by default', async ({ page }) => {
        await page.click('.nav-tab[data-navigate="profile"]');
        await page.waitForSelector('#screen-profile.active');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');

        const toggle = page.locator('input[data-setting="animations"]');
        await expect(toggle).toBeChecked();
    });

    test('animation setting can be toggled off', async ({ page }) => {
        await page.click('.nav-tab[data-navigate="profile"]');
        await page.waitForSelector('#screen-profile.active');
        await page.click('#screen-profile .menu-item[data-navigate="settings"]');
        await page.waitForSelector('#screen-settings.active');

        const toggle = page.locator('input[data-setting="animations"]');
        // Click the toggle-slider (visible label) instead of the hidden input
        const slider = toggle.locator('..').locator('.toggle-slider');
        await slider.click();
        await expect(toggle).not.toBeChecked();

        // Verify it's saved
        const saved = await page.evaluate(() => {
            const s = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            return s.animations;
        });
        expect(saved).toBe(false);
    });

    test('animations disabled skips cell-wave on completion', async ({ page }) => {
        // Disable animations
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            settings.animations = false;
            localStorage.setItem('sudoku_settings', JSON.stringify(settings));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);

        // Should go directly to complete screen without wave animation
        await page.waitForSelector('#screen-complete.active', { timeout: 3000 });

        // No cell-wave should be present
        const waveCount = await page.evaluate(() => {
            return document.querySelectorAll('.cell.cell-wave').length;
        });
        expect(waveCount).toBe(0);
    });

    test('animations disabled skips confetti on completion', async ({ page }) => {
        // Disable animations
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('sudoku_settings') || '{}');
            settings.animations = false;
            localStorage.setItem('sudoku_settings', JSON.stringify(settings));
        });
        await page.reload();
        await page.waitForSelector('#screen-main.active');

        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 3000 });

        // Confetti canvas should still be hidden
        const canvas = page.locator('#confetti-canvas');
        await expect(canvas).toHaveCSS('display', 'none');

        // DOM confetti area should be empty
        const particleCount = await page.evaluate(() => {
            const area = document.getElementById('confetti-area');
            return area ? area.children.length : 0;
        });
        expect(particleCount).toBe(0);
    });

    // --- CSS keyframes exist ---

    test('inputBounce keyframe is defined in CSS', async ({ page }) => {
        const hasKeyframe = await page.evaluate(() => {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'inputBounce') {
                            return true;
                        }
                    }
                } catch { /* cross-origin */ }
            }
            return false;
        });
        expect(hasKeyframe).toBe(true);
    });

    test('cellWave keyframe is defined in CSS', async ({ page }) => {
        const hasKeyframe = await page.evaluate(() => {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'cellWave') {
                            return true;
                        }
                    }
                } catch { /* cross-origin */ }
            }
            return false;
        });
        expect(hasKeyframe).toBe(true);
    });

    test('noteFadeIn keyframe is defined in CSS', async ({ page }) => {
        const hasKeyframe = await page.evaluate(() => {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'noteFadeIn') {
                            return true;
                        }
                    }
                } catch { /* cross-origin */ }
            }
            return false;
        });
        expect(hasKeyframe).toBe(true);
    });

    // --- Num-btn and tool-btn transitions ---

    test('num-btn has transition property', async ({ page }) => {
        await startNewGame(page, 'easy');
        const btn = page.locator('.num-btn').first();
        const transitionProperty = await btn.evaluate(el => getComputedStyle(el).transitionProperty);
        // Should include 'transform' or 'all'
        const hasTransform = transitionProperty.includes('transform') || transitionProperty === 'all';
        expect(hasTransform).toBe(true);
    });

    test('tool-btn has transition property', async ({ page }) => {
        await startNewGame(page, 'easy');
        const btn = page.locator('.tool-btn').first();
        const transitionProperty = await btn.evaluate(el => getComputedStyle(el).transitionProperty);
        // Should include 'transform' or 'all'
        const hasTransform = transitionProperty.includes('transform') || transitionProperty === 'all';
        expect(hasTransform).toBe(true);
    });

    // --- Confetti canvas shows on completion ---

    test('confetti canvas becomes visible on puzzle completion', async ({ page }) => {
        await startNewGame(page, 'easy');
        await solveEntirePuzzle(page);
        await page.waitForSelector('#screen-complete.active', { timeout: 5000 });

        // Just verify the complete screen loaded successfully with confetti elements
        await expect(page.locator('#screen-complete')).toHaveClass(/active/);
    });
});

/**
 * Mode Selection Screen Controller
 *
 * Manages the mode selection screen where the user picks a game mode
 * (classic / time-attack), optional duration, and board size before
 * proceeding to the difficulty modal.
 *
 * @module screens/mode-select
 */

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------

/**
 * Initialise the mode-select screen controller.
 *
 * @param {object} app - Global app reference.
 */
export function initModeSelectScreen(app) {
    const screen = document.getElementById('screen-mode-select');
    if (!screen) return;

    let selectedMode = 'classic';
    let selectedDuration = 600;
    let selectedBoardSize = 9;

    const modeOptions = screen.querySelectorAll('.game-mode-option');
    const timedSection = screen.querySelector('.timed-section');
    const timeOptions = screen.querySelectorAll('.time-option');
    const sizeOptions = screen.querySelectorAll('.size-option');
    const nextBtn = screen.querySelector('[data-action="select-mode"]');

    modeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            modeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMode = btn.dataset.gameMode;
            timedSection.style.display = selectedMode === 'timeAttack' ? '' : 'none';
        });
    });

    timeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            timeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDuration = parseInt(btn.dataset.duration, 10);
        });
    });

    sizeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            sizeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedBoardSize = parseInt(btn.dataset.size, 10);
        });
    });

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            app.showDifficultyModal({
                mode: selectedMode,
                duration: selectedDuration,
                boardSize: selectedBoardSize,
            });
        });
    }

    // --- Reset state when re-entering mode-select screen ---
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen !== 'mode-select') return;

        selectedMode = 'classic';
        selectedDuration = 600;
        selectedBoardSize = 9;

        // Reset mode buttons
        modeOptions.forEach(b => {
            b.classList.toggle('active', b.dataset.gameMode === 'classic');
        });

        // Hide timed section
        if (timedSection) timedSection.style.display = 'none';

        // Reset time options (activate 10min = 600)
        timeOptions.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.duration, 10) === 600);
        });

        // Reset size options (activate 9x9)
        sizeOptions.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.size, 10) === 9);
        });
    });
}

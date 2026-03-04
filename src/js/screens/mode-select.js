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
    let selectedVariant = 'standard';
    let forPrint = false;
    let selectedPrintCount = 1;

    const gameModeSection = screen.querySelector('.game-mode-options')?.closest('.mode-section');
    const modeOptions = screen.querySelectorAll('.game-mode-option');
    const timedSection = screen.querySelector('.timed-section');
    const timeOptions = screen.querySelectorAll('.time-option');
    const sizeOptions = screen.querySelectorAll('.size-option');
    const variantSection = screen.querySelector('.variant-section');
    const variantOptions = screen.querySelectorAll('.variant-option');
    const nextBtn = screen.querySelector('[data-action="select-mode"]');
    const subTitle = screen.querySelector('.sub-title');
    const printCountSection = screen.querySelector('.print-count-section');
    const countOptions = screen.querySelectorAll('.count-option');

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

    // Variants that only support 9x9
    const NINE_ONLY_VARIANTS = new Set(['anti-knight', 'anti-king', 'even-odd', 'windoku', 'killer']);

    function updateBoardSizeRestriction(variant) {
        const restricted = NINE_ONLY_VARIANTS.has(variant);
        sizeOptions.forEach(btn => {
            const size = parseInt(btn.dataset.size, 10);
            if (restricted && size !== 9) {
                btn.classList.add('disabled');
                btn.disabled = true;
            } else {
                btn.classList.remove('disabled');
                btn.disabled = false;
            }
        });
        if (restricted && selectedBoardSize !== 9) {
            selectedBoardSize = 9;
            sizeOptions.forEach(b => b.classList.toggle('active', parseInt(b.dataset.size, 10) === 9));
        }
    }

    variantOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            variantOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedVariant = btn.dataset.variant;
            updateBoardSizeRestriction(selectedVariant);
        });
    });

    countOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            countOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPrintCount = parseInt(btn.dataset.count, 10);
        });
    });

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            app.showDifficultyModal({
                mode: selectedMode,
                duration: selectedDuration,
                boardSize: selectedBoardSize,
                variant: selectedVariant,
                forPrint,
                printCount: selectedPrintCount,
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
        selectedVariant = 'standard';

        // Detect print mode from params
        forPrint = !!(detail.params && detail.params.forPrint);
        selectedPrintCount = 1;

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

        // Reset size options (activate 9x9, re-enable all)
        sizeOptions.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.size, 10) === 9);
            b.classList.remove('disabled');
            b.disabled = false;
        });

        // Reset variant options (activate standard)
        variantOptions.forEach(b => {
            b.classList.toggle('active', b.dataset.variant === 'standard');
        });

        // Reset count options (activate 1)
        countOptions.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.count, 10) === 1);
        });

        if (forPrint) {
            // Print mode: hide game mode, variant & timed sections, show print count
            if (gameModeSection) gameModeSection.style.display = 'none';
            if (timedSection) timedSection.style.display = 'none';
            if (variantSection) variantSection.style.display = 'none';
            if (printCountSection) printCountSection.style.display = '';
            if (subTitle) subTitle.textContent = '인쇄 설정';
        } else {
            // Normal mode: show game mode & variant, hide print count
            if (gameModeSection) gameModeSection.style.display = '';
            if (variantSection) variantSection.style.display = '';
            if (printCountSection) printCountSection.style.display = 'none';
            if (subTitle) subTitle.textContent = '게임 모드';
        }
    });
}

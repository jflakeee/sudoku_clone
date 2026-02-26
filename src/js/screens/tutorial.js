/**
 * Tutorial Screen
 *
 * A 3-slide walkthrough that teaches the basics of Sudoku gameplay.
 * Provides previous/next navigation with dot indicators.
 *
 * @module screens/tutorial
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_SLIDES = 3;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {number} Current slide index (0-based) */
let _currentSlide = 0;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Update the visible slide and dot indicators.
 */
function renderSlide() {
    const slides = document.querySelectorAll('#tutorial-slides .tutorial-slide');
    const dots = document.querySelectorAll('.tutorial-dots .dot');

    slides.forEach((slide, i) => {
        if (i === _currentSlide) {
            slide.classList.add('active');
        } else {
            slide.classList.remove('active');
        }
    });

    dots.forEach((dot, i) => {
        if (i === _currentSlide) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });

    // Update prev/next button states
    const prevBtn = document.querySelector('.tutorial-prev');
    const nextBtn = document.querySelector('.tutorial-next');

    if (prevBtn) {
        prevBtn.disabled = _currentSlide === 0;
        prevBtn.style.opacity = _currentSlide === 0 ? '0.3' : '1';
    }

    if (nextBtn) {
        // On the last slide, change the next button text/behavior to "start"
        if (_currentSlide === TOTAL_SLIDES - 1) {
            nextBtn.innerHTML = '<span style="font-size:14px;font-weight:600;">시작</span>';
        } else {
            nextBtn.innerHTML =
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"></polyline></svg>';
        }
    }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Navigate to the previous slide.
 */
function onPrev() {
    if (_currentSlide > 0) {
        _currentSlide--;
        renderSlide();
    }
}

/**
 * Navigate to the next slide, or exit on the last slide.
 */
function onNext() {
    if (_currentSlide < TOTAL_SLIDES - 1) {
        _currentSlide++;
        renderSlide();
    } else {
        // Last slide "시작" action — go back
        goBack();
    }
}

/**
 * Skip the tutorial and navigate back.
 */
function goBack() {
    if (_app) {
        _app.navigate('profile');
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the tutorial screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initTutorialScreen(app) {
    _app = app;
    _currentSlide = 0;

    renderSlide();

    // Previous button
    const prevBtn = document.querySelector('.tutorial-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', onPrev);
    }

    // Next button
    const nextBtn = document.querySelector('.tutorial-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', onNext);
    }

    // Skip button
    const skipBtn = document.querySelector('.btn-skip');
    if (skipBtn) {
        skipBtn.addEventListener('click', goBack);
    }

}

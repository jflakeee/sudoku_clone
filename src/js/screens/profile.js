/**
 * Profile (Me) Screen
 *
 * Handles navigation from the profile menu items. Each menu item has a
 * `data-navigate` attribute pointing to the target screen name. Clicking
 * a menu item calls `app.navigate()` with that screen name.
 *
 * @module screens/profile
 */

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the profile screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initProfileScreen(app) {
    _app = app;
    // Menu item navigation is handled by the global data-navigate click handler in app.js.
    // No additional listeners needed here.
}

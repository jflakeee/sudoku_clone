/**
 * Sound Manager
 *
 * Synthesises all game sound effects in real-time using the Web Audio API.
 * No external audio files are required — every sound is built from
 * OscillatorNodes and GainNodes with shaped envelopes.
 *
 * @module utils/sound
 */

// ---------------------------------------------------------------------------
// Sound definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} SoundDef
 * @property {Function} play - Function that receives an AudioContext and plays the sound.
 */

/**
 * Create an envelope-shaped gain that ramps through attack → sustain → release.
 *
 * @param {AudioContext} ctx
 * @param {number} now - Current context time.
 * @param {number} attack - Attack duration in seconds.
 * @param {number} sustain - Sustain duration in seconds.
 * @param {number} release - Release duration in seconds.
 * @param {number} [peakGain=0.3] - Peak gain value.
 * @returns {GainNode}
 */
function createEnvelope(ctx, now, attack, sustain, release, peakGain = 0.3) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + attack);
    gain.gain.setValueAtTime(peakGain, now + attack + sustain);
    gain.gain.linearRampToValueAtTime(0, now + attack + sustain + release);
    return gain;
}

/**
 * Play a simple tone with envelope.
 *
 * @param {AudioContext} ctx
 * @param {number} freq - Frequency in Hz.
 * @param {OscillatorType} type - Oscillator wave type.
 * @param {number} attack
 * @param {number} sustain
 * @param {number} release
 * @param {number} [peakGain=0.3]
 */
function playTone(ctx, freq, type, attack, sustain, release, peakGain = 0.3) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = createEnvelope(ctx, now, attack, sustain, release, peakGain);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(env);
    env.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + attack + sustain + release + 0.01);
}

/** @type {Record<string, (ctx: AudioContext) => void>} */
const SOUNDS = {
    /**
     * Tap: short click sound (100ms, 800Hz sine, quick decay).
     */
    tap(ctx) {
        playTone(ctx, 800, 'sine', 0.005, 0.02, 0.075, 0.15);
    },

    /**
     * Place: confirmation tone (150ms, 600Hz sine, gentle decay).
     */
    place(ctx) {
        playTone(ctx, 600, 'sine', 0.01, 0.05, 0.09, 0.25);
    },

    /**
     * Error: low buzz (200ms, 200Hz sawtooth, harsh).
     */
    error(ctx) {
        playTone(ctx, 200, 'sawtooth', 0.01, 0.08, 0.11, 0.2);
    },

    /**
     * Complete: celebration fanfare — ascending 3-note chord (C5-E5-G5).
     */
    complete(ctx) {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        const noteLength = 0.5;

        notes.forEach((freq, i) => {
            const startTime = now + i * 0.15;
            const osc = ctx.createOscillator();
            const env = ctx.createGain();

            env.gain.setValueAtTime(0, startTime);
            env.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
            env.gain.setValueAtTime(0.2, startTime + noteLength * 0.6);
            env.gain.linearRampToValueAtTime(0, startTime + noteLength);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            osc.connect(env);
            env.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + noteLength + 0.01);
        });
    },

    /**
     * Undo: reverse swoosh (200ms, 400 -> 200Hz frequency sweep).
     */
    undo(ctx) {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const env = createEnvelope(ctx, now, 0.01, 0.08, 0.11, 0.15);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.2);
        osc.connect(env);
        env.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.21);
    },

    /**
     * Hint: notification ding (300ms, 1000Hz sine, bell-like with harmonics).
     */
    hint(ctx) {
        const now = ctx.currentTime;

        // Fundamental tone
        const osc1 = ctx.createOscillator();
        const env1 = createEnvelope(ctx, now, 0.005, 0.05, 0.245, 0.25);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1000, now);
        osc1.connect(env1);
        env1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.31);

        // Second harmonic (quieter, for bell character)
        const osc2 = ctx.createOscillator();
        const env2 = createEnvelope(ctx, now, 0.005, 0.03, 0.15, 0.1);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2000, now);
        osc2.connect(env2);
        env2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.2);

        // Third harmonic (even quieter)
        const osc3 = ctx.createOscillator();
        const env3 = createEnvelope(ctx, now, 0.005, 0.02, 0.1, 0.05);
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(3000, now);
        osc3.connect(env3);
        env3.connect(ctx.destination);
        osc3.start(now);
        osc3.stop(now + 0.15);
    },

    /**
     * Button: short UI click (50ms, 1000Hz sine, very brief).
     */
    button(ctx) {
        playTone(ctx, 1000, 'sine', 0.003, 0.01, 0.037, 0.1);
    },
};

// ---------------------------------------------------------------------------
// SoundManager class
// ---------------------------------------------------------------------------

/**
 * Web Audio API sound manager. Synthesises all game sounds in real-time.
 *
 * The AudioContext is created lazily on the first user gesture to comply
 * with browser autoplay policies.
 */
export class SoundManager {
    constructor() {
        /** @type {AudioContext|null} */
        this._ctx = null;

        /** @type {boolean} */
        this._enabled = true;

        /** @type {boolean} */
        this._initialised = false;
    }

    // -------------------------------------------------------------------
    // Public methods
    // -------------------------------------------------------------------

    /**
     * Initialise the AudioContext. Should be called on the first user
     * gesture (click/tap) to satisfy browser autoplay policies.
     */
    init() {
        if (this._initialised) return;

        try {
            const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
            if (AudioCtx) {
                this._ctx = new AudioCtx();
                this._initialised = true;
            }
        } catch {
            // Web Audio API not supported — sounds will be silently disabled.
            this._enabled = false;
        }
    }

    /**
     * Enable or disable all sounds.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = !!enabled;
    }

    /**
     * Whether sounds are currently enabled.
     *
     * @returns {boolean}
     */
    isEnabled() {
        return this._enabled;
    }

    /**
     * Play a sound by name.
     *
     * If the AudioContext has not been initialised yet, this method will
     * attempt to initialise it (works if called during a user gesture).
     *
     * @param {string} soundName - One of: 'tap', 'place', 'error',
     *   'complete', 'undo', 'hint', 'button'.
     */
    play(soundName) {
        if (!this._enabled) return;

        // Lazy-init on first play (must be during a user gesture)
        if (!this._initialised) {
            this.init();
        }

        if (!this._ctx) return;

        // Resume suspended context (happens after tab goes inactive)
        if (this._ctx.state === 'suspended') {
            this._ctx.resume();
        }

        const soundFn = SOUNDS[soundName];
        if (soundFn) {
            try {
                soundFn(this._ctx);
            } catch {
                // Silently ignore playback errors.
            }
        }
    }
}

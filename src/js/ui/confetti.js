/**
 * Canvas-based Confetti Effect
 *
 * Renders a full-screen particle celebration using a <canvas> element.
 * Used on puzzle completion when the animations setting is enabled.
 *
 * @module ui/confetti
 */

// ---------------------------------------------------------------------------
// Confetti colour palette
// ---------------------------------------------------------------------------

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];

// ---------------------------------------------------------------------------
// ConfettiEffect class
// ---------------------------------------------------------------------------

export class ConfettiEffect {
    /**
     * @param {HTMLCanvasElement} canvas - A <canvas> element overlaying the viewport.
     */
    constructor(canvas) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;

        /** @type {CanvasRenderingContext2D} */
        this.ctx = canvas.getContext('2d');

        /** @type {object[]} Active particles. */
        this.particles = [];

        /** @type {boolean} Whether the animation loop is running. */
        this.running = false;
    }

    /**
     * Start the confetti burst.
     *
     * @param {number} [duration=3000] - Total animation length in ms.
     */
    start(duration = 3000) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.display = 'block';
        this.running = true;
        this.particles = [];

        // Generate 80-120 particles
        const count = 80 + Math.floor(Math.random() * 40);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: -20 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 3,
                size: 4 + Math.random() * 8,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
                opacity: 1,
            });
        }

        const startTime = performance.now();

        const animate = (now) => {
            if (!this.running) return;

            const elapsed = now - startTime;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Fade out in last 500ms
            const fadeStart = duration - 500;

            for (const p of this.particles) {
                p.x += p.vx;
                p.vy += 0.05; // gravity
                p.y += p.vy;
                p.rotation += p.rotSpeed;

                if (elapsed > fadeStart) {
                    p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / 500);
                }

                this.ctx.save();
                this.ctx.globalAlpha = p.opacity;
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation * Math.PI / 180);
                this.ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else {
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                this.ctx.restore();
            }

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                this.stop();
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Immediately stop the animation and hide the canvas.
     */
    stop() {
        this.running = false;
        this.particles = [];
        this.canvas.style.display = 'none';
    }
}

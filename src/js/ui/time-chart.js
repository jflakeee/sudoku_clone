/**
 * Time Chart - Canvas-based Line Chart
 *
 * Displays solve time trends as a simple line chart.
 * Uses plain Canvas 2D API with no external libraries.
 *
 * @module ui/time-chart
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class TimeChart {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    /**
     * Draw the time chart with the given data.
     *
     * @param {Array<{ date: string, time: number }>} data - Last N games.
     */
    draw(data) {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Read CSS custom properties once so the chart adapts to the active theme
        const style = getComputedStyle(document.documentElement);

        if (!data || data.length < 2) {
            ctx.fillStyle = style.getPropertyValue('--text-muted').trim() || '#999';
            ctx.font = '14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('데이터가 부족합니다', width / 2, height / 2);
            return;
        }

        const padding = { top: 20, right: 16, bottom: 30, left: 46 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const times = data.map(d => d.time);
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);
        const range = maxTime - minTime || 60; // At least 60s range

        const primaryColor = style.getPropertyValue('--primary').trim() || '#2979FF';
        const mutedColor = style.getPropertyValue('--text-muted').trim() || '#999';
        const borderColor = style.getPropertyValue('--cell-border').trim() || '#e0e0e0';

        // --- Grid lines ---
        const gridLines = 4;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);

        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (i / gridLines) * chartH;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartW, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // --- Y-axis labels ---
        ctx.fillStyle = mutedColor;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= gridLines; i++) {
            const val = maxTime - (i / gridLines) * range;
            const y = padding.top + (i / gridLines) * chartH;
            ctx.fillText(this._formatTime(Math.round(val)), padding.left - 6, y);
        }

        // --- X-axis labels (game number) ---
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelStep = Math.max(1, Math.floor(data.length / 5));
        for (let i = 0; i < data.length; i += labelStep) {
            const x = padding.left + (i / (data.length - 1)) * chartW;
            ctx.fillText(`${i + 1}`, x, padding.top + chartH + 8);
        }
        // Always show last label
        const lastX = padding.left + chartW;
        ctx.fillText(`${data.length}`, lastX, padding.top + chartH + 8);

        // --- Average line ---
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const avgY = padding.top + (1 - (avg - minTime) / range) * chartH;

        ctx.strokeStyle = mutedColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, avgY);
        ctx.lineTo(padding.left + chartW, avgY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Average label
        ctx.fillStyle = mutedColor;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`평균 ${this._formatTime(Math.round(avg))}`, padding.left + 4, avgY - 3);

        // --- Data line ---
        ctx.beginPath();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const points = data.map((d, i) => ({
            x: padding.left + (i / (data.length - 1)) * chartW,
            y: padding.top + (1 - (d.time - minTime) / range) * chartH,
        }));

        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // --- Gradient fill under line ---
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        gradient.addColorStop(0, primaryColor + '30');
        gradient.addColorStop(1, primaryColor + '05');

        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
        ctx.lineTo(points[0].x, padding.top + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // --- Data points ---
        const bgColor = style.getPropertyValue('--bg-main').trim() || '#fff';

        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = primaryColor;
            ctx.fill();
            ctx.strokeStyle = bgColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }

    /**
     * Format seconds as "M:SS".
     *
     * @param {number} seconds
     * @returns {string}
     */
    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
}

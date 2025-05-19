/**
 * Optimized canvas renderer with object pooling and efficient drawing
 * @module renderer
 */

import { SIMULATION_CONFIG } from './config.js';

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        this.resizeCanvas();
        
        // Object pools
        this.particlePool = [];
        this.maxParticles = 100;
        
        // Initialize object pools
        this.initParticlePool();
        
        // Bind methods
        this.render = this.render.bind(this);
        this.resizeCanvas = this.resizeCanvas.bind(this);
        
        // Setup resize listener
        window.addEventListener('resize', this.resizeCanvas);
    }

    /**
     * Initialize particle object pool
     */
    initParticlePool() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particlePool.push({
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                active: false
            });
        }
    }

    /**
     * Get a particle from the pool
     * @returns {Object} Particle object
     */
    getParticle() {
        for (let particle of this.particlePool) {
            if (!particle.active) {
                particle.active = true;
                return particle;
            }
        }
        return null;
    }

    /**
     * Resize canvas to match window size
     */
    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.offscreenCanvas.width = rect.width * dpr;
        this.offscreenCanvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.offscreenCtx.scale(dpr, dpr);
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    }

    /**
     * Draw a static element to the offscreen canvas
     * @param {Function} drawFn - Drawing function
     */
    drawStatic(drawFn) {
        this.offscreenCtx.save();
        drawFn(this.offscreenCtx);
        this.offscreenCtx.restore();
    }

    /**
     * Render the current frame
     * @param {Object} state - Current simulation state
     */
    render(state) {
        this.clear();
        
        // Draw static elements from offscreen canvas
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
        
        // Draw dynamic elements
        this.ctx.save();
        
        // Draw robot
        this.drawRobot(state.robot);
        
        // Draw particles
        this.drawParticles();
        
        this.ctx.restore();
        
        // Request next frame
        requestAnimationFrame(() => this.render(state));
    }

    /**
     * Draw the robot
     * @param {Object} robot - Robot state
     */
    drawRobot(robot) {
        this.ctx.save();
        this.ctx.translate(robot.x, robot.y);
        this.ctx.rotate(robot.angle);
        
        // Draw robot body
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(-robot.width/2, -robot.length/2, robot.width, robot.length);
        
        // Draw sensors
        this.ctx.fillStyle = '#666';
        robot.sensors.forEach(sensor => {
            this.ctx.beginPath();
            this.ctx.arc(sensor.x, sensor.y, sensor.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }

    /**
     * Draw active particles
     */
    drawParticles() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let particle of this.particlePool) {
            if (particle.active) {
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Update particle
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life--;
                
                if (particle.life <= 0) {
                    particle.active = false;
                }
            }
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        window.removeEventListener('resize', this.resizeCanvas);
        this.particlePool = null;
    }
}

export default Renderer; 
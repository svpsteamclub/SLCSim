/**
 * UI management module with debouncing and lazy loading
 * @module uiManager
 */

import { UI_CONFIG } from './config.js';

class UIManager {
    constructor() {
        this.foldableSections = new Map();
        this.debounceTimers = new Map();
        this.lazyLoadedContent = new Map();
    }

    /**
     * Initialize UI elements
     */
    init() {
        this.initFoldableSections();
        this.initLazyLoading();
        this.initDebouncedInputs();
    }

    /**
     * Initialize foldable sections
     */
    initFoldableSections() {
        document.querySelectorAll('.foldable-title').forEach(title => {
            const content = title.nextElementSibling;
            if (content && content.classList.contains('foldable-content')) {
                this.foldableSections.set(title, content);
                title.addEventListener('click', () => this.toggleSection(title));
            }
        });
    }

    /**
     * Toggle a foldable section
     * @param {HTMLElement} title - The section title element
     */
    toggleSection(title) {
        const content = this.foldableSections.get(title);
        const indicator = title.querySelector('.fold-indicator');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            indicator.textContent = '[-]';
            this.loadLazyContent(content);
        } else {
            content.style.display = 'none';
            indicator.textContent = '[+]';
        }
    }

    /**
     * Initialize lazy loading for content
     */
    initLazyLoading() {
        document.querySelectorAll('[data-lazy-load]').forEach(element => {
            const loadKey = element.dataset.lazyLoad;
            this.lazyLoadedContent.set(loadKey, {
                element,
                loaded: false,
                loadFn: () => this.loadContent(loadKey)
            });
        });
    }

    /**
     * Load lazy content when section becomes visible
     * @param {HTMLElement} container - The container element
     */
    loadLazyContent(container) {
        container.querySelectorAll('[data-lazy-load]').forEach(element => {
            const loadKey = element.dataset.lazyLoad;
            const content = this.lazyLoadedContent.get(loadKey);
            if (content && !content.loaded) {
                content.loadFn();
                content.loaded = true;
            }
        });
    }

    /**
     * Initialize debounced inputs
     */
    initDebouncedInputs() {
        document.querySelectorAll('[data-debounce]').forEach(input => {
            const delay = parseInt(input.dataset.debounce) || UI_CONFIG.debounceDelay;
            input.addEventListener('input', (e) => this.debounce(e.target, delay));
        });
    }

    /**
     * Debounce an input event
     * @param {HTMLElement} element - The input element
     * @param {number} delay - Debounce delay in milliseconds
     */
    debounce(element, delay) {
        const timer = this.debounceTimers.get(element);
        if (timer) {
            clearTimeout(timer);
        }

        const newTimer = setTimeout(() => {
            this.debounceTimers.delete(element);
            element.dispatchEvent(new Event('debounced-input'));
        }, delay);

        this.debounceTimers.set(element, newTimer);
    }

    /**
     * Show a notification
     * @param {string} message - The notification message
     * @param {string} type - The notification type (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Update UI elements with new values
     * @param {Object} values - Object containing element IDs and their new values
     */
    updateUI(values) {
        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.tagName === 'INPUT') {
                    element.value = value;
                } else {
                    element.textContent = value;
                }
            }
        });
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.foldableSections.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.lazyLoadedContent.clear();
    }
}

export const uiManager = new UIManager(); 
/**
 * Asset management module for handling image loading and caching
 * @module assetManager
 */

class AssetManager {
    constructor() {
        this.cache = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Preloads a set of images
     * @param {Object} assets - Object containing asset paths and their keys
     * @returns {Promise} Promise that resolves when all assets are loaded
     */
    async preloadAssets(assets) {
        const promises = Object.entries(assets).map(([key, path]) => 
            this.loadImage(path).then(img => {
                this.cache.set(key, img);
                return img;
            })
        );
        return Promise.all(promises);
    }

    /**
     * Loads a single image
     * @param {string} src - Image source path
     * @returns {Promise<HTMLImageElement>} Promise that resolves with the loaded image
     */
    loadImage(src) {
        if (this.cache.has(src)) {
            return Promise.resolve(this.cache.get(src));
        }

        if (this.loadingPromises.has(src)) {
            return this.loadingPromises.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.cache.set(src, img);
                this.loadingPromises.delete(src);
                resolve(img);
            };
            img.onerror = () => {
                this.loadingPromises.delete(src);
                reject(new Error(`Failed to load image: ${src}`));
            };
            img.src = src;
        });

        this.loadingPromises.set(src, promise);
        return promise;
    }

    /**
     * Gets an image from cache
     * @param {string} key - Asset key
     * @returns {HTMLImageElement|undefined} The cached image or undefined if not found
     */
    getImage(key) {
        return this.cache.get(key);
    }

    /**
     * Clears the asset cache
     */
    clearCache() {
        this.cache.clear();
        this.loadingPromises.clear();
    }
}

export const assetManager = new AssetManager(); 
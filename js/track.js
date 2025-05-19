    import { PIXELS_PER_METER } from './config.js';

    export class Track {
        constructor() {
            this.image = new Image();
            this.imageData = null; // To be populated by getImageData
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

            this.width_px = 0;
            this.height_px = 0;
            this.lineThreshold = 30; // Default, can be updated
            
            this.isCustom = false;
            this.customFileName = "";

            this.watermarkImage = null;
        }

        setWatermark(img) {
            this.watermarkImage = img;
        }

        load(source, width_px, height_px, lineThreshold, callback, isCustomFile = false, fileName = "") {
            this.lineThreshold = lineThreshold;
            this.isCustom = isCustomFile;
            this.customFileName = isCustomFile ? fileName : "";

            const processImage = () => {
                this.width_px = this.image.naturalWidth; // Use natural dimensions from image
                this.height_px = this.image.naturalHeight;

                // If predefined track dimensions are provided, resize display, but use natural for processing
                if (!isCustomFile && width_px && height_px) {
                     // These might be different from naturalWidth/Height if the config is wrong
                     // For now, let's trust naturalWidth/Height for actual processing
                }


                this.offscreenCanvas.width = this.width_px;
                this.offscreenCanvas.height = this.height_px;
                this.offscreenCtx.drawImage(this.image, 0, 0, this.width_px, this.height_px);
                try {
                    this.imageData = this.offscreenCtx.getImageData(0, 0, this.width_px, this.height_px);
                    console.log(`Track image ${this.isCustom ? `(custom: ${this.customFileName})` : ''} loaded and data processed. Dimensions: ${this.width_px}x${this.height_px}`);
                    callback(true, this.width_px, this.height_px);
                } catch (e) {
                    console.error("Error getting image data for track:", e);
                    this.imageData = null;
                    callback(false);
                }
            };
            
            if (isCustomFile && source instanceof File) { // source is a File object
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.image = new Image(); // Reset image for custom load
                    this.image.onload = processImage;
                    this.image.onerror = () => {
                        console.error(`Error loading custom track image from FileReader result for ${fileName}`);
                        callback(false);
                    };
                    this.image.src = e.target.result;
                };
                reader.onerror = () => {
                    console.error(`Error reading custom track file: ${fileName}`);
                    callback(false);
                };
                reader.readAsDataURL(source);
            } else if (typeof source === 'string') { // source is a URL
                this.image = new Image(); // Reset image for URL load
                this.image.onload = processImage;
                this.image.onerror = () => {
                    console.error(`Error loading track image from URL: ${source}`);
                    callback(false);
                };
                this.image.src = source;
            } else {
                console.error("Invalid track source provided.");
                callback(false);
            }
        }
        
        // Used by track editor to set the track from a generated canvas/image
        setFromCanvas(sourceCanvas, lineThreshold) {
            return new Promise((resolve, reject) => {
                this.lineThreshold = lineThreshold;
                this.isCustom = true; // Tracks from editor are considered custom
                this.customFileName = "Pista_del_Editor.png";

                this.width_px = sourceCanvas.width;
                this.height_px = sourceCanvas.height;

                // Create a new Image object from the sourceCanvas to ensure it behaves like normally loaded tracks
                this.image = new Image();
                this.image.onload = () => {
                    this.offscreenCanvas.width = this.width_px;
                    this.offscreenCanvas.height = this.height_px;
                    this.offscreenCtx.drawImage(this.image, 0, 0, this.width_px, this.height_px);
                    try {
                        this.imageData = this.offscreenCtx.getImageData(0, 0, this.width_px, this.height_px);
                        console.log(`Track set from canvas. Dimensions: ${this.width_px}x${this.height_px}`);
                        resolve(true);
                    } catch (e) {
                        console.error("Error getting image data from canvas-generated track:", e);
                        this.imageData = null;
                        reject(e);
                    }
                };
                this.image.onerror = () => {
                    console.error("Error loading image from canvas data URL for editor track.");
                    this.imageData = null;
                    reject(new Error("Failed to load track image"));
                };
                this.image.src = sourceCanvas.toDataURL(); // This triggers the onload
            });
        }


        isPixelOnLine(x_img_px, y_img_px) {
            if (!this.imageData || x_img_px < 0 || x_img_px >= this.width_px || y_img_px < 0 || y_img_px >= this.height_px) {
                return false; // Out of bounds or no image data
            }
            const R_INDEX = (Math.floor(y_img_px) * this.width_px + Math.floor(x_img_px)) * 4;
            const r = this.imageData.data[R_INDEX];
            const g = this.imageData.data[R_INDEX + 1];
            const b = this.imageData.data[R_INDEX + 2];
            // const a = this.imageData.data[R_INDEX + 3]; // Alpha, useful if track has transparency
            // if (a < 250) return false; // Consider transparent pixels as not line (background)

            const brightness = (r + g + b) / 3;
            return brightness < this.lineThreshold;
        }

        draw(displayCtx, displayCanvasWidth, displayCanvasHeight) {
            if (this.image && this.image.complete && this.image.naturalWidth > 0) {
                displayCtx.drawImage(this.image, 0, 0, displayCanvasWidth, displayCanvasHeight);
                
                // Draw watermark if available
                if (this.watermarkImage && this.watermarkImage.complete && this.watermarkImage.naturalWidth > 0) {
                    const watermarkAspectRatio = this.watermarkImage.naturalWidth / this.watermarkImage.naturalHeight;
                    let watermarkWidth = displayCanvasWidth * 0.6;
                    let watermarkHeight = watermarkWidth / watermarkAspectRatio;
                    if (watermarkHeight > displayCanvasHeight * 0.6) {
                        watermarkHeight = displayCanvasHeight * 0.6;
                        watermarkWidth = watermarkHeight * watermarkAspectRatio;
                    }
                    // Final check to ensure it's not too wide after height adjustment
                    if (watermarkWidth > displayCanvasWidth * 0.6) {
                       watermarkWidth = displayCanvasWidth * 0.6;
                       watermarkHeight = watermarkWidth / watermarkAspectRatio;
                    }

                    const watermarkX = (displayCanvasWidth - watermarkWidth) / 2;
                    const watermarkY = (displayCanvasHeight - watermarkHeight) / 2;
                    displayCtx.save();
                    displayCtx.globalAlpha = 0.2;
                    displayCtx.drawImage(this.watermarkImage, watermarkX, watermarkY, watermarkWidth, watermarkHeight);
                    displayCtx.restore();
                }

            } else {
                displayCtx.fillStyle = '#eee';
                displayCtx.fillRect(0, 0, displayCanvasWidth, displayCanvasHeight);
                displayCtx.fillStyle = 'black';
                displayCtx.textAlign = 'center';
                displayCtx.font = "16px Arial";
                let message = "Cargando pista...";
                if (this.isCustom && this.customFileName) {
                    message = `Cargando pista personalizada: ${this.customFileName}...`;
                } else if (this.image.src) {
                     message = `Cargando pista: ${this.image.src.split('/').pop()}...`;
                }
                if (!this.image.src && !this.imageData) { // No track selected yet
                    message = "Seleccione una pista predefinida o cargue una personalizada.";
                }
                displayCtx.fillText(message, displayCanvasWidth / 2, displayCanvasHeight / 2);
            }
        }
        clear() {
            this.image = new Image();
            this.imageData = null;
            this.width_px = 0;
            this.height_px = 0;
            this.isCustom = false;
            this.customFileName = "";
        }
    }
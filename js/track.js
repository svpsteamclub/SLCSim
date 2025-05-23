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
            console.log("Track.load called with:", { source, width_px, height_px, lineThreshold, isCustomFile, fileName });
            
            this.isCustom = isCustomFile;
            this.fileName = fileName;
            this.lineThreshold = lineThreshold;

            const img = new Image();
            img.onload = () => {
                console.log("Track image loaded successfully:", img.width, "x", img.height);
                this.width_px = img.width;
                this.height_px = img.height;
                
                // Create a temporary canvas to process the image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Draw the image to the temporary canvas
                tempCtx.drawImage(img, 0, 0);
                
                // Get the image data
                try {
                    this.imageData = tempCtx.getImageData(0, 0, img.width, img.height);
                    console.log("Track image data obtained successfully:", this.imageData.width, "x", this.imageData.height);
                    callback(true, img.width, img.height);
                } catch (error) {
                    console.error("Error getting image data:", error);
                    this.imageData = null;
                    callback(false, 0, 0);
                }
            };
            
            img.onerror = (error) => {
                console.error("Error loading track image:", error);
                this.imageData = null;
                callback(false, 0, 0);
            };

            if (typeof source === 'string') {
                console.log("Loading track from URL:", source);
                img.src = source;
            } else if (source instanceof File) {
                console.log("Loading track from File object:", source.name);
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.readAsDataURL(source);
            } else {
                console.error("Invalid track source:", source);
                callback(false, 0, 0);
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

        draw(ctx, canvasWidth, canvasHeight) {
            if (!this.imageData) {
                console.log("No track image data to draw");
                return;
            }

            console.log("Drawing track:", {
                imageDataSize: `${this.imageData.width}x${this.imageData.height}`,
                canvasSize: `${canvasWidth}x${canvasHeight}`
            });
            
            // Create a temporary canvas to draw the track
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.imageData.width;
            tempCanvas.height = this.imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Put the image data on the temporary canvas
            tempCtx.putImageData(this.imageData, 0, 0);
            
            // Clear the main canvas
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            
            // Draw the track on the main canvas
            ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);

            // Draw watermark if available (centered, 10% opacity) ABOVE the track
            console.log('Watermark image:', this.watermarkImage, 'complete:', this.watermarkImage && this.watermarkImage.complete);
            if (this.watermarkImage && this.watermarkImage.complete) {
                const watermarkSize = Math.min(canvasWidth, canvasHeight) * 0.4;
                const x = (canvasWidth - watermarkSize) / 2;
                const y = (canvasHeight - watermarkSize) / 2;
                ctx.save();
                ctx.globalAlpha = 0.10;
                ctx.drawImage(
                    this.watermarkImage,
                    x,
                    y,
                    watermarkSize,
                    watermarkSize
                );
                ctx.globalAlpha = 1.0;
                ctx.restore();
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
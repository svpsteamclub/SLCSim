// js/utils.js
export function degreesToRadians(degrees) { return degrees * (Math.PI / 180); }
export function radiansToDegrees(radians) { return radians * (180 / Math.PI); }
export function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

export function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

export function loadAndScaleImage(src, targetWidthPx, targetHeightPx, callback) {
    const img = new Image();
    img.onload = () => {
        if (targetWidthPx && targetHeightPx && (img.naturalWidth !== targetWidthPx || img.naturalHeight !== targetHeightPx)) {
            // console.log(`Scaling image ${src} from ${img.naturalWidth}x${img.naturalHeight} to ${targetWidthPx}x${targetHeightPx}`);
            const canvas = document.createElement('canvas');
            canvas.width = targetWidthPx;
            canvas.height = targetHeightPx;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetWidthPx, targetHeightPx);
            const scaledImg = new Image();
            scaledImg.onload = () => callback(scaledImg);
            scaledImg.onerror = () => {
                console.error(`Error creating scaled image object from canvas for ${src}`);
                callback(img); 
            }
            scaledImg.src = canvas.toDataURL();
        } else {
            callback(img); 
        }
    };
    img.onerror = () => {
        console.error(`Error loading image: ${src}`);
        callback(null); 
    };
    img.src = src;
}
/**
 * Enhanced Robot Editor with fully editable geometry and custom body support
 * @module robotEditorV2
 */

import { getDOMElements } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, SIMULATION_CONFIG } from './config.js';

// Type definitions
/** @typedef {Object} RobotGeometry
 * @property {number} width_m - Robot width in meters
 * @property {number} length_m - Robot length in meters
 * @property {number} wheelDistance_m - Distance between wheels in meters
 * @property {number} wheelDiameter_m - Diameter of each wheel in meters
 * @property {number} sensorSpread_m - Distance between left and right sensors in meters
 * @property {number} sensorOffset_m - Distance from chassis center to sensor line in meters
 * @property {number} sensorDiameter_m - Diameter of each sensor in meters
 */

/** @typedef {Object} EditorState
 * @property {RobotGeometry} geometry - Current robot geometry
 * @property {string} bodyImage - Selected body image or custom image data URL
 * @property {boolean} showMeasurements - Whether measurements are shown
 */

/** @type {EditorState} */
let state = {
    geometry: { ...DEFAULT_ROBOT_GEOMETRY },
    bodyImage: 'robot_body1.png',
    showMeasurements: true
};

// Available body images
const BODY_IMAGES = [
    { id: 'robot_body1.png', name: 'Body Type 1' },
    { id: 'robot_body2.png', name: 'Body Type 2' }
];

// Robot Editor V2 - Start from scratch
export function initRobotEditorV2() {
    // TODO: Implement new robot editor
}

/**
 * Setup geometry input fields
 */
function setupInputFields() {
    const inputs = {
        width: document.getElementById('robotWidthInput'),
        length: document.getElementById('robotLengthInput'),
        wheelDistance: document.getElementById('wheelDistanceInput'),
        wheelDiameter: document.getElementById('wheelDiameterInput'),
        sensorSpread: document.getElementById('sensorSpreadInput'),
        sensorOffset: document.getElementById('sensorOffsetInput'),
        sensorDiameter: document.getElementById('sensorDiameterInput')
    };

    // Set initial values
    Object.entries(inputs).forEach(([key, input]) => {
        if (input) {
            input.value = state.geometry[`${key}_m`];
            input.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0) {
                    state.geometry[`${key}_m`] = value;
                    render(document.getElementById('robotEditorCanvas').getContext('2d'),
                          document.getElementById('robotEditorCanvas'));
                }
            });
        }
    });
}

/**
 * Setup body image selection and custom upload
 */
function setupBodySelection() {
    const bodySelect = document.getElementById('robotBodySelect');
    const customBodyInput = document.getElementById('customBodyInput');
    
    if (!bodySelect || !customBodyInput) return;

    // Populate body options
    BODY_IMAGES.forEach(body => {
        const option = document.createElement('option');
        option.value = body.id;
        option.textContent = body.name;
        bodySelect.appendChild(option);
    });

    // Set initial value
    bodySelect.value = state.bodyImage;

    // Handle preset body changes
    bodySelect.addEventListener('change', (e) => {
        state.bodyImage = e.target.value;
        render(document.getElementById('robotEditorCanvas').getContext('2d'),
              document.getElementById('robotEditorCanvas'));
    });

    // Handle custom body upload
    customBodyInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.bodyImage = event.target.result;
                render(document.getElementById('robotEditorCanvas').getContext('2d'),
                      document.getElementById('robotEditorCanvas'));
            };
            reader.readAsDataURL(file);
        }
    });
}

/**
 * Render the robot preview
 */
function render(ctx, canvas) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas);
    drawCenterGridLines(ctx, canvas);

    // Calculate dimensions in pixels
    const width_px = state.geometry.width_m * SIMULATION_CONFIG.pixelsPerMeter;
    const length_px = state.geometry.length_m * SIMULATION_CONFIG.pixelsPerMeter;
    const wheelDistance_px = state.geometry.wheelDistance_m * SIMULATION_CONFIG.pixelsPerMeter;
    const wheelDiameter_px = state.geometry.wheelDiameter_m * SIMULATION_CONFIG.pixelsPerMeter;
    const sensorSpread_px = state.geometry.sensorSpread_m * SIMULATION_CONFIG.pixelsPerMeter;
    const sensorOffset_px = state.geometry.sensorOffset_m * SIMULATION_CONFIG.pixelsPerMeter;
    const sensorDiameter_px = state.geometry.sensorDiameter_m * SIMULATION_CONFIG.pixelsPerMeter;

    // Draw robot body
    const bodyImg = new Image();
    bodyImg.src = state.bodyImage;
    bodyImg.onload = () => {
        ctx.save();
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.drawImage(bodyImg, -width_px/2, -length_px/2, width_px, length_px);
        ctx.restore();
    };

    // Draw wheels
    const wheelImg = new Image();
    wheelImg.src = 'assets/robot_parts/robot_wheel.png';
    wheelImg.onload = () => {
        ctx.save();
        // Left wheel
        ctx.translate(canvas.width/2 - wheelDistance_px/2, canvas.height/2);
        ctx.drawImage(wheelImg, -wheelDiameter_px/2, -wheelDiameter_px/2, wheelDiameter_px, wheelDiameter_px);
        // Right wheel
        ctx.translate(wheelDistance_px, 0);
        ctx.drawImage(wheelImg, -wheelDiameter_px/2, -wheelDiameter_px/2, wheelDiameter_px, wheelDiameter_px);
        ctx.restore();
    };

    // Draw sensors
    const sensorImg = new Image();
    sensorImg.src = 'assets/robot_parts/sensor.png';
    sensorImg.onload = () => {
        ctx.save();
        // Center sensor
        ctx.translate(canvas.width/2, canvas.height/2 - sensorOffset_px);
        ctx.drawImage(sensorImg, -sensorDiameter_px/2, -sensorDiameter_px/2, sensorDiameter_px, sensorDiameter_px);
        // Left sensor
        ctx.translate(-sensorSpread_px/2, 0);
        ctx.drawImage(sensorImg, -sensorDiameter_px/2, -sensorDiameter_px/2, sensorDiameter_px, sensorDiameter_px);
        // Right sensor
        ctx.translate(sensorSpread_px, 0);
        ctx.drawImage(sensorImg, -sensorDiameter_px/2, -sensorDiameter_px/2, sensorDiameter_px, sensorDiameter_px);
        ctx.restore();
    };

    // Draw measurements if enabled
    if (state.showMeasurements) {
        drawMeasurements(ctx, canvas, {
            width_px,
            length_px,
            wheelDistance_px,
            wheelDiameter_px,
            sensorSpread_px,
            sensorOffset_px,
            sensorDiameter_px
        });
    }
}

/**
 * Draw measurements on the canvas
 */
function drawMeasurements(ctx, canvas, dimensions) {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // Draw width measurement
    ctx.beginPath();
    ctx.moveTo(canvas.width/2 - dimensions.width_px/2, canvas.height/2 - dimensions.length_px/2 - 20);
    ctx.lineTo(canvas.width/2 + dimensions.width_px/2, canvas.height/2 - dimensions.length_px/2 - 20);
    ctx.stroke();
    ctx.fillText(`${state.geometry.width_m.toFixed(2)}m`, canvas.width/2, canvas.height/2 - dimensions.length_px/2 - 25);

    // Draw length measurement
    ctx.beginPath();
    ctx.moveTo(canvas.width/2 - dimensions.width_px/2 - 20, canvas.height/2 - dimensions.length_px/2);
    ctx.lineTo(canvas.width/2 - dimensions.width_px/2 - 20, canvas.height/2 + dimensions.length_px/2);
    ctx.stroke();
    ctx.save();
    ctx.translate(canvas.width/2 - dimensions.width_px/2 - 25, canvas.height/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText(`${state.geometry.length_m.toFixed(2)}m`, 0, 0);
    ctx.restore();

    // Draw wheel distance measurement
    ctx.beginPath();
    ctx.moveTo(canvas.width/2 - dimensions.wheelDistance_px/2, canvas.height/2 + dimensions.length_px/2 + 20);
    ctx.lineTo(canvas.width/2 + dimensions.wheelDistance_px/2, canvas.height/2 + dimensions.length_px/2 + 20);
    ctx.stroke();
    ctx.fillText(`Wheel Distance: ${state.geometry.wheelDistance_m.toFixed(2)}m`, 
                 canvas.width/2, canvas.height/2 + dimensions.length_px/2 + 35);

    // Draw sensor measurements
    ctx.beginPath();
    ctx.moveTo(canvas.width/2 - dimensions.sensorSpread_px/2, canvas.height/2 - dimensions.sensorOffset_px - 20);
    ctx.lineTo(canvas.width/2 + dimensions.sensorSpread_px/2, canvas.height/2 - dimensions.sensorOffset_px - 20);
    ctx.stroke();
    ctx.fillText(`Sensor Spread: ${state.geometry.sensorSpread_m.toFixed(2)}m`, 
                 canvas.width/2, canvas.height/2 - dimensions.sensorOffset_px - 35);

    ctx.restore();
}

/**
 * Draw grid on the canvas
 */
function drawGrid(ctx, canvas) {
    ctx.save();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    const gridSize = 20;
    
    // Draw vertical lines
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    ctx.restore();
}

/**
 * Draw center grid lines
 */
function drawCenterGridLines(ctx, canvas) {
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 0);
    ctx.lineTo(canvas.width/2, canvas.height);
    ctx.stroke();

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, canvas.height/2);
    ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();

    ctx.restore();
}

/**
 * Export robot design to simulator
 */
function exportRobotDesign() {
    // Store in localStorage for simulator to access
    localStorage.setItem('customRobotDesign', JSON.stringify({
        geometry: state.geometry,
        bodyImage: state.bodyImage
    }));
    
    // Switch to simulator tab
    const simulatorTabButton = document.querySelector('.tab-button[data-tab="simulator"]');
    if (simulatorTabButton) simulatorTabButton.click();
    
    alert("Diseño del robot exportado al simulador. Usa el botón 'Restaurar Robot por Defecto' para volver al robot original.");
} 
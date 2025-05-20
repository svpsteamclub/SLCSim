/**
 * Enhanced Robot Editor with improved validation and state management
 * @module robotEditorV2
 */

import { getDOMElements } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, SIMULATION_CONFIG } from './config.js';

const GRID_SIZE = 5; // Grid size in pixels
const MIN_WHEELS = 2;
const MAX_WHEELS = 4;
const MIN_SENSORS = 1;
const MAX_SENSORS = 8;

// Type definitions
/** @typedef {Object} Component
 * @property {string} type - Component type (chassis, wheel, sensor, etc.)
 * @property {string} file - Component file name
 * @property {string} src - Component image source
 * @property {number} width - Component width in pixels
 * @property {number} height - Component height in pixels
 * @property {number} x - X position in pixels
 * @property {number} y - Y position in pixels
 * @property {number} [angle] - Rotation angle in radians
 */

/** @typedef {Object} EditorState
 * @property {Component[]} placedComponents - Array of placed components
 * @property {boolean} isEraseModeActive - Whether erase mode is active
 * @property {Component|null} dragData - Currently dragged component data
 * @property {Component|null} selectedComponent - Currently selected component
 * @property {number} offsetX - X offset for dragging
 * @property {number} offsetY - Y offset for dragging
 * @property {number} lastDblClickTime - Last double click timestamp
 * @property {string[]} history - Undo/redo history
 * @property {number} historyIndex - Current history index
 * @property {boolean} gridVisible - Whether grid is visible
 * @property {boolean} snapToGrid - Whether snapping to grid is enabled
 * @property {boolean} showMeasurements - Whether measurements are shown
 */

/** @type {EditorState} */
let state = {
    placedComponents: [],
    isEraseModeActive: false,
    dragData: null,
    selectedComponent: null,
    offsetX: 0,
    offsetY: 0,
    lastDblClickTime: 0,
    history: [],
    historyIndex: -1,
    gridVisible: true,
    snapToGrid: true,
    showMeasurements: true
};

// Component constraints
const constraints = {
    chassis: {
        min: 1,
        max: 1,
        required: true
    },
    wheel: {
        min: MIN_WHEELS,
        max: MAX_WHEELS,
        required: true
    },
    sensor: {
        min: MIN_SENSORS,
        max: MAX_SENSORS,
        required: true
    },
    arduino: {
        min: 0,
        max: 1,
        required: false
    },
    driver: {
        min: 0,
        max: 1,
        required: false
    }
};

/**
 * Get palette components from files
 * @returns {Component[]} Array of palette components
 */
function getPaletteComponentsFromFiles() {
    const files = [
        'robot_body1.png',
        'robot_wheel.png',
        'sensor.png',
        'arduino_uno.png',
        'l298n.png',
    ];
    return files.map(file => {
        let type = 'other', name = file;
        if (file.startsWith('robot_body')) { type = 'chassis'; name = 'Chasis'; }
        else if (file.startsWith('robot_wheel')) { type = 'wheel'; name = 'Rueda'; }
        else if (file.startsWith('sensor')) { type = 'sensor'; name = 'Sensor'; }
        else if (file.startsWith('arduino')) { type = 'arduino'; name = 'Arduino'; }
        else if (file.startsWith('l298n') || file.startsWith('driver')) { type = 'driver'; name = 'Driver'; }
        return {
            type,
            name,
            file,
            src: `assets/robot_parts/${file}`,
            width: 0, // Will be set dynamically
            height: 0 // Will be set dynamically
        };
    });
}

/**
 * Initialize the robot editor
 */
export function initRobotEditorV2() {
    const elems = getDOMElements();
    const canvas = elems.robotEditorCanvas;
    if (!canvas) {
        console.error('Robot Editor Canvas not found!');
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context!');
        return;
    }

    // Set fixed canvas dimensions from config
    const canvasWidth = SIMULATION_CONFIG.canvasWidth;
    const canvasHeight = SIMULATION_CONFIG.canvasHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Initialize state
    state = {
        placedComponents: [],
        isEraseModeActive: false,
        dragData: null,
        selectedComponent: null,
        offsetX: 0,
        offsetY: 0,
        lastDblClickTime: 0,
        history: [],
        historyIndex: -1,
        gridVisible: true,
        snapToGrid: true,
        showMeasurements: true
    };

    // Initialize erase mode state
    const eraseButton = elems.toggleEraseComponentButton;
    if (eraseButton) {
        eraseButton.addEventListener('click', () => {
            state.isEraseModeActive = !state.isEraseModeActive;
            eraseButton.textContent = state.isEraseModeActive ? 'Desactivar Modo Borrar' : 'Activar Modo Borrar';
            canvas.style.cursor = state.isEraseModeActive ? 'not-allowed' : 'crosshair';
        });
    }

    // Initialize component palettes
    const chassisPalette = document.getElementById('robotChassisPalette');
    const wheelPalette = document.getElementById('robotWheelPalette');
    const sensorPalette = document.getElementById('robotSensorPalette');

    if (chassisPalette) {
        const img = chassisPalette.querySelector('img');
        if (img) {
            img.addEventListener('dragstart', (e) => {
                state.dragData = {
                    type: 'chassis',
                    file: 'robot_body.png',
                    src: 'assets/robot_parts/robot_body.png',
                    width: 100,
                    height: 60,
                    x: 0,
                    y: 0
                };
            });
        }
    }

    if (wheelPalette) {
        const img = wheelPalette.querySelector('img');
        if (img) {
            img.addEventListener('dragstart', (e) => {
                state.dragData = {
                    type: 'wheel',
                    file: 'robot_wheel.png',
                    src: 'assets/robot_parts/robot_wheel.png',
                    width: 40,
                    height: 40,
                    x: 0,
                    y: 0
                };
            });
        }
    }

    if (sensorPalette) {
        const img = sensorPalette.querySelector('img');
        if (img) {
            img.addEventListener('dragstart', (e) => {
                state.dragData = {
                    type: 'sensor',
                    file: 'sensor.png',
                    src: 'assets/robot_parts/sensor.png',
                    width: 20,
                    height: 20,
                    x: 0,
                    y: 0
                };
            });
        }
    }

    // @ts-ignore - We know this exists
    window.PALETTE_COMPONENTS = getPaletteComponentsFromFiles();
    buildPalette(() => {
        setupPaletteDrag();
        setupCanvasEvents(canvas, ctx);
        setupButtons();
        render(ctx, canvas);
    });
}

/**
 * Build the component palette
 * @param {() => void} callback - Callback to execute when palette is built
 */
function buildPalette(callback) {
    // Clear existing palettes
    const palettes = {
        chassis: document.getElementById('robotChassisPalette'),
        wheel: document.getElementById('robotWheelPalette'),
        sensor: document.getElementById('robotSensorPalette'),
        arduino: document.getElementById('robotArduinoPalette'),
        driver: document.getElementById('robotDriverPalette')
    };

    Object.values(palettes).forEach(palette => {
        if (palette) palette.innerHTML = '';
    });

    let loaded = 0;
    // @ts-ignore - We know this exists
    const comps = window.PALETTE_COMPONENTS || [];
    comps.forEach(function(comp) {
        const img = document.createElement('img');
        img.src = comp.src;
        img.alt = comp.name;
        img.draggable = true;
        img.dataset.type = comp.type;
        img.dataset.file = comp.file;
        // Set only the palette display height, width is proportional
        img.onload = function() {
            comp.height = 70; // Fixed display height
            comp.width = Math.round((img.naturalWidth / img.naturalHeight) * 70); // Proportional width
            img.style.height = '70px';
            img.style.width = comp.width + 'px';
            loaded++;
            if (loaded === comps.length && typeof callback === 'function') callback();
        };
        const palette = palettes[comp.type];
        if (palette) palette.appendChild(img);
    });
}

function setupPaletteDrag() {
  document.querySelectorAll('.robot-parts-palette img').forEach(function(img) {
    img.addEventListener('dragstart', function(e) {
      // Find the palette component by file
      const comp = (window.PALETTE_COMPONENTS || []).find(function(c) { return c.file === img.dataset.file; });
      if (!comp) return;
      state.dragData = {
        type: img.dataset.type,
        file: img.dataset.file,
        src: img.src,
        width: comp.width,
        height: comp.height,
        x: 0,
        y: 0
      };
    });
  });
}

function setupCanvasEvents(canvas, ctx) {
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (state.dragData) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
      const y = Math.round((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;
      drawDragPreview(ctx, x, y);
    }
  });

  canvas.addEventListener('drop', (e) => {
    if (!state.dragData) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;
    
    if (canPlaceComponent(state.dragData.type)) {
      addComponent({
        ...state.dragData,
        x,
        y,
        angle: 0
      });
      state.dragData = null;
      render(ctx, canvas);
    } else {
      showNotification(`Cannot add more ${state.dragData.type} components`, 'error');
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check components in reverse order (top to bottom)
    for (let i = state.placedComponents.length - 1; i >= 0; i--) {
      const comp = state.placedComponents[i];
      if (isPointInComponent(x, y, comp)) {
        if (state.isEraseModeActive) {
          console.log('Erasing component:', comp);
          removeComponent(i);
          render(ctx, canvas);
          return;
        } else {
          state.selectedComponent = comp;
          state.offsetX = x - comp.x;
          state.offsetY = y - comp.y;
          canvas.style.cursor = 'move';
          break;
        }
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!state.selectedComponent) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Snap to 5x5 grid
    state.selectedComponent.x = Math.round((x - state.offsetX) / 5) * 5;
    state.selectedComponent.y = Math.round((y - state.offsetY) / 5) * 5;
    render(ctx, canvas);
  });

  canvas.addEventListener('mouseup', () => {
    state.selectedComponent = null;
    canvas.style.cursor = state.isEraseModeActive ? 'not-allowed' : 'crosshair';
  });

  // Double-click to rotate component 90 degrees (debounced)
  canvas.addEventListener('dblclick', (e) => {
    const now = Date.now();
    if (now - state.lastDblClickTime < 300) return; // Ignore if within 300ms of last dblclick
    state.lastDblClickTime = now;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Check components in reverse order (top to bottom)
    for (let i = state.placedComponents.length - 1; i >= 0; i--) {
      const comp = state.placedComponents[i];
      if (isPointInComponent(x, y, comp)) {
        if (typeof comp.angle !== 'number') comp.angle = 0;
        comp.angle = ((comp.angle + Math.PI / 2) % (2 * Math.PI));
        render(ctx, canvas);
        break;
      }
    }
  });
}

function setupButtons() {
  const saveBtn = document.getElementById('saveRobotDesign');
  const loadBtn = document.getElementById('loadRobotDesign');
  const exportBtn = document.getElementById('exportRobotDesign');
  const eraseBtn = document.getElementById('toggleEraseComponentButton');

  if (!saveBtn || !loadBtn || !exportBtn || !eraseBtn) {
    console.error('One or more robot editor buttons are missing in the DOM.');
    return;
  }

  saveBtn.addEventListener('click', saveRobotDesign);
  loadBtn.addEventListener('click', () => {
    document.getElementById('loadRobotDesignInput').click();
  });
  exportBtn.addEventListener('click', exportRobotDesign);
  eraseBtn.addEventListener('click', toggleEraseMode);

  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
  // Only handle shortcuts if we're in the robot editor tab
  if (!document.getElementById('robotEditorContent').classList.contains('active')) {
    return;
  }

  // Ctrl/Cmd + Z for undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
  if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
    e.preventDefault();
    redo();
  }
  // Delete key for removing selected component
  if (e.key === 'Delete' && state.selectedComponent) {
    const index = state.placedComponents.indexOf(state.selectedComponent);
    if (index !== -1) {
      removeComponent(index);
      state.selectedComponent = null;
      render(document.getElementById('robotEditorCanvas').getContext('2d'), 
            document.getElementById('robotEditorCanvas'));
    }
  }
  // Arrow keys for fine movement
  if (state.selectedComponent) {
    const moveAmount = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft':
        state.selectedComponent.x -= moveAmount;
        break;
      case 'ArrowRight':
        state.selectedComponent.x += moveAmount;
        break;
      case 'ArrowUp':
        state.selectedComponent.y -= moveAmount;
        break;
      case 'ArrowDown':
        state.selectedComponent.y += moveAmount;
        break;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      render(document.getElementById('robotEditorCanvas').getContext('2d'), 
            document.getElementById('robotEditorCanvas'));
    }
  }
}

function toggleEraseMode() {
  state.isEraseModeActive = !state.isEraseModeActive;
  const eraseBtn = document.getElementById('toggleEraseComponentButton');
  if (eraseBtn) {
    eraseBtn.textContent = state.isEraseModeActive ? 'Desactivar Modo Borrar' : 'Activar Modo Borrar';
    eraseBtn.style.backgroundColor = state.isEraseModeActive ? '#d9534f' : '';
    eraseBtn.style.borderColor = state.isEraseModeActive ? '#d43f3a' : '';
  }
  const canvas = document.getElementById('robotEditorCanvas');
  if (canvas) {
    canvas.style.cursor = state.isEraseModeActive ? 'not-allowed' : 'crosshair';
  }
}

function exportRobotDesign() {
  if (state.isEraseModeActive) toggleEraseMode(); // Exit erase mode before export

  console.log('Placed components:', state.placedComponents);

  // Calculate robot geometry from placed components
  const geometry = calculateRobotGeometry();
  console.log('Calculated geometry:', geometry);
  if (!geometry) {
    alert("No se puede exportar el robot: No hay componentes colocados o la geometría no es válida.");
    return;
  }

  // Create export data
  const exportData = {
    geometry: geometry,
    components: state.placedComponents.map(comp => ({
      type: comp.type,
      x: comp.x,
      y: comp.y,
      width: comp.width,
      height: comp.height,
      rotation: comp.rotation || 0
    }))
  };

  // Store in localStorage for simulator to access
  localStorage.setItem('customRobotDesign', JSON.stringify(exportData));
  
  // Switch to simulator tab
  const simulatorTabButton = document.querySelector('.tab-button[data-tab="simulator"]');
  if (simulatorTabButton) simulatorTabButton.click();
  
  alert("Diseño del robot exportado al simulador. Usa el botón 'Restaurar Robot por Defecto' para volver al robot original.");
}

function calculateRobotGeometry() {
  if (state.placedComponents.length === 0) return null;

  // Find the chassis component
  const chassis = state.placedComponents.find(comp => comp.type === 'chassis');
  if (!chassis) return null;

  // Calculate dimensions in meters (convert from mm)
  const width_m = chassis.width / 1000;
  const length_m = chassis.height / 1000;

  // Find sensor components
  const sensors = state.placedComponents.filter(comp => comp.type === 'sensor');
  if (sensors.length < 3) return null;

  // Calculate sensor positions relative to chassis center
  const chassisCenterX = chassis.x + chassis.width / 2;
  const chassisCenterY = chassis.y + chassis.height / 2;

  // Calculate sensor spread and offset
  const sensorPositions = sensors.map(sensor => ({
    x: sensor.x + sensor.width / 2 - chassisCenterX,
    y: sensor.y + sensor.height / 2 - chassisCenterY
  }));

  // Calculate sensor spread (distance between left and right sensors)
  const leftSensor = sensorPositions.reduce((leftmost, current) => 
    current.x < leftmost.x ? current : leftmost, sensorPositions[0]);
  const rightSensor = sensorPositions.reduce((rightmost, current) => 
    current.x > rightmost.x ? current : rightmost, sensorPositions[0]);
  
  const sensorSpread_m = Math.abs(rightSensor.x - leftSensor.x) / 1000;

  // Find center sensor
  const centerSensor = sensorPositions.find(sensor => 
    Math.abs(sensor.x) < 5 && Math.abs(sensor.y) > 0);
  
  if (!centerSensor) return null;

  // Calculate sensor offset (distance from chassis center to sensor line)
  const sensorOffset_m = Math.abs(centerSensor.y) / 1000;

  // Calculate sensor diameter
  const sensorDiameter_m = sensors[0].width / 1000;

  return {
    width_m,
    length_m,
    sensorSpread_m,
    sensorOffset_m,
    sensorDiameter_m
  };
}

function getPaletteComponent(type) {
  return (window.PALETTE_COMPONENTS || []).find(c => c.type === type);
}

function isPointInComponent(x, y, comp) {
    const dx = x - comp.x;
    const dy = y - comp.y;
    return Math.abs(dx) <= comp.width/2 && Math.abs(dy) <= comp.height/2;
}

function render(ctx, canvas) {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid if enabled
  if (state.gridVisible) {
    drawGrid(ctx, canvas);
  }

  // Always draw center grid lines in red
  drawCenterGridLines(ctx, canvas);

  // Draw components
  state.placedComponents.forEach(comp => {
    const img = new Image();
    img.src = comp.src;
    
    ctx.save();
    ctx.translate(comp.x, comp.y);
    ctx.rotate(comp.angle || 0);
    
    // Draw component
    ctx.drawImage(img, -comp.width/2, -comp.height/2, comp.width, comp.height);
    
    // Draw selection highlight
    if (comp === state.selectedComponent) {
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.strokeRect(-comp.width/2 - 2, -comp.height/2 - 2, 
                    comp.width + 4, comp.height + 4);
    }
    
    ctx.restore();
  });

  // Draw alignment guides if a component is selected
  if (state.selectedComponent) {
    drawAlignmentGuides(ctx, canvas);
  }
}

function drawGrid(ctx, canvas) {
  ctx.save();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.5;
  
  // Draw vertical lines
  for (let x = 0; x < canvas.width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let y = 0; y < canvas.height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  ctx.restore();
}

function drawMeasurements(ctx, comp) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  
  // Draw width
  ctx.fillText(`${comp.width}px`, comp.x, comp.y - comp.height/2 - 5);
  
  // Draw height
  ctx.save();
  ctx.translate(comp.x - comp.width/2 - 5, comp.y);
  ctx.rotate(-Math.PI/2);
  ctx.fillText(`${comp.height}px`, 0, 0);
  ctx.restore();
  
  ctx.restore();
}

function drawAlignmentGuides(ctx, canvas) {
  if (!state.selectedComponent) return;
  
  ctx.save();
  ctx.strokeStyle = '#2196F3';
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

// Draw always-visible red center grid lines
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

function canPlaceComponent(type) {
  const constraint = constraints[type];
  if (!constraint) return false;
  
  const count = state.placedComponents.filter(c => c.type === type).length;
  return count < constraint.max;
}

function addComponent(component) {
  state.placedComponents.push(component);
  saveToHistory();
}

function removeComponent(index) {
  state.placedComponents.splice(index, 1);
  saveToHistory();
}

function saveToHistory() {
  // Remove any future history if we're not at the end
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  
  // Add current state to history
  state.history.push(JSON.stringify(state.placedComponents));
  state.historyIndex = state.history.length - 1;
  
  // Limit history size
  if (state.history.length > 50) {
    state.history.shift();
    state.historyIndex--;
  }
}

function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    state.placedComponents = JSON.parse(state.history[state.historyIndex]);
    render(document.getElementById('robotEditorCanvas').getContext('2d'), document.getElementById('robotEditorCanvas'));
  }
}

function redo() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++;
    state.placedComponents = JSON.parse(state.history[state.historyIndex]);
    render(document.getElementById('robotEditorCanvas').getContext('2d'), document.getElementById('robotEditorCanvas'));
  }
}

function drawDragPreview(ctx, x, y) {
  if (!state.dragData) return;
  
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(x, y);
  ctx.rotate(0);
  
  const img = new Image();
  img.src = state.dragData.src;
  ctx.drawImage(img, -state.dragData.width/2, -state.dragData.height/2, 
                state.dragData.width, state.dragData.height);
  
  ctx.restore();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Trigger animation
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  });
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
} 
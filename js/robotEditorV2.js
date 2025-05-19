import { getDOMElements } from './ui.js';

const SCALE = 1; // 1px = 1mm

let placedComponents = [];
let isEraseModeActive = false;
let dragData = null;
let selectedComponent = null;
let offsetX = 0, offsetY = 0;

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
      src: `assets/robot_parts/${file}`
      // width/height will be set dynamically
    };
  });
}

export function initRobotEditorV2() {
  const canvas = document.getElementById('robotEditorCanvas');
  if (!canvas) {
    console.error('Robot Editor Canvas not found!');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas context!');
    return;
  }

  // Initialize erase mode state
  isEraseModeActive = false;
  const eraseBtn = document.getElementById('toggleEraseComponentButton');
  if (eraseBtn) {
    eraseBtn.textContent = 'Activar Modo Borrar';
    eraseBtn.style.backgroundColor = '';
    eraseBtn.style.borderColor = '';
  }

  window.PALETTE_COMPONENTS = getPaletteComponentsFromFiles();
  buildPalette(() => {
    setupPaletteDrag();
    setupCanvasEvents(canvas, ctx);
    setupButtons();
    render(ctx, canvas);
  });
}

function buildPalette(callback) {
  // Clear existing palettes
  document.getElementById('robotChassisPalette').innerHTML = '';
  document.getElementById('robotWheelPalette').innerHTML = '';
  document.getElementById('robotSensorPalette').innerHTML = '';
  document.getElementById('robotArduinoPalette').innerHTML = '';
  document.getElementById('robotDriverPalette').innerHTML = '';
  let loaded = 0;
  const comps = window.PALETTE_COMPONENTS || [];
  comps.forEach(comp => {
    const img = document.createElement('img');
    img.src = comp.src;
    img.alt = comp.name;
    img.draggable = true;
    img.dataset.type = comp.type;
    img.dataset.file = comp.file;
    img.onload = () => {
      comp.width = img.naturalWidth;
      comp.height = img.naturalHeight;
      img.style.width = img.naturalWidth + 'px';
      img.style.height = img.naturalHeight + 'px';
      loaded++;
      if (loaded === comps.length && typeof callback === 'function') callback();
    };
    if (comp.type === 'chassis') document.getElementById('robotChassisPalette').appendChild(img);
    if (comp.type === 'wheel') document.getElementById('robotWheelPalette').appendChild(img);
    if (comp.type === 'sensor') document.getElementById('robotSensorPalette').appendChild(img);
    if (comp.type === 'arduino') document.getElementById('robotArduinoPalette').appendChild(img);
    if (comp.type === 'driver') document.getElementById('robotDriverPalette').appendChild(img);
  });
}

function setupPaletteDrag() {
  document.querySelectorAll('.robot-parts-palette img').forEach(img => {
    img.addEventListener('dragstart', (e) => {
      // Find the palette component by file
      const comp = (window.PALETTE_COMPONENTS || []).find(c => c.file === img.dataset.file);
      dragData = {
        type: img.dataset.type,
        file: img.dataset.file,
        src: img.src,
        width: comp.width,
        height: comp.height
      };
    });
  });
}

function setupCanvasEvents(canvas, ctx) {
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('drop', (e) => {
    if (!dragData) return;
    const rect = canvas.getBoundingClientRect();
    // Snap to 5x5 grid
    const x = Math.round((e.clientX - rect.left) / 5) * 5;
    const y = Math.round((e.clientY - rect.top) / 5) * 5;
    placedComponents.push({
      ...dragData,
      x,
      y,
      angle: 0
    });
    dragData = null;
    render(ctx, canvas);
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check components in reverse order (top to bottom)
    for (let i = placedComponents.length - 1; i >= 0; i--) {
      const comp = placedComponents[i];
      if (isPointInComponent(x, y, comp)) {
        if (isEraseModeActive) {
          console.log('Erasing component:', comp);
          placedComponents.splice(i, 1);
          render(ctx, canvas);
          return;
        } else {
          selectedComponent = comp;
          offsetX = x - comp.x;
          offsetY = y - comp.y;
          canvas.style.cursor = 'move';
          break;
        }
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!selectedComponent) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Snap to 5x5 grid
    selectedComponent.x = Math.round((x - offsetX) / 5) * 5;
    selectedComponent.y = Math.round((y - offsetY) / 5) * 5;
    render(ctx, canvas);
  });

  canvas.addEventListener('mouseup', () => {
    selectedComponent = null;
    canvas.style.cursor = isEraseModeActive ? 'not-allowed' : 'crosshair';
  });

  // Double-click to rotate component 90 degrees (debounced)
  let lastDblClickTime = 0;
  canvas.addEventListener('dblclick', (e) => {
    const now = Date.now();
    if (now - lastDblClickTime < 300) return; // Ignore if within 300ms of last dblclick
    lastDblClickTime = now;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Check components in reverse order (top to bottom)
    for (let i = placedComponents.length - 1; i >= 0; i--) {
      const comp = placedComponents[i];
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
  let eraseBtn = document.getElementById('toggleEraseComponentButton');
  if (!eraseBtn) {
    console.error('Erase button not found!');
    return;
  }

  // Remove any previous event listeners by replacing with a clone
  const newEraseBtn = eraseBtn.cloneNode(true);
  eraseBtn.parentNode.replaceChild(newEraseBtn, eraseBtn);
  eraseBtn = newEraseBtn;

  eraseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isEraseModeActive = !isEraseModeActive;
    const canvas = document.getElementById('robotEditorCanvas');
    eraseBtn.textContent = isEraseModeActive ? 'Desactivar Modo Borrar' : 'Activar Modo Borrar';
    eraseBtn.style.backgroundColor = isEraseModeActive ? '#d9534f' : '';
    eraseBtn.style.borderColor = isEraseModeActive ? '#d43f3a' : '';
    if (canvas) {
      canvas.style.cursor = isEraseModeActive ? 'not-allowed' : 'crosshair';
    }
    console.log('Erase mode:', isEraseModeActive ? 'activated' : 'deactivated');
  });
}

function getPaletteComponent(type) {
  return (window.PALETTE_COMPONENTS || []).find(c => c.type === type);
}

function isPointInComponent(x, y, comp) {
    // Calculate the rotated point coordinates
    const dx = x - comp.x;
    const dy = y - comp.y;
    const rotatedX = dx * Math.cos(-comp.angle) - dy * Math.sin(-comp.angle);
    const rotatedY = dx * Math.sin(-comp.angle) + dy * Math.cos(-comp.angle);
    
    // Check if the point is within the component's bounds
    return Math.abs(rotatedX) <= comp.width / 2 &&
           Math.abs(rotatedY) <= comp.height / 2;
}

function render(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw 5x5 pixel grid
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 0.5;
  
  // Draw vertical grid lines
  for (let x = 0; x < canvas.width; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // Draw horizontal grid lines
  for (let y = 0; y < canvas.height; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw center lines
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 1;
  
  // Vertical center line
  const centerX = canvas.width / 2;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, canvas.height);
  ctx.stroke();
  
  // Horizontal center line
  const centerY = canvas.height / 2;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(canvas.width, centerY);
  ctx.stroke();

  // Draw components
  placedComponents.forEach(comp => {
    const img = new window.Image();
    img.src = comp.src;
    ctx.save();
    ctx.translate(comp.x, comp.y);
    ctx.rotate(comp.angle || 0);
    ctx.drawImage(img, -comp.width / 2, -comp.height / 2, comp.width, comp.height);
    ctx.restore();
  });
} 
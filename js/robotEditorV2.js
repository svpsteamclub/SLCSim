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
  const ctx = canvas.getContext('2d');
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
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
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
    for (let i = placedComponents.length - 1; i >= 0; i--) {
      const comp = placedComponents[i];
      if (isPointInComponent(x, y, comp)) {
        if (isEraseModeActive) {
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
    selectedComponent.x = x - offsetX;
    selectedComponent.y = y - offsetY;
    render(ctx, canvas);
  });

  canvas.addEventListener('mouseup', () => {
    selectedComponent = null;
    canvas.style.cursor = isEraseModeActive ? 'not-allowed' : 'crosshair';
  });
}

function setupButtons() {
  const eraseBtn = document.getElementById('toggleEraseComponentButton');
  eraseBtn.addEventListener('click', () => {
    isEraseModeActive = !isEraseModeActive;
    eraseBtn.textContent = isEraseModeActive ? 'Desactivar Modo Borrar' : 'Activar Modo Borrar';
    eraseBtn.style.backgroundColor = isEraseModeActive ? '#d9534f' : '';
    eraseBtn.style.borderColor = isEraseModeActive ? '#d43f3a' : '';
    document.getElementById('robotEditorCanvas').style.cursor = isEraseModeActive ? 'not-allowed' : 'crosshair';
  });
  // TODO: Save, Load, Export logic
}

function getPaletteComponent(type) {
  return (window.PALETTE_COMPONENTS || []).find(c => c.type === type);
}

function isPointInComponent(x, y, comp) {
  // Simple bounding box, no rotation
  return (
    x >= comp.x - comp.width / 2 &&
    x <= comp.x + comp.width / 2 &&
    y >= comp.y - comp.height / 2 &&
    y <= comp.y + comp.height / 2
  );
}

function render(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
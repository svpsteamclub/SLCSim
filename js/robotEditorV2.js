import { getDOMElements } from './ui.js';

const SCALE = 1; // 1px = 1mm
const PALETTE_COMPONENTS = [
  { type: 'chassis', name: 'Chasis', file: 'robot_body.png', src: 'assets/robot_parts/robot_body.png', width: 340, height: 160 },
  { type: 'wheel', name: 'Rueda', file: 'robot_wheel.png', src: 'assets/robot_parts/robot_wheel.png', width: 50, height: 50 },
  { type: 'sensor', name: 'Sensor', file: 'sensor.png', src: 'assets/robot_parts/sensor.png', width: 12, height: 12 },
  { type: 'arduino', name: 'Arduino', file: 'arduino_placeholder.png', src: 'https://via.placeholder.com/70x70?text=Arduino', width: 68, height: 53 },
  { type: 'driver', name: 'Driver', file: 'driver_placeholder.png', src: 'https://via.placeholder.com/70x70?text=Driver', width: 60, height: 40 },
];

let placedComponents = [];
let isEraseModeActive = false;
let dragData = null;
let selectedComponent = null;
let offsetX = 0, offsetY = 0;

export function initRobotEditorV2() {
  const canvas = document.getElementById('robotEditorCanvas');
  const ctx = canvas.getContext('2d');
  setupPaletteDrag();
  setupCanvasEvents(canvas, ctx);
  setupButtons();
  render(ctx, canvas);
}

function setupPaletteDrag() {
  document.querySelectorAll('.robot-parts-palette img').forEach(img => {
    img.addEventListener('dragstart', (e) => {
      dragData = {
        type: img.dataset.type,
        file: img.dataset.file,
        src: img.src,
        width: getPaletteComponent(img.dataset.type).width,
        height: getPaletteComponent(img.dataset.type).height
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
  return PALETTE_COMPONENTS.find(c => c.type === type);
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
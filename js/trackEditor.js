// js/trackEditor.js
import { getDOMElements } from './ui.js';
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js';


let editorCanvas, ctx;
let grid = []; 
let gridSize = { rows: 4, cols: 4 }; // Default to 4x4 to match HTML selected
let trackPartsImages = {}; 
let selectedTrackPart = null; 

export function initTrackEditor(mainAppInterface) {
    const elems = getDOMElements();
    editorCanvas = elems.trackEditorCanvas;
     if (!editorCanvas) {
        console.error("Track Editor Canvas not found!");
        return;
    }
    ctx = editorCanvas.getContext('2d');
    console.log("Track Editor Initialized");

    // Set initial grid size from dropdown default
    const initialGridSizeValue = elems.trackGridSize.value.split('x');
    gridSize = { rows: parseInt(initialGridSizeValue[0]), cols: parseInt(initialGridSizeValue[1]) };


    loadTrackPartAssets(() => {
        populateTrackPartsPalette(elems.trackPartsPalette);
        setupGrid(); // setupGrid will use the gridSize set above
        renderEditor();
    });

    elems.trackGridSize.addEventListener('change', (e) => {
        const size = e.target.value.split('x');
        gridSize = { rows: parseInt(size[0]), cols: parseInt(size[1]) };
        setupGrid();
        renderEditor();
    });

    elems.generateRandomTrack.addEventListener('click', generateRandom);
    elems.exportTrackFromEditor.addEventListener('click', () => {
        const trackCanvas = exportTrackAsCanvas();
        if (trackCanvas) {
            const startX_m = (TRACK_PART_SIZE_PX / 2) / PIXELS_PER_METER;
            const startY_m = (TRACK_PART_SIZE_PX / 2) / PIXELS_PER_METER;
            const startAngle_rad = 0;

            mainAppInterface.loadTrackFromEditorCanvas(trackCanvas, startX_m, startY_m, startAngle_rad);
            alert("Pista del editor cargada en el simulador. Puede que necesites ajustar la posición inicial.");
            
            const simulatorTabButton = document.querySelector('.tab-button[data-tab="simulator"]');
            if (simulatorTabButton) simulatorTabButton.click();
        }
    });
    
    elems.saveTrackDesignButton.addEventListener('click', saveTrackDesign);
    elems.loadTrackDesignInput.addEventListener('change', loadTrackDesign);


    editorCanvas.addEventListener('click', onGridSingleClick); 
    editorCanvas.addEventListener('dblclick', onGridDoubleClick); 
}

function loadTrackPartAssets(callback) {
    let loadedCount = 0;
    const totalParts = AVAILABLE_TRACK_PARTS.length;
    if (totalParts === 0) {
        if (typeof callback === 'function') callback();
        return;
    }

    AVAILABLE_TRACK_PARTS.forEach(partInfo => {
        loadAndScaleImage(`assets/track_parts/${partInfo.file}`, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX, (img) => {
            if (img) {
                trackPartsImages[partInfo.file] = img;
            }
            loadedCount++;
            if (loadedCount === totalParts) {
                if (typeof callback === 'function') callback();
            }
        });
    });
}

function populateTrackPartsPalette(paletteElement) {
    if (!paletteElement) {
        console.error("Track parts palette element not found!");
        return;
    }
    paletteElement.innerHTML = '';
    AVAILABLE_TRACK_PARTS.forEach(partInfo => {
        const imgElement = trackPartsImages[partInfo.file]?.cloneNode() || new Image(70,70);
        if (!trackPartsImages[partInfo.file]) {
            imgElement.alt = partInfo.name;
            imgElement.style.border = "1px dashed red";
        }
        imgElement.title = partInfo.name;
        imgElement.dataset.partFile = partInfo.file;
        imgElement.addEventListener('click', () => {
            document.querySelectorAll('#trackPartsPalette img').forEach(p => p.classList.remove('selected'));
            imgElement.classList.add('selected');
            selectedTrackPart = { ...partInfo, image: trackPartsImages[partInfo.file] };
        });
        paletteElement.appendChild(imgElement);
    });
}


function setupGrid() {
    grid = Array(gridSize.rows).fill(null).map(() => Array(gridSize.cols).fill(null));
    if (editorCanvas) {
        editorCanvas.width = gridSize.cols * TRACK_PART_SIZE_PX;
        editorCanvas.height = gridSize.rows * TRACK_PART_SIZE_PX;
    }
}

function renderEditor() {
    if (!ctx || !editorCanvas) return;
    ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    ctx.fillStyle = '#ffffff'; // White background
    ctx.fillRect(0,0,editorCanvas.width, editorCanvas.height);

    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            const x_center = c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
            const y_center = r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
            const x_topLeft = c * TRACK_PART_SIZE_PX;
            const y_topLeft = r * TRACK_PART_SIZE_PX;

            if (grid[r][c] && grid[r][c].image) {
                ctx.save();
                ctx.translate(x_center, y_center); 
                ctx.rotate(grid[r][c].rotation_deg * Math.PI / 180); 
                ctx.drawImage(grid[r][c].image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                ctx.restore();
            } else {
                ctx.strokeStyle = '#cccccc'; // Lighter grid lines for white background
                ctx.lineWidth = 1;
                ctx.strokeRect(x_topLeft, y_topLeft, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
            }
        }
    }
    if (AVAILABLE_TRACK_PARTS.length === 0 && editorCanvas && editorCanvas.width > 0) { 
         ctx.fillStyle = "rgba(0,0,0,0.7)"; // Dark text on white background
         ctx.font = "bold 16px Arial";
         ctx.textAlign = "center";
         ctx.fillText("No hay partes de pista definidas en config.js", editorCanvas.width / 2, editorCanvas.height/2);
    }
}

function onGridSingleClick(event) {
    if (!selectedTrackPart || !selectedTrackPart.image) {
        return;
    }
    if (!editorCanvas) return;

    const rect = editorCanvas.getBoundingClientRect();
    const x_canvas = event.clientX - rect.left;
    const y_canvas = event.clientY - rect.top;

    const c = Math.floor(x_canvas / TRACK_PART_SIZE_PX);
    const r = Math.floor(y_canvas / TRACK_PART_SIZE_PX);

    if (r >= 0 && r < gridSize.rows && c >= 0 && c < gridSize.cols) {
        grid[r][c] = {
            ...selectedTrackPart, 
            rotation_deg: 0     
        };
        renderEditor();

        const paletteImages = document.querySelectorAll('#trackPartsPalette img');
        paletteImages.forEach(pImg => pImg.classList.remove('selected'));
        selectedTrackPart = null;
    }
}

function onGridDoubleClick(event) {
    if (!editorCanvas) return;
    const rect = editorCanvas.getBoundingClientRect();
    const x_canvas = event.clientX - rect.left;
    const y_canvas = event.clientY - rect.top;

    const c = Math.floor(x_canvas / TRACK_PART_SIZE_PX);
    const r = Math.floor(y_canvas / TRACK_PART_SIZE_PX);

    if (r >= 0 && r < gridSize.rows && c >= 0 && c < gridSize.cols && grid[r][c]) {
        grid[r][c].rotation_deg = (grid[r][c].rotation_deg + 90) % 360;
        renderEditor();
    }
    event.preventDefault();
}

function generateRandom() {
    alert("Generación aleatoria de pistas aún no implementada.");
    if (AVAILABLE_TRACK_PARTS.length > 0 && trackPartsImages[AVAILABLE_TRACK_PARTS[0].file]) {
        for (let r = 0; r < gridSize.rows; r++) {
            for (let c = 0; c < gridSize.cols; c++) {
                 grid[r][c] = {
                    ...AVAILABLE_TRACK_PARTS[0],
                    image: trackPartsImages[AVAILABLE_TRACK_PARTS[0].file],
                    rotation_deg: 0
                };
            }
        }
    }
    renderEditor();
}

function saveTrackDesign() {
    const { trackEditorTrackName } = getDOMElements();
    const trackName = trackEditorTrackName.value.trim() || "MiPistaEditada";

    const designData = {
        gridSize: { ...gridSize }, 
        gridParts: []
    };

    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            if (grid[r][c] && grid[r][c].file) { 
                designData.gridParts.push({
                    r: r,
                    c: c,
                    partFile: grid[r][c].file, 
                    rotation: grid[r][c].rotation_deg
                });
            }
        }
    }

    if (designData.gridParts.length === 0) {
        alert("La pista está vacía. No hay nada que guardar.");
        return;
    }

    const jsonData = JSON.stringify(designData, null, 2); 
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackName}.trackdesign.json`; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadTrackDesign(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const designData = JSON.parse(e.target.result);
            if (!designData.gridSize || !designData.gridParts) {
                throw new Error("Formato de archivo de diseño de pista inválido.");
            }

            gridSize.rows = designData.gridSize.rows || 4; // Default to 4 if missing
            gridSize.cols = designData.gridSize.cols || 4; // Default to 4 if missing
            
            const { trackGridSize, trackEditorTrackName } = getDOMElements();
            if (trackGridSize) trackGridSize.value = `${gridSize.rows}x${gridSize.cols}`;

            setupGrid(); 

            designData.gridParts.forEach(partData => {
                if (partData.r < gridSize.rows && partData.c < gridSize.cols) {
                    const originalPartInfo = AVAILABLE_TRACK_PARTS.find(p => p.file === partData.partFile);
                    const partImage = trackPartsImages[partData.partFile];
                    if (originalPartInfo && partImage) {
                        grid[partData.r][partData.c] = {
                            ...originalPartInfo, 
                            image: partImage,
                            rotation_deg: partData.rotation || 0
                        };
                    } else {
                        console.warn(`Parte de pista no encontrada o imagen no cargada: ${partData.partFile} en celda [${partData.r}, ${partData.c}]`);
                    }
                } else {
                     console.warn(`Parte de pista fuera de los límites del grid actual: ${partData.partFile} en celda [${partData.r}, ${partData.c}]`);
                }
            });

            renderEditor();
            alert(`Diseño de pista "${file.name}" cargado.`);
            
            if(trackEditorTrackName) {
                let fileNameWithoutExt = file.name.replace(/\.trackdesign\.json$|\.json$|\.txt$/i, '');
                trackEditorTrackName.value = fileNameWithoutExt || "PistaCargada";
            }

        } catch (error) {
            console.error("Error al cargar o parsear el diseño de pista:", error);
            alert(`Error al cargar el diseño: ${error.message}`);
        }
    };
    reader.onerror = () => {
        alert("Error al leer el archivo de diseño de pista.");
    };
    reader.readAsText(file);
    event.target.value = null;
}


function exportTrackAsCanvas() {
    if (gridSize.rows === 0 || gridSize.cols === 0) {
        alert("Grid size is invalid.");
        return null;
    }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gridSize.cols * TRACK_PART_SIZE_PX;
    exportCanvas.height = gridSize.rows * TRACK_PART_SIZE_PX;

    if (exportCanvas.width === 0 || exportCanvas.height === 0) {
        alert("Cannot export an empty track (0 width or height).");
        return null;
    }

    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = 'white';
    exportCtx.fillRect(0,0, exportCanvas.width, exportCanvas.height);

    let hasContent = false;
    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            if (grid[r][c] && grid[r][c].image) {
                hasContent = true;
                const part = grid[r][c];
                const x_center = c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                const y_center = r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;

                exportCtx.save();
                exportCtx.translate(x_center, y_center);
                exportCtx.rotate(part.rotation_deg * Math.PI / 180);
                exportCtx.drawImage(part.image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                exportCtx.restore();
            }
        }
    }
    if (!hasContent) {
        alert("El editor de pistas está vacío. Añade algunas partes.");
        return null;
    }
    return exportCanvas;
}
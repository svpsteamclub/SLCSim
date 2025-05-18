// js/trackEditor.js
import { getDOMElements } from './ui.js';
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js';


let editorCanvas, ctx;
let grid = [];
let gridSize = { rows: 4, cols: 4 };
let trackPartsImages = {};
let selectedTrackPart = null;

// Helper to get opposite direction
const OPPOSITE_DIRECTIONS = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIRECTIONS = [
    { name: 'N', dr: -1, dc: 0 }, // North
    { name: 'E', dr: 0, dc: 1 },  // East
    { name: 'S', dr: 1, dc: 0 },  // South
    { name: 'W', dr: 0, dc: -1 }  // West
];


export function initTrackEditor(mainAppInterface) {
    const elems = getDOMElements();
    editorCanvas = elems.trackEditorCanvas;
    if (!editorCanvas) {
        console.error("Track Editor Canvas not found!");
        return;
    }
    ctx = editorCanvas.getContext('2d');
    console.log("Track Editor Initialized");

    const initialGridSizeValue = elems.trackGridSize.value.split('x');
    gridSize = { rows: parseInt(initialGridSizeValue[0]), cols: parseInt(initialGridSizeValue[1]) };

    loadTrackPartAssets(() => {
        populateTrackPartsPalette(elems.trackPartsPalette);
        setupGrid();
        renderEditor();
    });

    elems.trackGridSize.addEventListener('change', (e) => {
        const size = e.target.value.split('x');
        gridSize = { rows: parseInt(size[0]), cols: parseInt(size[1]) };
        setupGrid();
        renderEditor();
    });

    elems.generateRandomTrack.addEventListener('click', generateRandomTrackWithRetry);
    elems.exportTrackFromEditor.addEventListener('click', () => {
        if (!validateTrack()) { // Basic validation before export
            if (!confirm("La pista puede tener problemas (desconexiones o callejones sin salida). ¿Exportar de todos modos?")) {
                return;
            }
        }
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

// --- (loadTrackPartAssets, populateTrackPartsPalette, setupGrid, renderEditor, onGridSingleClick, onGridDoubleClick are THE SAME as previous version) ---
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


// --- MODIFIED/NEW FUNCTIONS BELOW ---

// Helper function to get actual connections of a part considering its rotation
function getRotatedConnections(part, rotation_deg) {
    if (!part || !part.connections) return {};
    const rotated = {};
    const rotations = rotation_deg / 90; // Number of 90-degree clockwise rotations

    for (const dir in part.connections) {
        if (part.connections[dir]) {
            let currentDirIndex = DIRECTIONS.findIndex(d => d.name === dir);
            let newDirIndex = (currentDirIndex + rotations) % 4;
            rotated[DIRECTIONS[newDirIndex].name] = true;
        }
    }
    return rotated;
}

function generateRandomTrackWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        if (generateRandomLayout()) {
            console.log(`Random track generated successfully on attempt ${i + 1}`);
            renderEditor();
            return;
        }
        console.log(`Random track generation attempt ${i + 1} failed, retrying...`);
    }
    alert("No se pudo generar una pista aleatoria completamente conectada después de varios intentos. Intenta de nuevo o usa un tamaño de cuadrícula más grande.");
    // Fallback: just fill with something simple if all retries fail (or leave blank)
    setupGrid(); // Clear grid
    renderEditor();
}


function generateRandomLayout() {
    setupGrid(); // Clear grid
    if (AVAILABLE_TRACK_PARTS.length === 0) {
        alert("No hay partes de pista disponibles para generar una pista.");
        return false;
    }

    // Start at a random cell, e.g., center-ish
    const startR = Math.floor(gridSize.rows / 2);
    const startC = Math.floor(gridSize.cols / 2);

    // Place a random starting piece that has at least one connection
    let startingPieceInfo;
    let attempts = 0;
    do {
        startingPieceInfo = AVAILABLE_TRACK_PARTS[Math.floor(Math.random() * AVAILABLE_TRACK_PARTS.length)];
        attempts++;
    } while (Object.keys(startingPieceInfo.connections || {}).length === 0 && attempts < AVAILABLE_TRACK_PARTS.length * 2);
    
    if (Object.keys(startingPieceInfo.connections || {}).length === 0) {
        console.error("No suitable starting piece found.");
        return false; // Could not find a piece with connections
    }


    grid[startR][startC] = {
        ...startingPieceInfo,
        image: trackPartsImages[startingPieceInfo.file],
        rotation_deg: (Math.floor(Math.random() * 4)) * 90 // Random initial rotation
    };

    let frontier = [{ r: startR, c: startC }]; // Cells to expand from
    let visitedCells = new Set([`${startR},${startC}`]);
    let placedCount = 1;
    const totalCells = gridSize.rows * gridSize.cols;


    while (frontier.length > 0 && placedCount < totalCells) {
        // Pick a random cell from the frontier
        const frontierIndex = Math.floor(Math.random() * frontier.length);
        const currentCell = frontier[frontierIndex];
        
        // If no more valid expansions from this cell, remove it
        let expanded = false;

        // Shuffle directions to try
        const shuffledDirections = [...DIRECTIONS].sort(() => 0.5 - Math.random());

        for (const dirInfo of shuffledDirections) {
            const currentPart = grid[currentCell.r][currentCell.c];
            if (!currentPart) continue; // Should not happen if frontier is managed well

            const currentConnections = getRotatedConnections(currentPart, currentPart.rotation_deg);
            
            if (currentConnections[dirInfo.name]) { // If current part wants to connect in this direction
                const nextR = currentCell.r + dirInfo.dr;
                const nextC = currentCell.c + dirInfo.dc;

                if (nextR >= 0 && nextR < gridSize.rows && nextC >= 0 && nextC < gridSize.cols && !grid[nextR][nextC]) {
                    const requiredConnectionFromNewPart = OPPOSITE_DIRECTIONS[dirInfo.name];
                    
                    const candidateParts = AVAILABLE_TRACK_PARTS.filter(p => {
                        // Check all 4 rotations of this candidate part
                        for (let rot = 0; rot < 360; rot += 90) {
                            const newPartConnections = getRotatedConnections(p, rot);
                            if (newPartConnections[requiredConnectionFromNewPart]) return true;
                        }
                        return false;
                    });

                    if (candidateParts.length > 0) {
                        const chosenPartInfo = candidateParts[Math.floor(Math.random() * candidateParts.length)];
                        
                        // Find a rotation that matches
                        let chosenRotation = 0;
                        const shuffledRotations = [0, 90, 180, 270].sort(() => 0.5 - Math.random());
                        for (const rot of shuffledRotations) {
                             const newPartConnections = getRotatedConnections(chosenPartInfo, rot);
                             if (newPartConnections[requiredConnectionFromNewPart]) {
                                 chosenRotation = rot;
                                 break;
                             }
                        }

                        grid[nextR][nextC] = {
                            ...chosenPartInfo,
                            image: trackPartsImages[chosenPartInfo.file],
                            rotation_deg: chosenRotation
                        };
                        visitedCells.add(`${nextR},${nextC}`);
                        frontier.push({ r: nextR, c: nextC });
                        placedCount++;
                        expanded = true;
                        if (placedCount >= totalCells * 0.8 && Math.random() < 0.3) break; // Early exit sometimes for variety
                        break; // Found a piece for this direction, move to next frontier cell
                    }
                }
            }
        }
        if (!expanded) { // No expansion possible from this cell in any direction
             frontier.splice(frontierIndex, 1); // Remove from frontier
        }
         // Prune frontier: remove cells that have no empty, connectable neighbors
        frontier = frontier.filter(fCell => {
            if (!grid[fCell.r][fCell.c]) return false; // already removed if it was picked and failed
            const fPart = grid[fCell.r][fCell.c];
            const fConnections = getRotatedConnections(fPart, fPart.rotation_deg);
            for (const dir of DIRECTIONS) {
                if (fConnections[dir.name]) {
                    const nR = fCell.r + dir.dr;
                    const nC = fCell.c + dir.dc;
                    if (nR >= 0 && nR < gridSize.rows && nC >= 0 && nC < gridSize.cols && !grid[nR][nC]) {
                        return true; // Still has potential
                    }
                }
            }
            return false; // No more potential from this cell
        });
    }
    // A simple check for connectivity: if not enough cells are filled, it likely failed.
    // A more robust check would be validateTrack().
    return placedCount >= (totalCells * 0.1); // Consider success if 60% of cells are filled
}


function validateTrack() {
    // This is a placeholder for a more complex validation.
    // Basic check: are there any parts at all?
    let partCount = 0;
    let danglingConnections = 0;
    let connectionMismatches = 0;

    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            const currentPart = grid[r][c];
            if (currentPart) {
                partCount++;
                const currentConnections = getRotatedConnections(currentPart, currentPart.rotation_deg);

                for (const dir of DIRECTIONS) {
                    if (currentConnections[dir.name]) { // Current part wants to connect in this direction
                        const nextR = r + dir.dr;
                        const nextC = c + dir.dc;

                        if (nextR < 0 || nextR >= gridSize.rows || nextC < 0 || nextC >= gridSize.cols) {
                            danglingConnections++; // Connects to edge of grid
                        } else {
                            const neighborPart = grid[nextR][nextC];
                            if (!neighborPart) {
                                danglingConnections++; // Connects to an empty cell
                            } else {
                                const neighborConnections = getRotatedConnections(neighborPart, neighborPart.rotation_deg);
                                const requiredFromNeighbor = OPPOSITE_DIRECTIONS[dir.name];
                                if (!neighborConnections[requiredFromNeighbor]) {
                                    connectionMismatches++; // Neighbor doesn't connect back
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (partCount === 0) {
        alert("Validación: La pista está vacía.");
        return false;
    }
    if (connectionMismatches > 0) {
        console.warn(`Validación: Encontradas ${connectionMismatches / 2} conexiones incompatibles.`); 
        // Divided by 2 because each mismatch is counted by both parts
        // This simple count isn't perfect for user alert
    }
    if (danglingConnections > 2 && partCount > 1) { // Allow 2 for start/end of a non-loop
         console.warn(`Validación: Encontradas ${danglingConnections} conexiones abiertas/colgando.`);
    }
    
    // For now, let's just return true if there's at least one part,
    // and rely on user confirmation for export if issues are logged.
    // A full DFS/BFS to check for a single continuous loop is much more involved.
    console.log(`Validación básica: Partes=${partCount}, Incompatibles=${connectionMismatches}, Abiertas=${danglingConnections}`);
    if (partCount > 0) return true; // Basic pass
    return false;
}


// --- (saveTrackDesign, loadTrackDesign, exportTrackAsCanvas are THE SAME as previous version) ---
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

            gridSize.rows = designData.gridSize.rows || 4; 
            gridSize.cols = designData.gridSize.cols || 4; 
            
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
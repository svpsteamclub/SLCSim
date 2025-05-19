// js/trackEditor.js
import { getDOMElements } from './ui.js';
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js';


let editorCanvas, ctx;
let grid = [];
let gridSize = { rows: 4, cols: 4 };
let trackPartsImages = {};
let selectedTrackPart = null;
let debugCellPathToDraw = null; // <<<< NEW: For visualizing the generated path

const OPPOSITE_DIRECTIONS = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIRECTIONS = [
    { name: 'N', dr: -1, dc: 0 },
    { name: 'E', dr: 0, dc: 1 },
    { name: 'S', dr: 1, dc: 0 },
    { name: 'W', dr: 0, dc: -1 }
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
        setupGrid(); // This will also call renderEditor
    });

    elems.trackGridSize.addEventListener('change', (e) => {
        const size = e.target.value.split('x');
        gridSize = { rows: parseInt(size[0]), cols: parseInt(size[1]) };
        setupGrid(); // This will also call renderEditor
    });

    elems.generateRandomTrack.addEventListener('click', () => {
        generateRandomTrackWithRetry();
    });

    elems.exportTrackFromEditor.addEventListener('click', () => {
        // Temporarily disable validation for path-only export, or adapt it
        // if (!validateTrack()) { 
        //     if (!confirm("La pista puede tener problemas (desconexiones o callejones sin salida). ¿Exportar de todos modos?")) {
        //         return;
        //     }
        // }
        // For now, export will be empty as we are not populating `grid` with parts
        alert("La exportación de piezas de pista está desactivada temporalmente para la depuración de la ruta.");
        // const trackCanvas = exportTrackAsCanvas();
        // if (trackCanvas) { ... }
    });

    elems.saveTrackDesignButton.addEventListener('click', saveTrackDesign);
    elems.loadTrackDesignInput.addEventListener('change', loadTrackDesign);

    editorCanvas.addEventListener('click', onGridSingleClick);
    editorCanvas.addEventListener('dblclick', onGridDoubleClick);
}

function loadTrackPartAssets(callback) {
    // ... (same as before)
    let loadedCount = 0;
    const totalParts = AVAILABLE_TRACK_PARTS.length;
    if (totalParts === 0) {
        console.log("No track parts defined in AVAILABLE_TRACK_PARTS (config.js).");
        if (typeof callback === 'function') callback();
        return;
    }
    console.log(`Loading ${totalParts} track part assets...`);

    AVAILABLE_TRACK_PARTS.forEach(partInfo => {
        loadAndScaleImage(`assets/track_parts/${partInfo.file}`, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX, (img) => {
            if (img) {
                trackPartsImages[partInfo.file] = img;
            } else {
                console.error(`Failed to load image for track part: ${partInfo.file}`);
            }
            loadedCount++;
            if (loadedCount === totalParts) {
                console.log("All track part assets processed for loading.");
                if (typeof callback === 'function') callback();
            }
        });
    });
}

function populateTrackPartsPalette(paletteElement) {
    // ... (same as before)
    if (!paletteElement) {
        console.error("Track parts palette element not found!");
        return;
    }
    paletteElement.innerHTML = '';
    AVAILABLE_TRACK_PARTS.forEach(partInfo => {
        const imgElement = trackPartsImages[partInfo.file]?.cloneNode() || new Image(70,70);
        if (!trackPartsImages[partInfo.file]) {
            imgElement.alt = `${partInfo.name} (imagen no encontrada!)`;
            imgElement.style.border = "1px dashed red";
            console.warn(`Image for part '${partInfo.name}' (file: ${partInfo.file}) not found in trackPartsImages cache. Will show placeholder in palette.`);
        } else {
            imgElement.alt = partInfo.name;
        }
        imgElement.title = partInfo.name;
        imgElement.dataset.partFile = partInfo.file;
        imgElement.addEventListener('click', () => {
            document.querySelectorAll('#trackPartsPalette img').forEach(p => p.classList.remove('selected'));
            imgElement.classList.add('selected');
            if (trackPartsImages[partInfo.file]) { 
                 selectedTrackPart = { ...partInfo, image: trackPartsImages[partInfo.file] };
            } else {
                selectedTrackPart = null; 
                alert(`La imagen para la parte '${partInfo.name}' no está cargada. No se puede seleccionar.`);
                console.warn(`Cannot select part ${partInfo.name}, image not loaded from cache.`);
            }
        });
        paletteElement.appendChild(imgElement);
    });
}


function setupGrid() {
    grid = Array(gridSize.rows).fill(null).map(() => Array(gridSize.cols).fill(null));
    debugCellPathToDraw = null; // <<<< NEW: Clear debug path
    if (editorCanvas) {
        editorCanvas.width = gridSize.cols * TRACK_PART_SIZE_PX;
        editorCanvas.height = gridSize.rows * TRACK_PART_SIZE_PX;
         if (ctx) {
            renderEditor();
        }
    }
}

function renderEditor() {
    if (!ctx || !editorCanvas || editorCanvas.width === 0 || editorCanvas.height === 0) return;
    ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,editorCanvas.width, editorCanvas.height);

    // Draw empty grid cells
    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            const x_topLeft = c * TRACK_PART_SIZE_PX;
            const y_topLeft = r * TRACK_PART_SIZE_PX;
            // Only draw placed track parts if not in debug path mode OR if grid parts are actually there
            if (grid[r][c] && grid[r][c].image && !debugCellPathToDraw) { // Modified condition
                const x_center = c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                const y_center = r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                ctx.save();
                ctx.translate(x_center, y_center);
                ctx.rotate(grid[r][c].rotation_deg * Math.PI / 180);
                ctx.drawImage(grid[r][c].image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                ctx.restore();
            } else { // Always draw empty grid lines
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 1;
                ctx.strokeRect(x_topLeft, y_topLeft, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
            }
        }
    }

    // <<<< NEW: Draw debug path if it exists >>>>
    if (debugCellPathToDraw && debugCellPathToDraw.length > 0) {
        console.log("Rendering debug path:", debugCellPathToDraw);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // Red for path
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        for (let i = 0; i < debugCellPathToDraw.length; i++) {
            const cell = debugCellPathToDraw[i];
            const x = cell.c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
            const y = cell.r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
            if (i === 0) {
                ctx.moveTo(x, y);
                // Mark start
                ctx.fillStyle = 'rgba(0, 255, 0, 0.7)'; // Green start
                ctx.fillRect(x - 10, y - 10, 20, 20);

            } else {
                ctx.lineTo(x, y);
            }
            // Mark each cell in path
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; 
            ctx.fillRect(cell.c * TRACK_PART_SIZE_PX + 5, cell.r * TRACK_PART_SIZE_PX + 5, TRACK_PART_SIZE_PX - 10, TRACK_PART_SIZE_PX - 10);

        }
        ctx.stroke();

        // Mark end if it's different from start (or even if it's the same for a loop)
        if (debugCellPathToDraw.length > 0) {
            const endCell = debugCellPathToDraw[debugCellPathToDraw.length -1];
            const endX = endCell.c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
            const endY = endCell.r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
            ctx.fillStyle = 'rgba(0, 0, 255, 0.7)'; // Blue end
            ctx.beginPath();
            ctx.arc(endX, endY, 10, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    if (AVAILABLE_TRACK_PARTS.length === 0 && editorCanvas && editorCanvas.width > 0) {
         ctx.fillStyle = "rgba(0,0,0,0.7)";
         ctx.font = "bold 16px Arial";
         ctx.textAlign = "center";
         ctx.fillText("No hay partes de pista definidas en config.js", editorCanvas.width / 2, editorCanvas.height/2);
    }
}

function onGridSingleClick(event) {
    // For this debug mode, placing parts manually might be confusing.
    // We can disable it or let it work as before, knowing the debug path is separate.
    // Let's keep it for now.
    if (!selectedTrackPart || !selectedTrackPart.image) {
        return;
    }
    if (!editorCanvas) return;
    debugCellPathToDraw = null; // Clear debug path if user starts placing manually

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
    // ... (same as before, this will rotate parts if any are in `grid`) ...
    if (!editorCanvas) return;
    debugCellPathToDraw = null; // Clear debug path if user starts editing manually

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

function getRotatedConnections(part, rotation_deg) {
    // ... (same as before) ...
    if (!part || !part.connections) {
        return {};
    }
    const rotated = {};
    const numRotations = Math.round(rotation_deg / 90); 

    for (const dirKey in part.connections) {
        if (part.connections[dirKey]) {
            let currentDirIndex = DIRECTIONS.findIndex(d => d.name === dirKey);
            if (currentDirIndex === -1) {
                console.error(`Invalid direction key '${dirKey}' in part connections for ${part.name}. Check config.js.`);
                continue;
            }
            let newDirIndex = (currentDirIndex + numRotations) % 4;
            rotated[DIRECTIONS[newDirIndex].name] = true;
        }
    }
    return rotated;
}

function generateRandomTrackWithRetry(maxRetries = 10) { 
    console.log("generateRandomTrackWithRetry CALLED for Predefined Path track. maxRetries:", maxRetries);
    for (let i = 0; i < maxRetries; i++) {
        console.log(`--- generateRandomTrackWithRetry: Attempt ${i + 1} / ${maxRetries} calling generateRandomLoopTrack ---`);
        if (generateRandomLoopTrack()) { 
            console.log(`Random Predefined Path track generated successfully on attempt ${i + 1}`);
            return;
        }
        console.log(`generateRandomLoopTrack attempt ${i + 1} returned false. Retrying...`);
    }
    alert("No se pudo generar una pista en bucle después de varios intentos. Verifica las partes de pista disponibles o el tamaño de la cuadrícula.");
    setupGrid(); // This will clear the debug path
    // renderEditor(); // setupGrid calls renderEditor
}

function getDirectionFromTo(r1, c1, r2, c2) {
    // ... (same as before) ...
    const dr = r2 - r1;
    const dc = c2 - c1;
    for (const dir of DIRECTIONS) {
        if (dir.dr === dr && dir.dc === dc) {
            return dir.name;
        }
    }
    return null; 
}

function generateCellPathAndConnections() {
    // ... (same as previous version - the "Path First" version) ...
    console.log("--- Attempting to generate a cell path ---");
    let path = [];
    let visitedOnPath = new Set(); 
    const minPathLength = Math.max(4, Math.floor((gridSize.rows * gridSize.cols) * 0.40)); 
    const maxPathLength = Math.floor((gridSize.rows * gridSize.cols) * 0.90); 

    let startR = Math.floor(Math.random() * gridSize.rows);
    let startC = Math.floor(Math.random() * gridSize.cols);
    let currentR = startR;
    let currentC = startC;

    path.push({ r: currentR, c: currentC });
    visitedOnPath.add(`${currentR},${currentC}`);

    let stuckCounter = 0; 

    for (let k = 0; k < maxPathLength * 2 && path.length < maxPathLength; k++) {
        const shuffledDirections = [...DIRECTIONS].sort(() => 0.5 - Math.random());
        let moved = false;
        for (const dir of shuffledDirections) {
            const nextR = currentR + dir.dr;
            const nextC = currentC + dir.dc;

            if (nextR >= 0 && nextR < gridSize.rows &&
                nextC >= 0 && nextC < gridSize.cols &&
                !visitedOnPath.has(`${nextR},${nextC}`)) {
                
                if (path.length < minPathLength / 2) {
                    let isEdgeMove = (nextR === 0 || nextR === gridSize.rows - 1 || nextC === 0 || nextC === gridSize.cols - 1);
                    if (isEdgeMove && shuffledDirections.length > 1 && Math.random() < 0.6) { 
                       continue;
                    }
                }

                currentR = nextR;
                currentC = nextC;
                path.push({ r: currentR, c: currentC });
                visitedOnPath.add(`${currentR},${currentC}`);
                moved = true;
                stuckCounter = 0; 
                break;
            }
        }
        if (!moved) {
            stuckCounter++;
            if (stuckCounter > 5 && path.length >=minPathLength) break; 
            if (stuckCounter > 10) break; 

            if (path.length > 1) {
                visitedOnPath.delete(`${currentR},${currentC}`); 
                path.pop();
                currentR = path[path.length - 1].r;
                currentC = path[path.length - 1].c;
            } else {
                break; 
            }
        }
         if (path.length >= maxPathLength) break;
    }

    let loopClosed = false;
    if (path.length >= minPathLength -1 ) { 
        for (const dir of DIRECTIONS) {
            if (currentR + dir.dr === startR && currentC + dir.dc === startC) {
                path.push({ r: startR, c: startC }); 
                loopClosed = true;
                console.log("Path successfully looped back to start cell.");
                break;
            }
        }
    }

    if (!loopClosed || path.length < minPathLength) {
        console.warn(`Generated path did not close or was too short (Length: ${path.length}). Path:`, path.map(p=>`[${p.r},${p.c}]`));
        return null; 
    }

    console.log("Generated cell path (length " + path.length + "):", path.map(p => `[${p.r},${p.c}]`));

    // For debug visualization, we just need the path of cells {r, c}
    // The part that calculates `pathWithConnections` can be skipped for this specific debug step,
    // or we can return the simple path directly.
    // Let's return the simple path for visualization for now.
    return path; // <<<< MODIFIED: Return simple path for drawing
}


function generateRandomLoopTrack() {
    // <<<< MODIFIED for Path Visualization >>>>
    setupGrid(); // Clears grid and debugCellPathToDraw
    console.log(`--- Starting Path Visualization (Grid: ${gridSize.rows}x${gridSize.cols}) ---`);

    const cellPath = generateCellPathAndConnections();

    if (!cellPath || cellPath.length === 0) {
        console.error("Failed to generate a valid cell path for visualization.");
        renderEditor(); 
        return false; // Indicate failure
    }

    debugCellPathToDraw = cellPath; // Store for rendering
    grid = Array(gridSize.rows).fill(null).map(() => Array(gridSize.cols).fill(null)); // Ensure grid is empty
    renderEditor(); // This will now draw the grid and the debug path

    // For this debug step, success is just generating a path to visualize
    return true; 
}


function validateTrack() {
    // ... (same as before)
    let partCount = 0;
    let danglingConnections = 0;
    let connectionMismatches = 0;

    for (let r_idx = 0; r_idx < gridSize.rows; r_idx++) { 
        for (let c_idx = 0; c_idx < gridSize.cols; c_idx++) { 
            const currentPart = grid[r_idx][c_idx];
            if (currentPart) {
                partCount++;
                const currentConnections = getRotatedConnections(currentPart, currentPart.rotation_deg);

                for (const dir of DIRECTIONS) {
                    if (currentConnections[dir.name]) {
                        const nextR = r_idx + dir.dr;
                        const nextC = c_idx + dir.dc;

                        if (nextR < 0 || nextR >= gridSize.rows || nextC < 0 || nextC >= gridSize.cols) {
                            danglingConnections++;
                        } else {
                            const neighborPart = grid[nextR][nextC];
                            if (!neighborPart) {
                                danglingConnections++;
                            } else {
                                const neighborConnections = getRotatedConnections(neighborPart, neighborPart.rotation_deg);
                                const requiredFromNeighbor = OPPOSITE_DIRECTIONS[dir.name];
                                if (!neighborConnections[requiredFromNeighbor]) {
                                    connectionMismatches++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (partCount === 0 && !debugCellPathToDraw) { // Modified condition for debug
        alert("Validación: La pista está vacía.");
        return false;
    }
    if (connectionMismatches > 0) {
        console.warn(`Validación: Encontradas ${connectionMismatches / 2} conexiones incompatibles.`);
    }
    if (danglingConnections > 0 && partCount > 1 && connectionMismatches === 0) { 
         console.warn(`Validación: Encontradas ${danglingConnections} conexiones abiertas/colgando. Un bucle perfecto no debería tener ninguna.`);
    }
    console.log(`Validación básica: Partes=${partCount}, Incompatibles=${connectionMismatches}, Abiertas=${danglingConnections}`);
    if (partCount > 0 || debugCellPathToDraw) return true; // Modified for debug
    return false;
}

function saveTrackDesign() {
    // ... (same as before)
    const { trackEditorTrackName } = getDOMElements();
    const trackName = trackEditorTrackName.value.trim() || "MiPistaEditada";
    const designData = { gridSize: { ...gridSize }, gridParts: [] };
    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            if (grid[r][c] && grid[r][c].file) {
                designData.gridParts.push({ r: r, c: c, partFile: grid[r][c].file, rotation: grid[r][c].rotation_deg });
            }
        }
    }
    if (designData.gridParts.length === 0) { alert("La pista está vacía. No hay nada que guardar."); return; }
    const jsonData = JSON.stringify(designData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${trackName}.trackdesign.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function loadTrackDesign(event) {
    // ... (same as before)
    debugCellPathToDraw = null; // Clear debug path on load
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const designData = JSON.parse(e.target.result);
            if (!designData.gridSize || !designData.gridParts) throw new Error("Formato de archivo de diseño de pista inválido.");
            gridSize.rows = designData.gridSize.rows || 4; gridSize.cols = designData.gridSize.cols || 4;
            const { trackGridSize, trackEditorTrackName } = getDOMElements();
            if (trackGridSize) trackGridSize.value = `${gridSize.rows}x${gridSize.cols}`;
            setupGrid(); // Will clear debug path
            designData.gridParts.forEach(partData => {
                if (partData.r < gridSize.rows && partData.c < gridSize.cols) {
                    const originalPartInfo = AVAILABLE_TRACK_PARTS.find(p => p.file === partData.partFile);
                    const partImage = trackPartsImages[partData.partFile];
                    if (originalPartInfo && partImage) {
                        grid[partData.r][partData.c] = { ...originalPartInfo, image: partImage, rotation_deg: partData.rotation || 0 };
                    } else console.warn(`Parte de pista no encontrada o imagen no cargada: ${partData.partFile} en celda [${partData.r}, ${partData.c}]`);
                } else console.warn(`Parte de pista fuera de los límites del grid actual: ${partData.partFile} en celda [${partData.r}, ${partData.c}]`);
            });
            renderEditor();
            alert(`Diseño de pista "${file.name}" cargado.`);
            if(trackEditorTrackName) {
                let fileNameWithoutExt = file.name.replace(/\.trackdesign\.json$|\.json$|\.txt$/i, '');
                trackEditorTrackName.value = fileNameWithoutExt || "PistaCargada";
            }
        } catch (error) { console.error("Error al cargar o parsear el diseño de pista:", error); alert(`Error al cargar el diseño: ${error.message}`);}
    };
    reader.onerror = () => { alert("Error al leer el archivo de diseño de pista."); };
    reader.readAsText(file);
    event.target.value = null;
}

function exportTrackAsCanvas() {
    // ... (same as before)
    if (gridSize.rows === 0 || gridSize.cols === 0) { alert("Grid size is invalid."); return null; }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gridSize.cols * TRACK_PART_SIZE_PX;
    exportCanvas.height = gridSize.rows * TRACK_PART_SIZE_PX;
    if (exportCanvas.width === 0 || exportCanvas.height === 0) { alert("Cannot export an empty track (0 width or height)."); return null; }
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = 'white'; exportCtx.fillRect(0,0, exportCanvas.width, exportCanvas.height);
    let hasContent = false;
    for (let r_idx = 0; r_idx < gridSize.rows; r_idx++) { 
        for (let c_idx = 0; c_idx < gridSize.cols; c_idx++) { 
            if (grid[r_idx][c_idx] && grid[r_idx][c_idx].image) {
                hasContent = true; const part = grid[r_idx][c_idx];
                const x_center = c_idx * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                const y_center = r_idx * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                exportCtx.save(); exportCtx.translate(x_center, y_center); exportCtx.rotate(part.rotation_deg * Math.PI / 180);
                exportCtx.drawImage(part.image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                exportCtx.restore();
            }
        }
    }
    if (!hasContent) { alert("El editor de pistas está vacío. Añade algunas partes."); return null;}
    return exportCanvas;
}
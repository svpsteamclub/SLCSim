// js/trackEditor.js
import { getDOMElements } from './ui.js';
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js';


let editorCanvas, ctx;
let grid = [];
let gridSize = { rows: 4, cols: 4 }; 
let trackPartsImages = {};
let selectedTrackPart = null;
let isEraseModeActive = false; 
let lastGeneratedTrackStartPosition = null; 

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
        setupGrid();
        renderEditor();
    });

    elems.trackGridSize.addEventListener('change', (e) => {
        const size = e.target.value.split('x');
        gridSize = { rows: parseInt(size[0]), cols: parseInt(size[1]) };
        lastGeneratedTrackStartPosition = null; 
        setupGrid();
        renderEditor();
    });

    elems.generateRandomTrack.addEventListener('click', () => { 
        lastGeneratedTrackStartPosition = null; 
        if (isEraseModeActive) toggleEraseMode(); 
        generateRandomTrackWithRetry(); 
    });
    
    elems.toggleEraseModeButton.addEventListener('click', toggleEraseMode); 

    elems.exportTrackFromEditor.addEventListener('click', () => {
        if (isEraseModeActive) toggleEraseMode(); // Exit erase mode before export
        if (!validateTrack()) { 
            if (!confirm("La pista puede tener problemas (desconexiones o callejones sin salida). ¿Exportar de todos modos?")) {
                return;
            }
        }
        const trackCanvas = exportTrackAsCanvas();
        if (trackCanvas) {
            let startX_m, startY_m, startAngle_rad;
            if (lastGeneratedTrackStartPosition) {
                startX_m = (lastGeneratedTrackStartPosition.c + 0.5) * TRACK_PART_SIZE_PX / PIXELS_PER_METER;
                startY_m = (lastGeneratedTrackStartPosition.r + 0.5) * TRACK_PART_SIZE_PX / PIXELS_PER_METER;
                startAngle_rad = lastGeneratedTrackStartPosition.angle_rad;
                console.log("Using generated start position for export:", lastGeneratedTrackStartPosition);
            } else {
                startX_m = (TRACK_PART_SIZE_PX / 2) / PIXELS_PER_METER;
                startY_m = (TRACK_PART_SIZE_PX / 2) / PIXELS_PER_METER;
                startAngle_rad = 0;
                alert("Usando posición inicial por defecto. Puede que necesites ajustarla en el simulador.");
                console.log("Using default start position for export.");
            }

            mainAppInterface.loadTrackFromEditorCanvas(trackCanvas, startX_m, startY_m, startAngle_rad);
            alert("Pista del editor cargada en el simulador.");

            const simulatorTabButton = document.querySelector('.tab-button[data-tab="simulator"]');
            if (simulatorTabButton) simulatorTabButton.click();
        }
    });

    elems.saveTrackDesignButton.addEventListener('click', saveTrackDesign);
    elems.loadTrackDesignInput.addEventListener('change', (event) => {
        lastGeneratedTrackStartPosition = null; 
        if (isEraseModeActive) toggleEraseMode();
        loadTrackDesign(event);
    });

    editorCanvas.addEventListener('click', (event) => {
        if (!isEraseModeActive) lastGeneratedTrackStartPosition = null; 
        onGridSingleClick(event);
    });
    editorCanvas.addEventListener('dblclick', (event) => {
        if (!isEraseModeActive) lastGeneratedTrackStartPosition = null; 
        if(isEraseModeActive) return; 
        onGridDoubleClick(event);
    });
}

function loadTrackPartAssets(callback) {
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
        } else {
            imgElement.alt = partInfo.name;
        }
        imgElement.title = partInfo.name;
        imgElement.dataset.partFile = partInfo.file;
        imgElement.addEventListener('click', () => {
            if (isEraseModeActive) toggleEraseMode(); // Exit erase mode if selecting a part
            document.querySelectorAll('#trackPartsPalette img').forEach(p => p.classList.remove('selected'));
            imgElement.classList.add('selected');
            if (trackPartsImages[partInfo.file]) { 
                 selectedTrackPart = { ...partInfo, image: trackPartsImages[partInfo.file] };
            } else {
                selectedTrackPart = null; 
                alert(`La imagen para la parte '${partInfo.name}' no está cargada. No se puede seleccionar.`);
            }
        });
        paletteElement.appendChild(imgElement);
    });
}

function setupGrid() {
    grid = Array(gridSize.rows).fill(null).map(() => Array(gridSize.cols).fill(null));
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

    const connIndicatorSize = 8; 
    const connIndicatorOffset = 3; 

    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            const x_topLeft = c * TRACK_PART_SIZE_PX;
            const y_topLeft = r * TRACK_PART_SIZE_PX;
            const x_center = x_topLeft + TRACK_PART_SIZE_PX / 2;
            const y_center = y_topLeft + TRACK_PART_SIZE_PX / 2;

            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            ctx.strokeRect(x_topLeft, y_topLeft, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);

            const currentGridPart = grid[r][c]; 

            if (currentGridPart && currentGridPart.image) {
                ctx.save();
                ctx.translate(x_center, y_center);
                ctx.rotate(currentGridPart.rotation_deg * Math.PI / 180);
                ctx.drawImage(currentGridPart.image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                ctx.restore();

                const actualConns = getRotatedConnections(currentGridPart, currentGridPart.rotation_deg);
                
                ctx.fillStyle = actualConns.N ? 'green' : 'rgba(180,0,0,0.5)'; 
                ctx.fillRect(x_center - connIndicatorSize / 2, y_topLeft + connIndicatorOffset, connIndicatorSize, connIndicatorSize);
                
                ctx.fillStyle = actualConns.E ? 'green' : 'rgba(180,0,0,0.5)';
                ctx.fillRect(x_topLeft + TRACK_PART_SIZE_PX - connIndicatorOffset - connIndicatorSize, y_center - connIndicatorSize / 2, connIndicatorSize, connIndicatorSize);
                
                ctx.fillStyle = actualConns.S ? 'green' : 'rgba(180,0,0,0.5)';
                ctx.fillRect(x_center - connIndicatorSize / 2, y_topLeft + TRACK_PART_SIZE_PX - connIndicatorOffset - connIndicatorSize, connIndicatorSize, connIndicatorSize);
                
                ctx.fillStyle = actualConns.W ? 'green' : 'rgba(180,0,0,0.5)';
                ctx.fillRect(x_topLeft + connIndicatorOffset, y_center - connIndicatorSize / 2, connIndicatorSize, connIndicatorSize);
            }
        }
    }
    if (AVAILABLE_TRACK_PARTS.length === 0 && editorCanvas && editorCanvas.width > 0) {
         ctx.fillStyle = "rgba(0,0,0,0.7)";
         ctx.font = "bold 16px Arial";
         ctx.textAlign = "center";
         ctx.fillText("No hay partes de pista definidas en config.js", editorCanvas.width / 2, editorCanvas.height/2);
    }
}

function toggleEraseMode() {
    isEraseModeActive = !isEraseModeActive;
    const elems = getDOMElements();
    if (isEraseModeActive) {
        elems.toggleEraseModeButton.textContent = "Desactivar Modo Borrar";
        elems.toggleEraseModeButton.style.backgroundColor = "#d9534f"; 
        elems.toggleEraseModeButton.style.borderColor = "#d43f3a";
        
        const paletteImages = document.querySelectorAll('#trackPartsPalette img');
        paletteImages.forEach(pImg => pImg.classList.remove('selected'));
        selectedTrackPart = null;
        
        editorCanvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"%23cc0000\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><line x1=\\"18\\" y1=\\"6\\" x2=\\"6\\" y2=\\"18\\"></line><line x1=\\"6\\" y1=\\"6\\" x2=\\"18\\" y2=\\"18\\"></line></svg>") 12 12, auto'; 
        console.log("Erase Mode ACTIVATED");
    } else {
        elems.toggleEraseModeButton.textContent = "Activar Modo Borrar";
        elems.toggleEraseModeButton.style.backgroundColor = ""; 
        elems.toggleEraseModeButton.style.borderColor = "";   
        editorCanvas.style.cursor = 'crosshair'; 
        console.log("Erase Mode DEACTIVATED");
    }
}

function onGridSingleClick(event) {
    if (!editorCanvas) return;

    const rect = editorCanvas.getBoundingClientRect();
    const x_canvas = event.clientX - rect.left;
    const y_canvas = event.clientY - rect.top;

    const c = Math.floor(x_canvas / TRACK_PART_SIZE_PX);
    const r = Math.floor(y_canvas / TRACK_PART_SIZE_PX);

    if (r >= 0 && r < gridSize.rows && c >= 0 && c < gridSize.cols) {
        if (isEraseModeActive) {
            if (grid[r][c]) {
                grid[r][c] = null; 
                renderEditor();
                // console.log(`Erased part at [${r},${c}]`);
            }
        } else { 
            if (!selectedTrackPart || !selectedTrackPart.image) {
                return; 
            }
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
}

function onGridDoubleClick(event) {
    if (isEraseModeActive) return; // Do nothing if in erase mode
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

function getRotatedConnections(part, rotation_deg) {
    // ... (same as before) ...
    if (!part || !part.connections) { return {}; }
    const rotated = {};
    const numRotations = Math.round(rotation_deg / 90);
    for (const dirKey in part.connections) {
        if (part.connections[dirKey]) {
            let currentDirIndex = DIRECTIONS.findIndex(d => d.name === dirKey);
            if (currentDirIndex === -1) { console.error(`Invalid dir key '${dirKey}' for ${part.name}.`); continue; }
            let newDirIndex = (currentDirIndex + numRotations) % 4;
            rotated[DIRECTIONS[newDirIndex].name] = true;
        }
    }
    return rotated;
}

function generateRandomTrackWithRetry(maxRetries = 30) {
    console.log("generateRandomTrackWithRetry CALLED for Path First track. maxRetries:", maxRetries);
    for (let i = 0; i < maxRetries; i++) {
        console.log(`--- Attempt ${i + 1} / ${maxRetries} calling generateRandomLoopTrack ---`);
        const generationResult = generateRandomLoopTrack();
        if (generationResult.success) {
            lastGeneratedTrackStartPosition = generationResult.startPosition;
            console.log(`Random track generated successfully on attempt ${i + 1}`);
            return;
        }
        console.log(`generateRandomLoopTrack attempt ${i + 1} returned false. Retrying...`);
    }
    alert("No se pudo generar una pista en bucle después de varios intentos.");
    lastGeneratedTrackStartPosition = null;
    setupGrid();
}

function getDirectionFromTo(r1, c1, r2, c2) {
    // ... (same as before) ...
    const dr = r2 - r1; const dc = c2 - c1;
    for (const dir of DIRECTIONS) { if (dir.dr === dr && dir.dc === dc) return dir.name; }
    return null;
}

function generateCellPathAndConnections() {
    // ... (same "Path First" version as last complete file) ...
    console.log("--- Attempting to generate a cell path ---");
    let path = []; let visitedOnPath = new Set(); 
    const minPathLength = Math.max(4, Math.floor((gridSize.rows * gridSize.cols) * 0.40)); 
    const maxPathLength = Math.floor((gridSize.rows * gridSize.cols) * 0.90); 
    let startR = Math.floor(Math.random() * gridSize.rows);
    let startC = Math.floor(Math.random() * gridSize.cols);
    let currentR = startR; let currentC = startC;
    path.push({ r: currentR, c: currentC }); visitedOnPath.add(`${currentR},${currentC}`);
    let stuckCounter = 0; 
    for (let k = 0; k < maxPathLength * 2 && path.length < maxPathLength; k++) {
        const shuffledDirections = [...DIRECTIONS].sort(() => 0.5 - Math.random());
        let moved = false;
        for (const dir of shuffledDirections) {
            const nextR = currentR + dir.dr; const nextC = currentC + dir.dc;
            if (nextR >= 0 && nextR < gridSize.rows && nextC >= 0 && nextC < gridSize.cols && !visitedOnPath.has(`${nextR},${nextC}`)) {
                if (path.length < minPathLength / 2) {
                    let isEdgeMove = (nextR === 0 || nextR === gridSize.rows - 1 || nextC === 0 || nextC === gridSize.cols - 1);
                    if (isEdgeMove && shuffledDirections.length > 1 && Math.random() < 0.6) { continue; }
                }
                currentR = nextR; currentC = nextC;
                path.push({ r: currentR, c: currentC }); visitedOnPath.add(`${currentR},${currentC}`);
                moved = true; stuckCounter = 0; break;
            }
        }
        if (!moved) {
            stuckCounter++;
            if (stuckCounter > 5 && path.length >=minPathLength) break; 
            if (stuckCounter > 10) break; 
            if (path.length > 1) {
                visitedOnPath.delete(`${currentR},${currentC}`); path.pop();
                currentR = path[path.length - 1].r; currentC = path[path.length - 1].c;
            } else { break; }
        }
         if (path.length >= maxPathLength) break;
    }
    let loopClosed = false;
    if (path.length >= minPathLength -1 ) { 
        for (const dir of DIRECTIONS) {
            if (currentR + dir.dr === startR && currentC + dir.dc === startC) {
                path.push({ r: startR, c: startC }); 
                loopClosed = true; console.log("Path successfully looped back to start cell."); break;
            }
        }
    }
    if (!loopClosed || path.length < minPathLength) {
        console.warn(`Generated path did not close or was too short (Length: ${path.length}).`);
        return null; 
    }
    // console.log("Generated cell path (length " + path.length + "):", path.map(p => `[${p.r},${p.c}]`));
    const pathWithConnections = [];
    for (let i = 0; i < path.length - 1; i++) { 
        const cell = path[i];
        const prevCellInLogic = (i === 0) ? path[path.length - 2] : path[i - 1]; 
        const nextCellInLogic = path[i + 1];
        const dirFromPrevToCell = getDirectionFromTo(prevCellInLogic.r, prevCellInLogic.c, cell.r, cell.c);
        const dirFromCellToNext = getDirectionFromTo(cell.r, cell.c, nextCellInLogic.r, nextCellInLogic.c);
        if (!dirFromPrevToCell || !dirFromCellToNext) {
            console.error("Error determining directions for path connections.", {i, cell, prevCellInLogic, nextCellInLogic, dirFromPrevToCell, dirFromCellToNext});
            return null; 
        }
        pathWithConnections.push({
            r: cell.r, c: cell.c,
            connections: { [OPPOSITE_DIRECTIONS[dirFromPrevToCell]]: true, [dirFromCellToNext]: true }
        });
    }
    // console.log("Path with required connections:", JSON.parse(JSON.stringify(pathWithConnections)));
    return pathWithConnections;
}

function generateRandomLoopTrack() {
    // ... (same "Path First" logic as last version, including detailed logs for part placement) ...
    setupGrid(); 
    // console.log(`--- Starting Random Loop Track Generation (Path First) (Grid: ${gridSize.rows}x${gridSize.cols}) ---`);
    const loopParts = AVAILABLE_TRACK_PARTS.filter(p => {
        if (!p.connections) return false;
        return Object.values(p.connections).filter(conn => conn === true).length === 2;
    });
    if (loopParts.length === 0) {
        alert("No hay partes de pista adecuadas (con exactamente 2 conexiones) en config.js para generar un bucle.");
        renderEditor(); return { success: false, startPosition: null };
    }
    const cellPathWithConnections = generateCellPathAndConnections();
    if (!cellPathWithConnections || cellPathWithConnections.length === 0) {
        console.error("Failed to generate a valid cell path for the loop.");
        renderEditor(); return { success: false, startPosition: null };
    }
    let allPartsPlaced = true; let placedCount = 0;
    let rectaSegments = [];
    for (const cellInfo of cellPathWithConnections) {
        const r = cellInfo.r; const c = cellInfo.c; const requiredConns = cellInfo.connections;
        // console.log(`Attempting to fill cell [${r},${c}]. Required connections: ${JSON.stringify(requiredConns)}`); 
        let placedPiece = false;
        const shuffledLoopParts = [...loopParts].sort(() => 0.5 - Math.random());
        for (const partDef of shuffledLoopParts) {
            if (!trackPartsImages[partDef.file]) { /*console.warn(`  Skipping part ${partDef.name}: Image for ${partDef.file} not loaded.`);*/ continue; }
            const shuffledRotations = [0, 90, 180, 270].sort(() => 0.5 - Math.random());
            for (const rot of shuffledRotations) {
                const actualConns = getRotatedConnections(partDef, rot); let match = true;
                if (Object.keys(actualConns).length !== 2 || Object.keys(requiredConns).length !== 2) { match = false; }
                else { for (const reqDir in requiredConns) { if (!actualConns[reqDir]) { match = false; break; } } }
                // console.log(`  Trying Part: ${partDef.name}, Rot: ${rot} deg. Actual Conns: ${JSON.stringify(actualConns)}. Match? ${match}`);
                if (match) {
                    grid[r][c] = { ...partDef, image: trackPartsImages[partDef.file], rotation_deg: rot };
                    // console.log(`    >>> PLACED ${partDef.name} (rot ${rot} deg) in [${r},${c}] with connections ${JSON.stringify(actualConns)}`);
                    if (partDef.name.toLowerCase().includes("recta")) { rectaSegments.push({ r, c, rotation_deg: rot }); }
                    placedPiece = true; placedCount++; break; 
                }
            }
            if (placedPiece) break; 
        }
        if (!placedPiece) { console.error(`===> FAILURE: Could not find ANY suitable part to fit required connections ${JSON.stringify(requiredConns)} at cell [${r},${c}]`); allPartsPlaced = false; }
    }
    renderEditor(); 
    if (!allPartsPlaced) { console.warn("Not all parts in generated path could be filled."); }
    let foundStartPosition = null;
    if (allPartsPlaced && rectaSegments.length > 0) {
        const randomRecta = rectaSegments[Math.floor(Math.random() * rectaSegments.length)];
        let angle_rad = 0;
        if (randomRecta.rotation_deg === 0) angle_rad = -Math.PI / 2; 
        else if (randomRecta.rotation_deg === 90) angle_rad = 0;          
        else if (randomRecta.rotation_deg === 180) angle_rad = Math.PI / 2; 
        else if (randomRecta.rotation_deg === 270) angle_rad = Math.PI;   
        foundStartPosition = { r: randomRecta.r, c: randomRecta.c, angle_rad: angle_rad };
    } else if (allPartsPlaced && cellPathWithConnections.length > 0) {
        const firstPathCell = cellPathWithConnections[0];
        const firstPart = grid[firstPathCell.r][firstPathCell.c];
        let angle_rad = 0; if (firstPart) { const conns = getRotatedConnections(firstPart, firstPart.rotation_deg);
            if (conns.S) angle_rad = -Math.PI / 2; else if (conns.E) angle_rad = 0; 
            else if (conns.N) angle_rad = Math.PI / 2; else if (conns.W) angle_rad = Math.PI; }
        foundStartPosition = { r: firstPathCell.r, c: firstPathCell.c, angle_rad: angle_rad };
    }
    const success = allPartsPlaced && cellPathWithConnections.length > 0 && placedCount === cellPathWithConnections.length;
    return { success: success, startPosition: success ? foundStartPosition : null };
}


function validateTrack() {
    // ... (same as before)
    let partCount = 0; let danglingConnections = 0; let connectionMismatches = 0;
    for (let r_idx = 0; r_idx < gridSize.rows; r_idx++) { 
        for (let c_idx = 0; c_idx < gridSize.cols; c_idx++) { 
            const currentPart = grid[r_idx][c_idx];
            if (currentPart) {
                partCount++; const currentConnections = getRotatedConnections(currentPart, currentPart.rotation_deg);
                for (const dir of DIRECTIONS) {
                    if (currentConnections[dir.name]) {
                        const nextR = r_idx + dir.dr; const nextC = c_idx + dir.dc;
                        if (nextR < 0 || nextR >= gridSize.rows || nextC < 0 || nextC >= gridSize.cols) { danglingConnections++; }
                        else { const neighborPart = grid[nextR][nextC];
                            if (!neighborPart) { danglingConnections++; }
                            else { const neighborConnections = getRotatedConnections(neighborPart, neighborPart.rotation_deg);
                                const requiredFromNeighbor = OPPOSITE_DIRECTIONS[dir.name];
                                if (!neighborConnections[requiredFromNeighbor]) { connectionMismatches++; }
                            }
                        }
                    }
                }
            }
        }
    }
    if (partCount === 0) { alert("Validación: La pista está vacía."); return false; }
    if (connectionMismatches > 0) { console.warn(`Validación: Encontradas ${connectionMismatches / 2} conexiones incompatibles.`); }
    if (danglingConnections > 0 && partCount > 1 && connectionMismatches === 0) { console.warn(`Validación: Encontradas ${danglingConnections} conexiones abiertas/colgando.`); }
    console.log(`Validación básica: Partes=${partCount}, Incompatibles=${connectionMismatches}, Abiertas=${danglingConnections}`);
    if (partCount > 0) return true; return false;
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
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const designData = JSON.parse(e.target.result);
            if (!designData.gridSize || !designData.gridParts) throw new Error("Formato de archivo de diseño de pista inválido.");
            gridSize.rows = designData.gridSize.rows || 4; gridSize.cols = designData.gridSize.cols || 4;
            const { trackGridSize, trackEditorTrackName } = getDOMElements();
            if (trackGridSize) trackGridSize.value = `${gridSize.rows}x${gridSize.cols}`;
            setupGrid(); 
            designData.gridParts.forEach(partData => {
                if (partData.r < gridSize.rows && partData.c < gridSize.cols) {
                    const originalPartInfo = AVAILABLE_TRACK_PARTS.find(p => p.file === partData.partFile);
                    const partImage = trackPartsImages[partData.partFile];
                    if (originalPartInfo && partImage) {
                        grid[partData.r][partData.c] = { ...originalPartInfo, image: partImage, rotation_deg: partData.rotation || 0 };
                    } else console.warn(`Parte de pista no encontrada: ${partData.partFile} en [${partData.r},${partData.c}]`);
                } else console.warn(`Parte fuera de límites: ${partData.partFile} en [${partData.r},${partData.c}]`);
            });
            renderEditor(); alert(`Diseño "${file.name}" cargado.`);
            if(trackEditorTrackName) {
                let fName = file.name.replace(/\.trackdesign\.json$|\.json$|\.txt$/i, '');
                trackEditorTrackName.value = fName || "PistaCargada";
            }
        } catch (error) { console.error("Error al cargar:", error); alert(`Error: ${error.message}`);}
    };
    reader.onerror = () => { alert("Error al leer archivo."); };
    reader.readAsText(file); event.target.value = null;
}

function exportTrackAsCanvas() {
    // ... (same as before)
    if (gridSize.rows === 0 || gridSize.cols === 0) { alert("Grid size is invalid."); return null; }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gridSize.cols * TRACK_PART_SIZE_PX; exportCanvas.height = gridSize.rows * TRACK_PART_SIZE_PX;
    if (exportCanvas.width === 0 || exportCanvas.height === 0) { alert("Cannot export empty track."); return null; }
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = 'white'; exportCtx.fillRect(0,0, exportCanvas.width, exportCanvas.height);
    let hasContent = false;
    for (let r_idx = 0; r_idx < gridSize.rows; r_idx++) { 
        for (let c_idx = 0; c_idx < gridSize.cols; c_idx++) { 
            if (grid[r_idx][c_idx] && grid[r_idx][c_idx].image) {
                hasContent = true; const part = grid[r_idx][c_idx];
                const x_center = c_idx*TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX/2; const y_center = r_idx*TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX/2;
                exportCtx.save(); exportCtx.translate(x_center, y_center); exportCtx.rotate(part.rotation_deg*Math.PI/180);
                exportCtx.drawImage(part.image, -TRACK_PART_SIZE_PX/2, -TRACK_PART_SIZE_PX/2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                exportCtx.restore();
            }
        }
    }
    if (!hasContent) { alert("El editor de pistas está vacío."); return null;}
    return exportCanvas;
}
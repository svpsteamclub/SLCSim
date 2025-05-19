// js/trackEditor.js
import { getDOMElements } from './ui.js';
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js';


let editorCanvas, ctx;
let grid = [];
let gridSize = { rows: 4, cols: 4 }; // Default to 4x4 to match HTML selected
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
        setupGrid(); // setupGrid will use the gridSize set above
        renderEditor();
    });

    elems.trackGridSize.addEventListener('change', (e) => {
        const size = e.target.value.split('x');
        gridSize = { rows: parseInt(size[0]), cols: parseInt(size[1]) };
        setupGrid();
        renderEditor();
    });

    elems.generateRandomTrack.addEventListener('click', () => {
        generateRandomTrackWithRetry(); // Calls the new retry function
    });
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
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 1;
                ctx.strokeRect(x_topLeft, y_topLeft, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
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

function getRotatedConnections(part, rotation_deg) {
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

// --- NEW/REVISED RANDOM GENERATION FUNCTIONS ---

function generateRandomTrackWithRetry(maxRetries = 5) { // Can reduce retries if DFS is more robust
    console.log("generateRandomTrackWithRetry CALLED for LOOP track. maxRetries:", maxRetries);
    for (let i = 0; i < maxRetries; i++) {
        console.log(`--- generateRandomTrackWithRetry: Attempt ${i + 1} / ${maxRetries} calling generateRandomLoopTrack ---`);
        if (generateRandomLoopTrack()) { // Calls the new DFS-based generator
            console.log(`Random loop track generated successfully on attempt ${i + 1}`);
            return;
        }
        console.log(`generateRandomLoopTrack attempt ${i + 1} returned false or incomplete. Retrying...`);
    }
    alert("No se pudo generar una pista en bucle después de varios intentos. Verifica las partes de pista disponibles o el tamaño de la cuadrícula.");
    setupGrid(); 
    renderEditor();
}

function generateRandomLoopTrack() {
    setupGrid();
    console.log(`--- Starting Random Loop Track Generation (Grid: ${gridSize.rows}x${gridSize.cols}) ---`);

    const loopParts = AVAILABLE_TRACK_PARTS.filter(p => {
        if (!p.connections) return false;
        return Object.values(p.connections).filter(conn => conn === true).length === 2;
    });

    if (loopParts.length === 0) {
        alert("No hay partes de pista adecuadas (con exactamente 2 conexiones) en config.js para generar un bucle.");
        console.error("No suitable parts (exactly 2 connections) found for loop generation.");
        renderEditor();
        return false;
    }
    // console.log("Suitable parts for loop generation:", JSON.parse(JSON.stringify(loopParts))); // Can be verbose

    const stack = [];
    const visited = new Set();

    let startR = Math.floor(Math.random() * gridSize.rows);
    let startC = Math.floor(Math.random() * gridSize.cols);

    stack.push({ r: startR, c: startC, fromDir: null }); 
    visited.add(`${startR},${startC}`);
    let placedCount = 0;
    let lastPlacedPartForLoopAttempt = null; // To potentially connect back to start

    while (stack.length > 0) {
        const current = stack[stack.length - 1]; 
        const { r, c } = current; // We don't strictly need fromDir from stack for this DFS part placement logic

        let moved = false;
        const shuffledDirections = [...DIRECTIONS].sort(() => 0.5 - Math.random());

        for (const dirInfo of shuffledDirections) {
            const nextR = r + dirInfo.dr;
            const nextC = c + dirInfo.dc;

            if (nextR >= 0 && nextR < gridSize.rows &&
                nextC >= 0 && nextC < gridSize.cols &&
                !visited.has(`${nextR},${nextC}`)) {

                // Current cell (r,c) needs to connect towards dirInfo.name
                // Next cell (nextR, nextC) needs to connect towards OPPOSITE_DIRECTIONS[dirInfo.name]

                const candidatePlacements = [];
                loopParts.forEach(pInfo => {
                    if (!trackPartsImages[pInfo.file]) return;
                    for (let rot = 0; rot < 360; rot += 90) {
                        const conns = getRotatedConnections(pInfo, rot);
                        // The piece at (r,c) needs to connect to (nextR,nextC) via dirInfo.name
                        // This means the piece we are *about to choose* for (r,c) must have an opening in dirInfo.name
                        // AND if (r,c) is not the start cell, it must also connect to where it came from.
                        
                        // For this DFS: we "carve" by finding a piece for the *next* cell (nextR, nextC)
                        // that connects back to the *current* cell (r,c)
                        if (conns[OPPOSITE_DIRECTIONS[dirInfo.name]]) {
                             // And the piece at (r,c), if already placed (not the very first piece), must be able to connect to this new piece
                            let currentCellConnects = true;
                            if (grid[r][c]) { // If current cell already has a piece from a previous step/backtrack
                                const currentCellConns = getRotatedConnections(grid[r][c], grid[r][c].rotation_deg);
                                if (!currentCellConns[dirInfo.name]) {
                                    currentCellConnects = false;
                                }
                            }
                            if (currentCellConnects) {
                                candidatePlacements.push({ partInfo: pInfo, rotation: rot });
                            }
                        }
                    }
                });
                
                if (candidatePlacements.length > 0) {
                    const chosenNextPlacement = candidatePlacements[Math.floor(Math.random() * candidatePlacements.length)];
                    
                    // Place part in NEXT cell
                    grid[nextR][nextC] = {
                        ...chosenNextPlacement.partInfo,
                        image: trackPartsImages[chosenNextPlacement.partInfo.file],
                        rotation_deg: chosenNextPlacement.rotation
                    };
                    if(!grid[nextR][nextC].image) console.error("Image missing for placed part in nextCell:", grid[nextR][nextC]);
                    placedCount++;
                    console.log(`DFS: Placed ${grid[nextR][nextC].name} at [${nextR},${nextC}] (rot ${grid[nextR][nextC].rotation_deg}) connecting from [${r},${c}] via ${OPPOSITE_DIRECTIONS[dirInfo.name]}`);
                    
                    // Now, ensure/place the piece in the CURRENT cell (r,c) that connects to this new piece
                    // This logic is tricky because the current cell might already be set if backtracking.
                    // A simpler DFS just "carves" by choosing the next cell and assumes the connection.
                    // The visual representation is what matters. We primarily care about filling nextR, nextC.
                    // The part at r,c (if it's the first piece, or if this is the first exit from it) needs to be set.
                    if (!grid[r][c]) { // If starting piece hasn't been finalized based on an exit
                        const currentCellCandidates = [];
                        loopParts.forEach(pInfoCurrent => {
                             if (!trackPartsImages[pInfoCurrent.file]) return;
                             for (let rotCurrent = 0; rotCurrent < 360; rotCurrent +=90) {
                                 const connsCurrent = getRotatedConnections(pInfoCurrent, rotCurrent);
                                 if (connsCurrent[dirInfo.name]) { // Must connect to the chosen next cell
                                     currentCellCandidates.push({partInfo: pInfoCurrent, rotation: rotCurrent});
                                 }
                             }
                        });
                        if (currentCellCandidates.length > 0) {
                            const chosenCurrent = currentCellCandidates[Math.floor(Math.random() * currentCellCandidates.length)];
                            grid[r][c] = {
                                ...chosenCurrent.partInfo,
                                image: trackPartsImages[chosenCurrent.partInfo.file],
                                rotation_deg: chosenCurrent.rotation
                            };
                             if(!grid[r][c].image) console.error("Image missing for placed part in currentCell:", grid[r][c]);
                            console.log(`DFS: Finalized/Placed START piece ${grid[r][c].name} at [${r},${c}] (rot ${grid[r][c].rotation_deg})`);
                            if (placedCount === 0) placedCount++; // If it was the very first piece
                        } else {
                            console.error(`DFS Error: Could not find a starting piece for [${r},${c}] to connect to ${dirInfo.name}`);
                            grid[nextR][nextC] = null; // Rollback
                            placedCount--;
                            continue; // Try another direction from current cell
                        }
                    }


                    visited.add(`${nextR},${nextC}`);
                    stack.push({ r: nextR, c: nextC, fromDir: dirInfo.name }); // Note: fromDir is how we entered nextR,nextC
                    moved = true;
                    lastPlacedPartForLoopAttempt = grid[nextR][nextC]; // Keep track for potential loop closing
                    break; 
                }
            }
        }

        if (!moved) { 
            stack.pop(); 
            // console.log(`DFS: Backtracking from [${r},${c}]`);
        }
    }
    
    // Attempt to close loop to the starting cell (startR, startC)
    // This is a very basic attempt and might not always work or look good.
    if (placedCount > 2 && lastPlacedPartForLoopAttempt && grid[startR][startC]) {
        const lastR = stack.length > 0 ? stack[stack.length-1].r : currentR; // currentR might be from a popped stack
        const lastC = stack.length > 0 ? stack[stack.length-1].c : currentC; // So use the top of stack if available
        const lastPart = grid[lastR][lastC];

        if (lastPart) { // Ensure there's a part at the end of the DFS path
            console.log(`DFS: Attempting to close loop from [${lastR},${lastC}] to start [${startR},${startC}]`);
            const lastPartConns = getRotatedConnections(lastPart, lastPart.rotation_deg);
            for (const dir of DIRECTIONS) {
                if (lastPartConns[dir.name]) {
                    const potentialLoopR = lastR + dir.dr;
                    const potentialLoopC = lastC + dir.dc;
                    if (potentialLoopR === startR && potentialLoopC === startC) {
                        const startPart = grid[startR][startC];
                        const requiredStartConn = OPPOSITE_DIRECTIONS[dir.name];
                        const startPartConns = getRotatedConnections(startPart, startPart.rotation_deg);
                        if (startPartConns[requiredStartConn]) {
                            console.log(`DFS: Loop closed successfully to start cell!`);
                            // The connection is valid. Nothing more to place, loop is formed.
                            break; 
                        } else {
                            console.log(`DFS: Start cell [${startR},${startC}] part ${startPart.name} (rot ${startPart.rotation_deg}) does not have required connection ${requiredStartConn} to close loop.`);
                        }
                    }
                }
            }
        }
    }


    console.log(`DFS generation finished. Parts placed: ${placedCount}`);
    renderEditor();
    
    const success = placedCount >= Math.floor(totalCells * 0.4); // Success if 40% filled for DFS
    if (!success) console.warn("DFS generated track might be too short or incomplete.");
    return success;
}


function validateTrack() {
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
                    if (currentConnections[dir.name]) {
                        const nextR = r + dir.dr;
                        const nextC = c + dir.dc;

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

    if (partCount === 0) {
        alert("Validación: La pista está vacía.");
        return false;
    }
    if (connectionMismatches > 0) {
        console.warn(`Validación: Encontradas ${connectionMismatches / 2} conexiones incompatibles.`);
    }
    if (danglingConnections > 2 && partCount > 1 && connectionMismatches === 0) { 
         // If there are no mismatches, more than 2 dangling ends means it's not a simple loop/line.
         // This might be okay for a path, but for a loop, ideally danglingConnections would be 0 or 2 (if it's a line that just didn't close)
         console.warn(`Validación: Encontradas ${danglingConnections} conexiones abiertas/colgando.`);
    }
    console.log(`Validación básica: Partes=${partCount}, Incompatibles=${connectionMismatches}, Abiertas=${danglingConnections}`);
    if (partCount > 0) return true;
    return false;
}

function saveTrackDesign() {
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
            setupGrid();
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
    if (gridSize.rows === 0 || gridSize.cols === 0) { alert("Grid size is invalid."); return null; }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gridSize.cols * TRACK_PART_SIZE_PX;
    exportCanvas.height = gridSize.rows * TRACK_PART_SIZE_PX;
    if (exportCanvas.width === 0 || exportCanvas.height === 0) { alert("Cannot export an empty track (0 width or height)."); return null; }
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = 'white'; exportCtx.fillRect(0,0, exportCanvas.width, exportCanvas.height);
    let hasContent = false;
    for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
            if (grid[r][c] && grid[r][c].image) {
                hasContent = true; const part = grid[r][c];
                const x_center = c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                const y_center = r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                exportCtx.save(); exportCtx.translate(x_center, y_center); exportCtx.rotate(part.rotation_deg * Math.PI / 180);
                exportCtx.drawImage(part.image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                exportCtx.restore();
            }
        }
    }
    if (!hasContent) { alert("El editor de pistas está vacío. Añade algunas partes."); return null;}
    return exportCanvas;
}
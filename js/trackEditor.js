// js/trackEditor.js
import { getDOMElements } from './ui.js';
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js';


let editorCanvas, ctx;
let grid = [];
let gridSize = { rows: 4, cols: 4 }; 
let trackPartsImages = {};
let selectedTrackPart = null;

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
        setupGrid();
        renderEditor();
    });

    elems.generateRandomTrack.addEventListener('click', () => { 
        generateRandomTrackWithRetry(); 
    });

    elems.exportTrackFromEditor.addEventListener('click', () => {
        if (!validateTrack()) { 
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

function generateRandomTrackWithRetry(maxRetries = 5) {
    console.log("generateRandomTrackWithRetry CALLED for LOOP track. maxRetries:", maxRetries);
    for (let i = 0; i < maxRetries; i++) {
        console.log(`--- generateRandomTrackWithRetry: Attempt ${i + 1} / ${maxRetries} calling generateRandomLoopTrack ---`);
        if (generateRandomLoopTrack()) { 
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

    const stack = [];
    const visited = new Set();

    let startR_dfs = Math.floor(Math.random() * gridSize.rows); // Renamed to avoid conflict
    let startC_dfs = Math.floor(Math.random() * gridSize.cols); // Renamed to avoid conflict

    // Variables to track the current head of DFS path, scoped to this function
    let currentPathR = startR_dfs;
    let currentPathC = startC_dfs;

    stack.push({ r: currentPathR, c: currentPathC, fromDir: null }); 
    visited.add(`${currentPathR},${currentPathC}`);
    let placedCount = 0;
    let lastPlacedPartForLoopObject = null; 

    while (stack.length > 0) {
        const currentStackItem = stack[stack.length - 1]; 
        // Update currentPathR and currentPathC from the stack item we are currently processing
        currentPathR = currentStackItem.r;
        currentPathC = currentStackItem.c;
        // const { fromDir } = currentStackItem; // fromDir is actually on currentStackItem, not directly used here for piece placement

        let moved = false;
        const shuffledDirections = [...DIRECTIONS].sort(() => 0.5 - Math.random());

        for (const dirInfo of shuffledDirections) {
            const nextR = currentPathR + dirInfo.dr;
            const nextC = currentPathC + dirInfo.dc;

            if (nextR >= 0 && nextR < gridSize.rows &&
                nextC >= 0 && nextC < gridSize.cols &&
                !visited.has(`${nextR},${nextC}`)) {

                const candidatePlacements = [];
                loopParts.forEach(pInfo => {
                    if (!trackPartsImages[pInfo.file]) return;
                    for (let rot = 0; rot < 360; rot += 90) {
                        const conns = getRotatedConnections(pInfo, rot);
                        if (conns[OPPOSITE_DIRECTIONS[dirInfo.name]]) {
                            let currentCellConnects = true;
                            if (grid[currentPathR][currentPathC]) { 
                                const currentCellConns = getRotatedConnections(grid[currentPathR][currentPathC], grid[currentPathR][currentPathC].rotation_deg);
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
                    
                    grid[nextR][nextC] = {
                        ...chosenNextPlacement.partInfo,
                        image: trackPartsImages[chosenNextPlacement.partInfo.file],
                        rotation_deg: chosenNextPlacement.rotation
                    };
                    if(!grid[nextR][nextC].image) console.error("Image missing for placed part in nextCell:", grid[nextR][nextC]);
                    placedCount++;
                    // console.log(`DFS: Placed ${grid[nextR][nextC].name} at [${nextR},${nextC}] (rot ${grid[nextR][nextC].rotation_deg}) connecting from [${currentPathR},${currentPathC}] via ${OPPOSITE_DIRECTIONS[dirInfo.name]}`);
                    
                    if (!grid[currentPathR][currentPathC]) { 
                        const currentCellCandidates = [];
                        loopParts.forEach(pInfoCurrent => {
                             if (!trackPartsImages[pInfoCurrent.file]) return;
                             for (let rotCurrent = 0; rotCurrent < 360; rotCurrent +=90) {
                                 const connsCurrent = getRotatedConnections(pInfoCurrent, rotCurrent);
                                 if (connsCurrent[dirInfo.name]) { 
                                     currentCellCandidates.push({partInfo: pInfoCurrent, rotation: rotCurrent});
                                 }
                             }
                        });
                        if (currentCellCandidates.length > 0) {
                            const chosenCurrent = currentCellCandidates[Math.floor(Math.random() * currentCellCandidates.length)];
                            grid[currentPathR][currentPathC] = {
                                ...chosenCurrent.partInfo,
                                image: trackPartsImages[chosenCurrent.partInfo.file],
                                rotation_deg: chosenCurrent.rotation
                            };
                             if(!grid[currentPathR][currentPathC].image) console.error("Image missing for placed part in currentCell:", grid[currentPathR][currentPathC]);
                            // console.log(`DFS: Finalized/Placed START piece ${grid[currentPathR][currentPathC].name} at [${currentPathR},${currentPathC}] (rot ${grid[currentPathR][currentPathC].rotation_deg})`);
                            if (placedCount === 0) placedCount++; 
                        } else {
                            console.error(`DFS Error: Could not find a starting piece for [${currentPathR},${currentPathC}] to connect to ${dirInfo.name}`);
                            grid[nextR][nextC] = null; 
                            placedCount--;
                            continue; 
                        }
                    }

                    visited.add(`${nextR},${nextC}`);
                    stack.push({ r: nextR, c: nextC, fromDir: dirInfo.name }); 
                    moved = true;
                    lastPlacedPartForLoopObject = { ...grid[nextR][nextC], r_val: nextR, c_val: nextC }; 
                    break; 
                }
            }
        }

        if (!moved) { 
            stack.pop(); 
        }
    }
    
    // --- Corrected Loop Closing Logic Scope ---
    if (placedCount > 2 && grid[startR_dfs][startC_dfs] && lastPlacedPartForLoopObject) {
        const lastR = lastPlacedPartForLoopObject.r_val; // Use coordinates from the explicitly stored last part
        const lastC = lastPlacedPartForLoopObject.c_val;
        const lastPart = grid[lastR][lastC]; // Get the actual part object from the grid

        if (lastPart) { 
            console.log(`DFS: Attempting to close loop from last placed [${lastR},${lastC}] (part: ${lastPart.name}) to start [${startR_dfs},${startC_dfs}]`);
            const lastPartConns = getRotatedConnections(lastPart, lastPart.rotation_deg);

            for (const dir of DIRECTIONS) {
                if (lastPartConns[dir.name]) {
                    const potentialLoopR = lastR + dir.dr;
                    const potentialLoopC = lastC + dir.dc;
                    if (potentialLoopR === startR_dfs && potentialLoopC === startC_dfs) {
                        const startPart = grid[startR_dfs][startC_dfs];
                        const requiredStartConn = OPPOSITE_DIRECTIONS[dir.name];
                        const startPartConns = getRotatedConnections(startPart, startPart.rotation_deg);
                        if (startPartConns[requiredStartConn]) {
                            console.log(`DFS: Loop closed successfully to start cell!`);
                            break; 
                        } else {
                            console.log(`DFS: Start cell [${startR_dfs},${startC_dfs}] part ${startPart.name} (rot ${startPart.rotation_deg}) does not have required connection ${requiredStartConn} to close loop.`);
                        }
                    }
                }
            }
        }
    }
    // --- End of Corrected Loop Closing Logic Scope ---


    console.log(`DFS generation finished. Parts placed: ${placedCount}`);
    renderEditor();
    
    const success = placedCount >= Math.floor(totalCells * 0.4); 
    if (!success) console.warn("DFS generated track might be too short or incomplete.");
    return success;
}


function validateTrack() {
    // ... (validateTrack function remains the same)
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
         console.warn(`Validación: Encontradas ${danglingConnections} conexiones abiertas/colgando.`);
    }
    console.log(`Validación básica: Partes=${partCount}, Incompatibles=${connectionMismatches}, Abiertas=${danglingConnections}`);
    if (partCount > 0) return true;
    return false;
}

function saveTrackDesign() {
    // ... (saveTrackDesign function remains the same)
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
    // ... (loadTrackDesign function remains the same)
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
    // ... (exportTrackAsCanvas function remains the same)
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
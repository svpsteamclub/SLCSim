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

    elems.generateRandomTrack.addEventListener('click', generateRandomTrackWithRetry);
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
    if (!part || !part.connections) return {};
    const rotated = {};
    const rotations = rotation_deg / 90; 

    for (const dir in part.connections) {
        if (part.connections[dir]) {
            let currentDirIndex = DIRECTIONS.findIndex(d => d.name === dir);
            if (currentDirIndex === -1) { 
                console.error(`Invalid direction key '${dir}' in part connections for ${part.name}.`);
                continue;
            }
            let newDirIndex = (currentDirIndex + rotations) % 4;
            rotated[DIRECTIONS[newDirIndex].name] = true;
        }
    }
    return rotated;
}

function generateRandomTrackWithRetry(maxRetries = 10) { // Increased retries for simpler part set
    for (let i = 0; i < maxRetries; i++) {
        console.log(`--- Generation Attempt ${i + 1} ---`);
        if (generateRandomLayout()) {
            console.log(`Random track generated successfully on attempt ${i + 1}`);
            return; 
        }
        console.log(`Random track generation attempt ${i + 1} failed to meet criteria, retrying...`);
    }
    alert("No se pudo generar una pista después de varios intentos. Verifica la definición de las partes (config.js) o intenta de nuevo con un tamaño de cuadrícula mayor.");
    setupGrid(); 
    renderEditor();
}

// In js/trackEditor.js

function generateRandomLayout() {
    setupGrid();
    if (AVAILABLE_TRACK_PARTS.length === 0) {
        alert("No hay partes de pista disponibles para generar una pista.");
        renderEditor();
        return false;
    }
    console.log(`--- Starting Random Layout Generation (Grid: ${gridSize.rows}x${gridSize.cols}) ---`);
    console.log("Available base parts:", JSON.parse(JSON.stringify(AVAILABLE_TRACK_PARTS)));


    const suitableParts = AVAILABLE_TRACK_PARTS.filter(p => {
        const connCount = Object.values(p.connections || {}).filter(conn => conn === true).length;
        return connCount >= 1 && connCount <= 2; // Allows dead-ends and path segments
    });

    if (suitableParts.length === 0) {
        alert("No hay partes de pista adecuadas (con 1 o 2 conexiones) en config.js para generar la pista.");
        console.error("No suitable parts (1-2 connections) found in AVAILABLE_TRACK_PARTS.");
        renderEditor();
        return false;
    }
    console.log("Suitable base parts for path generation:", JSON.parse(JSON.stringify(suitableParts)));


    let currentR = Math.floor(gridSize.rows / 2);
    let currentC = Math.floor(gridSize.cols / 2);

    let startPieceInfo = suitableParts[Math.floor(Math.random() * suitableParts.length)];
    let startRotation = (Math.floor(Math.random() * 4)) * 90;
    
    if (!trackPartsImages[startPieceInfo.file]) {
        console.error(`Image not found for starting piece: ${startPieceInfo.file}. Check asset loading and config.`);
        renderEditor();
        return false;
    }

    grid[currentR][currentC] = {
        ...startPieceInfo,
        image: trackPartsImages[startPieceInfo.file],
        rotation_deg: startRotation
    };
    console.log(`Placed STARTING piece: ${startPieceInfo.name} at [${currentR},${currentC}] (Rotation: ${startRotation} deg)`);
    console.log("Its 0-deg connections:", JSON.stringify(startPieceInfo.connections));
    console.log("Its ROTATED connections:", JSON.stringify(getRotatedConnections(startPieceInfo, startRotation)));


    let placedCount = 1;
    const totalCells = gridSize.rows * gridSize.cols;
    let pathLength = 1;
    const maxPathLength = Math.floor(totalCells * 0.9); 

    let lastExitDirectionNameFromPrevCell = null; // The direction taken from the *previous* cell to reach the current one

    for (let i = 0; i < maxPathLength && pathLength < totalCells; i++) {
        console.log(`\nPATH STEP ${pathLength}: Current cell [${currentR},${currentC}]`);
        const currentPart = grid[currentR][currentC];
        if (!currentPart) {
            console.error("FATAL: currentPart is null, path broken.");
            break; 
        }

        const currentActualConnections = getRotatedConnections(currentPart, currentPart.rotation_deg);
        console.log(`  Current part: ${currentPart.name}, Rot: ${currentPart.rotation_deg} deg, Actual Connections: ${JSON.stringify(currentActualConnections)}`);
        
        let possibleExits = [];
        DIRECTIONS.forEach(dir => {
            if (currentActualConnections[dir.name]) {
                // To avoid immediate U-turn: if the current part has an exit in a direction,
                // that direction should not be the one we just entered from (unless it's a dead-end part with only one exit).
                const entryDirectionToCurrentCell = lastExitDirectionNameFromPrevCell ? OPPOSITE_DIRECTIONS[lastExitDirectionNameFromPrevCell] : null;
                if (entryDirectionToCurrentCell && dir.name === entryDirectionToCurrentCell && Object.keys(currentActualConnections).length > 1) {
                    console.log(`    Skipping exit ${dir.name} because it's the entry point and not a dead-end.`);
                    return;
                }
                possibleExits.push(dir);
            }
        });

        if (possibleExits.length === 0) {
            console.log(`  Path ended at [${currentR},${currentC}]. No valid non-reversing exits from ${currentPart.name}.`);
            break; 
        }
        console.log(`  Possible exits from current cell: ${possibleExits.map(p=>p.name).join(', ')}`);

        possibleExits.sort(() => 0.5 - Math.random()); // Shuffle exits
        let placedNext = false;

        for (const exitDir of possibleExits) {
            console.log(`    Trying exit: ${exitDir.name}`);
            const nextR = currentR + exitDir.dr;
            const nextC = currentC + exitDir.dc;

            if (nextR >= 0 && nextR < gridSize.rows && nextC >= 0 && nextC < gridSize.cols && !grid[nextR][nextC]) {
                const requiredEntryForNewPart = OPPOSITE_DIRECTIONS[exitDir.name];
                console.log(`      Target cell [${nextR},${nextC}] is empty. New part needs entry from: ${requiredEntryForNewPart}`);
                
                const candidatePlacements = [];
                suitableParts.forEach(pInfo => {
                    if (!trackPartsImages[pInfo.file]) { // Check if image for this part is loaded
                        console.warn(`Skipping candidate ${pInfo.name} as its image is not loaded.`);
                        return;
                    }
                    for (let rot = 0; rot < 360; rot += 90) {
                        const newPartActualConnections = getRotatedConnections(pInfo, rot);
                        if (newPartActualConnections[requiredEntryForNewPart]) {
                            // Further check: ensure its *other* exit doesn't immediately point to an occupied cell
                            // or back to the cell we are coming from, unless it's a dead-end piece.
                            let isValidCandidatePlacement = true;
                            if (Object.keys(newPartActualConnections).length > 1) { // If not a dead-end piece
                                for (const newPartExitDirName in newPartActualConnections) {
                                    if (newPartActualConnections[newPartExitDirName] && newPartExitDirName !== requiredEntryForNewPart) {
                                        const checkDirObj = DIRECTIONS.find(d => d.name === newPartExitDirName);
                                        const checkFurtherR = nextR + checkDirObj.dr;
                                        const checkFurtherC = nextC + checkDirObj.dc;
                                        // Is it pointing back to the cell we just came from?
                                        if (checkFurtherR === currentR && checkFurtherC === currentC) {
                                            console.log(`        Candidate ${pInfo.name} (rot ${rot}) rejected: other exit ${newPartExitDirName} points back to [${currentR},${currentC}]`);
                                            isValidCandidatePlacement = false;
                                            break;
                                        }
                                        // Is it pointing to another *already filled* cell (that's not currentR,C)?
                                        // This prevents forming tiny loops or running into existing track prematurely.
                                        if (checkFurtherR >= 0 && checkFurtherR < gridSize.rows &&
                                            checkFurtherC >= 0 && checkFurtherC < gridSize.cols &&
                                            grid[checkFurtherR][checkFurtherC] ) {
                                            console.log(`        Candidate ${pInfo.name} (rot ${rot}) rejected: other exit ${newPartExitDirName} points to occupied cell [${checkFurtherR},${checkFurtherC}]`);
                                            isValidCandidatePlacement = false;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (isValidCandidatePlacement) {
                                candidatePlacements.push({ partInfo: pInfo, rotation: rot });
                            }
                        }
                    }
                });

                if (candidatePlacements.length > 0) {
                    const chosenPlacement = candidatePlacements[Math.floor(Math.random() * candidatePlacements.length)];
                    console.log(`        Found ${candidatePlacements.length} candidate placements. Chosen: ${chosenPlacement.partInfo.name} (Rot: ${chosenPlacement.rotation})`);
                    
                    grid[nextR][nextC] = {
                        ...chosenPlacement.partInfo,
                        image: trackPartsImages[chosenPlacement.partInfo.file],
                        rotation_deg: chosenPlacement.rotation
                    };
                    
                    currentR = nextR; // Move current position
                    currentC = nextC;
                    lastExitDirectionNameFromPrevCell = exitDir.name; // Record how we exited the *previous* cell
                    placedCount++;
                    pathLength++;
                    placedNext = true;
                    break; 
                } else {
                    console.log(`      No suitable candidate parts found for cell [${nextR},${nextC}] requiring entry ${requiredEntryForNewPart}.`);
                }
            } else {
                 console.log(`      Target cell [${nextR},${nextC}] is out of bounds or occupied.`);
            }
        }

        if (!placedNext) {
            console.log(`  Path ended at [${grid[currentR][currentC]?.name || 'Unknown part'} at ${currentR},${currentC}]. Could not find a valid part for any exit.`);
            break; 
        }
    }

    console.log(`--- Generation Finished. Path length: ${pathLength}, Parts placed: ${placedCount}/${totalCells} ---`);
    renderEditor();
    return pathLength > 1; // Success if more than just the starting piece is placed
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
    // For a path generator (not necessarily a loop), more than 2 dangling connections is an issue if it's not a simple line.
    // If it's a single line of parts, it will have 2 dangling connections.
    // If it branches and dead-ends, it will have more.
    if (danglingConnections > 2 && partCount > 1) {
         console.warn(`Validación: Encontradas ${danglingConnections} conexiones abiertas/colgando (más de 2 para un camino simple).`);
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
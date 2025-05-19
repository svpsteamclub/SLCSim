// js/main.js
import { Simulation } from './simulation.js';
import * as Config from './config.js';
import * as Utils from './utils.js';
import * as UI from './ui.js';
import { initRobotEditorV2 } from './robotEditorV2.js';
import { initTrackEditor } from './trackEditor.js';

let simulation;
let simulationRunning = false;
let animationFrameId;
let lastFrameTime = 0;
let accumulator = 0;

let displayCanvas, displayCtx;
let robotImages = { body: null, wheel: null };
let watermarkImage = null;
let assetsLoadedCount = 0;
const TOTAL_ASSETS_TO_LOAD = 3; 

// For setting start position (general)
let isSettingStartPosition = false;
let startPositionClickPoint_canvasPx = { x: null, y: null };
let currentMousePosition_canvasPx = { x: null, y: null };

// Custom Track specific state
let currentTrackIsCustom = false; // Is the currently active track a custom one?
let customTrackFile = null; // Holds the File object for the current custom track if loaded from input
let customTrackImageFilename = ""; // Filename for display/logging
let customTrackStart = { x_m: 0.1, y_m: 0.1, angle_rad: 0 }; // User-defined start for the *current* custom track

// Store initial start position for selected predefined track (from its dataset)
let predefinedTrackStart = { x_px: 0, y_px: 0, angle_deg: 0};


function checkAllAssetsLoadedAndInit() {
    assetsLoadedCount++;
    if (assetsLoadedCount === TOTAL_ASSETS_TO_LOAD) {
        console.log("All essential assets loaded.");
        simulation = new Simulation(robotImages, watermarkImage);
        
        const initialParams = UI.getSimulationParameters();
        let initialRobotGeom = Config.DEFAULT_ROBOT_GEOMETRY;
        if (typeof getRobotDerivedGeometry === 'function') { // If robot editor provides geometry
            initialRobotGeom = getRobotDerivedGeometry() || Config.DEFAULT_ROBOT_GEOMETRY;
        }
        simulation.updateParameters(initialParams, initialParams.pid, initialRobotGeom);
        UI.updateRobotGeometryDisplay(initialRobotGeom); 

        setupEventListeners();
        loadInitialTrack(); // This will also render initial state via its callback
        UI.resetPIDDisplay();
        UI.resetLapTimeDisplay();
        // updateUIForSimulationState is called within loadInitialTrack callback

        const mainAppInterface = {
            updateRobotGeometryInSimulator: (newGeometry) => {
                if (simulation && simulation.robot) {
                    simulation.robot.updateGeometry(newGeometry);
                    UI.updateRobotGeometryDisplay(newGeometry); 
                }
            },
            loadTrackFromEditorCanvas: async (trackCanvas, startX_m, startY_m, startAngle_rad) => {
                stopSimulation(); // Stop any current simulation
                currentTrackIsCustom = true; 
                customTrackImageFilename = "Pista_del_Editor.png";
                customTrackStart = { x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }; // Store its start
                UI.getDOMElements().customTrackInput.value = ''; 
                UI.getDOMElements().trackImageSelector.selectedIndex = -1;

                try {
                    if (await simulation.setTrackFromCanvas(trackCanvas, startX_m, startY_m, startAngle_rad)) {
                        const {simulationCanvas} = UI.getDOMElements();
                        simulationCanvas.width = trackCanvas.width;
                        simulationCanvas.height = trackCanvas.height;
                        
                        // Force a render of the new state
                        if (displayCtx && simulation) {
                            simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
                        }
                        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, true, true);
                    } else {
                        alert("Error al cargar la pista desde el editor.");
                        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, true);
                    }
                } catch (error) {
                    console.error("Error loading track from editor:", error);
                    alert("Error al cargar la pista desde el editor.");
                    UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, true);
                }
            }
        };
        if (typeof initRobotEditorV2 === 'function') initRobotEditorV2();
        if (typeof initTrackEditor === 'function') initTrackEditor(mainAppInterface);

        // requestAnimationFrame(gameLoop); // gameLoop starts from loadInitialTrack or its equivalents
    }
}

function loadInitialAssets() {
    Utils.loadAndScaleImage(Config.ROBOT_IMAGE_PATHS.body, null, null, (img) => {
        robotImages.body = img; checkAllAssetsLoadedAndInit();
    });
    Utils.loadAndScaleImage(Config.ROBOT_IMAGE_PATHS.wheel, null, null, (img) => {
        robotImages.wheel = img; checkAllAssetsLoadedAndInit();
    });
    Utils.loadAndScaleImage(Config.WATERMARK_IMAGE_PATH, null, null, (img) => {
        watermarkImage = img; checkAllAssetsLoadedAndInit();
    });
}

function loadInitialTrack() {
    const { trackImageSelector, startButton } = UI.getDOMElements();
    if (Config.AVAILABLE_TRACKS.length > 0 && trackImageSelector.options.length > 0) {
        trackImageSelector.selectedIndex = 0; 
        handleTrackSelectionChange(); 
    } else {
        currentTrackIsCustom = false; // Ensure flag is correct
        if (simulation && simulation.track) simulation.track.clear();
        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, false);
        if (displayCtx && simulation) { // Render empty state
             simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
        }
        if(startButton) startButton.disabled = true;
        console.log("No predefined tracks. Load a custom one or define tracks in config.js.");
    }
}

function gameLoop(currentTime) {
    if (!simulation) { 
         animationFrameId = requestAnimationFrame(gameLoop);
         return;
    }
    
    const frameTime = (currentTime - lastFrameTime) / 1000.0;
    lastFrameTime = currentTime;

    if (simulationRunning) {
        accumulator += frameTime;
        let fixedUpdateResults;
        while (accumulator >= simulation.params.timeStep) {
            fixedUpdateResults = simulation.fixedUpdate();
            accumulator -= simulation.params.timeStep;

            if (fixedUpdateResults.outOfBounds) {
                stopSimulation(); // Also updates UI
                console.log("Robot went out of bounds!");
                alert("¡El robot se salió de la pista!");
                break; 
            }
        }
        if (fixedUpdateResults) { 
            UI.updatePIDDisplay(fixedUpdateResults.pidTerms, fixedUpdateResults.motorPWMs);
            UI.updateLapTimeDisplay(fixedUpdateResults.lapData);
            simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, fixedUpdateResults.sensorStates);
        }
    } else if (!isSettingStartPosition) { // Only redraw if not running AND not actively setting start pos (to avoid flicker)
        // This passive render can be removed if performance is an issue and render is only tied to changes
        // simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

function startSimulation() {
    if (simulationRunning) return;
    if (isSettingStartPosition) {
        alert("Por favor, confirme la posición inicial antes de simular.");
        return;
    }
    if (!simulation || !simulation.track || !simulation.track.imageData) {
        alert("Por favor, seleccione o cargue una pista y establezca la posición inicial.");
        return;
    }
    
    const paramsFromUI = UI.getSimulationParameters();
    let currentRobotGeom = Config.DEFAULT_ROBOT_GEOMETRY;
    if (typeof getRobotDerivedGeometry === 'function') {
        currentRobotGeom = getRobotDerivedGeometry() || Config.DEFAULT_ROBOT_GEOMETRY;
    }
    simulation.updateParameters(paramsFromUI, paramsFromUI.pid, currentRobotGeom);
    UI.updateRobotGeometryDisplay(currentRobotGeom);


    simulationRunning = true;
    lastFrameTime = performance.now();
    accumulator = 0;
    if (!animationFrameId) { // Start game loop if not already running
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, true, currentTrackIsCustom);
}

function stopSimulation() {
    if (!simulationRunning) return;
    simulationRunning = false;
    // cancelAnimationFrame(animationFrameId); // Let the loop stop itself by checking simulationRunning
    // animationFrameId = null; 
    UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, simulation && simulation.track && simulation.track.imageData !== null, currentTrackIsCustom);
}

// --- REFINED resetSimulation function ---
function resetSimulation() {
    if (isSettingStartPosition) {
        toggleSetStartPositionMode(); 
    }
    stopSimulation(); 

    const paramsFromUI = UI.getSimulationParameters();
    let currentRobotGeom = Config.DEFAULT_ROBOT_GEOMETRY;
     if (typeof getRobotDerivedGeometry === 'function') {
        currentRobotGeom = getRobotDerivedGeometry() || Config.DEFAULT_ROBOT_GEOMETRY;
    }
    
    if (simulation) {
        simulation.updateParameters(paramsFromUI, paramsFromUI.pid, currentRobotGeom);
    }
    if (typeof UI.updateRobotGeometryDisplay === 'function') {
        UI.updateRobotGeometryDisplay(currentRobotGeom);
    }

    let trackEffectivelyLoaded = false;

    if (currentTrackIsCustom && simulation && simulation.track && simulation.track.isCustom && simulation.track.image.complete) {
        console.log("Resetting robot on custom track to its defined start:", customTrackStart);
        simulation.resetSimulation(customTrackStart.x_m, customTrackStart.y_m, customTrackStart.angle_rad);
        trackEffectivelyLoaded = true;
    } else if (!currentTrackIsCustom && UI.getDOMElements().trackImageSelector.selectedIndex >= 0) {
        const selectedOption = UI.getDOMElements().trackImageSelector.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.fileName) {
            const trackUrl = selectedOption.dataset.fileName;
            const trackWidth = parseInt(selectedOption.dataset.width);
            const trackHeight = parseInt(selectedOption.dataset.height);
            // Use the most up-to-date start position from dataset (might have been changed by user)
            const startX_px = parseFloat(selectedOption.dataset.startX); 
            const startY_px = parseFloat(selectedOption.dataset.startY);
            const startAngle_deg = parseFloat(selectedOption.dataset.startAngle);

            console.log("Resetting to predefined track:", trackUrl, "Start:", {x: startX_px, y: startY_px, angle: startAngle_deg});
            
            if (UI.getDOMElements().startButton) UI.getDOMElements().startButton.disabled = true;

            simulation.loadTrack( // This function also resets PID, lap timer, and robot state
                trackUrl, trackWidth, trackHeight,
                startX_px / Config.PIXELS_PER_METER,
                startY_px / Config.PIXELS_PER_METER,
                Utils.degreesToRadians(startAngle_deg),
                false, "", 
                (success, actualWidth, actualHeight) => { 
                    if (success && displayCanvas) {
                        displayCanvas.width = actualWidth;
                        displayCanvas.height = actualHeight;
                    }
                    trackEffectivelyLoaded = success; // Update based on load success
                    UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, trackEffectivelyLoaded, currentTrackIsCustom);
                    if (!success && displayCtx && simulation && simulation.track) {
                         displayCtx.clearRect(0,0, displayCanvas.width, displayCanvas.height);
                         simulation.track.draw(displayCtx, displayCanvas.width, displayCanvas.height); 
                    }
                    // Force one render after successful load and reset
                    if (success && !simulationRunning && displayCtx && simulation) {
                        simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
                    }
                }
            );
            // No need for separate simulation.resetSimulation for predefined, loadTrack handles it.
        } else {
            console.warn("ResetSimulation: No valid predefined track selected.");
            if (simulation) simulation.track.clear(); // Clear track if selection invalid
        }
    } else {
        console.warn("ResetSimulation: No track active or invalid state to reset to.");
        if (simulation) {
            simulation.robot.resetState(0.1, 0.1, 0); 
            if(simulation.track) simulation.track.clear();
            simulation.pidController.reset();
            simulation.lapTimer.initialize({ x_m: 0.1, y_m: 0.1, angle_rad: 0 }, 0);
        }
    }
    
    UI.resetPIDDisplay();
    UI.resetLapTimeDisplay(); 

    // If not loading a new track (e.g. custom track reset), force a render
    if ((currentTrackIsCustom && trackEffectivelyLoaded) || (!trackEffectivelyLoaded && !currentTrackIsCustom && UI.getDOMElements().trackImageSelector.selectedIndex < 0)) {
        if (!simulationRunning && displayCtx && simulation) {
            simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
        }
    }
     UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, trackEffectivelyLoaded, currentTrackIsCustom);
}


function updateCurrentLapTimeDisplay(time_s) { // Extracted from old script.js
    if (UI.getDOMElements().currentLapTimeValSpan) UI.getDOMElements().currentLapTimeValSpan.textContent = time_s.toFixed(3);
}
function updateBestLapTimeDisplay() { // Extracted from old script.js
    const bestLapSpan = UI.getDOMElements().bestLapTimeValSpan;
    if (bestLapSpan && simulation && simulation.lapTimer) { // Check if lapTimer exists
         bestLapSpan.textContent = simulation.lapTimer.bestLapTime_s === Infinity ? "N/A" : simulation.lapTimer.bestLapTime_s.toFixed(3) + " s";
    }
}
function updateLapTimesDisplayTable() { // Extracted from old script.js
    const tableBody = UI.getDOMElements().lapTimesTableBody;
    if (!tableBody || !simulation || !simulation.lapTimer) return; // Check if lapTimer exists
    tableBody.innerHTML = '';
    const displayLaps = simulation.lapTimer.lapTimes.slice(0, 5);
    for (let i = 0; i < displayLaps.length; i++) {
        const row = tableBody.insertRow();
        row.insertCell().textContent = simulation.lapTimer.lapCounter - i;
        row.insertCell().textContent = displayLaps[i].toFixed(3);
    }
}


function toggleSetStartPositionMode() {
    isSettingStartPosition = !isSettingStartPosition;
    const { setStartPositionButton, startButton, simulationCanvas } = UI.getDOMElements();

    if (isSettingStartPosition) {
        if (simulationRunning || !simulation || !simulation.track || !simulation.track.imageData) {
            alert("Por favor, cargue una pista primero o detenga la simulación.");
            isSettingStartPosition = false; 
            return; 
        }
        setStartPositionButton.textContent = "Cancelar Ajuste";
        setStartPositionButton.classList.add('active'); 
        simulationCanvas.style.cursor = 'crosshair';
        if(startButton) startButton.disabled = true; 
    } else {
        setStartPositionButton.textContent = "Posición y Dirección Inicial";
        setStartPositionButton.classList.remove('active');
        simulationCanvas.style.cursor = 'default';
        startPositionClickPoint_canvasPx = { x: null, y: null };
        currentMousePosition_canvasPx = { x: null, y: null };
        document.removeEventListener('mousemove', handleDocumentMouseMoveForStartPos);
        document.removeEventListener('mouseup', handleDocumentMouseUpForStartPos);
        if (simulation && simulation.track && simulation.track.imageData && startButton) { 
            startButton.disabled = false;
        }
    }
    UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, simulation && simulation.track && simulation.track.imageData !== null, currentTrackIsCustom);
    if (displayCtx && simulation) simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null); 
}

function drawStartPositionIndicator() { // Helper for visual feedback
    if (!displayCtx || !isSettingStartPosition || !startPositionClickPoint_canvasPx.x || !currentMousePosition_canvasPx.x) return;
    
    if (startPositionClickPoint_canvasPx.x !== currentMousePosition_canvasPx.x || startPositionClickPoint_canvasPx.y !== currentMousePosition_canvasPx.y) {
        displayCtx.save();
        displayCtx.beginPath();
        displayCtx.moveTo(startPositionClickPoint_canvasPx.x, startPositionClickPoint_canvasPx.y);
        displayCtx.lineTo(currentMousePosition_canvasPx.x, currentMousePosition_canvasPx.y);
        displayCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        displayCtx.lineWidth = 2;
        displayCtx.setLineDash([5, 5]);
        displayCtx.stroke();
        displayCtx.setLineDash([]); 
        displayCtx.restore();
    }
    displayCtx.fillStyle = "rgba(0,0,0,0.8)";
    displayCtx.font = "bold 14px Arial";
    displayCtx.textAlign = "center";
    const instructionText = startPositionClickPoint_canvasPx.x === null ?
        "Haz clic para fijar la posición inicial." :
        "Arrastra para definir el ángulo. Suelta para confirmar.";
    displayCtx.fillText(instructionText, displayCanvas.width / 2, 25);
}


function handleCanvasMouseDownForStartPos(event) {
    if (!isSettingStartPosition || simulationRunning) return;
    const pos = Utils.getMousePos(displayCanvas, event);
    startPositionClickPoint_canvasPx = { x: pos.x, y: pos.y };
    currentMousePosition_canvasPx = { x: pos.x, y: pos.y };

    simulation.robot.x_m = pos.x / Config.PIXELS_PER_METER;
    simulation.robot.y_m = pos.y / Config.PIXELS_PER_METER;
    simulation.robot.angle_rad = 0; 

    document.addEventListener('mousemove', handleDocumentMouseMoveForStartPos);
    document.addEventListener('mouseup', handleDocumentMouseUpForStartPos);
    if (displayCtx && simulation) simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
}

function handleDocumentMouseMoveForStartPos(event) {
    if (!isSettingStartPosition || !startPositionClickPoint_canvasPx.x) return;
    const pos = Utils.getMousePos(displayCanvas, event);
    currentMousePosition_canvasPx = { x: pos.x, y: pos.y };

    const dx = currentMousePosition_canvasPx.x - startPositionClickPoint_canvasPx.x;
    const dy = currentMousePosition_canvasPx.y - startPositionClickPoint_canvasPx.y;

    if (Math.sqrt(dx * dx + dy * dy) > 5) { 
        simulation.robot.angle_rad = Math.atan2(dy, dx);
    }
    if (displayCtx && simulation) { // Redraw with indicator
        simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
        drawStartPositionIndicator();
    }
}

function handleDocumentMouseUpForStartPos(event) {
    document.removeEventListener('mousemove', handleDocumentMouseMoveForStartPos);
    document.removeEventListener('mouseup', handleDocumentMouseUpForStartPos);
    if (!isSettingStartPosition) return;

    const newStartX_m = simulation.robot.x_m;
    const newStartY_m = simulation.robot.y_m;
    const newStartAngle_rad = simulation.robot.angle_rad;
    
    simulation.resetSimulation(newStartX_m, newStartY_m, newStartAngle_rad); 

    console.log(`Nueva posición inicial: X=${newStartX_m.toFixed(3)}m, Y=${newStartY_m.toFixed(3)}m, Angulo=${Utils.radiansToDegrees(newStartAngle_rad).toFixed(1)}deg`);

    if (currentTrackIsCustom) {
        customTrackStart.x_m = newStartX_m;
        customTrackStart.y_m = newStartY_m;
        customTrackStart.angle_rad = newStartAngle_rad;
        console.log("Posición inicial de pista personalizada actualizada.");
    } else {
        const selectedOption = UI.getDOMElements().trackImageSelector.selectedOptions[0];
        if (selectedOption && selectedOption.dataset) {
            selectedOption.dataset.startX = Math.round(newStartX_m * Config.PIXELS_PER_METER);
            selectedOption.dataset.startY = Math.round(newStartY_m * Config.PIXELS_PER_METER);
            selectedOption.dataset.startAngle = Utils.radiansToDegrees(newStartAngle_rad).toFixed(1);
        }
    }
    toggleSetStartPositionMode(); // Exit mode
    if (displayCtx && simulation) simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null); // Final render
}


function handleCustomTrackUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "image/png") {
        alert("Por favor, seleccione un archivo de imagen PNG.");
        UI.getDOMElements().customTrackInput.value = null;
        return;
    }
    if (isSettingStartPosition) toggleSetStartPositionMode();
    stopSimulation();

    currentTrackIsCustom = true;
    customTrackFile = file; 
    customTrackImageFilename = file.name;
    UI.getDOMElements().trackImageSelector.selectedIndex = -1; 

    if(UI.getDOMElements().startButton) UI.getDOMElements().startButton.disabled = true; 
    
    simulation.loadTrack(
        file, null, null, 
        0,0,0, // Temporary start, will be overridden by user
        true, file.name,
        (success, actualWidth, actualHeight) => {
            if (success) {
                displayCanvas.width = actualWidth;
                displayCanvas.height = actualHeight;
                // Define a default initial start position for this new custom track
                customTrackStart.x_m = actualWidth / Config.PIXELS_PER_METER / 2;
                customTrackStart.y_m = Config.DEFAULT_ROBOT_GEOMETRY.length_m; 
                customTrackStart.angle_rad = Math.PI / 2; 
                // Apply this default to the robot
                simulation.robot.resetState(customTrackStart.x_m, customTrackStart.y_m, customTrackStart.angle_rad);
                simulation.pidController.reset();
                simulation.totalSimTime_s = 0;
                simulation.lapTimer.initialize({x_m: customTrackStart.x_m, y_m: customTrackStart.y_m, angle_rad: customTrackStart.angle_rad}, 0);

                alert(`Pista "${file.name}" cargada. Por favor, establece la posición y dirección inicial.`);
                if (!isSettingStartPosition) toggleSetStartPositionMode(); 
            } else {
                currentTrackIsCustom = false; 
                customTrackFile = null;
                customTrackImageFilename = "";
            }
             UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, success, currentTrackIsCustom);
             if (displayCtx && simulation) { // Always render after attempt
                 simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
             }
        }
    );
}

function clearCustomTrack() {
    if (isSettingStartPosition) toggleSetStartPositionMode(); 
    stopSimulation();

    currentTrackIsCustom = false;
    customTrackFile = null;
    customTrackImageFilename = "";
    if (UI.getDOMElements().customTrackInput) UI.getDOMElements().customTrackInput.value = '';
    if (simulation && simulation.track) simulation.track.clear(); 
    
    loadInitialTrack(); // Reload the first (or selected) predefined track
}

function handleTrackSelectionChange() {
    if (isSettingStartPosition) toggleSetStartPositionMode();
    stopSimulation();

    const selectedOption = UI.getDOMElements().trackImageSelector.selectedOptions[0];
    if (!selectedOption || !selectedOption.dataset.fileName) {
        if (simulation && simulation.track) simulation.track.clear(); 
        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, false);
        if (displayCtx && simulation) simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
        return;
    }
    
    currentTrackIsCustom = false; // Now it's a predefined track
    customTrackFile = null;
    customTrackImageFilename = "";
    if (UI.getDOMElements().customTrackInput) UI.getDOMElements().customTrackInput.value = ''; 

    const trackUrl = selectedOption.dataset.fileName;
    const trackWidth = parseInt(selectedOption.dataset.width);
    const trackHeight = parseInt(selectedOption.dataset.height);
    predefinedTrackStart.x_px = parseFloat(selectedOption.dataset.startX); // Update module-level store
    predefinedTrackStart.y_px = parseFloat(selectedOption.dataset.startY);
    predefinedTrackStart.angle_deg = parseFloat(selectedOption.dataset.startAngle);

    if(UI.getDOMElements().startButton) UI.getDOMElements().startButton.disabled = true; 

    simulation.loadTrack(
        trackUrl, trackWidth, trackHeight,
        predefinedTrackStart.x_px / Config.PIXELS_PER_METER,
        predefinedTrackStart.y_px / Config.PIXELS_PER_METER,
        Utils.degreesToRadians(predefinedTrackStart.angle_deg),
        false, "", 
        (success, actualWidth, actualHeight) => {
            if (success && displayCanvas) {
                displayCanvas.width = actualWidth;
                displayCanvas.height = actualHeight;
            }
            UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, success, false);
            if (displayCtx && simulation) { // Always render after attempt
                 simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
            }
        }
    );
}


function setupEventListeners() {
    const elems = UI.getDOMElements();
    elems.startButton.addEventListener('click', startSimulation);
    elems.stopButton.addEventListener('click', stopSimulation);
    elems.resetButton.addEventListener('click', resetSimulation);
    elems.setStartPositionButton.addEventListener('click', toggleSetStartPositionMode);
    
    elems.trackImageSelector.addEventListener('change', handleTrackSelectionChange);
    elems.customTrackInput.addEventListener('change', handleCustomTrackUpload);
    elems.clearCustomTrackButton.addEventListener('click', clearCustomTrack);
    
    elems.simulationCanvas.addEventListener('mousedown', handleCanvasMouseDownForStartPos);

    elems.arduinoVelBaseInput.addEventListener('change', (e) => {
        // This was for bar scaling, but currentMaxValAdjPID is handled dynamically in updatePIDDisplay
        // const baseSpeed = parseFloat(e.target.value) || 110;
        // Config.currentMaxValAdjPID = baseSpeed + 255; 
    });
}


document.addEventListener('DOMContentLoaded', () => {
    UI.cacheDOMElements(); 
    const { simulationCanvas, pixelsPerMeterDisplay } = UI.getDOMElements();
    displayCanvas = simulationCanvas;
    if (displayCanvas) {
        displayCtx = displayCanvas.getContext('2d');
    } else {
        console.error("FATAL: Simulation canvas not found on DOMContentLoaded!");
        return;
    }
    if (pixelsPerMeterDisplay) pixelsPerMeterDisplay.value = Config.PIXELS_PER_METER;

    UI.populateTrackSelector();
    UI.setupFoldableSections();
    UI.setupTabNavigation();
    
    loadInitialAssets(); // This will trigger simulation init and first track load
    animationFrameId = requestAnimationFrame(gameLoop); // Start the main animation loop
});
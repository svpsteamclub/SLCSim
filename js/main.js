    import { Simulation } from './simulation.js';
    import * as Config from './config.js';
    import * as Utils from './utils.js';
    import * as UI from './ui.js';
    import { initRobotEditor, getRobotDerivedGeometry } from './robotEditor.js';
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
    const TOTAL_ASSETS_TO_LOAD = 3; // body, wheel, watermark

    // For setting start position
    let isSettingStartPosition = false;
    let startPositionClickPoint_canvasPx = { x: null, y: null };
    let currentMousePosition_canvasPx = { x: null, y: null };
    let currentTrackIsCustom = false;
    let currentCustomTrackFile = null;
    let currentCustomTrackFilename = "";
    
    // Store initial start position for selected predefined track
    let predefinedTrackStart = { x_px: 0, y_px: 0, angle_deg: 0};


    function checkAllAssetsLoadedAndInit() {
        assetsLoadedCount++;
        if (assetsLoadedCount === TOTAL_ASSETS_TO_LOAD) {
            console.log("All essential assets loaded.");
            simulation = new Simulation(robotImages, watermarkImage);
            
            // Update simulation with initial parameters from UI
            const initialParams = UI.getSimulationParameters();
            simulation.updateParameters(initialParams, initialParams.pid, Config.DEFAULT_ROBOT_GEOMETRY);
            UI.updateRobotGeometryDisplay(Config.DEFAULT_ROBOT_GEOMETRY); // Show defaults

            setupEventListeners();
            loadInitialTrack();
            UI.resetPIDDisplay();
            UI.resetLapTimeDisplay();
            UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, false); // Initial state: no track loaded
            
            // Initialize editors (pass an interface for them to call back to main)
            const mainAppInterface = {
                updateRobotGeometryInSimulator: (newGeometry) => {
                    simulation.robot.updateGeometry(newGeometry);
                    UI.updateRobotGeometryDisplay(newGeometry); // Update read-only display
                },
                loadTrackFromEditorCanvas: (trackCanvas, startX_m, startY_m, startAngle_rad) => {
                    if (simulation.setTrackFromCanvas(trackCanvas, startX_m, startY_m, startAngle_rad)) {
                        currentTrackIsCustom = true; // Mark as custom
                        currentCustomTrackFilename = "Pista_del_Editor.png";
                        UI.getDOMElements().customTrackInput.value = ''; // Clear file input
                        const {simulationCanvas} = UI.getDOMElements();
                        simulationCanvas.width = trackCanvas.width;
                        simulationCanvas.height = trackCanvas.height;
                        gameLoop(performance.now()); // Render once
                        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, true, true);
                    } else {
                        alert("Error al cargar la pista desde el editor.");
                    }
                }
            };
            initRobotEditor(mainAppInterface);
            initTrackEditor(mainAppInterface);

            requestAnimationFrame(gameLoop); // Start render loop (will initially draw empty track)
        }
    }

    function loadInitialAssets() {
        Utils.loadAndScaleImage(Config.ROBOT_IMAGE_PATHS.body, null, null, (img) => {
            robotImages.body = img;
            checkAllAssetsLoadedAndInit();
        });
        Utils.loadAndScaleImage(Config.ROBOT_IMAGE_PATHS.wheel, null, null, (img) => {
            robotImages.wheel = img;
            checkAllAssetsLoadedAndInit();
        });
        Utils.loadAndScaleImage(Config.WATERMARK_IMAGE_PATH, null, null, (img) => {
            watermarkImage = img;
            checkAllAssetsLoadedAndInit();
        });
    }


    function loadInitialTrack() {
        const { trackImageSelector } = UI.getDOMElements();
        if (Config.AVAILABLE_TRACKS.length > 0 && trackImageSelector.options.length > 0) {
            trackImageSelector.selectedIndex = 0; // Select first track
            handleTrackSelectionChange(); // Load it
        } else {
            // No predefined tracks, render empty state
             if (simulation && displayCtx) {
                simulation.track.clear(); // Ensure track object is cleared
                simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
            }
            UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, currentTrackIsCustom);
        }
    }


    function gameLoop(currentTime) {
        if (!simulation) { // If simulation not initialized yet
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
                    stopSimulation();
                    console.log("Robot went out of bounds!");
                    // Potentially add a visual indicator or message
                    break; 
                }
            }
            if (fixedUpdateResults) { // fixedUpdateResults will be from the last step in the while loop
                UI.updatePIDDisplay(fixedUpdateResults.pidTerms, fixedUpdateResults.motorPWMs);
                UI.updateLapTimeDisplay(fixedUpdateResults.lapData);
                simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, fixedUpdateResults.sensorStates);
            }
        } else {
            // Render static scene if not running
            // Only render if something might have changed (e.g., setting start pos)
            // For now, always redraw when not running but animation frame is called
            simulation.draw(displayCtx, displayCanvas.width, displayCanvas.height, null);
             if (isSettingStartPosition && startPositionClickPoint_canvasPx.x !== null && currentMousePosition_canvasPx.x !== null) {
                drawStartPositionIndicator();
            }
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function startSimulation() {
        if (simulationRunning) return;
        if (isSettingStartPosition) {
            alert("Por favor, confirme la posición inicial antes de simular.");
            return;
        }
        if (!simulation.track.imageData) {
            alert("Por favor, seleccione o cargue una pista y establezca la posición inicial.");
            return;
        }
        
        const params = UI.getSimulationParameters();
        const robotGeomFromEditor = getRobotDerivedGeometry(); // Get from robot editor module
        simulation.updateParameters(params, params.pid, robotGeomFromEditor);
        UI.updateRobotGeometryDisplay(robotGeomFromEditor); // Update read-only view


        simulationRunning = true;
        lastFrameTime = performance.now();
        accumulator = 0;
        // gameLoop will pick up running state
        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, true, currentTrackIsCustom);
    }

    function stopSimulation() {
        if (!simulationRunning) return;
        simulationRunning = false;
        // cancelAnimationFrame(animationFrameId); // gameLoop handles this by checking simulationRunning
        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, simulation.track.imageData !== null, currentTrackIsCustom);
    }

    function resetSimulation() {
        if (isSettingStartPosition) toggleSetStartPositionMode(); // Exit mode
        stopSimulation();

        const params = UI.getSimulationParameters();
        const robotGeomFromEditor = getRobotDerivedGeometry();
        simulation.updateParameters(params, params.pid, robotGeomFromEditor); // Apply current UI params
        UI.updateRobotGeometryDisplay(robotGeomFromEditor);

        if (currentTrackIsCustom && simulation.track.isCustom) {
            // For custom tracks (from file or editor), reset to its defined start
            // The track object itself (image, imageData) is preserved for custom tracks on reset.
            // We just need to reset the robot's position on it to the last set start.
            // The simulation.robot.x_m etc. should still hold the custom start if it was set.
            simulation.resetSimulation(simulation.robot.x_m, simulation.robot.y_m, simulation.robot.angle_rad);
        } else {
            // Reload predefined track with its current start settings (may have been modified by user)
            const selectedOption = UI.getDOMElements().trackImageSelector.selectedOptions[0];
            if (selectedOption && selectedOption.dataset.fileName) {
                predefinedTrackStart.x_px = parseFloat(selectedOption.dataset.startX);
                predefinedTrackStart.y_px = parseFloat(selectedOption.dataset.startY);
                predefinedTrackStart.angle_deg = parseFloat(selectedOption.dataset.startAngle);

                simulation.loadTrack(
                    selectedOption.dataset.fileName,
                    parseInt(selectedOption.dataset.width),
                    parseInt(selectedOption.dataset.height),
                    predefinedTrackStart.x_px / Config.PIXELS_PER_METER,
                    predefinedTrackStart.y_px / Config.PIXELS_PER_METER,
                    Utils.degreesToRadians(predefinedTrackStart.angle_deg),
                    false, "", // Not custom file
                    (success, actualWidth, actualHeight) => {
                        if (success) {
                            displayCanvas.width = actualWidth;
                            displayCanvas.height = actualHeight;
                        }
                         UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, success, false);
                    }
                );
            } else {
                console.warn("Reset: No valid predefined track selected to reload.");
                 UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, false);
            }
        }
        
        UI.resetPIDDisplay();
        UI.resetLapTimeDisplay(); // Full reset for lap data
        // gameLoop will render the reset state
    }

    function handleTrackSelectionChange() {
        if (isSettingStartPosition) toggleSetStartPositionMode();
        stopSimulation();

        const selectedOption = UI.getDOMElements().trackImageSelector.selectedOptions[0];
        if (!selectedOption || !selectedOption.dataset.fileName) {
            simulation.track.clear(); // Clear track if invalid selection
            UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, false, false);
            return;
        }
        
        currentTrackIsCustom = false;
        currentCustomTrackFile = null;
        currentCustomTrackFilename = "";
        UI.getDOMElements().customTrackInput.value = ''; // Clear file input

        predefinedTrackStart.x_px = parseFloat(selectedOption.dataset.startX);
        predefinedTrackStart.y_px = parseFloat(selectedOption.dataset.startY);
        predefinedTrackStart.angle_deg = parseFloat(selectedOption.dataset.startAngle);

        UI.getDOMElements().startButton.disabled = true; // Disable until loaded

        simulation.loadTrack(
            selectedOption.dataset.fileName,
            parseInt(selectedOption.dataset.width),
            parseInt(selectedOption.dataset.height),
            predefinedTrackStart.x_px / Config.PIXELS_PER_METER,
            predefinedTrackStart.y_px / Config.PIXELS_PER_METER,
            Utils.degreesToRadians(predefinedTrackStart.angle_deg),
            false, "", // Not custom file
            (success, actualWidth, actualHeight) => {
                if (success) {
                    displayCanvas.width = actualWidth;
                    displayCanvas.height = actualHeight;
                }
                UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, success, false);
                if (!success && displayCtx) { // If load failed, clear canvas
                     displayCtx.clearRect(0,0, displayCanvas.width, displayCanvas.height);
                     simulation.track.draw(displayCtx, displayCanvas.width, displayCanvas.height); // Show error message
                }
            }
        );
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
        currentCustomTrackFile = file; // Store the file object
        currentCustomTrackFilename = file.name;
        UI.getDOMElements().trackImageSelector.selectedIndex = -1; // Deselect predefined

        UI.getDOMElements().startButton.disabled = true; // Disable until loaded and start pos set
        
        // For custom tracks, set a default initial position (e.g., center), user MUST set it properly
        // Load track will call the callback where we adjust canvas size
        simulation.loadTrack(
            file, null, null, // Width/height derived from image by Track class
            0,0,0, // Temporary start, will be overridden
            true, file.name,
            (success, actualWidth, actualHeight) => {
                if (success) {
                    displayCanvas.width = actualWidth;
                    displayCanvas.height = actualHeight;
                    // Set a sensible default start for custom tracks, e.g. center top, facing down
                    const defaultStartX_m = actualWidth / Config.PIXELS_PER_METER / 2;
                    const defaultStartY_m = Config.DEFAULT_ROBOT_GEOMETRY.length_m; // A bit from top
                    const defaultStartAngle_rad = Math.PI / 2; // Facing down
                    
                    simulation.robot.resetState(defaultStartX_m, defaultStartY_m, defaultStartAngle_rad);
                    simulation.pidController.reset(); // Also reset PID
                    simulation.totalSimTime_s = 0; // Reset sim time
                    simulation.lapTimer.initialize({x_m: defaultStartX_m, y_m: defaultStartY_m, angle_rad: defaultStartAngle_rad}, 0);


                    alert(`Pista "${file.name}" cargada. Por favor, establece la posición y dirección inicial.`);
                    if (!isSettingStartPosition) toggleSetStartPositionMode(); // Enter mode
                } else {
                    currentTrackIsCustom = false; // Revert on failure
                    currentCustomTrackFile = null;
                    currentCustomTrackFilename = "";
                }
                 UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, success, currentTrackIsCustom);
                 if (!success && displayCtx) {
                     displayCtx.clearRect(0,0, displayCanvas.width, displayCanvas.height);
                     simulation.track.draw(displayCtx, displayCanvas.width, displayCanvas.height); // Show error from track.draw
                 }
            }
        );
    }
    
    function clearCustomTrack() {
        if (isSettingStartPosition) toggleSetStartPositionMode();
        stopSimulation();

        currentTrackIsCustom = false;
        currentCustomTrackFile = null;
        currentCustomTrackFilename = "";
        UI.getDOMElements().customTrackInput.value = '';
        simulation.track.clear(); // Clear current track in simulation object
        
        loadInitialTrack(); // Reload the first (or selected) predefined track
    }


    function toggleSetStartPositionMode() {
        isSettingStartPosition = !isSettingStartPosition;
        const { setStartPositionButton, startButton, simulationCanvas } = UI.getDOMElements();

        if (isSettingStartPosition) {
            if (simulationRunning || !simulation.track.imageData) {
                isSettingStartPosition = false; return; // Cannot set if running or no track
            }
            setStartPositionButton.textContent = "Cancelar Ajuste";
            setStartPositionButton.classList.add('active'); // For styling if needed
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
            if (simulation.track.imageData && startButton) { // Re-enable start if track is loaded
                startButton.disabled = false;
            }
        }
        UI.updateUIForSimulationState(simulationRunning, isSettingStartPosition, simulation.track.imageData !== null, currentTrackIsCustom);
        // Re-render to show/hide instruction text if added in simulation.draw
    }
    
    function drawStartPositionIndicator() {
        if (!displayCtx || !isSettingStartPosition || !startPositionClickPoint_canvasPx.x || !currentMousePosition_canvasPx.x) return;
        
        // Draw a line from click point to current mouse
        if (startPositionClickPoint_canvasPx.x !== currentMousePosition_canvasPx.x || startPositionClickPoint_canvasPx.y !== currentMousePosition_canvasPx.y) {
            displayCtx.save();
            displayCtx.beginPath();
            displayCtx.moveTo(startPositionClickPoint_canvasPx.x, startPositionClickPoint_canvasPx.y);
            displayCtx.lineTo(currentMousePosition_canvasPx.x, currentMousePosition_canvasPx.y);
            displayCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            displayCtx.lineWidth = 2;
            displayCtx.setLineDash([5, 5]);
            displayCtx.stroke();
            displayCtx.setLineDash([]); // Reset line dash
            displayCtx.restore();
        }
        // Text instructions (can also be drawn here or in simulation.draw)
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

        // Temporarily update robot for visual feedback during drag
        simulation.robot.x_m = pos.x / Config.PIXELS_PER_METER;
        simulation.robot.y_m = pos.y / Config.PIXELS_PER_METER;
        simulation.robot.angle_rad = 0; // Will be updated by drag

        document.addEventListener('mousemove', handleDocumentMouseMoveForStartPos);
        document.addEventListener('mouseup', handleDocumentMouseUpForStartPos);
    }

    function handleDocumentMouseMoveForStartPos(event) {
        if (!isSettingStartPosition || !startPositionClickPoint_canvasPx.x) return;
        const pos = Utils.getMousePos(displayCanvas, event);
        currentMousePosition_canvasPx = { x: pos.x, y: pos.y };

        const dx = currentMousePosition_canvasPx.x - startPositionClickPoint_canvasPx.x;
        const dy = currentMousePosition_canvasPx.y - startPositionClickPoint_canvasPx.y;

        if (Math.sqrt(dx * dx + dy * dy) > 5) { // Threshold to start angle definition
            simulation.robot.angle_rad = Math.atan2(dy, dx);
        }
    }

    function handleDocumentMouseUpForStartPos(event) {
        document.removeEventListener('mousemove', handleDocumentMouseMoveForStartPos);
        document.removeEventListener('mouseup', handleDocumentMouseUpForStartPos);
        if (!isSettingStartPosition) return;

        // Finalize robot state with this new start position
        const newStartX_m = simulation.robot.x_m;
        const newStartY_m = simulation.robot.y_m;
        const newStartAngle_rad = simulation.robot.angle_rad;
        
        simulation.resetSimulation(newStartX_m, newStartY_m, newStartAngle_rad); // This also resets trails, PID, lap timer

        console.log(`Nueva posición inicial: X=${newStartX_m.toFixed(3)}m, Y=${newStartY_m.toFixed(3)}m, Angulo=${Utils.radiansToDegrees(newStartAngle_rad).toFixed(1)}deg`);

        // If it was a predefined track, update its dataset for session persistence via reset
        if (!currentTrackIsCustom) {
            const selectedOption = UI.getDOMElements().trackImageSelector.selectedOptions[0];
            if (selectedOption && selectedOption.dataset) {
                selectedOption.dataset.startX = Math.round(newStartX_m * Config.PIXELS_PER_METER);
                selectedOption.dataset.startY = Math.round(newStartY_m * Config.PIXELS_PER_METER);
                selectedOption.dataset.startAngle = Utils.radiansToDegrees(newStartAngle_rad).toFixed(1);
            }
        }
        toggleSetStartPositionMode(); // Exit mode
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

        // Listener for PID VELOCIDAD_BASE to update max AdjPID bar value (example of dynamic config update)
        elems.arduinoVelBaseInput.addEventListener('change', (e) => {
            const baseSpeed = parseFloat(e.target.value) || 110;
            Config.currentMaxValAdjPID = baseSpeed + 255; // Max possible adjustment range
             // If simulation is running, this change might not take effect immediately in PIDController
             // unless explicitly updated. For now, it's for the UI bar.
        });
    }


    document.addEventListener('DOMContentLoaded', () => {
        UI.cacheDOMElements(); // Cache all DOM elements once
        const { simulationCanvas, pixelsPerMeterDisplay } = UI.getDOMElements();
        displayCanvas = simulationCanvas;
        displayCtx = displayCanvas.getContext('2d');
        pixelsPerMeterDisplay.value = Config.PIXELS_PER_METER;


        UI.populateTrackSelector();
        UI.setupFoldableSections();
        UI.setupTabNavigation();
        
        loadInitialAssets(); // This will trigger the rest of the init sequence
    });
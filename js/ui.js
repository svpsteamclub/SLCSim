import {
    MAX_BAR_HEIGHT_PX, currentMaxValError, currentMaxValPTerm, currentMaxValITerm,
    currentMaxValDTerm, currentMaxValAdjPID, MAX_VAL_PWM_BAR, AVAILABLE_TRACKS, PIXELS_PER_METER
} from './config.js';

let domElements = {}; // To store cached DOM elements

export function cacheDOMElements() {
    domElements = {
        trackImageSelector: document.getElementById('trackImageSelector'),
        customTrackInput: document.getElementById('customTrackInput'),
        clearCustomTrackButton: document.getElementById('clearCustomTrackButton'),
        timeStepInput: document.getElementById('timeStep'),
        pixelsPerMeterDisplay: document.getElementById('pixelsPerMeterDisplay'),
        maxRobotSpeedMPSInput: document.getElementById('maxRobotSpeedMPS'),
        motorResponseFactorInput: document.getElementById('motorResponseFactor'),
        sensorNoiseProbInput: document.getElementById('sensorNoiseProb'),
        movementPerturbFactorInput: document.getElementById('movementPerturbFactor'),
        motorDeadbandPWMInput: document.getElementById('motorDeadbandPWM'),
        lineThresholdInput: document.getElementById('lineThreshold'),
        // Robot Geometry (now mostly read-only in simulator view)
        robotWidthInput_actual: document.getElementById('robotWidthInput_actual'),
        robotLengthInput_actual: document.getElementById('robotLengthInput_actual'),
        sideSensorSpreadInput: document.getElementById('sideSensorSpreadInput'),
        sensorForwardOffsetInput: document.getElementById('sensorForwardOffsetInput'),
        sensorDiameterInput: document.getElementById('sensorDiameterInput'),
        // PID
        arduinoKpInput: document.getElementById('arduino_kp'),
        arduinoKiInput: document.getElementById('arduino_ki'),
        arduinoKdInput: document.getElementById('arduino_kd'),
        arduinoVelBaseInput: document.getElementById('arduino_velBase'),
        arduinoIntegralMaxInput: document.getElementById('arduino_integralMax'),
        // Buttons
        startButton: document.getElementById('startButton'),
        stopButton: document.getElementById('stopButton'),
        resetButton: document.getElementById('resetButton'),
        setStartPositionButton: document.getElementById('setStartPositionButton'),
        // Info Display
        errorValSpan: document.getElementById('errorVal'), errorBar: document.getElementById('errorBar'),
        pValSpan: document.getElementById('pVal'), pBar: document.getElementById('pBar'),
        iValSpan: document.getElementById('iVal'), iBar: document.getElementById('iBar'),
        dValSpan: document.getElementById('dVal'), dBar: document.getElementById('dBar'),
        arduinoAjusteValSpan: document.getElementById('arduinoAjusteVal'), adjPIDBar: document.getElementById('adjPIDBar'),
        vLeftValSpan: document.getElementById('vLeftVal'), vLeftBar: document.getElementById('vLeftBar'),
        vRightValSpan: document.getElementById('vRightVal'), vRightBar: document.getElementById('vRightBar'),
        // Lap Times
        currentLapTimeValSpan: document.getElementById('currentLapTimeVal'),
        bestLapTimeValSpan: document.getElementById('bestLapTimeVal'),
        lapTimesTableBody: document.querySelector('#lapTimesTable tbody'),
        // Tabs
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        // Canvases
        simulationCanvas: document.getElementById('simulationCanvas'),
        robotEditorCanvas: document.getElementById('robotEditorCanvas'),
        trackEditorCanvas: document.getElementById('trackEditorCanvas'),

        // --- ADDED/VERIFIED ROBOT EDITOR IDs ---
        robotName: document.getElementById('robotName'),
        saveRobotDesign: document.getElementById('saveRobotDesign'),
        loadRobotDesign: document.getElementById('loadRobotDesign'),
        robotComponentSelector: document.getElementById('robotComponentSelector'),
        addComponentToRobot: document.getElementById('addComponentToRobot'),
        customComponentImage: document.getElementById('customComponentImage'),
        // --- END OF ROBOT EDITOR IDs ---

        // Track Editor specific
        trackGridSize: document.getElementById('trackGridSize'),
        generateRandomTrack: document.getElementById('generateRandomTrack'),
        exportTrackFromEditor: document.getElementById('exportTrackFromEditor'),
        trackPartsPalette: document.getElementById('trackPartsPalette'),
    };
    // Sanity check for one of the problematic elements from trackEditor
    if (!domElements.trackGridSize) {
        console.warn("UI WARNING: trackGridSize element not found during cache!");
    }
    if (!domElements.trackPartsPalette) {
        console.warn("UI WARNING: trackPartsPalette element not found during cache!");
    }

    return domElements;
}

export function getDOMElements() {
    if (Object.keys(domElements).length === 0) {
        cacheDOMElements();
    }
    return domElements;
}


export function populateTrackSelector() {
    const { trackImageSelector } = getDOMElements();
    if (!trackImageSelector) return;
    trackImageSelector.innerHTML = '';

    if (AVAILABLE_TRACKS.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No hay pistas predefinidas";
        trackImageSelector.appendChild(option);
        return;
    }

    AVAILABLE_TRACKS.forEach((track, index) => {
        const option = document.createElement('option');
        option.value = track.fileName; // Store filename as value
        option.textContent = track.displayName;
        // Store all track data in dataset attributes
        option.dataset.fileName = track.fileName;
        option.dataset.width = track.width;
        option.dataset.height = track.height;
        option.dataset.startX = track.startX; // These are in pixels for predefined tracks
        option.dataset.startY = track.startY;
        option.dataset.startAngle = track.startAngle; // Degrees

        if (index === 0) option.selected = true;
        trackImageSelector.appendChild(option);
    });
}

export function updateBar(barElement, value, maxValue, valueTextElement) {
    let absValue = 0;
    let heightPercentage = 0;
    if (valueTextElement && isNaN(parseFloat(valueTextElement.textContent))) {
        heightPercentage = 0;
    } else if (typeof value === 'number' && !isNaN(value)) {
        absValue = Math.abs(value);
        if (maxValue > 0.00001) { // Avoid division by zero or tiny numbers
            heightPercentage = Math.min(100, (absValue / maxValue) * 100);
        }
    }
    if (isNaN(heightPercentage)) heightPercentage = 0;
    if (barElement) barElement.style.height = `${heightPercentage}%`;
}

export function updatePIDDisplay(pidTerms, motorPWMs) {
    const elems = getDOMElements();
    if (pidTerms) {
        elems.errorValSpan.textContent = pidTerms.error.toFixed(2);
        updateBar(elems.errorBar, pidTerms.error, currentMaxValError, elems.errorValSpan);
        elems.pValSpan.textContent = pidTerms.pTerm.toFixed(2);
        updateBar(elems.pBar, pidTerms.pTerm, currentMaxValPTerm, elems.pValSpan);
        elems.iValSpan.textContent = pidTerms.iTerm.toFixed(2);
        updateBar(elems.iBar, pidTerms.iTerm, currentMaxValITerm, elems.iValSpan);
        elems.dValSpan.textContent = pidTerms.dTerm.toFixed(2);
        updateBar(elems.dBar, pidTerms.dTerm, currentMaxValDTerm, elems.dValSpan);
        elems.arduinoAjusteValSpan.textContent = pidTerms.adjPID.toFixed(2);
        updateBar(elems.adjPIDBar, pidTerms.adjPID, currentMaxValAdjPID, elems.arduinoAjusteValSpan);
    }
    if (motorPWMs) {
        elems.vLeftValSpan.textContent = Math.round(motorPWMs.leftPWM);
        updateBar(elems.vLeftBar, motorPWMs.leftPWM, MAX_VAL_PWM_BAR, elems.vLeftValSpan);
        elems.vRightValSpan.textContent = Math.round(motorPWMs.rightPWM);
        updateBar(elems.vRightBar, motorPWMs.rightPWM, MAX_VAL_PWM_BAR, elems.vRightValSpan);
    }
}

export function resetPIDDisplay() {
    const elems = getDOMElements();
    elems.errorValSpan.textContent = "0.00"; updateBar(elems.errorBar, 0, currentMaxValError, elems.errorValSpan);
    elems.pValSpan.textContent = "0.00";   updateBar(elems.pBar, 0, currentMaxValPTerm, elems.pValSpan);
    elems.iValSpan.textContent = "0.00";   updateBar(elems.iBar, 0, currentMaxValITerm, elems.iValSpan);
    elems.dValSpan.textContent = "0.00";   updateBar(elems.dBar, 0, currentMaxValDTerm, elems.dValSpan);
    elems.arduinoAjusteValSpan.textContent = "N/A"; updateBar(elems.adjPIDBar, 0, currentMaxValAdjPID, elems.arduinoAjusteValSpan);
    elems.vLeftValSpan.textContent = "0";  updateBar(elems.vLeftBar, 0, MAX_VAL_PWM_BAR, elems.vLeftValSpan);
    elems.vRightValSpan.textContent = "0"; updateBar(elems.vRightBar, 0, MAX_VAL_PWM_BAR, elems.vRightValSpan);
}

export function updateLapTimeDisplay(lapData) {
    const { currentLapTimeValSpan, bestLapTimeValSpan, lapTimesTableBody } = getDOMElements();
    if (!lapData || !currentLapTimeValSpan || !bestLapTimeValSpan || !lapTimesTableBody ) return; // Add null checks for safety

    currentLapTimeValSpan.textContent = lapData.currentLapTime_s.toFixed(3);
    bestLapTimeValSpan.textContent = lapData.bestLapTime_s ? lapData.bestLapTime_s.toFixed(3) + " s" : "N/A";

    lapTimesTableBody.innerHTML = ''; // Clear previous times
    lapData.last5Laps.forEach(lap => {
        const row = lapTimesTableBody.insertRow();
        row.insertCell().textContent = lap.lapNum;
        row.insertCell().textContent = lap.time_s.toFixed(3);
    });
}

export function resetLapTimeDisplay() {
    const { currentLapTimeValSpan, bestLapTimeValSpan, lapTimesTableBody } = getDOMElements();
     if (!currentLapTimeValSpan || !bestLapTimeValSpan || !lapTimesTableBody ) return; // Add null checks

    currentLapTimeValSpan.textContent = "0.000";
    bestLapTimeValSpan.textContent = "N/A";
    lapTimesTableBody.innerHTML = '';
}

export function updateUIForSimulationState(isRunning, isSettingStart, trackLoaded, isCustomTrackActive) {
    const elems = getDOMElements();
    const generalDisable = isRunning || isSettingStart;

    elems.startButton.disabled = isRunning || isSettingStart || !trackLoaded;
    elems.stopButton.disabled = !isRunning;
    elems.resetButton.disabled = isRunning || isSettingStart;
    elems.setStartPositionButton.disabled = isRunning || !trackLoaded;

    [ elems.timeStepInput, elems.maxRobotSpeedMPSInput, elems.motorResponseFactorInput,
      elems.sensorNoiseProbInput, elems.movementPerturbFactorInput, elems.motorDeadbandPWMInput, elems.lineThresholdInput,
      elems.arduinoKpInput, elems.arduinoKiInput, elems.arduinoKdInput, elems.arduinoVelBaseInput, elems.arduinoIntegralMaxInput
    ].forEach(input => { if (input) input.disabled = generalDisable; });

    elems.trackImageSelector.disabled = generalDisable || isCustomTrackActive || (AVAILABLE_TRACKS.length === 0);
    elems.customTrackInput.disabled = generalDisable || isCustomTrackActive;
    elems.clearCustomTrackButton.style.display = isCustomTrackActive ? 'inline-block' : 'none';
    elems.clearCustomTrackButton.disabled = generalDisable || !isCustomTrackActive;
}

export function setupFoldableSections() {
    const foldableTitles = document.querySelectorAll('.foldable-title');
    foldableTitles.forEach(title => {
        title.addEventListener('click', () => {
            const content = title.nextElementSibling;
            const indicator = title.querySelector('.fold-indicator');
            if (content && content.classList.contains('foldable-content')) {
                const isHidden = content.style.display === 'none' || content.style.display === '';
                content.style.display = isHidden ? 'block' : 'none';
                if (indicator) indicator.textContent = isHidden ? '[-]' : '[+]';
            }
        });
    });
}

export function setupTabNavigation() {
    const { tabButtons, tabContents } = getDOMElements();
    if (!tabButtons || !tabContents) return; // Safety check

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const targetTab = button.dataset.tab;
            tabContents.forEach(content => {
                content.style.display = content.id === `${targetTab}Content` ? 'block' : 'none';
            });
        });
    });
}

export function updateRobotGeometryDisplay(geometry) {
    const elems = getDOMElements();
    if (!geometry || !elems.robotWidthInput_actual) return; // Safety check

    elems.robotWidthInput_actual.value = geometry.width_m.toFixed(3);
    elems.robotLengthInput_actual.value = geometry.length_m.toFixed(3);
    elems.sideSensorSpreadInput.value = geometry.sensorSpread_m.toFixed(3);
    elems.sensorForwardOffsetInput.value = geometry.sensorOffset_m.toFixed(3);
    elems.sensorDiameterInput.value = geometry.sensorDiameter_m.toFixed(3);
}

export function getSimulationParameters() {
    const elems = getDOMElements();
    const baseSpeed = parseFloat(elems.arduinoVelBaseInput.value) || 110;

    return {
        timeStep: parseFloat(elems.timeStepInput.value) || 0.01,
        maxRobotSpeedMPS: parseFloat(elems.maxRobotSpeedMPSInput.value) || 1.0,
        motorResponseFactor: parseFloat(elems.motorResponseFactorInput.value) || 0.03,
        sensorNoiseProb: parseFloat(elems.sensorNoiseProbInput.value) || 0.0,
        movementPerturbFactor: parseFloat(elems.movementPerturbFactorInput.value) || 0.0,
        motorDeadbandPWM: parseInt(elems.motorDeadbandPWMInput.value) || 5,
        lineThreshold: parseInt(elems.lineThresholdInput.value) || 30,
        pid: {
            kp: parseFloat(elems.arduinoKpInput.value) || 120,
            ki: parseFloat(elems.arduinoKiInput.value) || 3,
            kd: parseFloat(elems.arduinoKdInput.value) || 15,
            integralMax: parseFloat(elems.arduinoIntegralMaxInput.value) || 250,
            baseSpeed: baseSpeed,
        },
    };
}
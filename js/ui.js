// js/ui.js
import {
    MAX_BAR_HEIGHT_PX, currentMaxValError, currentMaxValPTerm, currentMaxValITerm,
    currentMaxValDTerm, currentMaxValAdjPID, MAX_VAL_PWM_BAR, AVAILABLE_TRACKS, PIXELS_PER_METER
} from './config.js';

let domElements = {}; 

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
        robotWidthInput_actual: document.getElementById('robotWidthInput_actual'),
        robotLengthInput_actual: document.getElementById('robotLengthInput_actual'),
        sideSensorSpreadInput: document.getElementById('sideSensorSpreadInput'),
        sensorForwardOffsetInput: document.getElementById('sensorForwardOffsetInput'),
        sensorDiameterInput: document.getElementById('sensorDiameterInput'),
        arduinoKpInput: document.getElementById('arduino_kp'),
        arduinoKiInput: document.getElementById('arduino_ki'),
        arduinoKdInput: document.getElementById('arduino_kd'),
        arduinoVelBaseInput: document.getElementById('arduino_velBase'),
        arduinoIntegralMaxInput: document.getElementById('arduino_integralMax'),
        startButton: document.getElementById('startButton'),
        stopButton: document.getElementById('stopButton'),
        resetButton: document.getElementById('resetButton'),
        setStartPositionButton: document.getElementById('setStartPositionButton'),
        errorValSpan: document.getElementById('errorVal'), errorBar: document.getElementById('errorBar'),
        pValSpan: document.getElementById('pVal'), pBar: document.getElementById('pBar'),
        iValSpan: document.getElementById('iVal'), iBar: document.getElementById('iBar'),
        dValSpan: document.getElementById('dVal'), dBar: document.getElementById('dBar'),
        arduinoAjusteValSpan: document.getElementById('arduinoAjusteVal'), adjPIDBar: document.getElementById('adjPIDBar'),
        vLeftValSpan: document.getElementById('vLeftVal'), vLeftBar: document.getElementById('vLeftBar'),
        vRightValSpan: document.getElementById('vRightVal'), vRightBar: document.getElementById('vRightBar'),
        currentLapTimeValSpan: document.getElementById('currentLapTimeVal'),
        bestLapTimeValSpan: document.getElementById('bestLapTimeVal'),
        lapTimesTableBody: document.querySelector('#lapTimesTable tbody'),
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        simulationCanvas: document.getElementById('simulationCanvas'),
        robotEditorCanvas: document.getElementById('robotEditorCanvas'),
        trackEditorCanvas: document.getElementById('trackEditorCanvas'),
        robotName: document.getElementById('robotName'),
        saveRobotDesign: document.getElementById('saveRobotDesign'),
        loadRobotDesign: document.getElementById('loadRobotDesign'),
        robotComponentSelector: document.getElementById('robotComponentSelector'),
        addComponentToRobot: document.getElementById('addComponentToRobot'),
        customComponentImage: document.getElementById('customComponentImage'),
        
        trackEditorTrackName: document.getElementById('trackEditorTrackName'),      
        saveTrackDesignButton: document.getElementById('saveTrackDesignButton'),  
        loadTrackDesignInput: document.getElementById('loadTrackDesignInput'),    
        trackGridSize: document.getElementById('trackGridSize'),
        generateRandomTrack: document.getElementById('generateRandomTrack'),
        exportTrackFromEditor: document.getElementById('exportTrackFromEditor'),
        trackPartsPalette: document.getElementById('trackPartsPalette'),
        toggleEraseModeButton: document.getElementById('toggleEraseModeButton'), 
    };
    return domElements;
}

export function getDOMElements() {
    if (Object.keys(domElements).length === 0) {
        cacheDOMElements();
    }
    return domElements;
}

export function getSimulationParameters() {
    const elems = getDOMElements();

    console.log("UI RAW VALUES FROM INPUTS: Kp:", elems.arduinoKpInput.value,
                "Ki:", elems.arduinoKiInput.value,
                "Kd:", elems.arduinoKdInput.value,
                "BaseVel:", elems.arduinoVelBaseInput.value,
                "IntMax:", elems.arduinoIntegralMaxInput.value);

    let kp = parseFloat(elems.arduinoKpInput.value);
    let ki = parseFloat(elems.arduinoKiInput.value);
    let kd = parseFloat(elems.arduinoKdInput.value);
    let baseSpeed = parseFloat(elems.arduinoVelBaseInput.value);
    let integralMax = parseFloat(elems.arduinoIntegralMaxInput.value);

    // Default to 0 if NaN (e.g., empty input), otherwise use the parsed value (which could be 0 if user typed "0")
    kp = isNaN(kp) ? 0 : kp;
    ki = isNaN(ki) ? 0 : ki;
    kd = isNaN(kd) ? 0 : kd;
    baseSpeed = isNaN(baseSpeed) ? 0 : baseSpeed;
    integralMax = isNaN(integralMax) ? 0 : integralMax;

    const pidSettings = {
        kp: kp,
        ki: ki,
        kd: kd,
        integralMax: integralMax,
        baseSpeed: baseSpeed,
    };
    
    console.log("UI PARSED PID SETTINGS to be used:", JSON.stringify(pidSettings));

    let simMaxSpeed = parseFloat(elems.maxRobotSpeedMPSInput.value);
    simMaxSpeed = isNaN(simMaxSpeed) ? ( (kp === 0 && ki === 0 && kd === 0 && baseSpeed === 0) ? 0 : 1.0 ) : simMaxSpeed;

    let simDeadband = parseInt(elems.motorDeadbandPWMInput.value);
    simDeadband = isNaN(simDeadband) ? ( (kp === 0 && ki === 0 && kd === 0 && baseSpeed === 0) ? 0 : 5) : simDeadband;


    return {
        timeStep: parseFloat(elems.timeStepInput.value) || 0.01,
        maxRobotSpeedMPS: simMaxSpeed,
        motorResponseFactor: parseFloat(elems.motorResponseFactorInput.value) || 0.03,
        sensorNoiseProb: parseFloat(elems.sensorNoiseProbInput.value) || 0.0,
        movementPerturbFactor: parseFloat(elems.movementPerturbFactorInput.value) || 0.0,
        motorDeadbandPWM: simDeadband,
        lineThreshold: parseInt(elems.lineThresholdInput.value) || 30,
        pid: pidSettings,
    };
}

// ... (rest of ui.js functions: populateTrackSelector, updateBar, updatePIDDisplay, etc. remain unchanged from your last full version)
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
        option.value = track.fileName; 
        option.textContent = track.displayName;
        option.dataset.fileName = track.fileName;
        option.dataset.width = track.width;
        option.dataset.height = track.height;
        option.dataset.startX = track.startX; 
        option.dataset.startY = track.startY;
        option.dataset.startAngle = track.startAngle; 

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
        if (maxValue > 0.00001) { 
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
        // Adjust max for AdjPID bar based on current baseSpeed if it changed
        const baseSpeedForBar = parseFloat(elems.arduinoVelBaseInput.value) || 0;
        // currentMaxValAdjPID = baseSpeedForBar + 255; // Max theoretical range
        // A more practical max for the bar could be related to VELOCIDAD_BASE * 2 or similar
        let dynamicMaxAdjPID = Math.max(255, baseSpeedForBar * 1.5 + Math.abs(pidTerms.adjPID) * 1.1); // Make it dynamic
        if (pidSettings && pidSettings.baseSpeed === 0 && pidSettings.kp === 0 && pidSettings.ki ===0 && pidSettings.kd ===0 ) {
            dynamicMaxAdjPID = 50; // A small sensible max if everything is zero
        }


        updateBar(elems.adjPIDBar, pidTerms.adjPID, dynamicMaxAdjPID, elems.arduinoAjusteValSpan);
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
    if (!lapData || !currentLapTimeValSpan || !bestLapTimeValSpan || !lapTimesTableBody ) return; 

    currentLapTimeValSpan.textContent = lapData.currentLapTime_s.toFixed(3);
    bestLapTimeValSpan.textContent = lapData.bestLapTime_s ? lapData.bestLapTime_s.toFixed(3) + " s" : "N/A";

    lapTimesTableBody.innerHTML = ''; 
    lapData.last5Laps.forEach(lap => {
        const row = lapTimesTableBody.insertRow();
        row.insertCell().textContent = lap.lapNum;
        row.insertCell().textContent = lap.time_s.toFixed(3);
    });
}

export function resetLapTimeDisplay() {
    const { currentLapTimeValSpan, bestLapTimeValSpan, lapTimesTableBody } = getDOMElements();
     if (!currentLapTimeValSpan || !bestLapTimeValSpan || !lapTimesTableBody ) return; 

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
    if (!tabButtons || !tabContents) return; 

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
    if (!geometry || !elems.robotWidthInput_actual) return; 

    elems.robotWidthInput_actual.value = geometry.width_m.toFixed(3);
    elems.robotLengthInput_actual.value = geometry.length_m.toFixed(3);
    elems.sideSensorSpreadInput.value = geometry.sensorSpread_m.toFixed(3);
    elems.sensorForwardOffsetInput.value = geometry.sensorOffset_m.toFixed(3);
    elems.sensorDiameterInput.value = geometry.sensorDiameter_m.toFixed(3);
}
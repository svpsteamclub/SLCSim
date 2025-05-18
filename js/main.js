document.addEventListener('DOMContentLoaded', () => {
    // --- Inicialización de CodeMirror (Opcional pero recomendado) ---
    const codeEditorTextarea = document.getElementById('arduinoCode');
    const cmEditor = CodeMirror.fromTextArea(codeEditorTextarea, {
        lineNumbers: true,
        mode: "text/x-c++src", // Modo C/C++ para Arduino
        theme: "material-darker", // Un tema oscuro, puedes elegir otros
        matchBrackets: true,
        autoCloseBrackets: true,
    });

    // --- Configuración de Editores ---
    const numSensorsInput = document.getElementById('numSensors');
    const sensorSpacingInput = document.getElementById('sensorSpacing');
    const robotSpeedInput = document.getElementById('robotSpeed');

    const trackEditor = new TrackEditor('trackEditorCanvas', 'simulationCanvas');
    document.getElementById('btnClearTrack').addEventListener('click', () => trackEditor.clearTrack());
    document.getElementById('lineColor').addEventListener('input', (e) => trackEditor.setLineColor(e.target.value));
    document.getElementById('trackBgColor').addEventListener('input', (e) => trackEditor.setBgColor(e.target.value));
    // La herramienta de "Dibujar Línea" ya está activa por defecto con el mouse.
    // Si quieres más herramientas (borrador, etc.), necesitarás más lógica.

    // --- Robot Inicial ---
    // Posición inicial y configuración por defecto del robot.
    // Estos valores podrían venir de los inputs del editor de robot.
    let robot = new Robot(
        document.getElementById('simulationCanvas').width / 2,
        document.getElementById('simulationCanvas').height - 50,
        parseInt(numSensorsInput.value),
        parseInt(sensorSpacingInput.value),
        parseFloat(robotSpeedInput.value)
    );

    // --- Intérprete y Simulación ---
    const serialMonitorEl = document.getElementById('serialMonitorOutput');
    let interpreter = new ArduinoInterpreter(robot, serialMonitorEl);
    const simulation = new Simulation('simulationCanvas', robot, trackEditor, interpreter);

    // --- Event Listeners para Controles ---
    document.getElementById('btnStart').addEventListener('click', () => simulation.start());
    document.getElementById('btnPause').addEventListener('click', () => simulation.pause());
    document.getElementById('btnReset').addEventListener('click', () => {
        // Al resetear, también podríamos querer recargar el código y re-crear el robot
        // con los valores actuales de los editores.
        robot = new Robot(
            document.getElementById('simulationCanvas').width / 2,
            document.getElementById('simulationCanvas').height - 50,
            parseInt(numSensorsInput.value),
            parseInt(sensorSpacingInput.value),
            parseFloat(robotSpeedInput.value)
        );
        interpreter = new ArduinoInterpreter(robot, serialMonitorEl); // Nuevo intérprete con nuevo robot
        // Cargar el código actual al nuevo intérprete
        const currentCode = cmEditor.getValue(); // Obtener código de CodeMirror
        interpreter.compileAndLoad(currentCode);
        
        simulation.robot = robot; // Actualizar robot en la simulación
        simulation.interpreter = interpreter; // Actualizar intérprete
        simulation.reset(); // Ahora el reset de la simulación
    });

    document.getElementById('simSpeed').addEventListener('input', (e) => {
        simulation.setSpeedFactor(parseFloat(e.target.value));
    });

    document.getElementById('btnUploadCode').addEventListener('click', () => {
        const userCode = cmEditor.getValue(); // Obtener código de CodeMirror
        // Podrías querer pausar la simulación aquí si está corriendo
        simulation.pause(); 
        
        // Es importante re-crear el robot si los parámetros del editor de robot cambiaron
        // y el usuario espera que se apliquen al "subir" el código.
        robot = new Robot(
            simulation.robot.x, // Mantener posición actual o resetear
            simulation.robot.y,
            parseInt(numSensorsInput.value),
            parseInt(sensorSpacingInput.value),
            parseFloat(robotSpeedInput.value)
        );
        robot.angle = simulation.robot.angle; // Mantener ángulo actual

        interpreter = new ArduinoInterpreter(robot, serialMonitorEl);
        
        if (interpreter.compileAndLoad(userCode)) {
            simulation.robot = robot; // Actualizar la instancia del robot en la simulación
            simulation.interpreter = interpreter; // Actualizar el intérprete
            // Opcionalmente, resetear la simulación para empezar de nuevo con el nuevo código/robot
            simulation.reset(); 
            // O solo dibujar el estado actual
            // simulation.clearCanvas();
            // simulation.trackEditor.transferToSimulation();
            // simulation.robot.draw(simulation.ctx);
            alert("Código cargado y robot actualizado. Presiona Iniciar.");
        } else {
            alert("Error al cargar el código. Revisa el Serial Monitor y la consola del navegador.");
        }
    });

    // Dibujo inicial (robot en posición de reset)
    simulation.reset();
});
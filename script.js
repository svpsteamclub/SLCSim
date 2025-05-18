// --- Variables Globales y Configuración Inicial ---
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

// Elementos del DOM para controles
const numSensorsInput = document.getElementById('numSensors');
const sensorSpacingInput = document.getElementById('sensorSpacing');
const sensorOffsetInput = document.getElementById('sensorOffset');
const robotSpeedInput = document.getElementById('robotSpeed');
const trackColorInput = document.getElementById('trackColor');
const bgColorInput = document.getElementById('bgColor');
const lineWidthInput = document.getElementById('lineWidth');
const robotLogicCodeTextarea = document.getElementById('robotLogicCode');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const resetButton = document.getElementById('resetButton');
const drawTrackButton = document.getElementById('drawTrackButton'); // Añadir

let simulationRunning = false;
let animationFrameId;

// --- Objetos de la Simulación ---
let robot = {
    x: 100, // Posición inicial
    y: 100,
    angle: 0, // en radianes
    width: 30,
    height: 40,
    color: 'blue',
    sensors: [],
    maxSpeed: 2, // px por ciclo
    leftMotorSpeed: 0, // -1 a 1
    rightMotorSpeed: 0 // -1 a 1
};

let track = {
    points: [], // Array de {x, y} para dibujar la pista
    lineColor: '#000000',
    bgColor: '#FFFFFF',
    lineWidth: 10,
    image: null // Para guardar la pista renderizada y hacer lecturas de pixel
};

// --- Funciones de Utilidad para Tabs ---
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// --- Funciones de Configuración ---
function updateRobotConfig() {
    robot.maxSpeed = parseFloat(robotSpeedInput.value);
    // Recalcular posiciones de sensores
    robot.sensors = [];
    const numSensors = parseInt(numSensorsInput.value);
    const spacing = parseInt(sensorSpacingInput.value);
    const offsetForward = parseInt(sensorOffsetInput.value); // Distancia hacia adelante desde el centro del robot
    const totalWidth = (numSensors - 1) * spacing;

    for (let i = 0; i < numSensors; i++) {
        // Coordenadas relativas al centro del robot (0,0) y orientación 0 (hacia arriba)
        // x: -totalWidth / 2 + i * spacing
        // y: -offsetForward (sensores delante del centro de rotación)
        robot.sensors.push({
            x_rel: -totalWidth / 2 + i * spacing, // Posición X relativa al centro del robot
            y_rel: -offsetForward, // Posición Y relativa al centro (negativo = adelante)
            value: 0 // 0 para blanco, 1 para línea
        });
    }
    console.log("Robot config updated:", robot);
    draw(); // Redibujar con la nueva configuración
}

function updateTrackConfig() {
    track.lineColor = trackColorInput.value;
    track.bgColor = bgColorInput.value;
    track.lineWidth = parseInt(lineWidthInput.value);
    // Si ya hay una pista dibujada, se necesita redibujar con nuevos colores/grosor
    if (track.points.length > 0) {
        renderTrackToImage(); // Renderiza la pista a una imagen interna para lectura de píxeles
    }
    draw(); // Redibujar todo
}


// --- Lógica de la Pista ---
let isDrawingTrack = false;
let currentTrackPoints = [];

function startDrawingTrack() {
    isDrawingTrack = true;
    currentTrackPoints = [];
    track.points = []; // Limpiar pista anterior
    track.image = null; // Limpiar imagen de pista cacheada
    canvas.addEventListener('mousedown', handleTrackDrawStart);
    canvas.addEventListener('mousemove', handleTrackDrawMove);
    canvas.addEventListener('mouseup', handleTrackDrawEnd);
    canvas.addEventListener('mouseleave', handleTrackDrawEnd); // Si sale del canvas
    drawTrackButton.textContent = "Finalizar Dibujo";
    drawTrackButton.removeEventListener('click', startDrawingTrack);
    drawTrackButton.addEventListener('click', stopDrawingTrack);
    console.log("Modo dibujo de pista activado.");
}

function stopDrawingTrack() {
    isDrawingTrack = false;
    canvas.removeEventListener('mousedown', handleTrackDrawStart);
    canvas.removeEventListener('mousemove', handleTrackDrawMove);
    canvas.removeEventListener('mouseup', handleTrackDrawEnd);
    canvas.removeEventListener('mouseleave', handleTrackDrawEnd);
    if (currentTrackPoints.length > 1) {
        track.points.push([...currentTrackPoints]); // Guardar el trazo actual como un segmento
    }
    currentTrackPoints = []; // Limpiar para el próximo trazo si se quisiera continuar
    renderTrackToImage(); // Importante: renderizar la pista a una imagen oculta para la detección
    drawTrackButton.textContent = "Dibujar Pista Manualmente";
    drawTrackButton.removeEventListener('click', stopDrawingTrack);
    drawTrackButton.addEventListener('click', startDrawingTrack);
    console.log("Modo dibujo de pista desactivado. Pista guardada:", track.points);
    draw();
}

let drawingPath = false;
function handleTrackDrawStart(event) {
    if (!isDrawingTrack) return;
    drawingPath = true;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    currentTrackPoints = [{ x, y }]; // Iniciar un nuevo trazo
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function handleTrackDrawMove(event) {
    if (!isDrawingTrack || !drawingPath) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    currentTrackPoints.push({ x, y });

    // Dibujar en tiempo real
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar canvas
    drawBackground(); // Dibujar fondo
    // Dibujar segmentos ya guardados
    track.points.forEach(segment => {
        if (segment.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(segment[0].x, segment[0].y);
        for (let i = 1; i < segment.length; i++) {
            ctx.lineTo(segment[i].x, segment[i].y);
        }
        ctx.strokeStyle = track.lineColor;
        ctx.lineWidth = track.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    });
    // Dibujar segmento actual
    if (currentTrackPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(currentTrackPoints[0].x, currentTrackPoints[0].y);
        for (let i = 1; i < currentTrackPoints.length; i++) {
            ctx.lineTo(currentTrackPoints[i].x, currentTrackPoints[i].y);
        }
        ctx.strokeStyle = track.lineColor; // Usar color de la pista
        ctx.lineWidth = track.lineWidth; // Usar grosor de la pista
        ctx.stroke();
    }
    drawRobot(); // Asegurarse de que el robot se dibuje encima
}

function handleTrackDrawEnd(event) {
    if (!isDrawingTrack || !drawingPath) return;
    drawingPath = false;
    if (currentTrackPoints.length > 1) {
        track.points.push([...currentTrackPoints]); // Guardar el trazo como un segmento
    }
    // No limpiar currentTrackPoints aquí si quieres permitir múltiples trazos sin reactivar el modo
    // renderTrackToImage(); // No aquí, sino al finalizar el modo dibujo
    console.log("Trazo finalizado. Puntos actuales:", currentTrackPoints);
}


function loadPresetTrack() {
    // Ejemplo de pista predefinida (un óvalo simple)
    track.points = []; // Limpiar cualquier dibujo manual
    const N_POINTS = 100;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusX = canvas.width / 3;
    const radiusY = canvas.height / 4;
    let segment = [];
    for (let i = 0; i <= N_POINTS; i++) {
        const angle = (i / N_POINTS) * 2 * Math.PI;
        segment.push({
            x: centerX + radiusX * Math.cos(angle),
            y: centerY + radiusY * Math.sin(angle)
        });
    }
    track.points.push(segment);
    renderTrackToImage();
    draw();
}

// Función para renderizar la pista a un canvas oculto (o a un objeto ImageData)
// Esto es crucial para una detección de línea eficiente
function renderTrackToImage() {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offCtx = offscreenCanvas.getContext('2d');

    // Dibujar fondo
    offCtx.fillStyle = track.bgColor;
    offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Dibujar línea
    offCtx.strokeStyle = track.lineColor;
    offCtx.lineWidth = track.lineWidth;
    offCtx.lineCap = "round";
    offCtx.lineJoin = "round";

    track.points.forEach(segment => {
        if (segment.length < 2) return;
        offCtx.beginPath();
        offCtx.moveTo(segment[0].x, segment[0].y);
        for (let i = 1; i < segment.length; i++) {
            offCtx.lineTo(segment[i].x, segment[i].y);
        }
        offCtx.stroke();
    });
    track.image = offCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    console.log("Track rendered to internal image for collision detection.");
}


// --- Lógica del Robot (Simulación Arduino) ---
let userLoopFunction = () => {}; // Placeholder

function compileUserLogic() {
    const code = robotLogicCodeTextarea.value;
    try {
        // Envolvemos el código del usuario en una función que podamos llamar.
        // Proporcionamos las funciones 'readSensor' y 'motor' en su scope.
        userLoopFunction = new Function(code + "\nloop();"); // Asume que el usuario define loop()
        console.log("Lógica del usuario compilada exitosamente.");
    } catch (e) {
        console.error("Error al compilar la lógica del usuario:", e);
        alert("Error en tu código: " + e.message);
        userLoopFunction = () => { motor(0,0); console.warn("Lógica de usuario con error, robot detenido.") }; // Fallback
    }
}

// API para la lógica del usuario (simulando funciones de Arduino)
function readSensor(index) {
    if (index < 0 || index >= robot.sensors.length) {
        console.warn(`Sensor con índice ${index} no existe.`);
        return 0; // O undefined, o lanzar error
    }
    // Coordenadas globales del sensor
    const sensor = robot.sensors[index];
    const cosAngle = Math.cos(robot.angle);
    const sinAngle = Math.sin(robot.angle);

    // Rotar el punto relativo del sensor y luego trasladarlo a la posición del robot
    const sensorGlobalX = robot.x + (sensor.x_rel * cosAngle - sensor.y_rel * sinAngle);
    const sensorGlobalY = robot.y + (sensor.x_rel * sinAngle + sensor.y_rel * cosAngle);

    // Comprobar color del pixel en la imagen de la pista
    if (!track.image) return 0; // No hay pista renderizada

    const x = Math.round(sensorGlobalX);
    const y = Math.round(sensorGlobalY);

    if (x < 0 || x >= track.image.width || y < 0 || y >= track.image.height) {
        return 0; // Sensor fuera del canvas
    }

    // imageData.data es un array plano [R,G,B,A, R,G,B,A, ...]
    const pixelIndex = (y * track.image.width + x) * 4;
    const r = track.image.data[pixelIndex];
    const g = track.image.data[pixelIndex + 1];
    const b = track.image.data[pixelIndex + 2];

    // Compara con el color de la línea (simplificado, podrías usar una tolerancia)
    // Convertir track.lineColor (hex) a RGB
    const targetR = parseInt(track.lineColor.slice(1, 3), 16);
    const targetG = parseInt(track.lineColor.slice(3, 5), 16);
    const targetB = parseInt(track.lineColor.slice(5, 7), 16);

    const colorThreshold = 30; // Tolerancia para la comparación de colores
    if (Math.abs(r - targetR) < colorThreshold &&
        Math.abs(g - targetG) < colorThreshold &&
        Math.abs(b - targetB) < colorThreshold) {
        robot.sensors[index].value = 1; // Está en la línea
        return 1;
    } else {
        robot.sensors[index].value = 0; // No está en la línea
        return 0;
    }
}

function motor(leftSpeed, rightSpeed) {
    // Limitar velocidad entre -1 y 1
    robot.leftMotorSpeed = Math.max(-1, Math.min(1, leftSpeed));
    robot.rightMotorSpeed = Math.max(-1, Math.min(1, rightSpeed));
}


// --- Motor de Simulación ---
function updateSimulation() {
    if (!simulationRunning) return;

    // 1. Ejecutar lógica del usuario (que llama a readSensor y motor)
    try {
        userLoopFunction();
    } catch (e) {
        console.error("Error durante la ejecución de loop():", e);
        motor(0,0); // Detener robot si hay error en el loop
        // Podrías detener la simulación aquí o mostrar un mensaje más persistente.
    }


    // 2. Actualizar estado del robot basado en velocidades de motores
    const vL = robot.leftMotorSpeed * robot.maxSpeed;
    const vR = robot.rightMotorSpeed * robot.maxSpeed;

    // Modelo de tracción diferencial simplificado
    // Si las velocidades son iguales, se mueve recto
    // Si son diferentes, gira.
    // dAngle = (vR - vL) / robot.width; // robot.width es la distancia entre ruedas
    // dx = (vL + vR) / 2 * cos(angle + dAngle/2)
    // dy = (vL + vR) / 2 * sin(angle + dAngle/2)

    const averageSpeed = (vL + vR) / 2;
    const dAngle = (vR - vL) / robot.width; // robot.width aquí es la base entre "ruedas"

    robot.angle += dAngle;
    // Normalizar ángulo entre 0 y 2*PI o -PI y PI si se prefiere
    robot.angle = (robot.angle + 2 * Math.PI) % (2 * Math.PI);


    // El movimiento es en la dirección del nuevo ángulo
    robot.x += averageSpeed * Math.cos(robot.angle);
    robot.y += averageSpeed * Math.sin(robot.angle);


    // (Opcional) Limitar el robot a los bordes del canvas
    // if (robot.x < 0) robot.x = 0;
    // if (robot.x > canvas.width) robot.x = canvas.width;
    // if (robot.y < 0) robot.y = 0;
    // if (robot.y > canvas.height) robot.y = canvas.height;

    draw();
    animationFrameId = requestAnimationFrame(updateSimulation);
}


// --- Funciones de Dibujo ---
function drawBackground() {
    ctx.fillStyle = track.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTrack() {
    if (track.image) {
        // Si la pista está pre-renderizada en track.image, la dibujamos directamente.
        // Esto es más rápido que redibujar los puntos cada vez.
        // Para ello, necesitamos poner la ImageData en el canvas.
        // Creamos un canvas temporal si no queremos afectar el estado de 'ctx' directamente
        // o simplemente usamos ctx.putImageData.
        ctx.putImageData(track.image, 0, 0);
    } else if (track.points.length > 0) {
        // Fallback si track.image no está lista (ej. durante el dibujo inicial)
        ctx.strokeStyle = track.lineColor;
        ctx.lineWidth = track.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        track.points.forEach(segment => {
            if (segment.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(segment[0].x, segment[0].y);
            for (let i = 1; i < segment.length; i++) {
                ctx.lineTo(segment[i].x, segment[i].y);
            }
            ctx.stroke();
        });
    }
}

function drawRobot() {
    ctx.save(); // Guardar estado del canvas (transformaciones, estilos)

    // Mover el origen del canvas al centro del robot y rotar
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.angle);

    // Dibujar cuerpo del robot (un rectángulo centrado)
    ctx.fillStyle = robot.color;
    ctx.fillRect(-robot.width / 2, -robot.height / 2, robot.width, robot.height);

    // Dibujar una flecha o indicador de dirección
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(0, -robot.height / 2 - 5); // Punta de la flecha
    ctx.lineTo(5, -robot.height / 2);
    ctx.lineTo(-5, -robot.height / 2);
    ctx.closePath();
    ctx.fill();


    // Dibujar sensores
    robot.sensors.forEach(sensor => {
        // Las coordenadas x_rel, y_rel ya están relativas al centro del robot
        // y la rotación del canvas ya está aplicada.
        ctx.beginPath();
        ctx.arc(sensor.x_rel, sensor.y_rel, 3, 0, 2 * Math.PI); // Radio del sensor = 3px
        ctx.fillStyle = sensor.value === 1 ? 'red' : 'grey'; // Rojo si detecta línea, gris si no
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });

    ctx.restore(); // Restaurar estado del canvas
}

function draw() {
    // Ajustar tamaño del canvas al de su contenedor (hacerlo responsivo)
    // Esto se debería hacer con cuidado para no borrar el contenido si no es necesario
    // o si el tamaño realmente no ha cambiado.
    // Por simplicidad, lo ajustamos y redibujamos todo.
    // Una mejor aproximación sería hacerlo solo al inicio o en 'resize'.
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        // Si el tamaño del canvas cambia, la pista pre-renderizada (track.image) se invalida.
        if (track.points.length > 0) renderTrackToImage();
    }


    ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar
    drawBackground(); // Dibujar fondo primero
    drawTrack();      // Luego la pista
    drawRobot();      // Finalmente el robot encima
}

// --- Controles de Simulación ---
function startSimulation() {
    if (simulationRunning) return;
    if (track.points.length === 0 || !track.image) {
        alert("Por favor, dibuja o carga una pista primero.");
        return;
    }
    compileUserLogic(); // Compilar la lógica del usuario antes de empezar
    updateRobotConfig(); // Asegurarse que la config del robot está actualizada
    simulationRunning = true;
    stopButton.disabled = false;
    startButton.disabled = true;
    // Deshabilitar controles de config mientras corre
    document.querySelectorAll('.controls-area input, .controls-area button, .controls-area textarea').forEach(el => {
        if (!el.closest('.simulation-controls')) el.disabled = true;
    });
    animationFrameId = requestAnimationFrame(updateSimulation);
}

function stopSimulation() {
    simulationRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    stopButton.disabled = true;
    startButton.disabled = false;
    // Habilitar controles de config
    document.querySelectorAll('.controls-area input, .controls-area button, .controls-area textarea').forEach(el => {
        el.disabled = false;
    });
}

function resetSimulation() {
    stopSimulation();
    // Reiniciar posición del robot (p.ej., al inicio de la pista o un punto fijo)
    // Si la pista tiene un punto de inicio definido:
    if (track.points.length > 0 && track.points[0].length > 0) {
        robot.x = track.points[0][0].x;
        robot.y = track.points[0][0].y;
        // Calcular ángulo inicial para apuntar al siguiente punto (opcional, más complejo)
        if (track.points[0].length > 1) {
            const p1 = track.points[0][0];
            const p2 = track.points[0][1];
            robot.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        } else {
            robot.angle = 0; // O el ángulo por defecto
        }

    } else { // Posición por defecto si no hay pista o pista vacía
        robot.x = canvas.width / 10;
        robot.y = canvas.height / 2;
        robot.angle = 0; // Apuntando a la derecha
    }
    robot.leftMotorSpeed = 0;
    robot.rightMotorSpeed = 0;
    robot.sensors.forEach(s => s.value = 0); // Resetear lectura de sensores

    // Volver a habilitar los controles de config (ya lo hace stopSimulation)
    // y posiblemente resetear el código a un ejemplo si es necesario.
    draw(); // Redibujar en el estado reseteado
}


// --- Inicialización y Event Listeners ---
window.addEventListener('load', () => {
    // Setear tamaño inicial del canvas
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Cargar configuraciones por defecto o guardadas
    updateRobotConfig();
    updateTrackConfig();
    loadPresetTrack(); // Cargar una pista de ejemplo al inicio
    // renderTrackToImage(); // Se llama dentro de loadPresetTrack

    // Event listeners para los controles
    numSensorsInput.addEventListener('change', updateRobotConfig);
    sensorSpacingInput.addEventListener('change', updateRobotConfig);
    sensorOffsetInput.addEventListener('change', updateRobotConfig);
    robotSpeedInput.addEventListener('change', updateRobotConfig);

    trackColorInput.addEventListener('change', updateTrackConfig);
    bgColorInput.addEventListener('change', updateTrackConfig);
    lineWidthInput.addEventListener('change', updateTrackConfig);

    document.getElementById('loadPresetTrackButton').addEventListener('click', () => {
        loadPresetTrack();
        resetSimulation(); // Resetear el robot a la nueva pista
    });
    drawTrackButton.addEventListener('click', startDrawingTrack);


    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);
    resetButton.addEventListener('click', resetSimulation);

    stopButton.disabled = true; // Inicialmente no se puede detener

    // Pestaña inicial
    document.querySelector('.tab-button.active').click();

    draw(); // Dibujo inicial
});

// Asegurarse de que el canvas se redimensiona bien
// (simplificado, para producción usar ResizeObserver)
window.addEventListener('resize', () => {
    // Guardar estado del robot y la pista si es necesario
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Re-escalar posiciones si es necesario (más complejo)
    // Por ahora, solo re-renderizamos la pista. Si el usuario dibujó, podría perderse o necesitar re-dibujo.
    if (track.points.length > 0) {
        // Opcionalmente, escalar los puntos de la pista
        // track.points.forEach(segment => segment.forEach(p => {
        //    p.x = p.x * (canvas.width / oldWidth);
        //    p.y = p.y * (canvas.height / oldHeight);
        // }));
        renderTrackToImage();
    }
    draw();
});
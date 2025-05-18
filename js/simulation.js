class Simulation {
    constructor(canvasId, robot, trackEditor, arduinoInterpreter) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.robot = robot;
        this.trackEditor = trackEditor; // Para obtener el contexto de la pista
        this.interpreter = arduinoInterpreter;

        this.isRunning = false;
        this.simulationSpeedFactor = 5; // 1-10
        this.lastTimestamp = 0;
        this.animationFrameId = null;

        // Asegurarse de que la pista se dibuje inicialmente en el canvas de simulación
        this.trackEditor.transferToSimulation();
    }

    setSpeedFactor(factor) {
        this.simulationSpeedFactor = factor;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTimestamp = performance.now();
            this.loop(this.lastTimestamp);
            console.log("Simulación iniciada");
        }
    }

    pause() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log("Simulación pausada");
    }

    reset() {
        this.pause();
        // Resetear posición del robot (ej. al centro o un punto de inicio)
        this.robot.x = this.canvas.width / 2;
        this.robot.y = this.canvas.height - 50; // Cerca del borde inferior
        this.robot.angle = -Math.PI / 2; // Apuntando hacia arriba
        this.robot.leftMotorSpeed = 0;
        this.robot.rightMotorSpeed = 0;
        this.robot.updateSensorPositions();

        // Re-ejecutar setup del código Arduino
        if (this.interpreter.code.setup) {
            this.interpreter.code.setup();
        }

        // Limpiar y redibujar todo
        this.clearCanvas();
        this.trackEditor.transferToSimulation(); // Redibuja la pista
        this.robot.draw(this.ctx); // Dibuja el robot en su posición inicial
        console.log("Simulación reiniciada");
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Es importante volver a dibujar el fondo de la pista si es diferente de blanco
        this.ctx.fillStyle = this.trackEditor.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        const deltaTime = (timestamp - this.lastTimestamp) / 1000 * this.simulationSpeedFactor; // Segundos, ajustado por velocidad
        this.lastTimestamp = timestamp;

        // 1. Leer sensores del robot
        const trackContext = this.trackEditor.getTrackContext();
        this.robot.readSensors(trackContext, this.trackEditor.lineColor);

        // 2. Ejecutar un ciclo del código "Arduino"
        const loopExecuted = this.interpreter.runLoop();

        // 3. Actualizar estado del robot (movimiento) solo si el loop no está en delay
        if (loopExecuted) {
           this.robot.update(Math.min(deltaTime, 0.1)); // Limitar deltaTime para evitar saltos grandes
        }


        // 4. Dibujar
        this.clearCanvas();
        this.trackEditor.transferToSimulation(); // Redibuja la pista (por si cambia dinámicamente, aunque aquí no lo hace)
        this.robot.draw(this.ctx);

        this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
    }
}
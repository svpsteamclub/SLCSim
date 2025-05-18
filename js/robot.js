class Robot {
    constructor(x, y, numSensors = 5, sensorSpacing = 10, speed = 2) {
        this.x = x;
        this.y = y;
        this.angle = 0; // En radianes
        this.width = 30;
        this.height = 40;
        this.color = 'blue';

        this.numSensors = numSensors;
        this.sensorSpacing = sensorSpacing;
        this.sensors = []; // [{x, y, value (0 o 1)}]
        this.updateSensorPositions();

        this.baseSpeed = speed;
        this.leftMotorSpeed = 0;  // Valores entre -1 y 1 (o -255 a 255)
        this.rightMotorSpeed = 0;
    }

    updateSensorPositions() {
        this.sensors = [];
        const sensorOffsetY = -this.height / 2; // Sensores al frente
        const totalSensorWidth = (this.numSensors - 1) * this.sensorSpacing;
        const firstSensorOffsetX = -totalSensorWidth / 2;

        for (let i = 0; i < this.numSensors; i++) {
            const localX = firstSensorOffsetX + i * this.sensorSpacing;
            const localY = sensorOffsetY;

            // Rotar y trasladar a la posición global del robot
            const globalSensorX = this.x + localX * Math.cos(this.angle) - localY * Math.sin(this.angle);
            const globalSensorY = this.y + localX * Math.sin(this.angle) + localY * Math.cos(this.angle);
            
            this.sensors.push({ id: i, x: globalSensorX, y: globalSensorY, value: 0 });
        }
    }

    // Simula la lectura de sensores (debe ser llamado por el motor de simulación)
    readSensors(trackCanvasContext, trackLineColor) {
        this.sensors.forEach(sensor => {
            if (sensor.x < 0 || sensor.x >= trackCanvasContext.canvas.width ||
                sensor.y < 0 || sensor.y >= trackCanvasContext.canvas.height) {
                sensor.value = 0; // Fuera de la pista
                return;
            }
            const pixelData = trackCanvasContext.getImageData(Math.round(sensor.x), Math.round(sensor.y), 1, 1).data;
            // Compara el color del pixel con el color de la línea (simplificado)
            // Una mejor comparación implicaría convertir trackLineColor a RGB y comparar
            const isLine = pixelData[0] < 128 && pixelData[1] < 128 && pixelData[2] < 128; // Asumimos línea oscura
            sensor.value = isLine ? 1 : 0;
        });
    }
    
    // Métodos para el intérprete de Arduino
    getSensorValue(sensorId) {
        if (sensorId >= 0 && sensorId < this.sensors.length) {
            return this.sensors[sensorId].value;
        }
        return 0; // Valor por defecto si el sensor no existe
    }

    setMotorSpeeds(left, right) {
        // Normalizar a un rango, ej: -1 a 1
        this.leftMotorSpeed = Math.max(-1, Math.min(1, left / 255));
        this.rightMotorSpeed = Math.max(-1, Math.min(1, right / 255));
    }

    update(deltaTime) { // deltaTime en segundos
        const averageSpeed = (this.leftMotorSpeed + this.rightMotorSpeed) / 2 * this.baseSpeed;
        const turnSpeed = (this.rightMotorSpeed - this.leftMotorSpeed) / 2 * this.baseSpeed * 0.1; // Ajustar factor de giro

        this.angle += turnSpeed * deltaTime * 50; // El 50 es un factor de ajuste, prueba valores

        this.x += averageSpeed * Math.cos(this.angle) * deltaTime * 50; // El 50 es un factor de ajuste
        this.y += averageSpeed * Math.sin(this.angle) * deltaTime * 50;

        this.updateSensorPositions(); // Actualizar posición de sensores tras mover el robot
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Cuerpo del robot
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Rueda indicadora de dirección (frente)
        ctx.fillStyle = 'red';
        ctx.fillRect(-this.width / 4, -this.height / 2 - 5, this.width / 2, 5);


        // Sensores
        this.sensors.forEach(sensor => {
            // Coordenadas locales relativas al centro del robot (ya que estamos con ctx.translate y ctx.rotate)
            const localX = sensor.x - this.x;
            const localY = sensor.y - this.y;
            
            // Des-rotar para dibujar en el canvas local del robot
            const displayX = localX * Math.cos(-this.angle) - localY * Math.sin(-this.angle);
            const displayY = localX * Math.sin(-this.angle) + localY * Math.cos(-this.angle);

            ctx.fillStyle = sensor.value === 1 ? 'green' : 'grey';
            ctx.beginPath();
            ctx.arc(displayX, displayY, 3, 0, 2 * Math.PI); // Radio de 3px para el sensor
            ctx.fill();
        });

        ctx.restore();
    }
}
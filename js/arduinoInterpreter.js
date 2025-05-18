class ArduinoInterpreter {
    constructor(robotInstance, serialMonitorOutputElement) {
        this.robot = robotInstance;
        this.code = { setup: () => {}, loop: () => {} };
        this.userVariables = {}; // Para simular variables globales del usuario
        this.pinModes = {}; // Simular pinMode
        this.serialMonitor = serialMonitorOutputElement;
        this.delayTime = 0; // Para simular delay()
        this.lastDelayCall = 0;
    }

    // Funciones que el código del usuario podrá llamar
    // Estas se inyectarán en el scope de la función `eval` o `new Function`
    // Se debe tener cuidado con el `this` context si se usan funciones de flecha o se hace bind.
    // Para simplificar, las funciones se definirán dentro del scope de `compileAndRun`

    compileAndLoad(codeString) {
        this.userVariables = {}; // Resetear variables del usuario
        this.pinModes = {};
        this.serialMonitor.innerHTML = '<p><strong>Serial Monitor:</strong></p><pre></pre>'; // Limpiar monitor

        // Funciones simuladas de Arduino disponibles para el usuario
        const simulatedAPI = {
            pinMode: (pin, mode) => {
                // console.log(`pinMode(${pin}, ${mode === 0 ? 'INPUT' : 'OUTPUT'})`);
                this.pinModes[pin] = mode; // INPUT=0, OUTPUT=1 (simplificado)
            },
            digitalRead: (pin) => {
                // Asumimos que los pines 0 a N-1 son los sensores del robot
                if (pin >= 0 && pin < this.robot.numSensors) {
                    return this.robot.getSensorValue(pin);
                }
                // console.warn(`digitalRead en pin no configurado como sensor: ${pin}`);
                return 0; // Valor por defecto
            },
            analogRead: (pin) => { // Podría ser similar a digitalRead para sensores analógicos
                return this.robot.getSensorValue(pin); // Simplificado
            },
            digitalWrite: (pin, value) => {
                // Simular control de motores, LEDs, etc.
                // console.log(`digitalWrite(${pin}, ${value})`);
                // Aquí podrías mapear pines a acciones específicas del robot si lo expandes
            },
            analogWrite: (pin, value) => {
                // Asumimos pines específicos para motores
                // Ej: pin 10 = motor izquierdo, pin 11 = motor derecho
                // Esto es una convención que debes establecer.
                if (pin === 'MOTOR_LEFT' || pin === 10) { // Ejemplo de mapeo
                    // this.robot.leftMotorSpeed = value; // Directo si ya normalizas
                    // O si value es 0-255, normalizar aquí
                } else if (pin === 'MOTOR_RIGHT' || pin === 11) {
                    // this.robot.rightMotorSpeed = value;
                }
                // console.log(`analogWrite(${pin}, ${value})`);
                // Lo haremos más genérico con un método en robot:
                // this.robot.setMotorSpeeds(...) // Pero esto no es como Arduino real.
                // Vamos a usar una convención para este simulador:
                // Se llamará a una función específica del robot desde el código del usuario.
            },
            motorIzquierdo: (speed) => { // Función helper personalizada
                this.currentLeftMotorSpeed = speed;
            },
            motorDerecho: (speed) => { // Función helper personalizada
                this.currentRightMotorSpeed = speed;
            },
            delay: (ms) => {
                this.delayTime = ms;
                this.lastDelayCall = Date.now();
                // console.log(`delay(${ms})`);
                // La simulación debe manejar esto y pausar la ejecución del loop
            },
            Serial: { // Objeto Serial simulado
                begin: (baud) => { /* console.log(`Serial.begin(${baud})`); */ },
                print: (msg) => {
                    this.serialMonitor.querySelector('pre').textContent += msg;
                },
                println: (msg) => {
                    this.serialMonitor.querySelector('pre').textContent += msg + '\n';
                    // Auto-scroll
                    this.serialMonitor.scrollTop = this.serialMonitor.scrollHeight;
                }
            },
            // Constantes de Arduino (simplificado)
            HIGH: 1,
            LOW: 0,
            INPUT: 0,
            OUTPUT: 1,
            // Puedes añadir más funciones y constantes aquí
        };

        // Variables para los motores que el código de usuario modificará
        this.currentLeftMotorSpeed = 0;
        this.currentRightMotorSpeed = 0;

        try {
            // Aislar el código del usuario. Usar 'use strict';
            // Crear funciones setup y loop a partir del string.
            // Es una forma más segura que eval directo.
            // Las funciones del API se pasan como argumentos para que estén disponibles en el scope.
            const userCodeSetup = new Function(...Object.keys(simulatedAPI), ...Object.keys(this.userVariables), `
                'use strict';
                ${codeString.substring(codeString.indexOf("void setup()"), codeString.indexOf("void loop()"))}
                setup(); // Llama a la función setup definida por el usuario
            `);
            
            const userCodeLoop = new Function(...Object.keys(simulatedAPI), ...Object.keys(this.userVariables), `
                'use strict';
                ${codeString.substring(codeString.indexOf("void loop()"))}
                loop(); // Llama a la función loop definida por el usuario
            `);
            
            this.code.setup = () => {
                // Antes de cada setup/loop, resetear velocidades para que el código de usuario las establezca
                this.currentLeftMotorSpeed = 0;
                this.currentRightMotorSpeed = 0;
                userCodeSetup(...Object.values(simulatedAPI), ...Object.values(this.userVariables));
                this.robot.setMotorSpeeds(this.currentLeftMotorSpeed, this.currentRightMotorSpeed); // Aplicar al final del setup
            };
            this.code.loop = () => {
                if (this.delayTime > 0) {
                    if (Date.now() - this.lastDelayCall < this.delayTime) {
                        return false; // Todavía en delay
                    }
                    this.delayTime = 0; // Delay cumplido
                }
                this.currentLeftMotorSpeed = 0;
                this.currentRightMotorSpeed = 0;
                userCodeLoop(...Object.values(simulatedAPI), ...Object.values(this.userVariables));
                this.robot.setMotorSpeeds(this.currentLeftMotorSpeed, this.currentRightMotorSpeed); // Aplicar al final de cada loop
                return true; // Loop ejecutado
            };

            // Ejecutar setup una vez
            this.code.setup();
            simulatedAPI.Serial.println("Código compilado y setup ejecutado.");
            return true;

        } catch (e) {
            simulatedAPI.Serial.println("Error en el código del usuario: " + e.message);
            console.error("Error en el código del usuario:", e);
            this.code = { setup: () => {}, loop: () => {} }; // Deshabilitar código si hay error
            return false;
        }
    }

    runLoop() {
        if (this.code.loop) {
            return this.code.loop();
        }
        return false; // No hay loop para ejecutar
    }
}
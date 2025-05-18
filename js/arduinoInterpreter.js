class ArduinoInterpreter {
    constructor(robotInstance, serialMonitorOutputElement) {
        this.robot = robotInstance;
        this.code = { setup: () => {}, loop: () => {} };
        this.userVariables = {}; // Para simular variables globales del usuario
        this.pinModes = {}; // Simular pinMode
        this.serialMonitor = serialMonitorOutputElement;
        this.delayTime = 0; // Para simular delay()
        this.lastDelayCall = 0;

        // Variables para los motores que el código de usuario modificará
        // Se ponen aquí para que sean parte del 'this' del intérprete y
        // las funciones API puedan accederlas si es necesario.
        this.currentLeftMotorSpeed = 0;
        this.currentRightMotorSpeed = 0;
    }

    compileAndLoad(codeString) {
        this.userVariables = {};
        this.pinModes = {};
        if (this.serialMonitor.querySelector('pre')) {
            this.serialMonitor.querySelector('pre').textContent = ''; // Limpiar monitor
        } else {
            // Si no existe el <pre>, lo creamos (por si acaso)
            this.serialMonitor.innerHTML = '<p><strong>Serial Monitor:</strong></p><pre></pre>';
        }


        const simulatedAPI = {
            pinMode: (pin, mode) => {
                this.pinModes[pin] = mode;
            },
            digitalRead: (pin) => {
                if (pin >= 0 && pin < this.robot.numSensors) {
                    return this.robot.getSensorValue(pin);
                }
                return 0;
            },
            analogRead: (pin) => {
                return this.robot.getSensorValue(pin);
            },
            digitalWrite: (pin, value) => {
                // Implementar si es necesario para otros actuadores
            },
            analogWrite: (pin, value) => {
                // Implementar si es necesario, podría mapear a setMotorSpeeds
                // Por ejemplo, si el usuario usa analogWrite(MOTOR_L_PIN, speed)
            },
            motorIzquierdo: (speed) => {
                this.currentLeftMotorSpeed = speed;
            },
            motorDerecho: (speed) => {
                this.currentRightMotorSpeed = speed;
            },
            delay: (ms) => {
                this.delayTime = ms;
                this.lastDelayCall = performance.now(); // Usar performance.now() para más precisión
            },
            Serial: {
                begin: (baud) => {},
                print: (msg) => {
                    if (this.serialMonitor.querySelector('pre')) {
                        this.serialMonitor.querySelector('pre').textContent += String(msg);
                    }
                },
                println: (msg) => {
                    if (this.serialMonitor.querySelector('pre')) {
                        this.serialMonitor.querySelector('pre').textContent += String(msg) + '\n';
                        this.serialMonitor.scrollTop = this.serialMonitor.scrollHeight;
                    }
                }
            },
            HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1,
        };

        // Resetear velocidades antes de cada compilación
        this.currentLeftMotorSpeed = 0;
        this.currentRightMotorSpeed = 0;

        try {
            // --- NUEVA FORMA DE EXTRAER EL CÓDIGO ---
            let setupCode = '';
            const setupMatch = codeString.match(/void\s+setup\s*\(\s*\)\s*\{([\s\S]*?)\}/);
            if (setupMatch && setupMatch[1]) {
                setupCode = setupMatch[1];
            } else {
                simulatedAPI.Serial.println("Error: Función setup() no encontrada o con formato incorrecto.");
                throw new Error("Función setup() no encontrada o con formato incorrecto.");
            }

            let loopCode = '';
            const loopMatch = codeString.match(/void\s+loop\s*\(\s*\)\s*\{([\s\S]*?)\}/);
            if (loopMatch && loopMatch[1]) {
                loopCode = loopMatch[1];
            } else {
                simulatedAPI.Serial.println("Error: Función loop() no encontrada o con formato incorrecto.");
                throw new Error("Función loop() no encontrada o con formato incorrecto.");
            }
            // --- FIN DE LA NUEVA FORMA ---


            // Crear funciones setup y loop a partir del string.
            // Pasamos las claves de simulatedAPI como nombres de argumentos,
            // y sus valores correspondientes al llamar a la función.
            // También pasamos 'this.userVariables' si quisiéramos que el usuario
            // acceda a ellas como variables globales (requeriría más trabajo).
            // Por ahora, las variables globales de C++ no se simulan directamente.
            const setupFnArgs = Object.keys(simulatedAPI);
            const loopFnArgs = Object.keys(simulatedAPI);

            const userSetupFunction = new Function(...setupFnArgs, `'use strict'; ${setupCode}`);
            const userLoopFunction = new Function(...loopFnArgs, `'use strict'; ${loopCode}`);
            
            this.code.setup = () => {
                this.currentLeftMotorSpeed = 0; // Resetear para el setup
                this.currentRightMotorSpeed = 0;
                // Llamar a la función del usuario con la API como contexto/argumentos
                userSetupFunction.apply(this.userVariables, Object.values(simulatedAPI));
                this.robot.setMotorSpeeds(this.currentLeftMotorSpeed, this.currentRightMotorSpeed);
            };

            this.code.loop = () => {
                if (this.delayTime > 0) {
                    if (performance.now() - this.lastDelayCall < this.delayTime) {
                        return false; // Todavía en delay
                    }
                    this.delayTime = 0; // Delay cumplido
                }
                this.currentLeftMotorSpeed = 0; // Resetear para cada loop
                this.currentRightMotorSpeed = 0;
                // Llamar a la función del usuario con la API como contexto/argumentos
                userLoopFunction.apply(this.userVariables, Object.values(simulatedAPI));
                this.robot.setMotorSpeeds(this.currentLeftMotorSpeed, this.currentRightMotorSpeed);
                return true; // Loop ejecutado
            };

            // Ejecutar setup una vez
            this.code.setup();
            simulatedAPI.Serial.println("Código compilado y setup ejecutado.");
            return true;

        } catch (e) {
            simulatedAPI.Serial.println("Error en el código del usuario: " + e.message);
            console.error("Error en el código del usuario:", e);
            this.code = { setup: () => {}, loop: () => {} };
            return false;
        }
    }

    runLoop() {
        if (this.code.loop) {
            try {
                return this.code.loop();
            } catch (e) {
                // Capturar errores durante la ejecución del loop también
                if (this.serialMonitor.querySelector('pre')) {
                    this.serialMonitor.querySelector('pre').textContent += "Error en loop(): " + e.message + '\n';
                    this.serialMonitor.scrollTop = this.serialMonitor.scrollHeight;
                }
                console.error("Error en loop():", e);
                this.code.loop = () => {}; // Detener ejecución del loop si hay error
                return false;
            }
        }
        return false;
    }
}
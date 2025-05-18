// File: js/arduinoInterpreter.js

class ArduinoInterpreter {
    constructor(robotInstance, serialMonitorOutputElement) {
        this.robot = robotInstance;
        this.code = { setup: () => {}, loop: () => {} };
        this.userVariables = {}; // Objeto para almacenar "variables globales" parseadas del usuario
        this.pinModes = {}; // Simular pinMode
        this.serialMonitor = serialMonitorOutputElement;
        this.delayTime = 0; // Para simular delay()
        this.lastDelayCall = 0;

        // Variables internas para velocidades de motor que el código de usuario establecerá
        this.currentLeftMotorSpeed = 0;
        this.currentRightMotorSpeed = 0;
    }

    // Función para parsear declaraciones de variables globales simples del código del usuario
    // Intenta extraer variables definidas ANTES de void setup()
    parseAndInitializeGlobalVariables(codeString) {
        this.userVariables = {}; // Reiniciar en cada carga de código

        // Extraer la parte del código que está ANTES de "void setup()"
        const setupFunctionStart = codeString.indexOf("void setup()");
        if (setupFunctionStart === -1) {
            // No hay setup, no hay globales que parsear de esta manera
            return;
        }
        const globalScopeCode = codeString.substring(0, setupFunctionStart);

        // Regex para encontrar declaraciones de variables globales simples
        // Ejemplos: int Kp = 10; float miVar; const bool flag = true; String name = "Arduino";
        // Limitaciones: No maneja arrays (ej. int arr[5];), structs, enums complejos, múltiples declaraciones en una línea.
        const globalVarRegex = /(?:const\s+)?(int|float|double|bool|char|String|long)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=\s*([^;]+))?;/g;
        
        let match;
        while ((match = globalVarRegex.exec(globalScopeCode)) !== null) {
            const type = match[1];
            const name = match[2];
            let valueString = match[3]; // Valor como string, o undefined si no se inicializó

            let parsedValue;

            if (valueString !== undefined) {
                valueString = valueString.trim(); // Limpiar espacios
                if (type === 'int' || type === 'long') {
                    parsedValue = parseInt(valueString, 10);
                } else if (type === 'float' || type === 'double') {
                    parsedValue = parseFloat(valueString);
                } else if (type === 'bool') {
                    parsedValue = (valueString.toLowerCase() === 'true');
                } else if (type === 'String') {
                    // Quitar comillas si las tiene (simples o dobles)
                    if ((valueString.startsWith('"') && valueString.endsWith('"')) || (valueString.startsWith("'") && valueString.endsWith("'"))) {
                       parsedValue = valueString.substring(1, valueString.length - 1);
                    } else {
                       // Podría ser una variable String asignada a otra, o un número (que se convertirá a String)
                       // Esta parte es simplificada. Un parser real de C++ es complejo.
                       parsedValue = valueString; 
                    }
                } else if (type === 'char') {
                     if (valueString.startsWith("'") && valueString.endsWith("'") && valueString.length === 3) {
                        parsedValue = valueString.charAt(1); // El carácter en sí
                     } else {
                        parsedValue = valueString; // Podría ser un int asignado a char
                     }
                } else {
                    // Para tipos no manejados explícitamente, intentar parsear como número
                    const numVal = parseFloat(valueString);
                    parsedValue = isNaN(numVal) ? valueString : numVal; // Si no es número, dejar como string
                }
            } else {
                // Variable declarada sin inicialización explícita
                if (type === 'int' || type === 'long' || type === 'float' || type === 'double') {
                    parsedValue = 0;
                } else if (type === 'bool') {
                    parsedValue = false;
                } else if (type === 'String' || type === 'char') {
                    parsedValue = ""; // O null, dependiendo de la semántica deseada
                } else {
                    parsedValue = null; 
                }
            }
            this.userVariables[name] = parsedValue;
            // console.log(`Parsed global var: ${name} = ${parsedValue} (type: ${type})`);
        }
    }


    compileAndLoad(codeString) {
        this.pinModes = {}; // Resetear pinModes
        // Limpiar Serial Monitor
        if (this.serialMonitor.querySelector('pre')) {
            this.serialMonitor.querySelector('pre').textContent = '';
        } else {
            // Si <pre> no existe, crearlo (defensivo)
            this.serialMonitor.innerHTML = '<p><strong>Serial Monitor:</strong></p><pre></pre>';
        }

        // Intenta parsear variables globales del código del usuario
        try {
            this.parseAndInitializeGlobalVariables(codeString);
        } catch (e) {
            console.error("Error durante el parseo de variables globales:", e);
            if (this.serialMonitor.querySelector('pre')) {
                 this.serialMonitor.querySelector('pre').textContent += "Advertencia: Error parseando globales.\n";
            }
            // Continuar de todos modos, puede que el usuario no use globales o las maneje diferente
        }

        // API de funciones simuladas de Arduino que estarán disponibles para el código del usuario
        const simulatedAPI = {
            pinMode: (pin, mode) => { this.pinModes[pin] = mode; },
            digitalRead: (pin) => {
                // Asume que los pines 0 a N-1 son los sensores del robot
                if (pin >= 0 && pin < this.robot.numSensors) {
                    return this.robot.getSensorValue(pin);
                }
                return 0; // Valor por defecto si el pin no es un sensor conocido
            },
            analogRead: (pin) => { // Simulación simple, igual que digitalRead para este caso
                if (pin >= 0 && pin < this.robot.numSensors) {
                    return this.robot.getSensorValue(pin);
                }
                return 0;
            },
            digitalWrite: (pin, value) => {
                // Implementar si se necesitan otros actuadores simulados
                // console.log(`digitalWrite(${pin}, ${value})`);
            },
            analogWrite: (pin, value) => {
                // Implementar si se necesita control granular de "pines"
                // console.log(`analogWrite(${pin}, ${value})`);
            },
            // Funciones helper para controlar los motores del robot simulado
            motorIzquierdo: (speed) => { this.currentLeftMotorSpeed = speed; },
            motorDerecho: (speed) => { this.currentRightMotorSpeed = speed; },
            delay: (ms) => {
                this.delayTime = ms;
                this.lastDelayCall = performance.now();
            },
            Serial: { // Objeto Serial simulado
                begin: (baud) => { /* console.log(`Serial.begin(${baud})`); */ },
                print: (msg) => {
                    if (this.serialMonitor.querySelector('pre')) {
                        this.serialMonitor.querySelector('pre').textContent += String(msg); // Asegurar que es string
                    }
                },
                println: (msg) => {
                    if (this.serialMonitor.querySelector('pre')) {
                        this.serialMonitor.querySelector('pre').textContent += String(msg) + '\n';
                        this.serialMonitor.scrollTop = this.serialMonitor.scrollHeight; // Auto-scroll
                    }
                }
            },
            // Para permitir `String(variable)` en el código del usuario
            String: function(val) { return String(val); }, // Delega al constructor global String de JS
            // Constantes comunes de Arduino
            HIGH: 1,
            LOW: 0,
            INPUT: 0,
            OUTPUT: 1,
            // Se pueden añadir más constantes o funciones aquí (millis(), etc.)
        };

        // Resetear velocidades de motor antes de ejecutar el código del usuario
        this.currentLeftMotorSpeed = 0;
        this.currentRightMotorSpeed = 0;

        try {
            // Extraer el contenido de las funciones setup() y loop() del usuario
            let setupCode = '';
            const setupMatch = codeString.match(/void\s+setup\s*\(\s*\)\s*\{([\s\S]*?)\}/);
            if (setupMatch && setupMatch[1]) {
                setupCode = setupMatch[1];
            } else {
                throw new Error("Función setup() no encontrada o con formato incorrecto.");
            }

            let loopCode = '';
            const loopMatch = codeString.match(/void\s+loop\s*\(\s*\)\s*\{([\s\S]*?)\}/);
            if (loopMatch && loopMatch[1]) {
                loopCode = loopMatch[1];
            } else {
                throw new Error("Función loop() no encontrada o con formato incorrecto.");
            }

            // Preparar declaraciones 'let' para las variables globales parseadas
            // Estas se inyectarán al inicio del cuerpo de setup() y loop()
            // para que estén disponibles como variables locales dentro de esas funciones.
            let globalVarInjections = '';
            for (const varName in this.userVariables) {
                if (Object.hasOwnProperty.call(this.userVariables, varName)) {
                    const value = this.userVariables[varName];
                    let valueAsJsLiteral;
                    if (typeof value === 'string') {
                        // Escapar correctamente el string para que sea un literal de JS
                        valueAsJsLiteral = `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
                    } else if (value === null || value === undefined) {
                        valueAsJsLiteral = 'null'; // o 'undefined'
                    } else {
                        valueAsJsLiteral = value.toString(); // Para números, booleanos
                    }
                    globalVarInjections += `let ${varName} = ${valueAsJsLiteral};\n`;
                }
            }
            
            // Nombres de los argumentos para new Function (las claves de la API simulada)
            const apiArgNames = Object.keys(simulatedAPI);

            // Crear las funciones setup y loop del usuario dinámicamente
            // Se antepone 'use strict'; y las inyecciones de variables globales.
            // Los argumentos de la función son los nombres de las funciones/objetos de la API.
            const userSetupFunction = new Function(...apiArgNames, `'use strict';\n${globalVarInjections}\n${setupCode}`);
            const userLoopFunction = new Function(...apiArgNames, `'use strict';\n${globalVarInjections}\n${loopCode}`);
            
            // Envolver las llamadas a las funciones del usuario para manejar 'this' y aplicar velocidades
            this.code.setup = () => {
                this.currentLeftMotorSpeed = 0; // Resetear antes de setup
                this.currentRightMotorSpeed = 0;
                // Llamar a la función setup del usuario, pasándole la API simulada como argumentos.
                // El 'this' dentro de userSetupFunction será 'undefined' en modo estricto,
                // lo cual está bien ya que no lo usamos directamente allí.
                userSetupFunction.apply(null, Object.values(simulatedAPI));
                // Aplicar las velocidades que el usuario haya configurado en su setup
                this.robot.setMotorSpeeds(this.currentLeftMotorSpeed, this.currentRightMotorSpeed);
            };

            this.code.loop = () => {
                // Manejar delay() simulado
                if (this.delayTime > 0) {
                    if (performance.now() - this.lastDelayCall < this.delayTime) {
                        return false; // Todavía en delay, no ejecutar el resto del loop
                    }
                    this.delayTime = 0; // Delay cumplido
                }

                this.currentLeftMotorSpeed = 0; // Resetear antes de cada loop
                this.currentRightMotorSpeed = 0;
                // Llamar a la función loop del usuario
                userLoopFunction.apply(null, Object.values(simulatedAPI));
                // Aplicar las velocidades que el usuario haya configurado en su loop
                this.robot.setMotorSpeeds(this.currentLeftMotorSpeed, this.currentRightMotorSpeed);
                return true; // Loop ejecutado
            };

            // Ejecutar la función setup del usuario una vez después de compilar
            this.code.setup();
            simulatedAPI.Serial.println("Código compilado y setup ejecutado.");
            return true; // Compilación y setup exitosos

        } catch (e) {
            // Error durante la compilación o el setup inicial
            const errorMessage = "Error en el código del usuario: " + e.message;
            if (this.serialMonitor.querySelector('pre')) {
                this.serialMonitor.querySelector('pre').textContent += errorMessage + '\n';
            }
            console.error("Error en compileAndLoad (código de usuario):", e);
            this.code = { setup: () => {}, loop: () => {} }; // Deshabilitar código si hay error
            return false; // Compilación fallida
        }
    }

    runLoop() {
        if (this.code.loop) {
            try {
                return this.code.loop(); // Ejecuta la función loop envuelta
            } catch (e) {
                // Error durante la ejecución del loop del usuario
                const errorMessage = "Error en loop(): " + e.message;
                if (this.serialMonitor.querySelector('pre')) {
                    this.serialMonitor.querySelector('pre').textContent += errorMessage + '\n';
                    this.serialMonitor.scrollTop = this.serialMonitor.scrollHeight;
                }
                console.error("Error en runLoop (código de usuario):", e);
                this.code.loop = () => {}; // Detener la ejecución de futuros loops si hay un error
                return false; // Loop falló
            }
        }
        return false; // No hay loop para ejecutar (o falló previamente)
    }
}
    import { clamp } from './utils.js';

    export class PIDController {
        constructor(kp, ki, kd, integralMax, baseSpeed) {
            this.kp = kp;
            this.ki = ki;
            this.kd = kd;
            this.integralMax = integralMax; // Max for the accumulator (before Ki)
            this.baseSpeed = baseSpeed; // VELOCIDAD_BASE

            this.error = 0;
            this.prevError = 0;
            this.integralAccumulator = 0; // Sum of (error * dt)
            
            this.pTerm = 0;
            this.iTerm = 0;
            this.dTerm = 0;
            this.output = 0; // This is AdjPID

            this.lastKnownLineDirection = 0; // 0: centered/unknown, 1: line was to left, 2: line was to right
        }

        updateSettings(settings) {
            this.kp = settings.kp ?? this.kp;
            this.ki = settings.ki ?? this.ki;
            this.kd = settings.kd ?? this.kd;
            this.integralMax = settings.integralMax ?? this.integralMax;
            this.baseSpeed = settings.baseSpeed ?? this.baseSpeed;
        }
        
        reset() {
            this.error = 0;
            this.prevError = 0;
            this.integralAccumulator = 0;
            this.pTerm = 0;
            this.iTerm = 0;
            this.dTerm = 0;
            this.output = 0;
            this.lastKnownLineDirection = 0;
        }

        calculateError(sL, sC, sR, maxErrorValue) {
            const S_IZQ = sL ? 1 : 0;
            const S_CEN = sC ? 1 : 0;
            const S_DER = sR ? 1 : 0;
            let currentError = 0;

            if (S_DER === 0 && S_CEN === 0 && S_IZQ === 0) { // All white - lost line
                if (this.lastKnownLineDirection === 1) { // Was left
                    currentError = -maxErrorValue; // Turn hard left
                } else if (this.lastKnownLineDirection === 2) { // Was right
                    currentError = maxErrorValue;  // Turn hard right
                } else { // Truly lost or was centered
                    currentError = (Math.abs(this.prevError) > 0.1) ? this.prevError : maxErrorValue; // Continue last significant turn or guess
                }
            } else if (S_DER === 0 && S_CEN === 1 && S_IZQ === 0) { // Center on line
                currentError = 0.0;
                this.lastKnownLineDirection = 0;
            } else if (S_DER === 0 && S_CEN === 1 && S_IZQ === 1) { // Line to the left
                currentError = -0.5; // Mild left
                this.lastKnownLineDirection = 1;
            } else if (S_DER === 0 && S_CEN === 0 && S_IZQ === 1) { // Line far to the left
                currentError = -2.0; // Strong left (was -2.0)
                this.lastKnownLineDirection = 1;
            } else if (S_DER === 1 && S_CEN === 1 && S_IZQ === 0) { // Line to the right
                currentError = 0.5;  // Mild right
                this.lastKnownLineDirection = 2;
            } else if (S_DER === 1 && S_CEN === 0 && S_IZQ === 0) { // Line far to the right
                currentError = 2.0;  // Strong right (was 2.0)
                this.lastKnownLineDirection = 2;
            } else if (S_DER === 1 && S_CEN === 1 && S_IZQ === 1) { // All black (e.g. intersection or thick line)
                currentError = 0.0; // Stay straight (can be improved)
                this.lastKnownLineDirection = 0;
            } else if (S_DER === 1 && S_CEN === 0 && S_IZQ === 1) { // Split line, robot in middle (unusual)
                currentError = this.prevError; // Maintain previous correction
            }
            this.error = currentError;
            return this.error;
        }


        computeOutput(dt_s) {
            // Proportional Term
            this.pTerm = this.kp * this.error;

            // Integral Term
            this.integralAccumulator += this.error * dt_s;
            if (this.integralMax > 0) {
                this.integralAccumulator = clamp(this.integralAccumulator, -this.integralMax, this.integralMax);
            } else {
                this.integralAccumulator = 0; // Disable integral if integralMax is 0 or less
            }
            this.iTerm = this.ki * this.integralAccumulator;

            // Derivative Term
            if (dt_s > 0.0001) {
                this.dTerm = this.kd * (this.error - this.prevError) / dt_s;
            } else {
                this.dTerm = 0;
            }
            this.prevError = this.error;

            this.output = this.pTerm + this.iTerm + this.dTerm;
            return this.output; // This is AdjPID
        }

        getMotorPWMs(adjPID, motorDeadbandPWM) {
            let rawSpeedMotorDerecho = this.baseSpeed - adjPID;
            let rawSpeedMotorIzquierdo = this.baseSpeed + adjPID;

            let dirDerechoForward = rawSpeedMotorDerecho >= 0;
            let dirIzquierdoForward = rawSpeedMotorIzquierdo >= 0;

            let pwmMotorDerecho = Math.abs(rawSpeedMotorDerecho);
            let pwmMotorIzquierdo = Math.abs(rawSpeedMotorIzquierdo);

            if (pwmMotorDerecho < motorDeadbandPWM) pwmMotorDerecho = 0;
            if (pwmMotorIzquierdo < motorDeadbandPWM) pwmMotorIzquierdo = 0;

            pwmMotorDerecho = clamp(pwmMotorDerecho, 0, 255);
            pwmMotorIzquierdo = clamp(pwmMotorIzquierdo, 0, 255);

            return {
                leftPWM: pwmMotorIzquierdo,
                rightPWM: pwmMotorDerecho,
                leftDirForward: dirIzquierdoForward,
                rightDirForward: dirDerechoForward
            };
        }

        getTerms() {
            return {
                error: this.error,
                pTerm: this.pTerm,
                iTerm: this.iTerm,
                dTerm: this.dTerm,
                adjPID: this.output
            };
        }
    }
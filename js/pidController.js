// js/pidController.js
import { clamp } from './utils.js';

export class PIDController {
    constructor(kp, ki, kd, integralMax, baseSpeed) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
        this.integralMax = integralMax;
        this.baseSpeed = baseSpeed;

        this.error = 0;
        this.prevError = 0;
        this.integralAccumulator = 0;

        this.pTerm = 0;
        this.iTerm = 0;
        this.dTerm = 0;
        this.output = 0;

        this.lastKnownLineDirection = 0; // 0: None/Center, 1: Line was to Left, 2: Line was to Right
        console.log(`PIDController INITIALIZED with: kp=${this.kp}, ki=${this.ki}, kd=${this.kd}, intMax=${this.integralMax}, baseSpeed=${this.baseSpeed}`);
    }

    updateSettings(settings) {
        console.log("[PIDController.updateSettings] Received settings:", JSON.parse(JSON.stringify(settings)));
        this.kp = typeof settings.kp === 'number' ? settings.kp : this.kp;
        this.ki = typeof settings.ki === 'number' ? settings.ki : this.ki;
        this.kd = typeof settings.kd === 'number' ? settings.kd : this.kd;
        this.integralMax = typeof settings.integralMax === 'number' ? settings.integralMax : this.integralMax;
        this.baseSpeed = typeof settings.baseSpeed === 'number' ? settings.baseSpeed : this.baseSpeed;
        console.log(`[PIDController.updateSettings] AFTER update: kp=${this.kp}, ki=${this.ki}, kd=${this.kd}, intMax=${this.integralMax}, baseSpeed=${this.baseSpeed}`);
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
        // console.log("PIDController RESET");
    }

    /**
     * Calculates the error based on sensor readings.
     * @param {boolean} sL - Sensor Left state (true if on line)
     * @param {boolean} sC - Sensor Center state (true if on line)
     * @param {boolean} sR - Sensor Right state (true if on line)
     * @param {number} maxErrorValue - The error value to use when the line is lost (e.g., 4.0 to match Arduino)
     * @returns {number} The calculated error.
     */
    calculateError(sL, sC, sR, maxErrorValue) {
        const S_IZQ = sL ? 1 : 0;
        const S_CEN = sC ? 1 : 0;
        const S_DER = sR ? 1 : 0;
        let currentError = 0;

        if (S_DER === 0 && S_CEN === 0 && S_IZQ === 0) { // 000 - Line Lost
            if (this.lastKnownLineDirection === 1) {      // Line was last seen to the LEFT (robot needs to turn left)
                currentError = -maxErrorValue;
            } else if (this.lastKnownLineDirection === 2) { // Line was last seen to the RIGHT (robot needs to turn right)
                currentError = maxErrorValue;
            } else { // No specific last direction or was centered. Arduino defaults to 4.0 (positive error).
                currentError = maxErrorValue; // Default to assuming line is to the right if unknown
            }
        } else if (S_DER === 0 && S_CEN === 1 && S_IZQ === 0) { // 010 - Centered
            currentError = 0.0;
            this.lastKnownLineDirection = 0; // Corresponds to POS_MEM_NONE
        } else if (S_DER === 0 && S_CEN === 1 && S_IZQ === 1) { // 110 - Line a bit to the left
            currentError = -0.5;
            this.lastKnownLineDirection = 1; // Corresponds to POS_MEM_LEFT_OF_LINE
        } else if (S_DER === 0 && S_CEN === 0 && S_IZQ === 1) { // 100 - Line to the left
            currentError = -2.0;
            this.lastKnownLineDirection = 1; // Corresponds to POS_MEM_LEFT_OF_LINE
        } else if (S_DER === 1 && S_CEN === 1 && S_IZQ === 0) { // 011 - Line a bit to the right
            currentError = 0.5;
            this.lastKnownLineDirection = 2; // Corresponds to POS_MEM_RIGHT_OF_LINE
        } else if (S_DER === 1 && S_CEN === 0 && S_IZQ === 0) { // 001 - Line to the right
            currentError = 2.0;
            this.lastKnownLineDirection = 2; // Corresponds to POS_MEM_RIGHT_OF_LINE
        } else if (S_DER === 1 && S_CEN === 1 && S_IZQ === 1) { // 111 - All sensors on line (treat as centered)
            currentError = 0.0;
            this.lastKnownLineDirection = 0; // Corresponds to POS_MEM_NONE
        } else if (S_DER === 1 && S_CEN === 0 && S_IZQ === 1) { // 101 - Strange case, maintain previous error
            currentError = this.prevError;
            // lastKnownLineDirection remains unchanged from previous state
        }
        this.error = currentError;
        return this.error;
    }


    computeOutput(dt_s) {
        // Proportional Term
        this.pTerm = this.kp * this.error;

        // Integral Term
        if (this.ki === 0 || this.integralMax <= 0) { // Arduino: integralMax > 0.001f check and Ki multiplier
             this.iTerm = 0;
             this.integralAccumulator = 0;
        } else {
            this.integralAccumulator += this.error * dt_s;
            this.integralAccumulator = clamp(this.integralAccumulator, -this.integralMax, this.integralMax);
            this.iTerm = this.ki * this.integralAccumulator;
        }

        // Derivative Term
        if (this.kd === 0) {
            this.dTerm = 0;
        } else {
            if (dt_s > 0.0001) { // Avoid division by zero or very small dt
                this.dTerm = this.kd * (this.error - this.prevError) / dt_s;
            } else {
                this.dTerm = 0;
            }
        }
        this.prevError = this.error;

        this.output = this.pTerm + this.iTerm + this.dTerm;
        return this.output;
    }

    getMotorPWMs(adjPID, motorDeadbandPWM) {
        let rawSpeedMotorDerecho = this.baseSpeed - adjPID;
        let rawSpeedMotorIzquierdo = this.baseSpeed + adjPID;

        let dirDerechoForward = rawSpeedMotorDerecho >= 0;
        let dirIzquierdoForward = rawSpeedMotorIzquierdo >= 0;

        // Arduino does abs(round(rawSpeed))
        // We'll take abs first, then apply deadband, then round, then clamp
        let pwmMotorDerecho = Math.abs(rawSpeedMotorDerecho);
        let pwmMotorIzquierdo = Math.abs(rawSpeedMotorIzquierdo);

        // Apply Arduino-style deadband:
        // If speed is > 0 but < deadband, set to deadband.
        // If speed is 0, it remains 0.
        if (pwmMotorDerecho > 0 && pwmMotorDerecho < motorDeadbandPWM) {
            pwmMotorDerecho = motorDeadbandPWM;
        }
        // No "else if (pwmMotorDerecho === 0) pwmMotorDerecho = 0;" needed, it's already covered.

        if (pwmMotorIzquierdo > 0 && pwmMotorIzquierdo < motorDeadbandPWM) {
            pwmMotorIzquierdo = motorDeadbandPWM;
        }

        // Arduino rounds the speed value. Let's do it here before clamping.
        pwmMotorDerecho = Math.round(pwmMotorDerecho);
        pwmMotorIzquierdo = Math.round(pwmMotorIzquierdo);

        // Clamp to 0-255
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
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

        this.lastKnownLineDirection = 0; 
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

    calculateError(sL, sC, sR, maxErrorValue) {
        const S_IZQ = sL ? 1 : 0;
        const S_CEN = sC ? 1 : 0;
        const S_DER = sR ? 1 : 0;
        let currentError = 0;

        if (S_DER === 0 && S_CEN === 0 && S_IZQ === 0) { 
            if (this.lastKnownLineDirection === 1) { 
                currentError = -maxErrorValue; 
            } else if (this.lastKnownLineDirection === 2) { 
                currentError = maxErrorValue;  
            } else { 
                currentError = (Math.abs(this.prevError) > 0.1) ? this.prevError : maxErrorValue; 
            }
        } else if (S_DER === 0 && S_CEN === 1 && S_IZQ === 0) { 
            currentError = 0.0;
            this.lastKnownLineDirection = 0;
        } else if (S_DER === 0 && S_CEN === 1 && S_IZQ === 1) { 
            currentError = -0.5; 
            this.lastKnownLineDirection = 1;
        } else if (S_DER === 0 && S_CEN === 0 && S_IZQ === 1) { 
            currentError = -2.0; 
            this.lastKnownLineDirection = 1;
        } else if (S_DER === 1 && S_CEN === 1 && S_IZQ === 0) { 
            currentError = 0.5;  
            this.lastKnownLineDirection = 2;
        } else if (S_DER === 1 && S_CEN === 0 && S_IZQ === 0) { 
            currentError = 2.0;  
            this.lastKnownLineDirection = 2;
        } else if (S_DER === 1 && S_CEN === 1 && S_IZQ === 1) { 
            currentError = 0.0; 
            this.lastKnownLineDirection = 0;
        } else if (S_DER === 1 && S_CEN === 0 && S_IZQ === 1) { 
            currentError = this.prevError; 
        }
        this.error = currentError;
        return this.error;
    }


    computeOutput(dt_s) {
        // console.log(`[PID Compute] START: ki=${this.ki} (type: ${typeof this.ki}), kd=${this.kd} (type: ${typeof this.kd}), intMax=${this.integralMax}, error=${this.error.toFixed(2)}`);

        // Proportional Term
        this.pTerm = this.kp * this.error;

        // Integral Term
        // console.log(`[PID Compute] Before I-Term Check: ki=${this.ki}, integralMax=${this.integralMax}, integralAccumulator=${this.integralAccumulator.toFixed(2)}`);
        if (this.ki === 0 || this.integralMax <= 0) { 
             this.iTerm = 0;
             this.integralAccumulator = 0; 
            //  console.log("[PID Compute] I-Term is ZERO because ki is 0 or integralMax <= 0.");
        } else {
            this.integralAccumulator += this.error * dt_s;
            this.integralAccumulator = clamp(this.integralAccumulator, -this.integralMax, this.integralMax);
            this.iTerm = this.ki * this.integralAccumulator;
            // console.log(`[PID Compute] I-Term Calculated: ${this.iTerm.toFixed(2)} (ki=${this.ki} * acc=${this.integralAccumulator.toFixed(2)})`);
        }

        // Derivative Term
        // console.log(`[PID Compute] Before D-Term Check: kd=${this.kd}, error=${this.error.toFixed(2)}, prevError=${this.prevError.toFixed(2)}, dt_s=${dt_s.toFixed(4)}`);
        if (this.kd === 0) { 
            this.dTerm = 0;
            // console.log("[PID Compute] D-Term is ZERO because kd is 0.");
        } else {
            if (dt_s > 0.0001) { // Avoid division by zero or very small dt
                this.dTerm = this.kd * (this.error - this.prevError) / dt_s;
                // console.log(`[PID Compute] D-Term Calculated: ${this.dTerm.toFixed(2)} (kd=${this.kd} * deltaErr=${(this.error - this.prevError).toFixed(3)} / dt=${dt_s.toFixed(4)})`);
            } else {
                this.dTerm = 0;
                // console.log("[PID Compute] D-Term is ZERO because dt_s is too small.");
            }
        }
        this.prevError = this.error; 

        this.output = this.pTerm + this.iTerm + this.dTerm;
        // console.log(`[PID Compute] FINAL TERMS: P=${this.pTerm.toFixed(2)}, I=${this.iTerm.toFixed(2)}, D=${this.dTerm.toFixed(2)}, Output=${this.output.toFixed(2)}`);
        
        return this.output; 
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
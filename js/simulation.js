// js/simulation.js
import { Robot } from './robot.js';
import { PIDController } from './pidController.js';
import { Track } from './track.js';
import { PIXELS_PER_METER, DEFAULT_ROBOT_GEOMETRY, currentMaxValError } from './config.js'; // currentMaxValError from config
import { LapTimer } from './lapTimer.js';


export class Simulation {
    constructor(robotImages, watermarkImage) {
        this.robot = new Robot(
            DEFAULT_ROBOT_GEOMETRY.width_m / PIXELS_PER_METER, 
            DEFAULT_ROBOT_GEOMETRY.length_m / PIXELS_PER_METER,
            0
        );
        this.robot.setImages(robotImages.body, robotImages.wheel);
        
        this.pidController = new PIDController(120, 3, 15, 250, 110); 
        this.track = new Track();
        this.track.setWatermark(watermarkImage);
        this.lapTimer = new LapTimer(this.robot.wheelbase_m, this.robot.length_m);

        this.params = {
            timeStep: 0.01,
            maxRobotSpeedMPS: 1.0,
            motorResponseFactor: 0.03,
            sensorNoiseProb: 0.0,
            movementPerturbFactor: 0.0, 
            motorDeadbandPWM: 5,
            lineThreshold: 30,
        };
        this.totalSimTime_s = 0;
    }

    updateParameters(simParams, pidSettings, robotGeom) {
        this.params.timeStep = simParams.timeStep ?? this.params.timeStep;
        this.params.maxRobotSpeedMPS = simParams.maxRobotSpeedMPS ?? this.params.maxRobotSpeedMPS;
        this.params.motorResponseFactor = simParams.motorResponseFactor ?? this.params.motorResponseFactor;
        this.params.sensorNoiseProb = simParams.sensorNoiseProb ?? this.params.sensorNoiseProb;
        this.params.movementPerturbFactor = simParams.movementPerturbFactor ?? this.params.movementPerturbFactor;
        this.params.motorDeadbandPWM = simParams.motorDeadbandPWM ?? this.params.motorDeadbandPWM;
        this.params.lineThreshold = simParams.lineThreshold ?? this.params.lineThreshold; 
        
        if (this.track) { 
            this.track.lineThreshold = this.params.lineThreshold;
        }
        if (this.pidController && pidSettings) {
            this.pidController.updateSettings(pidSettings);
        }
        if (this.robot && robotGeom) {
            this.robot.updateGeometry(robotGeom);
            this.lapTimer.robotWidth_m = this.robot.wheelbase_m;
            this.lapTimer.robotLength_m = this.robot.length_m;
        }
    }
    
    loadTrack(source, width_px, height_px, startX_m, startY_m, startAngle_rad, isCustomFile = false, fileName = "", callback) {
        this.track.load(source, width_px, height_px, this.params.lineThreshold, (success, actualWidth, actualHeight) => {
            if (success) {
                this.robot.resetState(startX_m, startY_m, startAngle_rad);
                this.pidController.reset();
                this.totalSimTime_s = 0;
                this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);
            }
            callback(success, actualWidth, actualHeight);
        }, isCustomFile, fileName);
    }
    
    setTrackFromCanvas(sourceCanvas, startX_m, startY_m, startAngle_rad) {
        const success = this.track.setFromCanvas(sourceCanvas, this.params.lineThreshold);
        if (success) {
             this.robot.resetState(startX_m, startY_m, startAngle_rad);
             this.pidController.reset();
             this.totalSimTime_s = 0;
             this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);
        }
        return success;
    }

    resetSimulation(startX_m, startY_m, startAngle_rad) {
        this.robot.resetState(startX_m, startY_m, startAngle_rad);
        this.pidController.reset();
        this.totalSimTime_s = 0;
        this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);
    }
    
    fixedUpdate() {
        if (!this.track.imageData) return { sensorStates: null, pidTerms: null, motorPWMs: null, lapData: null, outOfBounds: false };

        const sensorPositions_px = this.robot.getSensorPositions_imagePx();
        let sL = this.track.isPixelOnLine(sensorPositions_px.left.x, sensorPositions_px.left.y);
        let sC = this.track.isPixelOnLine(sensorPositions_px.center.x, sensorPositions_px.center.y);
        let sR = this.track.isPixelOnLine(sensorPositions_px.right.x, sensorPositions_px.right.y);

        if (this.params.sensorNoiseProb > 0) {
            if (Math.random() < this.params.sensorNoiseProb) sL = !sL;
            if (Math.random() < this.params.sensorNoiseProb) sC = !sC;
            if (Math.random() < this.params.sensorNoiseProb) sR = !sR;
        }
        
        const sensorStates = { left: sL, center: sC, right: sR };

        this.pidController.calculateError(sL, sC, sR, currentMaxValError); 
        const adjPID = this.pidController.computeOutput(this.params.timeStep);
        const motorPWMs = this.pidController.getMotorPWMs(adjPID, this.params.motorDeadbandPWM);

        // Calculate target speeds based on PWM, matching original script.js logic
        let target_vL_mps = (motorPWMs.leftDirForward ? 1 : -1) * (motorPWMs.leftPWM / 255.0) * this.params.maxRobotSpeedMPS;
        let target_vR_mps = (motorPWMs.rightDirForward ? 1 : -1) * (motorPWMs.rightPWM / 255.0) * this.params.maxRobotSpeedMPS;
        
        // --- ADDED for exact match with script.js logic ---
        if (motorPWMs.leftPWM === 0) target_vL_mps = 0;
        if (motorPWMs.rightPWM === 0) target_vR_mps = 0;
        // --- END OF ADDITION ---
        
        this.robot.updateMovement(
            this.params.timeStep, 
            target_vL_mps, 
            target_vR_mps, 
            this.params.motorResponseFactor,
            this.params.maxRobotSpeedMPS,
            this.params.movementPerturbFactor
        );

        this.totalSimTime_s += this.params.timeStep;
        const lapUpdate = this.lapTimer.update(this.totalSimTime_s, { x_m: this.robot.x_m, y_m: this.robot.y_m, angle_rad: this.robot.angle_rad });
        
        const boundaryMargin_m = Math.max(this.robot.wheelbase_m, this.robot.length_m) / 2;
        let outOfBounds = false;
        if ( this.robot.x_m < -boundaryMargin_m || 
             this.robot.x_m * PIXELS_PER_METER > this.track.width_px + boundaryMargin_m * PIXELS_PER_METER ||
             this.robot.y_m < -boundaryMargin_m ||
             this.robot.y_m * PIXELS_PER_METER > this.track.height_px + boundaryMargin_m * PIXELS_PER_METER ) {
            outOfBounds = true;
        }

        return {
            sensorStates: sensorStates,
            pidTerms: this.pidController.getTerms(),
            motorPWMs: motorPWMs,
            lapData: this.lapTimer.getDisplayData(),
            newLapCompleted: lapUpdate.newLapCompleted,
            completedLapTime: lapUpdate.completedLapTime,
            outOfBounds: outOfBounds
        };
    }

    draw(displayCtx, displayCanvasWidth, displayCanvasHeight, sensorStates) {
        displayCtx.clearRect(0, 0, displayCanvasWidth, displayCanvasHeight);
        this.track.draw(displayCtx, displayCanvasWidth, displayCanvasHeight);
        if (this.track.imageData) { 
             this.robot.draw(displayCtx, sensorStates);
        }
    }
}
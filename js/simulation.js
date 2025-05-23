// js/simulation.js
import { Robot } from './robot.js';
import { PIDController } from './pidController.js';
import { Track } from './track.js';
import { PIXELS_PER_METER, DEFAULT_ROBOT_GEOMETRY, currentMaxValError } from './config.js'; // currentMaxValError from config
import { LapTimer } from './lapTimer.js';


export class Simulation {
    constructor(robotImages, watermarkImage) {
        console.log("Initializing Simulation with robot images:", robotImages);
        
        // Initialize robot with default geometry
        this.robot = new Robot(
            DEFAULT_ROBOT_GEOMETRY.width_m / PIXELS_PER_METER, 
            DEFAULT_ROBOT_GEOMETRY.length_m / PIXELS_PER_METER,
            0
        );
        this.robot.setImages(robotImages.body, robotImages.wheel);
        console.log("Robot initialized:", this.robot);
        
        // Initialize PID controller
        this.pidController = new PIDController(120, 3, 15, 250, 110);
        console.log("PID controller initialized:", this.pidController);
        
        // Initialize track
        this.track = new Track();
        this.track.setWatermark(watermarkImage);
        console.log("Track initialized:", this.track);
        
        // Initialize lap timer
        this.lapTimer = new LapTimer(this.robot.wheelbase_m, this.robot.length_m);
        console.log("Lap timer initialized:", this.lapTimer);

        // Set default parameters
        this.params = {
            timeStep: 0.01,
            maxRobotSpeedMPS: 1.0,
            motorEfficiency: 1.0,
            motorResponseFactor: 0.03,
            sensorNoiseProb: 0.0,
            movementPerturbFactor: 0.0, 
            motorDeadbandPWM: 5,
            lineThreshold: 30,
        };
        this.totalSimTime_s = 0;
    }

    updateParameters(params) {
        if (params.robotGeometry) {
            this.robot.updateGeometry(params.robotGeometry);
            this.resetSimulation(this.robot.x_m, this.robot.y_m, this.robot.angle_rad);
        }
        this.params.timeStep = params.timeStep ?? this.params.timeStep;
        this.params.maxRobotSpeedMPS = params.maxRobotSpeedMPS ?? this.params.maxRobotSpeedMPS;
        this.params.motorEfficiency = params.motorEfficiency ?? this.params.motorEfficiency;
        this.params.motorResponseFactor = params.motorResponseFactor ?? this.params.motorResponseFactor;
        this.params.sensorNoiseProb = params.sensorNoiseProb ?? this.params.sensorNoiseProb;
        this.params.movementPerturbFactor = params.movementPerturbFactor ?? this.params.movementPerturbFactor;
        this.params.motorDeadbandPWM = params.motorDeadbandPWM ?? this.params.motorDeadbandPWM;
        this.params.lineThreshold = params.lineThreshold ?? this.params.lineThreshold; 
        
        if (this.track) { 
            this.track.lineThreshold = this.params.lineThreshold;
        }
        if (this.pidController) {
            this.pidController.updateSettings(params.pidSettings);
        }
        this.lapTimer.robotWidth_m = this.robot.wheelbase_m;
        this.lapTimer.robotLength_m = this.robot.length_m;
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
    
    async setTrackFromCanvas(sourceCanvas, startX_m, startY_m, startAngle_rad) {
        try {
            const success = await this.track.setFromCanvas(sourceCanvas, this.params.lineThreshold);
            if (success) {
                this.robot.resetState(startX_m, startY_m, startAngle_rad);
                this.pidController.reset();
                this.totalSimTime_s = 0;
                this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);
            }
            return success;
        } catch (error) {
            console.error("Error setting track from canvas:", error);
            return false;
        }
    }

    resetSimulation(x_m, y_m, angle_rad) {
        this.robot.resetState(x_m, y_m, angle_rad);
        this.pidController.reset();
        this.lapTimer.reset();
        this.draw();
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

        // New: Calculate effective max speed based on efficiency
        const effectiveMaxRobotSpeedMPS = this.params.maxRobotSpeedMPS * this.params.motorEfficiency;

        // Calculate target speeds based on PWM, using effectiveMaxRobotSpeedMPS
        let target_vL_mps = (motorPWMs.leftDirForward ? 1 : -1) * (motorPWMs.leftPWM / 255.0) * effectiveMaxRobotSpeedMPS;
        let target_vR_mps = (motorPWMs.rightDirForward ? 1 : -1) * (motorPWMs.rightPWM / 255.0) * effectiveMaxRobotSpeedMPS;
        
        // --- ADDED for exact match with script.js logic ---
        if (motorPWMs.leftPWM === 0) target_vL_mps = 0;
        if (motorPWMs.rightPWM === 0) target_vR_mps = 0;
        // --- END OF ADDITION ---
        
        this.robot.updateMovement(
            this.params.timeStep, 
            target_vL_mps, 
            target_vR_mps, 
            this.params.motorResponseFactor,
            effectiveMaxRobotSpeedMPS, // Use effective speed for clamping in robot movement
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
        if (!displayCtx) {
            console.error("No display context provided for drawing");
            return;
        }

        console.log("Drawing simulation:", {
            canvasWidth: displayCanvasWidth,
            canvasHeight: displayCanvasHeight,
            hasTrack: !!this.track,
            hasTrackImage: !!this.track?.imageData,
            hasRobot: !!this.robot,
            sensorStates: sensorStates
        });

        // Clear the canvas
        displayCtx.clearRect(0, 0, displayCanvasWidth, displayCanvasHeight);
        
        // Draw track if available
        if (this.track) {
            console.log("Drawing track");
            this.track.draw(displayCtx, displayCanvasWidth, displayCanvasHeight);
        } else {
            console.log("No track to draw");
        }
        
        // Draw robot if track and robot are available
        if (this.track?.imageData && this.robot) {
            console.log("Drawing robot");
            this.robot.draw(displayCtx, sensorStates);
        } else {
            console.log("Cannot draw robot - missing track image or robot");
        }
    }
}
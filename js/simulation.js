    import { Robot } from './robot.js';
    import { PIDController } from './pidController.js';
    import { Track } from './track.js';
    import { PIXELS_PER_METER, DEFAULT_ROBOT_GEOMETRY, currentMaxValError } from './config.js';
    import { LapTimer } from './lapTimer.js';


    export class Simulation {
        constructor(robotImages, watermarkImage) {
            this.robot = new Robot(
                DEFAULT_ROBOT_GEOMETRY.width_m / PIXELS_PER_METER, // Example initial position
                DEFAULT_ROBOT_GEOMETRY.length_m / PIXELS_PER_METER,
                0
            );
            this.robot.setImages(robotImages.body, robotImages.wheel);
            
            this.pidController = new PIDController(120, 3, 15, 250, 110); // Default PID vals
            this.track = new Track();
            this.track.setWatermark(watermarkImage);
            this.lapTimer = new LapTimer(this.robot.wheelbase_m, this.robot.length_m);

            this.params = {
                timeStep: 0.01,
                maxRobotSpeedMPS: 1.0,
                motorResponseFactor: 0.03,
                sensorNoiseProb: 0.0,
                movementPerturbFactor: 0.0, // Was 0.5, check default
                motorDeadbandPWM: 5,
                lineThreshold: 30,
            };
            this.totalSimTime_s = 0;
        }

        updateParameters(simParams, pidSettings, robotGeom) {
            // Simulation parameters
            this.params.timeStep = simParams.timeStep ?? this.params.timeStep;
            this.params.maxRobotSpeedMPS = simParams.maxRobotSpeedMPS ?? this.params.maxRobotSpeedMPS;
            this.params.motorResponseFactor = simParams.motorResponseFactor ?? this.params.motorResponseFactor;
            this.params.sensorNoiseProb = simParams.sensorNoiseProb ?? this.params.sensorNoiseProb;
            this.params.movementPerturbFactor = simParams.movementPerturbFactor ?? this.params.movementPerturbFactor;
            this.params.motorDeadbandPWM = simParams.motorDeadbandPWM ?? this.params.motorDeadbandPWM;
            this.params.lineThreshold = simParams.lineThreshold ?? this.params.lineThreshold; // Used for track loading
            
            if (this.track) { // Update track's line threshold if it exists
                this.track.lineThreshold = this.params.lineThreshold;
            }

            // PID parameters
            if (this.pidController && pidSettings) {
                this.pidController.updateSettings(pidSettings);
            }

            // Robot Geometry
            if (this.robot && robotGeom) {
                this.robot.updateGeometry(robotGeom);
                // If robot dimensions change, lap timer might need update
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
        
        // This is the core fixed update logic
        fixedUpdate() {
            if (!this.track.imageData) return { sensorStates: null, pidTerms: null, motorPWMs: null, lapData: null, outOfBounds: false };

            const sensorPositions_px = this.robot.getSensorPositions_imagePx();
            let sL = this.track.isPixelOnLine(sensorPositions_px.left.x, sensorPositions_px.left.y);
            let sC = this.track.isPixelOnLine(sensorPositions_px.center.x, sensorPositions_px.center.y);
            let sR = this.track.isPixelOnLine(sensorPositions_px.right.x, sensorPositions_px.right.y);

            // Apply sensor noise
            if (this.params.sensorNoiseProb > 0) {
                if (Math.random() < this.params.sensorNoiseProb) sL = !sL;
                if (Math.random() < this.params.sensorNoiseProb) sC = !sC;
                if (Math.random() < this.params.sensorNoiseProb) sR = !sR;
            }
            
            const sensorStates = { left: sL, center: sC, right: sR };

            this.pidController.calculateError(sL, sC, sR, currentMaxValError); // currentMaxValError from config
            const adjPID = this.pidController.computeOutput(this.params.timeStep);
            const motorPWMs = this.pidController.getMotorPWMs(adjPID, this.params.motorDeadbandPWM);

            const target_vL_mps = (motorPWMs.leftDirForward ? 1 : -1) * (motorPWMs.leftPWM / 255.0) * this.params.maxRobotSpeedMPS;
            const target_vR_mps = (motorPWMs.rightDirForward ? 1 : -1) * (motorPWMs.rightPWM / 255.0) * this.params.maxRobotSpeedMPS;
            
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
            
            // Check boundaries
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
            if (this.track.imageData) { // Only draw robot if track is loaded
                 this.robot.draw(displayCtx, sensorStates);
            }
        }
    }
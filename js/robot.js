    import { PIXELS_PER_METER, WHEEL_LENGTH_M, WHEEL_WIDTH_M, DEFAULT_ROBOT_GEOMETRY } from './config.js';
    import { clamp } from './utils.js';

    export class Robot {
        constructor(initialX_m = 0.1, initialY_m = 0.1, initialAngle_rad = 0) {
            this.x_m = initialX_m;
            this.y_m = initialY_m;
            this.angle_rad = initialAngle_rad;

            // Geometry (can be updated from Robot Editor)
            this.wheelbase_m = DEFAULT_ROBOT_GEOMETRY.width_m; // Distance between wheels
            this.length_m = DEFAULT_ROBOT_GEOMETRY.length_m;   // Overall length
            this.sensorForwardProtrusion_m = DEFAULT_ROBOT_GEOMETRY.sensorOffset_m;
            this.sensorSideSpread_m = DEFAULT_ROBOT_GEOMETRY.sensorSpread_m;
            this.sensorDiameter_m = DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m;
            
            this.currentApplied_vL_mps = 0;
            this.currentApplied_vR_mps = 0;

            this.centerTrail = [];
            this.leftWheelTrail = [];
            this.rightWheelTrail = [];
            this.maxTrailLength = 500;

            this.bodyImage = null;
            this.wheelImage = null;
        }

        setImages(bodyImg, wheelImg) {
            this.bodyImage = bodyImg;
            this.wheelImage = wheelImg;
        }
        
        // Method to update geometry from an editor or settings
        updateGeometry(geometry) {
            if (!geometry) return;

            // Update all geometry properties
            this.wheelbase_m = geometry.width_m;
            this.length_m = geometry.length_m;
            this.sensorForwardProtrusion_m = geometry.sensorOffset_m;
            this.sensorSideSpread_m = geometry.sensorSpread_m;
            this.sensorDiameter_m = geometry.sensorDiameter_m;

            // Update derived properties
            this.wheelRadius_m = this.sensorDiameter_m / 2;
            this.wheelCircumference_m = 2 * Math.PI * this.wheelRadius_m;
            this.maxAngularSpeed_radps = this.maxSpeed_mps / this.wheelRadius_m;
            this.maxAngularAccel_radps2 = this.maxAccel_mps2 / this.wheelRadius_m;

            // Update sensor positions
            this.updateSensorPositions();
        }

        updateSensorPositions() {
            // Calculate sensor positions based on current geometry
            const halfWidth = this.wheelbase_m / 2;
            const halfLength = this.length_m / 2;
            const sensorOffset = this.sensorForwardProtrusion_m;
            const sensorSpread = this.sensorSideSpread_m;

            // Update sensor positions
            this.sensorPositions = [
                { x: halfLength + sensorOffset, y: 0 }, // Front center
                { x: halfLength + sensorOffset, y: sensorSpread }, // Front right
                { x: halfLength + sensorOffset, y: -sensorSpread }, // Front left
                { x: -halfLength, y: halfWidth }, // Back right
                { x: -halfLength, y: -halfWidth } // Back left
            ];
        }

        resetState(x_m, y_m, angle_rad) {
            this.x_m = x_m;
            this.y_m = y_m;
            this.angle_rad = angle_rad;
            this.currentApplied_vL_mps = 0;
            this.currentApplied_vR_mps = 0;
            this.resetTrails();
        }

        resetTrails() {
            this.centerTrail = [];
            this.leftWheelTrail = [];
            this.rightWheelTrail = [];
        }

        updateMovement(dt_s, target_vL_mps, target_vR_mps, motorResponseFactor, maxPhysicalSpeed_mps, movementPerturbationFactor) {
            // Apply motor response (inertia)
            this.currentApplied_vL_mps += (target_vL_mps - this.currentApplied_vL_mps) * motorResponseFactor;
            this.currentApplied_vR_mps += (target_vR_mps - this.currentApplied_vR_mps) * motorResponseFactor;

            // Clamp to max physical speed (though target speeds should already be capped)
            this.currentApplied_vL_mps = clamp(this.currentApplied_vL_mps, -maxPhysicalSpeed_mps, maxPhysicalSpeed_mps);
            this.currentApplied_vR_mps = clamp(this.currentApplied_vR_mps, -maxPhysicalSpeed_mps, maxPhysicalSpeed_mps);

            let linear_displacement_m = (this.currentApplied_vR_mps + this.currentApplied_vL_mps) / 2.0 * dt_s;
            let d_theta_rad = 0;
            if (this.wheelbase_m > 0.001) {
                d_theta_rad = -(this.currentApplied_vR_mps - this.currentApplied_vL_mps) / this.wheelbase_m * dt_s;
            }

            // Apply movement perturbation
            if (movementPerturbationFactor > 0) {
                const perturbR = (Math.random() * 2 - 1) * movementPerturbationFactor;
                const perturbL = (Math.random() * 2 - 1) * movementPerturbationFactor;
                linear_displacement_m *= (1 + perturbR);
                d_theta_rad *= (1 + perturbL);
            }

            this.angle_rad += d_theta_rad;
            this.angle_rad = Math.atan2(Math.sin(this.angle_rad), Math.cos(this.angle_rad)); // Normalize angle
            this.x_m += linear_displacement_m * Math.cos(this.angle_rad);
            this.y_m += linear_displacement_m * Math.sin(this.angle_rad);

            this._updateTrails();
        }

        _updateTrails() {
            this.centerTrail.push({ x_m: this.x_m, y_m: this.y_m });
            if (this.centerTrail.length > this.maxTrailLength) this.centerTrail.shift();

            const halfWheelbase_m = this.wheelbase_m / 2;
            const sinAngle = Math.sin(this.angle_rad);
            const cosAngle = Math.cos(this.angle_rad);

            const x_lw_m = this.x_m + halfWheelbase_m * sinAngle;
            const y_lw_m = this.y_m - halfWheelbase_m * cosAngle;
            this.leftWheelTrail.push({ x_m: x_lw_m, y_m: y_lw_m });
            if (this.leftWheelTrail.length > this.maxTrailLength) this.leftWheelTrail.shift();

            const x_rw_m = this.x_m - halfWheelbase_m * sinAngle;
            const y_rw_m = this.y_m + halfWheelbase_m * cosAngle;
            this.rightWheelTrail.push({ x_m: x_rw_m, y_m: y_rw_m });
            if (this.rightWheelTrail.length > this.maxTrailLength) this.rightWheelTrail.shift();
        }

        getSensorPositions_imagePx() {
            const sensorLineCenterX_m = this.x_m + this.sensorForwardProtrusion_m * Math.cos(this.angle_rad);
            const sensorLineCenterY_m = this.y_m + this.sensorForwardProtrusion_m * Math.sin(this.angle_rad);
            
            const perpendicularAngle = this.angle_rad - Math.PI / 2; // Angle for sensor spread
            
            const lX_m = sensorLineCenterX_m + this.sensorSideSpread_m * Math.cos(perpendicularAngle);
            const lY_m = sensorLineCenterY_m + this.sensorSideSpread_m * Math.sin(perpendicularAngle);
            
            const cX_m = sensorLineCenterX_m;
            const cY_m = sensorLineCenterY_m;
            
            const rX_m = sensorLineCenterX_m - this.sensorSideSpread_m * Math.cos(perpendicularAngle);
            const rY_m = sensorLineCenterY_m - this.sensorSideSpread_m * Math.sin(perpendicularAngle);
            
            return {
                left:   { x: Math.round(lX_m * PIXELS_PER_METER), y: Math.round(lY_m * PIXELS_PER_METER) },
                center: { x: Math.round(cX_m * PIXELS_PER_METER), y: Math.round(cY_m * PIXELS_PER_METER) },
                right:  { x: Math.round(rX_m * PIXELS_PER_METER), y: Math.round(rY_m * PIXELS_PER_METER) }
            };
        }

        draw(ctx, sensorStates = null) {
            ctx.save();
            ctx.translate(this.x_m * PIXELS_PER_METER, this.y_m * PIXELS_PER_METER);
            ctx.rotate(this.angle_rad);

            const robotBodyWidthPx = this.wheelbase_m * PIXELS_PER_METER;
            const robotBodyLengthPx = this.length_m * PIXELS_PER_METER;

            // Draw Body
            if (this.bodyImage && this.bodyImage.complete && this.bodyImage.naturalWidth > 0) {
                ctx.drawImage(this.bodyImage, -robotBodyLengthPx / 2, -robotBodyWidthPx / 2, robotBodyLengthPx, robotBodyWidthPx);
            } else {
                ctx.fillStyle = 'blue';
                ctx.fillRect(-robotBodyLengthPx / 2, -robotBodyWidthPx / 2, robotBodyLengthPx, robotBodyWidthPx);
            }

            // Draw Wheels
            const wheelLengthPx = WHEEL_LENGTH_M * PIXELS_PER_METER;
            const wheelWidthPx = WHEEL_WIDTH_M * PIXELS_PER_METER;
            const wheelOffsetY = robotBodyWidthPx / 2; // Assuming wheels are at the edge of wheelbase

            if (this.wheelImage && this.wheelImage.complete && this.wheelImage.naturalWidth > 0) {
                ctx.drawImage(this.wheelImage, -wheelLengthPx / 2, -wheelOffsetY - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx); // Left wheel relative
                ctx.drawImage(this.wheelImage, -wheelLengthPx / 2, wheelOffsetY - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx); // Right wheel relative
            } else {
                ctx.fillStyle = '#555555';
                ctx.fillRect(-wheelLengthPx / 2, -wheelOffsetY - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
                ctx.fillRect(-wheelLengthPx / 2, wheelOffsetY - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            }
            
            // Draw direction indicator (simple triangle)
            ctx.fillStyle = 'lightblue';
            ctx.beginPath();
            const indicatorTipX = robotBodyLengthPx / 2 + 3; // Tip slightly ahead of body
            const indicatorBaseX = robotBodyLengthPx / 2 - Math.min(8, robotBodyLengthPx * 0.1);
            const indicatorBaseSpread = robotBodyWidthPx / 4; 
            ctx.moveTo(indicatorTipX, 0);
            ctx.lineTo(indicatorBaseX, -indicatorBaseSpread / 2);
            ctx.lineTo(indicatorBaseX, indicatorBaseSpread / 2);
            ctx.closePath();
            ctx.fill();

            ctx.restore(); // Restore transform for robot

            // Draw Trails (outside robot's transformed context)
            const drawTrail = (trail, color, width) => {
                if (trail.length > 1) {
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = width;
                    ctx.moveTo(trail[0].x_m * PIXELS_PER_METER, trail[0].y_m * PIXELS_PER_METER);
                    for (let i = 1; i < trail.length; i++) {
                        ctx.lineTo(trail[i].x_m * PIXELS_PER_METER, trail[i].y_m * PIXELS_PER_METER);
                    }
                    ctx.stroke();
                }
            };
            drawTrail(this.centerTrail, 'rgba(0, 0, 255, 0.3)', 3); // Thinner trail
            drawTrail(this.leftWheelTrail, 'rgba(255, 0, 0, 0.4)', 2);
            drawTrail(this.rightWheelTrail, 'rgba(0, 255, 0, 0.4)', 2);

            // Draw Sensors if states provided
            if (sensorStates) {
                this.drawSensors(ctx, sensorStates);
            }
        }

        drawSensors(ctx, sensorStates) {
            const positions_img_px = this.getSensorPositions_imagePx();
            const sensorRadiusPx = (this.sensorDiameter_m / 2) * PIXELS_PER_METER;
            
            const drawSensor = (pos_px, isOnLine) => {
                ctx.beginPath();
                ctx.arc(pos_px.x, pos_px.y, Math.max(1, sensorRadiusPx), 0, 2 * Math.PI);
                ctx.fillStyle = isOnLine ? 'green' : 'gray';
                ctx.fill();
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();
            };

            drawSensor(positions_img_px.left, sensorStates.left);
            drawSensor(positions_img_px.center, sensorStates.center);
            drawSensor(positions_img_px.right, sensorStates.right);
        }
    }
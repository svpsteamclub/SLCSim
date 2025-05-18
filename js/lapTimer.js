javascript
    export class LapTimer {
        constructor(robotWidth_m, robotLength_m) {
            this.robotWidth_m = robotWidth_m;
            this.robotLength_m = robotLength_m;
            
            this.initialLapState = { x_m: 0, y_m: 0, angle_rad: 0 };
            this.lapStartTime_sim_s = 0;
            this.totalSimulationTime_s = 0; // Should be managed by the main simulation loop
            this.lapTimes = [];
            this.bestLapTime_s = Infinity;
            this.hasLeftStartZone = false;
            this.lapCounter = 0;
            
            this.robot_x_m_previous_tick = 0;
            this.robot_y_m_previous_tick = 0;
        }

        initialize(initialRobotState, totalSimTime_s = 0) {
            this.initialLapState = { ...initialRobotState };
            this.lapStartTime_sim_s = totalSimTime_s; // Start time of the current lap is the current total sim time
            this.totalSimulationTime_s = totalSimTime_s;
            this.lapTimes = [];
            this.bestLapTime_s = Infinity;
            this.hasLeftStartZone = false;
            this.lapCounter = 0;

            this.robot_x_m_previous_tick = initialRobotState.x_m;
            this.robot_y_m_previous_tick = initialRobotState.y_m;
        }

        update(currentSimTime_s, robotState) {
            this.totalSimulationTime_s = currentSimTime_s;
            let newLapCompleted = false;
            let completedLapTime = null;

            const START_LINE_TOLERANCE_LATERAL_M = this.robotWidth_m * 0.75; // Tolerance for crossing start line
            const START_ZONE_EXIT_DISTANCE_M = this.robotLength_m * 1.25; // Distance to move away before re-triggering

            if (!this.hasLeftStartZone) {
                const distFromStartPointSq = Math.pow(robotState.x_m - this.initialLapState.x_m, 2) + Math.pow(robotState.y_m - this.initialLapState.y_m, 2);
                if (distFromStartPointSq > Math.pow(START_ZONE_EXIT_DISTANCE_M, 2)) {
                    this.hasLeftStartZone = true;
                }
            }

            if (this.hasLeftStartZone) {
                const P0_x = this.initialLapState.x_m;
                const P0_y = this.initialLapState.y_m;
                const startAngle = this.initialLapState.angle_rad;

                // Vector D representing the direction of the start line (perpendicular to robot's start orientation)
                // This is simplified: we check crossing a plane at P0 perpendicular to robot's initial orientation.
                const D_x = Math.cos(startAngle); // Direction robot was facing
                const D_y = Math.sin(startAngle);

                // Vector from start point to previous robot position
                const V_prev_x = this.robot_x_m_previous_tick - P0_x;
                const V_prev_y = this.robot_y_m_previous_tick - P0_y;
                // Vector from start point to current robot position
                const V_curr_x = robotState.x_m - P0_x;
                const V_curr_y = robotState.y_m - P0_y;

                // Project these vectors onto the robot's initial direction vector D
                // proj_prev < 0 means robot was behind the start line (relative to its initial orientation)
                // proj_curr > 0 means robot is now in front of the start line
                const proj_prev = V_prev_x * D_x + V_prev_y * D_y;
                const proj_curr = V_curr_x * D_x + V_curr_y * D_y;
                
                const epsilon = 1e-3; // Small tolerance for being exactly on the line

                if (proj_prev <= epsilon && proj_curr > epsilon) { // Crossed the start/finish line plane from "behind" to "in front"
                    // Check lateral offset: distance from robot's current position to the infinite line defined by P0 and robot's initial orientation
                    // Normal vector N to the direction D
                    const N_x = -D_y; 
                    const N_y = D_x;
                    const lateral_offset = Math.abs(V_curr_x * N_x + V_curr_y * N_y);

                    if (lateral_offset < START_LINE_TOLERANCE_LATERAL_M) {
                        this.lapCounter++;
                        completedLapTime = this.totalSimulationTime_s - this.lapStartTime_sim_s;

                        this.lapTimes.unshift(completedLapTime); // Add to beginning
                        if (this.lapTimes.length > 5) {
                            this.lapTimes.pop(); // Keep only last 5
                        }

                        if (completedLapTime < this.bestLapTime_s) {
                            this.bestLapTime_s = completedLapTime;
                        }
                        
                        this.lapStartTime_sim_s = this.totalSimulationTime_s; // Reset start time for the new lap
                        this.hasLeftStartZone = false; // Must leave start zone again
                        newLapCompleted = true;
                    }
                }
            }
            this.robot_x_m_previous_tick = robotState.x_m;
            this.robot_y_m_previous_tick = robotState.y_m;
            
            return { newLapCompleted, completedLapTime };
        }
        
        getCurrentLapTime() {
            return this.totalSimulationTime_s - this.lapStartTime_sim_s;
        }

        getDisplayData() {
            return {
                currentLapTime_s: this.getCurrentLapTime(),
                bestLapTime_s: this.bestLapTime_s === Infinity ? null : this.bestLapTime_s,
                last5Laps: this.lapTimes.slice(0, 5).map((time, index) => ({
                    lapNum: this.lapCounter - index,
                    time_s: time
                }))
            };
        }
        
        reset(robotWidth_m, robotLength_m) { // Allow updating dimensions if robot changes
            this.robotWidth_m = robotWidth_m;
            this.robotLength_m = robotLength_m;
            this.initialLapState = { x_m: 0, y_m: 0, angle_rad: 0 };
            this.lapStartTime_sim_s = 0;
            // totalSimulationTime_s is reset by simulation core
            this.lapTimes = [];
            this.bestLapTime_s = Infinity;
            this.hasLeftStartZone = false;
            this.lapCounter = 0;
            this.robot_x_m_previous_tick = 0;
            this.robot_y_m_previous_tick = 0;
        }
    }
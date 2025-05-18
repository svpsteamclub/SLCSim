    export const AVAILABLE_TRACKS = [
        { displayName: "Pista 1 (1050x1050)", fileName: "assets/tracks/track1_1050.png", width: 1050, height: 1050, startX: 500, startY: 875, startAngle: 0 },
        { displayName: "Pista 2 (1400x1400)", fileName: "assets/tracks/track2_1400.png", width: 1400, height: 1400, startX: 500, startY: 1225, startAngle: 0 },
        { displayName: "Pista 3 (1750x1750)", fileName: "assets/tracks/track3_1750.png", width: 1750, height: 1750, startX: 400, startY: 175, startAngle: 0 },
        { displayName: "Pista de Pruebas I (940x1240)", fileName: "assets/tracks/testTrack.png", width: 940, height: 1240, startX: 100, startY: 150, startAngle: 0 },
        { displayName: "Pista en Meson (1750x1040)", fileName: "assets/tracks/PistaMeson.png", width: 1750, height: 1040, startX: 500, startY: 350, startAngle: 0 },
    ];

    export const ROBOT_IMAGE_PATHS = {
        body: 'assets/robot_body.png',
        wheel: 'assets/robot_wheel.png',
    };
    export const WATERMARK_IMAGE_PATH = 'assets/SVPSTEAM_Club.png';

    export const WHEEL_LENGTH_M = 0.07; // Default, can be overridden by robot editor
    export const WHEEL_WIDTH_M = 0.03;  // Default

    export const PIXELS_PER_METER = 1000; // Fixed scale

    // For PID bars visualization
    export const MAX_BAR_HEIGHT_PX = 50;
    export let currentMaxValError = 2.5; // can be updated
    export let currentMaxValPTerm = 150;
    export let currentMaxValITerm = 50;
    export let currentMaxValDTerm = 150;
    export let currentMaxValAdjPID = 255; // Initial, might be updated based on VEL_BASE
    export const MAX_VAL_PWM_BAR = 255;

    // Default robot geometry (can be overridden by Robot Editor)
    export const DEFAULT_ROBOT_GEOMETRY = {
        width_m: 0.16,     // Wheelbase
        length_m: 0.34,
        sensorSpread_m: 0.016,
        sensorOffset_m: 0.14,
        sensorDiameter_m: 0.012
    };

    // Track editor constants
    export const TRACK_PART_SIZE_PX = 350;
    export const AVAILABLE_TRACK_PARTS = [ // filenames relative to assets/track_parts/
        { name: "Recta", file: "recta.png", connections: { N: true, S: true, E: false, W: false } },
        { name: "Curva", file: "curva.png", connections: { N: false, S: true, E: false, W: true } },
		 { name: "Curva Cerrada", file: "curva_cerrada.png", connections: { N: false, S: true, E: true, W: false } },
    { name: "Esquina", file: "esquina.png", connections: { N: false, S: true, E: true, W: false } }, // Assuming you have this
    { name: "Harpin", file: "harpin.png", connections: { N: false, S: true, E: true, W: false } }, // Assuming you have this
    { name: "Harpin Asimetrico", file: "harpin_asimetrico.png", connections: { N: false, S: true, E: true, W: false } }, // If you have a horizontal straight
    { name: "Chicana", file: "chicana.png", connections: { N: true, S: true, E: false, W: false } },
    { name: "Diagonal", file: "diagonal.png", connections: { N: false, S: true, E: true, W: false } }, // Assuming
   
        // Add more parts: curve_NE, curve_SW, curve_SE, T_NSE, T_NSW, T_NEW, T_SEW, Cross_NSEW
        // Ensure you create these PNGs (350x350px) and place them in assets/track_parts/
        // The 'connections' property will be crucial for random generation.
    ];
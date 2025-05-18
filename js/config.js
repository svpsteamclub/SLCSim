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
    // In js/config.js
export const AVAILABLE_TRACK_PARTS = [
    { name: "Straight (N-S)", file: "straight_NS.png", connections: { N: true, S: true } }, // Assuming straight_NS.png is vertical
    { name: "Straight (E-W)", file: "straight_EW.png", connections: { E: true, W: true } }, // Assuming straight_EW.png is horizontal
    { name: "Curve (N-E)",    file: "curve_NE.png",    connections: { N: true, E: true } },
    { name: "Curve (N-W)",    file: "curve_NW.png",    connections: { N: true, W: true } },
    { name: "Curve (S-E)",    file: "curve_SE.png",    connections: { S: true, E: true } },
    { name: "Curve (S-W)",    file: "curve_SW.png",    connections: { S: true, W: true } },
    { name: "T-Junction (N-S-E)", file: "t_NSE.png", connections: { N: true, S: true, E: true } },
    { name: "T-Junction (N-S-W)", file: "t_NSW.png", connections: { N: true, S: true, W: true } },
    { name: "T-Junction (N-E-W)", file: "t_NEW.png", connections: { N: true, E: true, W: true } },
    { name: "T-Junction (S-E-W)", file: "t_SEW.png", connections: { S: true, E: true, W: true } },
    { name: "Crossroad",      file: "cross_NSEW.png",  connections: { N: true, S: true, E: true, W: true } },
    // Add more parts. Ensure 'file' matches your PNGs in assets/track_parts/
    // and 'connections' accurately describe the openings for the 0-degree rotation of that image.
];
    ];
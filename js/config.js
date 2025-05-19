// js/config.js

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

export const WHEEL_LENGTH_M = 0.07;
export const WHEEL_WIDTH_M = 0.03;

export const PIXELS_PER_METER = 1000;

export const MAX_BAR_HEIGHT_PX = 50;
export let currentMaxValError = 2.5;
export let currentMaxValPTerm = 150;
export let currentMaxValITerm = 50;
export let currentMaxValDTerm = 150;
export let currentMaxValAdjPID = 255;
export const MAX_VAL_PWM_BAR = 255;

export const DEFAULT_ROBOT_GEOMETRY = {
    width_m: 0.16,
    length_m: 0.34,
    sensorSpread_m: 0.016,
    sensorOffset_m: 0.14,
    sensorDiameter_m: 0.012
};

export const TRACK_PART_SIZE_PX = 350;

// --- MODIFIED AVAILABLE_TRACK_PARTS ---
export const AVAILABLE_TRACK_PARTS = [
    { 
        name: "Recta", 
        file: "recta.png", // Assume this PNG is a North-South straight line
        connections: { N: true, S: true } 
    },
    { 
        name: "Curva 90°", 
        file: "curva_base.png", // Assume this PNG is a North-to-East curve
        connections: { N: true, E: true } 
    },
	{ 
        name: "Chicana", 
        file: "chicana.png", // Assume this PNG is a North-South straight line
        connections: { N: true, S: true } 
    },
	{ 
        name: "Curva 90° abierta", 
        file: "curva.png", // Assume this PNG is a North-South straight line
        connections: { N: true, E: true } 
    },
	{ 
        name: "Diagonal", 
        file: "diagonal.png", // Assume this PNG is a North-South straight line
        connections: { N: true, E: true } 
    },
	{ 
        name: "Esquina", 
        file: "esquina.png", // Assume this PNG is a North-South straight line
        connections: { N: true, E: true } 
    },
	{ 
        name: "Harpin", 
        file: "harpin.png", // Assume this PNG is a North-South straight line
        connections: { N: true, E: true } 
    },
	{ 
        name: "Harpin Asimetrico", 
        file: "harpin_asimetrico.png", // Assume this PNG is a North-South straight line
        connections: { N: true, E: true } 
    },
	
    // You can add other *structurally different* pieces here if needed,
    // e.g., a chicana that isn't just two curves, or a special bridge piece.
    // But for basic path generation, the above two are the minimum for Option 1.
];
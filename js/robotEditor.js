    // js/robotEditor.js
    import { getDOMElements } from './ui.js';
    import { PIXELS_PER_METER, DEFAULT_ROBOT_GEOMETRY, ROBOT_IMAGE_PATHS } from './config.js';
    // This will be a complex module. For now, a skeleton.

    let editorCanvas, ctx;
    let robotDesign = { // Example structure
        name: "MiRobot",
        components: [], // { type: 'body'|'wheel'|'sensor', x_m, y_m, angle_rad, width_m, height_m, imageSrc }
        derived_geometry: { ...DEFAULT_ROBOT_GEOMETRY } // This will be calculated and sent to simulator
    };

    let activeComponent = null;
    let dragState = {
        isDragging: false,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0,
        originalAngle: 0,
        mode: 'move' // 'move' | 'rotate' | 'scale'
    };

    let componentImages = {
        body: null,
        wheel: null,
        sensor: null
    };

    export function initRobotEditor(mainAppInterface) {
        const elems = getDOMElements();
        editorCanvas = elems.robotEditorCanvas;
        if (!editorCanvas) {
            console.error("Robot Editor Canvas not found!");
            return;
        }
        ctx = editorCanvas.getContext('2d');
        
        // Load component images
        loadComponentImages().then(() => {
            console.log("Robot Editor Initialized");
            setupEventListeners(elems, mainAppInterface);
            renderEditor();
        });
    }

    async function loadComponentImages() {
        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        };

        try {
            componentImages.body = await loadImage(ROBOT_IMAGE_PATHS.body);
            componentImages.wheel = await loadImage(ROBOT_IMAGE_PATHS.wheel);
            componentImages.sensor = await loadImage('assets/sensor.png'); // You'll need to add this image
        } catch (error) {
            console.error("Error loading component images:", error);
        }
    }

    function setupEventListeners(elems, mainAppInterface) {
        // Component controls
        elems.addComponentToRobot.addEventListener('click', () => {
            const type = elems.robotComponentSelector.value;
            addComponent(type);
        });

        elems.saveRobotDesign.addEventListener('click', saveDesign);
        elems.loadRobotDesign.addEventListener('click', () => {
            elems.loadRobotDesignInput.click();
        });

        elems.loadRobotDesignInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const design = JSON.parse(event.target.result);
                        loadDesign(design);
                    } catch (error) {
                        console.error("Error loading design:", error);
                        alert("Error loading robot design file");
                    }
                };
                reader.readAsText(file);
            }
        });

        // Canvas interaction
        editorCanvas.addEventListener('mousedown', onEditorMouseDown);
        editorCanvas.addEventListener('mousemove', onEditorMouseMove);
        editorCanvas.addEventListener('mouseup', onEditorMouseUp);
        editorCanvas.addEventListener('mouseleave', onEditorMouseUp);

        // Custom component image
        elems.customComponentImage.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && activeComponent) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        activeComponent.imageSrc = event.target.result;
                        renderEditor();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function addComponent(type) {
        const component = {
            type,
            x_m: editorCanvas.width / (2 * PIXELS_PER_METER),
            y_m: editorCanvas.height / (2 * PIXELS_PER_METER),
            angle_rad: 0,
            width_m: type === 'body' ? 0.34 : type === 'wheel' ? 0.05 : 0.012,
            height_m: type === 'body' ? 0.16 : type === 'wheel' ? 0.05 : 0.012,
            imageSrc: null
        };
        robotDesign.components.push(component);
        activeComponent = component;
        calculateDerivedGeometry();
        renderEditor();
    }

    function onEditorMouseDown(event) {
        const rect = editorCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / PIXELS_PER_METER;
        const y = (event.clientY - rect.top) / PIXELS_PER_METER;

        // Check if clicking on a component
        for (let i = robotDesign.components.length - 1; i >= 0; i--) {
            const comp = robotDesign.components[i];
            if (isPointInComponent(x, y, comp)) {
                activeComponent = comp;
                dragState = {
                    isDragging: true,
                    startX: x,
                    startY: y,
                    originalX: comp.x_m,
                    originalY: comp.y_m,
                    originalAngle: comp.angle_rad,
                    mode: event.shiftKey ? 'rotate' : event.altKey ? 'scale' : 'move'
                };
                break;
            }
        }
    }

    function onEditorMouseMove(event) {
        if (!dragState.isDragging || !activeComponent) return;

        const rect = editorCanvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / PIXELS_PER_METER;
        const y = (event.clientY - rect.top) / PIXELS_PER_METER;

        switch (dragState.mode) {
            case 'move':
                activeComponent.x_m = dragState.originalX + (x - dragState.startX);
                activeComponent.y_m = dragState.originalY + (y - dragState.startY);
                break;
            case 'rotate':
                const dx = x - activeComponent.x_m;
                const dy = y - activeComponent.y_m;
                activeComponent.angle_rad = Math.atan2(dy, dx);
                break;
            case 'scale':
                const scale = Math.sqrt(
                    Math.pow(x - activeComponent.x_m, 2) + 
                    Math.pow(y - activeComponent.y_m, 2)
                ) / Math.sqrt(
                    Math.pow(dragState.startX - activeComponent.x_m, 2) + 
                    Math.pow(dragState.startY - activeComponent.y_m, 2)
                );
                activeComponent.width_m = dragState.originalWidth * scale;
                activeComponent.height_m = dragState.originalHeight * scale;
                break;
        }

        calculateDerivedGeometry();
        renderEditor();
    }

    function onEditorMouseUp() {
        if (dragState.isDragging) {
            dragState.isDragging = false;
            calculateDerivedGeometry();
        }
    }

    function isPointInComponent(x_m, y_m, component) {
        const dx = x_m - component.x_m;
        const dy = y_m - component.y_m;
        const rotatedX = dx * Math.cos(-component.angle_rad) - dy * Math.sin(-component.angle_rad);
        const rotatedY = dx * Math.sin(-component.angle_rad) + dy * Math.cos(-component.angle_rad);
        
        return Math.abs(rotatedX) <= component.width_m / 2 &&
               Math.abs(rotatedY) <= component.height_m / 2;
    }

    function renderEditor() {
        if (!ctx) return;
        ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
        
        // Draw grid
        drawGrid();
        
        // Draw components
        robotDesign.components.forEach(comp => {
            drawComponent(comp);
        });

        // Draw active component highlight
        if (activeComponent) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                (activeComponent.x_m - activeComponent.width_m/2) * PIXELS_PER_METER,
                (activeComponent.y_m - activeComponent.height_m/2) * PIXELS_PER_METER,
                activeComponent.width_m * PIXELS_PER_METER,
                activeComponent.height_m * PIXELS_PER_METER
            );
        }
    }

    function drawGrid() {
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        const gridSize_m = 0.1; // 10cm grid
        
        for (let x = 0; x < editorCanvas.width / (gridSize_m * PIXELS_PER_METER); x++) {
            ctx.beginPath();
            ctx.moveTo(x * gridSize_m * PIXELS_PER_METER, 0);
            ctx.lineTo(x * gridSize_m * PIXELS_PER_METER, editorCanvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < editorCanvas.height / (gridSize_m * PIXELS_PER_METER); y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * gridSize_m * PIXELS_PER_METER);
            ctx.lineTo(editorCanvas.width, y * gridSize_m * PIXELS_PER_METER);
            ctx.stroke();
        }
    }

    function drawComponent(component) {
        ctx.save();
        ctx.translate(component.x_m * PIXELS_PER_METER, component.y_m * PIXELS_PER_METER);
        ctx.rotate(component.angle_rad);
        
        const width_px = component.width_m * PIXELS_PER_METER;
        const height_px = component.height_m * PIXELS_PER_METER;
        
        if (component.imageSrc) {
            const img = new Image();
            img.src = component.imageSrc;
            ctx.drawImage(img, -width_px/2, -height_px/2, width_px, height_px);
        } else {
            // Draw default shapes
            ctx.fillStyle = component.type === 'body' ? '#4a90e2' : 
                           component.type === 'wheel' ? '#2c3e50' : '#e74c3c';
            ctx.fillRect(-width_px/2, -height_px/2, width_px, height_px);
        }
        
        ctx.restore();
    }

    function calculateDerivedGeometry() {
        // Find body component
        const body = robotDesign.components.find(c => c.type === 'body');
        if (!body) return;

        // Find wheels
        const wheels = robotDesign.components.filter(c => c.type === 'wheel');
        
        // Find sensors
        const sensors = robotDesign.components.filter(c => c.type === 'sensor');

        // Calculate derived geometry
        robotDesign.derived_geometry = {
            width_m: body.width_m,
            length_m: body.height_m,
            sensorSpread_m: sensors.length > 1 ? 
                Math.abs(sensors[0].x_m - sensors[sensors.length-1].x_m) / 2 : 
                DEFAULT_ROBOT_GEOMETRY.sensorSpread_m,
            sensorOffset_m: sensors.length > 0 ? 
                Math.abs(sensors[0].y_m - body.y_m) : 
                DEFAULT_ROBOT_GEOMETRY.sensorOffset_m,
            sensorDiameter_m: sensors.length > 0 ? 
                sensors[0].width_m : 
                DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m
        };
    }

    function saveDesign() {
        const design = {
            name: robotDesign.name,
            components: robotDesign.components,
            derived_geometry: robotDesign.derived_geometry
        };
        
        const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${robotDesign.name}.robotdesign`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function loadDesign(design) {
        robotDesign = design;
        activeComponent = null;
        calculateDerivedGeometry();
        renderEditor();
    }

    export function getRobotDerivedGeometry() {
        // This function should calculate actual robot dimensions based on placed components
        // For now, returns the current placeholder or default
        return robotDesign.derived_geometry;
    }
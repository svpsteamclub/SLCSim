class TrackEditor {
    constructor(canvasId, simulationCanvasId, defaultLineColor = '#000000', defaultBgColor = '#FFFFFF') {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.simulationCanvas = document.getElementById(simulationCanvasId); // Para transferir la pista
        this.drawing = false;
        this.lineColor = defaultLineColor;
        this.bgColor = defaultBgColor;
        this.lineWidth = 10; // Grosor de la línea de la pista

        this.clearTrack(); // Pinta el fondo inicial
        this.initEventListeners();
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing()); // Por si el mouse sale del canvas
    }

    startDrawing(e) {
        this.drawing = true;
        this.ctx.beginPath();
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }

    draw(e) {
        if (!this.drawing) return;
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        this.ctx.strokeStyle = this.lineColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round'; // Para que las líneas se vean más suaves
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.drawing) {
            this.ctx.closePath();
            this.drawing = false;
            this.transferToSimulation(); // Actualiza la pista en el canvas de simulación
        }
    }

    setLineColor(color) {
        this.lineColor = color;
    }

    setBgColor(color) {
        this.bgColor = color;
        this.clearTrack(); // Repinta con el nuevo fondo
    }

    clearTrack() {
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.transferToSimulation();
    }

    // Transfiere el contenido del editor de pista al canvas de simulación
    transferToSimulation() {
        const simCtx = this.simulationCanvas.getContext('2d');
        // Primero limpiar el canvas de simulación (solo la parte de la pista)
        simCtx.fillStyle = this.bgColor; // Usa el color de fondo actual de la pista
        simCtx.fillRect(0, 0, this.simulationCanvas.width, this.simulationCanvas.height);
        // Luego dibuja la imagen del editor de pista
        // Escala si los canvas son de diferente tamaño
        simCtx.drawImage(this.canvas, 0, 0, this.simulationCanvas.width, this.simulationCanvas.height);
    }

    getTrackContext() {
        // Devuelve el contexto del canvas de simulación para la lectura de sensores
        return this.simulationCanvas.getContext('2d');
    }
}
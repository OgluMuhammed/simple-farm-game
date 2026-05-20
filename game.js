const socket = io();
let myUsername = "";
let localGridState = [];

// DOM References
const authScreen = document.getElementById('authScreen');
const gameScreen = document.getElementById('gameScreen');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const errorMessage = document.getElementById('errorMessage');
const farmerName = document.getElementById('farmerName');
const playerListContainer = document.getElementById('playerListContainer');

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Base Grid Configuration Settings
const BASE_TILE_WIDTH = 100;
const BASE_TILE_HEIGHT = 50;
const GRID_SIZE = 50; 

// Camera Position System
let camX = canvas.width / 2;
let camY = 50;

// Dynamic Zoom Constraints
let zoom = 1.0;
const MIN_ZOOM = 0.15; // Zoomed far out (bird's-eye view)
const MAX_ZOOM = 2.5;  // Zoomed close in

// Dragging Input Track states
let isDragging = false;
let startMouseX = 0;
let startMouseY = 0;
let totalDraggedDistance = 0;

// Core Interface UI Actions
document.getElementById('loginBtn').addEventListener('click', () => {
    socket.emit('login', { username: usernameInput.value, password: passwordInput.value });
});

document.getElementById('registerBtn').addEventListener('click', () => {
    socket.emit('register', { username: usernameInput.value, password: passwordInput.value });
});

// Authentication Signals
socket.on('authSuccess', (userData) => {
    myUsername = userData.username;
    authScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    farmerName.innerText = myUsername;
    resizeCanvas();
});

socket.on('authError', (message) => { errorMessage.innerText = message; });

socket.on('updateLeaderboard', (playerArray) => {
    playerListContainer.innerHTML = "";
    playerArray.forEach(player => {
        const li = document.createElement('li');
        li.classList.add('player-item');
        if (player.username === myUsername) li.classList.add('self');
        li.innerHTML = `<span>🧑‍🌾 ${player.username}</span> <span>💰 ${player.coins}</span>`;
        playerListContainer.appendChild(li);
    });
});

socket.on('updateMyGrid', (myGridState) => {
    localGridState = myGridState;
    drawIsometricMap();
});

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth - 40;
    canvas.height = window.innerHeight - 180;
    camX = canvas.width / 2; 
    drawIsometricMap();
}
window.addEventListener('resize', resizeCanvas);

// RENDERING ENGINE: Draws viewport tiles scaled by zoom factor
function drawIsometricMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!localGridState.length) return;

    // Scale our tiles dynamically based on the current zoom multiplier
    const currentWidth = BASE_TILE_WIDTH * zoom;
    const currentHeight = BASE_TILE_HEIGHT * zoom;

    for (let i = 0; i < localGridState.length; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        // Apply camera vector translations and zoom offsets
        const isoX = camX + (col - row) * (currentWidth / 2);
        const isoY = camY + (col + row) * (currentHeight / 2);

        // Viewport Culling Optimization: Skip drawing off-screen tiles
        if (isoX < -currentWidth || isoX > canvas.width + currentWidth || 
            isoY < -currentHeight || isoY > canvas.height + currentHeight) {
            continue;
        }

        const tileData = localGridState[i];
        let tileColor = "#8b5a2b"; 
        let textLabel = "";

        if (tileData.status === 'growing') {
            tileColor = "#cd853f"; 
            textLabel = "🌱";
        } else if (tileData.status === 'ready') {
            tileColor = "#2e8b57"; 
            textLabel = "🌾";
        }

        drawIsometricDiamond(isoX, isoY, currentWidth, currentHeight, tileColor, textLabel);
    }
}

function drawIsometricDiamond(x, y, width, height, color, label) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width / 2, y + height / 2);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x - width / 2, y + height / 2);
    ctx.closePath();
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#6d421e";
    ctx.lineWidth = 0.5 * zoom; // Scale outline with zoom level
    ctx.stroke();

    // Font scales down smoothly when zooming out
    if (label && zoom > 0.3) { 
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.floor(14 * zoom)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + height / 2 + (5 * zoom));
    }
    ctx.restore();
}

// ZOOM CONTROLLER INPUT: Listens to mouse scrollwheel
canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // Stop entire webpage from scrolling down

    const zoomIntensity = 0.1;
    
    // Get mouse positions relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Math to track where mouse was pointing before zoom so it zooms on target cursor point
    const mouseTimeX = (mouseX - camX) / zoom;
    const mouseTimeY = (mouseY - camY) / zoom;

    // Determine zoom direction
    if (e.deltaY < 0) {
        zoom += zoomIntensity;
    } else {
        zoom -= zoomIntensity;
    }

    // Keep zoom within strict boundaries
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

    // Shift camera positions relative to new focal zoom level point
    camX = mouseX - mouseTimeX * zoom;
    camY = mouseY - mouseTimeY * zoom;

    drawIsometricMap();
}, { passive: false });

// NAVIGATION CONTROLS: Pan / Drag map around
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    totalDraggedDistance = 0;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startMouseX;
    const deltaY = e.clientY - startMouseY;
    
    camX += deltaX;
    camY += deltaY;

    startMouseX = e.clientX;
    startMouseY = e.clientY;
    totalDraggedDistance += Math.abs(deltaX) + Math.abs(deltaY);

    drawIsometricMap(); 
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// Click action checker with accounting for active zooms
canvas.addEventListener('click', (event) => {
    if (totalDraggedDistance > 10) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const currentWidth = BASE_TILE_WIDTH * zoom;
    const currentHeight = BASE_TILE_HEIGHT * zoom;

    for (let i = 0; i < localGridState.length; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        const isoX = camX + (col - row) * (currentWidth / 2);
        const isoY = camY + (col + row) * (currentHeight / 2);

        // Hitbox accounts for scaled configurations
        if (mouseX > isoX - currentWidth/2 && mouseX < isoX + currentWidth/2 &&
            mouseY > isoY && mouseY < isoY + currentHeight) {
            
            socket.emit('tileClick', { tileId: i });
            break;
        }
    }
});
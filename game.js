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
const MIN_ZOOM = 0.15; 
const MAX_ZOOM = 2.5;  

// Dragging Input Track states using modern unified pointer attributes
let isDragging = false;
let startPointerX = 0;
let startPointerY = 0;
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

// RENDERING ENGINE
function drawIsometricMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!localGridState.length) return;

    const currentWidth = BASE_TILE_WIDTH * zoom;
    const currentHeight = BASE_TILE_HEIGHT * zoom;

    for (let i = 0; i < localGridState.length; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        const isoX = camX + (col - row) * (currentWidth / 2);
        const isoY = camY + (col + row) * (currentHeight / 2);

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
    ctx.lineWidth = 0.5 * zoom; 
    ctx.stroke();

    if (label && zoom > 0.3) { 
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.floor(14 * zoom)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + height / 2 + (5 * zoom));
    }
    ctx.restore();
}

// ZOOM CONTROLLER INPUT
canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); 
    const zoomIntensity = 0.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mouseTimeX = (mouseX - camX) / zoom;
    const mouseTimeY = (mouseY - camY) / zoom;

    if (e.deltaY < 0) {
        zoom += zoomIntensity;
    } else {
        zoom -= zoomIntensity;
    }

    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    camX = mouseX - mouseTimeX * zoom;
    camY = mouseY - mouseTimeY * zoom;

    drawIsometricMap();
}, { passive: false });

// INSTANT POINTER CONTROLS (Combines touch screens and mice inputs seamlessly without mobile latency)
canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    totalDraggedDistance = 0;
    canvas.setPointerCapture(e.pointerId); // Keeps dragging tracking stable even if finger wanders off the canvas
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startPointerX;
    const deltaY = e.clientY - startPointerY;
    
    camX += deltaX;
    camY += deltaY;

    startPointerX = e.clientX;
    startPointerY = e.clientY;
    totalDraggedDistance += Math.abs(deltaX) + Math.abs(deltaY);

    drawIsometricMap(); 
});

canvas.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);

    // If the finger tapped statically without sliding around, treat it as an instant click action
    if (totalDraggedDistance < 8) {
        const rect = canvas.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        const currentWidth = BASE_TILE_WIDTH * zoom;
        const currentHeight = BASE_TILE_HEIGHT * zoom;

        const relativeX = pointerX - camX;
        const relativeY = pointerY - camY;

        const col = Math.floor((relativeX / (currentWidth / 2) + relativeY / (currentHeight / 2)) / 2);
        const row = Math.floor((relativeY / (currentHeight / 2) - relativeX / (currentWidth / 2)) / 2);

        if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
            const targetTileId = row * GRID_SIZE + col;
            socket.emit('tileClick', { tileId: targetTileId });
        }
    }
});
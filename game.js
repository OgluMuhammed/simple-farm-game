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

// Grid & Viewport Configuration Settings
const TILE_WIDTH = 100;
const TILE_HEIGHT = 50;
const GRID_SIZE = 50; // 50x50 Field Matrix Dimension

// Camera Position System (Centered initially on the farm map origin)
let camX = canvas.width / 2;
let camY = 50;

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

// Authentication Router Signals
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

// Automatically scales canvas size dynamically to fit right section panel
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth - 40;
    canvas.height = window.innerHeight - 180;
    camX = canvas.width / 2; // Re-center map placement anchor
    drawIsometricMap();
}
window.addEventListener('resize', resizeCanvas);

// RENDERING ENGINE: Draws viewport bounds optimally
function drawIsometricMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!localGridState.length) return;

    for (let i = 0; i < localGridState.length; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        // Apply camera vector translations on top of standard diamond coordinates
        const isoX = camX + (col - row) * (TILE_WIDTH / 2);
        const isoY = camY + (col + row) * (TILE_HEIGHT / 2);

        // Viewport Culling Optimization: Skip drawing tiles hidden off-screen
        if (isoX < -TILE_WIDTH || isoX > canvas.width + TILE_WIDTH || 
            isoY < -TILE_HEIGHT || isoY > canvas.height + TILE_HEIGHT) {
            continue;
        }

        const tileData = localGridState[i];
        let tileColor = "#8b5a2b"; // Empty Dirt
        let textLabel = "";

        if (tileData.status === 'growing') {
            tileColor = "#cd853f"; // Sprouting
            textLabel = "🌱";
        } else if (tileData.status === 'ready') {
            tileColor = "#2e8b57"; // Ready
            textLabel = "🌾";
        }

        drawIsometricDiamond(isoX, isoY, tileColor, textLabel);
    }
}

function drawIsometricDiamond(x, y, color, label) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
    ctx.lineTo(x, y + TILE_HEIGHT);
    ctx.lineTo(x - TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
    ctx.closePath();
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#6d421e";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (label) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + TILE_HEIGHT / 2 + 5);
    }
    ctx.restore();
}

// NAVIGATION INPUT MOUSE CONTROLS: Click-and-Drag / Pan
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
    
    // Slide camera anchors
    camX += deltaX;
    camY += deltaY;

    startMouseX = e.clientX;
    startMouseY = e.clientY;
    totalDraggedDistance += Math.abs(deltaX) + Math.abs(deltaY);

    drawIsometricMap(); // Redraw map at new offset instantly
});

window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
});

// Click action checker
canvas.addEventListener('click', (event) => {
    // If the player was just dragging the map around, do not register a tile placement click
    if (totalDraggedDistance > 10) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Scan bounding points against target view offset vectors
    for (let i = 0; i < localGridState.length; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        const isoX = camX + (col - row) * (TILE_WIDTH / 2);
        const isoY = camY + (col + row) * (TILE_HEIGHT / 2);

        // Approximate diamond tile selection hit box algorithm tracking
        if (mouseX > isoX - TILE_WIDTH/2 && mouseX < isoX + TILE_WIDTH/2 &&
            mouseY > isoY && mouseY < isoY + TILE_HEIGHT) {
            
            socket.emit('tileClick', { tileId: i });
            break;
        }
    }
});
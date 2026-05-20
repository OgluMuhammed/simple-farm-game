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

// Isometric Tile Configuration Constants
const TILE_WIDTH = 100;
const TILE_HEIGHT = 50;
const GRID_SIZE = 3; // 3x3 Grid
const ORIGIN_X = canvas.width / 2; // Center horizontal point
const ORIGIN_Y = 100;              // Initial vertical drop spacing offset

// Core Interface UI Button triggers
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
});

socket.on('authError', (message) => {
    errorMessage.innerText = message;
});

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

// Grid data updates
socket.on('updateMyGrid', (myGridState) => {
    localGridState = myGridState;
    drawIsometricMap();
});

// ENGINE: Render Diamond Plots onto Canvas Area View
function drawIsometricMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear Canvas Frame

    if (!localGridState.length) return;

    for (let i = 0; i < 9; i++) {
        // Calculate standard 2D flat indices matrix rows
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        // Isometric Translation Engine Algorithm Calculations
        const isoX = ORIGIN_X + (col - row) * (TILE_WIDTH / 2);
        const isoY = ORIGIN_Y + (col + row) * (TILE_HEIGHT / 2);

        const tileData = localGridState[i];
        
        // Define colors according to plant status growth loops
        let tileColor = "#8b5a2b"; // Dirt Brown
        let textLabel = "Dirt";
        
        if (tileData.status === 'growing') {
            tileColor = "#cd853f"; // Orange Sprout
            textLabel = "🌱";
        } else if (tileData.status === 'ready') {
            tileColor = "#2e8b57"; // Ready Green
            textLabel = "🌾 Ready";
        }

        drawIsometricDiamond(isoX, isoY, tileColor, textLabel);
    }
}

// Low-Level Vector Drawer mapping diamond nodes
function drawIsometricDiamond(x, y, color, label) {
    ctx.save();
    ctx.beginPath();
    
    // Top Node
    ctx.moveTo(x, y);
    // Right Node
    ctx.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
    // Bottom Node
    ctx.lineTo(x, y + TILE_HEIGHT);
    // Left Node
    ctx.lineTo(x - TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
    
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#6d421e"; // Outline border definitions
    ctx.stroke();

    // Draw UI overlay text labels centered on diamonds
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(label, x, y + TILE_HEIGHT / 2 + 4);
    
    ctx.restore();
}

// Input Listener targeting canvas space conversion 
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Inverse calculations mapping screen vector inputs down to data cells 
    for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;

        const isoX = ORIGIN_X + (col - row) * (TILE_WIDTH / 2);
        const isoY = ORIGIN_Y + (col + row) * (TILE_HEIGHT / 2);

        // Check bounding diamond hitbox points roughly via area estimations
        if (mouseX > isoX - TILE_WIDTH/2 && mouseX < isoX + TILE_WIDTH/2 &&
            mouseY > isoY && mouseY < isoY + TILE_HEIGHT) {
            
            socket.emit('tileClick', { tileId: i });
            break;
        }
    }
});
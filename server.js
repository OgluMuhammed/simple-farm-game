import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);
const io = new Server(server);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Advanced Farm Grid: Holds objects instead of just strings
let farmGrid = Array(9).fill(null).map(() => ({
    status: 'empty', // 'empty', 'growing', or 'ready'
    plantedAt: null
}));

// Simple player money tracker
let playerBalances = {};

// Server loop: Every 1 second, check if any growing crop is done (takes 10 seconds)
setInterval(() => {
    let changed = false;
    const now = Date.now();

    farmGrid.forEach((tile) => {
        if (tile.status === 'growing' && now - tile.plantedAt >= 10000) {
            tile.status = 'ready';
            changed = true;
        }
    });

    // If any crop finished growing, update all players instantly
    if (changed) {
        io.emit('updateGrid', farmGrid);
    }
}, 1000);

io.on('connection', (socket) => {
    // Initialize new player balance with 0 coins
    playerBalances[socket.id] = 0;
    
    // Send initial data
    socket.emit('updateGrid', farmGrid);
    socket.emit('updateBalance', playerBalances[socket.id]);

    socket.on('tileClick', (data) => {
        const { tileId } = data;
        const tile = farmGrid[tileId];

        if (tile.status === 'empty') {
            // Plant seed
            tile.status = 'growing';
            tile.plantedAt = Date.now();
            io.emit('updateGrid', farmGrid);
        } 
        else if (tile.status === 'ready') {
            // Harvest crop and award 10 coins
            tile.status = 'empty';
            tile.plantedAt = null;
            playerBalances[socket.id] += 10;
            
            socket.emit('updateBalance', playerBalances[socket.id]);
            io.emit('updateGrid', farmGrid);
        }
    });

    socket.on('disconnect', () => {
        delete playerBalances[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
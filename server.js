import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve our HTML file to players
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Master farm layout: 9 tiles, all empty initially
let farmGrid = Array(9).fill('empty'); 

io.on('connection', (socket) => {
    console.log('A farmer joined the game!');
    
    // Send the current state of the farm immediately upon connection
    socket.emit('updateGrid', farmGrid);

    // Listen for planting events
    socket.on('plant', (data) => {
        const { tileId } = data;
        
        // Toggle system: plant wheat if empty, harvest if full
        if (farmGrid[tileId] === 'empty') {
            farmGrid[tileId] = 'wheat';
        } else {
            farmGrid[tileId] = 'empty';
        }

        // Broadcast the updated farm grid to EVERYONE online
        io.emit('updateGrid', farmGrid);
    });

    socket.on('disconnect', () => {
        console.log('A farmer disconnected.');
    });
});

// Use the port provided by the cloud service, or default to 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
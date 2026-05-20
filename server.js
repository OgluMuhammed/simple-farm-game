import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// --- DATABASE CONNECTIONS ---
const SUPABASE_URL = 'https://nlrluyhpyqahiehvwuyu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2lH9GJ74AtuUWaJnbdpY2g_fJd5_uou';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
const server = createServer(app);
const io = new Server(server);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Advanced Farm Grid: Holds state objects
let farmGrid = Array(9).fill(null).map(() => ({ 
    status: 'empty', 
    plantedAt: null 
}));

let activeFarmers = {}; // Tracks logged-in socket connections and their current state

// Game Growth Loop: Checks crops every 1 second
setInterval(() => {
    let changed = false;
    const now = Date.now();
    farmGrid.forEach((tile) => {
        if (tile.status === 'growing' && now - tile.plantedAt >= 10000) {
            tile.status = 'ready';
            changed = true;
        }
    });
    if (changed) io.emit('updateGrid', farmGrid);
}, 1000);

io.on('connection', (socket) => {
    // Send current map layout immediately to the connecting client
    socket.emit('updateGrid', farmGrid);

    // SIGN UP LOGIC
    socket.on('register', async (data) => {
        const { username, password } = data;
        
        // Save the new user data directly into your Supabase table
        const { data: user, error } = await supabase
            .from('users')
            .insert([{ username, password }])
            .select();

        if (error) {
            socket.emit('authError', 'Username already taken or invalid.');
        } else {
            socket.emit('authSuccess', { username, coins: 0 });
            activeFarmers[socket.id] = { username, coins: 0 };
        }
    });

    // LOGIN LOGIC
    socket.on('login', async (data) => {
        const { username, password } = data;
        
        // Look up the credentials inside the database
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password);

        if (error || !users || users.length === 0) {
            socket.emit('authError', 'Invalid username or password.');
        } else {
            const loggedInUser = users[0];
            socket.emit('authSuccess', { username: loggedInUser.username, coins: loggedInUser.coins });
            activeFarmers[socket.id] = { username: loggedInUser.username, coins: loggedInUser.coins };
        }
    });

    // FARMING ACTIONS
    socket.on('tileClick', async (data) => {
        const farmer = activeFarmers[socket.id];
        if (!farmer) return; // Ignore input if the user has not authenticated yet

        const { tileId } = data;
        const tile = farmGrid[tileId];

        if (tile.status === 'empty') {
            tile.status = 'growing';
            tile.plantedAt = Date.now();
            io.emit('updateGrid', farmGrid);
        } 
        else if (tile.status === 'ready') {
            tile.status = 'empty';
            tile.plantedAt = null;
            
            // Modify balance state locally
            farmer.coins += 10;
            
            // Sync updated coin balance permanently to Supabase
            await supabase
                .from('users')
                .update({ coins: farmer.coins })
                .eq('username', farmer.username);

            socket.emit('updateBalance', farmer.coins);
            io.emit('updateGrid', farmGrid);
        }
    });

    socket.on('disconnect', () => {
        delete activeFarmers[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
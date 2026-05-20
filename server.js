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

let activeFarmers = {}; // Holds connected users, private grids, and balances

// Helper function to bundle leaderboard array data for transmission
function broadcastLeaderboard() {
    const list = Object.values(activeFarmers).map(farmer => ({
        username: farmer.username,
        coins: farmer.coins
    }));
    io.emit('updateLeaderboard', list);
}

// Game Growth Loop running globally every 1 second
setInterval(() => {
    Object.keys(activeFarmers).forEach(socketId => {
        let changed = false;
        const now = Date.now();
        const farmer = activeFarmers[socketId];

        farmer.grid.forEach((tile) => {
            if (tile.status === 'growing' && now - tile.plantedAt >= 10000) {
                tile.status = 'ready';
                changed = true;
            }
        });

        // Send updates privately to that specific player only
        if (changed) {
            io.to(socketId).emit('updateMyGrid', farmer.grid);
        }
    });
}, 1000);

io.on('connection', (socket) => {

    // SIGN UP LOGIC
    socket.on('register', async (data) => {
        const { username, password } = data;
        const { data: user, error } = await supabase
            .from('users')
            .insert([{ username, password }])
            .select();

        if (error) {
            socket.emit('authError', 'Username already taken or invalid.');
        } else {
            socket.emit('authSuccess', { username, coins: 0 });
            
            activeFarmers[socket.id] = {
                username: username,
                coins: 0,
                grid: Array(2500).fill(null).map(() => ({ status: 'empty', plantedAt: null })) // 50x50 Allocation
            };
            
            socket.emit('updateMyGrid', activeFarmers[socket.id].grid);
            broadcastLeaderboard();
        }
    });

    // LOGIN LOGIC
    socket.on('login', async (data) => {
        const { username, password } = data;
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
            
            activeFarmers[socket.id] = {
                username: loggedInUser.username,
                coins: loggedInUser.coins,
                grid: Array(2500).fill(null).map(() => ({ status: 'empty', plantedAt: null })) // 50x50 Allocation
            };

            socket.emit('updateMyGrid', activeFarmers[socket.id].grid);
            broadcastLeaderboard();
        }
    });

    // ISOLATED HOOK INTERACTIONS
    socket.on('tileClick', async (data) => {
        const farmer = activeFarmers[socket.id];
        if (!farmer) return;

        const { tileId } = data;
        const tile = farmer.grid[tileId];

        if (!tile) return; // Guard clause against broken coordinate indices

        if (tile.status === 'empty') {
            tile.status = 'growing';
            tile.plantedAt = Date.now();
            socket.emit('updateMyGrid', farmer.grid);
        } 
        else if (tile.status === 'ready') {
            tile.status = 'empty';
            tile.plantedAt = null;
            farmer.coins += 10;
            
            // Commit to database
            await supabase
                .from('users')
                .update({ coins: farmer.coins })
                .eq('username', farmer.username);

            socket.emit('updateMyGrid', farmer.grid);
            broadcastLeaderboard();
        }
    });

    socket.on('disconnect', () => {
        delete activeFarmers[socket.id];
        broadcastLeaderboard();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
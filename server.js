const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const WORDS = {
    easy: [
        "attack", "defend", "strike", "dodge", "combo", 
        "block", "jump", "dash", "punch", "kick",
        "counter", "parry", "smash", "slash", "thrust"
    ],
    hard: [
        "CounterAttack", "ParryStrike", "SmashDown", "SlashThrough", "ThrustForward",
        "DevastatingBlow", "PerfectGuard", "ShadowStep", "LightningKick", "Uppercut"
    ],
    impossible: [
        "Combo_Breaker_100x!!!",
        "D0dg3_Th1s_4tt4ck_N0W~",
        "P3rf3ct_P4rry_-->_F4t4lity",
        "A true warrior fights not because he hates!",
        "The keyboard is mightier than the sword."
    ]
};

let lastWord = "";

function getRandomWord(difficulty = 'easy') {
    const list = WORDS[difficulty] || WORDS.easy;
    let newWord = list[Math.floor(Math.random() * list.length)];
    // Prevent immediate repetition
    while (newWord === lastWord && list.length > 1) {
        newWord = list[Math.floor(Math.random() * list.length)];
    }
    lastWord = newWord;
    return newWord;
}
// In-memory state for rooms
const rooms = {};

// Helper to generate a random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}



io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create Room
    socket.on('createRoom', (data) => {
        let playerName = 'Player 1';
        let difficulty = 'easy';
        
        if (typeof data === 'string') {
            playerName = data;
        } else if (data) {
            playerName = data.playerName || 'Player 1';
            difficulty = data.difficulty || 'easy';
        }

        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, health: 100, name: playerName }],
            status: 'waiting', // waiting, playing, gameover
            currentWord: [],
            difficulty: difficulty
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        socket.emit('playerAssigned', 1); // P1
    });

    // Join Room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];
        if (room) {
            if (room.players.length < 2) {
                room.players.push({ id: socket.id, health: 100, name: playerName || 'Player 2' });
                socket.join(roomCode);
                socket.emit('roomJoined', roomCode);
                socket.emit('playerAssigned', 2); // P2
                io.to(roomCode).emit('playerJoined', room.players.length);
                
                // If 2 players, start game after a short delay
                if (room.players.length === 2) {
                    room.status = 'playing';
                    room.currentWord = [getRandomWord(room.difficulty), getRandomWord(room.difficulty)];
                    setTimeout(() => {
                        io.to(roomCode).emit('gameStart', {
                            word: room.currentWord,
                            players: room.players
                        });
                    }, 1000);
                }
            } else {
                socket.emit('errorMsg', 'Room is full');
            }
        } else {
            socket.emit('errorMsg', 'Room not found');
        }
    });

    // Handle typing progress
    socket.on('typeProgress', ({ roomCode, typedText }) => {
        const room = rooms[roomCode];
        if (!room || room.status !== 'playing') return;

        // Check if word is completed correctly
        if (typedText === room.currentWord[0]) {
            // Find opponent and deal damage
            const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
            const attackerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (opponentIndex !== -1) {
                room.players[opponentIndex].health -= 10; // 10 damage per word
                
                if (room.players[opponentIndex].health <= 0) {
                    room.players[opponentIndex].health = 0;
                    room.status = 'gameover';
                    io.to(roomCode).emit('gameOver', {
                        winner: room.players[attackerIndex].id,
                        players: room.players
                    });
                } else {
                    // Next round
                    room.currentWord.shift();
                    room.currentWord.push(getRandomWord(room.difficulty));
                    io.to(roomCode).emit('roundWon', {
                        winnerId: room.players[attackerIndex].id,
                        newWord: room.currentWord,
                        players: room.players
                    });
                }
            }
        }
    });

    // Relay individual keystrokes for animation
    socket.on('keystroke', (roomCode) => {
        socket.to(roomCode).emit('opponentKeystroke');
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [code, room] of Object.entries(rooms)) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                io.to(code).emit('playerLeft');
                delete rooms[code];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on IP: http://0.0.0.0:${PORT}`);
    console.log(`Access this locally via localhost or your computer's local IP.`);
});

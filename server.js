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
    medium: [
        "Warrior", "Fighter", "Samurai", "Ninja", "Assassin",
        "Weapon", "Shield", "Armor", "Helmet", "Gauntlet",
        "Victory", "Defeat", "Battle", "Combat", "Revenge"
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

function getRandomWord(difficulty, usedWords) {
    const list = WORDS[difficulty] || WORDS.easy;
    
    if (usedWords && usedWords.size >= list.length) {
        usedWords.clear();
    }
    
    let availableWords = usedWords ? list.filter(w => !usedWords.has(w)) : list;
    if (availableWords.length === 0) availableWords = list; // Fallback
    
    let newWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    
    if (usedWords) {
        usedWords.add(newWord);
    }
    
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
            usedWords: new Set(),
            difficulty: difficulty,
            lastWordTime: Date.now()
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
                    room.currentWord = [getRandomWord(room.difficulty, room.usedWords), getRandomWord(room.difficulty, room.usedWords)];
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
    socket.on('typeProgress', ({ roomCode, typedText, combo }) => {
        const room = rooms[roomCode];
        if (!room || room.status !== 'playing') return;

        // Anti-cheat check: Can't type a word in less than 50ms per character
        const now = Date.now();
        const timeTaken = now - room.lastWordTime;
        const minTimeRequired = room.currentWord[0].length * 50; 
        
        if (timeTaken < minTimeRequired) {
            // Typing too fast, ignore
            return;
        }

        // Check if word is completed correctly
        if (typedText === room.currentWord[0]) {
            room.lastWordTime = now;
            
            // Find opponent and deal damage
            const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
            const attackerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (opponentIndex !== -1) {
                // Apply combo damage
                let damage = 10;
                if (combo >= 10) damage = 25;
                else if (combo >= 3) damage = 15;

                room.players[opponentIndex].health -= damage;
                
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
                    room.currentWord.push(getRandomWord(room.difficulty, room.usedWords));
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
                if (room.status === 'playing' && room.players.length === 2) {
                    // The other player wins!
                    const opponentIndex = playerIndex === 0 ? 1 : 0;
                    room.players[playerIndex].health = 0;
                    room.status = 'gameover';
                    io.to(code).emit('gameOver', {
                        winner: room.players[opponentIndex].id,
                        players: room.players,
                        reason: 'disconnect'
                    });
                } else {
                    io.to(code).emit('playerLeft');
                }
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

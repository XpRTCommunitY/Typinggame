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

// Fetch external words for multiplayer games to ensure huge variety
async function fetchExternalWords() {
    try {
        const response = await fetch('https://random-word-api.herokuapp.com/word?number=3000');
        const words = await response.json();
        if (words && words.length > 0) {
            const easy = words.filter(w => w.length >= 3 && w.length <= 5);
            const medium = words.filter(w => w.length >= 6 && w.length <= 8).map(w => w.charAt(0).toUpperCase() + w.slice(1));
            const hard = words.filter(w => w.length >= 9).map(w => {
                return w.split('').map((char, i) => i % 2 === 0 ? char.toUpperCase() : char).join('');
            });
            
            if (easy.length > 0) WORDS.easy = easy;
            if (medium.length > 0) WORDS.medium = medium;
            if (hard.length > 0) WORDS.hard = hard;
            console.log("Server successfully loaded external words!");
        }
    } catch(e) {
        console.log("Server using fallback dictionary, fetch failed:", e.message);
    }
}
fetchExternalWords();

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
        let timeLimit = 60;
        
        if (typeof data === 'string') {
            playerName = data;
        } else if (data) {
            playerName = data.playerName || 'Player 1';
            difficulty = data.difficulty || 'easy';
            timeLimit = data.timeLimit || 60;
        }

        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, health: 100, name: playerName }],
            status: 'waiting', // waiting, playing, gameover
            currentWord: [],
            previousWord: null,
            usedWords: new Set(),
            difficulty: difficulty,
            timeLimit: timeLimit,
            timerInterval: null,
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
                // Both players joined, start game!
                room.status = 'playing';
                room.currentWord = [getRandomWord(room.difficulty, room.usedWords), getRandomWord(room.difficulty, room.usedWords)];
                room.previousWord = null;
                room.lastWordTime = Date.now();
                io.to(roomCode).emit('gameStart', {
                    word: room.currentWord,
                    players: room.players,
                    timeLimit: room.timeLimit
                });
                
                // Start Server Timer
                let timeLeft = room.timeLimit;
                room.timerInterval = setInterval(() => {
                    timeLeft--;
                    if (timeLeft <= 0) {
                        clearInterval(room.timerInterval);
                        if (room.status === 'playing') {
                            room.status = 'gameover';
                            const p1 = room.players[0];
                            const p2 = room.players[1];
                            let winner = p1.id;
                            if (p2.health > p1.health) winner = p2.id;
                            else if (p1.health === p2.health) winner = null; // Draw
                            
                            io.to(roomCode).emit('gameOver', {
                                winner: winner,
                                players: room.players,
                                reason: 'timeout'
                            });
                        }
                    }
                }, 1000);
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

        const now = Date.now();
        let isValidHit = false;
        let isLateHit = false;

        // Check if word is completed correctly
        if (typedText === room.currentWord[0]) {
            isValidHit = true;
        } else if (room.previousWord && typedText === room.previousWord && (now - room.lastWordTime < 1500)) {
            // LAG COMPENSATION: Accept if typed the previous word and it changed less than 1.5s ago
            isValidHit = true;
            isLateHit = true;
        }

        if (isValidHit) {
            // Find opponent and deal damage
            const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
            const attackerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (opponentIndex !== -1) {
                // Dynamic Damage based on selected time limit
                let baseDamage = Math.max(0.1, 300 / room.timeLimit);
                let damage = baseDamage;
                if (combo >= 10) damage = baseDamage * 2.5;
                else if (combo >= 3) damage = baseDamage * 1.5;

                room.players[opponentIndex].health -= damage;
                
                if (room.players[opponentIndex].health <= 0) {
                    room.players[opponentIndex].health = 0;
                    room.status = 'gameover';
                    if (room.timerInterval) clearInterval(room.timerInterval);
                    io.to(roomCode).emit('gameOver', {
                        winner: room.players[attackerIndex].id,
                        players: room.players
                    });
                } else {
                    if (!isLateHit) {
                        room.previousWord = room.currentWord[0];
                        room.lastWordTime = now;
                        room.currentWord.shift();
                        room.currentWord.push(getRandomWord(room.difficulty, room.usedWords));
                    }
                    
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

    // Play Again
    socket.on('playAgain', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) player.wantsRematch = true;
            
            // Check if both want rematch
            const bothReady = room.players.length === 2 && room.players.every(p => p.wantsRematch);
            if (bothReady) {
                // Reset game state
                room.players.forEach(p => {
                    p.health = 100;
                    p.wantsRematch = false;
                });
                room.status = 'playing';
                room.currentWord = [getRandomWord(room.difficulty, room.usedWords), getRandomWord(room.difficulty, room.usedWords)];
                room.previousWord = null;
                room.lastWordTime = Date.now();
                
                setTimeout(() => {
                    io.to(roomCode).emit('gameStart', {
                        word: room.currentWord,
                        players: room.players,
                        timeLimit: room.timeLimit
                    });
                    
                    // Restart Server Timer
                    let timeLeft = room.timeLimit;
                    if (room.timerInterval) clearInterval(room.timerInterval);
                    room.timerInterval = setInterval(() => {
                        timeLeft--;
                        if (timeLeft <= 0) {
                            clearInterval(room.timerInterval);
                            if (room.status === 'playing') {
                                room.status = 'gameover';
                                const p1 = room.players[0];
                                const p2 = room.players[1];
                                let winner = p1.id;
                                if (p2.health > p1.health) winner = p2.id;
                                else if (p1.health === p2.health) winner = null; // Draw
                                
                                io.to(roomCode).emit('gameOver', {
                                    winner: winner,
                                    players: room.players,
                                    reason: 'timeout'
                                });
                            }
                        }
                    }, 1000);
                }, 1000);
            }
        }
    });

    // Leave Room explicitly
    socket.on('leaveRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                socket.leave(roomCode);
                
                if (room.status === 'playing' && room.players.length === 2) {
                    const opponentIndex = playerIndex === 0 ? 1 : 0;
                    room.players[playerIndex].health = 0;
                    room.status = 'gameover';
                    if (room.timerInterval) clearInterval(room.timerInterval);
                    io.to(roomCode).emit('gameOver', {
                        winner: room.players[opponentIndex].id,
                        players: room.players,
                        reason: 'disconnect'
                    });
                } else {
                    io.to(roomCode).emit('playerLeft');
                }
                delete rooms[roomCode];
            }
        }
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
                    if (room.timerInterval) clearInterval(room.timerInterval);
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

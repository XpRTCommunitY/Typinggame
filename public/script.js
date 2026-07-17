const socket = io();

// UI Elements
const screens = {
    menu: document.getElementById('menu-screen'),
    difficulty: document.getElementById('difficulty-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen')
};

// Menu Elements
const inputPlayerName = document.getElementById('input-player-name');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const inputRoomCode = document.getElementById('input-room-code');
const menuMessage = document.getElementById('menu-message');
const displayRoomCode = document.getElementById('display-room-code');

// Game Elements
const p1Health = document.getElementById('p1-health');
const p2Health = document.getElementById('p2-health');
const p1Label = document.getElementById('p1-label');
const p2Label = document.getElementById('p2-label');
const stickmanP1 = document.getElementById('stickman-p1');
const stickmanP2 = document.getElementById('stickman-p2');
const combatFeedback = document.getElementById('combat-feedback');
const typedPartEl = document.getElementById('typed-part');
const remainingPartEl = document.getElementById('remaining-part');
const typingInput = document.getElementById('typing-input');
const wordDisplayContainer = document.querySelector('.word-display-container');
const comboCounterEl = document.getElementById('combo-counter');

// Game Over Elements
const gameoverTitle = document.getElementById('gameover-title');
const gameoverMessage = document.getElementById('gameover-message');
const btnMenu = document.getElementById('btn-menu');
const statWpm = document.getElementById('stat-wpm');
const statAccuracy = document.getElementById('stat-accuracy');

// State
let currentRoom = '';
let myPlayerNum = 0;
let currentWord = '';
let currentWordArray = [];

// Stats
let startTime = 0;
let totalKeystrokes = 0;
let totalCorrectCharactersTyped = 0;

// Single Player State
let isSinglePlayer = false;
let botInterval = null;
let botWordProgress = 0;
let spPlayers = [];
let spDifficulty = 'easy';
let currentCombo = 0;

const nextWordEl = document.getElementById('next-word');
const btnComputer = document.getElementById('btn-computer');
const countdownOverlay = document.getElementById('countdown-overlay');

const btnStartGame = document.getElementById('btn-start-game');
const btnBackToMenu = document.getElementById('btn-back-to-menu');
let pendingGameMode = '';

const WORDS = {
    easy: ["attack", "defend", "strike", "dodge", "combo", "block", "jump", "dash", "punch", "kick", "counter", "parry", "smash", "slash", "thrust"],
    medium: ["Warrior", "Fighter", "Samurai", "Ninja", "Assassin", "Weapon", "Shield", "Armor", "Helmet", "Gauntlet", "Victory", "Defeat", "Battle", "Combat", "Revenge"],
    hard: ["CounterAttack", "ParryStrike", "SmashDown", "SlashThrough", "ThrustForward", "DevastatingBlow", "PerfectGuard", "ShadowStep", "LightningKick", "Uppercut"],
    impossible: ["Combo_Breaker_100x!!!", "D0dg3_Th1s_4tt4ck_N0W~", "P3rf3ct_P4rry_-->_F4t4lity", "A true warrior fights not because he hates!", "The keyboard is mightier than the sword."]
};

let usedWords = new Set();

function getRandomWord(difficulty = 'easy') {
    const list = WORDS[difficulty] || WORDS.easy;
    if (usedWords.size >= list.length) {
        usedWords.clear();
    }
    
    let availableWords = list.filter(w => !usedWords.has(w));
    if (availableWords.length === 0) availableWords = list; // Safety fallback
    
    let newWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    usedWords.add(newWord);
    return newWord;
}

// Helper to switch screens
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showFeedback(text, isError = false) {
    combatFeedback.textContent = text;
    
    // Add cool comic book styling for feedback!
    if (text === 'BAM!' || text === 'CRITICAL!') {
        combatFeedback.style.color = '#fbbf24';
        combatFeedback.style.fontSize = '5rem';
        combatFeedback.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 20 - 10}deg)`;
    } else {
        combatFeedback.style.color = isError ? 'var(--secondary)' : 'white';
        combatFeedback.style.fontSize = '3.5rem';
        combatFeedback.style.transform = 'translate(-50%, -50%)';
    }

    combatFeedback.classList.add('show');
    
    // Shake screen on hit
    if (!isError && text !== 'READY...') {
        document.body.classList.add('shake-screen');
        setTimeout(() => document.body.classList.remove('shake-screen'), 300);
    }

    setTimeout(() => combatFeedback.classList.remove('show'), 1000);
}

// Helper to play animations
function playAnimation(playerNum, animType) {
    const stickman = document.getElementById(`stickman-p${playerNum}`);
    if (!stickman) return;

    // Check if we're currently doing a big move that shouldn't be interrupted
    const isCurrentlyDoingBigMove = stickman.classList.contains('head-smash') || stickman.classList.contains('hurt') || stickman.classList.contains('knockback');
    const isRequestingBigMove = animType === 'head-smash' || animType === 'hurt' || animType === 'knockback' || animType === 'attack';
    
    // Don't interrupt a big move with a small typing move
    if (isCurrentlyDoingBigMove && !isRequestingBigMove) return;

    // Remove any existing timeout
    if (stickman.dataset.animTimeout) {
        clearTimeout(parseInt(stickman.dataset.animTimeout));
    }

    // All possible animation classes
    const allAnims = ['jab', 'low-kick', 'high-slash', 'attack', 'dash-strike', 'spin-attack', 'hurt', 'knockback', 'head-smash'];
    
    let animClass = animType;
    let duration = 300;

    // Randomize the moves!
    if (animType === 'jab') {
        const jabs = ['jab', 'low-kick', 'high-slash'];
        
        // Pick a different move from the current one to ensure smooth transition
        let currentClass = allAnims.find(c => stickman.classList.contains(c));
        let availableJabs = jabs.filter(j => j !== currentClass);
        if (availableJabs.length === 0) availableJabs = jabs;
        
        animClass = availableJabs[Math.floor(Math.random() * availableJabs.length)];
        duration = 400; // Stay in stance for 400ms after last keypress
    } else if (animType === 'attack') {
        const attacks = ['attack', 'dash-strike', 'spin-attack'];
        animClass = attacks[Math.floor(Math.random() * attacks.length)];
        duration = 600;
    } else if (animType === 'hurt') {
        animClass = Math.random() > 0.5 ? 'hurt' : 'knockback';
        duration = 500;
    } else if (animType === 'head-smash') {
        animClass = 'head-smash';
        duration = 800;
    }

    // Apply the new class smoothly (no forced reflow)
    stickman.classList.remove(...allAnims);
    stickman.classList.add(animClass);

    // Set timeout to return to idle ONLY after duration
    const timeout = setTimeout(() => {
        stickman.classList.remove(...allAnims);
    }, duration);

    stickman.dataset.animTimeout = timeout;
}

function updateHealth(players) {
    if (players.length >= 1) {
        p1Health.style.width = `${players[0].health}%`;
        if (myPlayerNum === 1) {
            p1Label.textContent = players[0].name + ' (You)';
        } else {
            p1Label.textContent = players[0].name;
        }
    }
    if (players.length >= 2) {
        p2Health.style.width = `${players[1].health}%`;
        if (myPlayerNum === 2) {
            p2Label.textContent = players[1].name + ' (You)';
        } else {
            p2Label.textContent = players[1].name;
        }
    }
}

function setWord(wordArray) {
    currentWordArray = wordArray;
    currentWord = wordArray[0];
    typedPartEl.textContent = '';
    remainingPartEl.textContent = currentWord;
    if (wordArray.length > 1) {
        nextWordEl.textContent = wordArray[1];
    } else {
        nextWordEl.textContent = '';
    }
    typingInput.value = '';
    typingInput.disabled = false;
    typingInput.focus();
}

// Single Player Bot Logic
let botTimeout = null;

function startBotLoop() {
    clearTimeout(botTimeout);
    
    function botType() {
        if (!screens.game.classList.contains('active')) return;
        
        playAnimation(2, 'jab');
        botWordProgress++;
        
        if (botWordProgress >= currentWordArray[0].length) {
            // Bot finished word!
            botWordProgress = 0;
            playAnimation(2, 'head-smash');
            spPlayers[0].health -= 10;
            updateHealth(spPlayers);
            
            if (spPlayers[0].health <= 0) {
                endSinglePlayerGame(2);
                return; // Stop typing
            } else {
                currentWordArray.shift();
                currentWordArray.push(getRandomWord(spDifficulty));
                setWord(currentWordArray);
            }
        }
        
        let baseSpeed = 500; // Easy
        if (spDifficulty === 'medium') baseSpeed = 300;
        if (spDifficulty === 'hard') baseSpeed = 150;
        if (spDifficulty === 'impossible') baseSpeed = 50;
        
        // Randomize speed slightly (+/- 20%) to feel like human typing
        let delay = baseSpeed + (Math.random() * baseSpeed * 0.4 - baseSpeed * 0.2);
        
        // Add extra delay between words
        if (botWordProgress === 0) delay += 500; 
        
        botTimeout = setTimeout(botType, delay);
    }
    
    // Start bot typing after 1 second
    botTimeout = setTimeout(botType, 1000);
}

function handleSinglePlayerTypeProgress() {
    botWordProgress = 0; // Reset bot progress on player success
    
    // Bonus damage for high combos!
    let damage = 10;
    if (currentCombo >= 3) damage = 15;
    if (currentCombo >= 10) damage = 25;
    
    spPlayers[1].health -= damage;
    updateHealth(spPlayers);
    
    if (currentCombo >= 3) {
        showFeedback('CRITICAL!');
    } else {
        showFeedback('BAM!');
    }
    
    if (spPlayers[1].health <= 0) {
        endSinglePlayerGame(1);
    } else {
        currentWordArray.shift();
        currentWordArray.push(getRandomWord(spDifficulty));
        setWord(currentWordArray);
    }
}

function endSinglePlayerGame(winnerNum) {
    clearTimeout(botTimeout);
    showScreen('gameover');
    const amIWinner = winnerNum === 1;
    gameoverTitle.textContent = amIWinner ? 'VICTORY!' : 'DEFEAT!';
    gameoverTitle.style.color = amIWinner ? 'var(--primary)' : 'var(--secondary)';
    gameoverMessage.textContent = amIWinner ? 'You proved your typing skills against the bot.' : 'The bot was too fast!';
    
    const timeElapsedInMinutes = (Date.now() - startTime) / 60000;
    let wpm = 0;
    let accuracy = 0;
    if (timeElapsedInMinutes > 0) {
        wpm = Math.round((totalCorrectCharactersTyped / 5) / timeElapsedInMinutes);
    }
    if (totalKeystrokes > 0) {
        accuracy = Math.round((totalCorrectCharactersTyped / totalKeystrokes) * 100);
        if (accuracy > 100) accuracy = 100;
    }
    
    statWpm.textContent = `Speed: ${wpm} WPM`;
    statAccuracy.textContent = `Accuracy: ${accuracy}%`;
}

function startCountdown(callback) {
    typingInput.disabled = true;
    countdownOverlay.style.opacity = 1;
    let count = 3;
    countdownOverlay.textContent = count;
    
    const countInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownOverlay.textContent = count;
        } else if (count === 0) {
            countdownOverlay.textContent = 'START!';
        } else {
            clearInterval(countInterval);
            countdownOverlay.style.opacity = 0;
            callback();
        }
    }, 1000);
}

// Event Listeners - Menu
btnComputer.addEventListener('click', () => {
    pendingGameMode = 'single';
    showScreen('difficulty');
});

btnCreate.addEventListener('click', () => {
    pendingGameMode = 'multi';
    showScreen('difficulty');
});

btnBackToMenu.addEventListener('click', () => {
    showScreen('menu');
});

btnStartGame.addEventListener('click', () => {
    const difficulty = document.getElementById('difficulty-select').value;
    const name = inputPlayerName.value.trim() || 'Player 1';
    
    if (pendingGameMode === 'single') {
        isSinglePlayer = true;
        myPlayerNum = 1;
        spDifficulty = difficulty;
        
        spPlayers = [
            { id: 'p1', name: name, health: 100 },
            { id: 'bot', name: `Bot (${spDifficulty})`, health: 100 }
        ];
        
        showScreen('game');
        updateHealth(spPlayers);
        
        startTime = Date.now();
        totalKeystrokes = 0;
        totalCorrectCharactersTyped = 0;
        botWordProgress = 0;
        currentCombo = 0;
        
        showFeedback('READY...');
        startCountdown(() => {
            setWord([getRandomWord(spDifficulty), getRandomWord(spDifficulty)]);
            startBotLoop();
        });
    } else if (pendingGameMode === 'multi') {
        isSinglePlayer = false;
        socket.emit('createRoom', { playerName: name, difficulty });
    }
});

btnJoin.addEventListener('click', () => {
    isSinglePlayer = false;
    const code = inputRoomCode.value.trim().toUpperCase();
    const name = inputPlayerName.value.trim() || 'Player 2';
    if (code.length > 0) {
        socket.emit('joinRoom', { roomCode: code, playerName: name });
    } else {
        menuMessage.textContent = 'Please enter a code';
        setTimeout(() => menuMessage.textContent = '', 2000);
    }
});

btnMenu.addEventListener('click', () => {
    showScreen('menu');
});

// Click anywhere to focus typing input in game
document.addEventListener('click', () => {
    if (currentWord && screens.game.classList.contains('active')) typingInput.focus();
});

// Event Listeners - Game
typingInput.addEventListener('keydown', (e) => {
    // If input is currently empty and user types space, ignore it
    if (e.key === ' ' && typingInput.value.trim() === '') {
        e.preventDefault();
        return;
    }

    // Count only character keys as keystrokes
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        totalKeystrokes++;
        
        // Strict typing check: Is this the correct next character?
        const expectedNextChar = currentWord[typingInput.value.length];
        
        // Allow if it's the right char, or allow space/enter to fall through to input event if word complete
        if (e.key !== expectedNextChar && e.key !== 'Enter' && !(e.key === ' ' && typingInput.value.trim() === currentWord)) {
            e.preventDefault(); // Stop the character from typing!
            
            // Mistake! Reset combo and flash red.
            currentCombo = 0;
            if (comboCounterEl) {
                comboCounterEl.style.opacity = 0;
                comboCounterEl.style.transform = 'translateX(-50%) scale(0)';
            }
            
            wordDisplayContainer.classList.add('error-bg');
            setTimeout(() => wordDisplayContainer.classList.remove('error-bg'), 300);
            return;
        }
    }
});

typingInput.addEventListener('input', (e) => {
    // Animate and send keystroke on EVERY key press (correct or wrong)
    if (!isSinglePlayer) socket.emit('keystroke', currentRoom);
    playAnimation(myPlayerNum, 'jab');

    const typedText = e.target.value.trim(); // Handle space completion
    const targetWord = currentWord;
    
    if (typedText === targetWord) {
        // Word is correctly completed!
        totalCorrectCharactersTyped += targetWord.length;
        playAnimation(myPlayerNum, 'head-smash');
        
        // Increment Combo
        currentCombo++;
        if (comboCounterEl && currentCombo > 1) {
            comboCounterEl.textContent = `${currentCombo}x COMBO!`;
            comboCounterEl.style.opacity = 1;
            comboCounterEl.style.transform = 'translateX(-50%) scale(1.2)';
            setTimeout(() => comboCounterEl.style.transform = 'translateX(-50%) scale(1)', 150);
        }

        if (isSinglePlayer) {
            handleSinglePlayerTypeProgress();
        } else {
            socket.emit('typeProgress', { roomCode: currentRoom, typedText: targetWord, combo: currentCombo });
        }
        
        e.target.value = '';
        typedPartEl.textContent = '';
        remainingPartEl.textContent = currentWord;
        return;
    }

    // Validate prefix
    if (targetWord.startsWith(typedText)) {
        typedPartEl.textContent = typedText;
        remainingPartEl.textContent = targetWord.substring(typedText.length);
        wordDisplayContainer.classList.remove('error-bg');
    } else {
        // Typing mistake! Reset combo.
        currentCombo = 0;
        if (comboCounterEl) {
            comboCounterEl.style.opacity = 0;
            comboCounterEl.style.transform = 'translateX(-50%) scale(0)';
        }
        
        wordDisplayContainer.classList.add('error-bg');
        setTimeout(() => wordDisplayContainer.classList.remove('error-bg'), 300);
        e.target.value = e.target.value.slice(0, -1);
    }
});

// Socket Events
socket.on('roomCreated', (code) => {
    currentRoom = code;
    displayRoomCode.textContent = code;
    showScreen('waiting');
});

socket.on('roomJoined', (code) => {
    currentRoom = code;
    showScreen('waiting');
});

socket.on('playerAssigned', (num) => {
    myPlayerNum = num;
});

socket.on('gameStart', (data) => {
    showScreen('game');
    updateHealth(data.players);

    // Reset stats
    startTime = Date.now();
    totalKeystrokes = 0;
    totalCorrectCharactersTyped = 0;

    showFeedback('READY...');
    startCountdown(() => {
        setWord(data.word);
    });
});

socket.on('opponentKeystroke', () => {
    const opponentNum = myPlayerNum === 1 ? 2 : 1;
    playAnimation(opponentNum, 'jab');
});

socket.on('roundWon', (data) => {
    updateHealth(data.players);
    const winnerNum = data.players.findIndex(p => p.id === data.winnerId) + 1;
    
    // Animate attack
    playAnimation(winnerNum, 'head-smash');
    
    // Animate hurt on loser
    const loserNum = winnerNum === 1 ? 2 : 1;
    playAnimation(loserNum, 'hurt');
    
    // Show feedback
    if (winnerNum === myPlayerNum) {
        showFeedback('BAM!');
    } else {
        showFeedback('OUCH!', true);
    }

    setWord(data.newWord);
});

socket.on('gameOver', (data) => {
    updateHealth(data.players);
    const amIWinner = socket.id === data.winner;
    
    // Play final animation
    const attackerNum = data.players[0].id === data.winner ? 1 : 2;
    const defenderNum = attackerNum === 1 ? 2 : 1;
    playAnimation(attackerNum, 'attack');
    setTimeout(() => playAnimation(defenderNum, 'hurt'), 100);

    // Calculate Stats
    const timeElapsedMinutes = (Date.now() - startTime) / 60000;
    // Standard WPM: total correct characters / 5 / minutes
    let wpm = Math.round((totalCorrectCharactersTyped / 5) / timeElapsedMinutes);
    if (isNaN(wpm) || !isFinite(wpm)) wpm = 0;

    let accuracy = 0;
    if (totalKeystrokes > 0) {
        // Estimate accuracy by ratio of correct chars to total strokes
        accuracy = Math.round((totalCorrectCharactersTyped / totalKeystrokes) * 100);
        if (accuracy > 100) accuracy = 100;
    }

    setTimeout(() => {
        showScreen('gameover');
        gameoverTitle.textContent = amIWinner ? 'VICTORY!' : 'DEFEAT!';
        gameoverTitle.style.color = amIWinner ? 'var(--primary)' : 'var(--secondary)';
        gameoverMessage.textContent = amIWinner ? 'You proved your typing skills.' : 'Better luck next time.';
        
        // Show Stats
        statWpm.textContent = `Speed: ${wpm} WPM`;
        statAccuracy.textContent = `Accuracy: ${accuracy}%`;

        currentRoom = '';
    }, 1500);
});

socket.on('playerLeft', () => {
    if (currentRoom) {
        showScreen('menu');
        menuMessage.textContent = 'Opponent left the game.';
        setTimeout(() => menuMessage.textContent = '', 3000);
        currentRoom = '';
    }
});

socket.on('errorMsg', (msg) => {
    menuMessage.textContent = msg;
    setTimeout(() => menuMessage.textContent = '', 3000);
});

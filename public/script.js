const socket = io();

// UI Elements
const screens = {
    menu: document.getElementById('menu-screen'),
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

// Stats
let startTime = 0;
let totalKeystrokes = 0;
let totalCorrectCharactersTyped = 0;

// Helper to switch screens
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showFeedback(text, isError = false) {
    combatFeedback.textContent = text;
    combatFeedback.style.color = isError ? 'var(--secondary)' : 'white';
    combatFeedback.classList.add('show');
    setTimeout(() => combatFeedback.classList.remove('show'), 1000);
}

// Helper to play animations
function playAnimation(playerNum, animClass) {
    const stickman = document.getElementById(`stickman-p${playerNum}`);
    
    // Remove class to reset
    stickman.classList.remove(animClass);
    
    // Force DOM reflow to restart transition
    void stickman.offsetWidth;
    
    // Add class back
    stickman.classList.add(animClass);
    
    if (stickman.dataset.animTimeout) {
        clearTimeout(parseInt(stickman.dataset.animTimeout));
    }
    
    const timeout = setTimeout(() => {
        stickman.classList.remove(animClass);
    }, 150);
    
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

function setWord(word) {
    currentWord = word;
    typedPartEl.textContent = '';
    remainingPartEl.textContent = word;
    typingInput.value = '';
    typingInput.disabled = false;
    typingInput.focus();
}

// Event Listeners - Menu
btnCreate.addEventListener('click', () => {
    const name = inputPlayerName.value.trim() || 'Player 1';
    socket.emit('createRoom', name);
});

btnJoin.addEventListener('click', () => {
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
    // Count only character keys as keystrokes
    if (e.key.length === 1) {
        totalKeystrokes++;
    }
});

typingInput.addEventListener('input', (e) => {
    // Animate and send keystroke on EVERY key press (correct or wrong)
    socket.emit('keystroke', currentRoom);
    playAnimation(myPlayerNum, 'jab');

    const typedText = e.target.value.toLowerCase();
    const targetWord = currentWord.toLowerCase();
    
    // Validate prefix
    if (targetWord.startsWith(typedText)) {
        // Correct typing
        typedPartEl.textContent = currentWord.slice(0, typedText.length);
        remainingPartEl.textContent = currentWord.slice(typedText.length);
        wordDisplayContainer.classList.remove('error-bg');

        // Emit progress if we completed the word
        if (typedText === targetWord) {
            totalCorrectCharactersTyped += targetWord.length;
            socket.emit('typeProgress', { roomCode: currentRoom, typedText: currentWord }); // Send original case
            typingInput.value = '';
        }
    } else {
        // Wrong typing
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
    setTimeout(() => {
        showFeedback('FIGHT!');
        setWord(data.word);
    }, 1500);
});

socket.on('opponentKeystroke', () => {
    const opponentNum = myPlayerNum === 1 ? 2 : 1;
    playAnimation(opponentNum, 'jab');
});

socket.on('roundWon', (data) => {
    updateHealth(data.players);
    
    const amIAttacker = socket.id === data.winnerId;
    const attackerNum = data.players[0].id === data.winnerId ? 1 : 2;
    const defenderNum = attackerNum === 1 ? 2 : 1;

    // Fighting animations
    playAnimation(attackerNum, 'attack');
    setTimeout(() => playAnimation(defenderNum, 'hurt'), 100);

    if (amIAttacker) {
        showFeedback('COMBO!', false);
    } else {
        showFeedback('OUCH!', true);
    }

    typingInput.disabled = true;

    setTimeout(() => {
        setWord(data.newWord);
    }, 1000);
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

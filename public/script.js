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

const topTypedPartEl = document.getElementById('top-typed-part');
const topRemainingPartEl = document.getElementById('top-remaining-part');

// Game Over Elements
const gameoverTitle = document.getElementById('gameover-title');
const gameoverMessage = document.getElementById('gameover-message');
const btnMenu = document.getElementById('btn-menu');
const statWpm = document.getElementById('stat-wpm');
const statAccuracy = document.getElementById('stat-accuracy');

// State
let currentRoom = '';
let myPlayerNum = 0;
let gameTimerInterval = null;
let gameSeconds = 0;
let currentWord = '';
let currentWordArray = [];

// Effects & Sound
const effectsToggle = document.getElementById('effects-toggle');
let effectsEnabled = false;
if (effectsToggle) {
    effectsEnabled = effectsToggle.checked;
    effectsToggle.addEventListener('change', (e) => {
        effectsEnabled = e.target.checked;
    });
}

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let noiseBuffer;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function playSwishSound() {
    if (!effectsEnabled) return;
    if (navigator.vibrate) navigator.vibrate(50);
    initAudio();
    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.value = 1;
    noiseFilter.frequency.setValueAtTime(2000, audioCtx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start();
    noise.stop(audioCtx.currentTime + 0.1);
}

function playHitSound() {
    if (!effectsEnabled) return;
    if (navigator.vibrate) navigator.vibrate(100);
    initAudio();
    
    // Low punch
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.2);
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(1, audioCtx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
    
    // Impact Noise
    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start();
    noise.stop(audioCtx.currentTime + 0.2);
}

function playErrorSound() {
    if (!effectsEnabled) return;
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    initAudio();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc2.frequency.setValueAtTime(156, audioCtx.currentTime);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.25);
    osc2.stop(audioCtx.currentTime + 0.25);
}

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
let spTimeLimit = 60; // default 1 min
let currentCombo = 0;

const nextWordEl = document.getElementById('next-word');
const btnComputer = document.getElementById('btn-computer');
const countdownOverlay = document.getElementById('countdown-overlay');

const btnStartGame = document.getElementById('btn-start-game');
const btnBackToMenu = document.getElementById('btn-back-to-menu');
const btnPauseGame = document.getElementById('btn-pause-game');
let pendingGameMode = '';
let isPaused = false;

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

// --- Sparks / Particles ---
function createBlood(playerNum) {
    const battlefield = document.querySelector('.battlefield');
    if (!battlefield) return;
    
    const numDrops = Math.floor(Math.random() * 6) + 10;
    for (let i = 0; i < numDrops; i++) {
        const drop = document.createElement('div');
        drop.style.position = 'absolute';
        const size = Math.random() * 12 + 4;
        drop.style.width = size + 'px';
        drop.style.height = size + 'px';
        drop.style.backgroundColor = '#ef4444';
        drop.style.boxShadow = '0 0 10px #ef4444, 0 0 20px #991b1b';
        drop.style.borderRadius = '50%';
        drop.style.zIndex = '55';
        
        const baseX = playerNum === 1 ? '40%' : '60%';
        drop.style.left = baseX;
        drop.style.top = '50%'; 
        
        const dir = playerNum === 1 ? -1 : 1;
        const vx = (Math.random() * 400 * dir) + (100 * dir);
        const vy = (Math.random() * -400); // Fly upwards mostly
        
        battlefield.appendChild(drop);
        
        const animation = drop.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
        ], {
            duration: 600 + Math.random() * 300,
            easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)'
        });
        
        animation.onfinish = () => drop.remove();
    }
}

function createSparks(playerNum) {
    const battlefield = document.querySelector('.battlefield');
    if (!battlefield || !effectsEnabled) return;
    
    // Create 4-6 sparks
    const numSparks = Math.floor(Math.random() * 3) + 4;
    for (let i = 0; i < numSparks; i++) {
        const spark = document.createElement('div');
        spark.style.position = 'absolute';
        spark.style.width = '14px'; // Made much bigger
        spark.style.height = '14px';
        spark.style.backgroundColor = playerNum === 1 ? 'var(--primary)' : 'var(--secondary)';
        spark.style.boxShadow = `0 0 25px ${spark.style.backgroundColor}, 0 0 40px ${spark.style.backgroundColor}`; // Stronger glow
        spark.style.borderRadius = '50%';
        spark.style.zIndex = '50';
        
        // Position them between the fighters (clash point)
        const baseX = playerNum === 1 ? '55%' : '45%';
        spark.style.left = baseX;
        spark.style.top = '45%'; // Slightly higher
        
        // Random velocity (mostly upwards and towards opponent)
        const dir = playerNum === 1 ? 1 : -1;
        const vx = (Math.random() * 200 * dir) + (100 * dir); // Fly further
        const vy = (Math.random() * -200) - 100;
        
        battlefield.appendChild(spark);
        
        const animation = spark.animate([
            { transform: 'translate(0, 0) scale(1.5)', opacity: 1 },
            { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
        ], {
            duration: 400 + Math.random() * 300, // Stay visible longer
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
        });
        
        animation.onfinish = () => spark.remove();
    }
}

// Helper to switch screens
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    
    // Toggle in-game class to manage global background and side panels
    if (screenName === 'game') {
        document.body.classList.add('in-game');
    } else {
        document.body.classList.remove('in-game');
    }
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
    
    // Shake screen and play sound on hit
    if (!isError && text !== 'READY...') {
        if (effectsEnabled) {
            document.body.classList.add('shake-screen');
            setTimeout(() => document.body.classList.remove('shake-screen'), 300);
        }
        playHitSound();
    } else if (isError) {
        playErrorSound();
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
    // Prevent resetting typing progress if the word is the same (used for lag compensation updates)
    if (currentWord && currentWord === wordArray[0]) {
        if (wordArray.length > 1) {
            nextWordEl.textContent = wordArray[1];
        }
        return;
    }

    currentWordArray = wordArray;
    currentWord = wordArray[0];
    typedPartEl.textContent = '';
    remainingPartEl.textContent = currentWord;
    if (topTypedPartEl) topTypedPartEl.textContent = '';
    if (topRemainingPartEl) topRemainingPartEl.textContent = currentWord;
    if (wordArray.length > 1) {
        nextWordEl.textContent = wordArray[1];
    } else {
        nextWordEl.textContent = '';
    }
    
    // Trigger word pop animation
    const wordDisplay = document.querySelector('.word-display');
    if (wordDisplay) {
        wordDisplay.classList.remove('word-animate');
        void wordDisplay.offsetWidth; // Force reflow
        wordDisplay.classList.add('word-animate');
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
        
        if (isPaused) {
            botTimeout = setTimeout(botType, 500); // Check again later
            return;
        }
        
        playAnimation(2, 'jab');
        createSparks(2);
        botWordProgress++;
        
        if (botWordProgress >= currentWordArray[0].length) {
            // Bot finished word!
            botWordProgress = 0;
            playAnimation(2, 'head-smash');
            playAnimation(1, 'hurt');
            createBlood(1);
            
            // Dynamic damage calculation for bot based on chosen time
            let botBaseDamage = Math.max(0.1, 300 / spTimeLimit);
            spPlayers[0].health -= botBaseDamage;
            
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
        
        let baseSpeed = 1200; // Extremely slow for 'easy' (1.2s per character)
        if (spDifficulty === 'medium') baseSpeed = 500;
        if (spDifficulty === 'hard') baseSpeed = 200;
        if (spDifficulty === 'impossible') baseSpeed = 70;
        
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
    
    playAnimation(2, 'hurt');
    createBlood(2);
    
    // Dynamic damage based on chosen time limit
    let baseDamage = Math.max(0.1, 300 / spTimeLimit);
    let damage = baseDamage;
    if (currentCombo >= 3) damage = baseDamage * 1.5;
    if (currentCombo >= 10) damage = baseDamage * 2.5;
    
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
    stopGameTimer();
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

function startGameTimer(initialSeconds) {
    clearInterval(gameTimerInterval);
    gameSeconds = initialSeconds;
    const timerEl = document.getElementById('game-timer');
    if (timerEl) {
        const initM = Math.floor(gameSeconds / 60).toString().padStart(2, '0');
        const initS = (gameSeconds % 60).toString().padStart(2, '0');
        timerEl.textContent = `${initM}:${initS}`;
    }
    
    gameTimerInterval = setInterval(() => {
        if (isPaused) return; // Skip decrement if paused
        
        gameSeconds--;
        const m = Math.floor(gameSeconds / 60).toString().padStart(2, '0');
        const s = (gameSeconds % 60).toString().padStart(2, '0');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
        
        if (gameSeconds <= 0) {
            clearInterval(gameTimerInterval);
            if (isSinglePlayer) {
                // Time up! Player with more health wins
                const p1Health = spPlayers[0].health;
                const botHealth = spPlayers[1].health;
                let winner = 1;
                if (botHealth >= p1Health) winner = 2; // In single player, if tie, bot wins or let's say tie is loss
                endSinglePlayerGame(winner);
            }
        }
    }, 1000);
}

function stopGameTimer() {
    clearInterval(gameTimerInterval);
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
            // The timer start is now handled outside, or we pass the value.
            // But wait, startCountdown doesn't know the time limit!
            // Let's pass time limit to startCountdown
            if (isSinglePlayer) {
                startGameTimer(spTimeLimit);
            }
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
    const timeLimit = parseInt(document.getElementById('time-select').value) * 60;
    const name = inputPlayerName.value.trim() || 'Player 1';
    
    if (pendingGameMode === 'single') {
        isSinglePlayer = true;
        myPlayerNum = 1;
        spDifficulty = difficulty;
        spTimeLimit = timeLimit;
        
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
        socket.emit('createRoom', { playerName: name, difficulty, timeLimit });
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
    stopGameTimer();
    clearTimeout(botTimeout);
    showScreen('menu');
});

const btnPlayAgain = document.getElementById('btn-play-again');
if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
        if (isSinglePlayer) {
            // Restart Single Player game
            spPlayers = [{ id: 'p1', health: 100, name: inputPlayerName.value.trim() || 'Player 1' }, { id: 'bot', health: 100, name: 'Bot (' + spDifficulty + ')' }];
            showScreen('game');
            updateHealth(spPlayers);
            
            startTime = Date.now();
            totalKeystrokes = 0;
            totalCorrectCharactersTyped = 0;
            currentCombo = 0;
            if (comboCounterEl) comboCounterEl.style.opacity = 0;
            
            showFeedback('READY...');
            startCountdown(() => {
                setWord([getRandomWord(spDifficulty), getRandomWord(spDifficulty)]);
                startBotLoop();
            });
        } else {
            // Multiplayer: Send request to server
            socket.emit('playAgain', currentRoom);
            showScreen('waiting');
            document.getElementById('display-room-code').textContent = currentRoom;
            // Wait for other player
        }
    });
}

const btnLeaveGame = document.getElementById('btn-leave-game');
if (btnLeaveGame) {
    btnLeaveGame.addEventListener('click', () => {
        if (!isSinglePlayer && currentRoom) {
            socket.emit('leaveRoom', currentRoom);
        }
        stopGameTimer();
        clearTimeout(botTimeout);
        showScreen('menu');
    });
}

if(btnPauseGame) {
    btnPauseGame.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            btnPauseGame.textContent = 'Resume';
            btnPauseGame.style.backgroundColor = 'var(--primary)';
            btnPauseGame.style.color = '#000';
            countdownOverlay.textContent = 'PAUSED';
            countdownOverlay.style.opacity = 1;
            countdownOverlay.style.fontSize = '5rem';
            typingInput.disabled = true;
        } else {
            btnPauseGame.textContent = 'Pause';
            btnPauseGame.style.backgroundColor = 'rgba(0,0,0,0.5)';
            btnPauseGame.style.color = '#fff';
            countdownOverlay.style.opacity = 0;
            typingInput.disabled = false;
            typingInput.focus();
        }
    });
}

// Click anywhere to focus typing input in game
document.addEventListener('click', () => {
    if (currentWord && screens.game.classList.contains('active')) typingInput.focus();
});

// Event Listeners - Game
typingInput.addEventListener('keydown', (e) => {
    if (isPaused) {
        e.preventDefault();
        return;
    }

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
            
            playErrorSound();
            wordDisplayContainer.classList.add('error-bg');
            setTimeout(() => wordDisplayContainer.classList.remove('error-bg'), 300);
            return;
        }
    }
});

typingInput.addEventListener('input', (e) => {
    if (isPaused) {
        typingInput.value = '';
        return;
    }
    // Animate and send keystroke on EVERY key press (correct or wrong)
    if (!isSinglePlayer) socket.emit('keystroke', currentRoom);
    playAnimation(myPlayerNum, 'jab');
    playSwishSound(); // Play sword swing sound!
    createSparks(myPlayerNum); // Visual clash sparks

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
            
            // Hide combo after a short delay so it comes and goes
            if (comboCounterEl.dataset.hideTimeout) {
                clearTimeout(parseInt(comboCounterEl.dataset.hideTimeout));
            }
            comboCounterEl.dataset.hideTimeout = setTimeout(() => {
                comboCounterEl.style.opacity = 0;
                comboCounterEl.style.transform = 'translateX(-50%) scale(0)';
            }, 1000); // Fades out after 1 second if no new combo hits
        }

        if (isSinglePlayer) {
            handleSinglePlayerTypeProgress();
        } else {
            socket.emit('typeProgress', { roomCode: currentRoom, typedText: targetWord, combo: currentCombo });
            
            // Optimistic update for multiplayer to prevent word lag
            if (currentWordArray.length > 1) {
                currentWordArray.shift(); // Remove completed word
                setWord(currentWordArray); // This sets up the UI for the next word immediately
            } else {
                // Fallback if no next word is queued
                e.target.value = '';
                typedPartEl.textContent = '';
                remainingPartEl.textContent = currentWord;
                if (topTypedPartEl) topTypedPartEl.textContent = '';
                if (topRemainingPartEl) topRemainingPartEl.textContent = currentWord;
            }
        }
        return;
    }

    // Validate prefix
    if (targetWord.startsWith(typedText)) {
        typedPartEl.textContent = typedText;
        remainingPartEl.textContent = targetWord.substring(typedText.length);
        if (topTypedPartEl) topTypedPartEl.textContent = typedText;
        if (topRemainingPartEl) topRemainingPartEl.textContent = targetWord.substring(typedText.length);
        wordDisplayContainer.classList.remove('error-bg');
    } else {
        // Typing mistake! Reset combo.
        currentCombo = 0;
        if (comboCounterEl) {
            comboCounterEl.style.opacity = 0;
            comboCounterEl.style.transform = 'translateX(-50%) scale(0)';
        }
        
        playErrorSound();
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
        // Start multiplayer timer
        if (!isSinglePlayer && data.timeLimit) {
            startGameTimer(data.timeLimit);
        }
    });
});

socket.on('opponentKeystroke', () => {
    const opponentNum = myPlayerNum === 1 ? 2 : 1;
    playAnimation(opponentNum, 'jab');
    createSparks(opponentNum);
});

socket.on('roundWon', (data) => {
    updateHealth(data.players);
    const winnerNum = data.players.findIndex(p => p.id === data.winnerId) + 1;
    
    // Animate attack
    playAnimation(winnerNum, 'head-smash');
    
    // Animate hurt on loser
    const loserNum = winnerNum === 1 ? 2 : 1;
    playAnimation(loserNum, 'hurt');
    createBlood(loserNum);
    
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
    stopGameTimer();
    showScreen('gameover');
    const amIWinner = data.winner === socket.id;
    
    // Play final animation
    const attackerNum = data.players[0].id === data.winner ? 1 : 2;
    const defenderNum = attackerNum === 1 ? 2 : 1;
    playAnimation(attackerNum, 'attack');
    setTimeout(() => {
        playAnimation(defenderNum, 'knockback');
        createBlood(defenderNum);
    }, 100);

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

// Fetch random words from the internet to ensure massive variety
async function fetchExternalWords() {
    try {
        const response = await fetch('https://random-word-api.herokuapp.com/word?number=3000');
        const words = await response.json();
        if (words && words.length > 0) {
            // Sort them into difficulties
            const easy = words.filter(w => w.length >= 3 && w.length <= 5);
            const medium = words.filter(w => w.length >= 6 && w.length <= 8).map(w => w.charAt(0).toUpperCase() + w.slice(1));
            const hard = words.filter(w => w.length >= 9).map(w => {
                // Mix case randomly for hard mode
                return w.split('').map((char, i) => i % 2 === 0 ? char.toUpperCase() : char).join('');
            });
            
            if (easy.length > 0) WORDS.easy = easy;
            if (medium.length > 0) WORDS.medium = medium;
            if (hard.length > 0) WORDS.hard = hard;
            
            console.log("Successfully loaded external words!");
        }
    } catch(e) {
        console.log("Using fallback dictionary, fetch failed:", e);
    }
}

fetchExternalWords();

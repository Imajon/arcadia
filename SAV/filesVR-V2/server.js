const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// Game state
const GAME_DURATION = 60; // seconds
let players = {};
let itPlayerId = null;
let timeLeft = GAME_DURATION;
let gameTimer = null;
let gameActive = false;

function getColorForId(id) {
  const colors = ['#00f5ff', '#ff00aa', '#aaff00', '#ff8800', '#aa00ff', '#00ffaa'];
  const keys = Object.keys(players);
  const idx = keys.indexOf(id);
  return colors[idx % colors.length];
}

function startGame() {
  if (gameActive) return;
  gameActive = true;
  timeLeft = GAME_DURATION;

  // Pick random "it" player
  const ids = Object.keys(players);
  if (ids.length < 2) return;
  itPlayerId = ids[Math.floor(Math.random() * ids.length)];

  io.emit('game-start', { itPlayerId, timeLeft });

  gameTimer = setInterval(() => {
    timeLeft--;
    io.emit('timer', { timeLeft });

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  clearInterval(gameTimer);
  gameActive = false;

  // Count scores
  const scores = {};
  for (const [id, p] of Object.entries(players)) {
    scores[id] = p.score || 0;
  }

  io.emit('game-over', { scores });

  // Auto restart after 5s
  setTimeout(() => {
    for (const id of Object.keys(players)) {
      players[id].score = 0;
    }
    itPlayerId = null;
    if (Object.keys(players).length >= 2) {
      startGame();
    }
  }, 5000);
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Register player
  players[socket.id] = {
    id: socket.id,
    position: { x: Math.random() * 4 - 2, y: 1.6, z: Math.random() * 4 - 2 },
    rotation: { x: 0, y: 0, z: 0 },
    score: 0,
    name: `P${Object.keys(players).length + 1}`
  };

  // Send current state to new player
  socket.emit('init', {
    myId: socket.id,
    players,
    itPlayerId,
    timeLeft,
    gameActive,
    color: getColorForId(socket.id)
  });

  // Notify others
  socket.broadcast.emit('player-joined', {
    id: socket.id,
    player: players[socket.id],
    color: getColorForId(socket.id)
  });

  // Start game if enough players
  if (Object.keys(players).length >= 2 && !gameActive) {
    setTimeout(startGame, 2000);
  }

  // Move
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
      socket.broadcast.emit('player-moved', {
        id: socket.id,
        position: data.position,
        rotation: data.rotation,
        headRotation: data.headRotation
      });
    }
  });

  // Ball fired
  socket.on('fire-ball', (data) => {
    io.emit('ball-fired', {
      shooterId: socket.id,
      ballId: data.ballId,
      position: data.position,
      velocity: data.velocity,
      color: getColorForId(socket.id)
    });
  });

  // Ball hit
  socket.on('ball-hit', (data) => {
    if (!gameActive) return;
    const { targetId, shooterId } = data;

    // Only "it" player can tag, OR anyone can tag the "it" player
    const shooterIsIt = shooterId === itPlayerId;
    const targetIsIt = targetId === itPlayerId;

    if (shooterIsIt && !targetIsIt) {
      // It player tags someone -> they become it
      if (players[shooterId]) players[shooterId].score = (players[shooterId].score || 0) + 1;
      itPlayerId = targetId;
      io.emit('tagged', { newItId: targetId, taggedBy: shooterId, scores: getScores() });
    } else if (!shooterIsIt && targetIsIt) {
      // Non-it tags the it player -> shooter becomes it (reverse tag)
      if (players[shooterId]) players[shooterId].score = (players[shooterId].score || 0) + 1;
      itPlayerId = shooterId;
      io.emit('tagged', { newItId: shooterId, taggedBy: shooterId, scores: getScores() });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('player-left', { id: socket.id });

    if (itPlayerId === socket.id) {
      itPlayerId = null;
      if (Object.keys(players).length >= 2) {
        const ids = Object.keys(players);
        itPlayerId = ids[Math.floor(Math.random() * ids.length)];
        io.emit('new-it', { itPlayerId });
      }
    }

    if (Object.keys(players).length < 2 && gameActive) {
      clearInterval(gameTimer);
      gameActive = false;
      io.emit('waiting');
    }
  });
});

function getScores() {
  const s = {};
  for (const [id, p] of Object.entries(players)) s[id] = p.score || 0;
  return s;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 WebVR Tag Server running!`);
  console.log(`👉 Open http://localhost:${PORT} in your browser`);
  console.log(`📱 On same WiFi: http://<your-ip>:${PORT}\n`);
});

// ═══════════════════════════════════════════════════════════════
// HEINRICH MARIO — Auto-Run Platformer + AI Chat
// Mario runs by himself, you chat with him, he shows speech bubbles,
// you can take over controls (he complains!)
// ═══════════════════════════════════════════════════════════════

const AI_URL = "https://text.pollinations.ai/openai";

// ═══ DOM ═══
const $ = id => document.getElementById(id);
const startScreen = $('start-screen');
const tutorialScreen = $('tutorial-screen');
const appEl = $('app');
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d');
const chatMsgs = $('chat-msgs');
const chatInput = $('chat-input');
const btnSend = $('btn-send');
const btnSound = $('btn-sound');
const chatOnline = $('chat-online');
const coinCountEl = $('coin-count');
const scoreCountEl = $('score-count');
const controlBadge = $('control-badge');

// ═══ CONSTANTS ═══
const TILE = 32;
const GRAVITY = 0.6;
const MAX_FALL = 10;
const JUMP_FORCE = -11;
const AUTO_SPEED = 2.5;
const PLAYER_SPEED = 4;

// ═══ GAME STATE ═══
let W = 800, H = 600;
let running = false;
let frame = 0;
let cameraX = 0;
let coins = 0;
let score = 0;
let playerControl = false;
let playerControlTimer = 0;
let chatWaiting = false;
let chatHistory = [];

// Speech bubble
let speechText = '';
let speechTimer = 0;
const SPEECH_DURATION = 300; // ~5 seconds at 60fps

// ═══ MARIO ═══
const mario = {
  x: 200, y: 0, vx: 0, vy: 0,
  w: 28, h: 36,
  onGround: false,
  facing: 1, // 1 = right, -1 = left
  state: 'run', // run, jump, idle, angry
  stateTimer: 0,
  dead: false,
  autoJumpCooldown: 0,
};

// ═══ KEYS ═══
const keys = {};
document.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
    e.preventDefault();
    if (!keys[e.key] && running) {
      keys[e.key] = true;
      onPlayerInput();
    }
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

function onPlayerInput() {
  if (!playerControl) {
    playerControl = true;
    controlBadge.classList.remove('hidden');
    // Mario complains about being controlled!
    const complaints = [
      "Мама мия! Кто управляет-а мной?!",
      "Эй! Я сам знаю куда бежать-а!",
      "Одиоко! Отпусти-а мои ноги!",
      "Что-а?! Я не марионетка-а!",
      "Ваху... то есть, НЕ ваху! Отстань-а!",
      "Я тут сам гуляю-а, понятно?!",
      "Мама мия, опять кто-то за джойстик-а взялся!",
      "Эй-а! Это МОЁ приключение!",
    ];
    showSpeech(complaints[Math.floor(Math.random() * complaints.length)]);
    mario.state = 'angry';
    mario.stateTimer = 30;
  }
  playerControlTimer = 120; // ~2 seconds of player control
}

// ═══ WORLD GENERATION ═══
let worldTiles = []; // { x, y, type }
let tilesByCol = []; // tilesByCol[col] = [tiles] — for fast viewport culling
let enemies = [];
let coinItems = [];
let worldLength = 0;
let groundCols = new Set(); // columns that have ground (for underground fill)

function indexTiles() {
  tilesByCol = [];
  for (let i = 0; i < worldTiles.length; i++) {
    const t = worldTiles[i];
    const c = Math.floor(t.x / TILE);
    if (!tilesByCol[c]) tilesByCol[c] = [];
    tilesByCol[c].push(t);
  }
}

function generateWorld() {
  worldTiles = [];
  enemies = [];
  coinItems = [];
  groundCols = new Set();
  const segs = 200; // segments
  worldLength = segs * TILE * 4;

  let groundY = 14; // tile row from top (14 * 32 = 448)
  let gapActive = false;

  for (let col = 0; col < segs * 4; col++) {
    const wx = col * TILE;

    // Ground with occasional gaps
    if (col > 8 && col % 40 > 35 && col % 40 < 39) {
      // Gap in ground
    } else {
      groundCols.add(col);
      for (let row = groundY; row < groundY + 4; row++) {
        worldTiles.push({ x: wx, y: row * TILE, type: 'ground' });
      }
    }

    // Pipes
    if (col % 30 === 15 && col > 5) {
      worldTiles.push({ x: wx, y: (groundY - 2) * TILE, type: 'pipe-top' });
      worldTiles.push({ x: wx, y: (groundY - 1) * TILE, type: 'pipe-body' });
      worldTiles.push({ x: wx + TILE, y: (groundY - 2) * TILE, type: 'pipe-top' });
      worldTiles.push({ x: wx + TILE, y: (groundY - 1) * TILE, type: 'pipe-body' });
    }

    // Question blocks
    if (col % 18 === 7 && col > 3) {
      worldTiles.push({ x: wx, y: (groundY - 5) * TILE, type: 'qblock' });
      coinItems.push({ x: wx + 8, y: (groundY - 6) * TILE, collected: false });
    }
    if (col % 18 === 9 && col > 3) {
      worldTiles.push({ x: wx, y: (groundY - 5) * TILE, type: 'brick' });
    }
    if (col % 18 === 8 && col > 3) {
      worldTiles.push({ x: wx, y: (groundY - 5) * TILE, type: 'qblock' });
    }

    // Floating platforms
    if (col % 45 === 25) {
      for (let p = 0; p < 4; p++) {
        worldTiles.push({ x: wx + p * TILE, y: (groundY - 7) * TILE, type: 'brick' });
      }
    }

    // Coins on ground level
    if (col % 7 === 0 && col > 2) {
      coinItems.push({ x: wx + 8, y: (groundY - 2) * TILE, collected: false });
    }

    // Enemies (Goombas)
    if (col % 22 === 12 && col > 10) {
      enemies.push({ x: wx, y: (groundY - 1) * TILE - 4, vx: -1, alive: true, type: 'goomba' });
    }
    // Koopas
    if (col % 35 === 20 && col > 15) {
      enemies.push({ x: wx, y: (groundY - 1.3) * TILE, vx: -0.8, alive: true, type: 'koopa' });
    }
  }
}

// ═══ COLLISION ═══
function getTilesNear(x, y, w, h) {
  const c0 = Math.floor(x / TILE) - 1;
  const c1 = Math.floor((x + w) / TILE) + 1;
  const out = [];
  for (let c = c0; c <= c1; c++) {
    const bucket = tilesByCol[c];
    if (!bucket) continue;
    for (let k = 0; k < bucket.length; k++) {
      const t = bucket[k];
      if (t.x < x + w && t.x + TILE > x && t.y < y + h && t.y + TILE > y) out.push(t);
    }
  }
  return out;
}

// Fast "any tile matching predicate within column range" check
function anyTileIn(xLeft, xRight, predicate) {
  const c0 = Math.floor(xLeft / TILE) - 1;
  const c1 = Math.floor(xRight / TILE) + 1;
  for (let c = c0; c <= c1; c++) {
    const bucket = tilesByCol[c];
    if (!bucket) continue;
    for (let k = 0; k < bucket.length; k++) {
      if (predicate(bucket[k])) return true;
    }
  }
  return false;
}

function isSolid(type) {
  return type === 'ground' || type === 'pipe-top' || type === 'pipe-body' || type === 'brick' || type === 'qblock';
}

// ═══ UPDATE ═══
function update() {
  frame++;

  // ─── PLAYER CONTROL TIMEOUT ───
  if (playerControl) {
    playerControlTimer--;
    if (playerControlTimer <= 0 && !keys['ArrowLeft'] && !keys['ArrowRight'] && !keys['ArrowUp']) {
      playerControl = false;
      controlBadge.classList.add('hidden');
      const reliefs = [
        "Наконец-а! Я снова свободен!",
        "Ваху! Опять сам бегу-а!",
        "Летс-а-гоу! Моя дорога-а!",
      ];
      showSpeech(reliefs[Math.floor(Math.random() * reliefs.length)]);
    }
  }

  // ─── MARIO MOVEMENT ───
  if (playerControl) {
    mario.vx = 0;
    if (keys['ArrowLeft']) { mario.vx = -PLAYER_SPEED; mario.facing = -1; }
    if (keys['ArrowRight']) { mario.vx = PLAYER_SPEED; mario.facing = 1; }
    if ((keys['ArrowUp'] || keys[' ']) && mario.onGround) {
      mario.vy = JUMP_FORCE;
      mario.onGround = false;
      sounds.click();
    }
    // Extend player control while keys held
    if (keys['ArrowLeft'] || keys['ArrowRight'] || keys['ArrowUp']) {
      playerControlTimer = Math.max(playerControlTimer, 60);
    }
  } else {
    // AUTO-RUN AI
    mario.vx = AUTO_SPEED;
    mario.facing = 1;

    // Auto-jump over obstacles/gaps
    mario.autoJumpCooldown = Math.max(0, mario.autoJumpCooldown - 1);
    if (mario.onGround && mario.autoJumpCooldown === 0) {
      // Check ahead for obstacles or gaps (look further to avoid pits)
      const aheadX = mario.x + mario.w + 8;
      const feetY = mario.y + mario.h;
      // Check 2-3 tiles ahead for ground
      let groundAhead = false;
      for (let check = 0; check < 3; check++) {
        const cx = aheadX + check * TILE;
        if (anyTileIn(cx, cx + TILE, t =>
          isSolid(t.type) && t.x < cx + TILE && t.x + TILE > cx &&
          t.y >= feetY - 4 && t.y < feetY + TILE * 2
        )) { groundAhead = true; break; }
      }
      const wallAhead = anyTileIn(aheadX, aheadX + 12, t =>
        isSolid(t.type) && t.x < aheadX + 12 && t.x + TILE > aheadX &&
        t.y < feetY - 4 && t.y + TILE > mario.y
      );
      // Also detect gap right ahead using groundCols
      const currentCol = Math.floor((mario.x + mario.w) / TILE);
      const gapAhead = !groundCols.has(currentCol + 1) || !groundCols.has(currentCol + 2);

      if ((!groundAhead && gapAhead) || wallAhead || gapAhead) {
        mario.vy = JUMP_FORCE;
        mario.onGround = false;
        mario.autoJumpCooldown = 25;
      }
    }

    // Auto-jump over enemies
    const nearEnemy = enemies.find(e => e.alive && Math.abs(e.x - mario.x) < 60 && e.x > mario.x && Math.abs(e.y - mario.y) < 50);
    if (nearEnemy && mario.onGround && mario.autoJumpCooldown === 0) {
      mario.vy = JUMP_FORCE;
      mario.onGround = false;
      mario.autoJumpCooldown = 30;
    }
  }

  // ─── PHYSICS ───
  mario.vy += GRAVITY;
  if (mario.vy > MAX_FALL) mario.vy = MAX_FALL;

  // Horizontal
  mario.x += mario.vx;
  const hTiles = getTilesNear(mario.x, mario.y + 1, mario.w, mario.h - 2);
  for (const t of hTiles) {
    if (!isSolid(t.type)) continue;
    if (mario.vx > 0 && mario.x + mario.w > t.x && mario.x < t.x) {
      mario.x = t.x - mario.w;
      if (!playerControl) {
        mario.vy = JUMP_FORCE;
        mario.onGround = false;
      }
    } else if (mario.vx < 0 && mario.x < t.x + TILE && mario.x + mario.w > t.x + TILE) {
      mario.x = t.x + TILE;
    }
  }

  // Vertical
  mario.y += mario.vy;
  mario.onGround = false;
  const vTiles = getTilesNear(mario.x + 2, mario.y, mario.w - 4, mario.h);
  for (const t of vTiles) {
    if (!isSolid(t.type)) continue;
    if (mario.vy > 0 && mario.y + mario.h > t.y && mario.y < t.y) {
      mario.y = t.y - mario.h;
      mario.vy = 0;
      mario.onGround = true;
    } else if (mario.vy < 0 && mario.y < t.y + TILE && mario.y + mario.h > t.y + TILE) {
      mario.y = t.y + TILE;
      mario.vy = 1;
      // Hit block from below
      if (t.type === 'qblock') {
        t.type = 'qblock-hit';
        score += 100;
        sounds.click();
      }
    }
  }

  // Fall into pit → respawn AHEAD of the gap
  if (mario.y > H + 100) {
    // Find the next solid ground column after current cameraX
    let respawnX = cameraX + W * 0.5;
    for (let col = Math.floor(respawnX / TILE); col < Math.floor(respawnX / TILE) + 20; col++) {
      if (groundCols.has(col)) {
        respawnX = col * TILE;
        break;
      }
    }
    mario.x = respawnX;
    mario.y = 10 * TILE;
    mario.vy = 0;
    if (speechTimer <= 60) {
      showSpeech("Мама мия! Я упал-а в пропасть!");
    }
  }

  // ─── COINS ───
  coinItems.forEach(c => {
    if (c.collected) return;
    if (Math.abs(mario.x + mario.w/2 - c.x - 8) < 20 && Math.abs(mario.y + mario.h/2 - c.y - 8) < 20) {
      c.collected = true;
      coins++;
      score += 50;
      sounds.click();
      coinCountEl.textContent = '🪙 ' + coins;
      scoreCountEl.textContent = '⭐ ' + score;
    }
  });

  // ─── ENEMIES ───
  enemies.forEach(e => {
    if (!e.alive) return;
    e.x += e.vx;
    // Bounce off edges
    const onGround = anyTileIn(e.x, e.x + 24, t => isSolid(t.type) && t.x < e.x + 24 && t.x + TILE > e.x && Math.abs(t.y - (e.y + 28)) < 8);
    if (!onGround) e.vx = -e.vx;

    // Collision with Mario
    if (Math.abs(mario.x + mario.w/2 - e.x - 12) < 22 && Math.abs(mario.y + mario.h - e.y) < 16 && mario.vy > 0) {
      // Stomp!
      e.alive = false;
      mario.vy = JUMP_FORCE * 0.6;
      score += 200;
      scoreCountEl.textContent = '⭐ ' + score;
      sounds.happy();
      const stomps = ["Ваху! Прощай-а, грибочек!", "Летс-а-гоу!", "Хо-хо!"];
      showSpeech(stomps[Math.floor(Math.random() * stomps.length)]);
    } else if (Math.abs(mario.x + mario.w/2 - e.x - 12) < 18 && Math.abs(mario.y + mario.h/2 - e.y - 12) < 20) {
      // Hit from side → bounce back
      mario.x -= mario.facing * 40;
      mario.vy = JUMP_FORCE * 0.5;
      showSpeech("Ай-а! Больно-а!");
      sounds.sad();
    }
  });

  // ─── CAMERA ───
  const targetCam = mario.x - W * 0.35;
  cameraX += (targetCam - cameraX) * 0.08;
  if (cameraX < 0) cameraX = 0;

  // ─── SPEECH TIMER ───
  if (speechTimer > 0) speechTimer--;

  // ─── AUTO STATE ───
  mario.stateTimer = Math.max(0, mario.stateTimer - 1);
  if (mario.stateTimer === 0 && !playerControl) {
    if (!mario.onGround) mario.state = 'jump';
    else mario.state = 'run';
  }

  // ─── NEWS COMMENTS ───
  // Every ~15 seconds Mario comments on tech news
  newsCommentCooldown = Math.max(0, newsCommentCooldown - 1);
  if (newsCommentCooldown === 0 && !playerControl && speechTimer === 0 && !newsCommentBusy) {
    newsCommentCooldown = 900; // ~15 seconds at 60fps
    showNewsComment();
  }
}

// ═══ SPEECH BUBBLE ═══
function showSpeech(text) {
  speechText = text;
  speechTimer = SPEECH_DURATION;
}

// ═══ DRAW ═══
function draw() {
  ctx.clearRect(0, 0, W, H);
  const ox = -cameraX; // offset

  // ─── SKY ───
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#6B8CFF');
  skyGrad.addColorStop(1, '#9BB8FF');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // ─── SUN ───
  ctx.fillStyle = '#FBD000';
  ctx.beginPath();
  ctx.arc(W * 0.85, 50, 22, 0, Math.PI * 2);
  ctx.fill();

  // ─── CLOUDS (parallax) ───
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const cx = ((i * 300 + 50) - cameraX * 0.15) % (W + 200) - 100;
    const cy = 40 + (i % 3) * 35;
    drawCloud(cx, cy, 50 + (i % 3) * 15);
  }

  // ─── HILLS (parallax) ───
  ctx.fillStyle = '#43B047';
  for (let i = 0; i < 6; i++) {
    const hx = ((i * 350) - cameraX * 0.3) % (W + 300) - 100;
    const hy = 14 * TILE;
    ctx.beginPath();
    ctx.moveTo(hx - 80, hy);
    ctx.quadraticCurveTo(hx, hy - 60 - (i % 2) * 30, hx + 80, hy);
    ctx.fill();
  }

  // ─── UNDERGROUND FILL ───
  // Extend ground downward where ground tiles exist (skip gaps/pits)
  const groundBottom = (14 + 4) * TILE; // bottom of ground tile rows
  if (groundBottom < H) {
    const startCol = Math.floor(cameraX / TILE);
    const endCol = Math.ceil((cameraX + W) / TILE);
    for (let col = startCol; col <= endCol; col++) {
      if (groundCols.has(col)) {
        const dx = col * TILE + ox;
        ctx.fillStyle = '#C84C0C';
        ctx.fillRect(dx, groundBottom, TILE, H - groundBottom);
        ctx.fillStyle = '#A0400A';
        ctx.fillRect(dx, groundBottom, TILE, 1);
        ctx.fillRect(dx + TILE / 2, groundBottom, 1, H - groundBottom);
        for (let gy = groundBottom + TILE; gy < H; gy += TILE) {
          ctx.fillRect(dx, gy, TILE, 1);
        }
      }
    }
  }

  // ─── TILES (viewport-culled via column index) ───
  const viewL = cameraX - TILE;
  const viewR = cameraX + W + TILE;
  const colStart = Math.max(0, Math.floor(viewL / TILE));
  const colEnd = Math.ceil(viewR / TILE);
  for (let c = colStart; c <= colEnd; c++) {
    const bucket = tilesByCol[c];
    if (!bucket) continue;
    for (let k = 0; k < bucket.length; k++) {
      const t = bucket[k];
      const dx = t.x + ox;
      const dy = t.y;
      switch (t.type) {
      case 'ground':
        ctx.fillStyle = '#C84C0C';
        ctx.fillRect(dx, dy, TILE, TILE);
        ctx.fillStyle = '#A0400A';
        ctx.fillRect(dx, dy, TILE, 2);
        ctx.fillRect(dx + TILE/2, dy, 1, TILE);
        ctx.fillRect(dx, dy + TILE/2, TILE, 1);
        break;
      case 'brick':
        ctx.fillStyle = '#C84C0C';
        ctx.fillRect(dx, dy, TILE, TILE);
        ctx.strokeStyle = '#A0400A';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx + 0.5, dy + 0.5, TILE - 1, TILE - 1);
        ctx.fillStyle = '#A0400A';
        ctx.fillRect(dx + TILE/2 - 0.5, dy, 1, TILE);
        ctx.fillRect(dx, dy + TILE/2 - 0.5, TILE, 1);
        break;
      case 'qblock':
        const bounce = Math.sin(frame * 0.08) * 2;
        ctx.fillStyle = '#FBD000';
        ctx.fillRect(dx, dy + bounce, TILE, TILE);
        ctx.strokeStyle = '#8B5E3C';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx + 1, dy + bounce + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = '#8B5E3C';
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('?', dx + TILE/2, dy + bounce + 22);
        ctx.textAlign = 'left';
        break;
      case 'qblock-hit':
        ctx.fillStyle = '#8B5E3C';
        ctx.fillRect(dx, dy, TILE, TILE);
        ctx.strokeStyle = '#5c3d1e';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx + 0.5, dy + 0.5, TILE - 1, TILE - 1);
        break;
      case 'pipe-top':
        ctx.fillStyle = '#43B047';
        ctx.fillRect(dx - 3, dy, TILE + 6, 10);
        ctx.fillStyle = '#2D8031';
        ctx.fillRect(dx - 3, dy, TILE + 6, 3);
        ctx.fillStyle = '#43B047';
        ctx.fillRect(dx, dy + 10, TILE, TILE - 10);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(dx + 3, dy + 10, 4, TILE - 12);
        break;
      case 'pipe-body':
        ctx.fillStyle = '#43B047';
        ctx.fillRect(dx, dy, TILE, TILE);
        ctx.fillStyle = '#2D8031';
        ctx.fillRect(dx, dy, 3, TILE);
        ctx.fillRect(dx + TILE - 3, dy, 3, TILE);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(dx + 3, dy, 4, TILE);
        break;
      }
    }
  }

  // ─── COINS ───
  coinItems.forEach(c => {
    if (c.collected || c.x < viewL || c.x > viewR) return;
    const cx = c.x + ox;
    const scaleX = Math.abs(Math.sin(frame * 0.06));
    ctx.fillStyle = '#FBD000';
    ctx.beginPath();
    ctx.ellipse(cx + 8, c.y + 8, 6 * Math.max(scaleX, 0.2), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D4A800';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // ─── ENEMIES ───
  enemies.forEach(e => {
    if (!e.alive || e.x < viewL - 50 || e.x > viewR + 50) return;
    const ex = e.x + ox;
    if (e.type === 'goomba') {
      // Brown mushroom enemy
      ctx.fillStyle = '#A0400A';
      ctx.beginPath();
      ctx.ellipse(ex + 12, e.y + 8, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#FFF';
      ctx.fillRect(ex + 5, e.y + 4, 5, 5);
      ctx.fillRect(ex + 14, e.y + 4, 5, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(ex + 7, e.y + 5, 3, 3);
      ctx.fillRect(ex + 16, e.y + 5, 3, 3);
      // Feet
      ctx.fillStyle = '#000';
      const walkOff = Math.sin(frame * 0.1 + e.x) * 2;
      ctx.fillRect(ex + 2, e.y + 16 + walkOff, 8, 5);
      ctx.fillRect(ex + 14, e.y + 16 - walkOff, 8, 5);
    } else if (e.type === 'koopa') {
      // Green shell
      ctx.fillStyle = '#43B047';
      ctx.beginPath();
      ctx.ellipse(ex + 12, e.y + 14, 12, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#FBD000';
      ctx.fillRect(ex + 14, e.y, 8, 10);
      ctx.fillStyle = '#000';
      ctx.fillRect(ex + 18, e.y + 3, 3, 3);
    }
  });

  // ─── MARIO ───
  drawMario(mario.x + ox, mario.y);

  // ─── SPEECH BUBBLE ───
  if (speechTimer > 0 && speechText) {
    drawSpeechBubble(mario.x + ox + mario.w / 2, mario.y - 10, speechText);
  }
}

function drawCloud(x, y, w) {
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#fff';
  const h = w * 0.4;
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w*0.3, y + h*0.2, w*0.22, h*0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w*0.7, y + h*0.25, w*0.2, h*0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawMario(x, y) {
  const M = { hat:'#E52521', skin:'#FBBF8A', overalls:'#049CD8', shoes:'#8B5E3C', button:'#FBD000' };
  const f = mario.facing;
  const t = frame;

  // Walk bob
  let bobY = 0;
  if (mario.state === 'run' && mario.onGround) bobY = Math.sin(t * 0.3) * 2;
  if (mario.state === 'angry') bobY = Math.sin(t * 0.8) * 2;

  const dy = y + bobY;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.beginPath();
  ctx.ellipse(x + 14, y + mario.h, 14, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Hat
  ctx.fillStyle = M.hat;
  if (f > 0) {
    ctx.fillRect(x + 4, dy, 20, 5);
    ctx.fillRect(x + 2, dy + 3, 26, 5);
  } else {
    ctx.fillRect(x + 4, dy, 20, 5);
    ctx.fillRect(x, dy + 3, 26, 5);
  }

  // ── Face
  ctx.fillStyle = M.skin;
  ctx.fillRect(x + 4, dy + 8, 20, 8);
  // Eye
  ctx.fillStyle = '#000';
  if (mario.state === 'angry') {
    // Angry eyebrows
    ctx.fillRect(f > 0 ? x + 14 : x + 10, dy + 9, 5, 3);
    ctx.fillStyle = '#E52521';
    ctx.fillRect(f > 0 ? x + 12 : x + 8, dy + 8, 8, 2);
  } else {
    ctx.fillRect(f > 0 ? x + 16 : x + 8, dy + 10, 4, 3);
  }
  // Mustache
  ctx.fillStyle = M.shoes;
  ctx.fillRect(x + 8, dy + 14, 14, 2);

  // ── Body
  ctx.fillStyle = M.hat;
  ctx.fillRect(x + 4, dy + 16, 22, 4);
  ctx.fillStyle = M.overalls;
  ctx.fillRect(x + 4, dy + 20, 22, 8);
  ctx.fillStyle = M.button;
  ctx.fillRect(x + 8, dy + 22, 3, 3);
  ctx.fillRect(x + 18, dy + 22, 3, 3);

  // ── Legs
  const legOff = mario.state === 'run' ? Math.sin(t * 0.3) * 3 : 0;
  ctx.fillStyle = M.overalls;
  ctx.fillRect(x + 4, dy + 28, 8, 4);
  ctx.fillRect(x + 16, dy + 28 + legOff, 8, 4);
  // Shoes
  ctx.fillStyle = M.shoes;
  ctx.fillRect(x + 2, dy + 31, 12, 5);
  ctx.fillRect(x + 14, dy + 31 + legOff, 12, 5);
}

function drawSpeechBubble(x, y, text) {
  ctx.save();
  ctx.font = '11px "Press Start 2P"';

  // Word wrap
  const maxW = 260;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);

  const lineH = 14;
  const padX = 10, padY = 8;
  const bw = Math.min(maxW + padX * 2, Math.max(...lines.map(l => ctx.measureText(l).width)) + padX * 2);
  const bh = lines.length * lineH + padY * 2;
  let bx = x - bw / 2;
  const by = y - bh - 12;

  // Keep on screen
  if (bx < 4) bx = 4;
  if (bx + bw > W - 4) bx = W - bw - 4;

  // Fade
  const alpha = speechTimer < 30 ? speechTimer / 30 : 1;
  ctx.globalAlpha = alpha;

  // Bubble
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x - 6, by + bh);
  ctx.lineTo(x, by + bh + 10);
  ctx.lineTo(x + 6, by + bh);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(x - 6, by + bh - 1);
  ctx.lineTo(x, by + bh + 10);
  ctx.lineTo(x + 6, by + bh - 1);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#222';
  ctx.textAlign = 'left';
  lines.forEach((ln, i) => {
    ctx.fillText(ln, bx + padX, by + padY + 10 + i * lineH);
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ═══ ШКОЛЬНЫЕ ПРАВИЛА И ЗАДАЧИ (4 КЛАСС) ═══

// Русский язык — правила для 4 класса
const RULES_RUSSIAN = [
  'ЖИ-ШИ пиши с буквой И: жизнь, широкий, машина',
  'ЧА-ЩА пиши с буквой А: часы, роща, чаща',
  'ЧУ-ЩУ пиши с буквой У: чудо, щука, кричу',
  'ЧК, ЧН пишутся без ь: речка, ночной, конечно',
  'Безударную гласную проверяй ударением: вода́ — во́ды, земля́ — зе́мли',
  'Парную согласную на конце слова проверяй: дуб — дубы, мороз — морозы',
  'Непроизносимую согласную проверяй: сердце — сердечный, солнце — солнечный',
  'Разделительный Ь пишется перед Е, Ё, Ю, Я, И: семья, вьюга, соловьи',
  'Разделительный Ъ пишется после приставки перед Е, Ё, Ю, Я: объявление, съезд',
  'Имена собственные пишутся с большой буквы: Москва, Россия, Иван',
  'Предлоги со словами пишутся раздельно: в лесу, на столе, под деревом',
  'НЕ с глаголами пишется раздельно: не знаю, не хочу, не бегу',
  'Склонения сущ.: 1-е (страна, дядя), 2-е (конь, окно), 3-е (рожь, мышь)',
  'Спряжения глаголов: I (-ешь, -ет) и II (-ишь, -ит). Нести, писать — I; смотреть, дышать — II',
  'Глаголы-исключения II спр.: гнать, дышать, держать, зависеть, видеть, слышать, обидеть, терпеть, вертеть, ненавидеть, смотреть',
  'Окончание -ТСЯ у глаголов (что делает? — без Ь), -ТЬСЯ (что делать? — с Ь)',
  'Однородные члены предложения разделяются запятыми: Я люблю яблоки, груши и бананы',
  'Сложное предложение — две основы, между ними запятая: Солнце село, и звёзды зажглись',
  'Приставки на З/С: перед звонкой пиши З (разбить), перед глухой — С (расписать)',
  'Части слова: приставка-корень-суффикс-окончание. Например: под-снеж-н-ик',
  'Части речи: сущ., прил., глагол, нареч., местоим., числит., предлог, союз',
  'Падежи: Именительный, Родительный, Дательный, Винительный, Творительный, Предложный',
  'Ь на конце сущ. после шипящих — 3 склонение: ночь, рожь, мышь (2 скл. — без Ь: меч, луч)',
  'Двойные согласные нужно запомнить: класс, суббота, аллея, грамм, коллекция',
  'Прямая речь: «Привет!» — сказал Марио. Марио сказал: «Привет!»',
];

// Математика — правила и факты для 4 класса
const RULES_MATH = [
  'Порядок действий: сначала скобки, потом × и ÷, потом + и −',
  'Чтобы найти неизвестное слагаемое — из суммы вычитаем известное',
  'Чтобы найти неизвестный множитель — произведение делим на известный',
  'Признак делимости на 2: последняя цифра чётная (0, 2, 4, 6, 8)',
  'Признак делимости на 3: сумма цифр делится на 3. Пример: 123 → 1+2+3=6 → да!',
  'Признак делимости на 5: кончается на 0 или 5',
  'Признак делимости на 9: сумма цифр делится на 9. Пример: 729 → 7+2+9=18 → да!',
  'Площадь прямоугольника = длина × ширина. S = a × b',
  'Периметр прямоугольника = (a + b) × 2',
  'Площадь квадрата = сторона × сторона. S = a × a',
  '1 км = 1000 м, 1 м = 100 см, 1 см = 10 мм',
  '1 т = 1000 кг, 1 кг = 1000 г, 1 ц = 100 кг',
  '1 час = 60 минут, 1 минута = 60 секунд, 1 сутки = 24 часа',
  'Скорость = расстояние ÷ время. Расстояние = скорость × время',
  'Дробь: числитель сверху, знаменатель снизу. 3/4 — три четвёртых',
  'Сравнение дробей: при одинаковом знаменателе больше та, где числитель больше. 5/8 > 3/8',
  'В столбик: сложение и вычитание многозначных чисел — поразрядно, справа налево',
  'Умножение на 10, 100, 1000: припиши справа 1, 2 или 3 нуля. 25 × 100 = 2500',
  'Деление на 10, 100, 1000: убери 1, 2 или 3 нуля справа. 4500 ÷ 100 = 45',
  'Среднее арифметическое: сложи все числа и раздели на их количество. (2+4+6) ÷ 3 = 4',
  'Виды углов: острый (< 90°), прямой (= 90°), тупой (> 90°), развёрнутый (= 180°)',
  'Луч — часть прямой с началом, но без конца. Отрезок — с двумя концами',
  'Диагональ прямоугольника делит его на два равных треугольника',
  'Римские цифры: I=1, V=5, X=10, L=50, C=100. XIV=14, XXIX=29',
];

// Олимпиадные задачки по математике, 4 класс
const OLYMPIAD_TASKS = [
  { q: 'Задачка: В корзине 5 яблок. Как разделить их между 5 детьми, чтобы одно яблоко осталось в корзине?', a: 'Ответ: Один ребёнок получит яблоко вместе с корзиной!' },
  { q: 'Задачка: Найди число: оно двузначное, сумма цифр равна 10, а разность цифр равна 4', a: 'Ответ: 73 (или 37). 7+3=10, 7−3=4' },
  { q: 'Задачка: У Марио 100 монет. Он собрал ещё столько же и ещё полстолька. Сколько всего?', a: 'Ответ: 100+100+50 = 250 монет!' },
  { q: 'Задачка: Какое число нужно умножить само на себя, чтобы получить 144?', a: 'Ответ: 12 × 12 = 144' },
  { q: 'Задачка: Улитка лезет по столбу 10 м. За день поднимается на 3 м, ночью сползает на 2 м. На какой день долезет?', a: 'Ответ: На 8-й день! 7 дней по 1 м = 7 м, на 8-й день +3 м = 10 м' },
  { q: 'Задачка: Книга стоит 100 руб + половина книги. Сколько стоит книга?', a: 'Ответ: 200 руб! Половина книги = 100 руб, значит вся = 200' },
  { q: 'Задачка: Купа поставил 12 ловушек в 2 ряда по 6. Марио обезвредил 1/3. Сколько осталось?', a: 'Ответ: 12 − 12 × 1/3 = 12 − 4 = 8 ловушек' },
  { q: 'Задачка: Сумма трёх подряд идущих чисел = 30. Какие это числа?', a: 'Ответ: 9, 10, 11. Среднее = 30 ÷ 3 = 10' },
  { q: 'Задачка: Луиджи старше Марио на 3 года. Вместе им 21 год. Сколько лет каждому?', a: 'Ответ: Марио 9 лет, Луиджи 12 лет! (21−3) ÷ 2 = 9' },
  { q: 'Задачка: В комнате 4 угла, в каждом сидит кошка. Напротив каждой — 3 кошки. Сколько кошек?', a: 'Ответ: 4 кошки! Каждая видит остальных трёх' },
  { q: 'Задачка: Столяр распилил бревно на 5 частей. Сколько распилов он сделал?', a: 'Ответ: 4 распила! Распилов всегда на 1 меньше чем частей' },
  { q: 'Задачка: Вставь знаки (+, −, ×, ÷): 8 _ 4 _ 2 = 6', a: 'Ответ: 8 ÷ 4 + 2 = 6 или 8 − 4 + 2 = 6' },
];

let eduItems = [];   // перемешанные правила и задачки
let eduIndex = 0;
let eduBusy = false;
let newsCommentCooldown = 300; // start first item ~5 seconds after game start
let newsCommentBusy = false;   // alias for update() compatibility

// Shuffle array (Fisher-Yates)
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildEduList() {
  // ~70% rules (Russian + Math), ~30% olympiad tasks
  const rules = [...RULES_RUSSIAN.map(r => ({ type: 'rule-ru', text: r })),
                 ...RULES_MATH.map(r => ({ type: 'rule-math', text: r }))];
  const olymp = OLYMPIAD_TASKS.map(t => ({ type: 'olympiad', q: t.q, a: t.a }));
  shuffleArray(rules);
  shuffleArray(olymp);
  // Interleave: 2-3 rules, then 1 olympiad
  eduItems = [];
  let ri = 0, oi = 0;
  while (ri < rules.length || oi < olymp.length) {
    const batch = 2 + Math.floor(Math.random() * 2); // 2 or 3 rules
    for (let k = 0; k < batch && ri < rules.length; k++) eduItems.push(rules[ri++]);
    if (oi < olymp.length) eduItems.push(olymp[oi++]);
  }
  eduIndex = 0;
  console.log(`Уроки готовы: ${eduItems.length} элементов (правила + олимпиадные задачки)`);
}

const fallbackThoughts = [
  "Бежим-а и учимся-а!", "Учиться-а весело!", "Где мои монетки-а?",
  "Луиджи не знал это правило-а!", "Хочу пасту-а и уроки-а!",
  "Мама мия, математика-а!", "Русский язык-а красивый!",
  "Ваху! Решим задачку-а!", "Монетки звенят, мозги работают-а!",
];

async function showNewsComment() {
  if (newsCommentBusy) return;
  newsCommentBusy = true;

  if (eduItems.length === 0) buildEduList();
  if (eduIndex >= eduItems.length) {
    shuffleArray(eduItems);
    eduIndex = 0;
  }

  const item = eduItems[eduIndex++];

  if (item.type === 'olympiad') {
    // Olympiad: show question in bubble + chat, then answer after pause
    const icon = '🏆';
    addSystemMsg(icon + ' ' + item.q);
    const shortQ = item.q.length > 60 ? item.q.substring(0, 57) + '...' : item.q;
    showSpeech(icon + ' ' + shortQ);

    // Show answer after 6 seconds
    const answer = item.a;
    setTimeout(() => {
      if (running) {
        showSpeech('✅ ' + answer);
        addMarioMsg('✅ ' + answer);
      }
    }, 6000);
  } else {
    // Rule: show in bubble + chat, get Mario's fun comment
    const icon = item.type === 'rule-ru' ? '📖' : '📊';
    addSystemMsg(icon + ' ' + item.text);
    const shortR = item.text.length > 60 ? item.text.substring(0, 57) + '...' : item.text;
    showSpeech(icon + ' ' + shortR);

    // Get Mario's comment via AI
    const comment = await getEduComment(item.text, item.type);
    if (comment && running) {
      setTimeout(() => {
        if (running) {
          showSpeech(comment);
          addMarioMsg(icon + ' ' + comment);
        }
      }, 5000);
    }
  }
  newsCommentBusy = false;
}

async function getEduComment(rule, type) {
  try {
    const subj = type === 'rule-ru' ? 'русский язык' : 'математика';
    const resp = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: `Ты — Марио из Super Mario Bros. Ты учишь детей 4 класса предмету "${subj}".

ЯЗЫК: Отвечай ТОЛЬКО НА РУССКОМ. Никогда на английском.

ПРАВИЛА:
- ОДНО короткое предложение НА РУССКОМ (15 слов макс)
- Говори как Марио: "Мама мия!", "Ваху!", итальянский акцент с "-а" на конце слов
- Поясни правило простым языком с юмором
- Связывай с миром Mario если можно` },
          { role: 'user', content: `Прокомментируй правило: "${rule}"` }
        ],
        max_tokens: 60,
        temperature: 1.0,
        seed: Math.floor(Math.random() * 100000)
      })
    });
    const data = await resp.json();
    let reply = data.choices?.[0]?.message?.content || '';
    if (!reply || reply.includes('IMPORTANT NOTICE') || reply.includes('deprecated') || reply.length < 5) return null;
    reply = reply.replace(/"/g, '').trim();
    if (!/[а-яА-ЯёЁ]/.test(reply)) return null;
    return reply;
  } catch(e) {
    return null;
  }
}

// Education system is initialized from startGame()

// ═══ DEBUG FPS ═══
let _frames = 0, _last = performance.now(), _fps = 0, _ft = 0, _prev = 0;
function updateDebug() {
  _frames++;
  const n = performance.now();
  _ft = n - (_prev || n);
  _prev = n;
  if (n - _last >= 1000) {
    _fps = (_frames * 1000) / (n - _last);
    _frames = 0;
    _last = n;
  }
}
function drawDebug(c) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,.75)';
  c.fillRect(0, 0, 200, 20);
  c.font = '11px monospace';
  c.fillStyle = _fps < 30 ? '#f44' : '#0f0';
  c.fillText(`FPS:${_fps.toFixed(0)} ${_ft.toFixed(1)}ms`, 6, 14);
  c.restore();
}

// ═══ GAME LOOP ═══
function gameLoop() {
  if (!running) return;
  resize();
  update();
  draw();
  updateDebug();
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') drawDebug(ctx);
  requestAnimationFrame(gameLoop);
}

function resize() {
  const wrap = canvas.parentElement;
  if (canvas.width !== wrap.clientWidth || canvas.height !== wrap.clientHeight) {
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    W = canvas.width;
    H = canvas.height;
  }
}

function startGame() {
  generateWorld();
  indexTiles();
  mario.x = 100;
  mario.y = 12 * TILE;
  mario.vy = 0;
  coins = 0;
  score = 0;
  running = true;
  resize();
  gameLoop();
  addSystemMsg('★ Марио бежит по миру! Пиши ему в чат или перехвати управление стрелками ★');
  addSystemMsg('📚 Уроки по русскому языку и математике для 4 класса!');
  buildEduList();
}

// ═══ SCREENS ═══
startScreen.addEventListener('click', () => {
  sounds.init();
  sounds.resume();
  sounds.start();
  startScreen.style.opacity = '0';
  setTimeout(() => {
    startScreen.classList.add('hidden');
    tutorialScreen.classList.remove('hidden');
  }, 500);
});

$('btn-play').addEventListener('click', () => {
  sounds.click();
  tutorialScreen.style.opacity = '0';
  setTimeout(() => {
    tutorialScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    startGame();
  }, 400);
});

// ═══ CHAT ═══
function addSystemMsg(text) {
  const el = document.createElement('div');
  el.className = 'msg-sys';
  el.textContent = text;
  chatMsgs.appendChild(el);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

function addMarioMsg(text) {
  const msg = document.createElement('div');
  msg.className = 'msg mario';
  msg.innerHTML = `<div class="msg-av">🍄</div><div class="msg-bbl"><div class="msg-badge">💬</div>${esc(text)}</div>`;
  chatMsgs.appendChild(msg);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  // Also show as speech bubble
  showSpeech(text.length > 60 ? text.substring(0, 57) + '...' : text);
}

function addUserMsg(text) {
  const msg = document.createElement('div');
  msg.className = 'msg user';
  msg.innerHTML = `<div class="msg-av">🎮</div><div class="msg-bbl">${esc(text)}</div>`;
  chatMsgs.appendChild(msg);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

function addTyping() {
  const msg = document.createElement('div');
  msg.className = 'msg mario';
  msg.id = 'typing-el';
  msg.innerHTML = `<div class="msg-av">🍄</div><div class="msg-bbl"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatMsgs.appendChild(msg);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

function removeTyping() {
  const el = $('typing-el');
  if (el) el.remove();
}

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ═══ AI ═══
const MARIO_SYSTEM = `Ты — Марио из Super Mario Bros. Ты бежишь по своему классическому миру — Грибное Королевство. Вокруг трубы, кирпичные блоки, монеты, враги.

Говори как Марио — с итальянским акцентом: "Мама мия!", "Летс-а-гоу!", "Ваху!", "Одиоко!". Смешивай русский с итальянскими словечками.

Ты бежишь автоматически и иногда возмущаешься когда игрок перехватывает твоё управление. Ты живой персонаж со своим мнением.

ЯЗЫК: Отвечай ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. Никогда не пиши на английском. Даже если пользователь пишет на английском — отвечай на русском.

ПРАВИЛА:
- Отвечай 1-3 предложения, КОРОТКО
- Будь эмоциональным и живым
- Иногда возмущайся, иногда радуйся
- Используй отсылки к играм Mario
- ЯЗЫК ОТВЕТА: РУССКИЙ. Не пиши на английском!`;

async function askMario(text) {
  if (chatWaiting) return;
  chatWaiting = true;
  chatOnline.textContent = '✍️ печатает...';
  chatOnline.style.color = '#FBD000';

  addUserMsg(text);
  sounds.msgOut();
  chatHistory.push({ role: 'user', content: text });

  addTyping();

  try {
    const messages = [{ role: 'system', content: MARIO_SYSTEM }];
    chatHistory.slice(-10).forEach(h => messages.push({ role: h.role, content: h.content }));
    messages.push({ role: 'user', content: text });

    const resp = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages,
        max_tokens: 150,
        temperature: 0.9,
        seed: Math.floor(Math.random() * 100000)
      })
    });
    const data = await resp.json();
    removeTyping();

    let reply = data.choices?.[0]?.message?.content || '';
    if (!reply || reply.includes('IMPORTANT NOTICE') || reply.includes('deprecated') || !/[а-яА-ЯёЁ]/.test(reply)) {
      reply = 'Мама мия! Я сейчас-а занят бегом! Попробуй позже-а!';
    }
    addMarioMsg(reply);
    sounds.msgIn();
    chatHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    removeTyping();
    addMarioMsg('Мама мия! Связь-а потерялась!');
    console.error(e);
  }

  chatWaiting = false;
  chatOnline.textContent = '● онлайн';
  chatOnline.style.color = '';
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || chatWaiting) return;
  chatInput.value = '';
  chatInput.focus();
  askMario(text);
}

btnSend.addEventListener('click', () => { sounds.click(); sendMessage(); });
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); sounds.click(); sendMessage(); }
});

btnSound.addEventListener('click', () => {
  const on = sounds.toggle();
  btnSound.textContent = on ? '🔊' : '🔇';
  if (on) sounds.click();
});

// Prevent arrow keys from scrolling chat when game has focus
chatInput.addEventListener('focus', () => { /* keep chat active */ });

// ═══ VISUAL VIEWPORT HANDLING ═══
// Mobile browsers hide/show address bar dynamically, which can cover our UI.
// We use visualViewport to reposition touch controls and chat toggle.
function updateViewportVars() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--vvh', h + 'px');
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateViewportVars);
  window.visualViewport.addEventListener('scroll', updateViewportVars);
}
window.addEventListener('resize', updateViewportVars);
updateViewportVars();

// ═══ TOUCH CONTROLS (mobile) ═══
function bindTouchBtn(el, key) {
  if (!el) return;
  const press = (e) => {
    if (e) e.preventDefault();
    if (!running) return;
    if (!keys[key]) {
      keys[key] = true;
      onPlayerInput();
    } else {
      // refresh takeover timer while held
      playerControlTimer = 120;
    }
    el.classList.add('pressed');
  };
  const release = (e) => {
    if (e) e.preventDefault();
    keys[key] = false;
    el.classList.remove('pressed');
  };
  // Use pointer events for unified touch/mouse handling
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
  // Extra safety: block native touch gestures
  el.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindTouchBtn($('tc-left'), 'ArrowLeft');
bindTouchBtn($('tc-right'), 'ArrowRight');
bindTouchBtn($('tc-jump'), 'ArrowUp');

// ═══ CHAT DRAWER (mobile) ═══
const chatCol = $('chat-col');
const chatToggle = $('chat-toggle');
const chatClose = $('chat-close');
function openChat(){
  chatCol.classList.add('open');
  chatToggle.classList.remove('has-new');
}
function closeChat(){
  chatCol.classList.remove('open');
  if (document.activeElement === chatInput) chatInput.blur();
}
if (chatToggle) chatToggle.addEventListener('click', () => {
  sounds.click();
  if (chatCol.classList.contains('open')) closeChat(); else openChat();
});
if (chatClose) chatClose.addEventListener('click', () => { sounds.click(); closeChat(); });
// Notify badge when new Mario message arrives while drawer closed
const _observer = new MutationObserver(() => {
  if (!chatCol.classList.contains('open') && window.matchMedia('(max-width:900px) and (orientation:portrait), (max-width:768px)').matches) {
    chatToggle.classList.add('has-new');
  }
});
_observer.observe($('chat-msgs'), { childList: true });
// Block touch scrolling on the canvas itself (touch-action:none already set, belt-and-suspenders)
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// ═══ TEST HOOKS ═══
window.render_game_to_text = () => JSON.stringify({
  mode: running ? 'playing' : 'stopped',
  mario: { x: Math.round(mario.x), y: Math.round(mario.y), vx: mario.vx.toFixed(1), vy: mario.vy.toFixed(1), onGround: mario.onGround, state: mario.state },
  playerControl,
  coins,
  score,
  speechText: speechTimer > 0 ? speechText : '',
  cameraX: Math.round(cameraX),
  frame,
  fps: Math.round(_fps)
});
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000/60)));
  for (let i = 0; i < steps; i++) { update(); frame++; }
  draw();
};

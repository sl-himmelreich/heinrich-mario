// ═══════════════════════════════════════
// MARIO WORLD SCENE — Canvas renderer
// Classic Mario world: sky, clouds, hills,
// ground bricks, pipes, question blocks,
// characters, items
// ═══════════════════════════════════════

const WORLD = {
  canvas: null,
  ctx: null,
  w: 0,
  h: 0,
  frame: 0,
  scenario: null,
  marioState: 'idle', // idle, talk, sleep, dance, scared, happy, sad
  animTimer: 0,

  init() {
    this.canvas = document.getElementById('world-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  },

  resize() {
    const wrap = this.canvas.parentElement;
    this.canvas.width = wrap.clientWidth;
    this.canvas.height = wrap.clientHeight;
    this.w = this.canvas.width;
    this.h = this.canvas.height;
  },

  setScenario(sc) {
    this.scenario = sc;
    // Set mario state from action
    const a = sc.action;
    if (a.includes('sleep')) this.marioState = 'sleep';
    else if (a.includes('dance') || a.includes('happy')) this.marioState = 'dance';
    else if (a.includes('scared') || a.includes('panic')) this.marioState = 'scared';
    else if (a.includes('sad') || a.includes('cry') || a === 'eat-icecream') this.marioState = 'sad';
    else if (a.includes('talk') || a.includes('argue') || a.includes('comfort') || a.includes('advice')) this.marioState = 'talk';
    else this.marioState = 'idle';
  },

  setTalking(on) {
    if (on && this.marioState !== 'sleep') this.marioState = 'talk';
    else if (!on && this.scenario) this.setScenario(this.scenario);
  },

  loop() {
    this.frame++;
    this.animTimer += 1/60;
    this.draw();
    requestAnimationFrame(() => this.loop());
  },

  // ═══ COLORS ═══
  C: {
    sky: '#6B8CFF', skyNight: '#0C0C2E', skyEvening: '#FF8844', skyMorning: '#88BBFF',
    ground: '#C84C0C', groundDark: '#A0400A', groundLine: '#5c2d0a',
    brick: '#C84C0C', brickLine: '#A0400A',
    block: '#FBD000', blockBorder: '#8B5E3C',
    pipe: '#43B047', pipeDark: '#2D8031',
    hill: '#43B047', hillDark: '#2D8031',
    cloud: '#FFFFFF', cloudShadow: '#D0D0F0',
    bush: '#43B047', bushDark: '#2D8031',
    castleGray: '#888', castleDark: '#666',
    flag: '#43B047', pole: '#888',
    mario: { hat: '#E52521', skin: '#FBBF8A', overalls: '#049CD8', shoes: '#8B5E3C', button: '#FBD000' },
  },

  draw() {
    const c = this.ctx;
    const W = this.w, H = this.h;
    if (W === 0 || H === 0) return;

    const sc = this.scenario;
    const tod = sc ? sc.timeOfDay : 'day';
    const theme = sc ? (sc.sign || '') : '';

    // ─── SKY ───
    const skyColor = tod === 'night' ? this.C.skyNight
      : tod === 'evening' ? this.C.skyEvening
      : tod === 'morning' ? this.C.skyMorning
      : this.C.sky;
    c.fillStyle = skyColor;
    c.fillRect(0, 0, W, H);

    const groundH = Math.floor(H * 0.22);
    const groundY = H - groundH;

    // ─── STARS (night) ───
    if (tod === 'night') {
      c.fillStyle = '#FFF';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137 + 50) % W;
        const sy = (i * 97 + 20) % (groundY * 0.6);
        const bright = 0.3 + 0.7 * Math.abs(Math.sin(this.animTimer * 1.5 + i));
        c.globalAlpha = bright;
        c.fillRect(sx, sy, 2, 2);
      }
      c.globalAlpha = 1;
    }

    // ─── SUN / MOON ───
    if (tod === 'day' || tod === 'morning') {
      c.fillStyle = '#FBD000';
      c.beginPath();
      c.arc(W * 0.85, H * 0.12, 22, 0, Math.PI * 2);
      c.fill();
    } else if (tod === 'evening') {
      c.fillStyle = '#FF6644';
      c.beginPath();
      c.arc(W * 0.8, H * 0.18, 26, 0, Math.PI * 2);
      c.fill();
    } else if (tod === 'night') {
      c.fillStyle = '#EEEEFF';
      c.beginPath();
      c.arc(W * 0.82, H * 0.1, 18, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = this.C.skyNight;
      c.beginPath();
      c.arc(W * 0.82 + 6, H * 0.1 - 3, 16, 0, Math.PI * 2);
      c.fill();
    }

    // ─── CLOUDS ───
    const cloudPositions = [0.08, 0.30, 0.55, 0.78, 0.95];
    const cloudAlpha = tod === 'night' ? 0.15 : 0.9;
    cloudPositions.forEach((xp, i) => {
      const cx = (xp * W + this.frame * 0.2 * (0.5 + i * 0.15)) % (W + 120) - 60;
      const cy = H * (0.08 + i * 0.04);
      this.drawCloud(c, cx, cy, 50 + i * 10, cloudAlpha);
    });

    // ─── HILLS ───
    this.drawHill(c, W * 0.1, groundY, W * 0.22, H * 0.15);
    this.drawHill(c, W * 0.5, groundY, W * 0.18, H * 0.1);
    this.drawHill(c, W * 0.82, groundY, W * 0.25, H * 0.18);

    // ─── BUSHES ───
    this.drawBush(c, W * 0.2, groundY, 40);
    this.drawBush(c, W * 0.6, groundY, 30);
    this.drawBush(c, W * 0.88, groundY, 50);

    // ─── PIPE ───
    this.drawPipe(c, W * 0.7, groundY, 36, 50);

    // ─── QUESTION BLOCKS ───
    const bY = groundY - 90;
    this.drawQBlock(c, W * 0.35, bY, 26);
    this.drawQBlock(c, W * 0.35 + 28, bY, 26);
    this.drawQBlock(c, W * 0.35 + 56, bY, 26);

    // ─── BRICKS ───
    this.drawBrick(c, W * 0.35 + 84, bY, 26);
    this.drawBrick(c, W * 0.35 - 28, bY, 26);

    // ─── FLOATING COINS ───
    for (let i = 0; i < 3; i++) {
      const coinX = W * 0.38 + i * 28;
      const coinY = bY - 30 + Math.sin(this.animTimer * 3 + i) * 4;
      this.drawCoin(c, coinX, coinY, 6);
    }

    // ─── FLAG (far right) ───
    this.drawFlag(c, W * 0.92, groundY);

    // ─── CASTLE (background) ───
    if (sc && (sc.timeOfDay === 'evening' || sc.visitors.some(v => v.includes('bowser')))) {
      this.drawCastle(c, W * 0.04, groundY, tod === 'night');
    }

    // ─── VISITORS ───
    if (sc && sc.visitors.length > 0) {
      sc.visitors.forEach((v, i) => {
        const vx = W * 0.55 + i * 50;
        const vy = groundY - 38;
        this.drawCharacter(c, vx, vy, v);
      });
    }

    // ─── MARIO ───
    const marioX = W * 0.28;
    const marioY = groundY - 44;
    this.drawMario(c, marioX, marioY, this.marioState);

    // ─── GROUND ───
    // Top surface
    c.fillStyle = this.C.ground;
    c.fillRect(0, groundY, W, 6);
    c.fillStyle = this.C.groundLine;
    c.fillRect(0, groundY, W, 2);
    // Bricks pattern
    const brickH = Math.floor((groundH - 6) / 2);
    for (let row = 0; row < 2; row++) {
      const ry = groundY + 6 + row * brickH;
      const offset = row % 2 === 0 ? 0 : 20;
      for (let bx = -20 + offset; bx < W + 20; bx += 40) {
        c.fillStyle = this.C.ground;
        c.fillRect(bx, ry, 38, brickH - 1);
        c.fillStyle = this.C.groundDark;
        c.fillRect(bx, ry + brickH - 1, 40, 1);
        c.fillRect(bx + 38, ry, 2, brickH);
      }
    }

    // ─── ITEMS on ground ───
    if (sc) {
      const itemEmojis = {
        'tv-static':'📺','pizza-box':'🍕','tea-cups':'☕','phone':'📱','hearts':'💕',
        'icecream':'🍨','cake':'🎂','flowers':'💐','candles':'🕯️','pasta':'🍝',
        'mushroom-basket':'🍄','star':'⭐','banana':'🍌','guitar':'🎸','maps':'🗺️',
        'gift-box':'🎁','popcorn':'🍿','coffee':'☕','letter':'💌','tools':'🔧',
        'wrench':'🔧','yoga-mat':'🧘','laptop':'💻','typewriter':'⌨️','buckets':'🪣',
        'medicine':'💊','broom':'🧹','calculator':'🧮','vacuum':'🧹','thermometer':'🌡️',
      };
      const shown = sc.items.slice(0, 4);
      c.font = '18px serif';
      c.textAlign = 'center';
      shown.forEach((item, i) => {
        const emoji = itemEmojis[item] || '';
        if (emoji) {
          c.fillText(emoji, W * 0.15 + i * 42, groundY - 6);
        }
      });
      c.textAlign = 'left';
    }
  },

  // ═══ DRAW HELPERS ═══

  drawCloud(c, x, y, w, alpha) {
    c.globalAlpha = alpha;
    c.fillStyle = this.C.cloud;
    const h = w * 0.4;
    c.beginPath();
    c.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + w * 0.3, y + h * 0.15, w * 0.22, h * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + w * 0.68, y + h * 0.2, w * 0.2, h * 0.35, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  },

  drawHill(c, x, baseY, w, h) {
    c.fillStyle = this.C.hill;
    c.beginPath();
    c.moveTo(x - w/2, baseY);
    c.quadraticCurveTo(x, baseY - h, x + w/2, baseY);
    c.fill();
    c.fillStyle = this.C.hillDark;
    c.beginPath();
    c.moveTo(x - w/2 + 10, baseY);
    c.quadraticCurveTo(x + 5, baseY - h + 8, x + w/2 - 10, baseY);
    c.closePath();
    c.fill();
    // eyes on hill
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(x - 8, baseY - h * 0.45, 3, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + 8, baseY - h * 0.45, 3, 4, 0, 0, Math.PI * 2);
    c.fill();
  },

  drawBush(c, x, baseY, w) {
    c.fillStyle = this.C.bush;
    c.beginPath();
    c.ellipse(x, baseY - 6, w/2, w * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x - w * 0.3, baseY - 4, w * 0.25, w * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + w * 0.3, baseY - 4, w * 0.25, w * 0.2, 0, 0, Math.PI * 2);
    c.fill();
  },

  drawPipe(c, x, baseY, w, h) {
    // Body
    c.fillStyle = this.C.pipe;
    c.fillRect(x - w/2, baseY - h, w, h);
    c.fillStyle = this.C.pipeDark;
    c.fillRect(x - w/2, baseY - h, 4, h);
    c.fillRect(x + w/2 - 4, baseY - h, 4, h);
    // Lip
    c.fillStyle = this.C.pipe;
    c.fillRect(x - w/2 - 5, baseY - h, w + 10, 10);
    c.fillStyle = this.C.pipeDark;
    c.fillRect(x - w/2 - 5, baseY - h, w + 10, 3);
    // Highlight
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(x - w/2 + 4, baseY - h + 10, 6, h - 12);
  },

  drawQBlock(c, x, y, s) {
    const bounce = Math.sin(this.animTimer * 3) * 2;
    c.fillStyle = this.C.block;
    c.fillRect(x, y + bounce, s, s);
    c.strokeStyle = this.C.blockBorder;
    c.lineWidth = 2;
    c.strokeRect(x + 1, y + bounce + 1, s - 2, s - 2);
    c.fillStyle = this.C.blockBorder;
    c.font = `${s * 0.6}px "Press Start 2P"`;
    c.textAlign = 'center';
    c.fillText('?', x + s/2, y + bounce + s - 6);
    c.textAlign = 'left';
  },

  drawBrick(c, x, y, s) {
    c.fillStyle = this.C.brick;
    c.fillRect(x, y, s, s);
    c.fillStyle = this.C.brickLine;
    c.fillRect(x, y, s, 1);
    c.fillRect(x, y + s - 1, s, 1);
    c.fillRect(x + s/2, y, 1, s);
    c.fillRect(x, y + s/2, s, 1);
  },

  drawCoin(c, x, y, r) {
    const scaleX = Math.abs(Math.sin(this.animTimer * 4));
    c.fillStyle = '#FBD000';
    c.beginPath();
    c.ellipse(x, y, r * Math.max(scaleX, 0.2), r, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#D4A800';
    c.lineWidth = 1;
    c.stroke();
  },

  drawFlag(c, x, baseY) {
    c.fillStyle = this.C.pole;
    c.fillRect(x, baseY - 120, 3, 120);
    // Ball
    c.fillStyle = '#E52521';
    c.beginPath();
    c.arc(x + 1, baseY - 120, 5, 0, Math.PI * 2);
    c.fill();
    // Flag
    c.fillStyle = this.C.flag;
    c.beginPath();
    c.moveTo(x + 3, baseY - 117);
    c.lineTo(x + 33, baseY - 105);
    c.lineTo(x + 3, baseY - 93);
    c.fill();
  },

  drawCastle(c, x, baseY, dark) {
    const cw = 70, ch = 80;
    c.fillStyle = dark ? '#444' : this.C.castleGray;
    c.fillRect(x, baseY - ch, cw, ch);
    // Battlements
    for (let i = 0; i < 5; i++) {
      c.fillRect(x + i * 14, baseY - ch - 12, 10, 12);
    }
    // Door
    c.fillStyle = '#333';
    c.fillRect(x + cw/2 - 10, baseY - 28, 20, 28);
    c.beginPath();
    c.arc(x + cw/2, baseY - 28, 10, Math.PI, 0);
    c.fill();
    // Window
    c.fillStyle = dark ? '#FBD000' : '#333';
    c.fillRect(x + 10, baseY - ch + 15, 12, 12);
    c.fillRect(x + cw - 22, baseY - ch + 15, 12, 12);
  },

  drawCharacter(c, x, y, type) {
    // Simple pixel-style characters
    if (type.includes('luigi')) {
      // Green hat + overalls
      c.fillStyle = '#43B047';
      c.fillRect(x + 2, y, 16, 5);
      c.fillRect(x, y + 3, 22, 5);
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 8, 14, 8);
      c.fillStyle = '#43B047';
      c.fillRect(x + 2, y + 16, 18, 10);
      c.fillStyle = '#049CD8';
      c.fillRect(x + 2, y + 22, 8, 10);
      c.fillRect(x + 12, y + 22, 8, 10);
      c.fillStyle = '#8B5E3C';
      c.fillRect(x, y + 30, 10, 5);
      c.fillRect(x + 12, y + 30, 10, 5);
    } else if (type.includes('peach')) {
      // Pink dress
      c.fillStyle = '#FBD000';
      c.fillRect(x + 4, y, 14, 4);
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 4, 14, 10);
      c.fillStyle = '#FFB0C0';
      c.fillRect(x, y + 14, 22, 22);
      c.fillStyle = '#FF80A0';
      c.fillRect(x + 2, y + 28, 18, 8);
    } else if (type.includes('bowser')) {
      // Big green shell
      c.fillStyle = '#43B047';
      c.beginPath();
      c.ellipse(x + 12, y + 14, 16, 14, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FBD000';
      c.fillRect(x + 4, y + 2, 16, 8);
      // Horns
      c.fillStyle = '#FBD000';
      c.fillRect(x, y - 4, 6, 8);
      c.fillRect(x + 18, y - 4, 6, 8);
      // Eyes
      c.fillStyle = '#E52521';
      c.fillRect(x + 6, y + 4, 4, 3);
      c.fillRect(x + 14, y + 4, 4, 3);
    } else if (type.includes('toad')) {
      // Mushroom head
      c.fillStyle = '#E52521';
      c.beginPath();
      c.ellipse(x + 10, y + 6, 12, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FFF';
      c.beginPath();
      c.ellipse(x + 4, y + 2, 5, 4, -0.3, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(x + 16, y + 2, 5, 4, 0.3, 0, Math.PI * 2);
      c.fill();
      // Face
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 12, 12, 10);
      // Body
      c.fillStyle = '#FFF';
      c.fillRect(x + 2, y + 22, 16, 12);
      c.fillStyle = '#049CD8';
      c.fillRect(x + 4, y + 24, 12, 4);
    } else if (type.includes('yoshi')) {
      c.fillStyle = '#43B047';
      c.beginPath();
      c.ellipse(x + 10, y + 10, 10, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FFF';
      c.beginPath();
      c.ellipse(x + 10, y + 18, 8, 8, 0, 0, Math.PI * 2);
      c.fill();
      // Eyes
      c.fillStyle = '#FFF';
      c.fillRect(x + 12, y + 2, 8, 7);
      c.fillStyle = '#000';
      c.fillRect(x + 16, y + 4, 3, 3);
      // Nose
      c.fillStyle = '#43B047';
      c.fillRect(x + 16, y + 8, 8, 4);
    } else if (type.includes('rosalina')) {
      c.fillStyle = '#88DDFF';
      c.fillRect(x + 2, y, 18, 6);
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 6, 14, 8);
      c.fillStyle = '#88DDFF';
      c.fillRect(x, y + 14, 22, 22);
      c.fillStyle = '#FBD000';
      c.beginPath();
      c.moveTo(x + 11, y - 6);
      c.lineTo(x + 14, y);
      c.lineTo(x + 8, y);
      c.fill();
    } else if (type.includes('dk')) {
      c.fillStyle = '#8B5E3C';
      c.beginPath();
      c.ellipse(x + 12, y + 12, 14, 16, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 6, 16, 10);
      c.fillStyle = '#E52521';
      c.fillRect(x + 4, y + 22, 16, 4);
    } else if (type.includes('wario')) {
      c.fillStyle = '#FBD000';
      c.fillRect(x + 2, y, 16, 5);
      c.fillRect(x, y + 3, 22, 5);
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 8, 14, 8);
      c.fillStyle = '#FBD000';
      c.fillRect(x + 8, y + 12, 8, 3);
      c.fillStyle = '#8800AA';
      c.fillRect(x + 2, y + 16, 18, 16);
    } else if (type.includes('waluigi')) {
      c.fillStyle = '#8800AA';
      c.fillRect(x + 2, y, 16, 5);
      c.fillRect(x, y + 3, 22, 5);
      c.fillStyle = '#FBBF8A';
      c.fillRect(x + 4, y + 8, 14, 10);
      c.fillStyle = '#222';
      c.fillRect(x + 2, y + 18, 18, 18);
    } else if (type.includes('boo')) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.ellipse(x + 12, y + 12, 14, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#000';
      c.fillRect(x + 6, y + 8, 4, 5);
      c.fillRect(x + 14, y + 8, 4, 5);
      c.fillStyle = '#333';
      c.fillRect(x + 4, y + 16, 16, 3);
    } else if (type.includes('goomba')) {
      c.fillStyle = '#C84C0C';
      c.beginPath();
      c.ellipse(x + 10, y + 10, 12, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FFF';
      c.fillRect(x + 4, y + 6, 5, 5);
      c.fillRect(x + 12, y + 6, 5, 5);
      c.fillStyle = '#000';
      c.fillRect(x + 6, y + 8, 3, 3);
      c.fillRect(x + 14, y + 8, 3, 3);
      c.fillStyle = '#000';
      c.fillRect(x + 2, y + 18, 8, 5);
      c.fillRect(x + 12, y + 18, 8, 5);
    } else if (type.includes('koopa')) {
      c.fillStyle = '#43B047';
      c.beginPath();
      c.ellipse(x + 10, y + 14, 10, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FBD000';
      c.fillRect(x + 12, y + 2, 8, 8);
      c.fillStyle = '#000';
      c.fillRect(x + 16, y + 4, 3, 3);
    } else if (type.includes('lakitu')) {
      // Cloud + character
      c.fillStyle = '#FFF';
      c.beginPath();
      c.ellipse(x + 10, y + 18, 16, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#43B047';
      c.beginPath();
      c.ellipse(x + 10, y + 8, 8, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FFF';
      c.fillRect(x + 6, y + 4, 4, 4);
      c.fillRect(x + 12, y + 4, 4, 4);
      c.fillStyle = '#000';
      c.fillRect(x + 7, y + 5, 2, 2);
      c.fillRect(x + 13, y + 5, 2, 2);
    } else {
      // Generic character
      c.fillStyle = '#888';
      c.beginPath();
      c.ellipse(x + 10, y + 12, 10, 14, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FFF';
      c.fillRect(x + 4, y + 6, 4, 4);
      c.fillRect(x + 12, y + 6, 4, 4);
    }
  },

  drawMario(c, x, y, state) {
    const M = this.C.mario;
    const t = this.animTimer;
    let offY = 0;

    if (state === 'dance') offY = Math.sin(t * 8) * 6;
    else if (state === 'happy') offY = -Math.abs(Math.sin(t * 5)) * 8;
    else if (state === 'scared') offY = Math.sin(t * 20) * 2;
    else if (state === 'idle') offY = Math.sin(t * 2) * 2;
    else if (state === 'talk') offY = Math.sin(t * 6) * 2;

    const ay = y + offY;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.beginPath();
    c.ellipse(x + 14, y + 44, 16, 4, 0, 0, Math.PI * 2);
    c.fill();

    // Hat
    c.fillStyle = M.hat;
    c.fillRect(x + 4, ay, 20, 6);
    c.fillRect(x + 2, ay + 4, 26, 5);

    // Hair
    c.fillStyle = M.shoes;
    c.fillRect(x + 2, ay + 5, 4, 4);

    // Face
    c.fillStyle = M.skin;
    c.fillRect(x + 4, ay + 9, 20, 8);

    // Eye
    c.fillStyle = '#000';
    c.fillRect(x + 16, ay + 10, 4, 4);

    // Nose
    c.fillStyle = M.skin;
    c.fillRect(x + 20, ay + 12, 4, 4);

    // Mustache
    c.fillStyle = M.shoes;
    c.fillRect(x + 10, ay + 15, 14, 2);

    // Body
    c.fillStyle = M.hat;
    c.fillRect(x + 4, ay + 17, 22, 4);
    c.fillStyle = M.overalls;
    c.fillRect(x + 4, ay + 21, 22, 8);

    // Belt buttons
    c.fillStyle = M.button;
    c.fillRect(x + 8, ay + 23, 3, 3);
    c.fillRect(x + 18, ay + 23, 3, 3);

    // Legs
    const legOff = state === 'dance' ? Math.sin(t * 8) * 3 : 0;
    c.fillStyle = M.overalls;
    c.fillRect(x + 4, ay + 29, 8, 8);
    c.fillRect(x + 16, ay + 29 + legOff, 8, 8);

    // Shoes
    c.fillStyle = M.shoes;
    c.fillRect(x + 2, ay + 35, 12, 6);
    c.fillRect(x + 14, ay + 35 + legOff, 12, 6);

    // Sleep z's
    if (state === 'sleep') {
      c.fillStyle = '#FFF';
      c.font = '10px "Press Start 2P"';
      const zy = ay - 10 - Math.sin(t * 2) * 6;
      c.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3;
      c.fillText('Z', x + 22, zy);
      c.font = '7px "Press Start 2P"';
      c.fillText('z', x + 30, zy - 8);
      c.globalAlpha = 1;
    }

    // Sad tears
    if (state === 'sad') {
      c.fillStyle = '#049CD8';
      const tearY = ay + 14 + (t * 20 % 10);
      c.fillRect(x + 18, tearY, 2, 3);
    }
  },
};

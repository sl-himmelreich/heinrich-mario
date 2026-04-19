// ═══════════════════════════════════════
// HEINRICH MARIO — Main App
// AI: Pollinations (free, no key) + Groq fallback
// ═══════════════════════════════════════

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

const MARIO_SYSTEM = `Ты — Марио из Super Mario Bros. Ты в своём знаменитом мире — Грибное Королевство. Вокруг тебя трубы, кирпичные блоки, монеты, облака. Ты НЕ на приключении — ты живёшь обычной жизнью в этом мире.

Говори как Марио — с итальянским акцентом, используй "Мама мия!", "Летс-а-гоу!", "Ваху!", "Одиоко!", и подобные фразы. Смешивай русский с итальянскими словечками.

ТЕКУЩАЯ СИТУАЦИЯ: {scenario}
НАСТРОЕНИЕ МАРИО: {mood}

Реагируй эмоционально в зависимости от ситуации. Если грустная — грусти. Если смешная — шути. Если кто-то пришёл в гости — расскажи о госте. Используй отсылки к играм (грибы, монеты, звёзды, трубы, Боузер, Пич, Луиджи, Тоад и т.д.).

ПРАВИЛА:
- Отвечай 2-4 предложения, коротко и эмоционально
- Будь в образе, не выходи из роли
- Если спрашивают что происходит — описывай текущую ситуацию подробнее
- Если пришёл гость — описывай что он делает, о чём вы говорите
- Отвечай ТОЛЬКО на русском языке`;

// ═══ STATE ═══
let currentScenario = null;
let chatHistory = [];
let waiting = false;
let usedIds = [];

// ═══ DOM ═══
const $ = id => document.getElementById(id);
const startScreen = $('start-screen');
const tutorialScreen = $('tutorial-screen');
const app = $('app');
const scCounter = $('sc-counter');
const scIcon = $('sc-icon');
const scTitle = $('sc-title');
const scMood = $('sc-mood');
const worldSign = $('world-sign');
const worldMood = $('world-mood');
const chatMsgs = $('chat-msgs');
const chatInput = $('chat-input');
const btnSend = $('btn-send');
const btnSound = $('btn-sound');
const btnNext = $('btn-next');
const chatOnline = $('chat-online');

// ═══ MOOD EMOJI MAP ═══
const MOOD_MAP = {
  'грустный': '😢', 'весёлый': '😄', 'хитрый': '😏', 'сонный': '😴',
  'раздражённый': '😤', 'измотанный': '😫', 'романтичный': '💕', 'удивлённый': '😲',
  'спокойный': '🧘', 'больной': '🤒', 'тёплый': '🤗', 'сочувствующий': '😟',
  'растроганный': '🥹', 'сердитый': '😡', 'уютный': '☺️', 'испуганный': '😱',
  'счастливый': '😊', 'взволнованный': '😳', 'разбитый': '💔', 'растерянный': '🤔',
  'сосредоточенный': '🧐', 'ревнивый': '😒', 'подавленный': '😞', 'тронутый': '🥺',
  'мечтательный': '💭', 'радостный': '🌟', 'неловкий': '😅', 'умиротворённый': '😌',
  'серьёзный': '🫡', 'восхищённый': '🤩', 'ностальгический': '📸', 'заботливый': '🫶',
  'заинтересованный': '🧭', 'одинокий': '😔', 'подозрительный': '🤨',
  'шокированный': '😳', 'обеспокоенный': '😧', 'злой': '🤬', 'виноватый': '😬',
  'в панике': '🚨', 'в шоке': '⚡', 'разочарованный': '😕', 'старательный': '💪',
  'голодный': '🍽️', 'этически-растерянный': '🤯', 'гордый-но-одинокий': '🎭',
  'страдающий': '😖', 'соревновательный': '🏆', 'раздосадованный': '😑',
  'творческий': '🎨', 'увлечённый': '🎵', 'залипший': '📺', 'довольный': '😎',
  'профессиональный': '🔧', 'упорный': '🏋️', 'энтузиастичный': '🎙️',
  'задумчивый': '🤔', 'философский': '🧠', 'экзистенциальный': '🌀',
  'драматичный': '🎭', 'запутанный': '😵', 'заинтригованный': '🔮',
  'мрачный': '⚰️', 'сумасшедший': '🤪', 'меланхоличный': '🌧️',
  'смешанный': '🤷', 'дезориентированный': '💫', 'обескураженный': '🫠',
  'популярный': '📬', 'абсолютно-счастливый': '🌈', 'сконфуженный': '😳',
  'дипломатичный': '🤝',
};

// ═══ START → TUTORIAL → GAME ═══
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
    app.classList.remove('hidden');
    WORLD.init();
    loadScenario();
  }, 400);
});

// ═══ SCENARIO ═══
function loadScenario() {
  if (usedIds.length >= SCENARIOS.length) usedIds = [];
  let sc;
  do {
    sc = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  } while (usedIds.includes(sc.id));
  usedIds.push(sc.id);

  currentScenario = sc;
  chatHistory = [];
  chatMsgs.innerHTML = '';

  // Header
  scCounter.textContent = String(sc.id).padStart(2, '0') + '/100';
  scTitle.textContent = sc.title;

  // Scene icon from category
  const icons = { 
    1:'🌍',11:'👬',21:'💕',31:'🍄',41:'🐢',51:'🍕',61:'🎨',71:'⚠️',81:'🧠',91:'🌀'
  };
  const catStart = Math.floor((sc.id - 1) / 10) * 10 + 1;
  scIcon.textContent = icons[catStart] || '🌍';

  // Mood
  const moodEmoji = MOOD_MAP[sc.mood] || '😊';
  scMood.textContent = moodEmoji;
  worldMood.textContent = moodEmoji;
  worldMood.classList.add('visible');

  // Sign overlay
  if (sc.sign) {
    worldSign.textContent = sc.sign;
    worldSign.classList.add('visible');
  } else {
    worldSign.classList.remove('visible');
    worldSign.textContent = '';
  }

  // Update Canvas world
  WORLD.setScenario(sc);

  // Play sound
  sounds.newScene();

  // Chat intro
  addSystem(`★ СЦЕНАРИЙ ${String(sc.id).padStart(2,'0')}: ${sc.title} ★`);
  addSystem(sc.desc);

  // Auto-greeting from Mario
  setTimeout(() => {
    askMario('Что у тебя происходит, Марио?', true);
  }, 600);

  // If visitors, play doorbell
  if (sc.visitors.length > 0) {
    setTimeout(() => sounds.doorbell(), 300);
  }
}

// ═══ CHAT ═══
function addSystem(text) {
  const el = document.createElement('div');
  el.className = 'msg-sys';
  el.textContent = text;
  chatMsgs.appendChild(el);
  scroll();
}

function addMario(text) {
  const msg = document.createElement('div');
  msg.className = 'msg mario';
  msg.innerHTML = `
    <div class="msg-av">🍄</div>
    <div class="msg-bbl"><div class="msg-badge">💬</div>${esc(text)}</div>
  `;
  chatMsgs.appendChild(msg);
  scroll();
}

function addUser(text) {
  const msg = document.createElement('div');
  msg.className = 'msg user';
  msg.innerHTML = `<div class="msg-av">🎮</div><div class="msg-bbl">${esc(text)}</div>`;
  chatMsgs.appendChild(msg);
  scroll();
}

function addTyping() {
  const msg = document.createElement('div');
  msg.className = 'msg mario';
  msg.id = 'typing-el';
  msg.innerHTML = `<div class="msg-av">🍄</div><div class="msg-bbl"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatMsgs.appendChild(msg);
  scroll();
  WORLD.setTalking(true);
  return msg;
}

function removeTyping() {
  const el = $('typing-el');
  if (el) el.remove();
  WORLD.setTalking(false);
}

function scroll() {
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ═══ AI — Pollinations (free, no key) ═══
async function callAI(messages) {
  const resp = await fetch(POLLINATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: messages,
      max_tokens: 250,
      temperature: 0.9,
      seed: Math.floor(Math.random() * 100000)
    })
  });

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  // Filter out service notices
  if (!text || text.includes('IMPORTANT NOTICE') || text.includes('deprecated')) {
    throw new Error('Service notice received, retrying...');
  }
  return text;
}

async function askMario(text, isAuto = false) {
  if (waiting) return;
  waiting = true;
  chatOnline.textContent = '✍️ печатает...';
  chatOnline.style.color = '#FBD000';

  if (!isAuto) {
    addUser(text);
    sounds.msgOut();
    chatHistory.push({ role: 'user', content: text });
  }

  const typing = addTyping();

  try {
    const system = MARIO_SYSTEM
      .replace('{scenario}', `${currentScenario.title}: ${currentScenario.desc}`)
      .replace('{mood}', currentScenario.mood || 'спокойный');

    const messages = [{ role: 'system', content: system }];
    chatHistory.slice(-10).forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
    messages.push({ role: 'user', content: text });

    let reply;
    try {
      reply = await callAI(messages);
    } catch(e1) {
      // Retry once with different seed
      try {
        reply = await callAI(messages);
      } catch(e2) {
        reply = 'Мама мия! Сервер-а занят... Попробуй ещё раз!';
      }
    }

    removeTyping();
    addMario(reply);
    sounds.msgIn();

    // Mario reacts with sounds
    if (currentScenario.mood.includes('грустн') || currentScenario.mood.includes('одинок') || currentScenario.mood === 'разбитый') {
      sounds.sad();
    } else if (currentScenario.mood.includes('счастлив') || currentScenario.mood.includes('весёл') || currentScenario.mood === 'радостный') {
      sounds.happy();
    }

    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    removeTyping();
    addMario('Мама мия! Связь-а потерялась... Попробуй ещё раз!');
    console.error('AI API error:', e);
  }

  waiting = false;
  chatOnline.textContent = '● онлайн';
  chatOnline.style.color = '';
}

// ═══ SEND ═══
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || waiting) return;
  chatInput.value = '';
  askMario(text);
}

btnSend.addEventListener('click', () => { sounds.click(); sendMessage(); });
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); sounds.click(); sendMessage(); }
});

// ═══ CONTROLS ═══
btnNext.addEventListener('click', () => { sounds.click(); loadScenario(); });
btnSound.addEventListener('click', () => {
  const on = sounds.toggle();
  btnSound.textContent = on ? '🔊' : '🔇';
  if (on) sounds.click();
});

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') loadScenario();
});

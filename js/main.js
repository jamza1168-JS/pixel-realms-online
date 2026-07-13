/* ============================================================
 * main.js — Game engine: loop, input, hotkeys, AFK bot,
 *           combat, camera, networking glue, save system
 * ============================================================ */

const SAVE_KEY = 'pixelrealms_save';
const KEYS_KEY = 'pixelrealms_keys';

/* Village healing circle: 10% of max HP per second inside */
const HEAL_RADIUS = 110;
const HEAL_RATE = 0.10;

/* World-boss (dragon) cadence, host-driven. A fixed clock so the whole
 * channel converges on one fight — the strongest "log in at prime time"
 * hook (docs/MONETIZATION.md R1). Kept short for a small player base;
 * raise WORLDBOSS_INTERVAL as the population grows. */
const WORLDBOSS_INTERVAL = 20 * 60;   // seconds between spawns (after a kill / at start)
const WORLDBOSS_WARN     = 5 * 60;    // announce this long before it appears
const MINIBOSS_RESPAWN   = 10 * 60;   // ogre miniboss respawn delay

/* Stable anonymous id for the leaderboard */
let PID = localStorage.getItem('pixelrealms_pid');
if (!PID) {
  PID = 'p' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('pixelrealms_pid', PID);
}

/* ---------------- Rebindable hotkeys ---------------- */
const KEY_ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'skill1', 'skill2', 'skill3', 'quick1', 'quick2', 'quick3', 'panel', 'afk'];

const DEFAULT_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  attack: 'Space', skill1: 'Digit1', skill2: 'Digit2', skill3: 'Digit3',
  quick1: 'Digit4', quick2: 'Digit5', quick3: 'Digit6',
  panel: 'KeyC', afk: 'KeyF',
};

function loadKeys() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS_KEY));
    if (raw) {
      const src = raw.up ? raw : raw['1'];   // migrate old per-player format
      if (src && src.up) return Object.assign({}, DEFAULT_KEYS, src);
    }
  } catch (e) { /* fall through */ }
  return Object.assign({}, DEFAULT_KEYS);
}

let KEYS = loadKeys();

function saveKeys() {
  localStorage.setItem(KEYS_KEY, JSON.stringify(KEYS));
}

function resetKeys() {
  KEYS = Object.assign({}, DEFAULT_KEYS);
  saveKeys();
}

/* Human-readable label for a KeyboardEvent.code */
function prettyKey(code) {
  if (!code) return '—';
  const special = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';',
    Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`',
    Minus: '-', Equal: '=', Space: 'SPACE', Enter: '↵', Tab: 'TAB',
    ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
  };
  if (special[code]) return special[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

/* ---------------- Input ---------------- */
const keys = new Set();

function readInput() {
  const m = KEYS;
  return {
    mx: (keys.has(m.right) ? 1 : 0) - (keys.has(m.left) ? 1 : 0),
    my: (keys.has(m.down) ? 1 : 0) - (keys.has(m.up) ? 1 : 0),
    attack: keys.has(m.attack),
    skills: [keys.has(m.skill1), keys.has(m.skill2), keys.has(m.skill3)],
  };
}

/* ---------------- AFK auto-farm focus ---------------- */
/* What the bot hunts: boss and/or monsters (both on by default). */
const AFK_KEY = 'pixelrealms_afk';
const AFK_FOCUS = { boss: true, monster: true };
try { Object.assign(AFK_FOCUS, JSON.parse(localStorage.getItem(AFK_KEY)) || {}); } catch (e) { /* defaults */ }
function saveAfkFocus() { localStorage.setItem(AFK_KEY, JSON.stringify(AFK_FOCUS)); }

/* ---------------- Tiny synth SFX ---------------- */
const SOUND_KEY = 'pixelrealms_sound';
const SOUND = { vol: 1, muted: false };
try { Object.assign(SOUND, JSON.parse(localStorage.getItem(SOUND_KEY)) || {}); } catch (e) { /* defaults */ }

function saveSound() {
  localStorage.setItem(SOUND_KEY, JSON.stringify(SOUND));
}

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq, dur, type = 'square', vol = 0.06, endFreq = null) {
  if (!audioCtx || SOUND.muted || SOUND.vol <= 0) return;
  const o = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), audioCtx.currentTime + dur);
  gain.gain.setValueAtTime(vol * SOUND.vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.connect(gain).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur + 0.02);
}

const SFX = {
  hit:    () => beep(220, 0.08, 'square', 0.05, 90),
  swing:  () => beep(320, 0.06, 'triangle', 0.04, 160),
  shoot:  () => beep(620, 0.07, 'square', 0.04, 300),
  hurt:   () => beep(150, 0.16, 'sawtooth', 0.06, 60),
  skill:  () => beep(500, 0.1, 'square', 0.05, 900),
  pickup: () => beep(800, 0.09, 'sine', 0.06, 1300),
  gold:   () => beep(1100, 0.06, 'sine', 0.05),
  heal:   () => beep(520, 0.18, 'sine', 0.05, 780),
  buff:   () => beep(400, 0.15, 'triangle', 0.05, 620),
  point:  () => beep(700, 0.05, 'square', 0.05),
  die:    () => beep(120, 0.4, 'sawtooth', 0.07, 40),
  levelup:() => { beep(520, 0.1, 'square', 0.06); setTimeout(() => beep(660, 0.1, 'square', 0.06), 100); setTimeout(() => beep(880, 0.2, 'square', 0.06), 200); },
  // shimmering fanfare for a rare (Legend / Mystic) drop
  legendary:() => {
    beep(880, 0.12, 'sine', 0.07, 1200);
    setTimeout(() => beep(1320, 0.12, 'sine', 0.07, 1600), 90);
    setTimeout(() => beep(1760, 0.26, 'sine', 0.08, 2300), 180);
    setTimeout(() => beep(2640, 0.18, 'triangle', 0.05, 3000), 300);
  },
};

/* ============================================================ */

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.g = this.canvas.getContext('2d');
    this.world = new World();
    this.net = new LocalNet();
    this.players = [];
    this.remotePlayers = new Map();   // clientId -> [RemotePlayer,...]
    this.ghosts = new Map();          // spawn idx -> ghost Enemy (client mode)
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.effects = [];
    this.floatTexts = [];
    this.trade = null;          // active trade state
    this.pendingTrade = null;   // incoming trade request
    this.mouse = { x: 0, y: 0, seen: false };   // cursor (screen coords) for aiming
    window.addEventListener('pointermove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.seen = true;
    });
    this.cam = { x: 0, y: 0 };
    this.time = 0;
    this.saveT = 0;
    this.running = false;
    this.lastT = 0;
    // world-boss timer (host-owned; counts down only while no dragon is alive)
    this.worldBossT = WORLDBOSS_INTERVAL;
    this.worldBossWarned = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.g.imageSmoothingEnabled = false;
  }

  /* The player's PUBLIC name shown in-game (never the private username).
   * Signed in → the account's unique hero name; guests → their local name. */
  heroName() {
    if (Account.loggedIn && Account.heroName) return Account.heroName;
    return (this.net && this.net.name) || localStorage.getItem('pixelrealms_name') || 'Hero';
  }

  addPlayer(id, clsId, saved) {
    const p = new Player(id, clsId, this);
    p.name = this.heroName();
    if (saved) {
      p.level = saved.level;
      p.xp = saved.xp;
      p.statPoints = saved.statPoints;
      p.gold = saved.gold;
      p.kills = saved.kills || 0;
      p.bossKills = saved.bossKills || 0;
      p.stats = Object.assign({}, saved.stats);
      if (Array.isArray(saved.inventory)) {
        p.inventory = saved.inventory.map(itemFromSave).filter(Boolean);
      }
      if (Array.isArray(saved.storage)) {
        p.storage = saved.storage.map(itemFromSave).filter(Boolean);
      }
      if (saved.equip) {
        for (const slot of EQUIP_SLOTS) {
          const it = itemFromSave(saved.equip[slot]);
          if (it && slotAccepts(slot, it)) p.equip[slot] = it;
        }
      }
      if (Array.isArray(saved.quickItems)) {
        p.quickItems = [0, 1, 2].map(i => (POTIONS[saved.quickItems[i]] ? saved.quickItems[i] : null));
      }
      const d = p.derived;
      p.hp = d.maxHp; p.mp = d.maxMp;
    }
    this.players.push(p);
    UI.buildSkillbar(p);
    return p;
  }

  start() {
    this.running = true;
    this.cam.x = this.world.spawnX - this.canvas.width / 2;
    this.cam.y = this.world.spawnY - this.canvas.height / 2;
    this.lastT = performance.now();
    requestAnimationFrame(ts => this.loop(ts));
    setTimeout(() => UI.toast(t('ui.bossWarn'), 'info'), 2500);

    // AFK farming must survive a hidden/minimized tab, where
    // requestAnimationFrame stops. This ticker detects a stalled
    // rAF loop and steps the simulation (rendering skipped).
    this.bgTicker = setInterval(() => {
      const now = performance.now();
      if (!this.running || now - this.lastT < 250) return;
      let steps = Math.min(20, Math.floor((now - this.lastT) / 50));
      this.lastT = now;
      while (steps-- > 0) this.update(0.05);
    }, 250);
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.lastT) / 1000);
    this.lastT = ts;
    this.update(dt);
    this.draw();
    requestAnimationFrame(t2 => this.loop(t2));
  }

  /* All possible enemy targets: local + remote living players */
  allTargets() {
    const arr = [];
    for (const p of this.players) if (!p.dead) arr.push(p);
    for (const [, list] of this.remotePlayers) {
      for (const rp of list) if (!rp.dead) arr.push(rp);
    }
    return arr;
  }

  playerNear(x, y, r) {
    return this.allTargets().some(p => Math.hypot(p.x - x, p.y - y) < r);
  }

  /* ---------------- Update ---------------- */
  update(dt) {
    this.time += dt;

    for (const p of this.players) {
      const manual = readInput();
      const manualActive = manual.mx !== 0 || manual.my !== 0 || manual.attack ||
                           manual.skills[0] || manual.skills[1] || manual.skills[2];
      // AFK mode yields to the player: any pressed key takes over,
      // the bot resumes as soon as the keys are released
      const useBot = p.afk && !manualActive;
      const input = useBot ? this.botInput(p, dt) : manual;
      if (!useBot && this.mouse.seen) {
        // manual play aims at the mouse cursor (the bot aims itself)
        const dx = this.mouse.x + this.cam.x - p.x;
        const dy = this.mouse.y + this.cam.y - (p.y - 14);
        const len = Math.hypot(dx, dy);
        if (len > 4) input.face = { x: dx / len, y: dy / len };
      }
      p.update(dt, input);
    }
    for (const [, list] of this.remotePlayers) {
      for (const rp of list) rp.update(dt);
    }

    // village healing circle: 10% max HP per second
    for (const p of this.players) {
      if (p.dead) continue;
      if (Math.hypot(p.x - this.world.spawnX, p.y - this.world.spawnY) < HEAL_RADIUS) {
        const d = p.derived;
        if (p.hp < d.maxHp) {
          this.healEntity(p, d.maxHp * HEAL_RATE * dt, true);
          p.healFxT = (p.healFxT || 0) + dt;
          if (p.healFxT > 1) {
            p.healFxT = 0;
            this.addFloatText(p.x, p.y - 46, '+' + Math.round(d.maxHp * HEAL_RATE), '#5ec96a');
          }
        }
      }
    }

    if (this.net.isHost) {
      // authoritative enemy simulation (offline or online-host)
      this.updateWorldBoss(dt);
      for (const sp of this.world.spawnPoints) {
        if (sp.worldboss) continue;    // driven by updateWorldBoss, not here
        if (sp.enemy && sp.enemy.dead) {
          sp.enemy = null;
          sp.respawnT = sp.miniboss ? MINIBOSS_RESPAWN : (sp.boss ? 120 : 12);
        }
        if (!sp.enemy) {
          sp.respawnT -= dt;
          if (sp.respawnT <= 0 && this.playerNear(sp.x, sp.y, 900)) {
            sp.enemy = new Enemy(sp, this);
            this.enemies.push(sp.enemy);
          }
        }
      }
      for (const e of this.enemies) {
        if (!e.dead && this.playerNear(e.x, e.y, 1000)) e.update(dt);
      }
    } else {
      // client mode: enemies are ghosts driven by host snapshots
      for (const [i, e] of this.ghosts) {
        if (e.dead) { this.ghosts.delete(i); continue; }
        e.netTick(dt);
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    this.projectiles = this.projectiles.filter(pr => pr.update(dt, this));
    this.pickups = this.pickups.filter(pk => pk.update(dt, this));

    this.updateChests();
    this.updatePortals();

    // effects (auras heal)
    for (const fx of this.effects) {
      fx.t = (fx.t || 0) + dt;
      if (fx.type === 'aura' && fx.healPerSec) {
        for (const p of this.players) {
          if (!p.dead && Math.hypot(p.x - fx.x, p.y - fx.y) < fx.r) {
            this.healEntity(p, fx.healPerSec * dt, true);
          }
        }
      }
    }
    this.effects = this.effects.filter(fx => fx.t < fx.dur);

    for (const ft of this.floatTexts) { ft.t += dt; ft.y -= 28 * dt; }
    this.floatTexts = this.floatTexts.filter(ft => ft.t < 1);

    // camera: follow midpoint of living local players
    const alive = this.players.filter(p => !p.dead);
    const focus = alive.length ? alive : this.players;
    if (focus.length) {
      let fx = 0, fy = 0;
      for (const p of focus) { fx += p.x; fy += p.y; }
      fx /= focus.length; fy /= focus.length;
      const tx = fx - this.canvas.width / 2;
      const ty = fy - this.canvas.height / 2;
      this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
      this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    }
    this.cam.x = Math.max(0, Math.min(MAP_W * TILE - this.canvas.width, this.cam.x));
    this.cam.y = Math.max(0, Math.min(MAP_H * TILE - this.canvas.height, this.cam.y));

    this.net.sync(this.players);

    // autosave
    this.saveT += dt;
    if (this.saveT > 15) { this.saveT = 0; this.save(); }

    // periodic leaderboard submission
    this.scoreT = (this.scoreT || 0) + dt;
    if (this.scoreT > 45) { this.scoreT = 0; this.submitScores(); }

    UI.update(this);
  }

  /* ---------------- AFK auto-farm bot ---------------- */
  botInput(p, dt) {
    const out = { mx: 0, my: 0, attack: false, skills: [false, false, false], face: null };
    if (p.dead) return out;
    const bs = p.bot || (p.bot = {
      phase: 'hunt', checkT: 0, lastX: p.x, lastY: p.y,
      unstuckT: 0, detour: null, stuckN: 0, avoid: new Map(),
    });
    const d = p.derived;

    // (stat points are never auto-spent — the player allocates them)

    // heal skills whenever hurt
    const hurt = p.hp < d.maxHp * 0.72;
    for (let i = 0; i < 3; i++) {
      const skill = SKILLS[p.cls.skills[i]];
      if (skill.bot && skill.bot.kind === 'heal' && hurt && (p.skillCds[skill.id] || 0) <= 0 && p.mp >= skill.mp) {
        out.skills[i] = true;
      }
    }

    // retreat toward the village when in danger
    if (p.hp < d.maxHp * 0.3) bs.phase = 'retreat';
    if (bs.phase === 'retreat') {
      if (p.hp > d.maxHp * 0.65) {
        bs.phase = 'hunt';
      } else {
        const dv = Math.hypot(p.x - this.world.spawnX, p.y - this.world.spawnY);
        if (dv > HEAL_RADIUS * 0.7) {
          // still on the way: keep running for the circle
          this.botSteer(out, p, this.world.spawnX, this.world.spawnY, bs, dt);
          return out;
        }
        // inside the healing circle: heal up but fight back at chasers
        let target = null, bestD = 260;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dd = Math.hypot(e.x - p.x, e.y - p.y);
          if (dd < bestD) { bestD = dd; target = e; }
        }
        if (target) {
          out.face = { x: (target.x - p.x) / (bestD || 1), y: (target.y - p.y) / (bestD || 1) };
          const range = p.cls.attackType === 'melee' ? 36 : 190;
          if (bestD <= range && this.world.hasLineOfSight(p.x, p.y, target.x, target.y)) {
            out.attack = true;
            for (let i = 0; i < 3; i++) {
              const skill = SKILLS[p.cls.skills[i]];
              if (!skill.bot || skill.bot.kind !== 'atk') continue;
              if ((p.skillCds[skill.id] || 0) > 0 || p.mp < skill.mp) continue;
              if (bestD < skill.bot.range) out.skills[i] = true;
            }
          } else if (Math.hypot(target.x - this.world.spawnX, target.y - this.world.spawnY) < HEAL_RADIUS + 60) {
            // chase only enemies that entered the village edge — never leave the circle
            this.botSteer(out, p, target.x, target.y, bs, dt);
          }
        }
        return out;
      }
    }

    // if boss-focus is OFF and a boss is close, run away from it
    if (!AFK_FOCUS.boss) {
      let boss = null, bd = 420;
      for (const e of this.enemies) {
        if (e.dead || !e.type.boss) continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < bd) { bd = dd; boss = e; }
      }
      if (boss) {
        const ax = p.x - boss.x, ay = p.y - boss.y, l = Math.hypot(ax, ay) || 1;
        this.botSteer(out, p, p.x + (ax / l) * 320, p.y + (ay / l) * 320, bs, dt);
        return out;
      }
    }

    // grab nearby loot first
    let goal = null;
    let bestPk = null, bestPkD = 150;
    for (const pk of this.pickups) {
      const dd = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (dd < bestPkD) { bestPkD = dd; bestPk = pk; }
    }
    if (bestPk) goal = { x: bestPk.x, y: bestPk.y };

    // pick a target enemy suited to our level; prefer ones we can
    // actually hit (line of sight), skip recently-unreachable ones.
    // A nearby boss (when boss-focus is on) takes priority over mobs.
    const maxTier = p.level < 5 ? 1 : p.level < 10 ? 2 : p.level < 16 ? 3 : 4;
    let target = null, bestD = 520, hasLos = true;
    let blocked = null, blockedD = 520;
    let boss = null, bossD = 760, bossLos = true;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if ((bs.avoid.get(e) || 0) > this.time) continue;
      const dd = Math.hypot(e.x - p.x, e.y - p.y);
      const los = this.world.hasLineOfSight(p.x, p.y, e.x, e.y);
      if (e.type.boss) {
        // boss handled separately for priority; requires level & focus
        if (AFK_FOCUS.boss && dd < bossD) { bossD = dd; boss = e; bossLos = los; }
        continue;
      }
      if (!AFK_FOCUS.monster) continue;                 // walk past monsters
      if (e.tier > maxTier && e.state !== 'chase') continue;
      if (los) {
        if (dd < bestD) { bestD = dd; target = e; }
      } else if (dd < blockedD) { blockedD = dd; blocked = e; }
    }
    if (!target && blocked) { target = blocked; bestD = blockedD; hasLos = false; }
    // a boss in range outranks any monster choice
    if (boss) { target = boss; bestD = bossD; hasLos = bossLos; }

    let goalIsTarget = false;
    if (!goal && target) {
      const range = p.cls.attackType === 'melee' ? 36 : 190;
      out.face = { x: (target.x - p.x) / (bestD || 1), y: (target.y - p.y) / (bestD || 1) };
      if (bestD > range || !hasLos) {
        // no line of sight: walk toward it instead of shooting the tree
        goal = { x: target.x, y: target.y };
        goalIsTarget = true;
      } else {
        out.attack = true;
      }
      if (hasLos) {
        // offensive / buff skills
        for (let i = 0; i < 3; i++) {
          const skill = SKILLS[p.cls.skills[i]];
          if (!skill.bot || (p.skillCds[skill.id] || 0) > 0 || p.mp < skill.mp) continue;
          if (skill.bot.kind === 'atk' && bestD < skill.bot.range) out.skills[i] = true;
          if (skill.bot.kind === 'buff' && bestD < 240) out.skills[i] = true;
        }
      }
    } else if (!goal) {
      // roam toward the nearest suitable hunting ground. When boss-focus is on
      // a boss/miniboss lair is a valid destination (walk in to spawn + fight
      // it); the world boss only when it's actually up. Mob grounds respect the
      // level-band tier window as before.
      let bestSp = null, bestSpD = Infinity;
      for (const sp of this.world.spawnPoints) {
        const bossSp = sp.boss || sp.miniboss || sp.worldboss;
        if (bossSp) {
          if (!AFK_FOCUS.boss) continue;
          if (sp.worldboss && !(sp.enemy && !sp.enemy.dead)) continue;   // dragon: only when live
        } else {
          if (!AFK_FOCUS.monster) continue;
          if (sp.tier > maxTier || sp.tier < Math.max(1, maxTier - 1)) continue;
        }
        const dd = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (dd < bestSpD) { bestSpD = dd; bestSp = sp; }
      }
      if (bestSp && bestSpD > 60) goal = { x: bestSp.x, y: bestSp.y };
    }

    if (goal) {
      this.botSteer(out, p, goal.x, goal.y, bs, dt);
      // stuck heading to the same mob for several checks: it's walled
      // in behind trees/rocks — blacklist it and hunt something else
      if (bs.stuckN >= 5 && goalIsTarget) {
        bs.avoid.set(target, this.time + 6);
        bs.stuckN = 0;
        if (bs.avoid.size > 24) {
          for (const [e2, t2] of bs.avoid) if (t2 < this.time) bs.avoid.delete(e2);
        }
      }
    }
    return out;
  }

  /* Is the straight path ahead walkable for `dist` px? */
  botPathClear(p, dx, dy, dist) {
    for (let d = 14; d <= dist; d += 14) {
      if (!this.world.canStand(p.x + dx * d, p.y + dy * d)) return false;
    }
    return true;
  }

  /* Walk toward (gx,gy), steering around obstacles proactively and
   * escalating to a sidestep detour if genuinely stuck. Tuned for dense
   * biome scatter (no road corridors): a short look-ahead + fine angle sweep
   * lets the bot keep weaving through gaps instead of freezing on a wall. */
  botSteer(out, p, gx, gy, bs, dt) {
    bs.checkT += dt;
    if (bs.unstuckT > 0) {
      bs.unstuckT -= dt;
      // bail out of the detour early once the way to the goal is clear again
      const gdx = gx - p.x, gdy = gy - p.y, gl = Math.hypot(gdx, gdy) || 1;
      if (this.botPathClear(p, gdx / gl, gdy / gl, Math.min(40, gl))) { bs.unstuckT = 0; }
      else { out.mx = bs.detour.x; out.my = bs.detour.y; return; }
    }
    const dx = gx - p.x, dy = gy - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    let dirx = dx / dist, diry = dy / dist;
    // proactive routing: if a tree/rock blocks the line, rotate to the clear
    // heading NEAREST the goal. Two passes — a full look-ahead, then a short
    // one — so a partially-open gap still lets us make progress and re-plan.
    const far = Math.min(48, dist), near = Math.min(20, dist);
    const angles = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.9, -1.9, 2.4, -2.4, 3.0];
    if (!this.botPathClear(p, dirx, diry, far)) {
      let picked = false;
      for (const a of angles) {
        const c = Math.cos(a), s = Math.sin(a);
        const nx = dirx * c - diry * s, ny = dirx * s + diry * c;
        if (this.botPathClear(p, nx, ny, far)) { dirx = nx; diry = ny; picked = true; break; }
      }
      if (!picked) {   // nothing clear at range — take any heading open for one step
        for (const a of angles) {
          const c = Math.cos(a), s = Math.sin(a);
          const nx = dirx * c - diry * s, ny = dirx * s + diry * c;
          if (this.botPathClear(p, nx, ny, near)) { dirx = nx; diry = ny; break; }
        }
      }
    }
    out.mx = dirx; out.my = diry;
    if (bs.checkT > 0.4) {
      const moved = Math.hypot(p.x - bs.lastX, p.y - bs.lastY);
      if (moved < 6 && dist > 26) {
        // genuinely stuck: sidestep toward whichever perpendicular is actually
        // open (not a blind sidestep into another wall); back up if boxed in.
        bs.stuckN = (bs.stuckN || 0) + 1;
        const sign = bs.stuckN % 2 ? 1 : -1;
        const a1 = { x: -diry * sign, y: dirx * sign };
        const a2 = { x: diry * sign, y: -dirx * sign };
        bs.detour = this.botPathClear(p, a1.x, a1.y, near) ? a1
                  : this.botPathClear(p, a2.x, a2.y, near) ? a2
                  : { x: -dirx, y: -diry };
        bs.unstuckT = 0.3 + 0.2 * Math.min(4, bs.stuckN);
      } else if (moved >= 6) {
        bs.stuckN = 0;
      }
      bs.checkT = 0;
      bs.lastX = p.x; bs.lastY = p.y;
    }
  }

  toggleAfk(p) {
    p.afk = !p.afk;
    if (!p.afk) p.bot = null;
    UI.toast(t(p.afk ? 'ui.afkOn' : 'ui.afkOff', { name: t('class.' + p.clsId) }), p.afk ? 'gold' : 'info');
    this.sfx(p.afk ? 'buff' : 'point');
  }

  /* ---------------- Combat helpers (used by skills) ---------------- */
  computeBase(p, mult) {
    const d = p.derived;
    return d[p.cls.dmgStat] * mult * p.buffMul('dmgMul') * (d.dmgMul || 1);
  }

  applyHit(owner, e, dmg, color) {
    let final = dmg;
    let crit = false;
    if (owner && Math.random() * 100 < owner.derived.crit) {
      final *= 1.75;
      crit = true;
    }
    final = Math.round(final * (0.9 + Math.random() * 0.2));

    e.lastLocalOwner = owner;   // kill credit for the leaderboard
    if (this.net.isOnline && !this.net.isHost && e.remote) {
      // predicted hit; host is authoritative
      e.hp = Math.max(1, e.hp - final);
      this.net.sendHit(e.idx, final);
    } else {
      e.takeDamage(final, owner);
    }
    this.addFloatText(e.x, e.y - 40, (crit ? '✦' : '') + final, crit ? '#ffd75e' : (color || '#fff'));
    this.addEffect({ type: 'spark', x: e.x, y: e.y - 16, dur: 0.15, color: color || '#fff', r: 10 });
    this.sfx('hit');
  }

  dealDamage(owner, e, mult, color) {
    this.applyHit(owner, e, this.computeBase(owner, mult), color);
  }

  /* Enemy → player damage, routed to the right machine. */
  damagePlayer(target, amount) {
    if (target.isRemote) {
      if (this.net.isOnline && this.net.isHost) this.net.sendPdmg(target.netKey, amount);
    } else {
      target.takeDamage(amount);
    }
  }

  meleeArc(p, range, mult, color) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      const eR = 16 * (e.type.scale / 3);
      if (dist > range + eR) continue;
      const dot = (dx * p.face.x + dy * p.face.y) / (dist || 1);
      if (dot > 0.15 || dist < 24) this.dealDamage(p, e, mult, color);
    }
  }

  aoeDamage(p, x, y, r, mult, color, opts = {}) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < r + 16 * (e.type.scale / 3)) {
        this.dealDamage(p, e, mult, color);
        if (opts.slow) e.slowT = Math.max(e.slowT, opts.slow);
      }
    }
  }

  nearestEnemies(x, y, r, n) {
    return this.enemies
      .filter(e => !e.dead && Math.hypot(e.x - x, e.y - y) < r)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
      .slice(0, n);
  }

  spawnProjectile(p, mult, opts = {}) {
    let ang = Math.atan2(p.face.y, p.face.x);
    // aim assist: snap to nearest enemy within a cone
    const targets = this.nearestEnemies(p.x, p.y, 340, 5);
    for (const e of targets) {
      const ta = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = ta - ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.5) { ang = ta; break; }
    }
    ang += opts.angleOffset || 0;
    const speed = opts.speed || 380;
    this.projectiles.push(new Projectile({
      x: p.x + Math.cos(ang) * 14,
      y: p.y - 14 + Math.sin(ang) * 14,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      dmg: this.computeBase(p, mult),
      team: 'player', owner: p,
      color: opts.color || '#fff', size: opts.size || 4,
      pierce: !!opts.pierce, aoe: opts.aoe || 0,
    }));
  }

  spawnEnemyProjectile(e, target) {
    const ang = Math.atan2((target.y - 14) - (e.y - 14), target.x - e.x);
    const speed = e.type.boss ? 260 : 220;
    const proj = {
      x: e.x, y: e.y - 14,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      dmg: e.dmg, boss: e.type.boss ? 1 : 0,
    };
    this.spawnNetEnemyProjectile(proj);
    if (this.net.isOnline && this.net.isHost) this.net.sendEproj(proj);
  }

  spawnNetEnemyProjectile(m) {
    this.projectiles.push(new Projectile({
      x: m.x, y: m.y, vx: m.vx, vy: m.vy,
      dmg: m.dmg, team: 'enemy',
      color: m.boss ? '#ff5030' : '#c9b8a0',
      size: m.boss ? 7 : 4, life: 2.2,
    }));
    this.sfx('shoot');
  }

  explode(proj) {
    this.aoeDamage(proj.owner, proj.x, proj.y + 14, proj.aoe, 1, proj.color);
    this.addEffect({ type: 'ring', x: proj.x, y: proj.y, dur: 0.3, color: proj.color, r: proj.aoe });
    this.sfx('hit');
  }

  healEntity(p, amount, quiet) {
    const d = p.derived;
    const healed = Math.min(d.maxHp - p.hp, amount);
    if (healed <= 0) return;   // tiny per-frame ticks must still apply (heal circle, auras)
    p.hp += healed;
    if (!quiet && healed >= 1) this.addFloatText(p.x, p.y - 40, '+' + Math.round(healed), '#5ec96a');
  }

  /* ---------------- Stat allocation ---------------- */
  /* Spend every unspent point following the class's recommended build. */
  recommendStats(p) {
    if (p.statPoints <= 0) return;
    const pool = BOT_STAT_PRIORITY[p.clsId];
    while (p.statPoints > 0) {
      p.stats[pool[Math.floor(Math.random() * pool.length)]]++;
      p.statPoints--;
    }
    this.sfx('point');
    this.save();
  }

  /* Back to the class base build; refund all points earned by leveling. */
  resetStats(p) {
    p.stats = Object.assign({}, p.cls.base);
    p.statPoints = (p.level - 1) * POINTS_PER_LEVEL;
    const d = p.derived;
    p.hp = Math.min(p.hp, d.maxHp);
    p.mp = Math.min(p.mp, d.maxMp);
    this.sfx('buff');
    this.save();
  }

  /* ---------------- Networking glue ---------------- */
  /* Signing in drops the player straight into the shared public World;
   * there is no manual server address, room, or password any more. */
  goOnline(name) {
    if (this.net instanceof WSNet) this.net.disconnect();   // also kills a pending 'connecting' socket
    const net = new WSNet(this);
    this.net = net;
    net.connect(serverUrl(), '', name, '', true);
    for (const p of this.players) p.name = name;   // reflect the name at once
    return net;
  }

  /* Join the shared World, retrying on `name_taken`. Hero names are globally
   * unique per account, so that error can only be the just-closed session's
   * name lingering server-side (a warp round-trip or a page-refresh race) —
   * a short backoff lets the old socket's cleanup free it. */
  rejoinOnline(name, attempt = 0) {
    const net = this.goOnline(name);
    net.onNameTaken = () => {
      if (this.world.mapId !== 'hub' || this.net !== net) return;   // no longer relevant
      if (attempt < 6) {
        setTimeout(() => {
          if (this.world.mapId === 'hub' && (this.net === net || !this.net.isOnline)) {
            this.rejoinOnline(name, attempt + 1);
          }
        }, 800 + attempt * 400);
      } else {
        UI.toast(t('online.nameTaken'), 'info');
      }
    };
  }

  goOffline() {
    this.net.disconnect();
    this.onNetDisconnect();
  }

  onNetDisconnect() {
    this.remotePlayers.clear();
    this.ghosts.clear();
    if (this.trade) this.returnTradeEscrow(this.trade);
    this.trade = null;
    this.pendingTrade = null;
    UI.hideTradeRequest();
    UI.closeTrade();
    // reset enemy simulation locally
    this.enemies = [];
    for (const sp of this.world.spawnPoints) {
      sp.enemy = null;
      sp.respawnT = 1 + Math.random() * 4;
    }
    this.net = new LocalNet();
    this.net.sync(this.players);
    UI.updateOnlinePanel();
  }

  /* Client mode: stop simulating, wait for host snapshots. */
  clearEnemiesForClientMode() {
    this.enemies = [];
    this.ghosts.clear();
    for (const sp of this.world.spawnPoints) sp.enemy = null;
  }

  /* Promoted to host: adopt current ghosts as real enemies. */
  becomeHost() {
    for (const [i, e] of this.ghosts) {
      e.remote = false;
      const sp = this.world.spawnPoints[i];
      if (sp) sp.enemy = e;
    }
    this.ghosts.clear();
    for (const sp of this.world.spawnPoints) {
      if (!sp.enemy) sp.respawnT = sp.boss ? 60 : 4 + Math.random() * 8;
    }
    UI.toast('★ ' + t('online.host'), 'info');
  }

  /* Host-only: drive the dragon world boss on a fixed clock. The timer
   * counts down only while no dragon is alive; it announces a warning to the
   * whole channel, then spawns the boss at its lair for everyone to converge
   * on. On death the cycle resets (see handleEnemyDead → resetWorldBoss). */
  updateWorldBoss(dt) {
    const sp = this.world.worldBossSpawn;
    if (!sp) return;
    if (sp.enemy) {
      if (!sp.enemy.dead) return;          // fight in progress — pause clock
      this.resetWorldBoss();               // safety net if death path missed it
      return;
    }
    this.worldBossT -= dt;
    if (!this.worldBossWarned && this.worldBossT <= WORLDBOSS_WARN) {
      this.worldBossWarned = true;
      this.announceWorldBoss('warn');
    }
    if (this.worldBossT <= 0) {
      sp.enemy = new Enemy(sp, this);
      this.enemies.push(sp.enemy);
      this.announceWorldBoss('spawn');
    }
  }

  resetWorldBoss() {
    const sp = this.world.worldBossSpawn;
    if (sp) sp.enemy = null;
    this.worldBossT = WORLDBOSS_INTERVAL;
    this.worldBossWarned = false;
  }

  /* Broadcast a world-boss notice to the whole channel (host authors it;
   * clients receive it as a system chat line). */
  announceWorldBoss(kind) {
    const text = t(kind === 'warn' ? 'ui.worldBossWarn' : 'ui.worldBossHere');
    UI.addChat('★', text);
    UI.toast(text, 'gold');
    this.sfx(kind === 'spawn' ? 'legendary' : 'levelup');
    if (this.net.isOnline && this.net.isHost) this.net.send({ t: 'chat', text, sys: 1 });
  }

  applyRemoteState(from, states) {
    if (!from || from === this.net.id) return;
    let list = this.remotePlayers.get(from);
    if (!list) { list = []; this.remotePlayers.set(from, list); }
    for (const s of states) {
      if (!list[s.k]) {
        const peer = this.net.peers.get(from);
        list[s.k] = new RemotePlayer(from, s.k, (peer ? peer.name : '?') + (s.k > 0 ? ' ·2' : ''));
      }
      list[s.k].applyState(s);
    }
    if (list.length > states.length) list.length = states.length;
  }

  applyEnemySnapshot(snapList) {
    const seen = new Set();
    for (const s of snapList) {
      seen.add(s.i);
      let e = this.ghosts.get(s.i);
      if (!e) {
        const sp = this.world.spawnPoints[s.i];
        if (!sp) continue;
        e = new Enemy(sp, this);
        e.remote = true;
        e.x = s.x; e.y = s.y;
        this.ghosts.set(s.i, e);
        this.enemies.push(e);
      }
      e.netTarget(s);
    }
    for (const [i, e] of this.ghosts) {
      if (!seen.has(i)) {
        e.unseenT++;
        if (e.unseenT > 25) e.dead = true;   // ~2.5s unseen → cull
      }
    }
  }

  applyNetHit(idx, dmg, from) {
    const sp = this.world.spawnPoints[idx];
    const e = sp && sp.enemy;
    if (e && !e.dead) {
      this.addFloatText(e.x, e.y - 40, dmg, '#c8d8ff');
      e.takeDamage(dmg, from);
    }
  }

  /* ---------------- Chat ---------------- */
  myName() { return this.net.name || 'P1'; }

  sendChat(text) {
    text = text.trim().slice(0, 80);
    if (!text) return;
    UI.addChat(this.net.isOnline ? this.myName() : t('chat.you'), text, true);
    if (this.players[0]) this.players[0].bubble = { text, ttl: 5 };
    if (this.net.isOnline) this.net.send({ t: 'chat', text });
  }

  onChat(m) {
    if (m.sys) {   // system broadcast (e.g. world-boss notice) — no player bubble
      const text = String(m.text).slice(0, 120);
      UI.addChat('★', text);
      UI.toast(text, 'gold');
      this.sfx('point');
      return;
    }
    const peer = this.net.peers.get(m.from);
    const name = peer ? peer.name : '?';
    UI.addChat(name, String(m.text).slice(0, 80));
    const list = this.remotePlayers.get(m.from);
    if (list && list[0]) list[0].bubble = { text: String(m.text).slice(0, 80), ttl: 5 };
    this.sfx('point');
  }

  /* ---------------- Trading ---------------- */
  myKey(p) { return (this.net.id || 'local') + ':' + (p.id - 1); }

  openTradeWith(fromPlayer, targetKey, targetName) {
    if (this.trade || !this.net.isOnline) return;
    this.trade = {
      stage: 'waiting', me: fromPlayer, withKey: targetKey, withName: targetName,
      myGold: 0, theirGold: 0, myItems: [], theirItems: [], myAccept: false, theirAccept: false,
    };
    this.net.send({ t: 'trade_req', to: targetKey, fromKey: this.myKey(fromPlayer), name: this.myName() });
    UI.renderTrade(this);
  }

  onTradeMsg(m) {
    const tr = this.trade;
    switch (m.t) {
      case 'trade_req': {
        if (this.trade || this.pendingTrade) {
          this.net.send({ t: 'trade_no', to: m.fromKey, fromKey: m.to });
          return;
        }
        const k = +m.to.split(':')[1];
        this.pendingTrade = { fromKey: m.fromKey, name: m.name, player: this.players[k] || this.players[0] };
        UI.showTradeRequest(this.pendingTrade);
        this.sfx('pickup');
        break;
      }
      case 'trade_ok':
        if (tr && tr.stage === 'waiting' && m.fromKey === tr.withKey) {
          tr.stage = 'open';
          UI.openTradePanel();
        }
        break;
      case 'trade_no':
        if (tr && tr.stage === 'waiting' && m.fromKey === tr.withKey) {
          this.trade = null;
          UI.renderTrade(this);
          UI.toast(t('trade.declined'), 'info');
        }
        break;
      case 'trade_set':
        if (tr && tr.stage === 'open' && m.fromKey === tr.withKey) {
          tr.theirGold = Math.max(0, Math.floor(+m.gold || 0));
          tr.theirItems = Array.isArray(m.items) ? m.items.map(itemFromSave).filter(Boolean) : [];
          tr.theirAccept = false;
          // offer changed: my accept must be re-confirmed too
          if (tr.myAccept) {
            tr.myAccept = false;
            this.net.send({ t: 'trade_accept', to: tr.withKey, fromKey: this.myKey(tr.me), accepted: false });
          }
          UI.renderTrade(this);
        }
        break;
      case 'trade_accept':
        if (tr && tr.stage === 'open' && m.fromKey === tr.withKey) {
          tr.theirAccept = !!m.accepted;
          this.checkTradeDone();
          if (this.trade) UI.renderTrade(this);
        }
        break;
      case 'trade_cancel':
        if (tr && m.fromKey === tr.withKey) {
          this.returnTradeEscrow(tr);
          this.trade = null;
          UI.renderTrade(this);
          UI.closeTrade();
          UI.toast(t('trade.cancelled'), 'info');
        }
        if (this.pendingTrade && m.fromKey === this.pendingTrade.fromKey) {
          this.pendingTrade = null;
          UI.hideTradeRequest();
        }
        break;
    }
  }

  answerTradeRequest(yes) {
    const pt = this.pendingTrade;
    if (!pt) return;
    this.pendingTrade = null;
    UI.hideTradeRequest();
    if (!yes) {
      this.net.send({ t: 'trade_no', to: pt.fromKey, fromKey: this.myKey(pt.player) });
      return;
    }
    this.trade = {
      stage: 'open', me: pt.player, withKey: pt.fromKey, withName: pt.name,
      myGold: 0, theirGold: 0, myItems: [], theirItems: [], myAccept: false, theirAccept: false,
    };
    this.net.send({ t: 'trade_ok', to: pt.fromKey, fromKey: this.myKey(pt.player) });
    UI.openTradePanel();
  }

  setTradeGold(n) {
    const tr = this.trade;
    if (!tr || tr.stage !== 'open' || tr.myAccept) return;
    tr.myGold = Math.max(0, Math.min(tr.me.gold, Math.floor(+n) || 0));
    this.sendTradeOffer();
  }

  /* Broadcast my current offer (gold + items). Any change resets accepts
   * (the receiver clears theirs; anti-scam mirror of the gold path). */
  sendTradeOffer() {
    const tr = this.trade;
    if (!tr || tr.stage !== 'open') return;
    this.net.send({ t: 'trade_set', to: tr.withKey, fromKey: this.myKey(tr.me),
      gold: tr.myGold, items: tr.myItems.map(itemToSave) });
    UI.renderTrade(this);
  }

  /* Escrow one item from my bag into the offer (removed from the bag so it
   * can't be used or duped mid-trade). Potions move one at a time. */
  addTradeItem(item) {
    const tr = this.trade;
    if (!tr || tr.stage !== 'open' || tr.myAccept) return;
    const p = tr.me;
    if (!p.inventory.includes(item)) return;
    if (tr.myItems.length >= 15 && !(item.kind === 'potion')) return;
    if (item.kind === 'potion') {
      p._removeFrom(p.inventory, item, 1);
      const stack = tr.myItems.find(i => i.kind === 'potion' && i.key === item.key);
      if (stack) stack.count += 1;
      else tr.myItems.push({ uid: itemUid(), key: item.key, kind: 'potion', count: 1 });
    } else {
      p._removeFrom(p.inventory, item, 1);
      tr.myItems.push(item);
    }
    this.sendTradeOffer();
  }

  /* Pull one item back out of my offer and into my bag. */
  removeTradeItem(item) {
    const tr = this.trade;
    if (!tr || tr.stage !== 'open' || tr.myAccept) return;
    const p = tr.me;
    const idx = tr.myItems.indexOf(item);
    if (idx < 0) return;
    if (item.kind === 'potion') {
      p._addTo(p.inventory, { uid: itemUid(), key: item.key, kind: 'potion', count: 1 });
      if ((item.count || 1) > 1) item.count -= 1;
      else tr.myItems.splice(idx, 1);
    } else {
      tr.myItems.splice(idx, 1);
      p._addTo(p.inventory, item);
    }
    this.sendTradeOffer();
  }

  /* Return every escrowed item to the bag (trade aborted). */
  returnTradeEscrow(tr) {
    if (!tr || !tr.myItems) return;
    for (const it of tr.myItems) {
      if (it.kind === 'potion') tr.me._addTo(tr.me.inventory, { uid: itemUid(), key: it.key, kind: 'potion', count: it.count || 1 });
      else tr.me._addTo(tr.me.inventory, it);
    }
    tr.myItems = [];
  }

  toggleTradeAccept() {
    const tr = this.trade;
    if (!tr || tr.stage !== 'open') return;
    tr.myAccept = !tr.myAccept;
    this.net.send({ t: 'trade_accept', to: tr.withKey, fromKey: this.myKey(tr.me), accepted: tr.myAccept });
    this.checkTradeDone();
    if (this.trade) UI.renderTrade(this);
  }

  checkTradeDone() {
    const tr = this.trade;
    if (tr && tr.stage === 'open' && tr.myAccept && tr.theirAccept) {
      tr.stage = 'done';
      tr.me.gold = Math.max(0, tr.me.gold + tr.theirGold - tr.myGold);
      // my offered items are already escrowed out of the bag; take in theirs
      for (const it of tr.theirItems) tr.me.addItem(it);
      tr.me.clampVitals();
      this.trade = null;
      UI.renderTrade(this);
      UI.closeTrade();
      UI.toast(t('trade.done'));
      this.sfx('gold');
      this.save();
    }
  }

  cancelTrade() {
    const tr = this.trade;
    if (!tr) return;
    this.returnTradeEscrow(tr);
    this.net.send({ t: 'trade_cancel', to: tr.withKey, fromKey: this.myKey(tr.me) });
    this.trade = null;
    UI.renderTrade(this);
  }

  onPeerLeft(clientId) {
    if (this.trade && this.trade.withKey.indexOf(clientId + ':') === 0) {
      this.returnTradeEscrow(this.trade);
      this.trade = null;
      UI.renderTrade(this);
      UI.closeTrade();
      UI.toast(t('trade.cancelled'), 'info');
    }
    if (this.pendingTrade && this.pendingTrade.fromKey.indexOf(clientId + ':') === 0) {
      this.pendingTrade = null;
      UI.hideTradeRequest();
    }
  }

  /* ---------------- Events ---------------- */
  onEnemyDeath(e, from) {
    const killer = (typeof from === 'string') ? from : (this.net.id || 'local');
    if (this.net.isOnline && this.net.isHost) {
      this.net.sendEdead({ i: e.idx, xp: e.xp, x: Math.round(e.x), y: Math.round(e.y), killer, boss: e.type.boss ? 1 : 0 });
    }
    this.handleEnemyDead(e.idx, e.xp, e.x, e.y, killer, e.type.boss, (from instanceof Player) ? from : null);
  }

  handleEnemyDead(idx, xp, x, y, killer, isBoss, localKiller) {
    // clear ghost if we track one
    const gh = this.ghosts.get(idx);
    if (gh) { gh.dead = true; this.ghosts.delete(idx); }

    // XP: full for the killer, 60% for nearby party members
    const weKilled = killer === (this.net.id || 'local');

    // mob-kill counter for the leaderboard
    let killerPlayer = localKiller;
    if (!killerPlayer && weKilled) killerPlayer = (gh && gh.lastLocalOwner) || this.players[0];
    if (killerPlayer) {
      killerPlayer.kills++;
      if (isBoss) killerPlayer.bossKills++;
    }

    for (const p of this.players) {
      if (p.dead) continue;
      const full = localKiller ? p === localKiller : weKilled;
      const near = Math.hypot(p.x - x, p.y - y) < 700;
      if (full) p.gainXp(xp);
      else if (near) p.gainXp(Math.round(xp * 0.6));
    }

    this.addEffect({ type: 'ring', x, y: y - 12, dur: 0.3, color: '#fff', r: 20 });
    this.addFloatText(x, y - 52, '+' + xp + ' XP', '#b45eff');
    this.sfx('die');

    // drops are local: everyone gets their own loot. Elite/miniboss/boss/
    // worldboss follow the archetype loot profile (guaranteed, more rolls,
    // stronger rarity bias, extra gold); normal mobs use the tier default.
    if (this.playerNearLocal(x, y, 650)) {
      const roll = Math.random();
      if (roll < 0.3) this.pickups.push(new Pickup('heart', x - 10, y, 0.25));
      else if (roll < 0.5) this.pickups.push(new Pickup('orb', x - 10, y, 0.35));
      const sp = this.world.spawnPoints[idx];
      const type = ENEMY_TYPES[sp ? sp.type : 'slime'];
      const tier = sp ? sp.tier : 1;
      const prof = lootProfile(type, sp && sp.elite);

      const [gMin, gMax] = type.gold;
      const gold = Math.round((gMin + Math.floor(Math.random() * (gMax - gMin + 1))) * prof.gold);
      this.pickups.push(new Pickup('coin', x + 10, y, gold));

      // tier is constrained per archetype (legend = boss-only, mystic =
      // worldboss-only, bosses never drop common/rare) via prof.tiers.
      const dropChance = prof.chance != null ? prof.chance : 0.05 + tier * 0.02;
      const ilvl = tier * 4 + prof.ilvl;
      for (let r = 0; r < prof.rolls; r++) {
        if (Math.random() >= dropChance) continue;
        const item = rollItem({ ilvl, tierWeights: prof.tiers, classHint: this.players[0] && this.players[0].clsId });
        this.pickups.push(new Pickup('gear', x + (Math.random() * 30 - 15), y + 6, item));
        // fanfare + a callout toast when something truly rare drops
        if (item.tier === 'legend' || item.tier === 'mystic') {
          this.sfx('legendary');
          this.addEffect({ type: 'ring', x, y: y - 12, dur: 0.6, color: itemColor(item), r: 46 });
          UI.toast(itemIcon(item) + ' ' + t('inv.rareDrop', { name: itemName(item) }), 'gold');
        }
      }

      // refine ore (Phase 2b): archetypes drop a guaranteed batch; tier-4
      // normal mobs have a small chance. Carried by a 'gear' pickup (which
      // addItem-stacks materials on collect).
      let oreN = prof.ore || 0;
      if (!oreN && tier >= 4 && Math.random() < 0.10) oreN = 1;
      if (oreN > 0) this.pickups.push(new Pickup('gear', x - (Math.random() * 24 + 6), y + 6, makeMaterial('ore', oreN)));

      // chest keys (Phase 2c): guaranteed from mini/boss/worldboss, ~15%
      // from elites. Keys open treasure chests found out in the world.
      const keyN = (type.miniboss || type.boss || type.worldboss) ? 1
        : (sp && sp.elite && Math.random() < 0.15) ? 1 : 0;
      if (keyN > 0) this.pickups.push(new Pickup('gear', x + (Math.random() * 24 + 6), y - 4, makeMaterial('key', keyN)));

      // Awakening Stone (P5a): boss-only chase drop (~5% boss, ~12% worldboss).
      const stoneChance = type.worldboss ? 0.12 : (type.boss ? 0.05 : 0);
      if (stoneChance && Math.random() < stoneChance) {
        this.pickups.push(new Pickup('gear', x + (Math.random() * 20 - 10), y - 8, makeMaterial('stone', 1)));
      }
    }

    if (isBoss) {
      const sp = this.world.spawnPoints[idx];
      const type = ENEMY_TYPES[sp ? sp.type : 'demon'];
      if (type.worldboss) {
        this.resetWorldBoss();
        UI.toast(t('ui.worldBossDown'), 'gold');
        UI.addChat('★', t('ui.worldBossDown'));
        if (this.net.isOnline && this.net.isHost) this.net.send({ t: 'chat', text: t('ui.worldBossDown'), sys: 1 });
      } else {
        UI.toast(t('ui.bossDown'));
      }
      this.sfx('levelup');
      this.submitScores();
    }
  }

  /* ---------------- Leaderboard ---------------- */
  /* Base URL of the leaderboard API: the connected game server,
   * or the page's own origin when served by server.py. */
  apiBase() {
    if (this.net.isOnline && this.net.ws && this.net.ws.url) {
      return this.net.ws.url.replace(/^ws/, 'http').replace(/\/+$/, '');
    }
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    return null;
  }

  boardName(p) {
    return this.heroName();
  }

  submitScores(useBeacon) {
    const base = this.apiBase();
    if (base === null) return;
    for (const p of this.players) {
      const payload = JSON.stringify({
        id: PID + '-' + p.id, name: this.boardName(p), cls: p.clsId,
        level: p.level, kills: p.kills, bosses: p.bossKills, gold: p.gold,
      });
      const url = base + '/api/score';
      try {
        if (useBeacon && navigator.sendBeacon) navigator.sendBeacon(url, payload);
        else fetch(url, { method: 'POST', body: payload, keepalive: !!useBeacon }).catch(() => {});
      } catch (e) { /* leaderboard is best-effort */ }
    }
  }

  playerNearLocal(x, y, r) {
    return this.players.some(p => !p.dead && Math.hypot(p.x - x, p.y - y) < r);
  }

  collectPickup(pk, p) {
    const d = p.derived;
    if (pk.kind === 'gear') {
      p.addItem(pk.value);
      const isMat = pk.value.kind === 'material';
      const label = itemIcon(pk.value) + ' ' + itemName(pk.value) + (isMat && (pk.value.count || 1) > 1 ? ' ×' + pk.value.count : '');
      this.addFloatText(p.x, p.y - 46, label, itemColor(pk.value));
      if (isMat) { this.sfx('pickup'); }         // quiet: materials aren't fanfare
      else { UI.toast(t('inv.got', { name: itemName(pk.value) }), 'gold'); this.sfx('levelup'); }
      this.save();
      return;
    }
    if (pk.kind === 'heart') {
      this.healEntity(p, d.maxHp * pk.value);
      this.sfx('pickup');
    } else if (pk.kind === 'orb') {
      p.mp = Math.min(d.maxMp, p.mp + d.maxMp * pk.value);
      this.addFloatText(p.x, p.y - 40, '+MP', '#3d8bff');
      this.sfx('pickup');
    } else {
      p.gold += pk.value;
      this.addFloatText(p.x, p.y - 40, '+' + pk.value + '🪙', '#ffd75e');
      this.sfx('gold');
    }
  }

  /* Consume one potion: instant heal and/or a timed buff. */
  usePotion(p, item) {
    if (!item || item.kind !== 'potion' || !p.inventory.includes(item)) return false;
    const base = POTIONS[item.key];
    if (!base) return false;
    const d = p.derived;
    if (base.heal === 'hp') {
      this.healEntity(p, d.maxHp * base.pct);
    } else if (base.heal === 'mp') {
      p.mp = Math.min(d.maxMp, p.mp + d.maxMp * base.pct);
      this.addFloatText(p.x, p.y - 40, '+MP', '#3d8bff');
    }
    if (base.warp === 'village') {
      p.x = this.world.spawnX; p.y = this.world.spawnY;
      this.addEffect({ type: 'ring', x: p.x, y: p.y - 12, dur: 0.5, color: '#c9a0ff', r: 44 });
      this.addFloatText(p.x, p.y - 44, '✨', '#c9a0ff');
    }
    if (base.buff) p.addBuff(Object.assign({}, base.buff));
    p.removeItem(item, 1);
    this.sfx(base.warp ? 'skill' : (base.buff ? 'buff' : 'heal'));
    this.save();
    return true;
  }

  /* ---------- Shop ---------- */
  buyPotion(p, key, qty = 1) {
    const base = POTIONS[key];
    if (!base || base.craftOnly) return false;      // food is cooked, never sold
    const cost = base.price * qty;
    if (p.gold < cost) { UI.toast(t('shop.poor'), 'info'); this.sfx('point'); return false; }
    p.gold -= cost;
    p.addItem(makePotion(key, qty));
    this.sfx('gold');
    this.save();
    return true;
  }

  /* Sell a bag item to the merchant for gold. */
  sellItem(p, item) {
    if (!item || !p.inventory.includes(item)) return false;
    const gold = sellValue(item);
    p.gold += gold;
    p.removeItem(item, item.count || 1);
    this.addFloatText(p.x, p.y - 40, '+' + gold + '🪙', '#ffd75e');
    this.sfx('gold');
    this.save();
    return true;
  }

  /* Reforge (reroll) one affix row on a BAG gear item, spending gold.
   * Cost escalates per item via reforgeCost; rows stay within the server
   * row cap because reforgeRow reuses the drop math. */
  reforge(p, item, rowIdx) {
    if (!item || (item.kind !== 'weapon' && item.kind !== 'armor')) return false;
    if (!p.inventory.includes(item)) return false;   // bag only (unequip first)
    const row = item.rows && item.rows[rowIdx];
    if (!row) return false;
    const cost = reforgeCost(item);
    if (p.gold < cost) { UI.toast(t('shop.poor'), 'info'); this.sfx('point'); return false; }
    const before = row.val;
    const nv = reforgeRow(item, rowIdx);
    if (nv == null) return false;
    p.gold -= cost;
    this.sfx('buff');
    const arrow = nv > before ? '▲' : (nv < before ? '▼' : '=');
    this.addFloatText(p.x, p.y - 40, '⚒ ' + t('rstat.' + row.stat) + ' ' + before + '→' + nv + arrow,
      nv >= before ? '#7ee98a' : '#e8a0a0');
    this.save();
    return true;
  }

  /* ---------- Refine + materials (Phase 2b) ---------- */
  /* Total count of a material key in the bag. */
  matCount(p, key) {
    let n = 0;
    for (const it of p.inventory) if (it.kind === 'material' && it.key === key) n += (it.count || 1);
    return n;
  }

  spendMaterial(p, key, n) {
    for (const it of p.inventory.slice()) {
      if (n <= 0) break;
      if (it.kind === 'material' && it.key === key) {
        const take = Math.min(n, it.count || 1);
        p.removeItem(it, take);
        n -= take;
      }
    }
  }

  /* Attempt to refine a BAG gear item, spending gold + ore. Success raises
   * +1; a failed attempt past +4 drops one step — the item never breaks. */
  refine(p, item) {
    if (!item || (item.kind !== 'weapon' && item.kind !== 'armor')) return null;
    if (!p.inventory.includes(item)) return null;   // bag only (unequip first)
    if ((item.refine || 0) >= MAX_REFINE) { UI.toast(t('inv.refineMax'), 'info'); this.sfx('point'); return null; }
    const cost = refineCost(item);
    if (p.gold < cost.gold || this.matCount(p, 'ore') < cost.ore) {
      UI.toast(t('inv.refineNeed', { g: cost.gold, o: cost.ore }), 'info'); this.sfx('point'); return null;
    }
    p.gold -= cost.gold;
    this.spendMaterial(p, 'ore', cost.ore);
    const success = Math.random() < refineChance(item);
    if (success) {
      item.refine = (item.refine || 0) + 1;
      item.rr = 0;                    // refining resets the reforge cost (spec §6)
      this.sfx('levelup');
      this.addFloatText(p.x, p.y - 46, '⚒ +' + item.refine + ' ✔', '#7ee98a');
      this.addEffect({ type: 'ring', x: p.x, y: p.y - 12, dur: 0.4, color: '#ffd75e', r: 30 });
    } else {
      item.refine = Math.max(0, (item.refine || 0) - 1);
      this.sfx('hurt');
      this.addFloatText(p.x, p.y - 46, '⚒ +' + item.refine + ' ✘', '#e8a0a0');
    }
    this.save();
    return { success, refine: item.refine };
  }

  /* Awaken (P5a): spend one Awakening Stone to add a 4th affix row to a BAG
   * gear item, once. Bag-only, like reforge/refine. */
  awaken(p, item) {
    if (!canAwaken(item) || !p.inventory.includes(item)) return null;
    if (this.matCount(p, 'stone') < 1) { UI.toast(t('inv.awakenNeed'), 'info'); this.sfx('point'); return null; }
    const row = awakenItem(item);
    if (!row) return null;
    this.spendMaterial(p, 'stone', 1);
    this.sfx('legendary');
    this.addEffect({ type: 'ring', x: p.x, y: p.y - 12, dur: 0.6, color: '#ff5db1', r: 40 });
    this.addFloatText(p.x, p.y - 46, '✦ +' + row.val + ' ' + t('rstat.' + row.stat), '#ff9ad6');
    this.save();
    return row;
  }

  /* Mine an adjacent rock (manual — pressing attack next to a rock with no
   * enemy in melee range). Per-rock 60s LOCAL cooldown; no world mutation so
   * it never desyncs multiplayer. Returns true if it mined. */
  tryMineNear(p) {
    for (const e of this.enemies) {           // don't intercept combat
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 70) return false;
    }
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    let best = null, bestD = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const obj = this.world.objects.get((ptx + ox) + ',' + (pty + oy));
      if (obj && obj.type === 'rock') {
        const d = Math.abs(ox) + Math.abs(oy);
        if (d < bestD) { bestD = d; best = obj; }
      }
    }
    if (!best || (best.mineT || 0) > this.time) return false;
    best.mineT = this.time + 60;
    const n = 1 + (Math.random() < 0.35 ? 1 : 0);
    p.addItem(makeMaterial('ore', n));
    const rx = best.tx * TILE + TILE / 2, ry = best.ty * TILE + TILE / 2;
    this.addFloatText(rx, ry, '🪨 +' + n, '#d8c8a0');
    this.addEffect({ type: 'spark', x: rx, y: ry, dur: 0.2, color: '#b79b6e', r: 12 });
    this.sfx('hit');
    this.save();
    return true;
  }

  /* Fish an adjacent water tile (P5c) — a peaceful life-skill firing from the
   * attack button when beside water with no enemy in melee range (same gate as
   * mining, so the AFK bot never fishes). Per-SPOT 60s local cooldown keyed by
   * tile coords (no world mutation → no desync). Returns true if it fished. */
  tryFishNear(p) {
    for (const e of this.enemies) {           // don't intercept combat
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 70) return false;
    }
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    let best = null, bestD = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (ox === 0 && oy === 0) continue;
      const tx = ptx + ox, ty = pty + oy;
      if (this.world.tileAt(tx, ty) === T_WATER) {
        const d = Math.abs(ox) + Math.abs(oy);
        if (d < bestD) { bestD = d; best = { tx, ty }; }
      }
    }
    if (!best) return false;
    if (!this.fishCd) this.fishCd = new Map();
    const kk = best.tx + ',' + best.ty;
    if ((this.fishCd.get(kk) || 0) > this.time) return false;
    this.fishCd.set(kk, this.time + 60);
    const n = 1 + (Math.random() < 0.3 ? 1 : 0);
    p.addItem(makeMaterial('fish', n));
    const wx = best.tx * TILE + TILE / 2, wy = best.ty * TILE + TILE / 2;
    this.addFloatText(wx, wy, '🐟 +' + n, '#bfe0f0');
    this.addEffect({ type: 'ring', x: wx, y: wy, dur: 0.4, color: '#7fb0d0', r: 14 });
    this.sfx('point');
    this.save();
    return true;
  }

  /* Cook (P5c): turn COOK_COST fish into one food consumable (a regen buff on
   * its own tag). Bag-only life-skill crafting — zero combat power. */
  cook(p) {
    if (this.matCount(p, 'fish') < COOK_COST) { UI.toast(t('inv.cookNeed', { n: COOK_COST }), 'info'); this.sfx('point'); return false; }
    this.spendMaterial(p, 'fish', COOK_COST);
    p.addItem(makePotion('food', 1));
    this.addFloatText(p.x, p.y - 40, '🍢 +1', '#e0a95e');
    this.addEffect({ type: 'ring', x: p.x, y: p.y - 12, dur: 0.4, color: '#e0a95e', r: 26 });
    this.sfx('buff');
    this.save();
    return true;
  }

  /* Treasure chests (Phase 2c): walking onto one with a key opens it for
   * loot. Manual play only — the AFK bot never opens chests, keeping them an
   * active-play reward. Opened locally (per-client), 5-min local respawn. */
  updateChests() {
    const chests = this.world.chests;
    if (!chests) return;
    for (const c of chests) {
      if (c.openT > this.time) continue;           // opened; respawning
      for (const p of this.players) {
        if (p.dead || p.afk) continue;             // bot ignores chests
        if (Math.hypot(p.x - c.x, p.y - c.y) >= 26) continue;
        if (this.matCount(p, 'key') < 1) {
          if ((c.hintT || 0) <= this.time) { c.hintT = this.time + 3; this.addFloatText(c.x, c.y - 20, '🗝️?', '#e8c860'); }
          continue;
        }
        this.openChest(c, p);
        break;
      }
    }
  }

  openChest(c, p) {
    this.spendMaterial(p, 'key', 1);
    c.openT = this.time + 300;                      // 5-min local respawn
    const tier = Math.max(1, this.world.tierAt(c.x, c.y));
    const gold = 30 + tier * 25 + Math.floor(Math.random() * (20 * tier));
    p.gold += gold;
    p.addItem(makePotion(pickRandom(['hp', 'mp']), 1));
    // one gear roll — chest tier table (no legend/mystic; those stay boss-only)
    const item = rollItem({ ilvl: tier * 4, tierWeights: TIER_DROP.elite, classHint: p && p.clsId });
    p.addItem(item);
    this.addFloatText(c.x, c.y - 30, '📦 +' + gold + '🪙', '#ffd75e');
    this.addEffect({ type: 'ring', x: c.x, y: c.y - 8, dur: 0.6, color: '#ffd75e', r: 42 });
    this.sfx(item.tier === 'legend' || item.tier === 'mystic' ? 'legendary' : 'levelup');
    UI.toast('📦 ' + itemIcon(item) + ' ' + t('chest.opened', { name: itemName(item) }), 'gold');
    this.save();
  }

  /* ---------- Warp portals + biome maps (P3) ----------
   * The hub is the shared multiplayer World; biome maps are SOLO instances
   * (local sim). Warping between them rebuilds the world and swaps the net
   * layer accordingly, reusing the existing online/local transitions. */
  updatePortals() {
    const portals = this.world.portals;
    if (!portals || !portals.length || (this._warpCd || 0) > this.time) return;
    const p = this.players[0];
    if (!p || p.dead || p.afk) return;              // manual travel only
    for (const portal of portals) {
      if (Math.hypot(p.x - portal.x, p.y - portal.y) < 28) { this.warpTo(portal.to); return; }
    }
  }

  /* Map switch. The hub is the shared multiplayer World; biome maps are SOLO
   * instances (local sim). Signed-in players drop the WS to enter a biome and
   * rejoin the World (with retry) on return, so the shared-world netcode is
   * never mixed across maps. Guests are always local — a plain world swap. */
  warpTo(mapId) {
    if (!MAPS[mapId] || (this.world && this.world.mapId === mapId)) return;
    const online = (typeof Account !== 'undefined') && Account.loggedIn;
    const name = this.heroName();
    if (this.trade) { this.returnTradeEscrow(this.trade); this.trade = null; }
    this.pendingTrade = null; UI.hideTradeRequest(); UI.closeTrade();
    this.enemies = []; this.pickups = []; this.projectiles = []; this.effects = [];
    this.ghosts.clear(); this.remotePlayers.clear();
    this.world = new World(mapId);
    this.worldBossT = WORLDBOSS_INTERVAL; this.worldBossWarned = false;
    if (mapId === 'hub' && online) {
      this.rejoinOnline(name);                       // back to the shared World
    } else if (this.net instanceof WSNet) {
      this.net.disconnect();                         // enter a solo instance
      this.net = new LocalNet();
      this.net.sync(this.players);
    }
    const ex = this.world.entryX != null ? this.world.entryX : this.world.spawnX;
    const ey = this.world.entryY != null ? this.world.entryY : this.world.spawnY;
    for (const pl of this.players) { pl.x = ex; pl.y = ey; }
    this.cam.x = ex - this.canvas.width / 2;
    this.cam.y = ey - this.canvas.height / 2;
    this._warpCd = this.time + 1.2;
    UI.updateOnlinePanel();
    UI.toast(t(mapId === 'hub' ? 'map.toHub' : 'map.to_' + mapId), 'gold');
    this.sfx('levelup');
    this.save();
  }

  /* ---------- Hotkey potion slots ---------- */
  /* Use the potion assigned to quick slot `i` (0-2), if any in the bag. */
  useQuickItem(p, i) {
    const key = p.quickItems[i];
    if (!key) return false;
    const stack = p.inventory.find(it => it.kind === 'potion' && it.key === key);
    if (!stack) { UI.toast(t('quick.out', { name: t('item.' + key) }), 'info'); this.sfx('point'); return false; }
    return this.usePotion(p, stack);
  }

  quickCount(p, i) {
    const key = p.quickItems[i];
    if (!key) return 0;
    const stack = p.inventory.find(it => it.kind === 'potion' && it.key === key);
    return stack ? (stack.count || 1) : 0;
  }

  onLevelUp(p) {
    UI.toast(t('ui.levelUp', { name: p.name, lv: p.level }));
    this.addEffect({ type: 'ring', x: p.x, y: p.y - 12, dur: 0.6, color: '#ffd75e', r: 60 });
    this.sfx('levelup');
    this.save();
    this.submitScores();
  }

  onPlayerDeath(p) {
    UI.toast(t('ui.dead', { name: 'P' + p.id, s: 4 }), 'info');
    this.addEffect({ type: 'ring', x: p.x, y: p.y - 12, dur: 0.5, color: '#ff4050', r: 40 });
    this.sfx('die');
  }

  addEffect(fx) { fx.t = 0; this.effects.push(fx); }
  addFloatText(x, y, text, color) { this.floatTexts.push({ x, y, text, color, t: 0 }); }
  sfx(name) { if (SFX[name]) SFX[name](); }

  /* ---------------- Save / Load ---------------- */
  save(force) {
    const data = {
      v: 1,
      players: this.players.map(p => ({
        id: p.id, clsId: p.clsId, level: p.level, xp: p.xp,
        statPoints: p.statPoints, gold: p.gold, kills: p.kills,
        bossKills: p.bossKills, stats: p.stats,
        inventory: p.inventory.map(itemToSave),
        storage: p.storage.map(itemToSave),
        equip: Object.fromEntries(EQUIP_SLOTS.map(s => [s, p.equip[s] ? itemToSave(p.equip[s]) : null])),
        quickItems: p.quickItems.slice(),   // potion keys (or null)
      })),
    };
    // Signed in → the server is the source of truth. Guests keep their
    // character only in sessionStorage: it survives a refresh but is wiped
    // when the browser/tab closes, so guest progress never persists.
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
    if (Account.loggedIn) Account.saveCharacter(data, force);
  }

  static loadSave() {
    try {
      const raw = sessionStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.players || !data.players.length) return null;
      return data;
    } catch (e) { return null; }
  }

  /* ---------------- Draw ---------------- */
  draw() {
    const g = this.g, cam = this.cam;
    const vw = this.canvas.width, vh = this.canvas.height;

    // ground
    g.drawImage(this.world.baked, cam.x, cam.y, vw, vh, 0, 0, vw, vh);

    // village healing circle
    {
      const hx = this.world.spawnX - cam.x, hy = this.world.spawnY - cam.y;
      if (hx > -HEAL_RADIUS - 40 && hx < vw + HEAL_RADIUS + 40 &&
          hy > -HEAL_RADIUS - 40 && hy < vh + HEAL_RADIUS + 40) {
        const pulse = Math.sin(this.time * 2);
        g.globalAlpha = 0.12 + pulse * 0.03;
        g.fillStyle = '#5ec96a';
        g.beginPath();
        g.arc(hx, hy, HEAL_RADIUS, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.55;
        g.strokeStyle = '#7ee98a';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(hx, hy, HEAL_RADIUS * (0.97 + pulse * 0.02), 0, Math.PI * 2);
        g.stroke();
        // drifting sparkles
        g.fillStyle = '#a8f5b0';
        for (let i = 0; i < 5; i++) {
          const a = this.time * 0.6 + (i / 5) * Math.PI * 2;
          const rr = HEAL_RADIUS * (0.35 + 0.45 * ((Math.sin(this.time + i * 2) + 1) / 2));
          g.fillRect(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr - ((this.time * 20 + i * 13) % 26), 3, 3);
        }
        g.globalAlpha = 1;
        g.font = '10px monospace';
        g.textAlign = 'center';
        g.fillStyle = '#a8f5b0';
        g.fillText(t('ui.healZone'), hx, hy - HEAL_RADIUS - 8);
      }
    }

    // gather y-sorted drawables
    const drawables = [];
    const tx0 = Math.floor(cam.x / TILE) - 1, ty0 = Math.floor(cam.y / TILE) - 1;
    const tx1 = Math.ceil((cam.x + vw) / TILE) + 1, ty1 = Math.ceil((cam.y + vh) / TILE) + 1;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const obj = this.world.objects.get(tx + ',' + ty);
        if (obj) drawables.push({ y: ty * TILE + 30, obj });
      }
    }
    for (const p of this.players) if (!p.dead) drawables.push({ y: p.y, ent: p });
    for (const [, list] of this.remotePlayers) {
      for (const rp of list) if (!rp.dead) drawables.push({ y: rp.y, ent: rp });
    }
    for (const e of this.enemies) {
      if (e.x > cam.x - 80 && e.x < cam.x + vw + 80 && e.y > cam.y - 80 && e.y < cam.y + vh + 80) {
        drawables.push({ y: e.y, ent: e });
      }
    }
    for (const pk of this.pickups) drawables.push({ y: pk.y, pk });
    if (this.world.chests) {
      for (const c of this.world.chests) {
        if (c.openT > this.time) continue;   // opened chests are hidden until respawn
        if (c.x > cam.x - 60 && c.x < cam.x + vw + 60 && c.y > cam.y - 60 && c.y < cam.y + vh + 60)
          drawables.push({ y: c.y, chest: c });
      }
    }
    if (this.world.portals) {
      for (const portal of this.world.portals) {
        if (portal.x > cam.x - 60 && portal.x < cam.x + vw + 60 && portal.y > cam.y - 60 && portal.y < cam.y + vh + 60)
          drawables.push({ y: portal.y, portal });
      }
    }
    drawables.sort((a, b) => a.y - b.y);

    for (const d of drawables) {
      if (d.obj) {
        const cooling = (d.obj.mineT || 0) > this.time;   // mined rock, on cooldown
        if (cooling) g.globalAlpha = 0.45;
        drawSprite(g, d.obj.type, false, Math.round(d.obj.tx * TILE - 8 - cam.x), Math.round(d.obj.ty * TILE - 16 - cam.y), 48, false, 0);
        if (cooling) g.globalAlpha = 1;
      } else if (d.chest) {
        const bob = Math.round(Math.sin(this.time * 3 + d.chest.tx) * 1);
        drawSprite(g, 'chest', false, Math.round(d.chest.tx * TILE - 8 - cam.x), Math.round(d.chest.ty * TILE - 16 - cam.y + bob), 48, false, 0);
      } else if (d.portal) {
        drawSprite(g, 'portal', false, Math.round(d.portal.tx * TILE - 8 - cam.x), Math.round(d.portal.ty * TILE - 16 - cam.y), 48, true, this.time * 2);
      } else if (d.ent) {
        d.ent.draw(g, cam);
      } else if (d.pk) {
        d.pk.draw(g, cam);
      }
    }

    for (const pr of this.projectiles) pr.draw(g, cam);

    // effects
    for (const fx of this.effects) {
      const k = fx.t / fx.dur;
      g.globalAlpha = 1 - k;
      if (fx.type === 'ring') {
        g.strokeStyle = fx.color; g.lineWidth = 3;
        g.beginPath();
        g.arc(fx.x - cam.x, fx.y - cam.y, fx.r * (0.4 + k * 0.6), 0, Math.PI * 2);
        g.stroke();
      } else if (fx.type === 'slash') {
        g.strokeStyle = fx.color; g.lineWidth = 4;
        g.beginPath();
        g.arc(fx.x - cam.x, fx.y - cam.y, fx.r, -0.7 + k * 1.2, 0.7 + k * 1.2);
        g.stroke();
      } else if (fx.type === 'spark') {
        g.fillStyle = fx.color;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + k * 2;
          g.fillRect(fx.x - cam.x + Math.cos(a) * fx.r * k * 2, fx.y - cam.y + Math.sin(a) * fx.r * k * 2, 3, 3);
        }
      } else if (fx.type === 'bolt') {
        g.strokeStyle = fx.color; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(fx.x - cam.x + 8, fx.y - cam.y - 70);
        g.lineTo(fx.x - cam.x - 6, fx.y - cam.y - 34);
        g.lineTo(fx.x - cam.x + 6, fx.y - cam.y - 30);
        g.lineTo(fx.x - cam.x, fx.y - cam.y - 10);
        g.stroke();
      } else if (fx.type === 'aura') {
        g.globalAlpha = 0.18 + Math.sin(this.time * 5) * 0.05;
        g.fillStyle = fx.color;
        g.beginPath();
        g.arc(fx.x - cam.x, fx.y - cam.y, fx.r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.5;
        g.strokeStyle = fx.color;
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // float texts
    g.font = 'bold 13px monospace';
    g.textAlign = 'center';
    for (const ft of this.floatTexts) {
      g.globalAlpha = 1 - ft.t;
      g.fillStyle = '#000';
      g.fillText(ft.text, ft.x - cam.x + 1, ft.y - cam.y + 1);
      g.fillStyle = ft.color;
      g.fillText(ft.text, ft.x - cam.x, ft.y - cam.y);
    }
    g.globalAlpha = 1;

    // offscreen partner arrow
    for (const p of this.players) {
      if (p.dead) continue;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < 0 || sx > vw || sy < 0 || sy > vh) {
        const ax = Math.max(20, Math.min(vw - 20, sx));
        const ay = Math.max(20, Math.min(vh - 20, sy));
        g.fillStyle = p.id === 1 ? '#ffd75e' : '#6ee2ff';
        g.beginPath();
        const ang = Math.atan2(sy - ay, sx - ax);
        g.moveTo(ax + Math.cos(ang) * 12, ay + Math.sin(ang) * 12);
        g.lineTo(ax + Math.cos(ang + 2.5) * 9, ay + Math.sin(ang + 2.5) * 9);
        g.lineTo(ax + Math.cos(ang - 2.5) * 9, ay + Math.sin(ang - 2.5) * 9);
        g.fill();
      }
    }

    // dead player banner
    for (const p of this.players) {
      if (!p.dead) continue;
      g.font = 'bold 16px monospace';
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(vw / 2 - 190, 100 + p.id * 30 - 18, 380, 26);
      g.fillStyle = '#ff8080';
      g.fillText(t('ui.dead', { name: 'P' + p.id, s: Math.ceil(p.respawnT) }), vw / 2, 100 + p.id * 30);
    }
  }
}

/* ============================================================
 * Bootstrap — title screen, input listeners, overlays
 * ============================================================ */

let game = null;

/* Continue is available from a cloud character (if signed in) or a
 * local save. The cloud character takes precedence. */
function continueData() {
  return (Account.loggedIn && Account.character) || Game.loadSave();
}
function refreshContinue() {
  const btn = document.getElementById('btn-continue');
  if (btn) btn.classList.toggle('hidden', !continueData());
}

/* Title screen is two steps: (1) log in / play as guest, then (2) choose a
 * class. Signing in (or picking Guest) advances to the class step; the
 * language switch stays available on both. `guestChosen` remembers the
 * guest path so we don't bounce back to the login step. */
let guestChosen = false;

/* Creating a NEW character always needs a player name — a guest names a
 * local hero, a signed-in player claims a unique name for their account.
 * (A player with saved progress skips this; they Continue.) */
function heroNameNeeded() { return !hasSavedCharacter(); }

/* True once the player has a saved character to continue (cloud char when
 * signed in). Such players skip class selection — Continue only. */
function hasSavedCharacter() { return !!continueData(); }

/* START ADVENTURE needs a class and, for a guest, a non-empty hero name that
 * isn't already taken in the database. CONTINUE restores the saved name. */
function updateStartBtn() {
  const btn = document.getElementById('btn-start');
  if (!btn) return;
  const nameEl = document.getElementById('hero-name');
  const nameFilled = !heroNameNeeded() || (nameEl && nameEl.value.trim().length > 0);
  const nameFree = UI._heroNameOk !== false;   // null/true ok; false = taken
  btn.disabled = !(UI.selectedClass && nameFilled && nameFree);
}

function showTitleStep() {
  const ready = Account.loggedIn || guestChosen;
  const landing = document.getElementById('title-landing');
  const select = document.getElementById('title-select');
  if (landing) landing.classList.toggle('hidden', ready);
  if (select) select.classList.toggle('hidden', !ready);
  // With a saved character, offer ONLY Continue (no new-character UI)
  const saved = hasSavedCharacter();
  const newchar = document.getElementById('title-newchar');
  if (newchar) newchar.classList.toggle('hidden', saved);
  // Back only makes sense for a guest returning to the login choice
  const back = document.getElementById('btn-title-back');
  if (back) back.classList.toggle('hidden', Account.loggedIn);
  // hero-name field: shown for guests only, pre-filled with their last name
  const nameRow = document.getElementById('hero-name-row');
  const nameEl = document.getElementById('hero-name');
  if (nameRow) nameRow.classList.toggle('hidden', !heroNameNeeded());
  if (nameEl && heroNameNeeded() && !nameEl.value) {
    nameEl.value = localStorage.getItem('pixelrealms_name') || '';
  }
  UI.refreshAccountStatus();
  if (ready) { refreshContinue(); updateStartBtn(); }
}

/* Leave the running game and go back to the very first title screen (used by
 * in-game logout so the player can switch accounts). */
function returnToTitle() {
  if (game) {
    game.running = false;
    if (game.bgTicker) clearInterval(game.bgTicker);
    if (game.net instanceof WSNet) game.net.disconnect();
    game = null;
    UI.game = null;
  }
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  guestChosen = false;
  UI.selectedClass = null;
  document.querySelectorAll('#class-grid .class-card.selected').forEach(c => c.classList.remove('selected'));
  const sb = document.getElementById('btn-start'); if (sb) sb.disabled = true;
  refreshContinue();
  showTitleStep();
}

function initTitle() {
  applyI18n();
  UI.buildClassCards('class-grid', clsId => {
    UI.selectedClass = clsId;
    updateStartBtn();
  });

  const heroNameEl = document.getElementById('hero-name');
  if (heroNameEl) {
    let hnT = null;
    heroNameEl.addEventListener('input', () => {
      UI._heroNameOk = null; updateStartBtn();
      clearTimeout(hnT); hnT = setTimeout(() => UI.checkHeroName(), 350);
    });
  }

  refreshContinue();
  showTitleStep();
  UI.loadSupport();   // tip-jar + server-cost meter on the landing (M0)
  // if already signed in, pull the cloud character and update Continue
  if (Account.loggedIn) Account.loadCharacter().then(() => { refreshContinue(); showTitleStep(); });

  document.getElementById('btn-landing-login').addEventListener('click', () => UI.openAccountPanel());
  document.getElementById('btn-landing-guest').addEventListener('click', () => {
    guestChosen = true;
    showTitleStep();
  });
  document.getElementById('btn-title-back').addEventListener('click', () => {
    guestChosen = false;
    UI.selectedClass = null;
    document.getElementById('btn-start').disabled = true;
    document.querySelectorAll('#class-grid .class-card.selected').forEach(c => c.classList.remove('selected'));
    showTitleStep();
  });

  document.getElementById('btn-start').addEventListener('click', async () => {
    if (heroNameNeeded()) {
      const nm = document.getElementById('hero-name').value.trim();
      if (!nm || UI._heroNameOk === false) { updateStartBtn(); return; }   // need a free name
      if (Account.loggedIn) {
        // reserve the globally-unique player name for this account
        const r = await Account.claimHeroName(nm);
        if (!r.ok) { UI._heroNameOk = false; UI.checkHeroName(); UI.toast(t('title.nameTaken'), 'info'); return; }
      } else {
        localStorage.setItem('pixelrealms_name', nm);
      }
    }
    startGame(UI.selectedClass, null);
  });

  document.getElementById('btn-continue').addEventListener('click', () => {
    const data = continueData();
    if (data) startGame(data.players[0].clsId, data.players[0]);
    else refreshContinue();
  });

  document.querySelectorAll('.lang-choice').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

function startGame(clsId, saved) {
  ensureAudio();
  game = new Game();
  UI.game = game;
  game.addPlayer(1, clsId, saved);
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  game.save();
  // Signed-in players auto-join the shared public World; guests stay local.
  if (Account.loggedIn) game.rejoinOnline(game.heroName());
  game.start();
}

/* Smart default relay address, derived from how the page was served.
 * server.py serves the page and the WebSocket on the SAME host+port, so
 * we mirror the page origin:
 *  - https page -> wss:// same host (cloud deploy, TLS)
 *  - http page  -> ws:// same host+port (server.py on this machine/LAN)
 *  - file://    -> ws://<hostname|localhost>:8765 (dev fallback)
 */
function serverUrl() {
  if (location.protocol === 'https:') return 'wss://' + location.host;
  if (location.protocol === 'http:') return 'ws://' + location.host;
  return 'ws://' + (location.hostname || 'localhost') + ':8765';
}

/* ---------------- Global listeners ---------------- */
window.addEventListener('keydown', e => {
  ensureAudio();

  // hotkey rebinding capture
  if (UI.listening) {
    e.preventDefault();
    UI.captureKey(e.code);
    return;
  }

  const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  // block page scrolling, but let inputs (chat, sliders) use these keys
  if (!typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!typing) {
    keys.add(e.code);
    // a focused HUD button would otherwise swallow Space/Enter as a click —
    // blur it so game keys reach the hero instead
    const ae = document.activeElement;
    if (ae && ae.tagName === 'BUTTON' && Object.values(KEYS).includes(e.code)) ae.blur();
  }

  if (!game || typing) return;

  const p1 = game.players[0];
  if (p1 && e.code === KEYS.panel) {
    const open = !document.getElementById('stat-panel').classList.contains('hidden');
    if (open) UI.closeStatPanel();
    else UI.openStatPanel(p1);
  }
  if (p1 && e.code === KEYS.afk) game.toggleAfk(p1);
  // quick potion slots (edge-triggered so one press = one potion)
  if (p1 && !e.repeat) {
    if (e.code === KEYS.quick1) game.useQuickItem(p1, 0);
    else if (e.code === KEYS.quick2) game.useQuickItem(p1, 1);
    else if (e.code === KEYS.quick3) game.useQuickItem(p1, 2);
  }
  if (e.code === 'Enter') {
    e.preventDefault();
    document.getElementById('chat-input').focus();
  }
  if (e.code === 'Escape') {
    UI.closeStatPanel();
    UI.closeKeysPanel();
    if (game && game.trade) game.cancelTrade();
    UI.closeTrade();
    document.getElementById('help-panel').classList.add('hidden');
    document.getElementById('board-panel').classList.add('hidden');
    document.getElementById('news-panel').classList.add('hidden');
    document.getElementById('sound-panel').classList.add('hidden');
    document.getElementById('afk-panel').classList.add('hidden');
    document.getElementById('account-panel').classList.add('hidden');
    UI.closeInventory();
    UI.closeShop();
  }
});

window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('pointerdown', ensureAudio);
// Return any items escrowed in an open trade to the bag before the final
// save, so a mid-trade close can't drop them (they live only in trade state).
window.addEventListener('beforeunload', () => {
  if (!game) return;
  if (game.trade) game.returnTradeEscrow(game.trade);
  game.save(true);
});
window.addEventListener('pagehide', () => {
  if (!game) return;
  if (game.trade) game.returnTradeEscrow(game.trade);
  game.submitScores(true); game.save(true);
});

document.addEventListener('DOMContentLoaded', () => {
  initTitle();

  document.getElementById('btn-lang').addEventListener('click', () => {
    setLang(currentLang === 'en' ? 'th' : 'en');
  });
  // sound settings
  const volSlider = document.getElementById('sound-vol');
  const updateSoundUI = () => {
    document.getElementById('btn-sound').textContent = (SOUND.muted || SOUND.vol <= 0) ? '🔇' : '🔊';
    document.getElementById('btn-sound-mute').textContent =
      (SOUND.muted ? '🔇 ' : '🔊 ') + t(SOUND.muted ? 'sound.unmute' : 'sound.mute');
    volSlider.value = Math.round(SOUND.vol * 100);
    document.getElementById('sound-vol-num').textContent = Math.round(SOUND.vol * 100) + '%';
  };
  updateSoundUI();
  document.getElementById('btn-sound').addEventListener('click', () => {
    document.getElementById('sound-panel').classList.remove('hidden');
    updateSoundUI();
  });
  document.getElementById('btn-sound-close').addEventListener('click', () =>
    document.getElementById('sound-panel').classList.add('hidden'));
  volSlider.addEventListener('input', () => {
    SOUND.vol = volSlider.value / 100;
    if (SOUND.vol > 0) SOUND.muted = false;
    saveSound();
    updateSoundUI();
    if (game) game.sfx('point');   // instant feedback at the new volume
  });
  document.getElementById('btn-sound-mute').addEventListener('click', () => {
    SOUND.muted = !SOUND.muted;
    saveSound();
    updateSoundUI();
    if (!SOUND.muted && game) game.sfx('point');
  });
  document.addEventListener('langchange', updateSoundUI);

  document.getElementById('btn-help').addEventListener('click', () => UI.showHelp());
  document.getElementById('btn-help-close').addEventListener('click', () =>
    document.getElementById('help-panel').classList.add('hidden'));
  document.getElementById('btn-sp-close').addEventListener('click', () => UI.closeStatPanel());
  document.getElementById('btn-sp-recommend').addEventListener('click', () => {
    const p = UI.statPanelPlayer;
    if (game && p) { game.recommendStats(p); UI.renderStatPanel(p); }
  });
  document.getElementById('btn-sp-reset').addEventListener('click', () => {
    const p = UI.statPanelPlayer;
    if (game && p) { game.resetStats(p); UI.renderStatPanel(p); }
  });

  // AFK + stats buttons
  document.getElementById('afk-p1').addEventListener('click', () => {
    if (game && game.players[0]) game.toggleAfk(game.players[0]);
  });
  document.getElementById('btn-stats').addEventListener('click', () => {
    if (game && game.players[0]) UI.openStatPanel(game.players[0]);
  });

  // account
  document.getElementById('btn-account').addEventListener('click', () => UI.openAccountPanel());
  document.getElementById('btn-account-title').addEventListener('click', () => UI.openAccountPanel());
  document.getElementById('btn-account-close').addEventListener('click', () =>
    document.getElementById('account-panel').classList.add('hidden'));

  // inventory
  document.getElementById('btn-inv').addEventListener('click', () => UI.openInventory());
  document.getElementById('btn-inv-close').addEventListener('click', () => UI.closeInventory());
  document.querySelectorAll('.inv-tab').forEach(btn => {
    btn.addEventListener('click', () => { UI.invTab = btn.dataset.tab; UI.invSel = null; UI.renderInventory(); });
  });

  // shop
  document.getElementById('btn-shop').addEventListener('click', () => UI.openShop());
  document.getElementById('btn-shop-close').addEventListener('click', () => UI.closeShop());
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => { UI.shopTab = btn.dataset.tab; UI.renderShop(); });
  });

  // AFK focus settings
  document.getElementById('afk-cfg-p1').addEventListener('click', () => UI.openAfkPanel());
  document.getElementById('btn-afk-close').addEventListener('click', () =>
    document.getElementById('afk-panel').classList.add('hidden'));
  document.querySelectorAll('.afk-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      AFK_FOCUS[btn.dataset.focus] = !AFK_FOCUS[btn.dataset.focus];
      saveAfkFocus();
      UI.renderAfkPanel();
      if (game) game.sfx('point');
    });
  });

  // hotkey settings
  // minimap show/hide
  document.getElementById('btn-minimap').addEventListener('click', () => {
    document.getElementById('minimap').classList.toggle('hidden');
    document.getElementById('zone-name').classList.toggle('hidden');
    document.getElementById('btn-minimap').blur();
  });

  document.getElementById('btn-keys').addEventListener('click', () => UI.openKeysPanel());
  document.getElementById('btn-keys-close').addEventListener('click', () => UI.closeKeysPanel());
  document.getElementById('btn-keys-reset').addEventListener('click', () => {
    resetKeys();
    UI.renderKeysPanel();
    UI.rebuildSkillbars();
  });

  // chat
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      if (game) game.sendChat(chatInput.value);
      chatInput.value = '';
      chatInput.blur();
    }
    if (e.key === 'Escape') chatInput.blur();
  });

  // leaderboard
  document.getElementById('btn-board').addEventListener('click', () => UI.openBoard());
  document.querySelectorAll('.board-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.boardTab = btn.dataset.tab;
      UI.renderBoard();
    });
  });
  document.getElementById('btn-board-close').addEventListener('click', () =>
    document.getElementById('board-panel').classList.add('hidden'));

  // announcements — toggle so the button both opens and hides the window
  document.getElementById('btn-news').addEventListener('click', () => {
    const panel = document.getElementById('news-panel');
    if (panel.classList.contains('hidden')) UI.openNews();
    else UI.closeNews();
    document.getElementById('btn-news').blur();
  });
  document.getElementById('btn-news-close').addEventListener('click', () => UI.closeNews());

  // donation QR popup — close via button or clicking the backdrop
  document.getElementById('btn-qr-close').addEventListener('click', () => UI.closeQrModal());
  document.getElementById('qr-modal').addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal') UI.closeQrModal();
  });

  // trading
  document.getElementById('btn-trade').addEventListener('click', () => UI.openTradePanel());
  document.getElementById('btn-trade-close').addEventListener('click', () => {
    if (game && game.trade) game.cancelTrade();
    UI.closeTrade();
  });
  document.getElementById('btn-trade-yes').addEventListener('click', () => {
    if (game) game.answerTradeRequest(true);
  });
  document.getElementById('btn-trade-no').addEventListener('click', () => {
    if (game) game.answerTradeRequest(false);
  });

  // Character progress no longer lives in localStorage: signed-in players
  // save on the server, guests only in sessionStorage. Drop any legacy
  // local save so an old browser copy can't resurrect a guest character.
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }

  // rebuild language-dependent DOM when language changes
  document.addEventListener('langchange', () => {
    if (!game) {
      UI.buildClassCards('class-grid', clsId => {
        UI.selectedClass = clsId;
        updateStartBtn();
      });
      if (UI.selectedClass) {
        const card = document.querySelector(`#class-grid .class-card[data-cls="${UI.selectedClass}"]`);
        if (card) card.classList.add('selected');
      }
      updateStartBtn();
    } else {
      UI.refreshSkillNames();
      if (UI.statPanelPlayer) UI.renderStatPanel(UI.statPanelPlayer);
      if (!document.getElementById('keys-panel').classList.contains('hidden')) UI.renderKeysPanel();
      UI.updateOnlinePanel();
    }
    if (!document.getElementById('help-panel').classList.contains('hidden')) UI.showHelp();
    // re-render open announcements in the newly-chosen language (content is
    // bilingual per item; the cached items just need re-picking)
    if (!document.getElementById('news-panel').classList.contains('hidden')) UI.renderNews(UI._newsItems || []);
    UI.renderSupport();   // support block carries i18n strings too
  });

  applyI18n();
});

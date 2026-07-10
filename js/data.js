/* ============================================================
 * data.js — Classes, stats, skills, enemies, balance formulas
 * ============================================================ */

const STAT_KEYS = ['str', 'agi', 'int', 'vit', 'luk'];
const POINTS_PER_LEVEL = 5;

function xpToNext(level) {
  return Math.floor(45 * Math.pow(level, 1.45));
}

/* Derived combat stats from base stats + level + equipped gear.
 * Timed buffs are NOT folded in here (they apply at use sites via
 * buffMul) so the sheet reflects gear/stats; gear IS included. */
const EMPTY_AGG = { str: 0, agi: 0, int: 0, vit: 0, luk: 0, hp: 0, mp: 0, atk: 0, matk: 0, crit: 0, spd: 0, dmgMul: 1, aspdMul: 1 };
function deriveStats(p) {
  const s = p.stats;
  const e = (p.equipAgg ? p.equipAgg() : EMPTY_AGG);
  const str = s.str + e.str, agi = s.agi + e.agi, int = s.int + e.int,
        vit = s.vit + e.vit, luk = s.luk + e.luk;
  return {
    maxHp: 70 + vit * 12 + p.level * 6 + e.hp,
    maxMp: 25 + int * 7 + p.level * 3 + e.mp,
    atk: 4 + str * 2 + p.level + e.atk,
    matk: 4 + int * 2 + p.level + e.matk,
    speed: Math.min(320, 128 + agi * 2.6 + e.spd),
    atkCd: Math.max(0.16, (0.62 - agi * 0.009) / (e.aspdMul || 1)),
    crit: Math.min(75, 5 + luk * 0.7 + e.crit),
    hpRegen: 0.6 + vit * 0.09,
    mpRegen: 0.8 + int * 0.09,
    dmgMul: e.dmgMul || 1,
  };
}

/* ---------- Classes ----------
 * attackType: 'melee' | 'ranged'
 * dmgStat: which derived stat powers the basic attack & skills
 */
const CLASSES = {
  warrior: {
    id: 'warrior', color: '#e06060',
    base: { str: 8, agi: 4, int: 1, vit: 8, luk: 3 },
    attackType: 'melee', dmgStat: 'atk',
    attackRange: 46, projSpeed: 0,
    skills: ['heavyslash', 'whirlwind', 'warcry'],
  },
  mage: {
    id: 'mage', color: '#6a8aff',
    base: { str: 1, agi: 3, int: 10, vit: 4, luk: 4 },
    attackType: 'ranged', dmgStat: 'matk',
    attackRange: 0, projSpeed: 340, projColor: '#8a9aff', projSize: 4,
    skills: ['fireball', 'frostnova', 'thunder'],
  },
  archer: {
    id: 'archer', color: '#6ec96a',
    base: { str: 4, agi: 10, int: 2, vit: 4, luk: 6 },
    attackType: 'ranged', dmgStat: 'atk',
    attackRange: 0, projSpeed: 460, projColor: '#d8c8a0', projSize: 3,
    skills: ['powershot', 'multishot', 'swift'],
  },
  cleric: {
    id: 'cleric', color: '#ffd75e',
    base: { str: 3, agi: 3, int: 8, vit: 7, luk: 3 },
    attackType: 'ranged', dmgStat: 'matk',
    attackRange: 0, projSpeed: 300, projColor: '#ffe9a0', projSize: 4,
    skills: ['smite', 'heal', 'sanctuary'],
  },
};

/* AFK bot: stat allocation priority per class (weighted pool) */
const BOT_STAT_PRIORITY = {
  warrior: ['str', 'str', 'str', 'vit', 'vit', 'agi'],
  mage:    ['int', 'int', 'int', 'vit', 'agi'],
  archer:  ['agi', 'agi', 'str', 'str', 'luk'],
  cleric:  ['int', 'int', 'vit', 'vit', 'str'],
};

/* ---------- Skills ----------
 * Each skill: mp cost, cooldown, icon, cast(game, p), and a
 * `bot` hint for the AFK auto-farm AI:
 *   kind 'atk'  — cast when target within `range`
 *   kind 'buff' — cast when fighting
 *   kind 'heal' — cast when hurt
 */
const SKILLS = {
  heavyslash: {
    id: 'heavyslash', icon: '🗡️', mp: 8, cd: 4, bot: { kind: 'atk', range: 55 },
    cast(g, p) {
      g.meleeArc(p, 60, 2.0, '#ffb040');
      g.addEffect({ type: 'slash', x: p.x + p.face.x * 30, y: p.y + p.face.y * 30 - 14, dur: 0.22, color: '#ffb040', r: 34 });
    },
  },
  whirlwind: {
    id: 'whirlwind', icon: '🌀', mp: 15, cd: 8, bot: { kind: 'atk', range: 70 },
    cast(g, p) {
      g.aoeDamage(p, p.x, p.y, 78, 1.5, '#ff8060');
      g.addEffect({ type: 'ring', x: p.x, y: p.y - 10, dur: 0.35, color: '#ff8060', r: 78 });
    },
  },
  warcry: {
    id: 'warcry', icon: '💢', mp: 12, cd: 16, bot: { kind: 'buff' },
    cast(g, p) {
      p.addBuff({ tag: 'warcry', kind: 'dmgMul', v: 1.35, t: 8, icon: '💢', name: 'buff.warcry' });
      g.addEffect({ type: 'ring', x: p.x, y: p.y - 10, dur: 0.5, color: '#ff4040', r: 50 });
      g.sfx('buff');
    },
  },
  fireball: {
    id: 'fireball', icon: '🔥', mp: 10, cd: 2.5, bot: { kind: 'atk', range: 300 },
    cast(g, p) {
      g.spawnProjectile(p, 1.7, { speed: 300, color: '#ff7030', size: 6, aoe: 46 });
    },
  },
  frostnova: {
    id: 'frostnova', icon: '❄️', mp: 16, cd: 9, bot: { kind: 'atk', range: 90 },
    cast(g, p) {
      g.aoeDamage(p, p.x, p.y, 100, 1.1, '#a0e0ff', { slow: 3 });
      g.addEffect({ type: 'ring', x: p.x, y: p.y - 10, dur: 0.45, color: '#a0e0ff', r: 100 });
    },
  },
  thunder: {
    id: 'thunder', icon: '⚡', mp: 20, cd: 12, bot: { kind: 'atk', range: 180 },
    cast(g, p) {
      const targets = g.nearestEnemies(p.x, p.y, 190, 3);
      if (!targets.length) return false;
      for (const e of targets) {
        g.dealDamage(p, e, 1.9, '#ffe95e');
        g.addEffect({ type: 'bolt', x: e.x, y: e.y, dur: 0.25, color: '#ffe95e', r: 40 });
      }
    },
  },
  powershot: {
    id: 'powershot', icon: '🏹', mp: 8, cd: 4, bot: { kind: 'atk', range: 340 },
    cast(g, p) {
      g.spawnProjectile(p, 2.1, { speed: 560, color: '#ffe080', size: 4, pierce: true });
    },
  },
  multishot: {
    id: 'multishot', icon: '🎯', mp: 14, cd: 7, bot: { kind: 'atk', range: 280 },
    cast(g, p) {
      for (const a of [-0.3, 0, 0.3]) g.spawnProjectile(p, 1.15, { speed: 440, color: '#d8c8a0', size: 3, angleOffset: a });
    },
  },
  swift: {
    id: 'swift', icon: '💨', mp: 10, cd: 12, bot: { kind: 'buff' },
    cast(g, p) {
      p.addBuff({ tag: 'swift', kind: 'spdMul', v: 1.45, t: 5, icon: '💨', name: 'buff.swift' });
      g.addEffect({ type: 'ring', x: p.x, y: p.y - 10, dur: 0.4, color: '#a0ffc0', r: 40 });
      g.sfx('buff');
    },
  },
  smite: {
    id: 'smite', icon: '✨', mp: 8, cd: 3, bot: { kind: 'atk', range: 300 },
    cast(g, p) {
      g.spawnProjectile(p, 1.5, { speed: 330, color: '#fff0b0', size: 5 });
    },
  },
  heal: {
    id: 'heal', icon: '💚', mp: 15, cd: 8, bot: { kind: 'heal' },
    cast(g, p) {
      const d = deriveStats(p);
      const amount = 25 + d.matk * 1.6;
      for (const ally of g.players) {
        if (ally.dead) continue;
        if (Math.hypot(ally.x - p.x, ally.y - p.y) < 140) {
          g.healEntity(ally, amount);
          g.addEffect({ type: 'ring', x: ally.x, y: ally.y - 10, dur: 0.45, color: '#5ec96a', r: 36 });
        }
      }
      g.sfx('heal');
    },
  },
  sanctuary: {
    id: 'sanctuary', icon: '🕊️', mp: 20, cd: 18, bot: { kind: 'heal' },
    cast(g, p) {
      g.addEffect({ type: 'aura', x: p.x, y: p.y, dur: 6, color: '#ffe9a0', r: 90, healPerSec: 12 + deriveStats(p).matk * 0.6 });
      g.sfx('heal');
    },
  },
};

/* ---------- Enemies ----------
 * Base values; scaled by zone tier when spawned.
 */
const ENEMY_TYPES = {
  slime:    { sprite: 'slime',    hp: 30,  dmg: 5,  speed: 55,  xp: 12,  gold: [1, 3],  aggro: 120, scale: 3 },
  goblin:   { sprite: 'goblin',   hp: 55,  dmg: 9,  speed: 85,  xp: 22,  gold: [2, 5],  aggro: 150, scale: 3 },
  wolf:     { sprite: 'wolf',     hp: 75,  dmg: 13, speed: 130, xp: 34,  gold: [2, 6],  aggro: 190, scale: 3 },
  bat:      { sprite: 'bat',      hp: 60,  dmg: 11, speed: 110, xp: 30,  gold: [3, 7],  aggro: 170, scale: 3 },
  skeleton: { sprite: 'skeleton', hp: 90,  dmg: 15, speed: 75,  xp: 50,  gold: [4, 9],  aggro: 230, scale: 3, ranged: true, shootRange: 210, keepDist: 150 },
  demon:    { sprite: 'demon',    hp: 1400, dmg: 34, speed: 95, xp: 900, gold: [80, 150], aggro: 260, scale: 5, ranged: true, shootRange: 240, keepDist: 60, boss: true },

  // ---- Future content (defined but NOT in TIER_ENEMIES yet, so they don't
  // spawn until a system wires them in; art in js/sprites.js). ----
  orc:      { sprite: 'orc',      hp: 120,  dmg: 18, speed: 80,  xp: 70,   gold: [5, 12],    aggro: 200, scale: 3 },
  ghost:    { sprite: 'ghost',    hp: 85,   dmg: 16, speed: 105, xp: 55,   gold: [4, 10],    aggro: 190, scale: 3, ranged: true, shootRange: 200, keepDist: 120 },
  ogre:     { sprite: 'ogre',     hp: 600,  dmg: 26, speed: 70,  xp: 400,  gold: [40, 80],   aggro: 230, scale: 4, miniboss: true },
  dragon:   { sprite: 'dragon',   hp: 3200, dmg: 48, speed: 90,  xp: 2200, gold: [200, 400], aggro: 280, scale: 6, ranged: true, shootRange: 300, keepDist: 80, boss: true, worldboss: true },
};

/* Which enemies appear in each zone tier (0 = safe, no spawns) */
const TIER_ENEMIES = {
  1: ['slime', 'slime', 'goblin'],
  2: ['goblin', 'wolf', 'bat', 'slime'],
  3: ['wolf', 'bat', 'skeleton'],
  4: ['skeleton', 'bat', 'wolf'],
};

/* Multipliers per tier */
function tierScale(tier) {
  return { hp: 1 + (tier - 1) * 0.8, dmg: 1 + (tier - 1) * 0.55, xp: 1 + (tier - 1) * 0.7 };
}

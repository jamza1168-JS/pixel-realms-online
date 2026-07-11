/* ============================================================
 * items.js — Items: potions, armor, weapons, tiers, random stats
 *
 * An item instance looks like:
 *   { uid, key, kind:'weapon'|'armor'|'potion', slot?, tier?, ilvl?,
 *     rows:[{stat,val}], count? }
 * Gear (weapon/armor) carries a tier and 3 randomly-rolled stat rows,
 * so two drops of the same base are almost never identical.
 * Potions stack (count) and have no rolls.
 * ============================================================ */

/* ---------- Tiers ---------- */
const ITEM_TIERS = {
  common: { key: 'common', color: '#c2c8d6', mult: 1.0, weight: 58 },
  rare:   { key: 'rare',   color: '#4a9eff', mult: 1.5, weight: 26 },
  unique: { key: 'unique', color: '#b45eff', mult: 2.1, weight: 11 },
  legend: { key: 'legend', color: '#ff9a30', mult: 3.0, weight: 4 },
  mystic: { key: 'mystic', color: '#ff4d6d', mult: 4.3, weight: 1 },
};
const TIER_ORDER = ['common', 'rare', 'unique', 'legend', 'mystic'];

/* ---------- Equipment slots ---------- */
/* 'hands' holds the weapon; the rest are armor pieces. */
const EQUIP_SLOTS = ['head', 'chest', 'hands', 'legs', 'boots'];

const ARMOR = {
  head:  { key: 'head',  slot: 'head',  kind: 'armor', icon: '🪖' },
  chest: { key: 'chest', slot: 'chest', kind: 'armor', icon: '🛡️' },
  legs:  { key: 'legs',  slot: 'legs',  kind: 'armor', icon: '👖' },
  boots: { key: 'boots', slot: 'boots', kind: 'armor', icon: '🥾' },
};

/* Weapons all occupy the 'hands' slot. `base` modifiers:
 *   dmgMul  — multiplies attack/skill damage
 *   aspdMul — attack-speed (higher = faster)
 *   spd     — flat move-speed bonus
 * one-handed sword is light & fast (shield-pairing planned); the
 * two-hander trades speed for raw damage. */
const WEAPONS = {
  sword1h: { key: 'sword1h', slot: 'hands', kind: 'weapon', icon: '🗡️', two: false, base: { dmgMul: 1.0, aspdMul: 1.15, spd: 10 } },
  sword2h: { key: 'sword2h', slot: 'hands', kind: 'weapon', icon: '⚔️', two: true,  base: { dmgMul: 1.6, aspdMul: 0.82, spd: -12 } },
  staff:   { key: 'staff',   slot: 'hands', kind: 'weapon', icon: '🪄', two: true,  base: { dmgMul: 1.35, aspdMul: 0.95, spd: 0 } },
  bow:     { key: 'bow',     slot: 'hands', kind: 'weapon', icon: '🏹', two: true,  base: { dmgMul: 1.2, aspdMul: 1.05, spd: 4 } },
};

/* ---------- Potions ---------- */
/* heal: restore a % of max HP/MP instantly; buff: timed effect. */
const POTIONS = {
  hp:    { key: 'hp',    kind: 'potion', icon: '🧪', color: '#e8484f', price: 25,  heal: 'hp', pct: 0.5 },
  mp:    { key: 'mp',    kind: 'potion', icon: '🔷', color: '#3d8bff', price: 25,  heal: 'mp', pct: 0.5 },
  spd:   { key: 'spd',   kind: 'potion', icon: '👟', color: '#5ec96a', price: 60,  buff: { tag: 'pot_spd',   kind: 'spdMul',   v: 1.30, t: 30, icon: '👟', name: 'buff.pot_spd' } },
  atk:   { key: 'atk',   kind: 'potion', icon: '💥', color: '#ff9a30', price: 60,  buff: { tag: 'pot_atk',   kind: 'dmgMul',   v: 1.30, t: 30, icon: '💥', name: 'buff.pot_atk' } },
  aspd:  { key: 'aspd',  kind: 'potion', icon: '⚡', color: '#a0e0ff', price: 60,  buff: { tag: 'pot_aspd',  kind: 'aspdMul',  v: 1.25, t: 30, icon: '⚡', name: 'buff.pot_aspd' } },
  regen: { key: 'regen', kind: 'potion', icon: '💚', color: '#7ee98a', price: 60,  buff: { tag: 'pot_regen', kind: 'regenMul', v: 3.0,  t: 30, icon: '💚', name: 'buff.pot_regen' } },
};

/* ---------- Rollable stats (affixes) ---------- */
/* stat keys map onto the character sheet:
 *   str/agi/int/vit/luk add to base stats; hp/mp/atk/matk/crit/spd
 *   add directly to the derived outputs. */
const AFFIXES = [
  { stat: 'str',  min: 1,  max: 5 },
  { stat: 'agi',  min: 1,  max: 5 },
  { stat: 'int',  min: 1,  max: 5 },
  { stat: 'vit',  min: 1,  max: 5 },
  { stat: 'luk',  min: 1,  max: 5 },
  { stat: 'hp',   min: 12, max: 45 },
  { stat: 'mp',   min: 6,  max: 22 },
  { stat: 'atk',  min: 2,  max: 9 },
  { stat: 'matk', min: 2,  max: 9 },
  { stat: 'crit', min: 1,  max: 6 },
  { stat: 'spd',  min: 2,  max: 9 },
];
const AFFIX_KEYS = AFFIXES.map(a => a.stat);
const ROWS_PER_ITEM = 3;

let _uidN = 0;
function itemUid() { return 'it' + (Date.now().toString(36)) + (_uidN++).toString(36); }

/* Weighted tier roll. Accepts either:
 *   - a number (legacy `bias`): shifts luck toward rarer tiers, or
 *   - an options object:
 *       { weights: {tierKey: w, ...} } — roll ONLY among the listed tiers
 *         (this is how monster archetypes floor/cap their drops, e.g. a
 *         boss rolls only unique/legend — see data.js TIER_DROP), or
 *       { bias } — the legacy behaviour above.
 * A tier absent from `weights` (or with weight 0) can never roll. */
function rollTier(opts = 0) {
  if (typeof opts === 'number') opts = { bias: opts };
  let entries;
  if (opts.weights) {
    entries = TIER_ORDER.filter(k => (opts.weights[k] || 0) > 0)
                        .map(k => [k, opts.weights[k]]);
    if (!entries.length) entries = [['common', 1]];   // never empty
  } else {
    const bias = opts.bias || 0;
    entries = TIER_ORDER.map((k, i) => [k, ITEM_TIERS[k].weight * Math.pow(1 + bias * 0.5, i)]);
  }
  const total = entries.reduce((a, e) => a + e[1], 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
}

/* Roll one gear item.
 * opts: { kind:'weapon'|'armor', key?, tier?, ilvl?, bias?, tierWeights? }
 *   tier        — force an exact tier (tests, guaranteed rewards)
 *   tierWeights — {tierKey: w} map constraining which tiers may roll
 *   bias        — legacy rarer-tier nudge (fallback if neither above given) */
function rollItem(opts = {}) {
  const kind = opts.kind || (Math.random() < 0.4 ? 'weapon' : 'armor');
  const tierKey = opts.tier
    || rollTier(opts.tierWeights ? { weights: opts.tierWeights } : { bias: opts.bias || 0 });
  const tier = ITEM_TIERS[tierKey];
  const ilvl = Math.max(1, opts.ilvl || 1);
  const table = kind === 'weapon' ? WEAPONS : ARMOR;
  const baseKey = opts.key || pickRandom(Object.keys(table));
  const base = table[baseKey];
  const ilvlScale = 1 + (ilvl - 1) * 0.12;

  // pick 3 distinct affixes and roll each, scaled by tier + item level
  const pool = AFFIXES.slice();
  const rows = [];
  for (let i = 0; i < ROWS_PER_ITEM && pool.length; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const raw = a.min + Math.random() * (a.max - a.min);
    const val = Math.max(1, Math.round(raw * tier.mult * ilvlScale));
    rows.push({ stat: a.stat, val });
  }
  return {
    uid: itemUid(), key: baseKey, kind, slot: base.slot,
    tier: tierKey, ilvl, rows,
  };
}

function makePotion(key, count = 1) {
  return { uid: itemUid(), key, kind: 'potion', count };
}

/* Gold a merchant pays for an item (gear scales with tier + level). */
function sellValue(item) {
  if (item.kind === 'potion') return Math.max(1, Math.floor((POTIONS[item.key].price || 20) * 0.4)) * (item.count || 1);
  const ti = TIER_ORDER.indexOf(item.tier);
  return Math.round((ti + 1) * 14 * (1 + ((item.ilvl || 1) - 1) * 0.1));
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* Sort rank for a gear tier (mystic highest); potions sort last. */
function tierRank(item) { return item.kind === 'potion' ? -1 : TIER_ORDER.indexOf(item.tier); }

/* A gear item's flat stat contribution, for side-by-side comparison.
 * Merges rolled rows with the weapon base modifiers (as readable fields). */
function itemStatMap(item) {
  const m = {};
  if (!item || (item.kind !== 'weapon' && item.kind !== 'armor')) return m;
  for (const r of item.rows) m[r.stat] = (m[r.stat] || 0) + r.val;
  const base = itemBase(item);
  if (base && base.base) {
    if (base.base.dmgMul && base.base.dmgMul !== 1) m.dmgMul = Math.round((base.base.dmgMul - 1) * 100);
    if (base.base.aspdMul && base.base.aspdMul !== 1) m.aspdMul = Math.round((base.base.aspdMul - 1) * 100);
    if (base.base.spd) m.spd = (m.spd || 0) + base.base.spd;
  }
  return m;
}

/* Template lookup for any item instance. */
function itemBase(item) {
  if (item.kind === 'potion') return POTIONS[item.key];
  if (item.kind === 'weapon') return WEAPONS[item.key];
  return ARMOR[item.key];
}

function itemIcon(item) { const b = itemBase(item); return b ? b.icon : '❓'; }
function itemColor(item) {
  if (item.kind === 'potion') return POTIONS[item.key].color;
  return (ITEM_TIERS[item.tier] || ITEM_TIERS.common).color;
}

/* i18n display name: potions by key; gear = "<Tier> <Base>". */
function itemName(item) {
  if (item.kind === 'potion') return t('item.' + item.key);
  const base = t('gear.' + item.key);
  return t('tier.' + item.tier) + ' ' + base;
}

/* Export a light-weight, save-safe copy (drops runtime-only fields). */
function itemToSave(item) {
  if (item.kind === 'potion') return { key: item.key, kind: 'potion', count: item.count || 1 };
  return { uid: item.uid, key: item.key, kind: item.kind, slot: item.slot, tier: item.tier, ilvl: item.ilvl, rows: item.rows };
}

function itemFromSave(o) {
  if (!o || !o.kind) return null;
  if (o.kind === 'potion') { return POTIONS[o.key] ? makePotionFrom(o) : null; }
  const table = o.kind === 'weapon' ? WEAPONS : ARMOR;
  if (!table[o.key] || !Array.isArray(o.rows)) return null;
  return { uid: o.uid || itemUid(), key: o.key, kind: o.kind, slot: table[o.key].slot,
           tier: ITEM_TIERS[o.tier] ? o.tier : 'common', ilvl: o.ilvl || 1, rows: o.rows };
}
function makePotionFrom(o) { return { uid: itemUid(), key: o.key, kind: 'potion', count: Math.max(1, o.count | 0) }; }

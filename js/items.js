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

/* Weapon damage scales modestly with tier so rarity is felt on the WEAPON
 * itself, not only in its rolled rows (a mystic blade out-hits a common one
 * of the same base). Applied to weapon `dmgMul` in equipAgg. Kept gentle so
 * the 3 rolled rows stay the main tier payoff; off-hands are unaffected (a
 * shield's defensive dmgMul must not flip positive at high tier). */
const WEAPON_TIER_DMG = { common: 1.0, rare: 1.05, unique: 1.11, legend: 1.18, mystic: 1.26 };
function weaponTierMul(tier) { return WEAPON_TIER_DMG[tier] || 1.0; }

/* ---------- Equipment slots ---------- */
/* 'hands' holds the weapon, 'offhand' the shield/book/quiver (P4a); the rest
 * are armor pieces. deriveStats/equipAgg/spSig iterate EQUIP_SLOTS, so new
 * slots thread through automatically. */
const EQUIP_SLOTS = ['head', 'chest', 'hands', 'offhand', 'gloves', 'legs', 'boots', 'acc1', 'acc2'];

const ARMOR = {
  head:   { key: 'head',   slot: 'head',   kind: 'armor', icon: '🪖' },
  chest:  { key: 'chest',  slot: 'chest',  kind: 'armor', icon: '🛡️' },
  gloves: { key: 'gloves', slot: 'gloves', kind: 'armor', icon: '🧤' },
  legs:   { key: 'legs',   slot: 'legs',   kind: 'armor', icon: '👖' },
  boots:  { key: 'boots',  slot: 'boots',  kind: 'armor', icon: '🥾' },
};

/* Weapons all occupy the 'hands' slot. `base` modifiers:
 *   dmgMul  — multiplies attack/skill damage
 *   aspdMul — attack-speed (higher = faster)
 *   spd     — flat move-speed bonus
 * `two:false` weapons pair with an off-hand. `classes` (P4a, new weapons
 * only) restricts who can equip; the original weapons stay class-free so no
 * existing loadout breaks. */
const WEAPONS = {
  sword1h: { key: 'sword1h', slot: 'hands', kind: 'weapon', icon: '🗡️', two: false, base: { dmgMul: 1.0, aspdMul: 1.15, spd: 10 } },
  sword2h: { key: 'sword2h', slot: 'hands', kind: 'weapon', icon: '⚔️', two: true,  base: { dmgMul: 1.6, aspdMul: 0.82, spd: -12 } },
  staff:   { key: 'staff',   slot: 'hands', kind: 'weapon', icon: '🪄', two: true,  base: { dmgMul: 1.35, aspdMul: 0.95, spd: 0 } },
  bow:     { key: 'bow',     slot: 'hands', kind: 'weapon', icon: '🏹', two: true,  base: { dmgMul: 1.2, aspdMul: 1.05, spd: 4 } },
  // one-handers so casters/clerics can pair an off-hand (P4a)
  mace1h:  { key: 'mace1h',  slot: 'hands', kind: 'weapon', icon: '🔨', two: false, classes: ['warrior', 'cleric'], base: { dmgMul: 1.05, aspdMul: 1.0, spd: 4 } },
  wand1h:  { key: 'wand1h',  slot: 'hands', kind: 'weapon', icon: '🥢', two: false, classes: ['mage'],              base: { dmgMul: 0.95, aspdMul: 1.2, spd: 6 } },
  // crossbow: archer 2-hand alt — big damage, slow, no quiver (P4b)
  crossbow:{ key: 'crossbow',slot: 'hands', kind: 'weapon', icon: '🎱', two: true,  classes: ['archer'],            base: { dmgMul: 1.45, aspdMul: 0.8, spd: 0 } },
};

/* Accessories (P4b): two interchangeable `acc1`/`acc2` slots. Their item
 * `slot` is the generic 'acc'; equipItem/slotAccepts route them into a free
 * accessory slot. Rows are SPICE-only (primary stats + crit/spd, never flat
 * hp/mp/atk/matk — see ACC_AFFIXES), so they add flavour, not raw power. */
const ACCESSORIES = {
  ring:   { key: 'ring',   slot: 'acc', kind: 'accessory', icon: '💍' },
  amulet: { key: 'amulet', slot: 'acc', kind: 'accessory', icon: '📿' },
};
const ACC_ROW_STATS = ['str', 'agi', 'int', 'vit', 'luk', 'crit', 'spd'];

/* Which equip position(s) an item may occupy. Accessories fit acc1 or acc2. */
function slotAccepts(slot, item) {
  if (!isGear(item)) return false;
  if (slot === 'acc1' || slot === 'acc2') return item.kind === 'accessory';
  return item.slot === slot;
}

/* Off-hands occupy the 'offhand' slot and pair with a one-hand weapon
 * (`needsOneHand`), except the quiver which pairs with the two-hand bow
 * (`pairWith`). `dmgRed` = flat % damage reduction (shields). */
const OFFHANDS = {
  shield: { key: 'shield', slot: 'offhand', kind: 'offhand', icon: '🛡️', classes: ['warrior', 'cleric'], needsOneHand: true, base: { dmgMul: 0.92, dmgRed: 0.10 } },
  book:   { key: 'book',   slot: 'offhand', kind: 'offhand', icon: '📖', classes: ['mage', 'cleric'],     needsOneHand: true, base: { dmgMul: 1.12 } },
  quiver: { key: 'quiver', slot: 'offhand', kind: 'offhand', icon: '🎯', classes: ['archer'],             pairWith: 'bow',    base: { aspdMul: 1.08, spd: 4 } },
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
  // Teleport scroll (Phase 2c): a consumable that warps you to the village.
  tele:  { key: 'tele',  kind: 'potion', icon: '📜', color: '#c9a0ff', price: 80,  warp: 'village' },
  // Cooked food (P5c): crafted from fish, never shop-bought (`craftOnly`).
  // A slow-regen buff on its OWN tag so it stacks alongside a regen potion.
  // Zero combat power — a social/idle life-skill reward, not P2W.
  food:  { key: 'food',  kind: 'potion', icon: '🍢', color: '#e0a95e', price: 0, craftOnly: true,
           buff: { tag: 'food_regen', kind: 'regenMul', v: 2.0, t: 60, icon: '🍢', name: 'buff.food' } },
};

/* ---------- Materials (Phase 2b) ----------
 * Stackable crafting resources. `ore` fuels gear refining. Materials have
 * no rolls and stack by key like potions. */
const MATERIALS = {
  ore:   { key: 'ore',   kind: 'material', icon: '🪨', color: '#b79b6e', price: 12 },
  key:   { key: 'key',   kind: 'material', icon: '🗝️', color: '#e8c860', price: 4 },
  // Awakening Stone (P5a): boss-only drop that adds a 4th affix row to a
  // gear item, once. Never sold for money.
  stone: { key: 'stone', kind: 'material', icon: '✦',  color: '#ff5db1', price: 0 },
  // Fish (P5c): caught at water tiles; cook 3 into a food consumable.
  fish:  { key: 'fish',  kind: 'material', icon: '🐟', color: '#7fb0d0', price: 3 },
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

function baseTable(kind) {
  if (kind === 'weapon') return WEAPONS;
  if (kind === 'offhand') return OFFHANDS;
  if (kind === 'accessory') return ACCESSORIES;
  return ARMOR;
}

/* Roll one gear item.
 * opts: { kind:'weapon'|'armor'|'offhand'|'accessory', key?, tier?, ilvl?,
 *         bias?, tierWeights?, classHint? }
 *   tier        — force an exact tier (tests, guaranteed rewards)
 *   tierWeights — {tierKey: w} map constraining which tiers may roll
 *   bias        — legacy rarer-tier nudge (fallback if neither above given)
 *   classHint   — bias weapon/off-hand base picks to a class's usable set */
function rollItem(opts = {}) {
  let kind = opts.kind;
  if (!kind) {
    const r = Math.random();
    kind = r < 0.26 ? 'weapon' : (r < 0.42 ? 'offhand' : (r < 0.56 ? 'accessory' : 'armor'));
  }
  const tierKey = opts.tier
    || rollTier(opts.tierWeights ? { weights: opts.tierWeights } : { bias: opts.bias || 0 });
  const tier = ITEM_TIERS[tierKey];
  const ilvl = Math.max(1, opts.ilvl || 1);
  const table = baseTable(kind);
  let baseKey = opts.key;
  if (!baseKey) {
    let keys = Object.keys(table);
    if (opts.classHint && (kind === 'weapon' || kind === 'offhand')) {
      const usable = keys.filter(k => !table[k].classes || table[k].classes.includes(opts.classHint));
      if (usable.length) keys = usable;
    }
    baseKey = pickRandom(keys);
  }
  const base = table[baseKey];
  const ilvlScale = 1 + (ilvl - 1) * 0.12;

  // pick 3 distinct affixes and roll each, scaled by tier + item level.
  // Accessories use a SPICE-only affix pool (no flat hp/mp/atk/matk).
  const pool = (kind === 'accessory' ? AFFIXES.filter(a => ACC_ROW_STATS.includes(a.stat)) : AFFIXES.slice());
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

function makeMaterial(key, count = 1) {
  return { uid: itemUid(), key, kind: 'material', count };
}

/* Items that stack by key (count), rather than being unique instances. */
function isStackable(item) { return item.kind === 'potion' || item.kind === 'material'; }

/* ---------- Refine (Phase 2b, docs/REBALANCE.md §9.1) ----------
 * Upgrade a gear piece +0→+9. Each step boosts its power (weapon damage /
 * armor rolled rows — applied in equipAgg). Costs gold + ore; can fail past
 * +4 and drop a step, but never destroys the item. `refine` rides on the
 * item and is clamped 0..MAX_REFINE server-side. */
const MAX_REFINE = 9;
const REFINE_ODDS = [1, 1, 1, 1, 0.8, 0.7, 0.6, 0.5, 0.4];   // index = current level → next
const COOK_COST = 3;   // fish → one food consumable (P5c)

function refineCost(item) {
  const mult = (ITEM_TIERS[item.tier] || ITEM_TIERS.common).mult;
  const r = item.refine || 0;
  return { gold: Math.round(150 * mult * (r + 1) * (r + 1)), ore: r + 1 };
}

/* Success chance for the NEXT refine step (0 if already maxed). */
function refineChance(item) {
  const r = item.refine || 0;
  return r >= MAX_REFINE ? 0 : REFINE_ODDS[r];
}

/* Per-level power bonus applied to an equipped item (see equipAgg):
 *   weapon → +4% damage per level; armor → +3% to rolled rows per level. */
function refineWeaponMul(r) { return 1 + 0.04 * (r || 0); }
function refineArmorMul(r) { return 1 + 0.03 * (r || 0); }

/* ---------- Reforge (Phase 2a, docs/REBALANCE.md §9.1) ----------
 * Reroll ONE chosen affix row's value in place. A per-item counter `rr`
 * makes each successive reforge on the same item cost more — the endgame
 * gold sink. The new value uses the exact same row math as rollItem
 * (tier mult × item-level scale), so it can never exceed the server's
 * row_cap; no extra clamp is needed. */
function reforgeCost(item) {
  const mult = (ITEM_TIERS[item.tier] || ITEM_TIERS.common).mult;
  const n = item.rr || 0;
  return Math.round(200 * mult * Math.pow(2, n));
}

/* Reroll row `rowIdx` (same stat, fresh value). Returns the new value,
 * or null if the row/stat is invalid. Increments `rr`. */
function reforgeRow(item, rowIdx) {
  if (!item || (item.kind !== 'weapon' && item.kind !== 'armor')) return null;
  const row = item.rows && item.rows[rowIdx];
  if (!row) return null;
  const aff = AFFIXES.find(a => a.stat === row.stat);
  if (!aff) return null;
  const tier = ITEM_TIERS[item.tier] || ITEM_TIERS.common;
  const ilvlScale = 1 + ((item.ilvl || 1) - 1) * 0.12;
  const raw = aff.min + Math.random() * (aff.max - aff.min);
  row.val = Math.max(1, Math.round(raw * tier.mult * ilvlScale));
  item.rr = (item.rr || 0) + 1;
  return row.val;
}

/* ---------- Awakening (P5a) ----------
 * Add a 4th affix row to a gear item, once (`awakened`). The new row is a
 * stat the item doesn't already have (accessories draw from the spice pool),
 * rolled with the same tier/ilvl math as a drop — so it stays within the
 * server row_cap. Returns the new row, or null if it can't be awakened. */
const AWAKEN_ROWS = ROWS_PER_ITEM + 1;   // 4
function canAwaken(item) {
  return isGear(item) && !item.awakened && (item.rows ? item.rows.length : 0) < AWAKEN_ROWS;
}
function awakenItem(item) {
  if (!canAwaken(item)) return null;
  const poolStats = item.kind === 'accessory' ? ACC_ROW_STATS : AFFIX_KEYS;
  const used = new Set(item.rows.map(r => r.stat));
  const choices = AFFIXES.filter(a => poolStats.includes(a.stat) && !used.has(a.stat));
  if (!choices.length) return null;
  const a = pickRandom(choices);
  const tier = ITEM_TIERS[item.tier] || ITEM_TIERS.common;
  const ilvlScale = 1 + ((item.ilvl || 1) - 1) * 0.12;
  const val = Math.max(1, Math.round((a.min + Math.random() * (a.max - a.min)) * tier.mult * ilvlScale));
  const row = { stat: a.stat, val };
  item.rows.push(row);
  item.awakened = true;
  return row;
}

/* Gold a merchant pays for an item (gear scales with tier + level). */
function sellValue(item) {
  if (item.kind === 'potion') return Math.max(1, Math.floor((POTIONS[item.key].price || 20) * 0.4)) * (item.count || 1);
  if (item.kind === 'material') return Math.max(1, Math.floor(((MATERIALS[item.key] || {}).price || 10) * 0.5)) * (item.count || 1);
  const ti = TIER_ORDER.indexOf(item.tier);
  return Math.round((ti + 1) * 14 * (1 + ((item.ilvl || 1) - 1) * 0.1));
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* Sort rank for the inventory grid: gear by tier (mystic highest), then
 * potions, then materials last. */
function tierRank(item) {
  if (item.kind === 'material') return -2;
  if (item.kind === 'potion') return -1;
  return TIER_ORDER.indexOf(item.tier);
}

/* True for rolled gear (weapon/armor/off-hand/accessory) — tier+rows items. */
function isGear(item) { return item && (item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'offhand' || item.kind === 'accessory'); }

/* A gear item's flat stat contribution, for side-by-side comparison.
 * Merges rolled rows with the weapon/off-hand base modifiers. */
function itemStatMap(item) {
  const m = {};
  if (!isGear(item)) return m;
  for (const r of item.rows) m[r.stat] = (m[r.stat] || 0) + r.val;
  const base = itemBase(item);
  if (base && base.base) {
    // weapons fold in the tier damage bonus so higher rarity reads as +dmg%
    const effDmgMul = (base.base.dmgMul || 0) * (item.kind === 'weapon' ? weaponTierMul(item.tier) : 1);
    if (effDmgMul && effDmgMul !== 1) m.dmgMul = Math.round((effDmgMul - 1) * 100);
    if (base.base.aspdMul && base.base.aspdMul !== 1) m.aspdMul = Math.round((base.base.aspdMul - 1) * 100);
    if (base.base.spd) m.spd = (m.spd || 0) + base.base.spd;
    if (base.base.dmgRed) m.dmgRed = (m.dmgRed || 0) + Math.round(base.base.dmgRed * 100);
  }
  return m;
}

/* Template lookup for any item instance. */
function itemBase(item) {
  if (item.kind === 'potion') return POTIONS[item.key];
  if (item.kind === 'material') return MATERIALS[item.key];
  if (item.kind === 'weapon') return WEAPONS[item.key];
  if (item.kind === 'offhand') return OFFHANDS[item.key];
  if (item.kind === 'accessory') return ACCESSORIES[item.key];
  return ARMOR[item.key];
}

function itemIcon(item) { const b = itemBase(item); return b ? b.icon : '❓'; }
function itemColor(item) {
  if (item.kind === 'potion') return POTIONS[item.key].color;
  if (item.kind === 'material') return (MATERIALS[item.key] || {}).color || '#c2c8d6';
  return (ITEM_TIERS[item.tier] || ITEM_TIERS.common).color;
}

/* i18n display name: potions/materials by key; gear = "<Tier> <Base>" with
 * a "+R" refine suffix when refined. */
function itemName(item) {
  if (item.kind === 'potion') return t('item.' + item.key);
  if (item.kind === 'material') return t('mat.' + item.key);
  const base = t('tier.' + item.tier) + ' ' + t('gear.' + item.key);
  return item.refine ? base + ' +' + item.refine : base;
}

/* Export a light-weight, save-safe copy (drops runtime-only fields). */
function itemToSave(item) {
  if (item.kind === 'potion') return { key: item.key, kind: 'potion', count: item.count || 1 };
  if (item.kind === 'material') return { key: item.key, kind: 'material', count: item.count || 1 };
  return { uid: item.uid, key: item.key, kind: item.kind, slot: item.slot, tier: item.tier,
           ilvl: item.ilvl, rows: item.rows, rr: item.rr || 0, refine: item.refine || 0,
           awakened: item.awakened ? 1 : 0 };
}

function itemFromSave(o) {
  if (!o || !o.kind) return null;
  if (o.kind === 'potion') { return POTIONS[o.key] ? makePotionFrom(o) : null; }
  if (o.kind === 'material') { return MATERIALS[o.key] ? makeMaterialFrom(o) : null; }
  const table = baseTable(o.kind);
  if (!table[o.key] || !Array.isArray(o.rows)) return null;
  const awakened = !!o.awakened;
  return { uid: o.uid || itemUid(), key: o.key, kind: o.kind, slot: table[o.key].slot,
           tier: ITEM_TIERS[o.tier] ? o.tier : 'common', ilvl: o.ilvl || 1,
           rows: o.rows.slice(0, awakened ? AWAKEN_ROWS : ROWS_PER_ITEM),
           rr: Math.max(0, o.rr | 0), refine: Math.max(0, Math.min(MAX_REFINE, o.refine | 0)), awakened };
}
function makePotionFrom(o) { return { uid: itemUid(), key: o.key, kind: 'potion', count: Math.max(1, o.count | 0) }; }
function makeMaterialFrom(o) { return { uid: itemUid(), key: o.key, kind: 'material', count: Math.max(1, o.count | 0) }; }

/* ============================================================
 * world.js — Procedural tile world, collision, zones, spawns
 * ============================================================ */

const TILE = 32;
const MAP_W = 120;
const MAP_H = 120;
const WORLD_SEED = 20260707;

/* Tile ids */
const T_GRASS = 0, T_WATER = 1, T_SAND = 2, T_PATH = 3, T_ASH = 4;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Maps (P3): the shared hub + solo biome zones ----------
 * The hub (Map 1) is the existing multiplayer world, unchanged. Biome maps
 * are separate seeded worlds reached through warp portals; for now they are
 * SOLO instances (see docs/REBALANCE.md §9.2). `seedXor` gives each its own
 * deterministic layout; `band` is its intended level range. */
const MAPS = {
  hub:    { id: 'hub',    biome: 'grass',  seedXor: 0,          band: [1, 6],  pool: null },
  forest: { id: 'forest', biome: 'forest', seedXor: 0x1a2b3c4d, band: [5, 10], pool: ['wolf', 'bat', 'ghost', 'goblin'] },
};

class World {
  constructor(mapId = 'hub') {
    this.mapId = MAPS[mapId] ? mapId : 'hub';
    this.map = MAPS[this.mapId];
    this.tiles = new Uint8Array(MAP_W * MAP_H);
    this.objects = new Map();          // "x,y" -> {type, x, y} solid decorations
    this.solid = new Uint8Array(MAP_W * MAP_H);
    this.spawnPoints = [];             // enemy spawn definitions
    this.spawnX = (MAP_W / 2) * TILE;  // village / entry center (pixels)
    this.spawnY = (MAP_H / 2) * TILE;
    this.bossPos = null;
    this.chests = [];
    this.portals = [];                 // warp portals (P3)
    this.generate();
    this.bake();
  }

  generate() {
    if (this.map.biome === 'forest') return this.generateForest();
    return this.generateHub();
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T_WATER;
    return this.tiles[ty * MAP_W + tx];
  }

  isSolid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return this.solid[ty * MAP_W + tx] === 1;
  }

  /* Distance (in tiles) from village center → difficulty tier 0..4 */
  tierAt(px, py) {
    const d = Math.hypot(px - this.spawnX, py - this.spawnY) / TILE;
    if (d < 13) return 0;
    if (d < 28) return 1;
    if (d < 44) return 2;
    if (d < 60) return 3;
    return 4;
  }

  generateHub() {
    const rng = mulberry32(WORLD_SEED);
    const cx = MAP_W / 2, cy = MAP_H / 2;

    // Base grass; ash far from the village; water border + lakes
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const d = Math.hypot(x - cx, y - cy);
        let tile = T_GRASS;
        if (d > 60) tile = T_ASH;
        if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) tile = T_WATER;
        this.tiles[y * MAP_W + x] = tile;
      }
    }

    // Lakes
    for (let i = 0; i < 10; i++) {
      const lx = 8 + Math.floor(rng() * (MAP_W - 16));
      const ly = 8 + Math.floor(rng() * (MAP_H - 16));
      if (Math.hypot(lx - cx, ly - cy) < 16) continue; // keep village dry
      const r = 3 + rng() * 5;
      for (let y = -r - 1; y <= r + 1; y++) {
        for (let x = -r - 1; x <= r + 1; x++) {
          const tx = Math.round(lx + x), ty = Math.round(ly + y);
          if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) continue;
          const dd = Math.hypot(x, y);
          if (dd < r) this.tiles[ty * MAP_W + tx] = T_WATER;
          else if (dd < r + 1.4 && this.tiles[ty * MAP_W + tx] === T_GRASS) this.tiles[ty * MAP_W + tx] = T_SAND;
        }
      }
    }

    // Paths radiating from the village
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      let px = cx, py = cy;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      for (let s = 0; s < 52; s++) {
        px += dx + (rng() - 0.5) * 0.8;
        py += dy + (rng() - 0.5) * 0.8;
        const tx = Math.round(px), ty = Math.round(py);
        for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
          const ix = tx + ox, iy = ty + oy;
          if (ix > 1 && iy > 1 && ix < MAP_W - 2 && iy < MAP_H - 2 && this.tiles[iy * MAP_W + ix] !== T_WATER) {
            this.tiles[iy * MAP_W + ix] = T_PATH;
          }
        }
      }
    }

    // Village plaza
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      this.tiles[(cy + y) * MAP_W + (cx + x)] = T_PATH;
    }

    // Water is solid
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] === T_WATER) this.solid[i] = 1;
    }

    // Trees & rocks
    for (let i = 0; i < 1500; i++) {
      const tx = 3 + Math.floor(rng() * (MAP_W - 6));
      const ty = 3 + Math.floor(rng() * (MAP_H - 6));
      const idx = ty * MAP_W + tx;
      if (this.solid[idx] || this.tiles[idx] === T_PATH) continue;
      if (Math.hypot(tx - cx, ty - cy) < 7) continue;
      const isAsh = this.tiles[idx] === T_ASH;
      const roll = rng();
      let type = null;
      if (roll < (isAsh ? 0.35 : 0.62)) type = isAsh ? 'deadTree' : 'tree';
      else if (roll < 0.75) type = 'rock';
      if (type) {
        this.objects.set(tx + ',' + ty, { type, tx, ty });
        this.solid[idx] = 1;
      }
    }

    // Enemy spawn points per tier ring
    const wanted = { 1: 46, 2: 52, 3: 46, 4: 34 };
    for (const tierStr in wanted) {
      const tier = +tierStr;
      let placed = 0, guard = 0;
      while (placed < wanted[tier] && guard++ < 4000) {
        const tx = 3 + Math.floor(rng() * (MAP_W - 6));
        const ty = 3 + Math.floor(rng() * (MAP_H - 6));
        if (this.isSolid(tx, ty)) continue;
        const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
        if (this.tierAt(px, py) !== tier) continue;
        const pool = TIER_ENEMIES[tier];
        const type = pool[Math.floor(rng() * pool.length)];
        // Deterministic elite promotion (tiers 2+ only, so the newbie ring
        // stays gentle). Seeded rng → every client agrees without networking.
        const elite = tier >= 2 && rng() < ELITE_CHANCE;
        this.spawnPoints.push({ x: px, y: py, type, tier, elite, enemy: null, respawnT: 0 });
        placed++;
      }
    }

    // Helper: carve a guaranteed walkable ash clearing around a tile.
    const carveLair = (bx, by) => {
      for (let y = by - 3; y <= by + 3; y++) for (let x = bx - 3; x <= bx + 3; x++) {
        const idx = y * MAP_W + x;
        this.tiles[idx] = T_ASH;
        this.solid[idx] = 0;
        this.objects.delete(x + ',' + y);
      }
      return { x: bx * TILE + TILE / 2, y: by * TILE + TILE / 2 };
    };

    // Boss lair — far north-west
    this.bossPos = carveLair(14, 14);
    this.spawnPoints.push({ x: this.bossPos.x, y: this.bossPos.y, type: 'demon', tier: 4, enemy: null, respawnT: 0, boss: true });

    // Ogre miniboss lair — far north-east tier-4 wastes; roams & respawns
    // on a long timer (Game handles the miniboss respawn cadence).
    this.ogrePos = carveLair(MAP_W - 15, 14);
    this.spawnPoints.push({ x: this.ogrePos.x, y: this.ogrePos.y, type: 'ogre', tier: 4, enemy: null, respawnT: 0, miniboss: true });

    // Dragon WORLD BOSS lair — far south, dead centre of the ash wastes.
    // Not spawned at world-load: the Game's world-boss timer controls it.
    this.worldBossPos = carveLair(MAP_W >> 1, MAP_H - 15);
    this.worldBossSpawn = { x: this.worldBossPos.x, y: this.worldBossPos.y, type: 'dragon', tier: 4, enemy: null, respawnT: 0, worldboss: true };
    this.spawnPoints.push(this.worldBossSpawn);

    // stable ids so networked clients can reference enemies by spawn index
    this.spawnPoints.forEach((sp, i) => { sp.idx = i; });

    // Treasure chests (Phase 2c): seed-placed so every client agrees, but
    // opened LOCALLY (walk onto one carrying a key). `openT` = local time
    // until which it stays opened/hidden before respawning.
    this.chests = [];
    let cPlaced = 0, cGuard = 0;
    while (cPlaced < 16 && cGuard++ < 3000) {
      const tx = 3 + Math.floor(rng() * (MAP_W - 6));
      const ty = 3 + Math.floor(rng() * (MAP_H - 6));
      if (this.isSolid(tx, ty)) continue;
      const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
      if (this.tierAt(px, py) < 1) continue;   // never in the safe village
      this.chests.push({ tx, ty, x: px, y: py, openT: 0, hintT: 0 });
      cPlaced++;
    }

    // Warp portal to the Forest biome (P3), just east of the village plaza.
    const ptx = (MAP_W / 2 + 6) | 0, pty = (MAP_H / 2) | 0;
    for (let y = pty - 1; y <= pty + 1; y++) for (let x = ptx - 1; x <= ptx + 1; x++) {
      const i = y * MAP_W + x;
      if (this.tiles[i] === T_WATER) this.tiles[i] = T_GRASS;
      this.solid[i] = 0;
      this.objects.delete(x + ',' + y);
    }
    this.portals.push({ tx: ptx, ty: pty, x: ptx * TILE + TILE / 2, y: pty * TILE + TILE / 2, to: 'forest' });
    this.entryX = this.spawnX; this.entryY = this.spawnY;
  }

  /* Forest biome (P3): a denser, boss-free solo zone reached from the hub. */
  generateForest() {
    const rng = mulberry32(WORLD_SEED ^ this.map.seedXor);
    const cx = (MAP_W / 2) | 0, cy = (MAP_H / 2) | 0;

    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      let tile = T_GRASS;
      if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) tile = T_WATER;
      this.tiles[y * MAP_W + x] = tile;
    }
    // scattered ponds
    for (let i = 0; i < 8; i++) {
      const lx = 8 + Math.floor(rng() * (MAP_W - 16)), ly = 8 + Math.floor(rng() * (MAP_H - 16));
      if (Math.hypot(lx - cx, ly - cy) < 12) continue;
      const r = 2 + rng() * 4;
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const tx = Math.round(lx + x), ty = Math.round(ly + y);
        if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) continue;
        if (Math.hypot(x, y) < r) this.tiles[ty * MAP_W + tx] = T_WATER;
      }
    }
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === T_WATER) this.solid[i] = 1;

    // dense trees + occasional rocks
    for (let i = 0; i < 2600; i++) {
      const tx = 3 + Math.floor(rng() * (MAP_W - 6)), ty = 3 + Math.floor(rng() * (MAP_H - 6));
      const idx = ty * MAP_W + tx;
      if (this.solid[idx]) continue;
      if (Math.hypot(tx - cx, ty - cy) < 6) continue;   // keep the entry clearing open
      const roll = rng();
      const type = roll < 0.78 ? 'tree' : (roll < 0.9 ? 'rock' : null);
      if (type) { this.objects.set(tx + ',' + ty, { type, tx, ty }); this.solid[idx] = 1; }
    }

    // entry clearing + return portal
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      const i = y * MAP_W + x; this.tiles[i] = T_PATH; this.solid[i] = 0; this.objects.delete(x + ',' + y);
    }
    this.spawnX = cx * TILE + TILE / 2; this.spawnY = cy * TILE + TILE / 2;
    this.entryX = this.spawnX; this.entryY = this.spawnY;
    const rpx = cx + 3, rpy = cy;
    this.solid[rpy * MAP_W + rpx] = 0; this.objects.delete(rpx + ',' + rpy);
    this.portals.push({ tx: rpx, ty: rpy, x: rpx * TILE + TILE / 2, y: rpy * TILE + TILE / 2, to: 'hub' });

    // enemy spawns across the forest (deeper = tougher); elites deterministic
    const pool = this.map.pool;
    let placed = 0, guard = 0;
    while (placed < 90 && guard++ < 6000) {
      const tx = 3 + Math.floor(rng() * (MAP_W - 6)), ty = 3 + Math.floor(rng() * (MAP_H - 6));
      if (this.isSolid(tx, ty)) continue;
      if (Math.hypot(tx - cx, ty - cy) < 8) continue;
      const type = pool[Math.floor(rng() * pool.length)];
      const tier = Math.hypot(tx - cx, ty - cy) > 40 ? 3 : 2;
      const elite = rng() < ELITE_CHANCE;
      this.spawnPoints.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, type, tier, elite, enemy: null, respawnT: 0 });
      placed++;
    }
    this.spawnPoints.forEach((sp, i) => { sp.idx = i; });

    // a few forest chests
    let cp = 0, cg = 0;
    while (cp < 8 && cg++ < 2000) {
      const tx = 3 + Math.floor(rng() * (MAP_W - 6)), ty = 3 + Math.floor(rng() * (MAP_H - 6));
      if (this.isSolid(tx, ty) || Math.hypot(tx - cx, ty - cy) < 10) continue;
      this.chests.push({ tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, openT: 0, hintT: 0 });
      cp++;
    }
  }

  /* Pre-render the whole ground layer once into a big canvas */
  bake() {
    const rng = mulberry32(WORLD_SEED ^ 0x5f5f);
    const c = document.createElement('canvas');
    c.width = MAP_W * TILE; c.height = MAP_H * TILE;
    const g = c.getContext('2d');
    const baseColors = {
      [T_GRASS]: ['#3a7a3f', '#357238', '#40854a'],
      [T_WATER]: ['#2a5a9a', '#275390', '#3060a5'],
      [T_SAND]:  ['#c9b070', '#c0a765', '#d2ba7c'],
      [T_PATH]:  ['#9a8055', '#92794e', '#a2885e'],
      [T_ASH]:   ['#4a4048', '#453b43', '#52464e'],
    };
    const speckColors = {
      [T_GRASS]: '#2e6533', [T_WATER]: '#4a7ec0', [T_SAND]: '#b09858',
      [T_PATH]: '#87704a', [T_ASH]: '#5c505a',
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = this.tiles[y * MAP_W + x];
        const set = baseColors[tile];
        g.fillStyle = set[Math.floor(rng() * set.length)];
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        // pixel speckle texture
        g.fillStyle = speckColors[tile];
        const n = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) {
          const sx = x * TILE + Math.floor(rng() * 8) * 4;
          const sy = y * TILE + Math.floor(rng() * 8) * 4;
          g.fillRect(sx, sy, 4, 4);
        }
        // occasional flowers on grass
        if (tile === T_GRASS && rng() < 0.03) {
          g.fillStyle = ['#e8e060', '#e87080', '#f0f0f0'][Math.floor(rng() * 3)];
          g.fillRect(x * TILE + 12, y * TILE + 12, 4, 4);
        }
      }
    }
    // village marker: simple hut (hub only)
    if (this.mapId === 'hub') {
      const hx = this.spawnX - 40, hy = this.spawnY - 80;
      g.fillStyle = '#6a4a2a'; g.fillRect(hx, hy + 24, 80, 44);
      g.fillStyle = '#8a3030'; g.fillRect(hx - 8, hy, 96, 28);
      g.fillStyle = '#3a2a1a'; g.fillRect(hx + 30, hy + 40, 20, 28);
    }
    this.baked = c;

    // minimap image
    const mm = document.createElement('canvas');
    mm.width = MAP_W; mm.height = MAP_H;
    const mg = mm.getContext('2d');
    const mmColors = { [T_GRASS]: '#3a7a3f', [T_WATER]: '#2a5a9a', [T_SAND]: '#c9b070', [T_PATH]: '#9a8055', [T_ASH]: '#4a4048' };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      mg.fillStyle = this.objects.has(x + ',' + y) ? '#25502a' : mmColors[this.tiles[y * MAP_W + x]];
      mg.fillRect(x, y, 1, 1);
    }
    this.minimapImg = mm;
  }

  /* Straight line between two points crosses no solid tile */
  hasLineOfSight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 12) || 1;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolid(Math.floor((x1 + (x2 - x1) * t) / TILE),
                       Math.floor((y1 + (y2 - y1) * t) / TILE))) return false;
    }
    return true;
  }

  /* Circle-ish collision: test the 4 corners of a small box */
  canStand(px, py, half = 10) {
    return !this.isSolid(Math.floor((px - half) / TILE), Math.floor((py - half) / TILE))
        && !this.isSolid(Math.floor((px + half) / TILE), Math.floor((py - half) / TILE))
        && !this.isSolid(Math.floor((px - half) / TILE), Math.floor((py + half) / TILE))
        && !this.isSolid(Math.floor((px + half) / TILE), Math.floor((py + half) / TILE));
  }
}

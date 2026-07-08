/* ============================================================
 * entities.js — Player, RemotePlayer, Enemy, Projectile, Pickup
 * ============================================================ */

/* Chat bubble above an entity's head */
function drawBubble(g2d, cam, ent, topY) {
  if (!ent.bubble) return;
  const bx = Math.round(ent.x - cam.x);
  g2d.font = '10px monospace';
  g2d.textAlign = 'center';
  const w = Math.min(220, g2d.measureText(ent.bubble.text).width + 12);
  g2d.fillStyle = 'rgba(250,250,255,.93)';
  g2d.fillRect(bx - w / 2, topY - 16, w, 15);
  g2d.fillStyle = '#14141c';
  g2d.fillText(ent.bubble.text, bx, topY - 5);
}

class Player {
  constructor(id, clsId, game) {
    this.id = id;                       // 1 or 2 (local slot)
    this.game = game;
    this.cls = CLASSES[clsId];
    this.clsId = clsId;
    this.name = 'P' + id;
    this.isRemote = false;

    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.gold = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.stats = Object.assign({}, this.cls.base);

    this.inventory = [];                // item instances (gear + potion stacks)
    this.storage = [];                  // stash — keeps items out of the bag
    this.equip = { head: null, chest: null, hands: null, legs: null, boots: null };
    this.quickItems = [null, null, null];   // hotkey potion slots — potion keys

    this.x = game.world.spawnX;
    this.y = game.world.spawnY + 20;
    this.face = { x: 0, y: 1 };
    this.moving = false;
    this.animT = 0;

    this.buffs = [];                    // {kind:'dmgMul'|'spdMul', v, t}
    this.attackT = 0;                   // basic attack cooldown timer
    this.skillCds = {};                 // skillId -> remaining seconds
    this.dead = false;
    this.respawnT = 0;
    this.afk = false;                   // AFK auto-farm mode
    this.bot = null;                    // bot state (main.js)
    this.bubble = null;                 // {text, ttl} chat bubble

    const d = deriveStats(this);
    this.hp = d.maxHp;
    this.mp = d.maxMp;
  }

  get derived() { return deriveStats(this); }

  buffMul(kind) {
    let m = 1;
    for (const b of this.buffs) if (b.kind === kind) m *= b.v;
    return m;
  }

  /* Apply a buff/debuff; re-applying the same tag refreshes it
   * (so the HUD shows one icon, not a growing stack). */
  addBuff(spec) {
    if (spec.tag) this.buffs = this.buffs.filter(b => b.tag !== spec.tag);
    this.buffs.push(Object.assign({ dur: spec.t, debuff: spec.v < 1 }, spec));
  }

  /* ---------- Items: inventory & equipment ---------- */
  /* Aggregate stat bonuses from all equipped gear. */
  equipAgg() {
    const agg = { str: 0, agi: 0, int: 0, vit: 0, luk: 0,
                  hp: 0, mp: 0, atk: 0, matk: 0, crit: 0, spd: 0,
                  dmgMul: 1, aspdMul: 1 };
    for (const slot of EQUIP_SLOTS) {
      const it = this.equip[slot];
      if (!it) continue;
      for (const row of it.rows) if (row.stat in agg) agg[row.stat] += row.val;
      const base = itemBase(it);
      if (base && base.base) {
        if (base.base.dmgMul) agg.dmgMul *= base.base.dmgMul;
        if (base.base.aspdMul) agg.aspdMul *= base.base.aspdMul;
        if (base.base.spd) agg.spd += base.base.spd;
      }
    }
    return agg;
  }

  /* Add to a list, stacking potions of the same key. */
  _addTo(list, item) {
    if (!item) return;
    if (item.kind === 'potion') {
      const stack = list.find(i => i.kind === 'potion' && i.key === item.key);
      if (stack) { stack.count += (item.count || 1); return; }
    }
    list.push(item);
  }

  _removeFrom(list, item, n = 1) {
    const i = list.indexOf(item);
    if (i < 0) return;
    if (item.kind === 'potion' && (item.count || 1) > n) { item.count -= n; return; }
    list.splice(i, 1);
  }

  addItem(item) { this._addTo(this.inventory, item); }
  removeItem(item, n = 1) { this._removeFrom(this.inventory, item, n); }

  /* Move an item between the bag and the storage stash. */
  depositItem(item, n) {
    const move = (item.kind === 'potion') ? Math.min(n || (item.count || 1), item.count || 1) : 1;
    this._removeFrom(this.inventory, item, move);
    this._addTo(this.storage, item.kind === 'potion' ? { uid: itemUid(), key: item.key, kind: 'potion', count: move } : item);
  }

  withdrawItem(item, n) {
    const move = (item.kind === 'potion') ? Math.min(n || (item.count || 1), item.count || 1) : 1;
    this._removeFrom(this.storage, item, move);
    this._addTo(this.inventory, item.kind === 'potion' ? { uid: itemUid(), key: item.key, kind: 'potion', count: move } : item);
  }

  /* Equip a gear item from the inventory into its slot,
   * swapping any current occupant back into the bag. */
  equipItem(item) {
    if (!item || (item.kind !== 'weapon' && item.kind !== 'armor')) return false;
    const slot = item.slot;
    this.removeItem(item);
    const prev = this.equip[slot];
    this.equip[slot] = item;
    if (prev) this.inventory.push(prev);
    this.clampVitals();
    return true;
  }

  unequipItem(slot) {
    const it = this.equip[slot];
    if (!it) return false;
    this.equip[slot] = null;
    this.inventory.push(it);
    this.clampVitals();
    return true;
  }

  /* Keep hp/mp within (possibly reduced) maximums after a gear change. */
  clampVitals() {
    const d = this.derived;
    this.hp = Math.min(this.hp, d.maxHp);
    this.mp = Math.min(this.mp, d.maxMp);
  }

  update(dt, input) {
    const g = this.game;
    const d = this.derived;

    // tick buffs & cooldowns
    for (const b of this.buffs) b.t -= dt;
    this.buffs = this.buffs.filter(b => b.t > 0);
    for (const k in this.skillCds) this.skillCds[k] = Math.max(0, this.skillCds[k] - dt);
    this.attackT = Math.max(0, this.attackT - dt);
    if (this.bubble && (this.bubble.ttl -= dt) <= 0) this.bubble = null;

    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }

    // regen (regenMul buff — e.g. a Regen potion — speeds it up)
    const regenMul = this.buffMul('regenMul');
    this.hp = Math.min(d.maxHp, this.hp + d.hpRegen * regenMul * dt);
    this.mp = Math.min(d.maxMp, this.mp + d.mpRegen * regenMul * dt);

    // movement
    let mx = input.mx, my = input.my;
    const len = Math.hypot(mx, my);
    this.moving = len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      this.face = { x: mx, y: my };
      const spd = d.speed * this.buffMul('spdMul');
      const nx = this.x + mx * spd * dt;
      const ny = this.y + my * spd * dt;
      if (g.world.canStand(nx, this.y)) this.x = nx;
      if (g.world.canStand(this.x, ny)) this.y = ny;
      this.animT += dt * 10;
    }
    // bot may aim without moving
    if (input.face) this.face = input.face;

    // basic attack (aspdMul buff — e.g. an Attack-Speed potion — shortens the gap)
    if (input.attack && this.attackT <= 0) {
      this.attackT = d.atkCd / this.buffMul('aspdMul');
      if (this.cls.attackType === 'melee') {
        g.meleeArc(this, this.cls.attackRange, 1.0, '#ffffff');
        g.addEffect({ type: 'slash', x: this.x + this.face.x * 26, y: this.y + this.face.y * 26 - 12, dur: 0.15, color: '#ffffff', r: 24 });
        g.sfx('swing');
      } else {
        g.spawnProjectile(this, 1.0, {
          speed: this.cls.projSpeed, color: this.cls.projColor, size: this.cls.projSize,
        });
        g.sfx('shoot');
      }
    }

    // skills
    for (let i = 0; i < 3; i++) {
      if (!input.skills[i]) continue;
      const skill = SKILLS[this.cls.skills[i]];
      if ((this.skillCds[skill.id] || 0) > 0) continue;
      if (this.mp < skill.mp) continue;
      const result = skill.cast(g, this);
      if (result !== false) {
        this.mp -= skill.mp;
        this.skillCds[skill.id] = skill.cd;
        g.sfx('skill');
      }
    }
  }

  gainXp(amount) {
    if (this.dead) return;
    this.xp += amount;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.statPoints += POINTS_PER_LEVEL;
      const d = this.derived;
      this.hp = d.maxHp;
      this.mp = d.maxMp;
      this.game.onLevelUp(this);
    }
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.game.addFloatText(this.x, this.y - 30, '-' + Math.round(amount), '#ff6a6a');
    this.game.sfx('hurt');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnT = 4;
      this.game.onPlayerDeath(this);
    }
  }

  respawn() {
    const g = this.game;
    this.dead = false;
    this.x = g.world.spawnX;
    this.y = g.world.spawnY + 20;
    const d = this.derived;
    // respawn inside the healing circle at 40% — it tops you up fast
    this.hp = d.maxHp * 0.4;
    this.mp = d.maxMp * 0.6;
  }

  draw(g2d, cam) {
    if (this.dead) return;
    const sprite = SPRITES['hero_' + this.clsId + (this.face.x < 0 ? '_f' : '')];
    const scale = 3;
    const bob = this.moving ? Math.round(Math.sin(this.animT) * 1.5) : 0;
    const sx = Math.round(this.x - cam.x - 8 * scale);
    const sy = Math.round(this.y - cam.y - 15 * scale + bob);
    // shadow
    g2d.fillStyle = 'rgba(0,0,0,.3)';
    g2d.fillRect(Math.round(this.x - cam.x - 10), Math.round(this.y - cam.y - 2), 20, 5);
    g2d.drawImage(sprite, sx, sy, 16 * scale, 16 * scale);
    // name tag
    g2d.font = '9px monospace';
    g2d.textAlign = 'center';
    g2d.fillStyle = this.id === 1 ? '#ffd75e' : '#6ee2ff';
    g2d.fillText(this.name + ' Lv' + this.level, Math.round(this.x - cam.x), sy - 4);
    if (this.afk) {
      g2d.fillStyle = '#5ec96a';
      g2d.fillText('⚙' + t('ui.afk'), Math.round(this.x - cam.x), sy - 14);
    }
    // buff sparkle
    if (this.buffs.length) {
      g2d.fillStyle = '#ffe95e';
      g2d.fillRect(Math.round(this.x - cam.x - 2), sy - 24, 4, 4);
    }
    drawBubble(g2d, cam, this, sy - 26);
  }
}

/* ============================================================
 * RemotePlayer — another person's hero, mirrored from network
 * state. Enemies can target it; its damage is applied on its
 * own machine (host routes damage via 'pdmg' events).
 * ============================================================ */

class RemotePlayer {
  constructor(clientId, k, name) {
    this.netKey = clientId + ':' + k;   // routing id for pdmg
    this.isRemote = true;
    this.name = name || '?';
    this.clsId = 'warrior';
    this.level = 1;
    this.x = 0; this.y = 0;
    this.tx = 0; this.ty = 0;
    this.faceX = 1;
    this.hp = 1; this.maxHp = 1;
    this.dead = false;
    this.afk = false;
    this.animT = Math.random() * 10;
    this.fresh = true;
    this.bubble = null;
  }

  applyState(s) {
    this.clsId = CLASSES[s.cls] ? s.cls : 'warrior';
    this.tx = s.x; this.ty = s.y;
    if (this.fresh) { this.x = s.x; this.y = s.y; this.fresh = false; }
    this.faceX = s.f;
    this.level = s.lv;
    this.hp = s.hp; this.maxHp = s.mhp;
    this.dead = !!s.d;
    this.afk = !!s.afk;
  }

  update(dt) {
    const k = Math.min(1, dt * 12);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    if (Math.hypot(this.tx - this.x, this.ty - this.y) > 2) this.animT += dt * 10;
    if (this.bubble && (this.bubble.ttl -= dt) <= 0) this.bubble = null;
  }

  draw(g2d, cam) {
    if (this.dead) return;
    const sprite = SPRITES['hero_' + this.clsId + (this.faceX < 0 ? '_f' : '')];
    const scale = 3;
    const bob = Math.round(Math.sin(this.animT) * 1.5);
    const sx = Math.round(this.x - cam.x - 8 * scale);
    const sy = Math.round(this.y - cam.y - 15 * scale + bob);
    g2d.fillStyle = 'rgba(0,0,0,.3)';
    g2d.fillRect(Math.round(this.x - cam.x - 10), Math.round(this.y - cam.y - 2), 20, 5);
    g2d.drawImage(sprite, sx, sy, 16 * scale, 16 * scale);
    g2d.font = '9px monospace';
    g2d.textAlign = 'center';
    g2d.fillStyle = '#9ae2ff';
    g2d.fillText(this.name + ' Lv' + this.level, Math.round(this.x - cam.x), sy - 4);
    // hp bar
    const w = 36;
    g2d.fillStyle = '#111';
    g2d.fillRect(Math.round(this.x - cam.x - w / 2), sy - 2, w, 3);
    g2d.fillStyle = '#e8484f';
    g2d.fillRect(Math.round(this.x - cam.x - w / 2), sy - 2, Math.max(0, w * this.hp / this.maxHp), 3);
    drawBubble(g2d, cam, this, sy - 16);
  }
}

/* ============================================================ */

class Enemy {
  constructor(spawn, game) {
    this.game = game;
    this.spawn = spawn;
    this.idx = spawn.idx;
    this.type = ENEMY_TYPES[spawn.type];
    this.typeId = spawn.type;
    this.tier = spawn.tier;
    const m = tierScale(this.tier);
    this.maxHp = Math.round(this.type.hp * m.hp);
    this.hp = this.maxHp;
    this.dmg = this.type.dmg * m.dmg;
    this.xp = Math.round(this.type.xp * m.xp);
    this.x = spawn.x;
    this.y = spawn.y;
    this.face = 1;
    this.state = 'idle';
    this.wanderT = 0;
    this.wanderDir = { x: 0, y: 0 };
    this.attackT = 0;
    this.biteT = 0;
    this.slowT = 0;
    this.animT = Math.random() * 10;
    this.dead = false;
    this.remote = false;    // true = network ghost (host simulates it)
    this.nx = spawn.x; this.ny = spawn.y;
    this.unseenT = 0;
    this.lastFrom = null;
  }

  /* --- network ghost mode --- */
  netTarget(s) {
    this.nx = s.x; this.ny = s.y;
    this.hp = s.hp;
    this.unseenT = 0;
  }

  netTick(dt) {
    const k = Math.min(1, dt * 10);
    const dx = this.nx - this.x;
    this.x += dx * k;
    this.y += (this.ny - this.y) * k;
    if (Math.abs(dx) > 1) this.face = dx < 0 ? -1 : 1;
    this.animT += dt * 6;
    this.slowT = Math.max(0, this.slowT - dt);
  }

  /* --- full simulation (offline / host) --- */
  update(dt) {
    if (this.dead) return;
    const g = this.game;
    this.attackT = Math.max(0, this.attackT - dt);
    this.biteT = Math.max(0, this.biteT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.animT += dt * 6;

    // find nearest living target (local + remote players)
    let target = null, best = Infinity;
    for (const p of g.allTargets()) {
      const dd = Math.hypot(p.x - this.x, p.y - this.y);
      if (dd < best) { best = dd; target = p; }
    }

    const aggroR = this.type.aggro;
    if (target && (best < aggroR || this.state === 'chase') && best < 460) {
      this.state = 'chase';
    } else if (this.state === 'chase') {
      this.state = 'return';
    }

    let speed = this.type.speed * (this.slowT > 0 ? 0.45 : 1);

    if (this.state === 'chase' && target) {
      const dx = target.x - this.x, dy = target.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.face = dx < 0 ? -1 : 1;

      if (this.type.ranged) {
        // ranged: keep distance, shoot
        if (dist > this.type.keepDist) this.move(dx / dist, dy / dist, speed, dt);
        if (dist < this.type.shootRange && this.attackT <= 0) {
          this.attackT = this.type.boss ? 1.4 : 2.2;
          g.spawnEnemyProjectile(this, target);
        }
        // boss also bites up close (own cooldown, not per-frame)
        if (this.type.boss && dist < 46 && this.biteT <= 0) {
          this.biteT = 1.1;
          g.damagePlayer(target, this.dmg * 0.8);
        }
      } else {
        if (dist > 22) this.move(dx / dist, dy / dist, speed, dt);
        if (dist < 30 && this.attackT <= 0) {
          this.attackT = 1.0;
          g.damagePlayer(target, this.dmg);
        }
      }
    } else if (this.state === 'return') {
      const dx = this.spawn.x - this.x, dy = this.spawn.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        this.state = 'idle';
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5); // heal on reset
      } else {
        this.move(dx / dist, dy / dist, speed * 1.3, dt);
      }
    } else {
      // wander around spawn
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 1.5 + Math.random() * 2;
        if (Math.random() < 0.4 || Math.hypot(this.x - this.spawn.x, this.y - this.spawn.y) > 70) {
          const a = Math.atan2(this.spawn.y - this.y, this.spawn.x - this.x) + (Math.random() - 0.5);
          this.wanderDir = { x: Math.cos(a), y: Math.sin(a) };
        } else if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          this.wanderDir = { x: Math.cos(a), y: Math.sin(a) };
        } else {
          this.wanderDir = { x: 0, y: 0 };
        }
      }
      if (this.wanderDir.x || this.wanderDir.y) {
        this.face = this.wanderDir.x < 0 ? -1 : 1;
        this.move(this.wanderDir.x, this.wanderDir.y, speed * 0.4, dt);
      }
    }
  }

  move(nx, ny, speed, dt) {
    const w = this.game.world;
    const px = this.x + nx * speed * dt;
    const py = this.y + ny * speed * dt;
    if (w.canStand(px, this.y)) this.x = px;
    if (w.canStand(this.x, py)) this.y = py;
  }

  takeDamage(amount, from) {
    if (this.dead) return;
    this.hp -= amount;
    this.state = 'chase';
    if (from) this.lastFrom = from;
    if (this.hp <= 0) {
      this.dead = true;
      this.game.onEnemyDeath(this, this.lastFrom);
    }
  }

  draw(g2d, cam) {
    if (this.dead) return;
    const scale = this.type.scale;
    const sprite = SPRITES[this.type.sprite + (this.face < 0 ? '_f' : '')];
    const bob = Math.round(Math.sin(this.animT) * (this.typeId === 'bat' ? 3 : 1));
    const sx = Math.round(this.x - cam.x - 8 * scale);
    const sy = Math.round(this.y - cam.y - 15 * scale + bob);
    g2d.fillStyle = 'rgba(0,0,0,.3)';
    g2d.fillRect(Math.round(this.x - cam.x - 7 * (scale / 3)), Math.round(this.y - cam.y - 2), 14 * (scale / 3), 5);
    g2d.drawImage(sprite, sx, sy, 16 * scale, 16 * scale);
    // hp bar when hurt
    if (this.hp < this.maxHp) {
      const w = 14 * scale;
      g2d.fillStyle = '#111';
      g2d.fillRect(Math.round(this.x - cam.x - w / 2), sy - 6, w, 4);
      g2d.fillStyle = this.type.boss ? '#ff3050' : '#e8484f';
      g2d.fillRect(Math.round(this.x - cam.x - w / 2), sy - 6, Math.max(0, w * this.hp / this.maxHp), 4);
    }
    // slow tint
    if (this.slowT > 0) {
      g2d.fillStyle = 'rgba(160,224,255,.25)';
      g2d.fillRect(sx, sy, 16 * scale, 16 * scale);
    }
  }
}

/* ============================================================ */

class Projectile {
  constructor(opts) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, dmg: 0, team: 'player', owner: null,
      color: '#fff', size: 4, pierce: false, aoe: 0, life: 1.4, hitSet: new Set(),
    }, opts);
  }

  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) return false;

    // walls stop projectiles
    if (game.world.isSolid(Math.floor(this.x / TILE), Math.floor(this.y / TILE))) {
      if (this.aoe && this.team === 'player') game.explode(this);
      return false;
    }

    if (this.team === 'player') {
      for (const e of game.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        if (Math.hypot(e.x - this.x, e.y - (this.y + 14)) < 16 * (e.type.scale / 3) + this.size + 6) {
          this.hitSet.add(e);
          if (this.aoe) { game.explode(this); return false; }
          game.applyHit(this.owner, e, this.dmg, this.color);
          if (!this.pierce) return false;
        }
      }
    } else {
      // enemy projectiles only ever hurt LOCAL players; each
      // machine handles damage for its own heroes.
      for (const p of game.players) {
        if (p.dead) continue;
        if (Math.hypot(p.x - this.x, p.y - 14 - this.y) < 18) {
          p.takeDamage(this.dmg);
          return false;
        }
      }
    }
    return true;
  }

  draw(g2d, cam) {
    g2d.fillStyle = this.color;
    const s = this.size;
    g2d.fillRect(Math.round(this.x - cam.x - s / 2), Math.round(this.y - cam.y - s / 2), s, s);
    // little trail
    g2d.globalAlpha = 0.4;
    g2d.fillRect(Math.round(this.x - cam.x - this.vx * 0.02 - s / 2), Math.round(this.y - cam.y - this.vy * 0.02 - s / 2), s, s);
    g2d.globalAlpha = 1;
  }
}

/* ============================================================ */

class Pickup {
  constructor(kind, x, y, value) {
    this.kind = kind;   // 'heart' | 'orb' | 'coin' | 'gear'
    this.x = x; this.y = y;
    this.value = value;               // gear: the item instance
    this.t = 0;
    this.life = kind === 'gear' ? 60 : 25;   // gear lingers longer
  }

  update(dt, game) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) return false;
    for (const p of game.players) {
      if (p.dead) continue;
      if (Math.hypot(p.x - this.x, p.y - this.y) < 24) {
        game.collectPickup(this, p);
        return false;
      }
    }
    return true;
  }

  draw(g2d, cam) {
    const bob = Math.round(Math.sin(this.t * 4) * 3);
    const px = Math.round(this.x - cam.x), py = Math.round(this.y - cam.y - 12 + bob);
    if (this.kind === 'gear') {
      // tier-colored gem with the item's emoji icon and a soft glow
      const col = itemColor(this.value);
      g2d.globalAlpha = 0.35 + Math.sin(this.t * 5) * 0.12;
      g2d.fillStyle = col;
      g2d.beginPath(); g2d.arc(px, py + 8, 13, 0, Math.PI * 2); g2d.fill();
      g2d.globalAlpha = 1;
      g2d.fillStyle = col;
      g2d.fillRect(px - 9, py - 1, 18, 18);
      g2d.strokeStyle = '#0a0c14'; g2d.lineWidth = 2;
      g2d.strokeRect(px - 9, py - 1, 18, 18);
      g2d.font = '13px monospace'; g2d.textAlign = 'center'; g2d.textBaseline = 'middle';
      g2d.fillText(itemIcon(this.value), px, py + 9);
      g2d.textBaseline = 'alphabetic';
      return;
    }
    const sprite = SPRITES[this.kind];
    g2d.drawImage(sprite, px - 8, py, 16, 16);
  }
}

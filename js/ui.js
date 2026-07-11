/* ============================================================
 * ui.js — DOM HUD: class cards, bars, skill bar, stat panel,
 *         hotkey settings, online multiplayer panel
 * ============================================================ */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const UI = {
  game: null,
  statPanelPlayer: null,
  selectedClass: null,
  listening: null,          // {pid, action} while waiting for a key

  $(id) { return document.getElementById(id); },

  /* ---------- Class selection cards ---------- */
  buildClassCards(containerId, onPick) {
    const box = this.$(containerId);
    box.innerHTML = '';
    for (const clsId in CLASSES) {
      const cls = CLASSES[clsId];
      const card = document.createElement('div');
      card.className = 'class-card';
      card.dataset.cls = clsId;

      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      cv.getContext('2d').drawImage(SPRITES['hero_' + clsId], 0, 0);

      const name = document.createElement('div');
      name.className = 'cc-name';
      name.textContent = t('class.' + clsId);

      const desc = document.createElement('div');
      desc.className = 'cc-desc';
      desc.textContent = t('classd.' + clsId);

      const statsEl = document.createElement('div');
      statsEl.className = 'cc-stats';
      statsEl.innerHTML = STAT_KEYS
        .map(k => `${k.toUpperCase()} <b>${cls.base[k]}</b><br>`)
        .join('');

      card.append(cv, name, desc, statsEl);
      card.addEventListener('click', () => {
        box.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        onPick(clsId);
      });
      box.appendChild(card);
    }
  },

  /* ---------- Skill bar ---------- */
  buildSkillbar(player) {
    const bar = this.$('skillbar-p' + player.id);
    bar.innerHTML = '';
    bar.classList.remove('hidden');
    const keys = [KEYS.attack, KEYS.skill1, KEYS.skill2, KEYS.skill3].map(prettyKey);
    // slot 0 = basic attack
    const slots = [{ icon: player.cls.attackType === 'melee' ? '⚔️' : '🏹', name: 'ATK', id: null }]
      .concat(player.cls.skills.map(sid => ({ icon: SKILLS[sid].icon, name: t('skill.' + sid), id: sid })));
    slots.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'skill-slot';
      el.dataset.skill = s.id || '';
      el.innerHTML = `<span class="ss-key">${keys[i]}</span><span class="ss-icon">${s.icon}</span>` +
        `<span class="ss-name">${s.name}</span><div class="ss-cd" style="height:0"></div>`;
      // hover tooltip with the skill description
      el.addEventListener('mouseenter', ev => this.showSkillTip(s, ev));
      el.addEventListener('mousemove', ev => this.moveSkillTip(ev));
      el.addEventListener('mouseleave', () => this.hideSkillTip());
      bar.appendChild(el);
    });
  },

  /* ---------- Skill hover tooltip ---------- */
  showSkillTip(slot, ev) {
    const tip = this.$('skill-tooltip');
    if (!tip) return;
    if (slot.id) {
      const sk = SKILLS[slot.id];
      tip.innerHTML =
        `<b>${slot.icon} ${escapeHtml(t('skill.' + slot.id))}</b>` +
        `<div class="st-desc">${escapeHtml(t('skilld.' + slot.id))}</div>` +
        `<div class="st-cost">${t('skill.mp')} ${sk.mp} · ${t('skill.cd')} ${sk.cd}s</div>`;
    } else {
      tip.innerHTML =
        `<b>${slot.icon} ${escapeHtml(t('act.attack'))}</b>` +
        `<div class="st-desc">${escapeHtml(t('skilld.attack'))}</div>`;
    }
    tip.classList.remove('hidden');
    this.moveSkillTip(ev);
  },

  moveSkillTip(ev) {
    const tip = this.$('skill-tooltip');
    if (!tip || tip.classList.contains('hidden')) return;
    const pad = 8;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = ev.clientX - w / 2;
    let top = ev.clientY - h - 14;
    left = Math.max(pad, Math.min(window.innerWidth - w - pad, left));
    if (top < pad) top = ev.clientY + 18;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  },

  hideSkillTip() {
    const tip = this.$('skill-tooltip');
    if (tip) tip.classList.add('hidden');
  },

  /* ---------- Item tooltip (shares the skill-tooltip element) ---------- */
  itemTipHtml(item) {
    const col = itemColor(item);
    let h = `<b style="color:${col}">${escapeHtml(itemName(item))}</b>`;
    if (item.kind === 'potion') {
      h += `<div class="it-desc">${escapeHtml(t('itemd.' + item.key))}</div>`;
      if ((item.count || 1) > 1) h += `<div class="it-sub">×${item.count}</div>`;
      return h;
    }
    if (item.kind === 'material') {
      h += `<div class="it-desc">${escapeHtml(t('matd.' + item.key))}</div>`;
      if ((item.count || 1) > 1) h += `<div class="it-sub">×${item.count}</div>`;
      return h;
    }
    h += `<div class="it-sub">${escapeHtml(t('slot.' + item.slot))} · ${escapeHtml(t('tier.' + item.tier))}</div>`;
    for (const r of item.rows) h += `<div class="it-row">+${r.val} ${escapeHtml(t('rstat.' + r.stat))}</div>`;
    const base = itemBase(item);
    if (base && base.base) {
      const mods = [];
      const pct = v => (v > 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
      if (base.base.dmgMul && base.base.dmgMul !== 1) mods.push(pct(base.base.dmgMul) + ' DMG');
      if (base.base.aspdMul && base.base.aspdMul !== 1) mods.push(pct(base.base.aspdMul) + ' ATK SPD');
      if (base.base.spd) mods.push((base.base.spd > 0 ? '+' : '') + base.base.spd + ' SPD');
      if (mods.length) h += `<div class="it-sub">${mods.join(' · ')}</div>`;
      if (base.two) h += `<div class="it-sub">${escapeHtml(t('inv.twoHanded'))}</div>`;
    }
    if (item.rr) h += `<div class="it-sub">⚒ ×${item.rr}</div>`;
    return h;
  },

  showItemTip(item, ev) {
    const tip = this.$('skill-tooltip');
    if (!tip) return;
    tip.innerHTML = this.itemTipHtml(item) + this.equipCompareHtml(item);
    tip.classList.remove('hidden');
    this.moveSkillTip(ev);
  },

  /* Readable label for a compared stat field. */
  statLabel(k) {
    if (k === 'dmgMul') return 'DMG';
    if (k === 'aspdMul') return 'ATK SPD';
    return t('rstat.' + k);
  },

  /* When hovering a gear item, show the item currently equipped in the
   * same slot plus the per-stat delta, so two items compare at a glance. */
  equipCompareHtml(item) {
    if (!item || (item.kind !== 'weapon' && item.kind !== 'armor')) return '';
    const p = this.game && this.game.players[0];
    if (!p) return '';
    const eq = p.equip[item.slot];
    if (!eq || eq === item) return '';
    let h = `<div class="cmp-head">${escapeHtml(t('cmp.vs'))} · ` +
      `<span class="cmp-name" style="color:${itemColor(eq)}">${escapeHtml(itemName(eq))}</span></div>`;
    const a = itemStatMap(item), b = itemStatMap(eq);
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      const dv = (a[k] || 0) - (b[k] || 0);
      if (!dv) continue;
      const suffix = (k === 'dmgMul' || k === 'aspdMul') ? '%' : '';
      h += `<div class="${dv > 0 ? 'cmp-up' : 'cmp-down'}">${dv > 0 ? '+' : ''}${dv}${suffix} ${escapeHtml(this.statLabel(k))}</div>`;
    }
    return h;
  },

  /* ---------- Inventory & equipment ---------- */
  invSel: null,
  invTab: 'bag',
  invFilter: 'all',   // all | potion | head | chest | hands | legs | boots
  reforgeSel: null,   // gear item currently in reforge (row-pick) mode

  openInventory() {
    this.invSel = null;
    this.reforgeSel = null;
    this.invTab = 'bag';
    this.invFilter = 'all';
    this.$('inv-panel').classList.remove('hidden');
    this.renderInventory();
  },

  /* Does an item belong to the active category filter? */
  _matchFilter(it) {
    const f = this.invFilter;
    if (f === 'all') return true;
    if (f === 'potion') return it.kind === 'potion';
    if (f === 'material') return it.kind === 'material';
    return it.slot === f;   // head | chest | hands | legs | boots
  },

  /* Category chips above the grid; higher tier sorts first in the grid. */
  renderInvFilter() {
    const bar = this.$('inv-filter');
    if (!bar) return;
    const cats = [['all', t('inv.filterAll')], ['potion', t('inv.filterPotion')],
      ['material', t('inv.filterMaterial')],
      ['head', t('slot.head')], ['chest', t('slot.chest')], ['hands', t('slot.hands')],
      ['legs', t('slot.legs')], ['boots', t('slot.boots')]];
    bar.innerHTML = '';
    for (const [key, label] of cats) {
      const b = document.createElement('button');
      b.className = 'pix-btn small filt' + (this.invFilter === key ? ' selected' : '');
      b.textContent = label;
      b.addEventListener('click', () => {
        this.invFilter = key; this.invSel = null;
        this.renderInventory(); this.game.sfx('point');
      });
      bar.appendChild(b);
    }
  },

  closeInventory() {
    this.invSel = null;
    this.reforgeSel = null;
    this.hideSkillTip();
    this.$('inv-panel').classList.add('hidden');
  },

  _invHover(el, item) {
    el.addEventListener('mouseenter', ev => this.showItemTip(item, ev));
    el.addEventListener('mousemove', ev => this.moveSkillTip(ev));
    el.addEventListener('mouseleave', () => this.hideSkillTip());
  },

  invBtn(label, fn, danger) {
    const b = document.createElement('button');
    b.className = 'pix-btn small';
    b.textContent = label;
    if (fn) b.addEventListener('click', fn);
    return b;
  },

  renderInventory() {
    const p = this.game && this.game.players[0];
    if (!p) return;

    // equipped slots — click to unequip
    const slots = this.$('inv-slots');
    slots.innerHTML = '';
    for (const slot of EQUIP_SLOTS) {
      const it = p.equip[slot];
      const row = document.createElement('div');
      row.className = 'inv-slot';
      row.innerHTML =
        `<span class="is-icon">${it ? itemIcon(it) : '▫'}</span>` +
        `<span class="is-label">${escapeHtml(t('slot.' + slot))}</span>` +
        `<span class="is-name ${it ? '' : 'empty'}" ${it ? `style="color:${itemColor(it)}"` : ''}>` +
        `${it ? escapeHtml(itemName(it)) : escapeHtml(t('inv.emptySlot'))}</span>`;
      if (it) {
        this._invHover(row, it);
        row.addEventListener('click', () => {
          p.unequipItem(slot);
          this.invSel = null; this.game.save(); this.hideSkillTip();
          this.renderInventory(); this.game.sfx('point');
        });
      }
      slots.appendChild(row);
    }

    // Bag / Storage tab highlight + active list
    document.querySelectorAll('.inv-tab').forEach(b =>
      b.classList.toggle('selected', b.dataset.tab === this.invTab));
    const inStorage = this.invTab === 'storage';
    const list = inStorage ? p.storage : p.inventory;

    // category filter chips
    this.renderInvFilter();

    // filtered + tier-sorted display copy (does NOT reorder the real list)
    const shown = list.filter(it => this._matchFilter(it)).sort((a, b) =>
      tierRank(b) - tierRank(a) || (b.ilvl || 0) - (a.ilvl || 0) ||
      itemName(a).localeCompare(itemName(b)));

    // item grid — click to select
    const grid = this.$('inv-grid');
    grid.innerHTML = '';
    if (!shown.length) {
      grid.innerHTML = `<div class="inv-empty">${escapeHtml(t(inStorage ? 'inv.emptyStore' : 'inv.empty'))}</div>`;
    }
    for (const it of shown) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell' + (this.invSel === it ? ' selected' : '');
      cell.style.borderColor = itemColor(it);
      cell.innerHTML = itemIcon(it) +
        (isStackable(it) && (it.count || 1) > 1 ? `<span class="ic-count">${it.count}</span>` : '');
      this._invHover(cell, it);
      cell.addEventListener('click', () => {
        this.invSel = (this.invSel === it ? null : it);
        this.renderInventory();
      });
      grid.appendChild(cell);
    }

    // action row for the selected item
    const act = this.$('inv-actions');
    act.innerHTML = '';
    const sel = this.invSel;
    if (!sel || !list.includes(sel)) { this.invSel = null; this.reforgeSel = null; return; }
    if (this.reforgeSel && this.reforgeSel !== sel) this.reforgeSel = null;
    const re = () => this.renderInventory();
    const nm = document.createElement('span');
    nm.className = 'ia-name'; nm.style.color = itemColor(sel);
    nm.textContent = itemName(sel);
    act.appendChild(nm);

    // Reforge row-picker mode (bag gear only): pick which stat to reroll.
    if (!inStorage && this.reforgeSel === sel && (sel.kind === 'weapon' || sel.kind === 'armor')) {
      const cost = reforgeCost(sel);
      const hint = document.createElement('span');
      hint.className = 'ia-hint';
      hint.textContent = t('inv.reforgePick') + ' · ' + cost + '🪙';
      act.appendChild(hint);
      sel.rows.forEach((r, i) => {
        act.appendChild(this.invBtn('↻ +' + r.val + ' ' + t('rstat.' + r.stat), () => {
          if (this.game.reforge(p, sel, i)) re();   // stays in reforge mode for repeat rerolls
        }));
      });
      act.appendChild(this.invBtn(t('inv.cancel'), () => { this.reforgeSel = null; re(); }));
      return;
    }

    if (inStorage) {
      act.appendChild(this.invBtn(t('inv.withdraw'), () => {
        p.withdrawItem(sel); this.invSel = null; this.game.save(); re(); this.game.sfx('point');
      }));
    } else {
      if (sel.kind === 'weapon' || sel.kind === 'armor') {
        act.appendChild(this.invBtn(t('inv.equip'), () => {
          p.equipItem(sel); this.invSel = null; this.game.save(); re(); this.game.sfx('buff');
        }));
        act.appendChild(this.invBtn(t('inv.reforgeCost', { n: reforgeCost(sel) }), () => {
          this.reforgeSel = sel; re(); this.game.sfx('point');
        }));
        // Refine: gold + ore, attempt once per click (odds shown past +4)
        if ((sel.refine || 0) >= MAX_REFINE) {
          const maxed = document.createElement('span');
          maxed.className = 'ia-hint'; maxed.textContent = '⚒ +' + MAX_REFINE + ' ' + t('inv.refineMaxTag');
          act.appendChild(maxed);
        } else {
          const rc = refineCost(sel), pct = Math.round(refineChance(sel) * 100);
          const haveOre = this.game.matCount(p, 'ore');
          const label = t('inv.refineBtn', { r: (sel.refine || 0) + 1, g: rc.gold, o: rc.ore }) +
            (pct < 100 ? ' ' + pct + '%' : '');
          const btn = this.invBtn(label, () => {
            const res = this.game.refine(p, sel);
            if (res) re();
          });
          if (p.gold < rc.gold || haveOre < rc.ore) btn.classList.add('disabled');
          act.appendChild(btn);
        }
      }
      if (sel.kind === 'potion') {
        act.appendChild(this.invBtn(t('inv.use'), () => {
          this.game.usePotion(p, sel);
          if (!p.inventory.includes(sel)) this.invSel = null;
          re();
        }));
        // assign to a hotkey slot
        for (let i = 0; i < 3; i++) {
          const label = t('inv.toSlot', { k: prettyKey(KEYS['quick' + (i + 1)]) });
          act.appendChild(this.invBtn(label, () => {
            p.quickItems[i] = sel.key; this.game.save(); re(); this.game.sfx('point');
          }));
        }
      }
      act.appendChild(this.invBtn(t('inv.deposit'), () => {
        p.depositItem(sel); this.invSel = null; this.game.save(); re(); this.game.sfx('point');
      }));
    }

    // two-step destroy (no blocking browser dialog)
    const del = this.invBtn(t('inv.destroy'), null);
    let armed = false;
    del.addEventListener('click', () => {
      if (!armed) { armed = true; del.textContent = '⚠ ' + t('inv.destroy'); del.classList.add('selected'); return; }
      p._removeFrom(list, sel, sel.count || 1);
      this.invSel = null; this.game.save(); re(); this.game.sfx('point');
    });
    act.appendChild(del);
  },

  /* ---------- HUD hotkey potion bar ---------- */
  renderQuick(p, pre) {
    const box = this.$('quickbar-' + pre);
    if (!box) return;
    const keys = ['quick1', 'quick2', 'quick3'];
    const sig = p.quickItems.map((k, i) => k + ':' + this.game.quickCount(p, i)).join(',');
    if (sig !== box.dataset.sig) {
      box.dataset.sig = sig;
      box.innerHTML = keys.map((qk, i) => {
        const key = p.quickItems[i];
        const kl = prettyKey(KEYS[qk]);
        if (!key) return `<div class="quick-slot empty" data-i="${i}"><span class="qs-key">${kl}</span>＋</div>`;
        const cnt = this.game.quickCount(p, i);
        return `<div class="quick-slot ${cnt ? '' : 'out'}" data-i="${i}" title="${escapeHtml(t('item.' + key))}">` +
          `<span class="qs-key">${kl}</span>${POTIONS[key].icon}<span class="qs-count">${cnt}</span></div>`;
      }).join('');
      box.querySelectorAll('.quick-slot').forEach(el => {
        const i = +el.dataset.i;
        el.addEventListener('click', () => {
          if (p.quickItems[i]) this.game.useQuickItem(p, i);
          else { this.openInventory(); }   // empty slot → open bag to assign
        });
      });
    }
  },

  /* ---------- Buff / debuff status chips ---------- */
  renderBuffs(p, pre) {
    const box = this.$('buffbar-' + pre);
    if (!box) return;
    const buffs = p.buffs.filter(b => b.icon);
    const sig = buffs.map(b => (b.tag || b.icon) + (b.debuff ? 'd' : '')).join(',');
    if (sig !== box.dataset.sig) {
      box.dataset.sig = sig;
      box.innerHTML = buffs.map(b =>
        `<span class="buff-chip ${b.debuff ? 'debuff' : ''}" title="${escapeHtml(b.name ? t(b.name) : '')}">` +
        `<span>${b.icon}</span><span class="bc-time"></span><span class="bc-bar"></span></span>`
      ).join('');
    }
    box.querySelectorAll('.buff-chip').forEach((el, i) => {
      const b = buffs[i];
      if (!b) return;
      el.querySelector('.bc-time').textContent = Math.ceil(b.t) + 's';
      el.querySelector('.bc-bar').style.width =
        Math.max(0, Math.min(100, (b.t / (b.dur || b.t)) * 100)) + '%';
    });
  },

  /* ---------- AFK focus settings ---------- */
  openAfkPanel() {
    this.$('afk-panel').classList.remove('hidden');
    this.renderAfkPanel();
  },

  renderAfkPanel() {
    document.querySelectorAll('.afk-opt').forEach(btn =>
      btn.classList.toggle('selected', !!AFK_FOCUS[btn.dataset.focus]));
  },

  /* ---------- Merchant shop ---------- */
  shopTab: 'buy',

  openShop() {
    this.shopTab = 'buy';
    this.$('shop-panel').classList.remove('hidden');
    this.renderShop();
  },

  closeShop() {
    this.hideSkillTip();
    this.$('shop-panel').classList.add('hidden');
  },

  renderShop() {
    const p = this.game && this.game.players[0];
    if (!p) return;
    this.$('shop-gold').textContent = p.gold;
    document.querySelectorAll('.shop-tab').forEach(b =>
      b.classList.toggle('selected', b.dataset.tab === this.shopTab));
    const box = this.$('shop-content');
    box.innerHTML = '';

    if (this.shopTab === 'buy') {
      for (const key of Object.keys(POTIONS)) {
        const base = POTIONS[key];
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML =
          `<span class="sr-icon">${base.icon}</span>` +
          `<span class="sr-name">${escapeHtml(t('item.' + key))}<small>${escapeHtml(t('itemd.' + key))}</small></span>` +
          `<span class="sr-price">🪙 ${base.price}</span>`;
        const buy = this.invBtn(t('shop.buyBtn'), () => {
          if (this.game.buyPotion(p, key, 1)) this.renderShop();
        });
        row.appendChild(buy);
        box.appendChild(row);
      }
    } else {
      const sellable = p.inventory;
      if (!sellable.length) {
        box.innerHTML = `<div class="shop-empty">${escapeHtml(t('shop.nothing'))}</div>`;
        return;
      }
      for (const it of sellable) {
        const row = document.createElement('div');
        row.className = 'shop-row';
        const cnt = it.kind === 'potion' && (it.count || 1) > 1 ? ` ×${it.count}` : '';
        row.innerHTML =
          `<span class="sr-icon">${itemIcon(it)}</span>` +
          `<span class="sr-name" style="color:${itemColor(it)}">${escapeHtml(itemName(it))}${cnt}</span>` +
          `<span class="sr-price">🪙 ${sellValue(it)}</span>`;
        this._invHover(row, it);
        row.appendChild(this.invBtn(t('shop.sellBtn'), () => {
          this.game.sellItem(p, it); this.renderShop();
        }));
        box.appendChild(row);
      }
    }
  },

  /* ---------- Online name availability ---------- */
  rebuildSkillbars() {
    if (!this.game) return;
    for (const p of this.game.players) this.buildSkillbar(p);
  },

  refreshSkillNames() {
    for (const p of (this.game ? this.game.players : [])) {
      const bar = this.$('skillbar-p' + p.id);
      bar.querySelectorAll('.skill-slot').forEach(el => {
        const sid = el.dataset.skill;
        if (sid) el.querySelector('.ss-name').textContent = t('skill.' + sid);
      });
    }
  },

  /* ---------- Per-frame HUD update ---------- */
  update(game) {
    let gold = 0;
    for (const p of game.players) {
      gold += p.gold;
      p.name = game.heroName();          // keep name live (head, stat window, toasts)
      const d = p.derived;
      const pre = 'p' + p.id;
      const nameEl = this.$(pre + '-playername');
      nameEl.textContent = p.name;
      nameEl.title = p.name;             // hover shows the full (possibly truncated) name
      this.$(pre + '-level').textContent = p.level;
      this.$(pre + '-hp').style.width = Math.max(0, (p.hp / d.maxHp) * 100) + '%';
      this.$(pre + '-mp').style.width = Math.max(0, (p.mp / d.maxMp) * 100) + '%';
      this.$(pre + '-xp').style.width = Math.min(100, (p.xp / xpToNext(p.level)) * 100) + '%';
      this.$(pre + '-hp-text').textContent = Math.ceil(p.hp) + ' / ' + d.maxHp;
      this.$(pre + '-mp-text').textContent = Math.ceil(p.mp) + ' / ' + d.maxMp;
      this.$(pre + '-name').textContent = t('class.' + p.clsId);
      this.$(pre + '-points-hint').classList.toggle('hidden', p.statPoints <= 0);
      this.$('afk-' + pre).classList.toggle('selected', p.afk);
      this.renderBuffs(p, pre);
      this.renderQuick(p, pre);

      // skill cooldown overlays
      const bar = this.$('skillbar-p' + p.id);
      bar.querySelectorAll('.skill-slot').forEach((el, i) => {
        if (i === 0) {
          el.querySelector('.ss-cd').style.height = (p.attackT / Math.max(0.01, d.atkCd)) * 100 + '%';
          return;
        }
        const skill = SKILLS[p.cls.skills[i - 1]];
        const cd = p.skillCds[skill.id] || 0;
        el.querySelector('.ss-cd').style.height = (cd / skill.cd) * 100 + '%';
        el.classList.toggle('no-mana', p.mp < skill.mp);
      });
    }
    this.$('gold-amount').textContent = gold;

    // stat-point badge on the ＋Stats button
    const pts = game.players[0] ? game.players[0].statPoints : 0;
    const badge = this.$('stats-badge');
    badge.textContent = pts > 0 ? pts : '';
    badge.classList.toggle('hidden', pts <= 0);
    this.$('btn-stats').classList.toggle('pulse', pts > 0);

    // zone name for player 1
    const p1 = game.players[0];
    if (p1) this.$('zone-name').textContent = t('zone.' + game.world.tierAt(p1.x, p1.y));

    // online badge
    if (game.net.isOnline) {
      const where = game.net.roomLabel ? ' · ' + game.net.roomLabel : '';
      this.$('online-text').textContent = t('online.players', { n: game.net.playerCount }) +
        where + (game.net.isHost ? ' ★' : '');
    } else {
      // signed out = a local guest session; no shared world
      this.$('online-text').textContent = t('ui.guest');
    }

    // re-render the stat panel ONLY when its data changed — rebuilding
    // it every frame destroys the + buttons mid-click, eating the click
    if (this.statPanelPlayer && !this.$('stat-panel').classList.contains('hidden')) {
      const sig = this.spSig(this.statPanelPlayer);
      if (sig !== this._spSig) this.renderStatPanel(this.statPanelPlayer);
    }

    this.drawMinimap(game);
  },

  drawMinimap(game) {
    const mm = this.$('minimap');
    const g = mm.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(game.world.minimapImg, 0, 0, mm.width, mm.height);
    const sx = mm.width / (MAP_W * TILE), sy = mm.height / (MAP_H * TILE);
    // healing circle marker
    g.fillStyle = '#5ec96a';
    g.fillRect(game.world.spawnX * sx - 2, game.world.spawnY * sy - 2, 5, 5);
    // boss
    if (game.world.bossPos) {
      g.fillStyle = '#ff3050';
      g.fillRect(game.world.bossPos.x * sx - 2, game.world.bossPos.y * sy - 2, 4, 4);
    }
    // ogre miniboss
    if (game.world.ogrePos) {
      g.fillStyle = '#c97a3a';
      g.fillRect(game.world.ogrePos.x * sx - 2, game.world.ogrePos.y * sy - 2, 4, 4);
    }
    // dragon world boss — only marked while it is actually up
    const wbs = game.world.worldBossSpawn;
    if (wbs && ((wbs.enemy && !wbs.enemy.dead) || game.ghosts.has(wbs.idx))) {
      g.fillStyle = '#ffc440';
      g.fillRect(wbs.x * sx - 3, wbs.y * sy - 3, 6, 6);
    }
    // remote players
    for (const [, arr] of game.remotePlayers) {
      for (const rp of arr) {
        if (rp.dead) continue;
        g.fillStyle = '#9ae2ff';
        g.fillRect(rp.x * sx - 2, rp.y * sy - 2, 4, 4);
      }
    }
    for (const p of game.players) {
      if (p.dead) continue;
      g.fillStyle = p.id === 1 ? '#ffd75e' : '#6ee2ff';
      g.fillRect(p.x * sx - 2, p.y * sy - 2, 4, 4);
    }
  },

  /* ---------- Stat panel ---------- */
  openStatPanel(player) {
    this.statPanelPlayer = player;
    this.$('stat-panel').classList.remove('hidden');
    this.renderStatPanel(player);
  },

  closeStatPanel() {
    this.$('stat-panel').classList.add('hidden');
    this.statPanelPlayer = null;
  },

  spSig(p) {
    return currentLang + ':' + p.name + ':' + p.level + ':' + p.statPoints + ':' +
           STAT_KEYS.map(k => p.stats[k]).join(',') + ':' +
           EQUIP_SLOTS.map(s => (p.equip[s] ? p.equip[s].uid + '+' + (p.equip[s].refine || 0) : '-')).join(',');
  },

  renderStatPanel(p) {
    this._spSig = this.spSig(p);
    this.$('sp-title').textContent = t('ui.statsOf', { name: p.name });
    this.$('sp-class').textContent = t('class.' + p.clsId);
    this.$('sp-level').textContent = p.level;
    this.$('sp-points').textContent = p.statPoints;

    const agg = p.equipAgg ? p.equipAgg() : {};
    const statsBox = this.$('sp-stats');
    statsBox.innerHTML = '';
    for (const k of STAT_KEYS) {
      const bonus = agg[k] || 0;
      const row = document.createElement('div');
      row.className = 'sp-row';
      row.innerHTML = `<span class="sr-name">${t('stat.' + k)}</span>` +
        `<span class="sr-val">${p.stats[k]}` +
        (bonus ? ` <span class="sr-bonus">+${bonus}</span>` : '') + `</span>` +
        `<span class="sr-desc">${t('statd.' + k)}</span>`;
      const btn = document.createElement('button');
      btn.className = 'sp-plus';
      btn.textContent = '+';
      btn.disabled = p.statPoints <= 0;
      btn.addEventListener('click', () => {
        if (p.statPoints > 0) {
          p.stats[k]++;
          p.statPoints--;
          this.game.sfx('point');
          this.game.save();
          this.renderStatPanel(p);
        }
      });
      row.appendChild(btn);
      statsBox.appendChild(row);
    }

    this.$('btn-sp-recommend').disabled = p.statPoints <= 0;

    const d = p.derived;
    this.$('sp-derived').innerHTML =
      `<span>${t('drv.hp')}: <b>${d.maxHp}</b></span>` +
      `<span>${t('drv.mp')}: <b>${d.maxMp}</b></span>` +
      `<span>${t('drv.atk')}: <b>${d.atk}</b></span>` +
      `<span>${t('drv.matk')}: <b>${d.matk}</b></span>` +
      `<span>${t('drv.spd')}: <b>${Math.round(d.speed)}</b></span>` +
      `<span>${t('drv.crit')}: <b>${d.crit.toFixed(0)}%</b></span>`;
  },

  /* ---------- Hotkey settings ---------- */
  openKeysPanel() {
    this.$('keys-panel').classList.remove('hidden');
    this.renderKeysPanel();
  },

  closeKeysPanel() {
    this.listening = null;
    this.$('keys-panel').classList.add('hidden');
  },

  renderKeysPanel() {
    const box = this.$('keys-table');
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'keys-row head';
    head.innerHTML = `<span class="ka-name">${t('keys.action')}</span>` +
      `<span style="width:110px">${t('keys.key')}</span>`;
    box.appendChild(head);

    for (const action of KEY_ACTIONS) {
      const row = document.createElement('div');
      row.className = 'keys-row';
      const name = document.createElement('span');
      name.className = 'ka-name';
      name.textContent = t('act.' + action);
      row.appendChild(name);
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      const isListening = this.listening && this.listening.action === action;
      btn.textContent = isListening ? t('keys.press') : prettyKey(KEYS[action]);
      if (isListening) btn.classList.add('listening');
      btn.addEventListener('click', () => {
        this.listening = { action };
        this.renderKeysPanel();
      });
      row.appendChild(btn);
      box.appendChild(row);
    }
  },

  /* Called from the global keydown handler while listening. */
  captureKey(code) {
    if (!this.listening) return false;
    if (code === 'Escape') {
      this.listening = null;
      this.renderKeysPanel();
      return true;
    }
    const { action } = this.listening;
    // unbind this key anywhere else to avoid conflicts
    for (const a of KEY_ACTIONS) {
      if (KEYS[a] === code && a !== action) KEYS[a] = '';
    }
    KEYS[action] = code;
    saveKeys();
    this.listening = null;
    this.renderKeysPanel();
    this.rebuildSkillbars();
    if (this.game) this.game.sfx('point');
    return true;
  },

  /* Online state now surfaces only through the HUD badge (updateHud);
   * kept as a safe no-op because the net layer still pings it on
   * connect/disconnect. */
  updateOnlinePanel() {},

  /* ---------- Account ---------- */
  openAccountPanel() {
    this.$('account-panel').classList.remove('hidden');
    this.renderAccountPanel();
  },

  setAccountMsg(text, kind) {
    const m = this.$('account-msg');
    if (!m) return;
    m.textContent = text || '';
    m.className = 'acct-msg' + (kind ? ' ' + kind : '');
  },

  refreshAccountStatus() {
    const el = this.$('account-title-status');
    if (el) el.textContent = Account.loggedIn ? t('account.loggedInAs', { name: Account.username }) : '';
    // the guest hint only applies while signed out
    const hint = this.$('title-coop-hint');
    if (hint) hint.classList.toggle('hidden', Account.loggedIn);
    // the title Account button is only for managing/logging out an existing
    // session — the landing already has Log in / Register, so hide it there
    const acct = this.$('btn-account-title');
    if (acct) acct.classList.toggle('hidden', !Account.loggedIn);
  },

  renderAccountPanel() {
    const box = this.$('account-content');
    this.setAccountMsg('');
    if (!Account.available()) {
      box.innerHTML = `<div class="acct-status">${escapeHtml(t('account.offlineOnly'))}</div>`;
      return;
    }
    if (Account.loggedIn) {
      box.innerHTML = `<div class="acct-status ok">${escapeHtml(t('account.loggedInAs', { name: Account.username }))}</div>`;
      const out = document.createElement('button');
      out.className = 'pix-btn';
      out.textContent = t('account.logout');
      out.addEventListener('click', async () => {
        const inGame = !!(this.game && this.game.running);
        await Account.logout();
        this.$('account-panel').classList.add('hidden');
        if (inGame && typeof returnToTitle === 'function') {
          returnToTitle();   // back to the very first start screen to switch accounts
        } else {
          this.renderAccountPanel();
          this.refreshAccountStatus();
          if (typeof refreshContinue === 'function') refreshContinue();
          if (typeof showTitleStep === 'function') showTitleStep();
        }
      });
      box.appendChild(out);
      return;
    }
    box.innerHTML =
      `<div class="online-form">` +
      `<label><span>${escapeHtml(t('account.username'))}</span>` +
      `<input id="acct-user" class="pix-input" maxlength="16" autocomplete="off"></label>` +
      `<div id="acct-user-check" class="name-check"></div>` +
      `<label><span>${escapeHtml(t('account.password'))}</span>` +
      `<input id="acct-pass" class="pix-input" type="password" maxlength="64" autocomplete="off"></label>` +
      `</div>`;
    const row = document.createElement('div');
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'pix-btn'; b.textContent = label;
      b.addEventListener('click', fn); return b;
    };
    row.appendChild(mk(t('account.login'), () => this.submitAccount('login')));
    row.appendChild(mk(t('account.register'), () => this.submitAccount('register')));
    box.appendChild(row);
    // live username-availability feedback (debounced) so a duplicate is
    // caught before the player commits to it
    this._userOk = null;
    let uT = null;
    this.$('acct-user').addEventListener('input', () => {
      clearTimeout(uT);
      uT = setTimeout(() => this.checkUsernameAvailable(), 350);
    });
  },

  /* Ask the server whether an account username is free (and valid). */
  async checkUsernameAvailable() {
    const box = this.$('acct-user-check');
    const input = this.$('acct-user');
    if (!box || !input) return;
    const u = (input.value || '').trim();
    this._userOk = null;
    if (!u) { box.textContent = ''; box.className = 'name-check'; return; }
    if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) {
      this._userOk = false; box.textContent = t('account.userInvalid'); box.className = 'name-check err'; return;
    }
    if (Account.base() === null) { box.textContent = ''; box.className = 'name-check'; return; }
    box.textContent = t('account.userChecking'); box.className = 'name-check checking';
    const token = (this._userToken = (this._userToken || 0) + 1);
    try {
      const res = await fetch(Account.base() + '/api/username-available?username=' + encodeURIComponent(u));
      const data = await res.json();
      if (token !== this._userToken) return;   // superseded by a newer check
      this._userOk = !!data.available;
      box.textContent = data.available ? t('account.userFree') : t('account.userTaken');
      box.className = 'name-check ' + (data.available ? 'ok' : 'err');
    } catch (e) {
      if (token !== this._userToken) return;
      this._userOk = null; box.textContent = ''; box.className = 'name-check';   // let the server decide on submit
    }
  },

  /* A new hero's name must not duplicate a name already in the database
   * (character names live as account usernames), so validate the guest
   * name field against the same registry. */
  async checkHeroName() {
    const box = this.$('hero-name-check');
    const input = this.$('hero-name');
    if (!box || !input) return;
    const u = (input.value || '').trim();
    this._heroNameOk = null;
    if (!u) { box.textContent = ''; box.className = 'name-check'; if (typeof updateStartBtn === 'function') updateStartBtn(); return; }
    if (Account.base() === null) { box.textContent = ''; box.className = 'name-check'; return; }
    box.textContent = t('title.nameChecking'); box.className = 'name-check checking';
    const token = (this._heroNameToken = (this._heroNameToken || 0) + 1);
    try {
      const res = await fetch(Account.base() + '/api/hero-name-available?name=' + encodeURIComponent(u));
      const data = await res.json();
      if (token !== this._heroNameToken) return;
      // taken only if it's a valid name already claimed by someone
      this._heroNameOk = data.available || !data.valid;
      const free = this._heroNameOk;
      box.textContent = free ? t('title.nameFree') : t('title.nameTaken');
      box.className = 'name-check ' + (free ? 'ok' : 'err');
    } catch (e) {
      if (token !== this._heroNameToken) return;
      this._heroNameOk = null; box.textContent = ''; box.className = 'name-check';
    }
    if (typeof updateStartBtn === 'function') updateStartBtn();
  },

  async submitAccount(mode) {
    const u = (this.$('acct-user').value || '').trim();
    const p = this.$('acct-pass').value || '';
    if (!u || !p) { this.setAccountMsg(t('account.needFields'), 'err'); return; }
    // block an obviously-taken/invalid username before hitting register
    if (mode === 'register' && this._userOk === false) {
      this.setAccountMsg(t('account.userTaken'), 'err');
      if (this.game) this.game.sfx('hurt');
      return;
    }
    this.setAccountMsg(t('account.working'), '');
    const res = mode === 'register' ? await Account.register(u, p) : await Account.login(u, p);
    if (!res.ok) {
      const map = { taken: 'account.err_taken', bad_username: 'account.err_bad_username',
        bad_password: 'account.err_bad_password', bad_credentials: 'account.err_bad_credentials',
        offline: 'account.err_offline' };
      this.setAccountMsg(t(map[res.error] || 'account.err_error'), 'err');
      if (this.game) this.game.sfx('hurt');
      return;
    }
    // success → close the panel and proceed to the class step
    this.$('account-panel').classList.add('hidden');
    this.refreshAccountStatus();
    if (typeof showTitleStep === 'function') showTitleStep();
    this.toast(t(mode === 'register' ? 'account.registered' : 'account.welcome', { name: Account.username }));
    if (this.game) this.game.sfx('levelup');
    await Account.loadCharacter();
    this.refreshAccountStatus();
    if (typeof refreshContinue === 'function') refreshContinue();
    if (typeof showTitleStep === 'function') showTitleStep();
    // signing in during a guest session promotes it to online right away
    if (this.game && this.game.running && !this.game.net.isOnline) {
      for (const pl of this.game.players) pl.name = Account.username;
      this.game.goOnline(Account.username);
    }
  },

  /* ---------- Leaderboard ---------- */
  boardTab: 'level',
  boardData: null,

  async openBoard() {
    this.$('board-panel').classList.remove('hidden');
    this.$('board-content').innerHTML = `<div class="trade-status">…</div>`;
    const base = this.game ? this.game.apiBase() : (location.protocol.startsWith('http') ? '' : null);
    if (base === null) {
      this.$('board-content').innerHTML = `<div class="trade-status">${t('board.error')}</div>`;
      return;
    }
    try {
      if (this.game) this.game.submitScores();          // make sure we're on it
      const res = await fetch(base + '/api/leaderboard');
      this.boardData = await res.json();
      this.renderBoard();
    } catch (e) {
      this.$('board-content').innerHTML = `<div class="trade-status">${t('board.error')}</div>`;
    }
  },

  renderBoard() {
    document.querySelectorAll('.board-tab').forEach(btn =>
      btn.classList.toggle('selected', btn.dataset.tab === this.boardTab));
    const box = this.$('board-content');
    const list = (this.boardData && this.boardData[this.boardTab]) || [];
    if (!list.length) {
      box.innerHTML = `<div class="trade-status">${t('board.empty')}</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const valueOf = e =>
      this.boardTab === 'level' ? 'Lv ' + e.level :
      this.boardTab === 'kills' ? '☠ ' + e.kills :
      this.boardTab === 'bosses' ? '👑 ' + (e.bosses || 0) : '🪙 ' + e.gold;
    box.innerHTML = list.map((e, i) => {
      const mine = typeof PID !== 'undefined' && e.id && e.id.indexOf(PID + '-') === 0;
      return `<div class="board-row ${mine ? 'mine' : ''}">` +
        `<span class="br-rank">${medals[i] || (i + 1)}</span>` +
        `<span class="br-name">${escapeHtml(e.name)} ${mine ? t('board.you') : ''}` +
        `<small> ${t('class.' + e.cls)} · Lv${e.level}</small></span>` +
        `<span class="br-value">${valueOf(e)}</span></div>`;
    }).join('');
  },

  /* ---------- Chat ---------- */
  addChat(name, text, mine) {
    const log = this.$('chat-log');
    const line = document.createElement('div');
    line.className = 'chat-line' + (mine ? ' mine' : '');
    const b = document.createElement('b');
    b.textContent = name + ': ';
    line.appendChild(b);
    line.appendChild(document.createTextNode(text));
    log.appendChild(line);
    while (log.children.length > 8) log.firstChild.remove();
    setTimeout(() => { line.style.opacity = '0.45'; }, 8000);
  },

  /* ---------- Announcements (server-published patch notes) ---------- */
  async openNews() {
    this.$('news-panel').classList.remove('hidden');
    const box = this.$('news-content');
    box.innerHTML = `<div class="news-status">${escapeHtml(t('news.loading'))}</div>`;
    const base = this.game ? this.game.apiBase() : (location.protocol.startsWith('http') ? '' : null);
    if (base === null) { box.innerHTML = `<div class="news-status">${escapeHtml(t('news.error'))}</div>`; return; }
    try {
      const res = await fetch(base + '/api/announcements');
      const data = await res.json();
      this._newsItems = data.items || [];   // cache so a language switch can re-render
      this.renderNews(this._newsItems);
    } catch (e) {
      box.innerHTML = `<div class="news-status">${escapeHtml(t('news.error'))}</div>`;
    }
  },

  renderNews(items) {
    const box = this.$('news-content');
    if (!box) return;
    if (!items.length) { box.innerHTML = `<div class="news-status">${escapeHtml(t('news.empty'))}</div>`; return; }
    box.innerHTML = items.map(it => {
      const loc = it[currentLang] || it.en || it.th || {};
      const body = escapeHtml(loc.body || '').replace(/\n/g, '<br>');
      return `<div class="news-item"><div class="news-head">` +
        `<span class="news-item-title">${escapeHtml(loc.title || '')}</span>` +
        `<span class="news-date">${escapeHtml(it.date || '')}</span></div>` +
        `<div class="news-body">${body}</div></div>`;
    }).join('');
  },

  closeNews() { this.$('news-panel').classList.add('hidden'); },

  /* ---------- Trade ---------- */
  openTradePanel() {
    this.$('trade-panel').classList.remove('hidden');
    this.renderTrade(this.game);
  },

  closeTrade() {
    this.$('trade-panel').classList.add('hidden');
  },

  showTradeRequest(pt) {
    this.$('trade-req-text').textContent = t('trade.request', { name: pt.name });
    this.$('trade-request').classList.remove('hidden');
  },

  hideTradeRequest() {
    this.$('trade-request').classList.add('hidden');
  },

  renderTrade(game) {
    const box = this.$('trade-content');
    if (!game) return;
    const tr = game.trade;

    /* -- active trade window -- */
    if (tr) {
      if (tr.stage === 'waiting') {
        box.innerHTML = `<div class="trade-status">${t('trade.waiting', { name: escapeHtml(tr.withName) })}</div>` +
          `<button class="pix-btn small" id="tr-cancel">${t('ui.cancel')}</button>`;
        box.querySelector('#tr-cancel').addEventListener('click', () => game.cancelTrade());
        return;
      }
      box.innerHTML =
        `<div class="trade-status ${tr.theirAccept ? 'ready' : ''}">${t('trade.with', { name: escapeHtml(tr.withName) })}` +
        (tr.theirAccept ? ' — ' + t('trade.ready') : '') + `</div>` +
        `<div class="trade-cols">` +
        `<div class="trade-side ${tr.myAccept ? 'accepted' : ''}"><h4>${t('trade.myOffer')}</h4>` +
        `<div class="ts-gold">🪙 <input id="tr-my-gold" class="pix-input" type="number" min="0" max="${tr.me.gold}" value="${tr.myGold}" ${tr.myAccept ? 'disabled' : ''}></div>` +
        `<div class="trade-grid" id="tr-my-items"></div></div>` +
        `<div class="trade-side ${tr.theirAccept ? 'accepted' : ''}"><h4>${t('trade.theirOffer')}</h4>` +
        `<div class="ts-gold">🪙 ${tr.theirGold}</div>` +
        `<div class="trade-grid" id="tr-their-items"></div></div>` +
        `</div>` +
        (tr.myAccept ? '' : `<div class="trade-bag-label">${t('trade.yourBag')}</div><div class="trade-grid" id="tr-bag"></div>`) +
        `<button class="pix-btn ${tr.myAccept ? 'selected' : ''}" id="tr-accept">${tr.myAccept ? t('trade.locked') : t('trade.lock')}</button>` +
        `<button class="pix-btn small" id="tr-cancel">${t('ui.cancel')}</button>`;

      const fill = (id, items, onClick) => {
        const el = box.querySelector('#' + id);
        if (!el) return;
        el.innerHTML = '';
        if (!items.length) { el.innerHTML = `<div class="trade-empty">${escapeHtml(t('trade.offerEmpty'))}</div>`; return; }
        for (const it of items) {
          const c = document.createElement('div');
          c.className = 'trade-cell'; c.style.borderColor = itemColor(it);
          c.innerHTML = itemIcon(it) +
            (it.kind === 'potion' && (it.count || 1) > 1 ? `<span class="ic-count">${it.count}</span>` : '');
          this._invHover(c, it);
          if (onClick) c.addEventListener('click', () => { this.hideSkillTip(); onClick(it); });
          el.appendChild(c);
        }
      };
      fill('tr-my-items', tr.myItems, tr.myAccept ? null : it => game.removeTradeItem(it));
      fill('tr-their-items', tr.theirItems, null);
      if (!tr.myAccept) fill('tr-bag', tr.me.inventory, it => game.addTradeItem(it));

      box.querySelector('#tr-my-gold').addEventListener('change', ev => game.setTradeGold(ev.target.value));
      box.querySelector('#tr-accept').addEventListener('click', () => {
        const input = box.querySelector('#tr-my-gold');
        if (!tr.myAccept) game.setTradeGold(input.value);
        game.toggleTradeAccept();
      });
      box.querySelector('#tr-cancel').addEventListener('click', () => game.cancelTrade());
      return;
    }

    /* -- target list -- */
    box.innerHTML = '';
    let remoteCount = 0;
    if (game.net.isOnline) {
      for (const [cid, arr] of game.remotePlayers) {
        arr.forEach((rp, k) => {
          remoteCount++;
          const row = document.createElement('div');
          row.className = 'trade-row';
          row.innerHTML = `<span class="tr-name">${escapeHtml(rp.name)} <small>Lv${rp.level} · ${t('class.' + rp.clsId)}</small></span>`;
          const btn = document.createElement('button');
          btn.className = 'pix-btn small';
          btn.textContent = t('trade.title').replace('🤝 ', '');
          btn.addEventListener('click', () => game.openTradeWith(game.players[0], cid + ':' + k, rp.name));
          row.appendChild(btn);
          box.appendChild(row);
        });
      }
      if (!remoteCount) {
        box.innerHTML = `<div class="trade-status">${t('trade.none')}</div>`;
      }
    } else {
      box.innerHTML = `<div class="trade-status">${t('trade.online')}</div>`;
    }
  },

  /* ---------- Toasts ---------- */
  toast(text, kind = 'gold') {
    const area = this.$('toast-area');
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'info' ? ' info' : '');
    el.textContent = text;
    area.appendChild(el);
    setTimeout(() => el.remove(), 3200);
    while (area.children.length > 4) area.firstChild.remove();
  },

  showHelp() {
    const key = code => `<span class="key">${prettyKey(code)}</span>`;
    const vars = {
      move: key(KEYS.up) + key(KEYS.left) + key(KEYS.down) + key(KEYS.right),
      attack: key(KEYS.attack),
      skills: key(KEYS.skill1) + key(KEYS.skill2) + key(KEYS.skill3),
      panel: key(KEYS.panel),
      afk: key(KEYS.afk),
    };
    this.$('help-content').innerHTML = t('help.html', vars);
    this.$('help-panel').classList.remove('hidden');
  },
};

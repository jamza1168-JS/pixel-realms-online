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
    const km = KEYS[player.id];
    const keys = [km.attack, km.skill1, km.skill2, km.skill3].map(prettyKey);
    // slot 0 = basic attack
    const slots = [{ icon: player.cls.attackType === 'melee' ? '⚔️' : '🏹', name: 'ATK', id: null }]
      .concat(player.cls.skills.map(sid => ({ icon: SKILLS[sid].icon, name: t('skill.' + sid), id: sid })));
    slots.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'skill-slot';
      el.dataset.skill = s.id || '';
      el.innerHTML = `<span class="ss-key">${keys[i]}</span><span class="ss-icon">${s.icon}</span>` +
        `<span class="ss-name">${s.name}</span><div class="ss-cd" style="height:0"></div>`;
      bar.appendChild(el);
    });
  },

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
      const d = p.derived;
      const pre = 'p' + p.id;
      this.$(pre + '-level').textContent = p.level;
      this.$(pre + '-hp').style.width = Math.max(0, (p.hp / d.maxHp) * 100) + '%';
      this.$(pre + '-mp').style.width = Math.max(0, (p.mp / d.maxMp) * 100) + '%';
      this.$(pre + '-xp').style.width = Math.min(100, (p.xp / xpToNext(p.level)) * 100) + '%';
      this.$(pre + '-hp-text').textContent = Math.ceil(p.hp) + ' / ' + d.maxHp;
      this.$(pre + '-mp-text').textContent = Math.ceil(p.mp) + ' / ' + d.maxMp;
      this.$(pre + '-name').textContent = t('class.' + p.clsId);
      this.$(pre + '-points-hint').classList.toggle('hidden', p.statPoints <= 0);
      this.$('afk-' + pre).classList.toggle('selected', p.afk);

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

    // zone name for player 1
    const p1 = game.players[0];
    if (p1) this.$('zone-name').textContent = t('zone.' + game.world.tierAt(p1.x, p1.y));

    // online badge
    if (game.net.isOnline) {
      this.$('online-text').textContent = t('online.players', { n: game.net.playerCount }) +
        (game.net.isHost ? ' ★' : '');
    } else {
      this.$('online-text').textContent = t('ui.online') + ' · ' + game.net.playerCount + 'P';
    }

    if (this.statPanelPlayer && !this.$('stat-panel').classList.contains('hidden')) {
      this.renderStatPanel(this.statPanelPlayer);
    }

    this.drawMinimap(game);
  },

  drawMinimap(game) {
    const mm = this.$('minimap');
    const g = mm.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(game.world.minimapImg, 0, 0, mm.width, mm.height);
    const sx = mm.width / (MAP_W * TILE), sy = mm.height / (MAP_H * TILE);
    // boss
    if (game.world.bossPos) {
      g.fillStyle = '#ff3050';
      g.fillRect(game.world.bossPos.x * sx - 2, game.world.bossPos.y * sy - 2, 4, 4);
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

  renderStatPanel(p) {
    this.$('sp-title').textContent = t('ui.statsOf', { name: p.name });
    this.$('sp-class').textContent = t('class.' + p.clsId);
    this.$('sp-level').textContent = p.level;
    this.$('sp-points').textContent = p.statPoints;

    const statsBox = this.$('sp-stats');
    statsBox.innerHTML = '';
    for (const k of STAT_KEYS) {
      const row = document.createElement('div');
      row.className = 'sp-row';
      row.innerHTML = `<span class="sr-name">${t('stat.' + k)}</span>` +
        `<span class="sr-val">${p.stats[k]}</span>` +
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
      `<span style="width:110px">${t('keys.p1')}</span>` +
      `<span style="width:110px">${t('keys.p2')}</span>`;
    box.appendChild(head);

    for (const action of KEY_ACTIONS) {
      const row = document.createElement('div');
      row.className = 'keys-row';
      const name = document.createElement('span');
      name.className = 'ka-name';
      name.textContent = t('act.' + action);
      row.appendChild(name);
      for (const pid of [1, 2]) {
        const btn = document.createElement('button');
        btn.className = 'key-btn';
        const isListening = this.listening && this.listening.pid === pid && this.listening.action === action;
        btn.textContent = isListening ? t('keys.press') : prettyKey(KEYS[pid][action]);
        if (isListening) btn.classList.add('listening');
        btn.addEventListener('click', () => {
          this.listening = { pid, action };
          this.renderKeysPanel();
        });
        row.appendChild(btn);
      }
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
    const { pid, action } = this.listening;
    // unbind this key anywhere else to avoid conflicts
    for (const id of [1, 2]) {
      for (const a of KEY_ACTIONS) {
        if (KEYS[id][a] === code && !(id === pid && a === action)) KEYS[id][a] = '';
      }
    }
    KEYS[pid][action] = code;
    saveKeys();
    this.listening = null;
    this.renderKeysPanel();
    this.rebuildSkillbars();
    if (this.game) this.game.sfx('point');
    return true;
  },

  /* ---------- Online panel ---------- */
  openOnlinePanel() {
    if (!this.$('online-name').value) {
      this.$('online-name').value = 'Hero' + Math.floor(100 + Math.random() * 900);
    }
    this.$('online-panel').classList.remove('hidden');
    this.updateOnlinePanel();
  },

  updateOnlinePanel() {
    const status = this.$('online-status');
    if (!status) return;
    const net = this.game ? this.game.net : null;
    const s = net ? net.status : 'off';
    status.className = 'online-status ' + (s === 'on' ? 'on' : s === 'error' ? 'err' : s === 'connecting' ? 'connecting' : '');
    status.textContent =
      s === 'on' ? '● ' + t('online.on') + (net.isHost ? ' ★ ' + t('online.host') : '') :
      s === 'connecting' ? t('online.connecting') :
      s === 'error' ? t('online.error') : t('online.off');
    this.$('btn-online-connect').classList.toggle('hidden', s === 'on');
    this.$('btn-online-disconnect').classList.toggle('hidden', s !== 'on');
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
      this.boardTab === 'kills' ? '☠ ' + e.kills : '🪙 ' + e.gold;
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
        `<div class="trade-offer-box">` +
        `<div class="trade-offer ${tr.myAccept ? 'accepted' : ''}"><h4>${t('trade.myOffer')} (🪙 ${tr.me.gold})</h4>` +
        `<input id="tr-my-gold" class="pix-input" type="number" min="0" max="${tr.me.gold}" value="${tr.myGold}" ${tr.myAccept ? 'disabled' : ''}></div>` +
        `<div class="trade-offer ${tr.theirAccept ? 'accepted' : ''}"><h4>${t('trade.theirOffer')}</h4>` +
        `<div class="to-gold">🪙 ${tr.theirGold}</div></div>` +
        `</div>` +
        `<button class="pix-btn ${tr.myAccept ? 'selected' : ''}" id="tr-accept">${tr.myAccept ? t('trade.locked') : t('trade.lock')}</button>` +
        `<button class="pix-btn small" id="tr-cancel">${t('ui.cancel')}</button>`;
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

    // local party transfer
    if (game.players.length > 1) {
      const row = document.createElement('div');
      row.className = 'trade-row';
      row.innerHTML = `<span class="tr-name">${t('trade.local')}</span>` +
        `<input class="pix-input" id="tr-local-amt" type="number" min="1" value="10" style="width:80px">`;
      for (const [from, to] of [[0, 1], [1, 0]]) {
        const btn = document.createElement('button');
        btn.className = 'pix-btn small';
        btn.textContent = `P${from + 1}→P${to + 1}`;
        btn.addEventListener('click', () => {
          const amt = Math.max(0, Math.min(game.players[from].gold, Math.floor(+box.querySelector('#tr-local-amt').value || 0)));
          if (amt > 0) {
            game.players[from].gold -= amt;
            game.players[to].gold += amt;
            game.sfx('gold');
            game.save();
            this.toast(t('trade.sent', { n: amt, name: 'P' + (to + 1) }), 'info');
          }
        });
        row.appendChild(btn);
      }
      box.appendChild(row);
    }

    // remote players
    let remoteCount = 0;
    if (game.net.isOnline) {
      for (const [cid, arr] of game.remotePlayers) {
        arr.forEach((rp, k) => {
          remoteCount++;
          const row = document.createElement('div');
          row.className = 'trade-row';
          row.innerHTML = `<span class="tr-name">${escapeHtml(rp.name)} <small>Lv${rp.level} · ${t('class.' + rp.clsId)}</small></span>`;
          for (const p of game.players) {
            const btn = document.createElement('button');
            btn.className = 'pix-btn small';
            btn.textContent = t('trade.title').replace('🤝 ', '') + (game.players.length > 1 ? ' (P' + p.id + ')' : '');
            btn.addEventListener('click', () => game.openTradeWith(p, cid + ':' + k, rp.name));
            row.appendChild(btn);
          }
          box.appendChild(row);
        });
      }
      if (!remoteCount && game.players.length < 2) {
        box.innerHTML = `<div class="trade-status">${t('trade.none')}</div>`;
      }
    } else if (game.players.length < 2) {
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
    const vars = {};
    for (const pid of [1, 2]) {
      const k = KEYS[pid];
      vars['p' + pid + 'move'] = key(k.up) + key(k.left) + key(k.down) + key(k.right);
      vars['p' + pid + 'attack'] = key(k.attack);
      vars['p' + pid + 'skills'] = key(k.skill1) + key(k.skill2) + key(k.skill3);
      vars['p' + pid + 'panel'] = key(k.panel);
      vars['p' + pid + 'afk'] = key(k.afk);
    }
    this.$('help-content').innerHTML = t('help.html', vars);
    this.$('help-panel').classList.remove('hidden');
  },
};

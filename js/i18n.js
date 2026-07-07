/* ============================================================
 * i18n.js — Language system (English / Thai)
 * All UI strings live here. Use t('key') everywhere.
 * ============================================================ */

const I18N = {
  en: {
    'lang.name': 'EN',
    'lang.switchTo': 'ภาษาไทย',

    'title.subtitle': 'A co-op pixel MMO adventure',
    'title.chooseClass': 'Choose your class',
    'title.start': 'START ADVENTURE',
    'title.continue': 'CONTINUE',
    'title.coopHint': 'Player 2 can join anytime in-game — press P',

    'ui.lv': 'Lv',
    'ui.points': 'Points',
    'ui.pointsHint': 'Stat points available!',
    'ui.pointsHint2': 'Stat points available!',
    'ui.joinP2': '+ P2 Join (P)',
    'ui.p2Choose': 'Player 2 — choose your class',
    'ui.cancel': 'Cancel',
    'ui.close': 'Close',
    'ui.statsOf': 'Stats — {name}',
    'ui.online': 'LOCAL',
    'ui.dead': '{name} fell! Respawning in {s}...',
    'ui.levelUp': '{name} reached level {lv}! +5 stat points',
    'ui.p2Joined': 'Player 2 joined the party!',
    'ui.saved': 'Game saved',
    'ui.gotGold': '+{n} gold',
    'ui.bossWarn': '⚠ The Demon Lord awaits in the far wastes...',
    'ui.bossDown': '🏆 The Demon Lord has been defeated!',
    'ui.afk': 'AUTO',
    'ui.afkOn': '🤖 AFK farming ON — {name}',
    'ui.afkOff': 'AFK farming OFF — {name}',

    'keys.title': 'Hotkey Settings',
    'keys.action': 'Action',
    'keys.p1': 'Player 1',
    'keys.p2': 'Player 2',
    'keys.press': 'Press a key…',
    'keys.reset': 'Reset to defaults',
    'act.up': 'Move up', 'act.down': 'Move down', 'act.left': 'Move left', 'act.right': 'Move right',
    'act.attack': 'Attack', 'act.skill1': 'Skill 1', 'act.skill2': 'Skill 2', 'act.skill3': 'Skill 3',
    'act.panel': 'Stat panel', 'act.afk': 'AFK auto-farm',

    'online.title': '🌐 Online Multiplayer',
    'online.server': 'Server address',
    'online.room': 'Room',
    'online.name': 'Your name',
    'online.connect': 'Connect',
    'online.disconnect': 'Disconnect',
    'online.off': 'Offline',
    'online.connecting': 'Connecting…',
    'online.on': 'Connected',
    'online.error': 'Connection failed — is the server running?',
    'online.host': 'host',
    'online.players': 'ONLINE · {n} players',
    'online.hint': 'Start the server with:  python server.py  — friends on your network join with your IP and the same room name.',
    'online.joined': '🟢 {name} joined the realm!',
    'online.left': '🔴 {name} left the realm',

    'chat.placeholder': 'Press Enter to chat…',
    'chat.you': 'You',

    'trade.title': '🤝 Trade',
    'trade.tradeAs': 'Trade as',
    'trade.with': 'Trading with {name}',
    'trade.request': '{name} wants to trade!',
    'trade.accept': 'Accept',
    'trade.decline': 'Decline',
    'trade.myOffer': 'Your gold offer',
    'trade.theirOffer': 'Their offer',
    'trade.lock': '✔ Accept trade',
    'trade.locked': 'Waiting for partner…',
    'trade.ready': 'Partner accepted!',
    'trade.done': '🤝 Trade complete!',
    'trade.cancelled': 'Trade cancelled',
    'trade.declined': 'Trade declined',
    'trade.waiting': 'Waiting for {name} to accept…',
    'trade.none': 'No other players nearby to trade with.',
    'trade.online': 'Connect online (🌐) to trade with other players.',
    'trade.local': 'Local party transfer',
    'trade.give': 'Send',
    'trade.sent': 'Sent {n} gold to {name}',

    'stat.str': 'STR — Strength',
    'stat.agi': 'AGI — Agility',
    'stat.int': 'INT — Intellect',
    'stat.vit': 'VIT — Vitality',
    'stat.luk': 'LUK — Luck',
    'statd.str': 'physical damage',
    'statd.agi': 'move & attack speed',
    'statd.int': 'magic damage, max MP',
    'statd.vit': 'max HP, HP regen',
    'statd.luk': 'critical chance',

    'drv.hp': 'Max HP', 'drv.mp': 'Max MP', 'drv.atk': 'Attack',
    'drv.matk': 'Magic', 'drv.spd': 'Speed', 'drv.crit': 'Crit',

    'class.warrior': 'Warrior',
    'class.mage': 'Mage',
    'class.archer': 'Archer',
    'class.cleric': 'Cleric',
    'classd.warrior': 'Frontline fighter. High HP and heavy melee damage.',
    'classd.mage': 'Master of the elements. Devastating spells, fragile body.',
    'classd.archer': 'Swift ranged hunter. Fast attacks and deadly precision.',
    'classd.cleric': 'Holy support. Smites foes and heals the party.',

    'skill.heavyslash': 'Heavy Slash',
    'skill.whirlwind': 'Whirlwind',
    'skill.warcry': 'War Cry',
    'skill.fireball': 'Fireball',
    'skill.frostnova': 'Frost Nova',
    'skill.thunder': 'Thunder Strike',
    'skill.powershot': 'Power Shot',
    'skill.multishot': 'Multi Shot',
    'skill.swift': 'Swift Step',
    'skill.smite': 'Smite',
    'skill.heal': 'Heal',
    'skill.sanctuary': 'Sanctuary',

    'zone.0': 'Peaceful Meadow',
    'zone.1': 'Greenfields',
    'zone.2': 'Darkwood',
    'zone.3': 'Ashlands',
    'zone.4': "Demon's Reach",

    'enemy.slime': 'Slime', 'enemy.goblin': 'Goblin', 'enemy.wolf': 'Wolf',
    'enemy.bat': 'Shadow Bat', 'enemy.skeleton': 'Skeleton Archer', 'enemy.demon': 'Demon Lord',

    'help.title': 'How to play',
    'help.html': `
      <h3>Player 1</h3>
      {p1move} move · {p1attack} attack · {p1skills} skills ·
      {p1panel} stats · {p1afk} AFK farm
      <h3>Player 2 (co-op)</h3>
      <span class="key">P</span> join! then
      {p2move} move · {p2attack} attack · {p2skills} skills ·
      {p2panel} stats · {p2afk} AFK farm
      <h3>🤖 AFK auto-farming</h3>
      Toggle <b>AUTO</b> and your hero hunts monsters, casts skills, grabs loot,
      retreats to heal when hurt, and spends stat points automatically. Leave it
      running to level up while you're away.
      <h3>🌐 Online multiplayer</h3>
      Click the 🌐 button to join a server room and play with friends.
      To host: run <b>python server.py</b>, share your IP and room name.
      <h3>⌨ Hotkeys</h3>
      Click the ⌨ button to rebind every key.
      <h3>Goal</h3>
      Hunt monsters for XP and gold. Each level grants <b>+5 stat points</b>.
      Monsters grow stronger far from the village — the <b>Demon Lord</b> rules
      the farthest corner. Hearts and orbs restore HP/MP. Progress auto-saves.`,
  },

  th: {
    'lang.name': 'TH',
    'lang.switchTo': 'English',

    'title.subtitle': 'เกม MMO พิกเซลผจญภัยแบบเล่นร่วมกัน',
    'title.chooseClass': 'เลือกอาชีพของคุณ',
    'title.start': 'เริ่มการผจญภัย',
    'title.continue': 'เล่นต่อ',
    'title.coopHint': 'ผู้เล่น 2 เข้าร่วมได้ทุกเมื่อในเกม — กดปุ่ม P',

    'ui.lv': 'เลเวล',
    'ui.points': 'แต้ม',
    'ui.pointsHint': 'มีแต้มสเตตัส!',
    'ui.pointsHint2': 'มีแต้มสเตตัส!',
    'ui.joinP2': '+ ผู้เล่น 2 เข้าร่วม (P)',
    'ui.p2Choose': 'ผู้เล่น 2 — เลือกอาชีพของคุณ',
    'ui.cancel': 'ยกเลิก',
    'ui.close': 'ปิด',
    'ui.statsOf': 'สเตตัส — {name}',
    'ui.online': 'ในเครื่อง',
    'ui.dead': '{name} ล้มลง! เกิดใหม่ใน {s} วินาที...',
    'ui.levelUp': '{name} เลเวลอัพเป็น {lv}! ได้รับ 5 แต้มสเตตัส',
    'ui.p2Joined': 'ผู้เล่น 2 เข้าร่วมปาร์ตี้แล้ว!',
    'ui.saved': 'บันทึกเกมแล้ว',
    'ui.gotGold': '+{n} ทอง',
    'ui.bossWarn': '⚠ จอมมารรอคอยอยู่สุดขอบแดนร้าง...',
    'ui.bossDown': '🏆 จอมมารถูกกำจัดแล้ว!',
    'ui.afk': 'ออโต้',
    'ui.afkOn': '🤖 เปิดฟาร์มอัตโนมัติ — {name}',
    'ui.afkOff': 'ปิดฟาร์มอัตโนมัติ — {name}',

    'keys.title': 'ตั้งค่าปุ่มลัด',
    'keys.action': 'การกระทำ',
    'keys.p1': 'ผู้เล่น 1',
    'keys.p2': 'ผู้เล่น 2',
    'keys.press': 'กดปุ่มที่ต้องการ…',
    'keys.reset': 'คืนค่าเริ่มต้น',
    'act.up': 'เดินขึ้น', 'act.down': 'เดินลง', 'act.left': 'เดินซ้าย', 'act.right': 'เดินขวา',
    'act.attack': 'โจมตี', 'act.skill1': 'สกิล 1', 'act.skill2': 'สกิล 2', 'act.skill3': 'สกิล 3',
    'act.panel': 'หน้าต่างสเตตัส', 'act.afk': 'ฟาร์มอัตโนมัติ (AFK)',

    'online.title': '🌐 เล่นออนไลน์หลายคน',
    'online.server': 'ที่อยู่เซิร์ฟเวอร์',
    'online.room': 'ห้อง',
    'online.name': 'ชื่อของคุณ',
    'online.connect': 'เชื่อมต่อ',
    'online.disconnect': 'ตัดการเชื่อมต่อ',
    'online.off': 'ออฟไลน์',
    'online.connecting': 'กำลังเชื่อมต่อ…',
    'online.on': 'เชื่อมต่อแล้ว',
    'online.error': 'เชื่อมต่อไม่สำเร็จ — เซิร์ฟเวอร์เปิดอยู่หรือไม่?',
    'online.host': 'โฮสต์',
    'online.players': 'ออนไลน์ · {n} คน',
    'online.hint': 'เริ่มเซิร์ฟเวอร์ด้วยคำสั่ง:  python server.py  — เพื่อนในเครือข่ายเข้าร่วมด้วย IP ของคุณและชื่อห้องเดียวกัน',
    'online.joined': '🟢 {name} เข้าร่วมโลกแล้ว!',
    'online.left': '🔴 {name} ออกจากโลกไปแล้ว',

    'chat.placeholder': 'กด Enter เพื่อแชท…',
    'chat.you': 'คุณ',

    'trade.title': '🤝 แลกเปลี่ยน',
    'trade.tradeAs': 'แลกเปลี่ยนในนาม',
    'trade.with': 'กำลังแลกเปลี่ยนกับ {name}',
    'trade.request': '{name} ต้องการแลกเปลี่ยน!',
    'trade.accept': 'ตกลง',
    'trade.decline': 'ปฏิเสธ',
    'trade.myOffer': 'ทองที่คุณเสนอ',
    'trade.theirOffer': 'ข้อเสนอของอีกฝ่าย',
    'trade.lock': '✔ ยืนยันแลกเปลี่ยน',
    'trade.locked': 'รออีกฝ่ายยืนยัน…',
    'trade.ready': 'อีกฝ่ายยืนยันแล้ว!',
    'trade.done': '🤝 แลกเปลี่ยนสำเร็จ!',
    'trade.cancelled': 'ยกเลิกการแลกเปลี่ยน',
    'trade.declined': 'การแลกเปลี่ยนถูกปฏิเสธ',
    'trade.waiting': 'รอ {name} ตอบรับ…',
    'trade.none': 'ไม่มีผู้เล่นอื่นให้แลกเปลี่ยนด้วย',
    'trade.online': 'เชื่อมต่อออนไลน์ (🌐) เพื่อแลกเปลี่ยนกับผู้เล่นอื่น',
    'trade.local': 'โอนทองในปาร์ตี้',
    'trade.give': 'ส่ง',
    'trade.sent': 'ส่งทอง {n} ให้ {name} แล้ว',

    'stat.str': 'STR — พละกำลัง',
    'stat.agi': 'AGI — ความคล่องแคล่ว',
    'stat.int': 'INT — สติปัญญา',
    'stat.vit': 'VIT — ความอึด',
    'stat.luk': 'LUK — โชค',
    'statd.str': 'พลังโจมตีกายภาพ',
    'statd.agi': 'ความเร็วเคลื่อนที่และโจมตี',
    'statd.int': 'พลังเวท, MP สูงสุด',
    'statd.vit': 'HP สูงสุด, ฟื้นฟู HP',
    'statd.luk': 'โอกาสคริติคอล',

    'drv.hp': 'HP สูงสุด', 'drv.mp': 'MP สูงสุด', 'drv.atk': 'พลังโจมตี',
    'drv.matk': 'พลังเวท', 'drv.spd': 'ความเร็ว', 'drv.crit': 'คริ',

    'class.warrior': 'นักรบ',
    'class.mage': 'นักเวท',
    'class.archer': 'นักธนู',
    'class.cleric': 'นักบวช',
    'classd.warrior': 'แนวหน้าผู้แข็งแกร่ง HP สูงและโจมตีระยะประชิดรุนแรง',
    'classd.mage': 'จ้าวแห่งเวทมนตร์ คาถาทำลายล้างสูงแต่ตัวบอบบาง',
    'classd.archer': 'นักล่าระยะไกลผู้ว่องไว โจมตีเร็วและแม่นยำถึงตาย',
    'classd.cleric': 'ผู้สนับสนุนศักดิ์สิทธิ์ ลงทัณฑ์ศัตรูและรักษาปาร์ตี้',

    'skill.heavyslash': 'ฟันหนัก',
    'skill.whirlwind': 'ดาบหมุน',
    'skill.warcry': 'คำรามศึก',
    'skill.fireball': 'ลูกไฟ',
    'skill.frostnova': 'โนวาน้ำแข็ง',
    'skill.thunder': 'สายฟ้าฟาด',
    'skill.powershot': 'ยิงทะลวง',
    'skill.multishot': 'ยิงกระจาย',
    'skill.swift': 'ก้าวสายลม',
    'skill.smite': 'ทัณฑ์สวรรค์',
    'skill.heal': 'ฮีล',
    'skill.sanctuary': 'เขตศักดิ์สิทธิ์',

    'zone.0': 'ทุ่งหญ้าอันสงบ',
    'zone.1': 'ทุ่งเขียวขจี',
    'zone.2': 'ป่ามืด',
    'zone.3': 'แดนเถ้าถ่าน',
    'zone.4': 'แดนจอมมาร',

    'enemy.slime': 'สไลม์', 'enemy.goblin': 'ก็อบลิน', 'enemy.wolf': 'หมาป่า',
    'enemy.bat': 'ค้างคาวเงา', 'enemy.skeleton': 'โครงกระดูกนักธนู', 'enemy.demon': 'จอมมาร',

    'help.title': 'วิธีเล่น',
    'help.html': `
      <h3>ผู้เล่น 1</h3>
      {p1move} เดิน · {p1attack} โจมตี · {p1skills} สกิล ·
      {p1panel} สเตตัส · {p1afk} ฟาร์มอัตโนมัติ
      <h3>ผู้เล่น 2 (เล่นร่วมกัน)</h3>
      <span class="key">P</span> เข้าร่วม! จากนั้น
      {p2move} เดิน · {p2attack} โจมตี · {p2skills} สกิล ·
      {p2panel} สเตตัส · {p2afk} ฟาร์มอัตโนมัติ
      <h3>🤖 ฟาร์มอัตโนมัติ (AFK)</h3>
      เปิดโหมด <b>ออโต้</b> แล้วฮีโร่จะล่ามอนสเตอร์ ใช้สกิล เก็บของดรอป
      ถอยกลับไปฟื้นฟูเมื่อบาดเจ็บ และอัพแต้มสเตตัสให้เองอัตโนมัติ
      เปิดทิ้งไว้เพื่อเลเวลอัพระหว่างที่คุณไม่อยู่
      <h3>🌐 เล่นออนไลน์หลายคน</h3>
      กดปุ่ม 🌐 เพื่อเข้าห้องเซิร์ฟเวอร์และเล่นกับเพื่อน
      วิธีเปิดเซิร์ฟเวอร์: รัน <b>python server.py</b> แล้วแชร์ IP และชื่อห้อง
      <h3>⌨ ปุ่มลัด</h3>
      กดปุ่ม ⌨ เพื่อเปลี่ยนปุ่มได้ทุกปุ่ม
      <h3>เป้าหมาย</h3>
      ล่ามอนสเตอร์เพื่อรับ XP และทอง เลเวลอัพรับ <b>5 แต้มสเตตัส</b>
      มอนสเตอร์แข็งแกร่งขึ้นเมื่อไกลจากหมู่บ้าน — <b>จอมมาร</b> ครองมุมไกลสุด
      หัวใจและลูกแก้วฟื้นฟู HP/MP เกมบันทึกอัตโนมัติ`,
  },
};

let currentLang = localStorage.getItem('pixelrealms_lang') || 'en';

function t(key, vars) {
  let s = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  if (vars) for (const k in vars) s = s.replaceAll('{' + k + '}', vars[k]);
  return s;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('pixelrealms_lang', lang);
  applyI18n();
  document.dispatchEvent(new CustomEvent('langchange'));
}

/* Update every element tagged with data-i18n */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.textContent = t('lang.name') + ' ⇄';
}

/* ============================================================
 * i18n.js — Language system (English / Thai)
 * All UI strings live here. Use t('key') everywhere.
 * ============================================================ */

const I18N = {
  en: {
    'lang.name': 'EN',
    'lang.switchTo': 'ภาษาไทย',

    'title.subtitle': 'A pixel MMO adventure',
    'title.chooseClass': 'Choose your class',
    'title.loginBtn': '🔐 Log in / Register',
    'title.guestBtn': '▶ Play as Guest',
    'title.back': '← Back',
    'title.pdpa': '🔒 We use your account info only to save your progress and improve the game. We never sell your data to third parties.',
    'title.devNote': '⚠️ Early development — the game is still being built, so your progress may be reset at any time.',
    'title.heroName': 'Hero name',
    'title.heroNamePh': 'Name your hero…',
    'title.nameChecking': 'Checking name…',
    'title.nameFree': '✓ Name available',
    'title.nameTaken': '✗ Name already taken — choose another',
    'title.start': 'START ADVENTURE',
    'title.continue': 'CONTINUE',
    'title.coopHint': "Guest mode — progress isn't saved. Log in to keep your hero and play online with everyone.",

    'ui.lv': 'Lv',
    'ui.points': 'Points',
    'ui.pointsHint': 'Stat points available!',
    'ui.stats': 'Stats',
    'ui.healZone': '❤ Healing Circle',
    'ui.cancel': 'Cancel',
    'ui.close': 'Close',
    'ui.statsOf': 'Stats — {name}',
    'ui.recommend': '★ Recommended build',
    'ui.resetStat': '↺ Reset stats',
    'ui.online': 'OFFLINE',
    'ui.guest': 'GUEST',
    'ui.dead': '{name} fell! Respawning in {s}...',
    'ui.levelUp': '{name} reached level {lv}! +5 stat points',
    'ui.saved': 'Game saved',
    'ui.gotGold': '+{n} gold',
    'ui.bossWarn': '⚠ The Demon Lord awaits in the far wastes...',
    'ui.bossDown': '🏆 The Demon Lord has been defeated!',
    'ui.worldBossWarn': '🐉 A World Boss stirs — the Dragon rises in 5 minutes!',
    'ui.worldBossHere': '🐉 The Dragon has appeared in the southern wastes! Rally!',
    'ui.worldBossDown': '🏆 The World Boss Dragon has fallen! Glory to all!',
    'ui.afk': 'AUTO',
    'ui.afkOn': '🤖 AFK farming ON — {name}',
    'ui.afkOff': 'AFK farming OFF — {name}',

    'afk.title': '🤖 AFK Auto-Farm',
    'afk.hint': 'Choose what your hero hunts while auto-farming.',
    'afk.boss': 'Boss',
    'afk.bossHint': 'approach & fight bosses (off = flee from them)',
    'afk.monster': 'Monster',
    'afk.monsterHint': 'hunt monsters (off = walk past them)',

    'buff.warcry': 'War Cry — +35% damage',
    'buff.swift': 'Swift Step — +45% move speed',
    'buff.pot_spd': 'Speed Potion — +30% move speed',
    'buff.pot_atk': 'Power Potion — +30% damage',
    'buff.pot_aspd': 'Haste Potion — +25% attack speed',
    'buff.pot_regen': 'Regen Potion — 3× HP/MP regen',

    'inv.title': '🎒 Inventory',
    'inv.filterAll': 'All',
    'inv.filterPotion': 'Potions',
    'cmp.equipped': 'Equipped now',
    'cmp.vs': 'vs equipped',
    'inv.bag': 'Bag',
    'inv.equipped': 'Equipped',
    'inv.empty': 'Your bag is empty — hunt monsters to find gear!',
    'inv.equip': 'Equip',
    'inv.unequip': 'Unequip',
    'inv.destroy': 'Destroy',
    'inv.use': 'Use',
    'inv.got': '🎁 Got {name}!',
    'inv.rareDrop': '✨ {name} dropped!',
    'inv.emptySlot': '(empty)',
    'inv.twoHanded': 'Two-handed',
    'inv.destroyConfirm': 'Destroy {name}? This cannot be undone.',
    'inv.storage': 'Storage',
    'inv.emptyStore': 'Storage is empty — deposit items here to keep them safe.',
    'inv.deposit': 'Deposit',
    'inv.withdraw': 'Withdraw',
    'inv.reforge': 'Reforge',
    'inv.reforgePick': 'Pick a stat to reroll',
    'inv.reforgeCost': '⚒ Reforge ({n}🪙)',
    'inv.cancel': 'Cancel',
    'inv.toSlot': '⌨ {k}',

    'shop.title': '🛒 Merchant',
    'shop.buy': 'Buy',
    'shop.sell': 'Sell',
    'shop.buyBtn': 'Buy',
    'shop.sellBtn': 'Sell',
    'shop.poor': 'Not enough gold!',
    'shop.nothing': 'Nothing in your bag to sell.',

    'quick.out': 'Out of {name}!',

    'tier.common': 'Common',
    'tier.rare': 'Rare',
    'tier.unique': 'Unique',
    'tier.legend': 'Legend',
    'tier.mystic': 'Mystic',

    'slot.head': 'Headgear',
    'slot.chest': 'Chest',
    'slot.hands': 'Weapon',
    'slot.legs': 'Legs',
    'slot.boots': 'Boots',

    'gear.head': 'Helm',
    'gear.chest': 'Armor',
    'gear.legs': 'Greaves',
    'gear.boots': 'Boots',
    'gear.sword1h': 'One-Hand Sword',
    'gear.sword2h': 'Two-Hand Sword',
    'gear.staff': 'Staff',
    'gear.bow': 'Bow',

    'item.hp': 'HP Potion',
    'item.mp': 'MP Potion',
    'item.spd': 'Speed Potion',
    'item.atk': 'Power Potion',
    'item.aspd': 'Haste Potion',
    'item.regen': 'Regen Potion',
    'itemd.hp': 'Restores 50% of max HP.',
    'itemd.mp': 'Restores 50% of max MP.',
    'itemd.spd': '+30% move speed for 30s.',
    'itemd.atk': '+30% damage for 30s.',
    'itemd.aspd': '+25% attack speed for 30s.',
    'itemd.regen': '3× HP/MP regen for 30s.',

    'rstat.str': 'STR', 'rstat.agi': 'AGI', 'rstat.int': 'INT', 'rstat.vit': 'VIT', 'rstat.luk': 'LUK',
    'rstat.hp': 'Max HP', 'rstat.mp': 'Max MP', 'rstat.atk': 'ATK', 'rstat.matk': 'M.ATK',
    'rstat.crit': 'Crit%', 'rstat.spd': 'Speed',

    'keys.title': 'Hotkey Settings',
    'keys.action': 'Action',
    'keys.key': 'Key',
    'keys.press': 'Press a key…',
    'keys.reset': 'Reset to defaults',
    'act.up': 'Move up', 'act.down': 'Move down', 'act.left': 'Move left', 'act.right': 'Move right',
    'act.attack': 'Attack', 'act.skill1': 'Skill 1', 'act.skill2': 'Skill 2', 'act.skill3': 'Skill 3',
    'act.quick1': 'Potion 1', 'act.quick2': 'Potion 2', 'act.quick3': 'Potion 3',
    'act.panel': 'Stat panel', 'act.afk': 'AFK auto-farm',

    'online.on': 'Connected',
    'online.host': 'host',
    'online.players': 'ONLINE · {n} players',
    'online.nameTaken': '✗ Name already taken — pick another',
    'online.wrongPassword': '🔒 Wrong password for that room.',
    'online.roomFull': 'That room is full (max 20). Try another.',
    'online.worldCh': 'World · Ch {n}',
    'online.joined': '🟢 {name} joined the realm!',
    'online.left': '🔴 {name} left the realm',

    'account.btn': 'Account',
    'account.title': '👤 Account',
    'account.blurb': 'Sign in to save your character on the server — it follows your login, not this browser. Offline play still saves locally.',
    'account.username': 'Username',
    'account.password': 'Password',
    'account.register': 'Create account',
    'account.login': 'Log in',
    'account.logout': 'Log out',
    'account.loggedInAs': '✓ Signed in as {name}',
    'account.offlineOnly': 'Accounts need the game server — available in online (http/https) play.',
    'account.needFields': 'Enter a username and password.',
    'account.working': 'Please wait…',
    'account.registered': '🎉 Account created — welcome, {name}! Your progress now saves to the cloud.',
    'account.welcome': '✓ Welcome back, {name}! Cloud save loaded.',
    'account.err_taken': 'This username is already taken — try logging in instead.',
    'account.err_bad_username': 'Username must be 3–16 letters, numbers, or _.',
    'account.err_bad_password': 'Password must be at least 6 characters.',
    'account.err_bad_credentials': 'Username or password is incorrect, or the account doesn\'t exist.',
    'account.err_offline': 'Can\'t reach the server right now.',
    'account.err_error': 'Something went wrong — try again.',
    'account.userChecking': 'Checking username…',
    'account.userFree': '✓ Username available',
    'account.userTaken': '✗ Username already taken — pick another',
    'account.userInvalid': '3–16 letters, numbers, or _',

    'news.title': '📢 Announcements',
    'news.btn': 'Announcements',
    'news.loading': 'Loading announcements…',
    'news.empty': 'No announcements yet.',
    'news.error': 'Could not load announcements — check your connection.',

    'chat.placeholder': 'Press Enter to chat…',
    'chat.you': 'You',

    'sound.title': '🔊 Sound',
    'sound.volume': 'Volume',
    'sound.mute': 'Mute',
    'sound.unmute': 'Unmute',

    'board.title': '🏆 Leaderboards',
    'board.level': 'Level',
    'board.kills': 'Mob Kills',
    'board.bosses': 'Boss Kills',
    'board.gold': 'Gold',
    'board.empty': 'No heroes yet — be the first!',
    'board.error': 'Leaderboard unavailable — connect to a game server.',
    'board.you': '★',

    'trade.title': '🤝 Trade',
    'trade.tradeAs': 'Trade as',
    'trade.with': 'Trading with {name}',
    'trade.request': '{name} wants to trade!',
    'trade.accept': 'Accept',
    'trade.decline': 'Decline',
    'trade.myOffer': 'Your offer',
    'trade.theirOffer': 'Their offer',
    'trade.gold': 'Gold',
    'trade.yourBag': 'Your bag — click an item to add',
    'trade.offerEmpty': '(no items)',
    'trade.lock': '✔ Confirm trade',
    'trade.locked': '✔ Confirmed — waiting for partner…',
    'trade.ready': 'Partner accepted!',
    'trade.done': '🤝 Trade complete!',
    'trade.cancelled': 'Trade cancelled',
    'trade.declined': 'Trade declined',
    'trade.waiting': 'Waiting for {name} to accept…',
    'trade.none': 'No other players nearby to trade with.',
    'trade.online': 'Connect online (🌐) to trade with other players.',

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

    'skilld.attack': 'Basic attack.',
    'skilld.heavyslash': 'A powerful melee strike that hits enemies in front.',
    'skilld.whirlwind': 'Spin your weapon, damaging all nearby enemies.',
    'skilld.warcry': 'Roar to boost your damage for a short time.',
    'skilld.fireball': 'Hurl an explosive fireball that damages an area.',
    'skilld.frostnova': 'Blast of frost that damages and slows enemies around you.',
    'skilld.thunder': 'Strike up to 3 nearby enemies with lightning.',
    'skilld.powershot': 'Fire a piercing arrow that passes through enemies.',
    'skilld.multishot': 'Fire three arrows in a spread.',
    'skilld.swift': 'Move faster for a short time.',
    'skilld.smite': 'Launch a bolt of holy light at your foe.',
    'skilld.heal': 'Restore HP to yourself and nearby allies.',
    'skilld.sanctuary': 'Create a holy zone that heals allies over time.',
    'skill.mp': 'MP', 'skill.cd': 'CD',

    'zone.0': 'Peaceful Meadow',
    'zone.1': 'Greenfields',
    'zone.2': 'Darkwood',
    'zone.3': 'Ashlands',
    'zone.4': "Demon's Reach",

    'enemy.slime': 'Slime', 'enemy.goblin': 'Goblin', 'enemy.wolf': 'Wolf',
    'enemy.bat': 'Shadow Bat', 'enemy.skeleton': 'Skeleton Archer', 'enemy.demon': 'Demon Lord',

    'help.title': 'How to play',
    'help.html': `
      <h3>Controls</h3>
      {move} move · {attack} attack · {skills} skills ·
      {panel} stats · {afk} AFK farm<br>
      Your hero <b>aims at the mouse cursor</b> — point at a monster and attack.
      <h3>❤ Healing Circle</h3>
      The glowing circle in the village restores <b>10% of your max HP every
      second</b>. Retreat there when you're hurt!
      <h3>📈 Stat points</h3>
      Each level grants <b>+5 stat points</b>. Open the stat window
      ({panel} or the <b>＋Stats</b> button) and build your hero your way —
      STR, AGI, INT, VIT, or LUK.
      <h3>🤖 AFK auto-farming</h3>
      Toggle <b>AUTO</b> and your hero hunts monsters, casts skills, grabs loot,
      and retreats to heal when hurt (fighting back from inside the circle).
      You can grab the controls at any time — the bot resumes the moment you
      release the keys. Stat points are saved for YOU to spend —
      use <b>★ Recommended build</b> in the stat window to allocate them all at
      once, or <b>↺ Reset stats</b> to refund everything and rebuild.
      <h3>🌍 Online &amp; saving</h3>
      Log in to join the shared world with everyone and save your hero on the
      server. Guests can play too, but progress is lost when the browser closes.
      Chat with <span class="key">↵</span>, trade gold &amp; items with 🤝,
      compete on the 🏆 leaderboards.
      <h3>⌨ Hotkeys</h3>
      Click the ⌨ button to rebind every key.
      <h3>Goal</h3>
      Hunt monsters for XP and gold. Monsters grow stronger far from the
      village — the <b>Demon Lord</b> rules the farthest corner. Hearts and
      orbs restore HP/MP. Progress auto-saves.`,
  },

  th: {
    'lang.name': 'TH',
    'lang.switchTo': 'English',

    'title.subtitle': 'เกม MMO พิกเซลผจญภัย',
    'title.chooseClass': 'เลือกอาชีพของคุณ',
    'title.loginBtn': '🔐 เข้าสู่ระบบ / สมัครสมาชิก',
    'title.guestBtn': '▶ เล่นแบบผู้เยี่ยมชม',
    'title.back': '← ย้อนกลับ',
    'title.pdpa': '🔒 เราใช้ข้อมูลบัญชีของคุณเพื่อบันทึกความคืบหน้าและพัฒนาเกมเท่านั้น เราจะไม่ขายข้อมูลของคุณให้บุคคลที่สาม',
    'title.devNote': '⚠️ อยู่ระหว่างพัฒนา — เกมยังสร้างไม่เสร็จ ความคืบหน้าของคุณอาจถูกรีเซ็ตได้ทุกเมื่อ',
    'title.heroName': 'ชื่อฮีโร่',
    'title.heroNamePh': 'ตั้งชื่อฮีโร่ของคุณ…',
    'title.nameChecking': 'กำลังตรวจสอบชื่อ…',
    'title.nameFree': '✓ ใช้ชื่อนี้ได้',
    'title.nameTaken': '✗ ชื่อนี้ถูกใช้แล้ว — เลือกชื่ออื่น',
    'title.start': 'เริ่มการผจญภัย',
    'title.continue': 'เล่นต่อ',
    'title.coopHint': 'โหมดผู้เยี่ยมชม — ความคืบหน้าจะไม่ถูกบันทึก เข้าสู่ระบบเพื่อเก็บฮีโร่และเล่นออนไลน์กับทุกคน',

    'ui.lv': 'เลเวล',
    'ui.points': 'แต้ม',
    'ui.pointsHint': 'มีแต้มสเตตัส!',
    'ui.stats': 'สเตตัส',
    'ui.healZone': '❤ วงเวทฟื้นฟู',
    'ui.cancel': 'ยกเลิก',
    'ui.close': 'ปิด',
    'ui.statsOf': 'สเตตัส — {name}',
    'ui.recommend': '★ อัพตามสายแนะนำ',
    'ui.resetStat': '↺ รีเซ็ตสเตตัส',
    'ui.online': 'ออฟไลน์',
    'ui.guest': 'ผู้เยี่ยมชม',
    'ui.dead': '{name} ล้มลง! เกิดใหม่ใน {s} วินาที...',
    'ui.levelUp': '{name} เลเวลอัพเป็น {lv}! ได้รับ 5 แต้มสเตตัส',
    'ui.saved': 'บันทึกเกมแล้ว',
    'ui.gotGold': '+{n} ทอง',
    'ui.bossWarn': '⚠ จอมมารรอคอยอยู่สุดขอบแดนร้าง...',
    'ui.bossDown': '🏆 จอมมารถูกกำจัดแล้ว!',
    'ui.worldBossWarn': '🐉 บอสโลกกำลังตื่น — มังกรจะปรากฏในอีก 5 นาที!',
    'ui.worldBossHere': '🐉 มังกรปรากฏตัวที่แดนร้างทางใต้แล้ว! รวมพล!',
    'ui.worldBossDown': '🏆 มังกรบอสโลกถูกปราบแล้ว! เกียรติยศแด่ทุกคน!',
    'ui.afk': 'ออโต้',
    'ui.afkOn': '🤖 เปิดฟาร์มอัตโนมัติ — {name}',
    'ui.afkOff': 'ปิดฟาร์มอัตโนมัติ — {name}',

    'afk.title': '🤖 ฟาร์มอัตโนมัติ',
    'afk.hint': 'เลือกว่าจะให้ฮีโร่ล่าอะไรระหว่างฟาร์มอัตโนมัติ',
    'afk.boss': 'บอส',
    'afk.bossHint': 'เข้าไปสู้กับบอส (ปิด = วิ่งหนีบอส)',
    'afk.monster': 'มอนสเตอร์',
    'afk.monsterHint': 'ล่ามอนสเตอร์ (ปิด = เดินผ่านไป)',

    'buff.warcry': 'คำรามศึก — โจมตี +35%',
    'buff.swift': 'ก้าวสายลม — ความเร็ว +45%',
    'buff.pot_spd': 'ยาเพิ่มความเร็ว — ความเร็ว +30%',
    'buff.pot_atk': 'ยาเพิ่มพลัง — โจมตี +30%',
    'buff.pot_aspd': 'ยาเร่งจังหวะ — ความเร็วโจมตี +25%',
    'buff.pot_regen': 'ยาฟื้นฟู — ฟื้นฟู HP/MP 3 เท่า',

    'inv.title': '🎒 กระเป๋าไอเทม',
    'inv.filterAll': 'ทั้งหมด',
    'inv.filterPotion': 'ยา',
    'cmp.equipped': 'ที่ใส่อยู่',
    'cmp.vs': 'เทียบกับที่ใส่',
    'inv.bag': 'กระเป๋า',
    'inv.equipped': 'สวมใส่อยู่',
    'inv.empty': 'กระเป๋าว่างเปล่า — ล่ามอนสเตอร์เพื่อหาอุปกรณ์!',
    'inv.equip': 'สวมใส่',
    'inv.unequip': 'ถอด',
    'inv.destroy': 'ทำลาย',
    'inv.use': 'ใช้',
    'inv.got': '🎁 ได้รับ {name}!',
    'inv.rareDrop': '✨ {name} ตกลงมา!',
    'inv.emptySlot': '(ว่าง)',
    'inv.twoHanded': 'สองมือ',
    'inv.destroyConfirm': 'ทำลาย {name}? ไม่สามารถย้อนกลับได้',
    'inv.storage': 'คลังเก็บ',
    'inv.emptyStore': 'คลังว่างเปล่า — ฝากไอเทมไว้ที่นี่เพื่อเก็บรักษา',
    'inv.deposit': 'ฝาก',
    'inv.withdraw': 'ถอน',
    'inv.reforge': 'ตีบวกใหม่',
    'inv.reforgePick': 'เลือกสเตตัสที่จะสุ่มใหม่',
    'inv.reforgeCost': '⚒ ตีใหม่ ({n}🪙)',
    'inv.cancel': 'ยกเลิก',
    'inv.toSlot': '⌨ {k}',

    'shop.title': '🛒 พ่อค้า',
    'shop.buy': 'ซื้อ',
    'shop.sell': 'ขาย',
    'shop.buyBtn': 'ซื้อ',
    'shop.sellBtn': 'ขาย',
    'shop.poor': 'ทองไม่พอ!',
    'shop.nothing': 'ไม่มีไอเทมในกระเป๋าให้ขาย',

    'quick.out': '{name} หมดแล้ว!',

    'tier.common': 'ธรรมดา',
    'tier.rare': 'หายาก',
    'tier.unique': 'พิเศษ',
    'tier.legend': 'ตำนาน',
    'tier.mystic': 'ลึกลับ',

    'slot.head': 'ศีรษะ',
    'slot.chest': 'เกราะอก',
    'slot.hands': 'อาวุธ',
    'slot.legs': 'ขา',
    'slot.boots': 'รองเท้า',

    'gear.head': 'หมวก',
    'gear.chest': 'เกราะ',
    'gear.legs': 'สนับขา',
    'gear.boots': 'รองเท้า',
    'gear.sword1h': 'ดาบมือเดียว',
    'gear.sword2h': 'ดาบสองมือ',
    'gear.staff': 'ไม้เท้า',
    'gear.bow': 'ธนู',

    'item.hp': 'ยา HP',
    'item.mp': 'ยา MP',
    'item.spd': 'ยาเพิ่มความเร็ว',
    'item.atk': 'ยาเพิ่มพลัง',
    'item.aspd': 'ยาเร่งจังหวะ',
    'item.regen': 'ยาฟื้นฟู',
    'itemd.hp': 'ฟื้นฟู HP 50% ของค่าสูงสุด',
    'itemd.mp': 'ฟื้นฟู MP 50% ของค่าสูงสุด',
    'itemd.spd': 'ความเร็วเคลื่อนที่ +30% นาน 30 วินาที',
    'itemd.atk': 'ความเสียหาย +30% นาน 30 วินาที',
    'itemd.aspd': 'ความเร็วโจมตี +25% นาน 30 วินาที',
    'itemd.regen': 'ฟื้นฟู HP/MP 3 เท่า นาน 30 วินาที',

    'rstat.str': 'STR', 'rstat.agi': 'AGI', 'rstat.int': 'INT', 'rstat.vit': 'VIT', 'rstat.luk': 'LUK',
    'rstat.hp': 'HP สูงสุด', 'rstat.mp': 'MP สูงสุด', 'rstat.atk': 'ATK', 'rstat.matk': 'M.ATK',
    'rstat.crit': 'คริ%', 'rstat.spd': 'ความเร็ว',

    'keys.title': 'ตั้งค่าปุ่มลัด',
    'keys.action': 'การกระทำ',
    'keys.key': 'ปุ่ม',
    'keys.press': 'กดปุ่มที่ต้องการ…',
    'keys.reset': 'คืนค่าเริ่มต้น',
    'act.up': 'เดินขึ้น', 'act.down': 'เดินลง', 'act.left': 'เดินซ้าย', 'act.right': 'เดินขวา',
    'act.attack': 'โจมตี', 'act.skill1': 'สกิล 1', 'act.skill2': 'สกิล 2', 'act.skill3': 'สกิล 3',
    'act.quick1': 'ยา 1', 'act.quick2': 'ยา 2', 'act.quick3': 'ยา 3',
    'act.panel': 'หน้าต่างสเตตัส', 'act.afk': 'ฟาร์มอัตโนมัติ (AFK)',

    'online.on': 'เชื่อมต่อแล้ว',
    'online.host': 'โฮสต์',
    'online.players': 'ออนไลน์ · {n} คน',
    'online.nameTaken': '✗ ชื่อนี้ถูกใช้แล้ว — กรุณาเลือกชื่ออื่น',
    'online.wrongPassword': '🔒 รหัสผ่านห้องไม่ถูกต้อง',
    'online.roomFull': 'ห้องเต็มแล้ว (สูงสุด 20 คน) ลองห้องอื่น',
    'online.worldCh': 'โลก · ช่อง {n}',
    'online.joined': '🟢 {name} เข้าร่วมโลกแล้ว!',
    'online.left': '🔴 {name} ออกจากโลกไปแล้ว',

    'account.btn': 'บัญชี',
    'account.title': '👤 บัญชีผู้เล่น',
    'account.blurb': 'เข้าสู่ระบบเพื่อบันทึกตัวละครไว้บนเซิร์ฟเวอร์ — ติดตามบัญชีของคุณ ไม่ใช่เบราว์เซอร์นี้ การเล่นออฟไลน์ยังบันทึกในเครื่องเหมือนเดิม',
    'account.username': 'ชื่อผู้ใช้',
    'account.password': 'รหัสผ่าน',
    'account.register': 'สร้างบัญชี',
    'account.login': 'เข้าสู่ระบบ',
    'account.logout': 'ออกจากระบบ',
    'account.loggedInAs': '✓ เข้าสู่ระบบเป็น {name}',
    'account.offlineOnly': 'บัญชีต้องใช้เซิร์ฟเวอร์เกม — ใช้ได้เมื่อเล่นออนไลน์ (http/https)',
    'account.needFields': 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน',
    'account.working': 'กรุณารอสักครู่…',
    'account.registered': '🎉 สร้างบัญชีสำเร็จ — ยินดีต้อนรับ {name}! ความคืบหน้าของคุณจะบันทึกบนคลาวด์',
    'account.welcome': '✓ ยินดีต้อนรับกลับมา {name}! โหลดข้อมูลคลาวด์แล้ว',
    'account.err_taken': 'ชื่อผู้ใช้นี้ถูกใช้แล้ว — ลองเข้าสู่ระบบแทน',
    'account.err_bad_username': 'ชื่อผู้ใช้ต้องมี 3–16 ตัว เป็นตัวอักษร ตัวเลข หรือ _',
    'account.err_bad_password': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    'account.err_bad_credentials': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือไม่มีบัญชีนี้ในระบบ',
    'account.err_offline': 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้',
    'account.err_error': 'เกิดข้อผิดพลาด — กรุณาลองใหม่',
    'account.userChecking': 'กำลังตรวจสอบชื่อผู้ใช้…',
    'account.userFree': '✓ ใช้ชื่อผู้ใช้นี้ได้',
    'account.userTaken': '✗ ชื่อผู้ใช้นี้ถูกใช้แล้ว — เลือกชื่ออื่น',
    'account.userInvalid': 'ตัวอักษร ตัวเลข หรือ _ ยาว 3–16 ตัว',

    'news.title': '📢 ประกาศ',
    'news.btn': 'ประกาศ',
    'news.loading': 'กำลังโหลดประกาศ…',
    'news.empty': 'ยังไม่มีประกาศ',
    'news.error': 'โหลดประกาศไม่สำเร็จ — กรุณาตรวจสอบการเชื่อมต่อ',

    'chat.placeholder': 'กด Enter เพื่อแชท…',
    'chat.you': 'คุณ',

    'sound.title': '🔊 เสียง',
    'sound.volume': 'ระดับเสียง',
    'sound.mute': 'ปิดเสียง',
    'sound.unmute': 'เปิดเสียง',

    'board.title': '🏆 กระดานผู้กล้า',
    'board.level': 'เลเวล',
    'board.kills': 'สังหารมอนสเตอร์',
    'board.bosses': 'สังหารบอส',
    'board.gold': 'ทอง',
    'board.empty': 'ยังไม่มีผู้กล้า — มาเป็นคนแรกสิ!',
    'board.error': 'โหลดกระดานไม่ได้ — กรุณาเชื่อมต่อเซิร์ฟเวอร์เกม',
    'board.you': '★',

    'trade.title': '🤝 แลกเปลี่ยน',
    'trade.tradeAs': 'แลกเปลี่ยนในนาม',
    'trade.with': 'กำลังแลกเปลี่ยนกับ {name}',
    'trade.request': '{name} ต้องการแลกเปลี่ยน!',
    'trade.accept': 'ตกลง',
    'trade.decline': 'ปฏิเสธ',
    'trade.myOffer': 'ข้อเสนอของคุณ',
    'trade.theirOffer': 'ข้อเสนอของอีกฝ่าย',
    'trade.gold': 'ทอง',
    'trade.yourBag': 'กระเป๋าของคุณ — คลิกไอเทมเพื่อเพิ่ม',
    'trade.offerEmpty': '(ไม่มีไอเทม)',
    'trade.lock': '✔ ยืนยันแลกเปลี่ยน',
    'trade.locked': '✔ ยืนยันแล้ว — รออีกฝ่าย…',
    'trade.ready': 'อีกฝ่ายยืนยันแล้ว!',
    'trade.done': '🤝 แลกเปลี่ยนสำเร็จ!',
    'trade.cancelled': 'ยกเลิกการแลกเปลี่ยน',
    'trade.declined': 'การแลกเปลี่ยนถูกปฏิเสธ',
    'trade.waiting': 'รอ {name} ตอบรับ…',
    'trade.none': 'ไม่มีผู้เล่นอื่นให้แลกเปลี่ยนด้วย',
    'trade.online': 'เชื่อมต่อออนไลน์ (🌐) เพื่อแลกเปลี่ยนกับผู้เล่นอื่น',

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

    'skilld.attack': 'โจมตีพื้นฐาน',
    'skilld.heavyslash': 'ฟันแรงใส่ศัตรูด้านหน้า สร้างความเสียหายสูง',
    'skilld.whirlwind': 'หมุนอาวุธโจมตีศัตรูรอบตัวทั้งหมด',
    'skilld.warcry': 'คำรามเพิ่มพลังโจมตีชั่วขณะ',
    'skilld.fireball': 'ปล่อยลูกไฟระเบิดสร้างความเสียหายเป็นวงกว้าง',
    'skilld.frostnova': 'ระเบิดน้ำแข็งสร้างความเสียหายและชะลอศัตรูรอบตัว',
    'skilld.thunder': 'ฟาดสายฟ้าใส่ศัตรูรอบตัวสูงสุด 3 ตัว',
    'skilld.powershot': 'ยิงลูกธนูทะลุทะลวงศัตรู',
    'skilld.multishot': 'ยิงธนู 3 ดอกแบบกระจาย',
    'skilld.swift': 'เคลื่อนที่เร็วขึ้นชั่วขณะ',
    'skilld.smite': 'ปล่อยแสงศักดิ์สิทธิ์โจมตีศัตรู',
    'skilld.heal': 'ฟื้นฟู HP ให้ตัวเองและพันธมิตรรอบตัว',
    'skilld.sanctuary': 'สร้างเขตศักดิ์สิทธิ์ฟื้นฟู HP อย่างต่อเนื่อง',
    'skill.mp': 'MP', 'skill.cd': 'คูลดาวน์',

    'zone.0': 'ทุ่งหญ้าอันสงบ',
    'zone.1': 'ทุ่งเขียวขจี',
    'zone.2': 'ป่ามืด',
    'zone.3': 'แดนเถ้าถ่าน',
    'zone.4': 'แดนจอมมาร',

    'enemy.slime': 'สไลม์', 'enemy.goblin': 'ก็อบลิน', 'enemy.wolf': 'หมาป่า',
    'enemy.bat': 'ค้างคาวเงา', 'enemy.skeleton': 'โครงกระดูกนักธนู', 'enemy.demon': 'จอมมาร',

    'help.title': 'วิธีเล่น',
    'help.html': `
      <h3>การควบคุม</h3>
      {move} เดิน · {attack} โจมตี · {skills} สกิล ·
      {panel} สเตตัส · {afk} ฟาร์มอัตโนมัติ<br>
      ฮีโร่จะ<b>เล็งตามเมาส์</b> — ชี้เมาส์ไปที่มอนสเตอร์แล้วโจมตี
      <h3>❤ วงเวทฟื้นฟู</h3>
      วงแสงกลางหมู่บ้านฟื้นฟู <b>HP 10% ของค่าสูงสุดทุกวินาที</b>
      บาดเจ็บเมื่อไหร่ ถอยกลับมาพักที่นี่!
      <h3>📈 แต้มสเตตัส</h3>
      เลเวลอัพรับ <b>5 แต้มสเตตัส</b> เปิดหน้าต่างสเตตัส
      ({panel} หรือปุ่ม <b>＋สเตตัส</b>) แล้วอัพตามสไตล์ของคุณ —
      STR, AGI, INT, VIT หรือ LUK
      <h3>🤖 ฟาร์มอัตโนมัติ (AFK)</h3>
      เปิดโหมด <b>ออโต้</b> แล้วฮีโร่จะล่ามอนสเตอร์ ใช้สกิล เก็บของดรอป
      และถอยกลับไปฟื้นฟูเมื่อบาดเจ็บ (พร้อมสู้กลับจากในวงเวท)
      คุณบังคับเองได้ทุกเมื่อ — ปล่อยปุ่มแล้วบอทจะทำงานต่อทันที
      แต้มสเตตัสจะเก็บไว้ให้คุณอัพเอง —
      กดปุ่ม <b>★ อัพตามสายแนะนำ</b> ในหน้าต่างสเตตัสเพื่ออัพทั้งหมดในคลิกเดียว
      หรือ <b>↺ รีเซ็ตสเตตัส</b> เพื่อคืนแต้มทั้งหมดแล้วอัพใหม่
      <h3>🌍 ออนไลน์ &amp; การบันทึก</h3>
      เข้าสู่ระบบเพื่อเล่นในโลกที่แชร์ร่วมกับทุกคนและบันทึกฮีโร่ไว้บนเซิร์ฟเวอร์
      ผู้เยี่ยมชมเล่นได้เช่นกัน แต่ความคืบหน้าจะหายเมื่อปิดเบราว์เซอร์
      แชทด้วย <span class="key">↵</span> แลกเปลี่ยนทองและไอเทมด้วย 🤝 แข่งอันดับที่ 🏆
      <h3>⌨ ปุ่มลัด</h3>
      กดปุ่ม ⌨ เพื่อเปลี่ยนปุ่มได้ทุกปุ่ม
      <h3>เป้าหมาย</h3>
      ล่ามอนสเตอร์เพื่อรับ XP และทอง
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

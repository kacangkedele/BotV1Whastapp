import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode-terminal";
import fs from "fs";

const DATA_FILE = "data.json";
const PAIRING_NUMBER = "628985035456";
const ADMIN_NUMBERS = [
  "62985035456",
  // tambahkan admin lain jika perlu
  // "6289876543210",
];

function defaultData() {
  return {
    active: {},
    perak_mode: {},
    bets: {},
    aliases: {},
    geseran: {},
  };
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      const base = defaultData();

      for (const key of Object.keys(base)) {
        if (!(key in parsed)) {
          parsed[key] = base[key];
        }
      }

      return parsed;
    } catch (err) {
      console.log("⚠️ Gagal baca data.json, buat data baru.");
      return defaultData();
    }
  }
  return defaultData();
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

let DATA = loadData();

function normalizePhone(value) {
  if (!value) return "";
  return String(value)
    .replace(/\s+/g, "")
    .replace(/[^\d]/g, "");
}

function chatKey(chatId) {
  return String(chatId || "");
}

function isAdmin(phone) {
  return ADMIN_NUMBERS.includes(normalizePhone(phone));
}

function getBets(chatId) {
  const key = chatKey(chatId);
  if (!DATA.bets[key]) DATA.bets[key] = {};
  return DATA.bets[key];
}

function getGeseran(chatId) {
  const key = chatKey(chatId);
  if (!DATA.geseran[key]) DATA.geseran[key] = {};
  return DATA.geseran[key];
}

function isActive(chatId) {
  return !!DATA.active[chatKey(chatId)];
}

function isPerak(chatId) {
  return DATA.perak_mode[chatKey(chatId)] !== false;
}

function parseBet(text) {
  const t = String(text || "").trim().toUpperCase().replace(",", ".");

  let m = t.match(/^([KB])\s*(\d+(?:\.\d+)?)$/);
  if (m) return [m[1], Number(m[2])];

  m = t.match(/^(\d+(?:\.\d+)?)\s*([KB])$/);
  if (m) return [m[2], Number(m[1])];

  return [null, null];
}

function calcAmount(raw, perakMode) {
  if (perakMode) return Math.round(Number(raw) * 1000);
  if (Number.isInteger(Number(raw))) return Number(raw);
  return Number(raw);
}

function formatAmount(amount) {
  return Number.isInteger(Number(amount)) ? String(Number(amount)) : String(amount);
}

function cleanMessageText(msg) {
  const text =
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    "";

  return String(text).trim();
}

function senderIdFromMessage(msg) {
  return (
    msg?.key?.participant ||
    msg?.key?.remoteJid ||
    msg?.participant ||
    msg?.remoteJid ||
    ""
  );
}

function chatIdFromMessage(msg) {
  return msg?.key?.remoteJid || msg?.remoteJid || "";
}

function getQuotedSender(msg) {
  const context =
    msg?.message?.extendedTextMessage?.contextInfo ||
    msg?.extendedTextMessage?.contextInfo ||
    {};

  return context.participant || context.remoteJid || "";
}

function makeHelpText() {
  return `
📚 DAFTAR COMMAND

📡 Status
.on — aktifkan bot
.off — matikan bot

📋 List
.list — lihat list ronde ini
.rs — reset list

📊 Rekap
.rk — rekap total K/B

💰 Mode
.perak — B1 = 1000
.nonperak — B1 = 1

🏷 Alias
.sv NAMA — simpan alias user (reply)
.svlist — tampilkan alias
.svdel — hapus alias (reply)

✏️ Edit
.h NAMA — hapus slot
.c — bersihkan titik pada bet

🎯 Geseran
.geseran KEY N MAX — buat preset
KEY b / KEY k — pakai preset

📝 Format Bet
K5 / 5K
B10 / 10B
B1.5 / B1,5

━━━━━━━━━━━━━
`;
}

async function sendText(sock, jid, text) {
  await sock.sendMessage(jid, { text });
}

async function handleCommand(sock, msg, text) {
  const sender = senderIdFromMessage(msg);
  const chatId = chatIdFromMessage(msg);
  const phone = normalizePhone(sender);

  if (text === ".on") {
    if (!isAdmin(phone)) return;
    DATA.active[chatKey(chatId)] = true;
    if (!(chatKey(chatId) in DATA.perak_mode)) {
      DATA.perak_mode[chatKey(chatId)] = true;
    }
    saveData(DATA);

    await sendText(sock, chatId, "✅ Bot aktif.\nKetik `.cmd` untuk melihat perintah.");
    return;
  }

  if (text === ".off") {
    if (!isAdmin(phone)) return;
    DATA.active[chatKey(chatId)] = false;
    saveData(DATA);

    await sendText(sock, chatId, "❌ Bot dimatikan.");
    return;
  }

  if (text === ".cmd") {
    await sendText(sock, chatId, makeHelpText());
    return;
  }

  if (text === ".list") {
    const bets = getBets(chatId);
    if (!Object.keys(bets).length) {
      await sendText(sock, chatId, "📋 List masih kosong.");
      return;
    }

    let kLines = [];
    let bLines = [];

    for (const uid of Object.keys(bets)) {
      const info = bets[uid];
      let line = `• ${info.name} ${formatAmount(info.amount)}`;
      if (info.username) line += ` ${info.username}`;

      if (info.type === "K") kLines.push(line);
      else bLines.push(line);
    }

    const kTotal = Object.values(bets)
      .filter((x) => x.type === "K")
      .reduce((sum, x) => sum + Number(x.amount), 0);

    const bTotal = Object.values(bets)
      .filter((x) => x.type === "B")
      .reduce((sum, x) => sum + Number(x.amount), 0);

    let msg = "📋 LIST RONDE INI\n\n";
    if (kLines.length) msg += "🔻 K (Kecil)\n" + kLines.join("\n") + "\n\n";
    if (bLines.length) msg += "🔺 B (Besar)\n" + bLines.join("\n") + "\n\n";

    msg += "━━━━━━━━━━━━━\n";
    msg += `📊 Total K: ${formatAmount(kTotal)}\n`;
    msg += `📊 Total B: ${formatAmount(bTotal)}\n`;
    msg += `👥 Total pemain: ${Object.keys(bets).length}`;

    await sendText(sock, chatId, msg);
    return;
  }

  if (text === ".rs") {
    if (!isAdmin(phone)) return;
    DATA.bets[chatKey(chatId)] = {};
    saveData(DATA);
    await sendText(sock, chatId, "🗑 List dikosongkan. Ronde baru dimulai.");
    return;
  }

  if (text === ".rk") {
    const bets = getBets(chatId);
    if (!Object.keys(bets).length) {
      await sendText(sock, chatId, "❌ List kosong, tidak ada yang bisa direkap.");
      return;
    }

    const kTotal = Object.values(bets)
      .filter((x) => x.type === "K")
      .reduce((sum, x) => sum + Number(x.amount), 0);

    const bTotal = Object.values(bets)
      .filter((x) => x.type === "B")
      .reduce((sum, x) => sum + Number(x.amount), 0);

    const selisih = Math.abs(kTotal - bTotal);
    const kCount = Object.values(bets).filter((x) => x.type === "K").length;
    const bCount = Object.values(bets).filter((x) => x.type === "B").length;

    let msg = "📊 REKAP TOTAL\n\n";
    msg += `🔻 K: ${kCount} pemain → ${formatAmount(kTotal)}\n`;
    msg += `🔺 B: ${bCount} pemain → ${formatAmount(bTotal)}\n`;
    msg += "━━━━━━━━━━━━━\n";

    if (kTotal > bTotal) {
      msg += `⚠️ B kurang ${formatAmount(selisih)}\n`;
      msg += `💰 B perlu tambah ${formatAmount(selisih)}`;
    } else if (bTotal > kTotal) {
      msg += `⚠️ K kurang ${formatAmount(selisih)}\n`;
      msg += `💰 K perlu tambah ${formatAmount(selisih)}`;
    } else {
      msg += "✅ K & B Seimbang!";
    }

    await sendText(sock, chatId, msg);
    return;
  }

  if (text === ".perak") {
    if (!isAdmin(phone)) return;
    DATA.perak_mode[chatKey(chatId)] = true;
    saveData(DATA);

    await sendText(sock, chatId, "💰 Mode PERAK aktif.\n`B1 = 1000`");
    return;
  }

  if (text === ".nonperak") {
    if (!isAdmin(phone)) return;
    DATA.perak_mode[chatKey(chatId)] = false;
    saveData(DATA);

    await sendText(sock, chatId, "💵 Mode NON-PERAK aktif.\n`B1 = 1`");
    return;
  }

  if (text.startsWith(".h ")) {
    if (!isAdmin(phone)) return;

    const target = text.replace(".h ", "").trim().toLowerCase();
    const bets = getBets(chatId);
    const found = Object.entries(bets).find(([, info]) => {
      return String(info.name).toLowerCase() === target;
    });

    if (!found) {
      await sendText(sock, chatId, `❌ Tidak ada slot dengan nama \`${target}\`.`);
      return;
    }

    const [uid] = found;
    delete bets[uid];
    saveData(DATA);

    await sendText(sock, chatId, `🗑 Slot **${target}** dihapus.`);
    return;
  }

  if (text === ".c") {
    if (!isAdmin(phone)) return;
    if (!msg.quotedMsg) {
      await sendText(sock, chatId, "❌ Balas pesan bet yang ingin dibersihkan titiknya.");
      return;
    }

    const quotedText = cleanMessageText(msg.quotedMsg);
    const cleaned = quotedText.replace(/\./g, "").replace(/,/g, "");
    await sendText(sock, chatId, `🧹 Bersih: \`${cleaned}\``);
    return;
  }

  if (text.startsWith(".sv ")) {
    if (!isAdmin(phone)) return;
    const aliasName = text.replace(".sv ", "").trim();

    if (!msg.quotedMsg) {
      await sendText(sock, chatId, "❌ Balas pesan user yang ingin disimpan aliasnya.");
      return;
    }

    const quotedSender = getQuotedSender(msg);
    const qid = normalizePhone(quotedSender);

    if (!qid) {
      await sendText(sock, chatId, "❌ Gagal membaca user dari reply.");
      return;
    }

    if (!DATA.aliases[chatKey(chatId)]) DATA.aliases[chatKey(chatId)] = {};
    DATA.aliases[chatKey(chatId)][qid] = aliasName;
    saveData(DATA);

    await sendText(sock, chatId, `✅ Alias tersimpan: ${aliasName} → ${qid}`);
    return;
  }

  if (text === ".svlist") {
    if (!isAdmin(phone)) return;
    const aliases = DATA.aliases[chatKey(chatId)] || {};
    if (!Object.keys(aliases).length) {
      await sendText(sock, chatId, "📋 Belum ada alias tersimpan.");
      return;
    }

    const lines = Object.entries(aliases).map(([uid, name]) => `• ${name} → ${uid}`);
    await sendText(sock, chatId, "📋 DAFTAR ALIAS\n\n" + lines.join("\n"));
    return;
  }

  if (text === ".svdel") {
    if (!isAdmin(phone)) return;
    if (!msg.quotedMsg) {
      await sendText(sock, chatId, "❌ Balas pesan user yang aliasnya ingin dihapus.");
      return;
    }

    const quotedSender = getQuotedSender(msg);
    const qid = normalizePhone(quotedSender);

    if (!qid) {
      await sendText(sock, chatId, "❌ Gagal membaca user dari reply.");
      return;
    }

    const aliases = DATA.aliases[chatKey(chatId)] || {};
    if (aliases[qid]) {
      delete aliases[qid];
      saveData(DATA);
      await sendText(sock, chatId, "🗑 Alias dihapus.");
    } else {
      await sendText(sock, chatId, "❌ Alias tidak ditemukan.");
    }
    return;
  }

  if (text.startsWith(".geseran ")) {
    if (!isAdmin(phone)) return;

    const m = text.match(/^\.geseran\s+(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+)$/);
    if (!m) {
      await sendText(sock, chatId, "❌ Format salah: `.geseran KEY N MAX`");
      return;
    }

    const key = m[1].toLowerCase();
    const nominal = Number(m[2]);
    const maxUser = Number(m[3]);

    getGeseran(chatId)[key] = {
      nominal,
      max: maxUser,
      users: [],
    };

    saveData(DATA);

    await sendText(
      sock,
      chatId,
      `🎯 Geseran \`${key}\` dibuat.\nNominal: ${nominal}\nMax user: ${maxUser}\n\nPakai: \`${key} b\` atau \`${key} k\``
    );
    return;
  }

  const presetMatch = text.match(/^([a-zA-Z]+)\s+([kb])(?:\s*#(\d+(?:\.\d+)?))?$/i);
  if (presetMatch) {
    const key = presetMatch[1].toLowerCase();
    const preset = getGeseran(chatId)[key];

    if (preset) {
      const betType = presetMatch[2].toUpperCase();
      const raw = presetMatch[3] ? Number(presetMatch[3]) : Number(preset.nominal);
      const amount = calcAmount(raw, isPerak(chatId));

      const bets = getBets(chatId);
      bets[normalizePhone(sender)] = {
        name: phone,
        username: "",
        type: betType,
        amount,
      };

      saveData(DATA);

      await sendText(sock, chatId, `✅ ${phone} ${betType}${raw}`);
      return;
    }
  }
}

async function processBetMessage(sock, msg) {
  const chatId = chatIdFromMessage(msg);
  const sender = senderIdFromMessage(msg);
  const phone = normalizePhone(sender);
  const text = cleanMessageText(msg);

  if (!text || !DATA.active[chatKey(chatId)]) return;

  if (text.startsWith(".")) {
    await handleCommand(sock, msg, text);
    return;
  }

  const [betType, raw] = parseBet(text);
  if (!betType || raw === null) return;

  const amount = calcAmount(raw, isPerak(chatId));
  const bets = getBets(chatId);
  bets[phone] = {
    name: phone,
    username: "",
    type: betType,
    amount,
  };

  saveData(DATA);

  await sendText(sock, chatId, `✅ ${phone} ${betType}${raw}`);
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: ["Chrome (Linux)", "", ""],
  });

  let pairingRequested = false;

  if (!pairingRequested && !sock.authState?.creds?.registered) {
    pairingRequested = true;
    try {
      const phone = normalizePhone(PAIRING_NUMBER);
      const code = await sock.requestPairingCode(phone);

      console.log("\n========================================");
      console.log("       KODE TAUTAN WHATSAPP");
      console.log("========================================");
      console.log(`          ${code}`);
      console.log("========================================");
      console.log("Masukkan kode di WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon");
      console.log("========================================\n");
    } catch (error) {
      console.error("❌ Gagal membuat pairing code:", error);
    }
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔄 Menghubungkan ulang...");
        setTimeout(connect, 2000);
      } else {
        console.log("❌ Koneksi ditutup.");
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp tersambung.");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      await processBetMessage(sock, msg);
    }
  });
}

connect();

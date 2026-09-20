import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import fs from "fs";

const DATA_FILE = "data.json";
const PAIRING_NUMBER = "628985035456";
const ADMIN_NUMBERS = ["628985035456"];

const emptyData = () => ({ active: {}, perak_mode: {}, bets: {}, aliases: {}, geseran: {} });
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return emptyData();
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { ...emptyData(), ...parsed };
  } catch {
    return emptyData();
  }
}
let data = loadData();
const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
const key = (id) => String(id || "");
const phone = (id) => String(id || "").replace(/\D/g, "");
const admin = (id) => ADMIN_NUMBERS.includes(phone(id));
const bets = (jid) => (data.bets[key(jid)] ||= {});
const presets = (jid) => (data.geseran[key(jid)] ||= {});
const active = (jid) => Boolean(data.active[key(jid)]);
const perak = (jid) => data.perak_mode[key(jid)] !== false;

function parseBet(text) {
  const t = String(text).trim().toUpperCase().replace(",", ".");
  let m = t.match(/^([KB])\s*(\d+(?:\.\d+)?)$/);
  if (m) return [m[1], Number(m[2])];
  m = t.match(/^(\d+(?:\.\d+)?)\s*([KB])$/);
  if (m) return [m[2], Number(m[1])];
  return [null, null];
}
const amount = (n, isPerak) => (isPerak ? Math.round(n * 1000) : n);
const textOf = (m) => String(
  m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption ||
  m?.videoMessage?.caption || m?.documentMessage?.caption || ""
).trim();
const jidOf = (m) => m?.key?.remoteJid || "";
const senderOf = (m) => m?.key?.participant || m?.key?.remoteJid || "";
const replySender = (m) => m?.message?.extendedTextMessage?.contextInfo?.participant || "";
const send = (sock, jid, text) => sock.sendMessage(jid, { text });

function help() {
  return `📚 DAFTAR COMMAND

.on — aktifkan bot
.off — matikan bot
.list — lihat list
.rs — reset list
.rk — rekap K/B
.perak — B1 = 1000
.nonperak — B1 = 1
.h NAMA — hapus slot
.sv NAMA — simpan alias (reply)
.svlist — lihat alias
.svdel — hapus alias (reply)
.geseran KEY N MAX — buat preset
KEY b / KEY k — gunakan preset

Format bet: K5, B10, 5K, 10B, B1.5, B1,5`;
}

async function command(sock, msg, command) {
  const jid = jidOf(msg);
  const from = senderOf(msg);
  const me = phone(from);

  if (command === ".cmd") return send(sock, jid, help());
  if (command === ".on") {
    if (!admin(from)) return;
    data.active[key(jid)] = true;
    if (!(key(jid) in data.perak_mode)) data.perak_mode[key(jid)] = true;
    save();
    return send(sock, jid, "✅ Bot aktif. Ketik `.cmd` untuk bantuan.");
  }
  if (command === ".off") {
    if (!admin(from)) return;
    data.active[key(jid)] = false;
    save();
    return send(sock, jid, "❌ Bot dimatikan.");
  }
  if (command === ".rs") {
    if (!admin(from)) return;
    data.bets[key(jid)] = {};
    save();
    return send(sock, jid, "🗑 List dikosongkan. Ronde baru dimulai.");
  }
  if (command === ".perak" || command === ".nonperak") {
    if (!admin(from)) return;
    data.perak_mode[key(jid)] = command === ".perak";
    save();
    return send(sock, jid, command === ".perak" ? "💰 Mode PERAK aktif. B1 = 1000" : "💵 Mode NON-PERAK aktif. B1 = 1");
  }
  if (command === ".list") {
    const list = bets(jid);
    if (!Object.keys(list).length) return send(sock, jid, "📋 List masih kosong.");
    const k = Object.values(list).filter(x => x.type === "K");
    const b = Object.values(list).filter(x => x.type === "B");
    const lines = (title, values) => values.length ? `${title}\n${values.map(x => `• ${x.name} ${x.amount}`).join("\n")}\n\n` : "";
    const kt = k.reduce((s, x) => s + Number(x.amount), 0);
    const bt = b.reduce((s, x) => s + Number(x.amount), 0);
    return send(sock, jid, `📋 LIST RONDE INI\n\n${lines("🔻 K (Kecil)", k)}${lines("🔺 B (Besar)", b)}━━━━━━━━━━━━━\n📊 Total K: ${kt}\n📊 Total B: ${bt}\n👥 Total pemain: ${Object.keys(list).length}`);
  }
  if (command === ".rk") {
    const list = bets(jid);
    if (!Object.keys(list).length) return send(sock, jid, "❌ List kosong.");
    const kt = Object.values(list).filter(x => x.type === "K").reduce((s, x) => s + Number(x.amount), 0);
    const bt = Object.values(list).filter(x => x.type === "B").reduce((s, x) => s + Number(x.amount), 0);
    const d = Math.abs(kt - bt);
    return send(sock, jid, `📊 REKAP TOTAL\n\n🔻 K: ${Object.values(list).filter(x => x.type === "K").length} pemain → ${kt}\n🔺 B: ${Object.values(list).filter(x => x.type === "B").length} pemain → ${bt}\n━━━━━━━━━━━━━\n${kt === bt ? "✅ K & B Seimbang!" : `⚠️ ${kt > bt ? "B" : "K"} kurang ${d}\n💰 ${kt > bt ? "B" : "K"} perlu tambah ${d}`}`);
  }
  if (command.startsWith(".h ")) {
    if (!admin(from)) return;
    const target = command.slice(3).trim().toLowerCase();
    const list = bets(jid);
    const found = Object.entries(list).find(([, x]) => String(x.name).toLowerCase() === target);
    if (!found) return send(sock, jid, `❌ Slot ${target} tidak ditemukan.`);
    delete list[found[0]]; save();
    return send(sock, jid, `🗑 Slot ${target} dihapus.`);
  }
  if (command.startsWith(".geseran ")) {
    if (!admin(from)) return;
    const m = command.match(/^\.geseran\s+(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+)$/);
    if (!m) return send(sock, jid, "❌ Format: `.geseran KEY NOMINAL MAX`");
    presets(jid)[m[1].toLowerCase()] = { nominal: Number(m[2]), max: Number(m[3]), users: [] };
    save();
    return send(sock, jid, `🎯 Preset ${m[1]} dibuat. Gunakan: ${m[1]} b atau ${m[1]} k`);
  }
  if (command.startsWith(".sv ")) {
    if (!admin(from)) return;
    const target = replySender(msg);
    if (!target) return send(sock, jid, "❌ Balas pesan user terlebih dahulu.");
    (data.aliases[key(jid)] ||= {})[phone(target)] = command.slice(4).trim();
    save();
    return send(sock, jid, "✅ Alias tersimpan.");
  }
  if (command === ".svlist") {
    if (!admin(from)) return;
    const list = data.aliases[key(jid)] || {};
    return send(sock, jid, Object.keys(list).length ? "📋 ALIAS\n\n" + Object.entries(list).map(([id, name]) => `• ${name} → ${id}`).join("\n") : "📋 Belum ada alias.");
  }
  if (command === ".svdel") {
    if (!admin(from)) return;
    const target = phone(replySender(msg));
    if (!target || !data.aliases[key(jid)]?.[target]) return send(sock, jid, "❌ Alias tidak ditemukan.");
    delete data.aliases[key(jid)][target]; save();
    return send(sock, jid, "🗑 Alias dihapus.");
  }
}

async function process(sock, msg) {
  if (!msg?.message || msg.key.fromMe) return;
  const jid = jidOf(msg);
  const text = textOf(msg);
  if (!jid || !text) return;
  if (text.startsWith(".")) return command(sock, msg, text);
  if (!active(jid)) return;

  const preset = text.match(/^([a-zA-Z]+)\s+([kb])(?:\s*#(\d+(?:\.\d+)?))?$/i);
  let type, raw;
  if (preset && presets(jid)[preset[1].toLowerCase()]) {
    type = preset[2].toUpperCase();
    raw = preset[3] ? Number(preset[3]) : presets(jid)[preset[1].toLowerCase()].nominal;
  } else [type, raw] = parseBet(text);
  if (!type) return;
  const id = phone(senderOf(msg));
  bets(jid)[id] = { name: data.aliases[key(jid)]?.[id] || id, type, amount: amount(raw, perak(jid)) };
  save();
  await send(sock, jid, `✅ ${data.aliases[key(jid)]?.[id] || id} ${type}${raw}`);
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, browser: ["Ubuntu", "Chrome", "1.0.0"] });
  let requested = false;

  // Penting: requestPairingCode harus dipanggil setelah socket dibuat,
  // tetapi JANGAN menunggu connection === "open" karena open berarti sudah login.
  if (!state.creds.registered) {
    setTimeout(async () => {
      if (requested) return;
      requested = true;
      try {
        const code = await sock.requestPairingCode(phone(PAIRING_NUMBER));
        console.log(`\n========================================\nKODE TAUTAN WHATSAPP: ${code}\n========================================`);
        console.log("WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon\n");
      } catch (error) {
        console.error("❌ Pairing gagal:", error?.message || error);
        console.error("Pastikan internet aktif, nomor benar, dan coba ulang setelah menghapus auth_info.");
      }
    }, 4000);
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") console.log("✅ WhatsApp tersambung.");
    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status !== DisconnectReason.loggedOut) {
        console.log("🔄 Koneksi terputus, mencoba ulang...");
        setTimeout(connect, 3000);
      } else console.log("❌ Sesi logout. Hapus auth_info untuk login ulang.");
    }
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) await process(sock, msg);
  });
}

connect().catch((error) => console.error("❌ Fatal:", error));

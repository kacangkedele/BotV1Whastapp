# WA Bet Bot

Bot WhatsApp untuk mencatat taruhan K/B.

## Install
```bash
npm install
```

## Jalankan
```bash
npm start
```

Scan QR yang muncul di terminal dari WhatsApp Anda.

## Command
- `.on` — aktifkan bot
- `.off` — matikan bot
- `.list` — lihat daftar bet
- `.rs` — reset list
- `.rk` — rekap K/B
- `.perak` — mode perak
- `.nonperak` — mode non-perak
- `.h NAMA` — hapus slot
- `.sv NAMA` — simpan alias (reply)
- `.svlist` — lihat alias
- `.svdel` — hapus alias (reply)
- `.geseran KEY N MAX` — buat preset
- `.cmd` — lihat daftar perintah

## Format bet
```text
K5
B10
5K
10B
B1.5
B1,5
```

## Catatan
- Bot ini menggunakan WhatsApp account pribadi.
- Simpan `auth_info` dengan aman.
- Data game disimpan di `data.json`.

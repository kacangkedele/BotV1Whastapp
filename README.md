Saya sudah perbaiki file login di repo Anda untuk memakai pairing code dengan alur yang lebih aman.

Sekarang yang harus Anda jalankan di Termux adalah ini:

```bash
cd ~/BotV1Whastapp
rm -rf auth_info
npm install
npm start
```

Setelah itu, tunggu beberapa detik sampai muncul kode seperti ini di terminal:

```text
========================================
       KODE TAUTAN WHATSAPP
========================================
          ABCD-EFGH
========================================
```

Lalu di HP:
- buka WhatsApp
- masuk ke menu:
  Perangkat tertaut
- pilih:
  Tautkan dengan nomor telepon
- masukkan kode yang muncul

Kalau semua lancar, nanti akan tampil:
```text
✅ WhatsApp tersambung.
```

Setelah itu, kirim di grup:
```text
.on
```

Baru bisa mulai pasang bet:
```text
K5
B10
5K
10B
B1.5
```

Kalau tetap gagal dan muncul error lagi, kirimkan hasil dari:
```bash
npm start
```
atau
```bash
cat wa.log
```
jika Anda pakai background, maka saya bisa bantu baca error yang tepat dan langsung kasih fix yang sesuai.


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

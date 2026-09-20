#!/bin/bash

cd "$(dirname "$0")"

echo "========================================"
echo " Bot WhatsApp BetBot - Start Script"
echo "========================================"

echo "[INFO] Memulai bot..."
nohup npm start > wa.log 2>&1 &

echo "[INFO] Bot berjalan di background."
echo "[INFO] Log: wa.log"
echo "[INFO] Untuk melihat log: tail -f wa.log"
echo "[INFO] Untuk menghentikan: pkill -f \"node index.js\""

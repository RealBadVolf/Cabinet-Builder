#!/bin/bash
# ══════════════════════════════════════════════
# Cabinet Studio — Production Deploy
# Run on: 192.168.1.36 (ntweb)
# ══════════════════════════════════════════════
set -e

BASE="/Dockers/cabinet-studio"
echo ""
echo "  ◧ Cabinet Studio — Production Deploy"
echo "  ─────────────────────────────────────"

# 1. Ensure .env exists
if [ ! -f "$BASE/.env" ]; then
  cp "$BASE/.env.example" "$BASE/.env"
  echo "  ⚠  Created .env — edit DB credentials + JWT_SECRET first, then re-run."
  exit 1
fi

# 2. Build React client
echo "  Building client..."
cd "$BASE/client"
npm install --silent 2>/dev/null
npm run build
echo "  ✓ Client built → $BASE/client/dist"

# 3. Install Nginx config
echo "  Installing Nginx config..."
cp "$BASE/cabinet-studio.conf" /etc/nginx/sites-available/cabinet-studio.conf
ln -sf /etc/nginx/sites-available/cabinet-studio.conf /etc/nginx/sites-enabled/cabinet-studio.conf

# Test nginx config
nginx -t 2>&1 | grep -q "successful" && echo "  ✓ Nginx config valid" || {
  echo "  ✗ Nginx config error — check with: nginx -t"
  exit 1
}

nginx -s reload
echo "  ✓ Nginx reloaded"

# 4. Install & start systemd service
echo "  Installing systemd service..."
cp "$BASE/cabinet-studio.service" /etc/systemd/system/cabinet-studio.service
systemctl daemon-reload
systemctl enable cabinet-studio
systemctl restart cabinet-studio

sleep 2
if systemctl is-active --quiet cabinet-studio; then
  echo "  ✓ API service running"
else
  echo "  ✗ API service failed — check: journalctl -u cabinet-studio -n 20"
  exit 1
fi

# 5. Health check
echo ""
echo "  Testing..."
sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ API healthy"
else
  echo "  ⚠ API returned $HTTP_CODE — check: journalctl -u cabinet-studio"
fi

echo ""
echo "  ════════════════════════════════════════"
echo "  ✓ Deployed!"
echo ""
echo "  LAN:    http://192.168.1.36"
echo "  Domain: http://cab.badvolf.ru"
echo "  Admin:  admin / changeme123"
echo "  ════════════════════════════════════════"
echo ""

#!/bin/bash
# ══════════════════════════════════════════════
# Cabinet Studio — Local Development
# Uses your LOCAL MariaDB (no Docker needed)
# ══════════════════════════════════════════════

set -e

echo ""
echo "  ◧ Cabinet Studio — Local Dev"
echo "  ────────────────────────────"
echo ""

# Check .env
if [ ! -f .env ]; then
  echo "  Creating .env from template..."
  cp .env.example .env
  echo "  ⚠  Edit .env with your MariaDB credentials, then run again."
  exit 1
fi

source .env

# Check MariaDB connectivity
echo "  Checking MariaDB connection..."
if ! mysql -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USER:-cabinet}" -p"${DB_PASS:-cabinet}" -e "SELECT 1" &>/dev/null; then
  echo ""
  echo "  ✗ Cannot connect to MariaDB at ${DB_HOST:-localhost}:${DB_PORT:-3306}"
  echo ""
  echo "  Make sure MariaDB is running and create the user:"
  echo ""
  echo "    mysql -u root -p"
  echo "    CREATE DATABASE IF NOT EXISTS cabinet_studio;"
  echo "    CREATE USER IF NOT EXISTS 'cabinet'@'localhost' IDENTIFIED BY 'fuvy54cdUY%FVhvdcY%SC$dvyjhfvJ6';"
  echo "    GRANT ALL PRIVILEGES ON cabinet_studio.* TO 'cabinet'@'localhost';"
  echo "    FLUSH PRIVILEGES;"
  echo ""
  echo "  Then load the schema:"
  echo ""
  echo "    mysql -u cabinet -pcabinet cabinet_studio < db/schema.sql"
  echo ""
  exit 1
fi

echo "  ✓ MariaDB connected"

# Check if schema is loaded
TABLE_COUNT=$(mysql -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USER:-cabinet}" -p"${DB_PASS:-cabinet}" "${DB_NAME:-cabinet_studio}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME:-cabinet_studio}';" 2>/dev/null)

if [ "$TABLE_COUNT" -lt "5" ] 2>/dev/null; then
  echo "  Loading schema..."
  mysql -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USER:-cabinet}" -p"${DB_PASS:-cabinet}" "${DB_NAME:-cabinet_studio}" < db/schema.sql
  echo "  ✓ Schema loaded"
else
  echo "  ✓ Schema already loaded ($TABLE_COUNT tables)"
fi

# Install dependencies
echo "  Installing server dependencies..."
cd server && npm install --silent && cd ..

echo "  Installing client dependencies..."
cd client && npm install --silent && cd ..

echo ""
echo "  Starting services..."
echo "  ─────────────────────"

# Start server in background
cd server
node index.js &
SERVER_PID=$!
cd ..

# Wait for server
sleep 2

# Start client dev server
cd client
echo ""
echo "  ◧ App ready:"
echo "    → Frontend: http://localhost:5173"
echo "    → API:      http://localhost:3001"
echo "    → Admin:    admin / changeme123"
echo ""
echo "  Press Ctrl+C to stop"
echo ""
npm run dev

# Cleanup
kill $SERVER_PID 2>/dev/null

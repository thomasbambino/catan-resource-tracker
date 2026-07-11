#!/usr/bin/env bash
# Backs up the PocketBase SQLite data file out of the Docker volume.
# Usage: ./scripts/backup-pb.sh [destination-dir]
set -euo pipefail

DEST_DIR="${1:-backups}"
mkdir -p "$DEST_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST_DIR/monopoly-pb-$TS.db"

# Use sqlite3's online backup so the file is consistent even with a live writer.
docker run --rm \
  -v monopoly_pb_data:/data \
  alpine \
  sh -c "apk add --no-cache sqlite >/dev/null && sqlite3 /data/data.db \".backup /data/_backup.db\" && cat /data/_backup.db && rm /data/_backup.db" \
  > "$OUT"

SIZE=$(wc -c < "$OUT" | tr -d ' ')
echo "✓ backup written: $OUT ($SIZE bytes)"

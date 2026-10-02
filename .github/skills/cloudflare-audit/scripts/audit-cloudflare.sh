#!/usr/bin/env bash
set -euo pipefail

ACCOUNT="${1:-${CLOUDFLARE_ACCOUNT:-default}}"
OUT_DIR="${2:-./.cloudflare-audit}"
mkdir -p "$OUT_DIR"

echo "[cloudflare-audit] collecting account inventory..."

wrangler whoami > "$OUT_DIR/whoami.txt" 2>&1 || true
wrangler d1 list > "$OUT_DIR/d1-list.txt" 2>&1 || true
wrangler kv namespace list > "$OUT_DIR/kv-list.txt" 2>&1 || true
wrangler deployments list > "$OUT_DIR/deployments.txt" 2>&1 || true
wrangler secret list > "$OUT_DIR/secrets.txt" 2>&1 || true
wrangler pages project list > "$OUT_DIR/pages-projects.txt" 2>&1 || true
wrangler tail --format pretty --exit-code 0 > "$OUT_DIR/tail.txt" 2>&1 || true

cat > "$OUT_DIR/README.md" <<EOF
# Cloudflare audit report

This directory contains a lightweight operational snapshot for review.

## Files
- whoami.txt
- d1-list.txt
- kv-list.txt
- deployments.txt
- secrets.txt
- pages-projects.txt
- tail.txt

## Production intent
Account: $ACCOUNT

## Notes
- This script is intentionally read-only.
- It is designed to support a human review or AI audit, not direct mutation.
EOF

echo "[cloudflare-audit] completed: $OUT_DIR"

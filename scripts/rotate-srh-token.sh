#!/usr/bin/env bash
# rotate-srh-token.sh — rotate the Upstash-REST shim token for redis-kami.
#
# Cadence: every 90 days from the previous rotation date.
# See ~/Documents/secret/claude-strategy/kami/vps-redis-details.md for the
# full operational rationale, the canonical token store, and the trade-off
# discussion vs Upstash managed.
#
# Pre-requisites (verified on each run):
#   - openssl (token generation)
#   - vercel CLI (linked to rectors-projects/kami)
#   - ssh kami works (Phase C1 SSH key — see vps-redis-details.md)
#   - git working tree clean (the script triggers a redeploy via empty commit)
#
# Recovery: this rotation is fail-open by design. If Vercel updates but the
# VPS half fails (or vice versa), Kami's rate-limit fails open
# (server/ratelimit.ts) — no Kami outage, just no enforcement until both
# halves agree again. Re-run the script to retry.

set -euo pipefail

# --- Pre-flight -----------------------------------------------------------

require() {
  command -v "$1" >/dev/null 2>&1 \
    || { echo "ERROR: '$1' is required but not on PATH." >&2; exit 1; }
}
require openssl
require vercel
require ssh
require git

if ! ssh -o BatchMode=yes -o ConnectTimeout=5 kami true 2>/dev/null; then
  echo "ERROR: 'ssh kami' must succeed without prompts." >&2
  echo "       See ~/Documents/secret/claude-strategy/kami/vps-redis-details.md" >&2
  echo "       for the C1 SSH-key setup." >&2
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  echo "ERROR: git working tree is not clean. Commit or stash before rotating." >&2
  exit 1
fi

# --- Generate the new token ----------------------------------------------

NEW_TOKEN=$(openssl rand -hex 32)
TS=$(date -u +%FT%TZ)
echo "[$(date +%H:%M:%S)] Generated new 64-char hex token. ($TS)"

# --- 1. Update VPS .env atomically ---------------------------------------

echo "[$(date +%H:%M:%S)] Updating /home/kami/redis/.env on reclabs3…"
ssh kami "set -e
  cd /home/kami/redis
  cp .env .env.bak.\$(date +%Y%m%d-%H%M%S)
  sed -i 's/^SRH_TOKEN=.*/SRH_TOKEN=$NEW_TOKEN/' .env
"

# --- 2. Restart the SRH container so it picks up the new token -----------

echo "[$(date +%H:%M:%S)] Restarting redis-http container (redis stays up)…"
ssh kami 'cd /home/kami/redis && docker compose restart redis-http' >/dev/null

# Give it a beat to come back
sleep 2

# --- 3. Verify VPS-local PING with the new token -------------------------

echo "[$(date +%H:%M:%S)] Verifying VPS-local PING with new token…"
RESPONSE=$(ssh kami "curl -sS --max-time 5 \
  -H 'Authorization: Bearer $NEW_TOKEN' \
  -H 'Content-Type: application/json' \
  -X POST http://127.0.0.1:6382/ \
  --data '[\"PING\"]'")
if [ "$RESPONSE" != '{"result":"PONG"}' ]; then
  echo "ERROR: VPS-local PING did not return PONG. Got: $RESPONSE" >&2
  echo "Aborting before touching Vercel — VPS rolled forward but Kami is unchanged." >&2
  exit 1
fi
echo "       VPS-local PING OK."

# --- 4. Push the new token to Vercel (Production scope only) -------------

echo "[$(date +%H:%M:%S)] Updating Vercel UPSTASH_REDIS_REST_TOKEN (production)…"
vercel env rm UPSTASH_REDIS_REST_TOKEN production --yes >/dev/null 2>&1 || true
echo "$NEW_TOKEN" | vercel env add UPSTASH_REDIS_REST_TOKEN production --sensitive >/dev/null

# --- 5. Update the GitHub Actions secret (uptime-redis.yml uses it) ------

if command -v gh >/dev/null 2>&1; then
  echo "[$(date +%H:%M:%S)] Updating GitHub Actions secret SRH_TOKEN…"
  gh secret set SRH_TOKEN -R RECTOR-LABS/kami -b "$NEW_TOKEN" >/dev/null
else
  echo "       (skipped: gh CLI not installed — set SRH_TOKEN manually in repo Actions secrets)"
fi

# --- 6. Trigger a Vercel redeploy via empty commit -----------------------

echo "[$(date +%H:%M:%S)] Triggering Vercel redeploy…"
git commit --allow-empty -m "chore: rotate SRH_TOKEN ($TS)"
git push >/dev/null 2>&1

# --- 7. Public-edge verification (after deploy) --------------------------

echo "[$(date +%H:%M:%S)] Waiting 60s for Vercel deploy + edge propagation…"
sleep 60

EDGE_RESPONSE=$(curl -sS --max-time 10 \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H 'Content-Type: application/json' \
  -X POST https://redis-kami.rectorspace.com/ \
  --data '["PING"]')
if [ "$EDGE_RESPONSE" != '{"result":"PONG"}' ]; then
  echo "WARNING: public-edge PING did not return PONG. Got: $EDGE_RESPONSE" >&2
  echo "         Check cloudflared health on reclabs3." >&2
fi

echo ""
echo "=============================================================="
echo "Rotation complete at $TS"
echo "=============================================================="
NEXT_DATE=$(date -u -v+90d +%Y-%m-%d 2>/dev/null || date -u -d '+90 days' +%Y-%m-%d)
echo "Next rotation due: $NEXT_DATE"
echo ""
echo "MANUAL FOLLOW-UP (one step):"
echo "  Update the SRH_TOKEN value in:"
echo "    ~/Documents/secret/claude-strategy/kami/vps-redis-details.md"
echo ""
echo "  The new token is printed below (exists only in your scrollback):"
echo ""
echo "    $NEW_TOKEN"
echo ""
echo "=============================================================="

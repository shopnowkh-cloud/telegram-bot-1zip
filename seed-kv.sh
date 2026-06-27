#!/bin/bash
set -e
echo "=== Seeding KV with groups from groups.json ==="

GROUPS=$(cat groups.json)
echo "Groups to seed: $GROUPS"

cd worker
printf '%s' "$GROUPS" | CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" npx wrangler kv key put --namespace-id=d19e046ab1174544b19f96d92771fac0 "groups" --stdin

echo ""
echo "=== Verifying KV ==="
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" npx wrangler kv key get --namespace-id=d19e046ab1174544b19f96d92771fac0 "groups"
echo ""
echo "=== Done ==="

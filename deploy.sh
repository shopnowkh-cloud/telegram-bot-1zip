#!/bin/bash
set -e

WORKER_NAME="telegram-group-bot"
WORKER_URL="https://${WORKER_NAME}.limsovannrady.workers.dev"

echo "🚀 Deploying ${WORKER_NAME} to Cloudflare Workers..."

npx wrangler deploy --no-bundle

echo ""
echo "✅ Deploy successful!"
echo "🔗 Worker URL: ${WORKER_URL}"
echo ""
echo "📡 Setting Telegram webhook via /setup..."
curl -s "${WORKER_URL}/setup" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('ok'):
    print('✅ Webhook set to:', d.get('webhook'))
    print('   Pending updates:', d.get('info',{}).get('pending_update_count',0))
else:
    print('❌ Webhook error:', d.get('error','unknown'))
    exit(1)
"

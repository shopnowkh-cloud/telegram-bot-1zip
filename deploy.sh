#!/bin/bash
set -e

WORKER_NAME="telegram-group-bot"
WORKER_URL="https://${WORKER_NAME}.limsovannrady.workers.dev"
WEBHOOK_URL="${WORKER_URL}/webhook"

echo "🚀 Deploying ${WORKER_NAME} to Cloudflare Workers..."

npx wrangler deploy --no-bundle

echo ""
echo "✅ Deploy successful!"
echo "🔗 Worker URL: ${WORKER_URL}"
echo ""
echo "📡 Setting Telegram webhook to: ${WEBHOOK_URL}"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('ok'):
    print('✅ Webhook set successfully!')
else:
    print('⚠️  Webhook error:', d.get('description','unknown'))
"

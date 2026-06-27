#!/bin/bash
set -e

echo "======================================="
echo " Deploy: telegram-group-bot"
echo "======================================="
npx wrangler deploy --no-bundle
echo ""
echo "📡 Setting webhook for group bot..."
curl -s "https://telegram-group-bot.limsovannrady.workers.dev/setup" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('ok'): print('✅ Group bot webhook set:', d.get('webhook'))
else: print('❌ Error:', d.get('error'))
"

echo ""
echo "======================================="
echo " Deploy: limsovannrady-tts-bot (@limsovannradybot)"
echo "======================================="
npx wrangler deploy --config wrangler-tts.toml
echo ""
echo "📡 Setting webhook for TTS bot..."
curl -s "https://limsovannrady-tts-bot.limsovannrady.workers.dev/setup" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('ok'): print('✅ TTS bot webhook set:', d.get('webhook'))
else: print('❌ Error:', d.get('error'))
"

echo ""
echo "✅ All deployments complete!"

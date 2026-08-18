#!/bin/zsh
# Déploie villao sur le VPS (Dokploy, admin.miha.run) puis VÉRIFIE la mise en ligne.
#
# Pousser ne suffit pas : l'app est branchée en provider « Git » générique, et
# l'autodeploy de Dokploy attend un webhook que GitHub n'appelle pas. Ce script
# force le déploiement et attend la fin du build.
#
# La clé d'API n'est pas dupliquée ici : on lit celle du projet Yeved.
#
# Usage :  zsh deploy_vps.sh
set -e
cd "$(dirname "$0")"

KEY_FILE=${DOKPLOY_KEY_FILE:-$HOME/Documents/App/Yeved/.dokploy_key}
[ -f "$KEY_FILE" ] || { echo "clé Dokploy introuvable : $KEY_FILE"; exit 1; }
KEY=$(cat "$KEY_FILE")
API=https://admin.miha.run/api/trpc
APP=SqishujWfAXxHtzu-ujqq          # villao-app — « Voxel City frontend »
SITE=https://villao.miha.run/

AVANT=$(curl -sS $SITE | grep -oE 'index-[A-Za-z0-9_-]+\.js')
echo "→ ce qui est en ligne : $AVANT"
echo "→ déploiement de villao-app (tire main sur bucyanaO/villao-app)"
curl -sS --max-time 60 -X POST "$API/application.deploy" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d "{\"json\":{\"applicationId\":\"$APP\"}}" >/dev/null

echo "→ build en cours..."
while :; do
  S=$(curl -sS --max-time 15 "$API/application.one?input=%7B%22json%22%3A%7B%22applicationId%22%3A%22$APP%22%7D%7D" -H "x-api-key: $KEY" \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['data']['json']['applicationStatus'])" 2>/dev/null || echo running)
  [ "$S" = "done" -o "$S" = "error" ] && break
  sleep 10
done
echo "→ build : $S"
[ "$S" = "error" ] && { echo "échec — voir l'onglet Deployments dans Dokploy"; exit 1; }

# le conteneur met quelques secondes à prendre la relève
for i in $(seq 1 36); do
  H=$(curl -sS $SITE | grep -oE 'index-[A-Za-z0-9_-]+\.js')
  [ "$H" != "$AVANT" ] && { echo "✓ en ligne : $H (était $AVANT)"; exit 0; }
  sleep 5
done
echo "⚠︎ le site sert encore $AVANT — le build est passé mais la relève n'a pas eu lieu"
exit 1

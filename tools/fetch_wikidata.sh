#!/bin/sh
# Dates de naissance / pays des joueurs pros connus de Wikidata.
# Usage : sh tools/fetch_wikidata.sh sortie.csv
curl -sS -m 300 -A "EsportsManagerFanGame/1.0 (non-commercial fan game)" -H "Accept: text/csv" \
  --data-urlencode query@"$(dirname "$0")/wikidata_players.rq" https://query.wikidata.org/sparql -o "${1:-wd_players.csv}"

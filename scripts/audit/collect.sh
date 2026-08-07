#!/usr/bin/env bash
# collect.sh — the "read the logs" half of the /linear-audit routine.
#
# Gathers everything that can be known without a browser: build health, lint
# noise, server state, data volume, the route inventory the sweep will walk,
# and which parity area the last run covered. Writes each raw output to
# .audit/latest/ and prints a digest to stdout.
#
#   bash scripts/audit/collect.sh
#
# Exit code is always 0 — a failing typecheck is a finding to report, not a
# reason to abort the routine.

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/.audit/latest"
API="${API_URL:-http://localhost:3001}"
DB="$ROOT/server/data/flint.db"

rm -rf "$OUT"; mkdir -p "$OUT"
cd "$ROOT"

say() { printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------- git + area
say "GIT"
git status --short | head -30
printf 'branch: %s  head: %s\n' "$(git branch --show-current)" "$(git log -1 --format='%h %s')"

say "ROTATION"
LAST_AREA="$(cat "$ROOT/.audit/last-area" 2>/dev/null || echo '(none yet)')"
echo "last audited area: $LAST_AREA"
echo "pick the NEXT area from .claude/skills/linear-audit/reference/parity-map.md"

# ------------------------------------------------------------------ servers
say "SERVERS"
if curl -fsS -m 3 "$API/api/health" >/dev/null 2>&1; then
  echo "api  :3001  UP"
else
  echo "api  :3001  DOWN  -> (cd server && npm start &)"
fi
if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "vite :5173  UP"
else
  echo "vite :5173  DOWN  -> start it with the preview tool, never from Bash"
fi

# ------------------------------------------------------------- build health
say "TYPECHECK (npx tsc -b)"
if npx tsc -b >"$OUT/tsc.txt" 2>&1; then
  echo "PASS"
else
  echo "FAIL — first 40 lines:"; head -40 "$OUT/tsc.txt"
fi

say "LINT (npm run lint)"
npm run lint >"$OUT/lint.txt" 2>&1
# Grouped by rule, because the React Compiler rules fire in the hundreds across
# this codebase and a single new violation would otherwise scroll past unseen.
# Compare these counts to the previous run: a family that grew is a regression.
grep -oE '[a-z@-]+/[a-z-]+$' "$OUT/lint.txt" | sort | uniq -c | sort -rn | head -12
grep -oE 'Error: [A-Z][^.]{10,60}' "$OUT/lint.txt" | sort | uniq -c | sort -rn | head -6
printf 'total problems: %s (full log: .audit/latest/lint.txt)\n' \
  "$(grep -cE '  (error|warning)  ' "$OUT/lint.txt" 2>/dev/null || echo 0)"

# --------------------------------------------------------------- data volume
say "DATA"
if [ -f "$DB" ]; then
  sqlite3 "$DB" \
    "SELECT 'files rows: '||COUNT(*)||'  bytes: '||COALESCE(SUM(size),0) FROM files;" 2>/dev/null \
    || echo "(sqlite3 CLI unavailable — skip)"
fi
node -e '
const u=process.argv[1];
const j=(p,o)=>fetch(u+p,o).then(r=>r.json());
(async()=>{
  const {token}=await j("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:"avery@workspace.dev",password:"demo1234"})});
  if(!token) return console.log("login failed — is the seed user still there?");
  const q=(query)=>j("/graphql",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify({query})});
  const r=await q(`{ issues(first:500){nodes{id}} projects(first:200){nodes{id}} teams(first:50){nodes{key}} users(first:100){nodes{id}} comments(first:500){nodes{id}} }`);
  const d=r.data||{};
  const n=(k)=>d[k]?.nodes?.length ?? "?";
  console.log(`issues:${n("issues")} projects:${n("projects")} teams:${n("teams")} users:${n("users")} comments:${n("comments")}`);
  if(r.errors) console.log("graphql errors:",JSON.stringify(r.errors).slice(0,300));
})().catch(e=>console.log("api probe failed:",e.message));
' "$API" 2>&1 | tail -5

# --------------------------------------------------------------- route list
say "ROUTES"
grep -o 'path="[^"]*"' src/App.tsx | sed 's/path="//;s/"//' | sort -u | tee "$OUT/routes.txt" | tr '\n' ' '
printf '\n(%s routes — .audit/latest/routes.txt)\n' "$(wc -l <"$OUT/routes.txt" | tr -d ' ')"

say "NEXT"
cat <<'EOF'
1. start vite with the preview tool if it is DOWN
2. pour data in:  node scripts/audit/seed-bulk.mjs
3. sweep the UI:  paste .claude/skills/linear-audit/reference/browser-sweep.js
4. compare the rotation area against real Linear, fix what differs
5. record the area:  echo "<area>" > .audit/last-area
EOF
exit 0

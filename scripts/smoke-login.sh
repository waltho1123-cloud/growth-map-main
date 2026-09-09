#!/bin/zsh
# 真帳號登入 e2e smoke（2026-09-09 起可自動化：登入已改 email／密碼，不再有 OAuth 擋 CDP 的問題）。
# 帳密放 ~/.config/growthmap/smoke.env（chmod 600）：SMOKE_EMAIL、SMOKE_PASSWORD；不得進 repo／對話。
# 用法：scripts/smoke-login.sh [base-url]（預設 staging）。驗：portal 登入成功 → 第四堂通過登入閘門 → 第三堂同步膠囊 → 登出。
set -u
BASE=${1:-https://growthmap-staging.zeabur.app}
ENVF=${SMOKE_ENV_FILE:-$HOME/.config/growthmap/smoke.env}
[ -f "$ENVF" ] || { echo "缺少 $ENVF（需 SMOKE_EMAIL／SMOKE_PASSWORD）"; exit 2; }
set -a; source "$ENVF"; set +a
r() { playwright-cli "$@" 2>&1 | grep -E '^(true|false|"|Total|\[ERROR\])'; }
echo "### portal login ($BASE)"
playwright-cli open "$BASE/" >/dev/null
playwright-cli click ".gbp-auth-btn" >/dev/null
playwright-cli fill "input[name=email]" "$SMOKE_EMAIL" >/dev/null
playwright-cli fill "input[name=password]" "$SMOKE_PASSWORD" >/dev/null
playwright-cli click ".gbp-login-submit" >/dev/null
r eval "(async () => { for (let i=0;i<60;i++){ const s=document.querySelector('.gbp-auth-status'); if(s) return 'portal: '+s.textContent+' as '+(document.querySelector('.gbp-auth-name')?.textContent||''); const e=document.querySelector('.gbp-login-err'); if(e && !e.hidden && e.textContent) return 'portal login error: '+e.textContent; await new Promise(r=>setTimeout(r,250)); } return 'portal: no login result after 15s'; })()"
echo "### evaluate-strategy login gate"
playwright-cli goto "$BASE/growthmap/evaluate-strategy/dist/" >/dev/null
r eval "(async () => { for (let i=0;i<60;i++){ const t=document.body.innerText; if(t.includes('選擇評估專案')) return 'evaluate: gate passed (ProjectPicker)'; if(document.querySelector('input[type=password]')) return 'evaluate: still at LoginGate'; await new Promise(r=>setTimeout(r,250)); } return 'evaluate: undetermined'; })()"
echo "### opportunity-system shared session"
playwright-cli goto "$BASE/growthmap/opportunity-system/build/" >/dev/null
r eval "(async () => { for (let i=0;i<60;i++){ if(document.body.innerText.includes('已同步')) return 'opportunity: 已同步 pill (session shared)'; await new Promise(r=>setTimeout(r,250)); } return 'opportunity: no sync pill'; })()"
r console error
echo "### logout"
playwright-cli goto "$BASE/" >/dev/null
r eval "(async () => { for (let i=0;i<40;i++){ const o=[...document.querySelectorAll('.gbp-auth-link')].find(b=>b.textContent==='登出'); if(o){ o.click(); await new Promise(r=>setTimeout(r,800)); return 'logged out, login button back: '+!!document.querySelector('.gbp-auth-btn'); } await new Promise(r=>setTimeout(r,250)); } return 'no logout button'; })()"
playwright-cli close >/dev/null

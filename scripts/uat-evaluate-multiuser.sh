#!/bin/zsh
# 第四堂多人流程 UAT（自動化）：兩個 smoke 帳號、兩個獨立瀏覽器 session。
# 流程：owner 建專案 → 設定頁邀請 member → member 在專案清單接受邀請（自助加入）→
#       owner 看到成員數 2 → owner 刪除專案 → member 清單不再出現。
# 需 ~/.config/growthmap/smoke.env：SMOKE_EMAIL/SMOKE_PASSWORD（owner）、SMOKE2_EMAIL/SMOKE2_PASSWORD（member）。
set -u
BASE=${1:-https://growthmap-staging.zeabur.app}
ENVF=${SMOKE_ENV_FILE:-$HOME/.config/growthmap/smoke.env}
[ -f "$ENVF" ] || { echo "缺少 $ENVF"; exit 2; }
set -a; source "$ENVF"; set +a
EVA="$BASE/growthmap/evaluate-strategy/dist/"
NAME="UAT 自動化 $(date +%m%d-%H%M%S)"
o() { playwright-cli -s=uat-owner "$@" 2>&1 | grep -E '^(true|false|"|Total|\[ERROR\])'; }
m() { playwright-cli -s=uat-member "$@" 2>&1 | grep -E '^(true|false|"|Total|\[ERROR\])'; }
oq() { playwright-cli -s=uat-owner "$@" >/dev/null 2>&1; }
mq() { playwright-cli -s=uat-member "$@" >/dev/null 2>&1; }
WAIT_TEXT='(async (needle, ms) => { for (let i=0;i<ms/250;i++){ if(document.body.innerText.includes(needle)) return "seen: "+needle; await new Promise(r=>setTimeout(r,250)); } return "NOT seen in "+ms+"ms: "+needle+" | page: "+location.hash+" | "+document.body.innerText.replace(/\s+/g," ").slice(0,300); })'
WAIT_SEL='(async (sel, ms) => { for (let i=0;i<ms/250;i++){ if(document.querySelector(sel)) return "seen selector: "+sel; await new Promise(r=>setTimeout(r,250)); } return "NOT seen selector in "+ms+"ms: "+sel+" | "+document.body.innerText.replace(/\s+/g," ").slice(0,200); })'
login() { # $1=session fn prefix (oq|mq) $2=email $3=password
  $1 open "$BASE/"; $1 click ".gbp-auth-btn"; $1 fill "input[name=email]" "$2"; $1 fill "input[name=password]" "$3"; $1 click ".gbp-login-submit"
}
echo "### 1) owner 登入並建立專案「$NAME」"
login oq "$SMOKE_EMAIL" "$SMOKE_PASSWORD"
o eval "$WAIT_TEXT('已登入', 15000)"
oq goto "$EVA"
o eval "$WAIT_TEXT('選擇評估專案', 20000)"
oq click 'button:text-is("＋ 建立評估專案")'
oq fill 'input[placeholder="例：2026 寵物事業群 評估策略"]' "$NAME"
oq click 'button:text-is("建立")'
o eval "$WAIT_TEXT('設定與成員', 20000)"
echo "### 2) owner 到設定頁邀請 member（角色預設：成員）"
oq goto "$EVA#/settings"
o eval "$WAIT_SEL('input[placeholder=\"邀請成員的登入 email\"]', 15000)"
oq fill 'input[placeholder="邀請成員的登入 email"]' "$SMOKE2_EMAIL"
oq click 'button:text-is("邀請")'
o eval "$WAIT_TEXT('已邀請 $SMOKE2_EMAIL', 10000)"
echo "### 3) member 登入，在專案清單看到邀請並加入"
login mq "$SMOKE2_EMAIL" "$SMOKE2_PASSWORD"
m eval "$WAIT_TEXT('已登入', 15000)"
mq goto "$EVA"
m eval "$WAIT_TEXT('邀請我加入', 20000)"
m eval "$WAIT_TEXT('$NAME', 5000)"
mq click 'button:text-is("加入")'
m eval "$WAIT_TEXT('設定與成員', 20000)"
m eval "'member after join: hash='+location.hash+' | '+document.body.innerText.replace(/\s+/g,' ').slice(0,300)"
mq goto "$EVA#/settings"
m eval "(async () => { for (let i=0;i<60;i++){ const t=document.body.innerText; if(t.includes('成員（2）')) return 'member view: 成員（2）'+(t.includes('成員（評分／方案／財務）')?' role=member':''); await new Promise(r=>setTimeout(r,250)); } return 'member view: '+(document.body.innerText.match(/成員（\\d+）/)||['no 成員 count'])[0]; })()"
echo "### 4) owner 端即時看到成員數 2"
o eval "(async () => { for (let i=0;i<60;i++){ if(document.body.innerText.includes('成員（2）')) return 'owner view: 成員（2）'; await new Promise(r=>setTimeout(r,250)); } return 'owner view: '+(document.body.innerText.match(/成員（\\d+）/)||['no count'])[0]; })()"
echo "### 5) owner 刪除專案，member 端專案消失"
oq click 'button:text-is("刪除整個評估專案")'
o eval "$WAIT_TEXT('無法復原', 5000)"
oq click 'button:text-is("確認刪除")'
o eval "$WAIT_TEXT('選擇評估專案', 20000)"
mq goto "$EVA"
m eval "(async () => { for (let i=0;i<80;i++){ const t=document.body.innerText; if(t.includes('選擇評估專案') && !t.includes('$NAME')) return 'member picker: project gone (after '+(i*250)+'ms)'; await new Promise(r=>setTimeout(r,250)); } return 'member NOT back at picker in 20s | '+document.body.innerText.replace(/\s+/g,' ').slice(0,200); })()"
echo "### console errors"; echo "owner:"; o console error; echo "member:"; m console error
oq close; mq close

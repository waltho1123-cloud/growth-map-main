# Playwright 瀏覽器 Smoke（部署前，行為級變更必跑）

HTTP 200 不代表 app 活著——2026-08-09 momentum 曾因兩個 React 實體副本白屏，
所有 curl 檢查照樣全綠。**凡動到 entry／chunk 結構／依賴樹／同步邏輯，部署前必跑本程序。**

前置：`python3 -m http.server 8001 --directory <repo根>`（或任何服務 repo 根的靜態伺服器）。

```bash
B=http://localhost:8001/growthmap

# 1) opportunity：skeleton 移除＝React 掛載成功；console 零 error
playwright-cli open "$B/opportunity-system/build/"
playwright-cli eval "document.getElementById('app-skeleton') === null"
playwright-cli console error

# 2) aspiration：掛載＋匯出 PDF 實際觸發下載
playwright-cli goto "$B/aspiration-case/dist/"
playwright-cli eval "document.getElementById('root').children.length > 0"
playwright-cli run-code "async page => { const [d] = await Promise.all([page.waitForEvent('download'), page.click('text=匯出為 PDF')]); return d.suggestedFilename(); }"

# 3) momentum：skeleton 移除＋步驟切換＋匯出 PDF
playwright-cli goto "$B/momentum-case/out/"
playwright-cli eval "document.getElementById('app-loading') === null"
playwright-cli click "text=營收拆解"
playwright-cli run-code "async page => { const [d] = await Promise.all([page.waitForEvent('download'), page.click('text=匯出為 PDF')]); return d.suggestedFilename(); }"

playwright-cli console error   # 每頁檢查一次
playwright-cli close
```

通過標準：三頁 skeleton 移除、console 零 error（**含 favicon——7e355f4 起全站有
favicon.ico，404 即部署迴歸，不再是可忽略例外**）、兩個 PDF 下載事件回報正確檔名。

另有結構性防復發：`npm run check:react`（禁止巢狀 React 副本）已納入 `npm run preflight`。

## 雙裝置 section 級 merge（動到 packages/cloud 同步邏輯時必跑，需線上環境＋登入）

模擬兩台裝置並行編輯**不同 section**，驗證互不覆蓋（whole-doc LWW 年代會後寫全蓋）。

> 2026-09-08 起登入為 email／密碼：Playwright 可用測試帳號 `playwright-cli fill` 直接登入
> （過去 Google OAuth 擋 CDP 瀏覽器、必須真人手動的限制已不存在）。測試帳號請在
> Firebase Console → Authentication → Users 建立，勿用真實學員帳號。

1. Chrome **一般視窗**開 staging 單元頁（aspiration 或 momentum）→ email／密碼登入。
2. **無痕視窗**開同一網址 → 登入同一帳號（兩環境的 storage 完全隔離＝兩台裝置）。
3. 視窗 A 改一個欄位；30 秒內視窗 B 改**另一個 section** 的欄位
   （aspiration：Part A vs Part B；momentum：驅動因子 vs 棘手挑戰——同 section
   的不同列驗的是即時同步，跨 section 才驗 merge 裁決）。
4. 等 5 秒（debounce＋雲端確認），兩邊都重新整理。
5. 驗收:兩邊同時看得到雙方的新值（四值俱存）、右上「已同步」穩定、
   無持續互寫（DevTools Network 的 firestore write 幾秒內停止——防 ping-pong 不變式）。

## 登入表單 smoke（動到 packages/firebase、js/auth-ui.js、各單元 AuthWidget／LoginGate 時必跑）

不需要真帳號：用不存在的帳號登入，驗證表單接線與錯誤翻譯（同時暴露 Firebase Console 供應商狀態）。

```bash
P=http://localhost:8001
playwright-cli goto "$P/"                                   # portal 膠囊
playwright-cli click "text=登入"
playwright-cli fill "input[name=email]" "nobody@example.invalid"
playwright-cli fill "input[name=password]" "wrong-password"
playwright-cli click ".gbp-login-submit"
playwright-cli eval "document.querySelector('.gbp-login-err')?.textContent"
# 期望「email 或密碼錯誤。」；若出現「尚未在 Firebase 啟用」＝Console 的 Email/Password 供應商未開，
# 屬環境未就緒而非程式錯誤。

playwright-cli goto "$P/growthmap/evaluate-strategy/dist/"   # 第四堂 LoginGate（整頁表單）
playwright-cli fill "input[type=email]" "nobody@example.invalid"
playwright-cli fill "input[type=password]" "wrong-password"
playwright-cli click "button[type=submit]"
playwright-cli eval "document.body.innerText.includes('email 或密碼錯誤') || document.body.innerText.includes('尚未在 Firebase 啟用')"
playwright-cli console error
```

有測試帳號時再補：登入成功 → 右上膠囊「✓ 已登入」；未驗證帳號顯示「未驗證 email」→ 寄送驗證信不報錯。

## 真帳號登入 e2e（動到登入流程、@growthmap/firebase、js/auth-ui.js 時必跑）

```bash
scripts/smoke-login.sh https://growthmap-staging.zeabur.app   # 或 prod 網址
```

需要 `~/.config/growthmap/smoke.env`（`SMOKE_EMAIL`／`SMOKE_PASSWORD`，chmod 600）。smoke 帳號
`platform-smoke@growth-map-main.zeabur.app` 由管理員建立、不在 AI 白名單、沒有資料；密碼忘了就到管理頁重設並更新該檔。
通過標準：portal 顯示「✓ 已登入」、第四堂進到「選擇評估專案」、第三堂右上「已同步」、登出後回到「登入」按鈕，console 零錯誤。

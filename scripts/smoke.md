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

> ⚠️ **Google OAuth 擋所有 CDP 控制的瀏覽器**（chromium 與 --browser=chrome 都會
> signin/rejected，2026-08-10 實測）——本程序**必須由真人以真瀏覽器手動執行**，
> Playwright 只能用於無登入的驗證。

1. Chrome **一般視窗**開 staging 單元頁（aspiration 或 momentum）→ Google 登入。
2. **無痕視窗**開同一網址 → 登入同一帳號（兩環境的 storage 完全隔離＝兩台裝置）。
3. 視窗 A 改一個欄位；30 秒內視窗 B 改**另一個 section** 的欄位
   （aspiration：Part A vs Part B；momentum：驅動因子 vs 棘手挑戰——同 section
   的不同列驗的是即時同步，跨 section 才驗 merge 裁決）。
4. 等 5 秒（debounce＋雲端確認），兩邊都重新整理。
5. 驗收:兩邊同時看得到雙方的新值（四值俱存）、右上「已同步」穩定、
   無持續互寫（DevTools Network 的 firestore write 幾秒內停止——防 ping-pong 不變式）。

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

通過標準：三頁 skeleton 移除、console 零 error（站台根 favicon 404 為既知裝飾性例外）、
兩個 PDF 下載事件回報正確檔名。

另有結構性防復發：`npm run check:react`（禁止巢狀 React 副本）已納入 `npm run preflight`。

## 雙裝置 section 級 merge（動到 packages/cloud 同步邏輯時必跑，需線上環境＋登入）

模擬兩台裝置並行編輯**不同 section**，驗證互不覆蓋（whole-doc LWW 年代會後寫全蓋）。
用兩個獨立 Playwright session 模擬兩裝置（各自的 storage/登入態）：

```bash
U=https://growth-map-staging.zeabur.app/growthmap/aspiration-case/dist/   # staging 先驗；無 staging 時用 prod
playwright-cli -s=devA open "$U" --persistent   # 手動完成 Google 登入（同一帳號）
playwright-cli -s=devB open "$U" --persistent   # 第二個 session、同帳號

# devA 改 Part A 的欄位、devB 同一分鐘內改 Part B 的欄位（各自 snapshot 找 ref 後 fill）
# 等待 >2 秒（debounce+回寫），然後兩邊 reload：
playwright-cli -s=devA reload && playwright-cli -s=devB reload
# 驗收：devA 看得到 devB 的 Part B 新值，devB 看得到 devA 的 Part A 新值，
# 且雙方自己的編輯仍在（四個值全存活）。console 零 error、無持續互寫（Network 面板
# firestore write 應在幾秒內停止——防 ping-pong 不變式）。
```

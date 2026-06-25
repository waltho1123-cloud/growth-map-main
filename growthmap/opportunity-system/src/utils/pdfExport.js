import { GO_TO_MARKET_FACETS, RATING_MAX, OPPORTUNITY_STATUS_LABELS } from './constants';
import { TOOL_NAME_BY_ID } from './toolLibrary';
import { aiText } from '../lib/ai/aiText';

// A4 橫式 (landscape) 尺寸
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

// BW/BCG brand palette
const GREEN = [0, 166, 81];       // #00A651
const NAVY = [16, 42, 67];        // #102A43
const LIGHT_GRAY = [240, 244, 248];
const MID_GRAY = [148, 163, 184];
const DARK_TEXT = [36, 59, 83];
const WHITE = [255, 255, 255];

const FONT_URL = process.env.PUBLIC_URL + '/fonts/NotoSansTC.ttf';
let cachedFontBase64 = null;

async function loadCJKFont() {
  if (cachedFontBase64) return cachedFontBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error('Failed to load CJK font');
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  cachedFontBase64 = btoa(binary);
  return cachedFontBase64;
}

function registerFont(doc, base64) {
  doc.addFileToVFS('NotoSansTC.ttf', base64);
  doc.addFont('NotoSansTC.ttf', 'NotoSansTC', 'normal');
  doc.setFont('NotoSansTC');
}

function getToolName(id) {
  const name = TOOL_NAME_BY_ID[id];
  return name ? `${id}. ${name}` : String(id);
}

// ---- Page break helper ----

// ctx = { tab, pn }，pn = { val }（可變頁碼物件）。放不下 neededHeight 時換頁，回傳新頁頂端 y。
function checkPageBreak(doc, y, neededHeight, ctx) {
  if (y + neededHeight > PAGE_H - MARGIN) {
    addPageNumber(doc, ctx.pn.val);
    doc.addPage();
    ctx.pn.val++;
    addWatermark(doc);
    addPageTab(doc, ctx.tab);
    return 26;
  }
  return y;
}

// 換頁並回到新頁頂端（供 addField 逐行跨頁續排用）。
function nextPage(doc, ctx) {
  addPageNumber(doc, ctx.pn.val);
  doc.addPage();
  ctx.pn.val++;
  addWatermark(doc);
  addPageTab(doc, ctx.tab);
  return 26;
}

// ---- Page decorators ----

function addWatermark(doc) {
  doc.setFont('NotoSansTC');
  doc.setFontSize(10);
  doc.setTextColor(...MID_GRAY);
  doc.text('僅供商周百億CEO學員使用', PAGE_W / 2, 10, { align: 'center' });
}

function addPageTab(doc, label) {
  doc.setFont('NotoSansTC');
  doc.setFontSize(10);
  const tabW = doc.getTextWidth(label) + 12;
  doc.setFillColor(...GREEN);
  doc.roundedRect(PAGE_W - MARGIN - tabW, 0, tabW + MARGIN, 16, 0, 0, 'F');
  doc.setTextColor(...WHITE);
  doc.text(label, PAGE_W - MARGIN - tabW + 6, 11);
}

function addPageNumber(doc, num) {
  doc.setFont('NotoSansTC');
  doc.setFontSize(10);
  doc.setTextColor(...MID_GRAY);
  doc.text(String(num), PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
}

function addGreenTitle(doc, y, title) {
  doc.setFont('NotoSansTC');
  doc.setTextColor(...GREEN);
  doc.setFontSize(28);
  const lines = doc.splitTextToSize(title, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 11 + 6;
}

// 量測欄位換行與高度（版面常數集中於此，供換頁預判與繪製共用，避免公式重複）。
function measureField(doc, value, maxWidth) {
  const w = maxWidth || CONTENT_W - 12;
  const lines = doc.splitTextToSize(value || '—', w);
  return { lines, height: 6 + lines.length * 6 + 4 };
}

// 區塊標題列；nextHeight = 緊接其後第一個欄位的高度，連同標題列一起預留，
// 確保標題列不被孤立在頁底、不與內容拆到兩頁。
function addSectionBar(doc, y, title, ctx, nextHeight = 0) {
  if (ctx) y = checkPageBreak(doc, y, 16 + nextHeight, ctx);
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'F');
  // Green left accent
  doc.setFillColor(...GREEN);
  doc.roundedRect(MARGIN, y, 3.5, 12, 1, 0, 'F');
  doc.setFont('NotoSansTC');
  doc.setTextColor(...NAVY);
  doc.setFontSize(14);
  doc.text(title, MARGIN + 10, y + 8.5);
  return y + 16;
}

// 繪製「標籤 + 多行值」；標籤與首行一起換頁；內容超過整頁時逐行跨頁續排（不裁切）。
function addField(doc, y, label, value, ctx, maxWidth) {
  const { lines } = measureField(doc, value, maxWidth);
  y = checkPageBreak(doc, y, 16, ctx); // 標籤(10)+首行(6) 不被孤立在頁底
  doc.setFont('NotoSansTC');
  doc.setTextColor(...MID_GRAY);
  doc.setFontSize(10);
  doc.text(label, MARGIN + 6, y);
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(14);
  let ty = y + 6;
  for (const line of lines) {
    if (ty > PAGE_H - MARGIN) {
      ty = nextPage(doc, ctx);
      doc.setFont('NotoSansTC');
      doc.setTextColor(...DARK_TEXT);
      doc.setFontSize(14);
    }
    doc.text(line, MARGIN + 6, ty);
    ty += 6;
  }
  return ty + 4;
}

// 一個區塊：標題列 + 一到多個欄位。標題列與第一個欄位一起換頁（不孤立），
// 後續欄位再依實際高度自動換頁/續排。fields: [{ label, value, w? }]
function addBlock(doc, y, ctx, title, fields) {
  const first = fields.length ? measureField(doc, fields[0].value, fields[0].w) : { height: 0 };
  y = addSectionBar(doc, y, title, ctx, first.height);
  for (const f of fields) {
    y = addField(doc, y, f.label, f.value, ctx, f.w);
  }
  return y;
}

// 模板三四象限（1–5 評分）— PDF 視覺化，色彩呼應編輯器 RatingDots
const RATING_QUADRANTS = [
  { key: 'size', label: 'Size of the Prize｜市場規模與競爭', color: [55, 65, 81] },
  { key: 'potential', label: 'Potential of Play｜操作潛力', color: GREEN },
  { key: 'path', label: 'Path to Achieve｜達成路徑', color: [245, 158, 11] },
  { key: 'rightToWin', label: 'Right to Win｜取勝之道', color: [147, 51, 234] },
];

// 一列四象限評分：左標籤，右側 RATING_MAX 個圓點（實心至 value），末端 n/5
function addRatingRow(doc, y, label, value, color) {
  const v = Math.max(0, Math.min(RATING_MAX, Number(value) || 0));
  doc.setFont('NotoSansTC');
  doc.setFontSize(12);
  doc.setTextColor(...DARK_TEXT);
  doc.text(label, MARGIN + 6, y + 4);
  const gap = 7;
  const startX = MARGIN + CONTENT_W - 16 - RATING_MAX * gap;
  for (let i = 0; i < RATING_MAX; i++) {
    const cx = startX + i * gap;
    if (i < v) {
      doc.setFillColor(...color);
      doc.circle(cx, y + 2.6, 2.4, 'F');
    } else {
      doc.setDrawColor(...MID_GRAY);
      doc.setFillColor(...WHITE);
      doc.circle(cx, y + 2.6, 2.4, 'FD');
    }
  }
  doc.setFontSize(10);
  doc.setTextColor(...MID_GRAY);
  doc.text(v ? `${v}/${RATING_MAX}` : '—', startX + RATING_MAX * gap + 1, y + 4);
  return y + 8;
}

// 模板二「市場進入策略」新七面向（goToMarket 物件）→ 多行字串；
// 無新資料時回退舊版字串欄位 goToMarketStrategy（review ③，向後相容）。
function formatGoToMarket(t2) {
  const gtm = t2.goToMarket;
  if (gtm && typeof gtm === 'object') {
    const lines = GO_TO_MARKET_FACETS
      .map((f) => { const v = (gtm[f.key] || '').trim(); return v ? `${f.label}：${v}` : null; })
      .filter(Boolean);
    if (lines.length) return lines.join('\n');
  }
  return t2.goToMarketStrategy || '';
}

// Green gradient cover (simulated with rectangles)
function drawGreenGradientCover(doc) {
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(0 + t * 16);
    const g = Math.round(166 - t * 40);
    const b = Math.round(81 - t * 10);
    doc.setFillColor(r, g, b);
    doc.rect(0, (PAGE_H / steps) * i, PAGE_W, PAGE_H / steps + 1, 'F');
  }
}

function drawDividerPage(doc, title) {
  drawGreenGradientCover(doc);
  doc.setFont('NotoSansTC');
  doc.setTextColor(...WHITE);
  doc.setFontSize(36);
  const lines = doc.splitTextToSize(title, PAGE_W * 0.7);
  doc.text(lines, MARGIN + 10, PAGE_H / 2);
}

// ---- Main export ----

export async function exportToPdf(opportunities, toolAnalyses = {}) {
  const { default: jsPDF } = await import('jspdf');
  const fontBase64 = await loadCJKFont();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerFont(doc, fontBase64);

  let pageNum = 0;

  // ===== 封面 =====
  drawGreenGradientCover(doc);
  doc.setFont('NotoSansTC');
  doc.setTextColor(...WHITE);
  doc.setFontSize(50);
  doc.text('Growth Opportunities', MARGIN + 10, PAGE_H / 2 - 25);
  doc.setFontSize(16);
  doc.text('BW CEO Workshop — 成長機會探索作業', MARGIN + 10, PAGE_H / 2 - 6);
  doc.setFontSize(12);
  doc.setTextColor(220, 240, 230);
  doc.text(
    `共 ${opportunities.length} 個機會  |  ${new Date().toLocaleDateString('zh-TW')}`,
    MARGIN + 10, PAGE_H / 2 + 10
  );

  // ===== 每個機會 =====
  opportunities.forEach((opp, idx) => {
    const oppTitle = opp.opportunityName || `Opportunity ${idx + 1}`;
    const num = idx + 1;

    // --- 分隔頁 ---
    doc.addPage();
    pageNum++;
    drawDividerPage(doc, `#${num}\n${oppTitle}`);
    addPageNumber(doc, pageNum);

    // --- Template 1: Starting Point & Insights ---
    doc.addPage();
    pageNum++;
    addWatermark(doc);
    addPageTab(doc, 'Template 1');
    const ctx1 = { tab: 'Template 1', pn: { val: pageNum } };
    let y = addGreenTitle(doc, 24, `#${num} ${oppTitle} — 起點與洞察`);

    // 機會資訊（含 AI-04 排序、AI 評分、預估營收、狀態）
    {
      const metaParts = [];
      if (opp.rank != null) metaParts.push(`AI 排序：#${opp.rank}`);
      if (opp.aiScore != null) metaParts.push(`AI 評分：${opp.aiScore}`);
      const rev = Number(opp.estRevenue) || 0;
      if (rev) metaParts.push(`預估年營收：${rev.toLocaleString()} ${opp.currency || ''}`.trim());
      const statusLabel = OPPORTUNITY_STATUS_LABELS[opp.status];
      if (statusLabel) metaParts.push(`狀態：${statusLabel}`);
      if (metaParts.length) {
        y = addField(doc, y, '機會資訊', metaParts.join('　|　'), ctx1);
      }
    }

    y = addBlock(doc, y, ctx1, 'BCG 工具', [
      { label: '使用的 BCG Tools', value: (opp.usedTools || []).map(getToolName).join(', ') },
    ]);
    y = addBlock(doc, y, ctx1, '企業定位', [
      { label: '公司類型 Company Type', value: opp.template1.companyType },
      { label: '成長維度 Growth Dimension', value: opp.template1.growthDimension },
      { label: '成長槓桿 Growth Lever', value: opp.template1.growthLever },
      { label: '成長類型 Growth Type', value: (opp.template1.growthType || []).join(', ') },
    ]);
    y = addBlock(doc, y, ctx1, '關鍵洞察', [
      { label: 'Key Insights', value: opp.template1.insights, w: CONTENT_W - 12 },
    ]);

    addPageNumber(doc, ctx1.pn.val);
    pageNum = ctx1.pn.val;

    // --- Template 2: Opportunity Details ---
    doc.addPage();
    pageNum++;
    addWatermark(doc);
    addPageTab(doc, 'Template 2');
    const ctx2 = { tab: 'Template 2', pn: { val: pageNum } };
    y = addGreenTitle(doc, 24, `#${num} ${oppTitle} — 機會詳情`);

    y = addBlock(doc, y, ctx2, '機會概念與做法', [
      { label: '機會概念 Concept', value: opp.template2.concept, w: CONTENT_W - 12 },
      { label: '實施方法 Method', value: opp.template2.method, w: CONTENT_W - 12 },
    ]);
    y = addBlock(doc, y, ctx2, '目標客戶與價值主張', [
      { label: '目標客群 Target Customer', value: opp.template2.targetCustomer, w: CONTENT_W - 12 },
      { label: '獨特賣點 USP', value: opp.template2.usp, w: CONTENT_W - 12 },
    ]);
    y = addBlock(doc, y, ctx2, '市場進入與實施', [
      { label: '上市策略 Go-to-Market（七面向）', value: formatGoToMarket(opp.template2), w: CONTENT_W - 12 },
      { label: '實施步驟 Implementation', value: opp.template2.steps || opp.template2.implementationSteps, w: CONTENT_W - 12 },
    ]);

    addPageNumber(doc, ctx2.pn.val);
    pageNum = ctx2.pn.val;

    // --- Template 3: Opportunity Assessment ---
    doc.addPage();
    pageNum++;
    addWatermark(doc);
    addPageTab(doc, 'Template 3');
    const ctx3 = { tab: 'Template 3', pn: { val: pageNum } };
    y = addGreenTitle(doc, 24, `#${num} ${oppTitle} — 機會評估`);

    // 四象限 1–5 評分（含 AI-03 採納結果）+ 分級 + 要點。
    // 標題列連同四列評分一起預留（RATING_QUADRANTS.length*8），不被拆頁。
    {
      const ratings = opp.template3.ratings || {};
      y = addSectionBar(doc, y, '四象限評分（1–5）', ctx3, RATING_QUADRANTS.length * 8);
      for (const q of RATING_QUADRANTS) {
        y = addRatingRow(doc, y, q.label, ratings[q.key], q.color);
      }
      y += 3;
      if (opp.template3.ebitBand || opp.template3.cagrBand) {
        y = addField(doc, y, 'EBIT / CAGR 分級',
          [opp.template3.ebitBand && `EBIT：${opp.template3.ebitBand}`,
           opp.template3.cagrBand && `CAGR：${opp.template3.cagrBand}`]
            .filter(Boolean).join('　|　'), ctx3);
      }
      if (opp.template3.points) {
        y = addField(doc, y, '評估要點 Points', opp.template3.points, ctx3, CONTENT_W - 12);
      }
    }

    y = addBlock(doc, y, ctx3, '1. Size of the Prize — 市場規模', [
      { label: '市場規模 Market Size', value: opp.template3.marketSize },
      { label: '單價 Unit Price', value: opp.template3.unitPrice },
      { label: '競爭環境', value: opp.template3.competitiveEnvironment },
      { label: '前幾大品牌市佔', value: opp.template3.topBrandsShare },
    ]);
    y = addBlock(doc, y, ctx3, '2. Potential of Play — 發展潛力', [
      { label: '目前規模 Current Scale', value: opp.template3.currentScale },
      { label: 'CAGR', value: opp.template3.cagr },
      { label: 'EBIT Margin', value: opp.template3.ebitMargin },
    ]);
    y = addBlock(doc, y, ctx3, '3. Path to Achieve — 實現路徑', [
      { label: '所需投入 Required Investment', value: opp.template3.requiredInvestment, w: CONTENT_W - 12 },
      { label: '潛在障礙 Potential Hurdles', value: opp.template3.potentialHurdles, w: CONTENT_W - 12 },
    ]);
    y = addBlock(doc, y, ctx3, '4. Right to Win — 致勝優勢', [
      { label: '關鍵成功因素 Success Factors', value: opp.template3.successFactors, w: CONTENT_W - 12 },
      { label: '核心能力 Core Capabilities', value: opp.template3.coreCapabilities, w: CONTENT_W - 12 },
    ]);

    addPageNumber(doc, ctx3.pn.val);
    pageNum = ctx3.pn.val;
  });

  // ===== 工具分析洞察（AI-01 採納結果）=====
  {
    const codes = Object.keys(toolAnalyses || {})
      .filter((c) => {
        const a = toolAnalyses[c];
        return a && (
          (Array.isArray(a.insights) && a.insights.some(Boolean)) ||
          (Array.isArray(a.opportunitiesNote) && a.opportunitiesNote.some(Boolean))
        );
      })
      .sort((a, b) => Number(a) - Number(b));

    if (codes.length) {
      doc.addPage();
      pageNum++;
      addWatermark(doc);
      addPageTab(doc, '工具洞察');
      let y = addGreenTitle(doc, 24, '工具分析洞察 Tool Insights');
      const ctx = { tab: '工具洞察', pn: { val: pageNum } };

      for (const code of codes) {
        const a = toolAnalyses[code];
        const tid = Number(code);
        const toolTitle = Number.isFinite(tid) ? getToolName(tid) : String(code);
        const fields = [];
        (a.insights || []).filter(Boolean).forEach((s, i) => {
          fields.push({ label: `主要洞察 ${i + 1}`, value: aiText(s), w: CONTENT_W - 12 });
        });
        (a.opportunitiesNote || []).filter(Boolean).forEach((s, i) => {
          fields.push({ label: `衍生機會 ${i + 1}`, value: aiText(s), w: CONTENT_W - 12 });
        });
        y = addBlock(doc, y, ctx, toolTitle, fields);
        y += 3;
      }

      addPageNumber(doc, ctx.pn.val);
      pageNum = ctx.pn.val;
    }
  }

  // ===== Long-list 總表 =====
  doc.addPage();
  pageNum++;
  addWatermark(doc);
  addPageTab(doc, 'Long-list');
  let ty = addGreenTitle(doc, 24, 'Growth Opportunity Long-list');

  // Table header
  let y = ty + 2;
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 13, 1, 1, 'F');
  doc.setFont('NotoSansTC');
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.text('#', MARGIN + 4, y + 9);
  doc.text('AI 排序', MARGIN + 13, y + 9);
  doc.text('BCG Tools', MARGIN + 32, y + 9);
  doc.text('機會名稱', MARGIN + 74, y + 9);
  doc.text('成長槓桿', MARGIN + 166, y + 9);
  doc.text('成長維度', MARGIN + 216, y + 9);
  y += 13;

  opportunities.forEach((opp, idx) => {
    if (y > PAGE_H - 24) {
      doc.addPage();
      pageNum++;
      addWatermark(doc);
      addPageTab(doc, 'Long-list');
      addPageNumber(doc, pageNum);
      y = 24;
    }
    const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
    doc.setFillColor(...bg);
    doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
    // Left green accent for each row
    doc.setFillColor(...GREEN);
    doc.rect(MARGIN, y, 2.5, 12, 'F');

    doc.setFont('NotoSansTC');
    doc.setTextColor(...DARK_TEXT);
    doc.setFontSize(11);
    doc.text(String(idx + 1), MARGIN + 6, y + 8);
    doc.text(opp.rank != null ? `#${opp.rank}` : '—', MARGIN + 13, y + 8);
    doc.text(
      doc.splitTextToSize((opp.usedTools || []).join(', ') || '—', 38)[0],
      MARGIN + 32, y + 8
    );
    doc.text(
      doc.splitTextToSize(opp.opportunityName || '—', 88)[0],
      MARGIN + 74, y + 8
    );
    doc.text(
      doc.splitTextToSize(opp.template1.growthLever || '—', 48)[0],
      MARGIN + 166, y + 8
    );
    doc.text(
      doc.splitTextToSize(opp.template1.growthDimension || '—', 43)[0],
      MARGIN + 216, y + 8
    );
    y += 12;
  });

  addPageNumber(doc, pageNum);

  doc.save('BW_CEO_Growth_Opportunities.pdf');
}

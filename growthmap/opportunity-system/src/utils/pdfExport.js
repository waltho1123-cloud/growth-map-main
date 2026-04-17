import { BCG_TOOLS } from './constants';

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
  const tool = BCG_TOOLS.find((t) => t.id === id);
  return tool ? `${id}. ${tool.name}` : String(id);
}

// ---- Page break helper ----

function checkPageBreak(doc, y, neededHeight, tabLabel, pn) {
  if (y + neededHeight > PAGE_H - MARGIN) {
    addPageNumber(doc, pn.val);
    doc.addPage();
    pn.val++;
    addWatermark(doc);
    addPageTab(doc, tabLabel);
    return 26;
  }
  return y;
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

function addSectionBar(doc, y, title) {
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

function addField(doc, y, label, value, maxWidth) {
  doc.setFont('NotoSansTC');
  doc.setTextColor(...MID_GRAY);
  doc.setFontSize(10);
  doc.text(label, MARGIN + 6, y);
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(14);
  const w = maxWidth || CONTENT_W - 12;
  const lines = doc.splitTextToSize(value || '—', w);
  doc.text(lines, MARGIN + 6, y + 6);
  return y + 6 + lines.length * 6 + 4;
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

export async function exportToPdf(opportunities) {
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
    const pn1 = { val: pageNum };
    let y = addGreenTitle(doc, 24, `#${num} ${oppTitle} — 起點與洞察`);

    y = checkPageBreak(doc, y, 30, 'Template 1', pn1);
    y = addSectionBar(doc, y, 'BCG 工具');
    y = checkPageBreak(doc, y, 16, 'Template 1', pn1);
    y = addField(doc, y, '使用的 BCG Tools', opp.usedTools.map(getToolName).join(', '));

    y = checkPageBreak(doc, y, 30, 'Template 1', pn1);
    y = addSectionBar(doc, y, '企業定位');
    y = checkPageBreak(doc, y, 16, 'Template 1', pn1);
    y = addField(doc, y, '公司類型 Company Type', opp.template1.companyType);
    y = checkPageBreak(doc, y, 16, 'Template 1', pn1);
    y = addField(doc, y, '成長維度 Growth Dimension', opp.template1.growthDimension);
    y = checkPageBreak(doc, y, 16, 'Template 1', pn1);
    y = addField(doc, y, '成長槓桿 Growth Lever', opp.template1.growthLever);
    y = checkPageBreak(doc, y, 16, 'Template 1', pn1);
    y = addField(doc, y, '成長類型 Growth Type', (opp.template1.growthType || []).join(', '));

    y = checkPageBreak(doc, y, 30, 'Template 1', pn1);
    y = addSectionBar(doc, y, '關鍵洞察');
    y = checkPageBreak(doc, y, 16, 'Template 1', pn1);
    addField(doc, y, 'Key Insights', opp.template1.insights, CONTENT_W - 12);

    addPageNumber(doc, pn1.val);
    pageNum = pn1.val;

    // --- Template 2: Opportunity Details ---
    doc.addPage();
    pageNum++;
    addWatermark(doc);
    addPageTab(doc, 'Template 2');
    const pn2 = { val: pageNum };
    y = addGreenTitle(doc, 24, `#${num} ${oppTitle} — 機會詳情`);

    y = checkPageBreak(doc, y, 30, 'Template 2', pn2);
    y = addSectionBar(doc, y, '目標客戶與價值主張');
    y = checkPageBreak(doc, y, 16, 'Template 2', pn2);
    y = addField(doc, y, '目標客群 Target Customer', opp.template2.targetCustomer, CONTENT_W - 12);
    y = checkPageBreak(doc, y, 16, 'Template 2', pn2);
    y = addField(doc, y, '獨特賣點 USP', opp.template2.usp, CONTENT_W - 12);

    y = checkPageBreak(doc, y, 30, 'Template 2', pn2);
    y = addSectionBar(doc, y, '市場進入與實施');
    y = checkPageBreak(doc, y, 16, 'Template 2', pn2);
    y = addField(doc, y, '上市策略 Go-to-Market', opp.template2.goToMarketStrategy, CONTENT_W - 12);
    y = checkPageBreak(doc, y, 16, 'Template 2', pn2);
    addField(doc, y, '實施步驟 Implementation', opp.template2.implementationSteps, CONTENT_W - 12);

    addPageNumber(doc, pn2.val);
    pageNum = pn2.val;

    // --- Template 3: Opportunity Assessment ---
    doc.addPage();
    pageNum++;
    addWatermark(doc);
    addPageTab(doc, 'Template 3');
    const pn3 = { val: pageNum };
    y = addGreenTitle(doc, 24, `#${num} ${oppTitle} — 機會評估`);

    y = checkPageBreak(doc, y, 30, 'Template 3', pn3);
    y = addSectionBar(doc, y, '1. Size of the Prize — 市場規模');
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '市場規模 Market Size', opp.template3.marketSize);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '單價 Unit Price', opp.template3.unitPrice);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '競爭環境', opp.template3.competitiveEnvironment);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '前幾大品牌市佔', opp.template3.topBrandsShare);

    y = checkPageBreak(doc, y, 30, 'Template 3', pn3);
    y = addSectionBar(doc, y, '2. Potential of Play — 發展潛力');
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '目前規模 Current Scale', opp.template3.currentScale);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, 'CAGR', opp.template3.cagr);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, 'EBIT Margin', opp.template3.ebitMargin);

    y = checkPageBreak(doc, y, 30, 'Template 3', pn3);
    y = addSectionBar(doc, y, '3. Path to Achieve — 實現路徑');
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '所需投入 Required Investment', opp.template3.requiredInvestment, CONTENT_W - 12);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '潛在障礙 Potential Hurdles', opp.template3.potentialHurdles, CONTENT_W - 12);

    y = checkPageBreak(doc, y, 30, 'Template 3', pn3);
    y = addSectionBar(doc, y, '4. Right to Win — 致勝優勢');
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    y = addField(doc, y, '關鍵成功因素 Success Factors', opp.template3.successFactors, CONTENT_W - 12);
    y = checkPageBreak(doc, y, 16, 'Template 3', pn3);
    addField(doc, y, '核心能力 Core Capabilities', opp.template3.coreCapabilities, CONTENT_W - 12);

    addPageNumber(doc, pn3.val);
    pageNum = pn3.val;
  });

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
  doc.text('BCG Tools', MARGIN + 16, y + 9);
  doc.text('機會名稱', MARGIN + 70, y + 9);
  doc.text('成長槓桿', MARGIN + 160, y + 9);
  doc.text('成長維度', MARGIN + 215, y + 9);
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
    doc.text(opp.usedTools.join(', ') || '—', MARGIN + 16, y + 8);
    doc.text(
      doc.splitTextToSize(opp.opportunityName || '—', 85)[0],
      MARGIN + 70, y + 8
    );
    doc.text(
      doc.splitTextToSize(opp.template1.growthLever || '—', 50)[0],
      MARGIN + 160, y + 8
    );
    doc.text(
      doc.splitTextToSize(opp.template1.growthDimension || '—', 50)[0],
      MARGIN + 215, y + 8
    );
    y += 12;
  });

  addPageNumber(doc, pageNum);

  doc.save('BW_CEO_Growth_Opportunities.pdf');
}

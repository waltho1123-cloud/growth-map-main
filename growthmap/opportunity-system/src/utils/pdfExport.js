import { BCG_TOOLS } from './constants';

// A4 橫式 (landscape) 尺寸
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

function addHeader(doc, title, subtitle) {
  doc.setFillColor(16, 42, 67);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setFont('NotoSansTC');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(title, MARGIN, 14);
  doc.setFontSize(8);
  doc.setTextColor(188, 204, 220);
  doc.text(subtitle, PAGE_W - MARGIN, 14, { align: 'right' });
}

function addSectionTitle(doc, y, num, title) {
  doc.setFillColor(240, 244, 248);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, 'F');
  doc.setFont('NotoSansTC');
  doc.setTextColor(16, 42, 67);
  doc.setFontSize(9);
  doc.text(`${num}  ${title}`, MARGIN + 3, y + 5.5);
  return y + 12;
}

function addField(doc, y, label, value, maxWidth) {
  doc.setFont('NotoSansTC');
  doc.setTextColor(98, 125, 152);
  doc.setFontSize(7);
  doc.text(label, MARGIN + 3, y);
  doc.setTextColor(36, 59, 83);
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(value || '—', maxWidth || CONTENT_W - 6);
  doc.text(lines, MARGIN + 3, y + 4);
  return y + 4 + lines.length * 3.5 + 2;
}

export async function exportToPdf(opportunities) {
  const { default: jsPDF } = await import('jspdf');

  // Load CJK font (fetched once, cached in memory)
  const fontBase64 = await loadCJKFont();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerFont(doc, fontBase64);

  // ===== 封面 =====
  doc.setFillColor(16, 42, 67);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  doc.setFont('NotoSansTC');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('Growth Opportunities', PAGE_W / 2, PAGE_H / 2 - 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('202601 BW CEO Workshop - Class 3', PAGE_W / 2, PAGE_H / 2, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(188, 204, 220);
  doc.text(
    `Total: ${opportunities.length} opportunities | Generated: ${new Date().toLocaleDateString('zh-TW')}`,
    PAGE_W / 2, PAGE_H / 2 + 15, { align: 'center' }
  );

  // ===== 每個機會 3 頁 =====
  opportunities.forEach((opp, idx) => {
    const oppTitle = opp.opportunityName || `Opportunity ${idx + 1}`;
    const num = idx + 1;

    // --- 模板一 ---
    doc.addPage();
    addHeader(doc, `#${num} ${oppTitle}`, 'Template 1: Starting Point & Insights');
    let y = 30;
    y = addField(doc, y, 'BCG Tools Used', opp.usedTools.map(getToolName).join(', '));
    y = addField(doc, y, 'Company Type (companyType)', opp.template1.companyType);
    y = addField(doc, y, 'Growth Dimension (growthDimension)', opp.template1.growthDimension);
    y = addField(doc, y, 'Growth Lever (growthLever)', opp.template1.growthLever);
    y = addField(doc, y, 'Growth Type (growthType)', (opp.template1.growthType || []).join(', '));
    y = addField(doc, y, 'Key Insights', opp.template1.insights, CONTENT_W - 6);

    // --- 模板二 ---
    doc.addPage();
    addHeader(doc, `#${num} ${oppTitle}`, 'Template 2: Opportunity Details');
    y = 30;
    y = addField(doc, y, 'Target Customer (targetCustomer)', opp.template2.targetCustomer, CONTENT_W - 6);
    y = addField(doc, y, 'USP (usp)', opp.template2.usp, CONTENT_W - 6);
    y = addField(doc, y, 'Go-to-Market Strategy (goToMarketStrategy)', opp.template2.goToMarketStrategy, CONTENT_W - 6);
    y = addField(doc, y, 'Implementation Steps (implementationSteps)', opp.template2.implementationSteps, CONTENT_W - 6);

    // --- 模板三 ---
    doc.addPage();
    addHeader(doc, `#${num} ${oppTitle}`, 'Template 3: Opportunity Assessment');
    y = 30;
    y = addSectionTitle(doc, y, '1', 'Size of the Prize');
    y = addField(doc, y, 'Market Size (marketSize)', opp.template3.marketSize);
    y = addField(doc, y, 'Unit Price (unitPrice)', opp.template3.unitPrice);
    y = addField(doc, y, 'Competitive Environment (competitiveEnvironment)', opp.template3.competitiveEnvironment);
    y = addField(doc, y, 'Top Brands Share (topBrandsShare)', opp.template3.topBrandsShare);

    y = addSectionTitle(doc, y, '2', 'Potential of Play');
    y = addField(doc, y, 'Current Scale (currentScale)', opp.template3.currentScale);
    y = addField(doc, y, 'CAGR (cagr)', opp.template3.cagr);
    y = addField(doc, y, 'EBIT Margin (ebitMargin)', opp.template3.ebitMargin);

    y = addSectionTitle(doc, y, '3', 'Path to Achieve');
    y = addField(doc, y, 'Required Investment (requiredInvestment)', opp.template3.requiredInvestment, CONTENT_W / 2 - 6);
    y = addField(doc, y, 'Potential Hurdles (potentialHurdles)', opp.template3.potentialHurdles, CONTENT_W / 2 - 6);

    y = addSectionTitle(doc, y, '4', 'Right to Win');
    y = addField(doc, y, 'Success Factors (successFactors)', opp.template3.successFactors, CONTENT_W / 2 - 6);
    addField(doc, y, 'Core Capabilities (coreCapabilities)', opp.template3.coreCapabilities, CONTENT_W / 2 - 6);
  });

  // ===== Long-list 總表 =====
  doc.addPage();
  addHeader(doc, 'Growth Opportunity Long-list', `Total: ${opportunities.length}`);

  let y = 30;
  doc.setFillColor(16, 42, 67);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setFont('NotoSansTC');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text('#', MARGIN + 2, y + 5.5);
  doc.text('BCG Tools', MARGIN + 12, y + 5.5);
  doc.text('Opportunity Name', MARGIN + 60, y + 5.5);
  doc.text('Growth Lever', MARGIN + 150, y + 5.5);
  doc.text('Growth Dimension', MARGIN + 200, y + 5.5);
  y += 8;

  opportunities.forEach((opp, idx) => {
    if (y > PAGE_H - 20) {
      doc.addPage();
      addHeader(doc, 'Growth Opportunity Long-list (cont.)', '');
      y = 30;
    }
    const bg = idx % 2 === 0 ? [255, 255, 255] : [240, 244, 248];
    doc.setFillColor(...bg);
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
    doc.setFont('NotoSansTC');
    doc.setTextColor(36, 59, 83);
    doc.setFontSize(7);
    doc.text(String(idx + 1), MARGIN + 2, y + 5);
    doc.text(opp.usedTools.join(', ') || '—', MARGIN + 12, y + 5);
    doc.text(opp.opportunityName || '—', MARGIN + 60, y + 5);
    doc.text(opp.template1.growthLever || '—', MARGIN + 150, y + 5);
    doc.text(opp.template1.growthDimension || '—', MARGIN + 200, y + 5);
    y += 7;
  });

  doc.save('BW_CEO_Growth_Opportunities.pdf');
}

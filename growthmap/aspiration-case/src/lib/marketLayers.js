// TAM／SAM／SOM 與安索夫落地的判讀規則（講義《實作4-2以及複習》p21–24、p30–32、p34、p37）。
// 純函式、不碰 store，供 UI 顯示與日後測試共用。單位一律「億」。

export const MARKET_LAYERS = [
  {
    key: 'tam',
    code: 'TAM',
    name: '整體潛在市場',
    hint: '你的產品／服務究竟在滿足哪種需求？這種需求的總消費額（例：全球人口對「娛樂」的消費總額）',
    placeholder: '先用文字描述：這是什麼需求、誰在花錢、範圍多大…資料不足可寫「約為現況營收的 N 倍」',
  },
  {
    key: 'sam',
    code: 'SAM',
    name: '服務可觸及市場',
    hint: 'TAM 裡你的產品形態／地區／通路能觸及的部分（例：對「串流影音」的消費總額）',
    placeholder: '例：其中透過我們的產品形態與現有通路可觸及的部分…',
  },
  {
    key: 'som',
    code: 'SOM',
    name: '可獲得服務市場',
    hint: '考慮競爭對手份額後，能在 SAM 中獲取的總額',
    placeholder: '例：扣除前幾大品牌份額後，我們在可見未來可取得的部分…',
  },
];

// p31：選擇的賽道在可見的未來要有機會達到至少 20% 以上的市佔率；到不了就換賽道或重新定義與聚焦（p32）
export const SHARE_THRESHOLD = 20;

// 安索夫四格（p34）：既有／新 產品 × 既有／新 市場；「新商業模式」落在新產品 × 新市場的角落
export const ANSOFF_TAGS = {
  core: { product: '既有產品', market: '既有市場' },
  newProd: { product: '新產品', market: '既有市場' },
  newMarket: { product: '既有產品', market: '新市場' },
  newModel: { product: '新產品', market: '新市場' },
};

export const BUSINESS_MODEL_OPTIONS = [
  { value: 'existing', label: '原有商業模式', short: '原有' },
  { value: 'new', label: '新商業模式', short: '新' },
];

// 舊資料沒有 businessModel 時依維度推定：新商業模式列固定為「新」，其餘預設「原有」
export function effectiveBusinessModel(row) {
  if (row && (row.businessModel === 'existing' || row.businessModel === 'new')) return row.businessModel;
  return row && row.id === 'newModel' ? 'new' : 'existing';
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// TAM／SAM／SOM 的一致性與「先描述再估算」提醒（回傳訊息陣列，空陣列＝沒問題）
export function marketLayerWarnings(layers) {
  const w = [];
  const tam = (layers && layers.tam) || {};
  const sam = (layers && layers.sam) || {};
  const som = (layers && layers.som) || {};
  const t = num(tam.size);
  const s = num(sam.size);
  const o = num(som.size);
  if (t > 0 && !(tam.description || '').trim()) {
    w.push('請先用文字描述 TAM 是什麼需求、誰在花錢，再估規模（p24）；資料不足可用「現況的幾倍」描述。');
  }
  if (t > 0 && s > 0 && t === s) {
    w.push('TAM 與 SAM 相同——企業常把 SAM 當成 TAM。請回到「產品／服務究竟滿足哪種需求」重新思考 TAM（p21–22）。');
  }
  if (t > 0 && s > t) {
    w.push('SAM 大於 TAM：SAM 是 TAM 的子集合，請檢查定義或數字。');
  }
  if (s > 0 && o > s) {
    w.push('SOM 大於 SAM：SOM 是考慮競爭後能拿到的部分，不應超過 SAM。');
  }
  return w;
}

// 安索夫單列市佔率的 20% 門檻提醒；未填或 ≥ 門檻回 null
export function shareWarning(share) {
  const v = num(share);
  if (!(v > 0)) return null;
  if (v < SHARE_THRESHOLD) {
    return `市佔率 ${v}% 低於 ${SHARE_THRESHOLD}%：講義建議換賽道，或重新定義與聚焦（p31–32）`;
  }
  return null;
}

const fmt = (n) => Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 1 });

// 安索夫四格營收合計 vs SOM：合計超過 SOM 代表市佔假設過高或 SOM 定義有誤
export function somConsistency(subtotal, somSize) {
  const t = num(subtotal);
  const s = num(somSize);
  if (!(t > 0) || !(s > 0)) return null;
  if (t > s) {
    return { level: 'warn', message: `安索夫四格營收合計 ${fmt(t)} 億大於 SOM ${fmt(s)} 億：市佔率假設可能過高，或 SOM 需重新定義。` };
  }
  return { level: 'ok', message: `四格合計 ${fmt(t)} 億落在 SOM ${fmt(s)} 億內（占 ${Math.round((t / s) * 100)}%）。` };
}

export function pctOf(part, whole) {
  const p = num(part);
  const w = num(whole);
  if (!(w > 0)) return '—';
  return `${Math.round((p / w) * 100)}%`;
}

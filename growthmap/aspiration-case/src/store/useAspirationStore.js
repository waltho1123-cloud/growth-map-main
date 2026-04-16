import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const INITIAL_PART_A = [
  { id: 'core', category: '既有市場/產品', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
  { id: 'newProd', category: '新產品/服務', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
  { id: 'newMarket', category: '新市場/客戶', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
  { id: 'newModel', category: '新商業模式', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
];

const INITIAL_PART_C = [
  { categoryId: 'core', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
  { categoryId: 'newProd', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
  { categoryId: 'newMarket', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
  { categoryId: 'newModel', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
];

export const useAspirationStore = create(
  persist(
    (set, get) => ({
      companyInfo: {
        name: '',
        revenue2025: 0,
        naturalGrowth: { targetRevenue2028: 0, cagr: 0 },
        aspirationGrowth: { targetRevenue2028: 0, cagr: 0 },
      },
      partA: INITIAL_PART_A,
      partB: {
        targetTsr3Years: 0,
        contributions: { revenueGrowth: 0, ebitGrowth: 0, ebitMultiple: 0 },
        targets2028: { revenue: 0, ebitMargin: 0, ebitMultiple: 0 },
      },
      partC: INITIAL_PART_C,

      updateCompany: (field, value) => {
        const next = { ...get().companyInfo };
        const keys = field.split('.');
        if (keys.length === 1) {
          next[field] = value;
        } else {
          next[keys[0]] = { ...next[keys[0]], [keys[1]]: value };
        }
        set({ companyInfo: next });
      },

      updatePartA: (index, field, value) => {
        const next = [...get().partA];
        const row = { ...next[index], [field]: value };
        if (field === 'marketSize2028' || field === 'marketShare2028') {
          row.revenue2028 = row.marketSize2028 * (row.marketShare2028 / 100);
        }
        next[index] = row;
        set({ partA: next });
      },

      updatePartB: (section, field, value) => {
        const prev = get().partB;
        if (!section) {
          set({ partB: { ...prev, [field]: value } });
        } else {
          set({ partB: { ...prev, [section]: { ...prev[section], [field]: value } } });
        }
      },

      updatePartC: (index, field, value) => {
        const next = [...get().partC];
        if (field === 'breakthrough') {
          next[index] = { ...next[index], breakthrough: value };
        } else {
          next[index] = {
            ...next[index],
            bottlenecks: { ...next[index].bottlenecks, [field]: value },
          };
        }
        set({ partC: next });
      },

      // Used by cloud sync to apply a cloud snapshot in one atomic write.
      applySnapshot: (snap) => set(snap),
    }),
    { name: 'bw-growth-map-aspiration' }
  )
)

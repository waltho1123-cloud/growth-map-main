const STORAGE_KEY = 'bw-ceo-opportunities';

export function loadOpportunities() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveOpportunities(opportunities) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opportunities));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

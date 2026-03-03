/* ========================================
   Growth Blueprint Portal — 資料驅動渲染
   ======================================== */

(function () {
  'use strict';

  const REGISTRY_PATH = 'data/unit-registry.json';

  const STATUS_CONFIG = {
    'available':    { label: '可使用', icon: '' },
    'in-progress':  { label: '進行中', icon: '' },
    'completed':    { label: '已完成', icon: '\u2713' },
    'coming-soon':  { label: '即將推出', icon: '' },
    'locked':       { label: '已鎖定', icon: '\ud83d\udd12' },
  };

  const FOOTER_ACTION = {
    'available':    '開始使用',
    'in-progress':  '繼續進行',
    'completed':    '再次查看',
    'coming-soon':  '即將推出',
    'locked':       '需完成前置單元',
  };

  const REQUIRED_FIELDS = ['id', 'order', 'nameCn', 'nameEn', 'description', 'route', 'status'];

  // --- Helpers ---

  function validateUnit(unit, index) {
    for (const field of REQUIRED_FIELDS) {
      if (unit[field] == null || unit[field] === '') {
        console.warn(`[UnitRegistry] 單元索引 ${index} 缺少必填欄位「${field}」，已略過。`, unit);
        return false;
      }
    }
    if (!STATUS_CONFIG[unit.status]) {
      console.warn(`[UnitRegistry] 單元 ${unit.id} 的 status「${unit.status}」不在允許值內，已略過。`);
      return false;
    }
    return true;
  }

  function checkDuplicates(units) {
    const ids = new Set();
    const orders = new Set();
    for (const u of units) {
      if (ids.has(u.id)) console.warn(`[UnitRegistry] 重複 id: ${u.id}，以首次出現者為準。`);
      if (orders.has(u.order)) console.warn(`[UnitRegistry] 重複 order: ${u.order}，以首次出現者為準。`);
      ids.add(u.id);
      orders.add(u.order);
    }
  }

  function isClickable(status) {
    return status === 'available' || status === 'in-progress' || status === 'completed';
  }

  // --- Render Functions ---

  function renderHeader(metadata) {
    return `
      <header class="portal-header">
        <span class="portal-header__icon" aria-hidden="true">\ud83d\uddfa\ufe0f</span>
        <h1 class="portal-header__title">${metadata.title}</h1>
        <p class="portal-header__subtitle">${metadata.subtitle}</p>
        <p class="portal-header__description">${metadata.description}</p>
      </header>`;
  }

  function renderStatusBadge(status) {
    const cfg = STATUS_CONFIG[status];
    const icon = cfg.icon ? `<span>${cfg.icon}</span>` : '';
    return `<span class="status-badge status-badge--${status}">${icon}${cfg.label}</span>`;
  }

  function renderTags(tags) {
    if (!tags || tags.length === 0) return '';
    return `<div class="card-footer__tags">${tags.map(t => `<span class="card-footer__tag">${t}</span>`).join('')}</div>`;
  }

  function renderCard(unit) {
    const clickable = isClickable(unit.status);
    const tag = clickable ? 'a' : 'div';
    const href = clickable ? ` href="${unit.route}"` : '';
    const modifier = `unit-card--${unit.status}`;
    const ariaLabel = `${unit.nameCn} (${unit.nameEn}) — ${STATUS_CONFIG[unit.status].label}`;
    const tabindex = clickable ? '' : ' tabindex="-1"';
    const actionText = FOOTER_ACTION[unit.status];
    const arrow = clickable ? '<span class="card-footer__action-arrow" aria-hidden="true">\u2192</span>' : '';

    return `
      <${tag}${href} class="unit-card ${modifier}" aria-label="${ariaLabel}" role="article"${tabindex}>
        <div class="card-header">
          <div class="card-header__left">
            <span class="card-header__icon" aria-hidden="true">${unit.icon || ''}</span>
            <span class="card-header__order">\u55ae\u5143 ${unit.order}</span>
          </div>
          ${renderStatusBadge(unit.status)}
        </div>
        <div class="card-body">
          <h2 class="card-body__name-cn">${unit.nameCn}</h2>
          <p class="card-body__name-en">${unit.nameEn}</p>
          <p class="card-body__description">${unit.description}</p>
        </div>
        <div class="card-footer">
          <span class="card-footer__action">${actionText} ${arrow}</span>
          ${renderTags(unit.tags)}
        </div>
      </${tag}>`;
  }

  function renderCardGrid(units) {
    return `<div class="card-grid" role="list">${units.map(renderCard).join('')}</div>`;
  }

  function renderEmptyState() {
    return `
      <div class="empty-state">
        <span class="empty-state__icon" aria-hidden="true">\ud83d\udce6</span>
        <p class="empty-state__text">尚無可用單元</p>
      </div>`;
  }

  function renderErrorState(message) {
    return `
      <div class="error-state">
        <span class="error-state__icon" aria-hidden="true">\u26a0\ufe0f</span>
        <p class="error-state__text">${message}</p>
        <button class="error-state__retry" onclick="window.__portalInit()">重試</button>
      </div>`;
  }

  function renderFooter() {
    return `
      <footer class="portal-footer">
        <p>Growth Blueprint &copy; 2026 — 資料驅動，持續擴充</p>
      </footer>`;
  }

  // --- Main Init ---

  async function init() {
    const app = document.getElementById('app');
    if (!app) return;

    try {
      const res = await fetch(REGISTRY_PATH);
      if (!res.ok) throw new Error(`載入失敗 (HTTP ${res.status})`);
      const registry = await res.json();

      const metadata = registry.metadata || { title: '成長藍圖', subtitle: 'Growth Blueprint', description: '' };
      let units = Array.isArray(registry.units) ? registry.units : [];

      // Validate
      units = units.filter(validateUnit);
      checkDuplicates(units);

      // Sort by order ascending
      units.sort((a, b) => a.order - b.order);

      // Render
      let html = renderHeader(metadata);
      html += units.length > 0 ? renderCardGrid(units) : renderEmptyState();
      html += renderFooter();
      app.innerHTML = html;

    } catch (err) {
      console.error('[Portal] 資料載入錯誤：', err);
      app.innerHTML = renderErrorState('無法載入單元資料，請檢查網路連線或稍後重試。');
    }
  }

  window.__portalInit = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

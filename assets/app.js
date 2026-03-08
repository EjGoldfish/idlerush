// assets/app.js — IdleRush launcher
const grid    = document.getElementById('gamesGrid');
const search  = document.getElementById('search');
const sortSel = document.getElementById('sort');
const statsBar = document.getElementById('stats-bar');

let GAMES = [];

// ── Service worker registration ──────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ── Play count persistence ────────────────────────────────────
function getPlayCounts() {
  try { return JSON.parse(localStorage.getItem('ir_plays') || '{}'); } catch { return {}; }
}
function incrementPlay(id) {
  const counts = getPlayCounts();
  counts[id] = (counts[id] || 0) + 1;
  localStorage.setItem('ir_plays', JSON.stringify(counts));
  return counts[id];
}
function mergePlayCounts(games) {
  const counts = getPlayCounts();
  return games.map(g => ({ ...g, plays: counts[g.id] || g.plays || 0 }));
}

// ── Init ──────────────────────────────────────────────────────
init();

async function init() {
  const tag = document.getElementById('gamesManifest');
  if (tag) {
    try {
      GAMES = mergePlayCounts(JSON.parse(tag.textContent));
      render();
      return;
    } catch (e) {
      console.error('Inline manifest JSON error:', e);
      showError('Inline manifest is invalid JSON.');
      return;
    }
  }

  try {
    const res = await fetch('games/games.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('Manifest is not an array');
    GAMES = mergePlayCounts(list);
    render();
  } catch (err) {
    showError(`Couldn't load <code>games/games.json</code>: <b>${err.message}</b>`);
  }
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const q    = (search?.value || '').toLowerCase().trim();
  const sort = sortSel?.value || 'recent';

  let items = GAMES.filter(g =>
    !q ||
    g.title.toLowerCase().includes(q) ||
    (g.tags || []).join(' ').toLowerCase().includes(q)
  );

  if (sort === 'alpha')  items.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'plays') items.sort((a, b) => (b.plays || 0) - (a.plays || 0));
  else items.sort((a, b) => new Date(b.released || 0) - new Date(a.released || 0));

  // Stats bar
  const totalPlays = GAMES.reduce((s, g) => s + (g.plays || 0), 0);
  statsBar.innerHTML = `
    <span><strong>${GAMES.length}</strong> game${GAMES.length !== 1 ? 's' : ''}</span>
    <span><strong>${totalPlays.toLocaleString()}</strong> plays</span>
    ${q ? `<span>Showing <strong>${items.length}</strong> result${items.length !== 1 ? 's' : ''}</span>` : ''}
  `;

  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `<div class="error-card"><strong>No games found</strong>Try a different search term.</div>`;
    return;
  }

  for (const g of items) {
    const article = document.createElement('article');
    article.className = 'card game-card';

    const tagColors = (g.tags || []).map((t, i) => `<span class="tag${i > 0 ? ' blue' : ''}">${t}</span>`).join('');
    const thumbContent = g.thumbnail
      ? `<img class="game-thumb" src="${g.thumbnail}" alt="${g.title}" loading="lazy" />`
      : `<div class="game-thumb-placeholder">${g.title.toUpperCase()}</div>`;

    article.innerHTML = `
      <a href="${g.path}" class="game-thumb-wrap" aria-label="Play ${g.title}" data-id="${g.id}">
        ${thumbContent}
        <div class="play-overlay">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="25" fill="rgba(0,255,136,0.15)" stroke="#00ff88" stroke-width="1.5"/>
            <path d="M21 17l16 9-16 9V17z" fill="#00ff88"/>
          </svg>
        </div>
      </a>
      <div class="card-body">
        <div class="game-title">${g.title}</div>
        <div class="game-desc">${g.description || ''}</div>
        <div class="game-meta">
          <div class="tags">${tagColors}</div>
          <div class="plays-count">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2l7 4-7 4V2z" fill="currentColor"/></svg>
            ${(g.plays || 0).toLocaleString()}
          </div>
        </div>
        <div class="button-row">
          <a class="btn-primary" href="${g.path}" data-id="${g.id}">PLAY</a>
          <button class="btn-ghost" data-details="${g.id}">Details</button>
        </div>
      </div>`;

    // Track plays on any click-through to the game
    article.querySelectorAll('[data-id]').forEach(el => {
      if (el.tagName === 'A') {
        el.addEventListener('click', () => {
          const newCount = incrementPlay(g.id);
          // Update in-memory count too
          const game = GAMES.find(x => x.id === g.id);
          if (game) game.plays = newCount;
        });
      }
    });

    article.querySelector('[data-details]')?.addEventListener('click', () => showDetails(g));
    grid.appendChild(article);
  }
}

// ── Details modal ─────────────────────────────────────────────
function showDetails(g) {
  const tagColors = (g.tags || []).map((t, i) => `<span class="tag${i > 0 ? ' blue' : ''}">${t}</span>`).join('');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="${g.title} details">
      <div class="modal-title">${g.title}</div>
      <div class="modal-desc">${g.description || ''}</div>
      <div class="tags" style="margin-bottom:20px">${tagColors}</div>
      <div style="display:flex;gap:8px">
        <a class="btn-primary" href="${g.path}" data-id="${g.id}" style="flex:1">PLAY NOW</a>
        <button class="btn-ghost close-modal">Close</button>
      </div>
    </div>`;

  backdrop.querySelector('[data-id]')?.addEventListener('click', () => {
    const newCount = incrementPlay(g.id);
    const game = GAMES.find(x => x.id === g.id);
    if (game) game.plays = newCount;
  });
  backdrop.querySelector('.close-modal')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(backdrop);
}

function showError(msg) {
  grid.innerHTML = `<div class="error-card"><strong>Could not load games</strong><div>${msg}</div></div>`;
}

search?.addEventListener('input', render);
sortSel?.addEventListener('change', render);
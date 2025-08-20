// assets/app.js — launcher logic
const grid   = document.getElementById('gamesGrid');
const search = document.getElementById('search');
const sortSel= document.getElementById('sort');
let GAMES = [];

init();

async function init(){
  // 1) Try inline manifest first (works from file:// and hosted)
  const tag = document.getElementById('gamesManifest');
  if (tag) {
    try {
      GAMES = JSON.parse(tag.textContent);
      render();
      return;
    } catch (e) {
      console.error('Inline manifest JSON error:', e);
      showError('Inline manifest is invalid JSON.');
      return;
    }
  }

  // 2) Fallback: fetch games/games.json (works once hosted)
  try {
    const res = await fetch('games/games.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('Manifest is not an array');
    GAMES = list;
    render();
  } catch (err) {
    showError(`Couldn’t load <code>games/games.json</code>: <b>${err.message}</b>`);
  }
}

function showError(msg) {
  grid.innerHTML = `
    <article class="card">
      <div style="font-weight:700;margin-bottom:6px">No games found</div>
      <div class="muted">${msg}</div>
      <ol class="muted" style="margin-top:10px">
        <li>Add/validate inline manifest (recommended for file://), or</li>
        <li>Host the site so fetch works for <code>games/games.json</code>.</li>
      </ol>
    </article>`;
}

function render(){
  const q = (search?.value||'').toLowerCase().trim();
  const sort = sortSel?.value || 'recent';
  let items = GAMES.filter(g => !q || g.title.toLowerCase().includes(q) || (g.tags||[]).join(' ').toLowerCase().includes(q));

  if (sort === 'alpha') items.sort((a,b)=> a.title.localeCompare(b.title));
  else if (sort === 'plays') items.sort((a,b)=> (b.plays||0) - (a.plays||0));
  else items.sort((a,b)=> new Date(b.released||0) - new Date(a.released||0));

  grid.innerHTML = '';
  for(const g of items){
    const div = document.createElement('article');
    div.className = 'card game-card';
    const thumb = g.thumbnail || ('https://dummyimage.com/640x360/0b1026/ffffff&text='+encodeURIComponent(g.title));
    div.innerHTML = `
      <a class="game-thumb" href="${g.path}" style="background-image:url('${thumb}')" aria-label="Open ${g.title}"></a>
      <div class="game-title">${g.title}</div>
      <div class="muted">${g.description||''}</div>
      <div class="game-meta">
        <span class="tag">${(g.tags&&g.tags[0])||'Game'}</span>
        <span class="muted">${g.duration||''}</span>
      </div>
      <div class="button-row">
        <a class="primary" href="${g.path}">Play</a>
        <button class="ghost" data-id="${g.id}">Details</button>
      </div>`;
    div.querySelector('button[data-id]')?.addEventListener('click', ()=> showDetails(g));
    grid.appendChild(div);
  }
}

function showDetails(g){
  const html = `
  <div class="card" style="max-width:720px; margin:16px auto;">
    <div class="game-title" style="margin-bottom:8px">${g.title}</div>
    <div class="muted" style="margin-bottom:8px">${g.description||''}</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      ${(g.tags||[]).map(t=>`<span class='tag'>${t}</span>`).join('')}
    </div>
    <div style="margin-top:12px; display:flex; gap:8px;">
      <a class="primary" href="${g.path}">Play now</a>
      <button class="ghost" onclick="this.closest('.modal').remove()">Close</button>
    </div>
  </div>`;
  const modal = document.createElement('div');
  modal.className = 'modal';
  Object.assign(modal.style,{position:'fixed',inset:'0',display:'grid',placeItems:'center',background:'rgba(0,0,0,.55)',zIndex:50});
  modal.innerHTML = html;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

search?.addEventListener('input', render);
sortSel?.addEventListener('change', render);

/*
  =============================================
  ÁLBUM DE KARAOKÊ — LÓGICA
  ---------------------------------------------
  - Modularizado do arquivo original KaraokeSEMLYRICS.html
  - Implementa roteamento, busca, manipulação de fonte/contraste
  - Inclui correções de acessibilidade e estrutura
  =============================================
*/

// Utilitários
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => el.querySelectorAll(sel);

function slug(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s-]/g, "") // Remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-'); // Remove hífens duplicados
}

function groupBy(arr, fn) {
  return arr.reduce((acc, item)=>{ const k = fn(item); (acc[k] ||= []).push(item); return acc; }, {});
}

function escapeHTML(str='') {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

// Estado Global
const state = {
  songs: [],
  view: 'home', // 'home' ou 'song'
  currentId: null,
  fontScale: parseFloat(localStorage.getItem('karaoke.fontScale') || '1.15'),
  contrast: localStorage.getItem('karaoke.contrast') || 'normal',
};

// Carregamento de Dados
function loadSongs() {
  const dataEl = $('#songs-data');
  if (!dataEl) {
    console.error("Elemento #songs-data não encontrado.");
    return;
  }
  const embeddedData = JSON.parse(dataEl.textContent);
  state.songs = embeddedData.songs;

  // Carregar músicas salvas localmente (se houver)
  try {
    const localSongs = JSON.parse(localStorage.getItem('karaoke.songs') || '[]');
    // Adiciona músicas locais, sobrescrevendo se o ID for o mesmo
    const songMap = new Map(state.songs.map(s => [s.id, s]));
    localSongs.forEach(s => songMap.set(s.id, s));
    state.songs = Array.from(songMap.values());
  } catch (e) {
    console.error("Erro ao carregar músicas locais:", e);
  }

  // Ordenar por título
  state.songs.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}

// Roteamento
function navigate(hash) {
  const match = hash.match(/^#\/cancao\/([a-z0-9-]+)$/);
  if (match) {
    state.view = 'song';
    state.currentId = match[1];
  } else {
    state.view = 'home';
    state.currentId = null;
  }
  render();
}

// Renderização
function applyPrefs() {
  document.documentElement.style.setProperty('--font-scale', state.fontScale);
  document.body.setAttribute('data-contrast', state.contrast);
}

function renderHome() {
  const el = document.createElement('div');
  el.className = 'grid';
  
  // Agrupamento para índice por cantor
  const byArtist = groupBy(state.songs, s => s.artist);

  el.innerHTML = `
    <section class="card">
      <h1>Bem-vindo ao Álbum de Karaokê!</h1>
      <p>Use a busca ou os índices abaixo para encontrar sua música. Use os botões A+ e A- no cabeçalho para ajustar o tamanho da fonte.</p>
      <div class="toolbar">
        <button class="btn" id="btn-ir-indice">Ir para Índice de Músicas</button>
        <button class="btn secondary" id="btn-ir-cantores">Ir para Índice de Cantores</button>
      </div>
      <h2>Busca Rápida</h2>
      <input type="search" id="q" placeholder="Digite o título ou artista..." />
      <div id="resbusca" class="grid" style="margin-top:1rem"></div>
    </section>

    <section class="card">
      <h2 id="idx-musicas">Índice por música</h2>
      ${renderSongsTable(state.songs)}
    </section>

    <section class="card">
      <h2 id="idx-cantores">Índice por cantor</h2>
      ${renderArtists(byArtist)}
    </section>

    <section class="card">
      <details>
        <summary style="font-weight:800">Como adicionar músicas (opcional)</summary>
        <p>Você pode adicionar músicas diretamente neste álbum. Elas serão salvas apenas no seu navegador, ou seja, quando você fechar o navegador PERDERÁ o que adicionou. Use o botão "Contraste" no cabeçalho para exportar seu acervo.</p>
        <div class="grid two" style="margin-top:.5rem">
          <div>
            <label for="f-title">Título</label>
            <input id="f-title" type="text" />
          </div>
          <div>
            <label for="f-artist">Artista/Intérprete</label>
            <input id="f-artist" type="text" />
          </div>
          <div style="grid-column:1/-1">
            <label for="f-lyrics">Letra (use quebras de linha)</label>
            <textarea id="f-lyrics" rows="6" placeholder="Escreva a letra aqui…"></textarea>
          </div>
          <div>
            <button class="btn" id="f-add">Adicionar ao acervo local</button>
          </div>
        </div>
      </details>
    </section>
  `;

  // ligações
  $('#btn-ir-indice', el).addEventListener('click', ()=> {
    $('#idx-musicas').scrollIntoView({behavior:'smooth', block:'start'});
  });
  $('#btn-ir-cantores', el).addEventListener('click', ()=> {
    $('#idx-cantores').scrollIntoView({behavior:'smooth', block:'start'});
  });

  // busca
  const q = $('#q', el);
  const res = $('#resbusca', el);
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase();
    if (!term) { res.innerHTML=''; return; }
    const found = state.songs.filter(s =>
      s.title.toLowerCase().includes(term) || s.artist.toLowerCase().includes(term)
    ).slice(0, 10);
    res.innerHTML = found.map(s => songCard(s)).join('');
    // Delegação de clique
    $$('[data-goto]', res).forEach(a => a.addEventListener('click', (e)=>{
      e.preventDefault(); location.hash = `#/cancao/${a.dataset.goto}`;
    }));
  });

  // formulário de adição local
  $('#f-add', el)?.addEventListener('click', (e)=>{
    e.preventDefault();
    const title = $('#f-title', el).value.trim();
    const artist = $('#f-artist', el).value.trim();
    const lyrics = $('#f-lyrics', el).value.trim();
    if (!title || !artist || !lyrics) { alert('Preencha título, artista e letra.'); return; }
    const obj = { id: slug(`${title}-${artist}`), title, artist, lyrics, language: 'pt-BR', tags: [] };
    const curr = JSON.parse(localStorage.getItem('karaoke.songs') || '[]');
    // evita duplicata por id
    const idx = curr.findIndex(x => x.id === obj.id);
    if (idx >= 0) curr[idx] = obj; else curr.push(obj);
    localStorage.setItem('karaoke.songs', JSON.stringify(curr));
    loadSongs(); render();
    alert('Música salva localmente! (Use o botão "Contraste" no cabeçalho para exportar seu acervo)');
  });

  // ligações da tabela para navegação
  $$('[data-song-id]', el).forEach(a => a.addEventListener('click', (e)=>{
    e.preventDefault(); location.hash = `#/cancao/${a.getAttribute('data-song-id')}`;
  }));

  return el;
}

function songCard(s) {
  return `<a class="card" href="#/cancao/${s.id}" data-goto="${s.id}" style="display:block;text-decoration:none">
    <div style="display:flex;justify-content:space-between;gap:.2rem;align-items:baseline">
      <div style="font-weight:400">${escapeHTML(s.title)}</div>
      <div class="muted">${escapeHTML(s.artist)}</div>
    </div>
  </a>`;
}

function renderSongsTable(list) {
  const rows = list.map(s => `
    <tr>
      <td style="width:42%"><a href="#/cancao/${s.id}" data-song-id="${s.id}">${escapeHTML(s.title)}</a></td>
      <td style="width:42%">${escapeHTML(s.artist)}</td>
      <td class="muted">${(s.tags||[]).slice(0,3).join(', ')}</td>
    </tr>`).join('');
  return `
    <div class="card" role="region" aria-label="Índice de músicas">
      <table>
        <thead>
          <tr><th>Título</th><th>Artista</th><th>Tags</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderArtists(group) {
  const out = Object.keys(group).sort((a,b)=> a.localeCompare(b, 'pt-BR')).map(artist => {
    const items = group[artist].map(s => `<li><a href="#/cancao/${s.id}" data-song-id="${s.id}">${escapeHTML(s.title)}</a></li>`).join('');
    return `<details>
        <summary>${escapeHTML(artist)} <span class="muted">(${group[artist].length})</span></summary>
        <ul>${items}</ul>
      </details>`;
  }).join('');
  return `<div class="grid">${out}</div>`;
}

function renderSong(id) {
  const song = state.songs.find(s => s.id === id);
  if (!song) return document.createElement('div'); // Retorna vazio se não encontrar

  const idx = state.songs.findIndex(s => s.id === id);
  const prev = state.songs[idx-1] || null;
  const next = state.songs[idx+1] || null;

  const el = document.createElement('article');
  el.className = 'grid';
  
  // 5. Botões Anterior e Próximo antes do título da música
  const navButtons = `
    <div class="toolbar" style="margin:.5rem 0 1rem 0">
      ${prev ? `<a class="btn ghost" href="#/cancao/${prev.id}">⟵ Anterior</a>` : ''}
      ${next ? `<a class="btn ghost" href="#/cancao/${next.id}">Próxima ⟶</a>` : ''}
    </div>
  `;

/**/

  el.innerHTML = `
    <nav aria-label="Trilha" class="muted">
      <a href="#idx-musicas" id="lnk-voltar">← Voltar ao índice</a>
    </nav>
    <section class="card">
      ${navButtons}
      <h1 style="margin-top:0">${escapeHTML(song.title)}</h1>
      <p class="muted" style="margin-top:-.25rem">${escapeHTML(song.artist)}</p>
      <div class="lyrics" id="letra" aria-label="Letra da música" tabindex="0">${highlightFirstLines(song.lyrics)}</div>
    </section>
  `;

  el.querySelector('#lnk-voltar').addEventListener('click', (e)=>{ 
    e.preventDefault(); 
    location.hash = '#'; 
    // 6. Correção de rolagem para o topo
    window.scrollTo(0, 0);
  });

  // 6. Correção de rolagem para o topo ao navegar entre músicas
  $$('.btn.ghost', el).forEach(btn => {
    btn.addEventListener('click', () => {
      window.scrollTo(0, 0);
    });
  });

  return el;
}

function highlightFirstLines(text) {
  // Destaca o primeiro verso para foco visual
  const trimmed = (text || '').replace(/^\n+/, '');
  const idx = trimmed.indexOf('\n\n'); // primeiro parágrafo
  if (idx === -1) return `<p class="highlight">${escapeHTML(trimmed)}</p>`;
  const first = trimmed.slice(0, idx);
  const rest = trimmed.slice(idx+2);
  return `<p class="highlight">${escapeHTML(first)}</p>\n\n${escapeHTML(rest)}`
    .replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
}

// Render raiz
function render() {
  applyPrefs();
  const root = $('#conteudo');
  root.innerHTML = '';
  if (state.view === 'song' && state.currentId) {
    root.appendChild(renderSong(state.currentId));
    // 6. Correção de rolagem para o topo ao abrir a música
    window.scrollTo(0, 0);
  }
  else root.appendChild(renderHome());
  // acessibilidade: foca o main para leitores de tela
  root.focus();
}

// Eventos globais ---------------------------------------------
$('#btn-home').addEventListener('click', ()=> { location.hash = '#'; });

$('#btn-menor').addEventListener('click', ()=> { changeFont(-.08); });
$('#btn-maior').addEventListener('click', ()=> { changeFont(+.08); });
$('#btn-contraste').addEventListener('click', toggleContrast);

// Remoção de botões não utilizados (Aleatória, Config, Tela Cheia)

function changeFont(delta) {
  // Limites de fonte: 0.8 (menor) a 2.0 (maior)
  state.fontScale = Math.max(.8, Math.min(2.0, state.fontScale + delta));
  localStorage.setItem('karaoke.fontScale', String(state.fontScale));
  applyPrefs();
}

function toggleContrast() {
  state.contrast = (state.contrast === 'high' ? 'normal' : 'high');
  localStorage.setItem('karaoke.contrast', state.contrast);
  applyPrefs();
}

function exportJSON() {
  const data = { songs: state.songs };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'karaoke-acervo.json'; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

// Atalhos de teclado acessíveis
window.addEventListener('keydown', (e)=>{
  if (e.key === '+') { changeFont(+.08); }
  if (e.key === '-') { changeFont(-.08); }
  if (e.key.toLowerCase() === 'h') { toggleContrast(); }
  if (e.key === 'Escape') { location.hash = '#'; }
});

// Inicialização
window.addEventListener('hashchange', ()=> navigate(location.hash));
loadSongs(); navigate(location.hash || '#');


$('#btn-contraste').addEventListener('click', toggleContrast);

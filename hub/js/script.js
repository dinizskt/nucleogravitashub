/* ------------------------------------------------------------------
   Lógica de render e navegação do Hub. Os dados ficam em data.js.
   As demais seções (mecanismos, headlines, calculadora etc.) ainda
   não estão ligadas ao HTML — aparecem como "Em breve". A lógica delas
   fica pronta em data.js para quando forem habilitadas.
------------------------------------------------------------------- */

const STATUS_LABEL = { ativa: "Ativa", testando: "Em teste", pausada: "Pausada" };
const STARS = (n) => "★".repeat(n) + "☆".repeat(5 - n);

/* ============================== NAVEGAÇÃO ============================== */
const links = document.querySelectorAll(".sidenav__link");
const panels = document.querySelectorAll(".panel");

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="12" y1="16" x2="12.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
};
links.forEach((l) => {
  const path = ICONS[l.dataset.icon];
  if (path) {
    l.insertAdjacentHTML(
      "afterbegin",
      `<svg class="sidenav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
    );
  }
});

function showSection(name) {
  panels.forEach((p) => (p.hidden = p.id !== `panel-${name}`));
  links.forEach((l) => l.classList.toggle("active", l.dataset.section === name));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (name === "home") renderChart();
}

function goTo(name) {
  showSection(name);
  history.replaceState(null, "", `#${name}`);
  document.body.classList.remove("nav-open");
}

const mobileMq = window.matchMedia("(max-width: 900px)");

function toggleSidebar() {
  document.body.classList.toggle(mobileMq.matches ? "nav-open" : "nav-collapsed");
}

document.getElementById("sidebar-toggle").addEventListener("click", toggleSidebar);
document.getElementById("sidebar-backdrop").addEventListener("click", () => document.body.classList.remove("nav-open"));

links.forEach((l) => l.addEventListener("click", () => goTo(l.dataset.section)));

/* ============================== BANCO DE OFERTAS ============================== */
const grid = document.getElementById("grid");
const searchInput = document.getElementById("search-input");
const filtersEl = document.getElementById("filters");
const statAtivas = document.getElementById("stat-ativas");
const statTotal = document.getElementById("stat-total");

let activeFiltro = "todas";
let query = "";

function nichos() {
  return ["todas", ...new Set(OFERTAS.map((o) => o.nicho))];
}

function renderFiltros() {
  filtersEl.innerHTML = nichos()
    .map(
      (n) =>
        `<button class="filter${n === activeFiltro ? " active" : ""}" data-filtro="${n}">${
          n === "todas" ? "Todas" : n
        }</button>`
    )
    .join("");
}

function renderStats() {
  statTotal.textContent = OFERTAS.length;
  statAtivas.textContent = OFERTAS.filter((o) => o.status === "ativa").length;
}

function cardHTML(o) {
  return `
    <article class="card">
      <div class="card__top">
        <span class="card__niche">${o.nicho}</span>
        <span class="status status--${o.status}"><span class="status__dot"></span>${STATUS_LABEL[o.status] || o.status}</span>
      </div>
      <h3 class="card__title">${o.titulo}</h3>
      ${o.linkCheck && o.linkCheck.status !== "ok" ? `<div class="link-alert link-alert--${o.linkCheck.status}"><strong>${o.linkCheck.status === "inativo" ? "⚠ Link fora do ar" : o.linkCheck.status === "mudou" ? "⚠ Página mudou de conteúdo" : "◌ Link não verificável"}</strong> — ${o.linkCheck.nota}<span class="link-alert__hint">Isso não invalida a oferta: a concepção, o mecanismo e a promessa abaixo continuam podendo ser modelados normalmente. O anunciante pode ter pausado por orçamento, sazonalidade ou trocado de link — não necessariamente porque parou de vender.</span></div>` : ""}
      <div class="card__row">
        <span class="card__label">Produto</span>
        <span class="card__value">${o.produto}</span>
      </div>
      <div class="card__row">
        <span class="card__label">Público-alvo</span>
        <span class="card__value">${o.publico}</span>
      </div>
      <div class="card__row">
        <span class="card__label">Promessa</span>
        <span class="card__value">${o.promessa}</span>
      </div>
      <div class="card__row">
        <span class="card__label">Mecanismo</span>
        <span class="card__value">${o.mecanismo}</span>
      </div>
      <div class="card__meta">
        <div class="card__meta-item"><span class="card__label">Preço</span><span class="card__value">${o.preco}</span></div>
        <div class="card__meta-item"><span class="card__label">Plataforma</span><span class="card__value">${o.plataforma}</span></div>
        <div class="card__meta-item"><span class="card__label">Dificuldade</span><span class="card__value">${o.dificuldade}</span></div>
        <div class="card__meta-item"><span class="card__label">Escala</span><span class="card__value">${o.escala}</span></div>
        <div class="card__meta-item"><span class="card__label">Minerado em</span><span class="card__value">${o.dataMineracao}</span></div>
      </div>
      <div class="card__nota">
        <div class="card__nota-row"><span>Demanda</span><div class="bar"><div class="bar__fill" style="width:${o.nota.demanda * 10}%"></div></div><span>${o.nota.demanda}/10</span></div>
        <div class="card__nota-row"><span>Fácil produzir</span><div class="bar"><div class="bar__fill" style="width:${o.nota.producao * 10}%"></div></div><span>${o.nota.producao}/10</span></div>
        <div class="card__nota-row"><span>Fácil anunciar</span><div class="bar"><div class="bar__fill" style="width:${o.nota.anunciar * 10}%"></div></div><span>${o.nota.anunciar}/10</span></div>
        <div class="card__nota-row card__nota-row--flat"><span>Concorrência</span><span class="tag tag--${o.nota.concorrencia}">${o.nota.concorrencia}</span></div>
        <div class="card__nota-row card__nota-row--flat"><span>Potencial geral</span><span class="stars">${STARS(o.nota.potencial)}</span></div>
        ${o.nota.pesquisaWeb ? `<p class="card__pesquisa"><span class="card__label">Pesquisa na web</span> ${o.nota.pesquisaWeb}</p>` : ""}
      </div>
      <details class="card__why">
        <summary>Por que essa oferta vende?</summary>
        <ul>
          <li><strong>Dor:</strong> ${o.porQueVende.dor}</li>
          <li><strong>Desejo:</strong> ${o.porQueVende.desejo}</li>
          <li><strong>Mecanismo:</strong> ${o.porQueVende.mecanismo}</li>
          <li><strong>Ângulo:</strong> ${o.porQueVende.angulo}</li>
          <li><strong>Por que agora:</strong> ${o.porQueVende.agora}</li>
        </ul>
      </details>
      <details class="card__why">
        <summary>Ideia de diferenciação</summary>
        <p>${o.diferenciacao}</p>
      </details>
      <div class="card__footer">
        <a class="btn btn--primary btn--sm" href="${o.link}" target="_blank" rel="noopener">Ver página de vendas <span class="arrow">→</span></a>
      </div>
    </article>
  `;
}

function renderOfertas() {
  const q = query.trim().toLowerCase();
  const filtradas = OFERTAS.filter((o) => {
    const matchFiltro = activeFiltro === "todas" || o.nicho === activeFiltro;
    const matchQuery =
      !q ||
      o.titulo.toLowerCase().includes(q) ||
      o.nicho.toLowerCase().includes(q) ||
      o.publico.toLowerCase().includes(q);
    return matchFiltro && matchQuery;
  });

  if (!filtradas.length) {
    grid.innerHTML = `<div class="empty"><strong>Nenhuma oferta encontrada</strong>Tente outro termo de busca ou filtro.</div>`;
    return;
  }

  const ordem = [];
  const grupos = {};
  filtradas.forEach((o) => {
    if (!grupos[o.nicho]) {
      grupos[o.nicho] = [];
      ordem.push(o.nicho);
    }
    grupos[o.nicho].push(o);
  });

  grid.innerHTML = ordem
    .map(
      (nicho) => `
        <div class="nicho-group">
          <h2 class="nicho-group__title">${nicho} <span class="nicho-group__count">${grupos[nicho].length}</span></h2>
          <div class="nicho-group__grid">${grupos[nicho].map(cardHTML).join("")}</div>
        </div>
      `
    )
    .join("");
}

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  activeFiltro = btn.dataset.filtro;
  renderFiltros();
  renderOfertas();
});
searchInput.addEventListener("input", (e) => {
  query = e.target.value;
  renderOfertas();
});

renderFiltros();
renderStats();
renderOfertas();

/* ============================== FRAMEWORKS ============================== */
function frameworkCardHTML(f, i) {
  return `
    <article class="framework-card" data-index="${i}">
      <div class="framework-card__thumb">
        <img src="${f.imagem}" alt="${f.titulo}" loading="lazy">
      </div>
      <div class="framework-card__body">
        ${f.categoria ? `<span class="card__niche">${f.categoria}</span>` : ""}
        <h3 class="framework-card__title">${f.titulo}</h3>
        ${f.descricao ? `<p class="framework-card__desc">${f.descricao}</p>` : ""}
        <a class="btn btn--primary btn--sm" href="${f.arquivo || f.imagem}" download>Baixar framework <span class="arrow">→</span></a>
      </div>
    </article>
  `;
}

function renderFrameworks() {
  const grid = document.getElementById("frameworks-grid");
  if (!grid) return;
  if (!FRAMEWORKS.length) {
    grid.innerHTML = `<div class="empty"><strong>Nenhum framework publicado ainda</strong>Assim que os frameworks forem adicionados, eles aparecem aqui automaticamente.</div>`;
    return;
  }
  grid.innerHTML = FRAMEWORKS.map(frameworkCardHTML).join("");
}
renderFrameworks();

/* ---- Modal de visualização (estilo galeria) ---- */
const fwModal = document.getElementById("fw-modal");
const fwModalImg = document.getElementById("fw-modal-img");
const fwModalTitle = document.getElementById("fw-modal-title");
const fwModalCategoria = document.getElementById("fw-modal-categoria");
const fwModalDesc = document.getElementById("fw-modal-desc");
const fwModalDownload = document.getElementById("fw-modal-download");

function openFrameworkModal(f) {
  fwModalImg.src = f.imagem;
  fwModalImg.alt = f.titulo;
  fwModalTitle.textContent = f.titulo;
  fwModalCategoria.textContent = f.categoria || "";
  fwModalDesc.textContent = f.descricao || "";
  fwModalDownload.href = f.arquivo || f.imagem;
  fwModal.hidden = false;
  document.body.classList.add("no-scroll");
}

function closeFrameworkModal() {
  fwModal.hidden = true;
  fwModalImg.src = "";
  document.body.classList.remove("no-scroll");
}

const frameworksGrid = document.getElementById("frameworks-grid");
if (frameworksGrid) {
  frameworksGrid.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const card = e.target.closest(".framework-card");
    if (!card) return;
    const f = FRAMEWORKS[Number(card.dataset.index)];
    if (f) openFrameworkModal(f);
  });
}

if (fwModal) {
  fwModal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeFrameworkModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !fwModal.hidden) closeFrameworkModal();
  });
}

/* ============================== VISÃO GERAL ============================== */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const parseData = (s) => {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, m - 1, d);
};
const fmtCurta = (dt) => `${String(dt.getDate()).padStart(2, "0")} ${MESES[dt.getMonth()]}`;
const fmtLonga = (dt) => `${dt.getDate()} ${MESES[dt.getMonth()]} ${dt.getFullYear()}`;
const numPt = (n) => n.toFixed(1).replace(".", ",");

let nicheSort = "ofertas";
let chartRange = "all";
let chartState = null;

function renderHomeStats() {
  const total = OFERTAS.length;
  const ativas = OFERTAS.filter((o) => o.status === "ativa").length;
  const teste = OFERTAS.filter((o) => o.status === "testando").length;
  document.getElementById("home-total").textContent = total;
  document.getElementById("home-split").innerHTML =
    `<span class="a" style="width:${(ativas / total) * 100}%"></span><span class="t" style="width:${(teste / total) * 100}%"></span>`;
  document.getElementById("home-legend").innerHTML =
    `<span><i class="a"></i>${ativas} ativas</span><span><i class="t"></i>${teste} em teste</span>`;
  const ultima = OFERTAS.reduce((max, o) => (parseData(o.dataMineracao) > max ? parseData(o.dataMineracao) : max), new Date(0));
  const novas = OFERTAS.filter((o) => parseData(o.dataMineracao).getTime() === ultima.getTime()).length;
  document.getElementById("home-delta").textContent = `+${novas} em ${fmtCurta(ultima)}`;
}

function renderNiches() {
  const map = {};
  OFERTAS.forEach((o) => {
    const n = map[o.nicho] || (map[o.nicho] = { nome: o.nicho, total: 0, ativas: 0, pot: 0 });
    n.total++;
    if (o.status === "ativa") n.ativas++;
    n.pot += o.nota.potencial;
  });
  let lista = Object.values(map).map((n) => ({ ...n, potMedio: n.pot / n.total }));
  if (nicheSort === "ativas") lista.sort((a, b) => b.ativas - a.ativas || b.total - a.total);
  else if (nicheSort === "potencial") lista = lista.filter((n) => n.total >= 2).sort((a, b) => b.potMedio - a.potMedio || b.total - a.total);
  else lista.sort((a, b) => b.total - a.total || b.ativas - a.ativas);
  document.getElementById("niche-rows").innerHTML = lista
    .slice(0, 5)
    .map((n) => {
      const num = nicheSort === "ativas" ? n.ativas : nicheSort === "potencial" ? numPt(n.potMedio) : n.total;
      const delta = nicheSort === "ativas" ? `de ${n.total}` : nicheSort === "potencial" ? "de 5" : `${n.ativas} ativas`;
      return `<button class="row" type="button" data-nicho="${esc(n.nome)}">
        <span class="row__mono">${esc(n.nome[0])}</span>
        <span class="row__main"><span class="row__name">${esc(n.nome)}</span><span class="row__sub">${n.ativas} ativas de ${n.total}</span></span>
        <span class="row__val"><span class="row__num">${num}</span><span class="row__delta${nicheSort === "ofertas" ? "" : " row__delta--mute"}">${delta}</span></span>
      </button>`;
    })
    .join("");
}

function renderRecent() {
  const recentes = OFERTAS.map((o, i) => ({ o, i, t: parseData(o.dataMineracao) }))
    .sort((a, b) => b.t - a.t || b.i - a.i)
    .slice(0, 4);
  document.getElementById("recent-minis").innerHTML = recentes
    .map(
      ({ o, t }) => `<button class="mini" type="button" data-titulo="${esc(o.titulo)}">
        <span class="mini__nicho">${esc(o.nicho)}</span>
        <span class="mini__title">${esc(o.titulo)}</span>
        <span class="mini__foot"><span class="status status--${o.status}"><span class="status__dot"></span>${STATUS_LABEL[o.status] || o.status}</span><span>${fmtCurta(t)}</span></span>
      </button>`
    )
    .join("");
}

function chartPoints() {
  const porData = {};
  OFERTAS.forEach((o) => (porData[o.dataMineracao] = (porData[o.dataMineracao] || 0) + 1));
  let acc = 0;
  const pts = Object.keys(porData)
    .map((k) => ({ t: parseData(k), c: porData[k] }))
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ t: p.t, c: p.c, total: (acc += p.c) }));
  if (chartRange === "all") return pts;
  const fim = pts[pts.length - 1].t;
  const ini = new Date(fim.getTime() - Number(chartRange) * 86400000);
  const antes = pts.filter((p) => p.t < ini);
  const dentro = pts.filter((p) => p.t >= ini);
  return [{ t: ini, c: 0, total: antes.length ? antes[antes.length - 1].total : 0, base: true }, ...dentro];
}

function renderChart() {
  const wrap = document.getElementById("chart-wrap");
  if (!wrap || !wrap.clientWidth) return;
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  const pts = chartPoints();
  const m = { l: 46, r: 20, t: 18, b: 32 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const topo = Math.ceil((Math.max(...pts.map((p) => p.total)) * 1.18) / 20) * 20 || 20;
  const t0 = pts[0].t.getTime();
  const t1 = pts[pts.length - 1].t.getTime();
  const X = (t) => m.l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const Y = (v) => m.t + ih - (v / topo) * ih;
  const xy = pts.map((p) => [X(p.t.getTime()), Y(p.total)]);

  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1];
    const [x1, y1] = xy[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${xy[xy.length - 1][0]},${m.t + ih} L${xy[0][0]},${m.t + ih} Z`;

  const grade = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const v = Math.round(topo * f);
      return `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,0.05)"/><text x="${m.l - 12}" y="${Y(v) + 4}" text-anchor="end" fill="#716a82" font-size="11">${v}</text>`;
    })
    .join("");

  let ultimoX = -999;
  const rotulos = pts
    .map((p, i) => {
      if (xy[i][0] - ultimoX < 62) return "";
      ultimoX = xy[i][0];
      return `<text x="${xy[i][0]}" y="${H - 8}" text-anchor="middle" fill="#716a82" font-size="11">${fmtCurta(p.t)}</text>`;
    })
    .join("");

  const pontos = xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#0b0811" stroke="#a875ee" stroke-width="1.5"/>`).join("");

  const antigo = wrap.querySelector("svg");
  if (antigo) antigo.remove();
  wrap.insertAdjacentHTML(
    "afterbegin",
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs>
        <linearGradient id="cg-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a875ee" stop-opacity="0.38"/><stop offset="100%" stop-color="#7a35d1" stop-opacity="0"/></linearGradient>
        <linearGradient id="cg-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8a55d6"/><stop offset="100%" stop-color="#d3bbf5"/></linearGradient>
        <radialGradient id="cg-glow"><stop offset="0%" stop-color="#e9d9ff" stop-opacity="0.9"/><stop offset="100%" stop-color="#a875ee" stop-opacity="0"/></radialGradient>
      </defs>
      ${grade}
      <path d="${area}" fill="url(#cg-area)"/>
      <path d="${d}" fill="none" stroke="url(#cg-line)" stroke-width="2.2" stroke-linecap="round"/>
      ${pontos}${rotulos}
      <g id="chart-marker">
        <line id="cm-line" y1="${m.t}" y2="${m.t + ih}" stroke="rgba(255,255,255,0.22)" stroke-dasharray="4 5"/>
        <circle id="cm-glow" r="14" fill="url(#cg-glow)"/>
        <circle id="cm-dot" r="5" fill="#f1e6ff" stroke="#a875ee" stroke-width="2"/>
      </g>
    </svg>`
  );
  chartState = { pts, xy, W };
  marcarPonto(pts.length - 1);
}

function marcarPonto(i) {
  if (!chartState) return;
  const { pts, xy, W } = chartState;
  const [x, y] = xy[i];
  const svg = document.querySelector("#chart-wrap svg");
  svg.querySelector("#cm-line").setAttribute("x1", x);
  svg.querySelector("#cm-line").setAttribute("x2", x);
  svg.querySelector("#cm-glow").setAttribute("cx", x);
  svg.querySelector("#cm-glow").setAttribute("cy", y);
  svg.querySelector("#cm-dot").setAttribute("cx", x);
  svg.querySelector("#cm-dot").setAttribute("cy", y);
  const p = pts[i];
  const tip = document.getElementById("chart-tip");
  tip.innerHTML = `<small>${fmtLonga(p.t)}</small><strong>${p.total} ofertas</strong>${p.c ? `<span class="chip chip--up">+${p.c}</span>` : ""}`;
  tip.style.left = `${Math.min(Math.max(x, 84), W - 84)}px`;
  tip.style.top = `${y}px`;
  tip.style.transform = y < 110 ? "translate(-50%, 20px)" : "translate(-50%, calc(-100% - 16px))";
  tip.classList.add("on");
}

const chartWrap = document.getElementById("chart-wrap");
chartWrap.addEventListener("mousemove", (e) => {
  if (!chartState) return;
  const x = e.clientX - chartWrap.getBoundingClientRect().left;
  let melhor = 0;
  chartState.xy.forEach(([px], i) => {
    if (Math.abs(px - x) < Math.abs(chartState.xy[melhor][0] - x)) melhor = i;
  });
  marcarPonto(melhor);
});
chartWrap.addEventListener("mouseleave", () => chartState && marcarPonto(chartState.pts.length - 1));

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!document.getElementById("panel-home").hidden) renderChart();
  }, 120);
});

function abrirOfertas({ nicho = "todas", busca = "" } = {}) {
  activeFiltro = nicho;
  query = busca;
  searchInput.value = busca;
  renderFiltros();
  renderOfertas();
  goTo("ofertas");
}

document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) return goTo(go.dataset.go);
  const nicho = e.target.closest("[data-nicho]");
  if (nicho) return abrirOfertas({ nicho: nicho.dataset.nicho });
  const titulo = e.target.closest("[data-titulo]");
  if (titulo) return abrirOfertas({ busca: titulo.dataset.titulo });
  const sort = e.target.closest("[data-sort]");
  if (sort) {
    nicheSort = sort.dataset.sort;
    document.querySelectorAll("#niche-tabs .tab").forEach((t) => t.classList.toggle("active", t === sort));
    return renderNiches();
  }
  const range = e.target.closest("[data-range]");
  if (range) {
    chartRange = range.dataset.range;
    document.querySelectorAll("#chart-tabs .tab").forEach((t) => t.classList.toggle("active", t === range));
    renderChart();
  }
});

document.getElementById("home-search").addEventListener("submit", (e) => {
  e.preventDefault();
  abrirOfertas({ busca: document.getElementById("home-search-input").value });
});

renderHomeStats();
renderNiches();
renderRecent();

const secaoInicial = location.hash.replace("#", "");
showSection(secaoInicial && document.getElementById(`panel-${secaoInicial}`) ? secaoInicial : "home");

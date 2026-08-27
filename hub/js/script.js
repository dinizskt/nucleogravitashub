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

function showSection(name) {
  panels.forEach((p) => (p.hidden = p.id !== `panel-${name}`));
  links.forEach((l) => l.classList.toggle("active", l.dataset.section === name));
  window.scrollTo({ top: 0, behavior: "instant" });
}

links.forEach((l) =>
  l.addEventListener("click", () => {
    showSection(l.dataset.section);
    history.replaceState(null, "", `#${l.dataset.section}`);
  })
);

const initial = location.hash.replace("#", "");
if (initial && document.getElementById(`panel-${initial}`)) showSection(initial);

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
      ${o.linkCheck && o.linkCheck.status !== "ok" ? `<div class="link-alert link-alert--${o.linkCheck.status}">${o.linkCheck.status === "inativo" ? "⚠ Link fora do ar" : o.linkCheck.status === "mudou" ? "⚠ Página mudou de conteúdo" : "◌ Link não verificável"} — ${o.linkCheck.nota}</div>` : ""}
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

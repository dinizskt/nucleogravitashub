import { normalizeEmail } from "./email.js";

// Ofertas enviadas pelos alunos: ficam pendentes até o admin aprovar.
// Quem chega aqui já passou pelo login e pela lista de alunos (ver index.js).

const CORPO_MAX = 8 * 1024;
const PENDENTES_NA_TELA = 100;
const LINK_MAX = 1000;
const ID_OK = /^[A-Za-z0-9_-]{8,32}$/;

const CAMPOS = {
  titulo: { max: 120, obrigatorio: true, nome: "nome da oferta" },
  nicho: { max: 60, obrigatorio: true, nome: "nicho" },
  produto: { max: 300, obrigatorio: true, nome: "o que é vendido" },
  publico: { max: 300, obrigatorio: true, nome: "para quem é" },
  promessa: { max: 400, obrigatorio: true, nome: "promessa" },
  preco: { max: 60, obrigatorio: true, nome: "preço" },
  observacao: { max: 600, obrigatorio: false, nome: "por que vale olhar" },
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const erro = (mensagem, status) => json({ erro: mensagem }, status);

const novoId = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const hojeBrasilia = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

function ehAdmin(env, email) {
  const admins = (env.ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean);
  return admins.includes(normalizeEmail(email));
}

const limpar = (valor) => (typeof valor === "string" ? valor.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");

function lerLink(valor) {
  const texto = limpar(valor);
  if (!texto || texto.length > LINK_MAX) return null;
  try {
    const u = new URL(texto);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u : null;
  } catch {
    return null;
  }
}

// Mesmo link com ou sem www, barra final ou parâmetros de rastreio conta como repetido.
// Na Biblioteca de Anúncios o que identifica o anúncio são os parâmetros, então eles ficam.
function chaveDoLink(u) {
  const host = u.hostname.replace(/^www\./, "");
  const caminho = u.pathname.replace(/\/+$/, "");
  return `${host}${caminho}${/(^|\.)facebook\.com$/.test(host) ? u.search : ""}`.toLowerCase();
}

function validar(corpo) {
  const link = lerLink(corpo.link);
  if (!link) return { mensagem: "Confira o link: ele precisa ser um endereço completo, começando com https://." };
  const dados = { link: link.href };
  for (const [campo, regra] of Object.entries(CAMPOS)) {
    const valor = limpar(corpo[campo]);
    if (regra.obrigatorio && !valor) return { mensagem: `Preencha o campo: ${regra.nome}.` };
    if (valor.length > regra.max) return { mensagem: `O campo "${regra.nome}" passou de ${regra.max} caracteres.` };
    dados[campo] = valor;
  }
  return { dados, chave: chaveDoLink(link) };
}

async function enviar(request, url, env, session) {
  if (request.headers.get("origin") !== url.origin) return erro("Envio não permitido.", 403);

  const texto = await request.text();
  if (texto.length > CORPO_MAX) return erro("O envio ficou grande demais. Encurte os textos.", 413);
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return erro("Não entendi o envio. Tente novamente.", 400);
  }
  if (!corpo || typeof corpo !== "object") return erro("Não entendi o envio. Tente novamente.", 400);

  const { dados, chave, mensagem } = validar(corpo);
  if (mensagem) return erro(mensagem, 400);

  const resultado = await env.DB.prepare(
    `INSERT INTO ofertas_alunos (id, status, dados, link_chave, email, nome, data_envio, criado_em)
     VALUES (?, 'pendente', ?, ?, ?, ?, ?, ?) ON CONFLICT(link_chave) DO NOTHING`
  )
    .bind(novoId(), JSON.stringify(dados), chave, normalizeEmail(session.e), limpar(session.n).slice(0, 120), hojeBrasilia(), Date.now())
    .run();
  if (!resultado.meta.changes) return erro("Essa oferta já foi enviada por outro aluno.", 409);
  return json({ ok: true }, 201);
}

async function listar(env, session) {
  const { results: aprovadas } = await env.DB.prepare(
    "SELECT id, dados, data_envio FROM ofertas_alunos WHERE status = 'aprovada' ORDER BY aprovado_em"
  ).all();
  const resposta = {
    admin: ehAdmin(env, session.e),
    // Nome e e-mail de quem enviou nunca saem nas ofertas aprovadas.
    ofertas: aprovadas.map((o) => ({ ...JSON.parse(o.dados), id: o.id, origem: "aluno", status: "ativa", dataMineracao: o.data_envio })),
  };
  if (resposta.admin) {
    const { results: pendentes } = await env.DB.prepare(
      "SELECT id, dados, data_envio, email, nome FROM ofertas_alunos WHERE status = 'pendente' ORDER BY criado_em LIMIT ?"
    )
      .bind(PENDENTES_NA_TELA)
      .all();
    resposta.pendentes = pendentes.map((o) => ({
      ...JSON.parse(o.dados),
      id: o.id,
      origem: "aluno",
      dataMineracao: o.data_envio,
      enviadoPor: { email: o.email, nome: o.nome },
    }));
  }
  return json(resposta);
}

const ACOES = {
  aprovar: (env, id) =>
    env.DB.prepare("UPDATE ofertas_alunos SET status = 'aprovada', aprovado_em = ? WHERE id = ? AND status = 'pendente'").bind(Date.now(), id),
  recusar: (env, id) => env.DB.prepare("DELETE FROM ofertas_alunos WHERE id = ? AND status = 'pendente'").bind(id),
  remover: (env, id) => env.DB.prepare("DELETE FROM ofertas_alunos WHERE id = ? AND status = 'aprovada'").bind(id),
};

async function moderar(request, url, env, session, id, acao) {
  if (request.headers.get("origin") !== url.origin) return erro("Ação não permitida.", 403);
  if (!ehAdmin(env, session.e)) return erro("Só o administrador pode fazer isso.", 403);
  if (!ID_OK.test(id) || !Object.hasOwn(ACOES, acao)) return erro("Oferta não encontrada.", 404);
  const resultado = await ACOES[acao](env, id).run();
  if (!resultado.meta.changes) return erro("Oferta não encontrada.", 404);
  return json({ ok: true });
}

export async function apiOfertas(request, url, env, session) {
  if (!env.DB) return erro("Envio de ofertas indisponível no momento.", 503);
  const partes = url.pathname.replace(/^\/hub\/api\/ofertas\/?/, "").split("/").filter(Boolean);

  if (partes.length === 0) {
    if (request.method === "GET") return listar(env, session);
    if (request.method === "POST") return enviar(request, url, env, session);
  } else if (partes.length === 2 && request.method === "POST") {
    return moderar(request, url, env, session, partes[0], partes[1]);
  }
  return erro("Rota inválida.", 405);
}

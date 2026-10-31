import { normalizeEmail } from "./email.js";

const SESSION_COOKIE = "gh_session";
const OAUTH_COOKIE = "gh_oauth";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 dias
const OAUTH_TTL = 60 * 10; // 10 minutos para concluir o login
const PUBLIC_ASSETS = new Set(["/hub/assets/logo.png", "/hub/assets/favicon.png"]);

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------- utilidades ---------- */
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const randomToken = (bytes) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
const nowSec = () => Math.floor(Date.now() / 1000);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const hmacKey = (secret) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

async function sign(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

async function verify(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlDecode(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(body)));
    return payload.exp > nowSec() ? payload : null;
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/hub; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  cookies.forEach((c) => headers.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers });
}

// Só aceita voltar para dentro do hub (evita open redirect).
function safeNext(value) {
  if (typeof value !== "string" || !value.startsWith("/hub") || value.startsWith("//")) return "/hub";
  if (value.startsWith("/hub/entrar") || value.startsWith("/hub/login") || value.startsWith("/hub/auth/") || value.startsWith("/hub/sair")) return "/hub";
  return value;
}

const isDocument = (request) =>
  request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");

async function isAllowed(env, email) {
  const key = normalizeEmail(email);
  if (!key) return false;
  const admins = (env.ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean);
  if (admins.includes(key)) return true;
  return (await env.ALLOW.get(key)) !== null;
}

async function readSession(request, env) {
  return verify(getCookie(request, SESSION_COOKIE), env.SESSION_SECRET);
}

/* ---------- páginas ---------- */
const MENSAGENS = {
  negado: (email) =>
    `O e-mail <strong>${esc(email || "")}</strong> ainda não está liberado para o Gravitas Hub. Se você é aluno, abra o link de convite do grupo da mentoria para se cadastrar (é só uma vez) ou fale com o suporte.`,
  convite: () => "Este convite expirou ou atingiu o limite de cadastros. Peça um link novo no grupo da mentoria.",
  sessao: () => "Sua tentativa de login expirou. Tente novamente.",
  google: () => "Não foi possível validar sua conta com o Google. Tente novamente.",
  cancelado: () => "Login cancelado. Quando quiser, é só tentar de novo.",
};

// Convites são códigos aleatórios guardados no KV como "convite:<codigo>" = {exp, max, count}.
const CODIGO_OK = /^[A-Za-z0-9_-]{16,64}$/;

async function readInvite(env, code) {
  if (!code || !CODIGO_OK.test(code)) return null;
  const raw = await env.ALLOW.get(`convite:${code}`);
  if (!raw) return null;
  try {
    const inv = JSON.parse(raw);
    if (inv.exp && inv.exp < nowSec()) return null;
    if (inv.count >= inv.max) return null;
    return inv;
  } catch {
    return null;
  }
}

// Cadastra o e-mail como aluno usando um convite válido. Contagem em KV é "melhor esforço" (pode passar do limite por poucos).
async function registerWithInvite(env, code, email) {
  const inv = await readInvite(env, code);
  if (!inv) return false;
  const meta = { via: "convite", c: code.slice(0, 6), t: new Date().toISOString() };
  await env.ALLOW.put(normalizeEmail(email), JSON.stringify(meta), { metadata: meta });
  await env.ALLOW.put(`convite:${code}`, JSON.stringify({ ...inv, count: inv.count + 1 }), inv.exp ? { expiration: inv.exp } : undefined);
  return true;
}

async function loginPage(url, env) {
  const erro = url.searchParams.get("erro");
  let msg = MENSAGENS[erro] ? MENSAGENS[erro](url.searchParams.get("email")) : "";
  const next = safeNext(url.searchParams.get("next"));
  const conviteParam = url.searchParams.get("convite");
  let convite = "";
  if (conviteParam && !erro) {
    if (await readInvite(env, conviteParam)) convite = conviteParam;
    else msg = MENSAGENS.convite();
  }
  const loginHref = `/hub/login?next=${encodeURIComponent(next)}${convite ? `&convite=${encodeURIComponent(convite)}` : ""}`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Gravitas Hub</title>
<link rel="icon" href="/hub/assets/favicon.png?v=2" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600&family=Sora:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#07050b;--stroke:rgba(255,255,255,.08);--stroke-2:rgba(255,255,255,.16);--ink:#f5f1fa;--muted:#a9a1b8;--muted-2:#716a82;--lilac:#d3bbf5;--purple-glow:#a875ee;--red:#e8838f;--glass:linear-gradient(155deg,rgba(255,255,255,.07),rgba(255,255,255,.022) 55%,rgba(255,255,255,.032))}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(900px 560px at 88% -8%,rgba(122,53,209,.26),transparent 62%),radial-gradient(760px 520px at -6% 100%,rgba(122,53,209,.17),transparent 62%),radial-gradient(520px 420px at 52% 42%,rgba(168,117,238,.05),transparent 70%)}
a{color:inherit;text-decoration:none}
h1,h2{font-family:Sora,Inter,sans-serif;font-weight:500;letter-spacing:-.012em}
.glass{background:var(--glass);border:1px solid var(--stroke);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 24px 48px -28px rgba(0,0,0,.85)}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 32px}
.brand{display:flex;align-items:center;gap:12px}
.brand img{width:32px;height:32px;object-fit:contain}
.brand__text{display:flex;flex-direction:column;line-height:1.2}
.brand__name{font-family:Sora,sans-serif;font-size:1rem;font-weight:500}
.brand__name strong{font-weight:600}
.brand__sub{font-size:.7rem;color:var(--muted-2);margin-top:2px}
.badge{font-size:.72rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border:1px solid var(--stroke);background:rgba(255,255,255,.025);padding:9px 18px;border-radius:100px}
.wrap{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:24px 32px 48px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:56px;align-items:center}
.chip{display:inline-flex;align-items:center;gap:8px;font-size:.78rem;font-weight:500;color:var(--lilac);padding:7px 14px;border-radius:100px;border:1px solid rgba(211,187,245,.22);background:rgba(122,53,209,.12)}
.chip i{width:6px;height:6px;border-radius:50%;background:var(--lilac);box-shadow:0 0 10px var(--purple-glow)}
h1{font-size:clamp(2.1rem,4.4vw,3.3rem);line-height:1.12;margin:22px 0 14px}
h1 span{color:var(--lilac)}
.lead{color:var(--muted);font-size:1rem;max-width:30rem}
.login{margin-top:32px;max-width:420px;padding:26px;border-radius:22px}
.login__label{font-size:.64rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2);margin-bottom:14px}
.erro{margin-bottom:16px;padding:12px 14px;border-radius:14px;border:1px solid rgba(232,131,143,.3);background:rgba(232,131,143,.06);color:var(--red);font-size:.84rem;line-height:1.5}
.erro strong{color:#f3b3bb;font-weight:600}
.btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:14px 22px;border-radius:100px;background:#fff;color:#1f1f1f;font-weight:500;font-size:.95rem;transition:filter .15s ease,transform .15s ease}
.btn:hover{filter:brightness(.94)}
.btn:active{transform:scale(.99)}
.login__note{margin-top:16px;font-size:.78rem;color:var(--muted-2);line-height:1.5}
.panel{padding:26px;border-radius:26px}
.panel__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.panel__head h2{font-size:1rem}
.panel__head span{font-size:.7rem;color:var(--muted-2);border:1px solid var(--stroke);padding:5px 12px;border-radius:100px}
.item{display:flex;gap:14px;align-items:flex-start;padding:14px;border-radius:16px;border:1px solid var(--stroke);background:rgba(255,255,255,.02)}
.item+.item{margin-top:10px}
.item__icon{width:38px;height:38px;flex-shrink:0;border-radius:12px;display:grid;place-items:center;color:var(--lilac);background:rgba(122,53,209,.16);border:1px solid rgba(211,187,245,.14)}
.item__icon svg{width:18px;height:18px}
.item b{display:block;font-weight:500;font-size:.92rem}
.item small{display:block;color:var(--muted);font-size:.8rem;line-height:1.45;margin-top:2px}
.spark{margin-top:18px;padding:16px 16px 10px;border-radius:16px;border:1px solid var(--stroke);background:rgba(255,255,255,.02)}
.spark__top{display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted-2);margin-bottom:6px}
.spark__top em{font-style:normal;color:#6fd3a0}
.spark svg{display:block;width:100%;height:70px}
footer{padding:0 32px 26px;display:flex;justify-content:center;gap:10px;font-size:.74rem;color:var(--muted-2)}
footer a:hover{color:var(--muted)}
@media (max-width:900px){.wrap{grid-template-columns:1fr;gap:0;padding:12px 20px 40px;max-width:560px}.panel{display:none}.login{max-width:none}.topbar{padding:18px 20px}}
@media (max-width:520px){.badge{display:none}h1{margin-top:18px}}
</style></head><body>
<header class="topbar">
  <div class="brand"><img src="/hub/assets/logo.png?v=2" alt=""><div class="brand__text"><span class="brand__name">Gravitas <strong>Hub</strong></span><span class="brand__sub">Núcleo Gravitas</span></div></div>
  <span class="badge">Uso interno · Mentorados</span>
</header>
<main class="wrap">
  <section>
    <span class="chip"><i></i>${convite ? "Convite da mentoria" : "Área do aluno"}</span>
    <h1>${convite ? "Você foi convidado para o <span>Gravitas Hub</span>" : "Bem-vindo ao <span>Gravitas Hub</span>"}</h1>
    <p class="lead">${convite ? "Entre com a conta Google que quiser usar daqui para frente. O cadastro é feito só nessa primeira vez." : "Ofertas lowticket mineradas e validadas, nichos em alta e os frameworks do Núcleo, num só lugar."}</p>
    <div class="login glass">
      <div class="login__label">${convite ? "Criar seu acesso" : "Acessar o hub"}</div>
      ${msg ? `<div class="erro">${msg}</div>` : ""}
      <a class="btn" href="${loginHref}">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Entrar com Google</a>
      <p class="login__note">${convite ? "Depois do cadastro, é só acessar nucleogravitas.com.br/hub e entrar com um clique." : "Ainda não tem acesso? Use o link de convite do grupo da mentoria ou fale com o suporte."}</p>
    </div>
  </section>
  <aside class="panel glass" aria-hidden="true">
    <div class="panel__head"><h2>Dentro do hub</h2><span>Atualizado toda semana</span></div>
    <div class="item"><div class="item__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg></div><div><b>Banco de ofertas</b><small>Ofertas lowticket mineradas e conferidas na Biblioteca de Anúncios.</small></div></div>
    <div class="item"><div class="item__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg></div><div><b>Nichos em alta</b><small>Onde o mercado está comprando agora, nicho por nicho.</small></div></div>
    <div class="item"><div class="item__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/></svg></div><div><b>Frameworks</b><small>A metodologia do Núcleo Gravitas, pronta para aplicar.</small></div></div>
    <div class="spark">
      <div class="spark__top"><span>Ofertas no hub</span><em>crescendo</em></div>
      <svg viewBox="0 0 300 70" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a875ee" stop-opacity=".35"/><stop offset="1" stop-color="#a875ee" stop-opacity="0"/></linearGradient></defs><path d="M0 62 L40 56 L80 58 L120 44 L160 46 L200 30 L240 26 L300 8 L300 70 L0 70Z" fill="url(#g)"/><path d="M0 62 L40 56 L80 58 L120 44 L160 46 L200 30 L240 26 L300 8" fill="none" stroke="#d3bbf5" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    </div>
  </aside>
</main>
<footer><span>© Núcleo Gravitas</span><span>·</span><a href="/privacidade/">Privacidade</a></footer>
</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/* ---------- fluxo OAuth (Google, authorization code + PKCE) ---------- */
async function startLogin(url, env) {
  const state = randomToken(16);
  const verifier = randomToken(32);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));
  const next = safeNext(url.searchParams.get("next"));
  const convite = url.searchParams.get("convite");
  const oauth = await sign(
    { s: state, v: verifier, n: next, c: CODIGO_OK.test(convite || "") ? convite : "", exp: nowSec() + OAUTH_TTL },
    env.SESSION_SECRET
  );
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/hub/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return redirect(auth.toString(), [cookie(OAUTH_COOKIE, oauth, OAUTH_TTL)]);
}

async function handleCallback(request, url, env) {
  const clear = cookie(OAUTH_COOKIE, "", 0);
  const falha = (erro, extra = "") => redirect(`/hub/entrar?erro=${erro}${extra}`, [clear]);

  if (url.searchParams.get("error")) return falha("cancelado");

  const oauth = await verify(getCookie(request, OAUTH_COOKIE), env.SESSION_SECRET);
  const code = url.searchParams.get("code");
  if (!oauth || !code || oauth.s !== url.searchParams.get("state")) return falha("sessao");

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/hub/auth/callback`,
      grant_type: "authorization_code",
      code_verifier: oauth.v,
    }),
  });
  if (!tokenResp.ok) return falha("google");

  let claims;
  try {
    const { id_token } = await tokenResp.json();
    claims = JSON.parse(dec.decode(b64urlDecode(id_token.split(".")[1])));
  } catch {
    return falha("google");
  }
  // O token veio direto do endpoint do Google por TLS; ainda assim conferimos as claims essenciais.
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issOk || claims.aud !== env.GOOGLE_CLIENT_ID || !(claims.exp > nowSec()) || claims.email_verified !== true || !claims.email) {
    return falha("google");
  }

  if (!(await isAllowed(env, claims.email))) {
    // Quem ainda não é aluno cadastrado só entra com um convite válido (e fica cadastrado para as próximas vezes).
    if (!oauth.c) return falha("negado", `&email=${encodeURIComponent(claims.email)}`);
    if (!(await registerWithInvite(env, oauth.c, claims.email))) return falha("convite");
  }

  const session = await sign({ e: claims.email, n: claims.name || "", exp: nowSec() + SESSION_TTL }, env.SESSION_SECRET);
  return redirect(safeNext(oauth.n), [clear, cookie(SESSION_COOKIE, session, SESSION_TTL)]);
}

/* ---------- entrada do Worker ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path !== "/hub" && !path.startsWith("/hub/")) return fetch(request);

    // Sem configuração completa, o acesso fica fechado.
    if (!env.SESSION_SECRET || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ALLOW) {
      return new Response("Gravitas Hub: autenticação ainda não configurada.", { status: 503 });
    }

    try {
      if (path === "/hub/entrar") return await loginPage(url, env);
      if (path === "/hub/login") return startLogin(url, env);
      if (path === "/hub/auth/callback") return await handleCallback(request, url, env);
      if (path === "/hub/sair") return redirect("/hub/entrar", [cookie(SESSION_COOKIE, "", 0)]);
      if (PUBLIC_ASSETS.has(path)) return fetch(request);

      const session = await readSession(request, env);

      if (path === "/hub/me") {
        if (!session) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
        return new Response(JSON.stringify({ email: session.e, name: session.n }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }

      if (!session) {
        if (isDocument(request)) {
          return redirect(`/hub/entrar?next=${encodeURIComponent(safeNext(path + url.search))}`);
        }
        return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
      }

      // A lista é conferida de novo a cada navegação, então remover um aluno vale já no próximo carregamento.
      if (isDocument(request) && !(await isAllowed(env, session.e))) {
        return redirect(`/hub/entrar?erro=negado&email=${encodeURIComponent(session.e)}`, [cookie(SESSION_COOKIE, "", 0)]);
      }

      const origin = await fetch(request);
      const out = new Response(origin.body, origin);
      out.headers.set("Cache-Control", "private, no-cache");
      out.headers.set("X-Robots-Tag", "noindex, nofollow");
      out.headers.delete("Access-Control-Allow-Origin");
      return out;
    } catch {
      return new Response("Erro de autenticação. Tente novamente em instantes.", { status: 500 });
    }
  },
};

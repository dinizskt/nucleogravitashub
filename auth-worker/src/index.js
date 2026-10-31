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
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Gravitas Hub</title>
<link rel="icon" href="/hub/assets/favicon.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Sora:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:grid;place-items:center;padding:24px;background:#07050b;color:#f5f1fa;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(900px 560px at 88% -8%,rgba(122,53,209,.28),transparent 62%),radial-gradient(760px 520px at -6% 100%,rgba(122,53,209,.18),transparent 62%)}
.card{width:100%;max-width:420px;padding:40px 34px;text-align:center;border-radius:26px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(155deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:0 30px 60px -30px rgba(0,0,0,.9)}
img{width:56px;height:56px;object-fit:contain;margin:0 auto 18px;display:block}
h1{font-family:Sora,sans-serif;font-weight:500;font-size:1.7rem;letter-spacing:-.02em}
h1 span{color:#d3bbf5}
p{color:#a9a1b8;font-size:.95rem;line-height:1.6;margin:10px 0 26px}
.erro{margin:0 0 22px;padding:12px 14px;border-radius:14px;border:1px solid rgba(232,131,143,.35);color:#e8838f;font-size:.86rem;line-height:1.5}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:14px 22px;border-radius:100px;background:#fff;color:#1f1f1f;font-weight:500;font-size:.95rem;text-decoration:none}
.btn:hover{background:#efe6fb}
small{display:block;margin-top:22px;color:#716a82;font-size:.76rem}
</style></head><body>
<main class="card">
<img src="/hub/assets/logo.png" alt="Gravitas Hub">
<h1>Gravitas <span>Hub</span></h1>
<p>${convite ? "Você recebeu um convite para o Gravitas Hub. Entre com a conta Google que quiser usar daqui para frente: o cadastro é feito só nessa primeira vez." : "Área exclusiva para alunos do Núcleo Gravitas. Entre com a conta Google que você cadastrou."}</p>
${msg ? `<div class="erro">${msg}</div>` : ""}
<a class="btn" href="/hub/login?next=${encodeURIComponent(next)}${convite ? `&convite=${encodeURIComponent(convite)}` : ""}">
<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.400 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 12-2.100 16-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>
Entrar com Google</a>
<small>Sem acesso? Fale com o suporte da mentoria.</small>
</main></body></html>`;
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

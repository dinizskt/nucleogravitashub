import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { normalizeEmail } from "../src/email.js";

const ORIGIN = "https://www.nucleogravitas.com.br";
const CLIENT_ID = "client-123.apps.googleusercontent.com";

function makeEnv(allowed = []) {
  const kv = new Map(allowed.map((e) => [normalizeEmail(e), "1"]));
  return {
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "segredo-google",
    SESSION_SECRET: "segredo-de-sessao-com-bastante-entropia",
    ADMIN_EMAILS: "",
    ALLOW: {
      get: async (k) => (kv.has(k) ? kv.get(k) : null),
      put: async (k, v) => void kv.set(k, v),
    },
    _set: kv,
  };
}

const CONVITE = "convite-do-grupo-0123456789";
const nowSec = () => Math.floor(Date.now() / 1000);
const comConvite = (env, inv = {}) => {
  env._set.set(`convite:${CONVITE}`, JSON.stringify({ exp: nowSec() + 14 * 86400, max: 600, count: 0, ...inv }));
  return env;
};
const contagem = (env) => JSON.parse(env._set.get(`convite:${CONVITE}`)).count;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (claims) => `${b64({ alg: "RS256" })}.${b64(claims)}.assinatura`;
const googleClaims = (over = {}) => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 3600,
  email: "aluno@gmail.com",
  email_verified: true,
  name: "Aluno Teste",
  ...over,
});

let tokenResponse;
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  tokenResponse = { ok: true, body: { id_token: idToken(googleClaims()) } };
  globalThis.fetch = async (input) => {
    const u = typeof input === "string" ? input : input.url;
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify(tokenResponse.body), { status: tokenResponse.ok ? 200 : 400 });
    }
    return new Response("conteudo-do-origin", { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=0" } });
  };
});
test.after(() => (globalThis.fetch = realFetch));

const req = (path, { cookie, accept = "text/html" } = {}) =>
  new Request(ORIGIN + path, { headers: { accept, ...(cookie ? { cookie } : {}) } });

const cookiesFrom = (resp) => resp.headers.getSetCookie().map((c) => c.split(";")[0]);
const cookieHeader = (resp) => cookiesFrom(resp).filter((c) => !c.endsWith("=")).join("; ");

// percorre login -> google -> callback e devolve a resposta do callback
async function loginFlow(env, next = "/hub", convite = "") {
  const extra = convite ? `&convite=${encodeURIComponent(convite)}` : "";
  const start = await worker.fetch(req(`/hub/login?next=${encodeURIComponent(next)}${extra}`), env);
  const auth = new URL(start.headers.get("location"));
  const state = auth.searchParams.get("state");
  const cb = await worker.fetch(req(`/hub/auth/callback?code=abc&state=${state}`, { cookie: cookieHeader(start) }), env);
  return { start, auth, cb };
}

test("normalizeEmail trata gmail com ponto e +etiqueta", () => {
  assert.equal(normalizeEmail("Joao.Silva+curso@Gmail.com"), "joaosilva@gmail.com");
  assert.equal(normalizeEmail("joao@googlemail.com"), "joao@gmail.com");
  assert.equal(normalizeEmail("Ana.Souza@empresa.com.br"), "ana.souza@empresa.com.br");
  assert.equal(normalizeEmail("sem-arroba"), "");
});

test("fora do /hub passa direto, sem exigir login", async () => {
  const r = await worker.fetch(req("/"), makeEnv());
  assert.equal(await r.text(), "conteudo-do-origin");
});

test("sem configuração o acesso fica fechado (503)", async () => {
  const r = await worker.fetch(req("/hub"), { ...makeEnv(), SESSION_SECRET: "" });
  assert.equal(r.status, 503);
});

test("documento sem sessão vai para a tela de login com next", async () => {
  const r = await worker.fetch(req("/hub/js/data.js?x=1", { accept: "text/html" }), makeEnv());
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/hub/entrar?next=%2Fhub%2Fjs%2Fdata.js%3Fx%3D1");
});

test("asset sem sessão recebe 401 (data.js não vaza)", async () => {
  const r = await worker.fetch(req("/hub/js/data.js", { accept: "*/*" }), makeEnv());
  assert.equal(r.status, 401);
  assert.notEqual(await r.text(), "conteudo-do-origin");
});

test("logo e favicon são públicos (a tela de login precisa deles)", async () => {
  const r = await worker.fetch(req("/hub/assets/logo.png", { accept: "image/png" }), makeEnv());
  assert.equal(await r.text(), "conteudo-do-origin");
});

test("/hub/login manda para o Google com PKCE e state", async () => {
  const r = await worker.fetch(req("/hub/login?next=/hub%23ofertas"), makeEnv());
  const u = new URL(r.headers.get("location"));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(u.searchParams.get("redirect_uri"), `${ORIGIN}/hub/auth/callback`);
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.ok(u.searchParams.get("state").length > 10);
  assert.match(r.headers.getSetCookie()[0], /gh_oauth=.*HttpOnly.*Secure.*SameSite=Lax/);
});

test("aluno liberado: faz login, entra e vê o conteúdo com cache privado", async () => {
  const env = makeEnv(["aluno@gmail.com"]);
  const { cb } = await loginFlow(env, "/hub#ofertas");
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get("location"), "/hub#ofertas");
  const sessionCookie = cookieHeader(cb);
  assert.match(sessionCookie, /gh_session=/);

  const page = await worker.fetch(req("/hub", { cookie: sessionCookie }), env);
  assert.equal(await page.text(), "conteudo-do-origin");
  assert.equal(page.headers.get("cache-control"), "private, no-cache");
  assert.equal(page.headers.get("access-control-allow-origin"), null);

  const asset = await worker.fetch(req("/hub/js/data.js", { cookie: sessionCookie, accept: "*/*" }), env);
  assert.equal(await asset.text(), "conteudo-do-origin");

  const me = await worker.fetch(req("/hub/me", { cookie: sessionCookie, accept: "application/json" }), env);
  assert.deepEqual(await me.json(), { email: "aluno@gmail.com", name: "Aluno Teste" });
});

test("gmail com ponto e +etiqueta entra se a conta base está na lista", async () => {
  const env = makeEnv(["alunoteste@gmail.com"]);
  tokenResponse.body = { id_token: idToken(googleClaims({ email: "aluno.teste+hub@gmail.com" })) };
  const { cb } = await loginFlow(env);
  assert.match(cookieHeader(cb), /gh_session=/);
});

test("e-mail fora da lista é recusado e não recebe sessão", async () => {
  const env = makeEnv(["outro@gmail.com"]);
  const { cb } = await loginFlow(env);
  assert.match(cb.headers.get("location"), /^\/hub\/entrar\?erro=negado&email=aluno%40gmail\.com/);
  assert.ok(!cookiesFrom(cb).some((c) => c.startsWith("gh_session=") && !c.endsWith("=")));
});

test("aluno removido da lista perde o acesso no próximo carregamento", async () => {
  const env = makeEnv(["aluno@gmail.com"]);
  const { cb } = await loginFlow(env);
  const sessionCookie = cookieHeader(cb);
  env._set.clear();
  const r = await worker.fetch(req("/hub", { cookie: sessionCookie }), env);
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /erro=negado/);
});

test("state adulterado ou ausente é recusado", async () => {
  const env = makeEnv(["aluno@gmail.com"]);
  const start = await worker.fetch(req("/hub/login"), env);
  const r = await worker.fetch(req("/hub/auth/callback?code=abc&state=falso", { cookie: cookieHeader(start) }), env);
  assert.equal(r.headers.get("location"), "/hub/entrar?erro=sessao");
  const semCookie = await worker.fetch(req("/hub/auth/callback?code=abc&state=falso"), env);
  assert.equal(semCookie.headers.get("location"), "/hub/entrar?erro=sessao");
});

test("token do Google com audiência errada ou e-mail não verificado é recusado", async () => {
  const env = makeEnv(["aluno@gmail.com"]);
  tokenResponse.body = { id_token: idToken(googleClaims({ aud: "outro-client" })) };
  assert.match((await loginFlow(env)).cb.headers.get("location"), /erro=google/);
  tokenResponse.body = { id_token: idToken(googleClaims({ email_verified: false })) };
  assert.match((await loginFlow(env)).cb.headers.get("location"), /erro=google/);
});

test("cookie de sessão forjado não vale", async () => {
  const env = makeEnv(["aluno@gmail.com"]);
  const falso = `gh_session=${b64({ e: "aluno@gmail.com", n: "x", exp: 9999999999 })}.assinaturafalsa`;
  const r = await worker.fetch(req("/hub", { cookie: falso }), env);
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /^\/hub\/entrar/);
});

test("next externo é ignorado (sem open redirect)", async () => {
  const env = makeEnv(["aluno@gmail.com"]);
  for (const ruim of ["//evil.com", "https://evil.com", "/outra-pagina"]) {
    const { cb } = await loginFlow(env, ruim);
    assert.equal(cb.headers.get("location"), "/hub");
  }
});

test("a tela de login escapa o e-mail recebido na URL", async () => {
  const r = await worker.fetch(req(`/hub/entrar?erro=negado&email=${encodeURIComponent("<script>alert(1)</script>")}`), makeEnv());
  const html = await r.text();
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("convite válido: a tela de login leva o convite até o Google", async () => {
  const env = comConvite(makeEnv());
  const html = await (await worker.fetch(req(`/hub/entrar?convite=${CONVITE}`), env)).text();
  assert.ok(html.includes(`convite=${CONVITE}`));
  assert.ok(html.includes("Você foi convidado"));
});

test("convite inexistente ou vencido mostra o aviso e não repassa o código", async () => {
  for (const env of [makeEnv(), comConvite(makeEnv(), { exp: nowSec() - 10 })]) {
    const html = await (await worker.fetch(req(`/hub/entrar?convite=${CONVITE}`), env)).text();
    assert.ok(html.includes("Este convite expirou"));
    assert.ok(!html.includes(`convite=${CONVITE}`));
  }
});

test("primeiro login pelo convite cadastra o aluno, e depois ele entra sem convite", async () => {
  const env = comConvite(makeEnv());
  tokenResponse.body = { id_token: idToken(googleClaims({ email: "Novo.Aluno@gmail.com" })) };
  const { cb } = await loginFlow(env, "/hub", CONVITE);
  assert.equal(cb.headers.get("location"), "/hub");
  assert.match(cookieHeader(cb), /gh_session=/);
  const meta = JSON.parse(env._set.get("novoaluno@gmail.com"));
  assert.equal(meta.via, "convite");
  assert.ok(meta.t);
  assert.equal(contagem(env), 1);

  env._set.delete(`convite:${CONVITE}`); // link trocado/apagado: quem já entrou continua
  const denovo = await loginFlow(env);
  assert.match(cookieHeader(denovo.cb), /gh_session=/);
});

test("aluno já cadastrado que abre o convite não gasta vaga", async () => {
  const env = comConvite(makeEnv(["aluno@gmail.com"]));
  await loginFlow(env, "/hub", CONVITE);
  assert.equal(contagem(env), 0);
});

test("convite lotado ou vencido não cadastra ninguém", async () => {
  for (const inv of [{ count: 600 }, { exp: nowSec() - 10 }]) {
    const env = comConvite(makeEnv(), inv);
    const { cb } = await loginFlow(env, "/hub", CONVITE);
    assert.equal(cb.headers.get("location"), "/hub/entrar?erro=convite");
    assert.equal(env._set.get("aluno@gmail.com"), undefined);
  }
});

test("código de convite forjado não é aceito", async () => {
  const env = makeEnv();
  const { cb } = await loginFlow(env, "/hub", "chute");
  assert.match(cb.headers.get("location"), /erro=negado/);
  assert.equal(env._set.get("aluno@gmail.com"), undefined);
});

test("sair limpa a sessão", async () => {
  const r = await worker.fetch(req("/hub/sair"), makeEnv());
  assert.equal(r.headers.get("location"), "/hub/entrar");
  assert.match(r.headers.getSetCookie()[0], /gh_session=;.*Max-Age=0/);
});

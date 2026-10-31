// Gera um link de convite para o grupo da mentoria.
// Uso: node scripts/convite.mjs [dias=14] [limite=600]
// Depois: npx wrangler kv bulk put convite.bulk.json --binding ALLOW --remote
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const dias = Number(process.argv[2] || 14);
const max = Number(process.argv[3] || 600);
if (!(dias > 0) || !(max > 0)) {
  console.error("Uso: node scripts/convite.mjs [dias] [limite]");
  process.exit(1);
}

const code = randomBytes(18).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + Math.round(dias * 86400);
const value = JSON.stringify({ exp, max, count: 0, criado: new Date().toISOString() });

writeFileSync("convite.bulk.json", JSON.stringify([{ key: `convite:${code}`, value, expiration: exp }], null, 2));

console.log(`Convite gerado: vale ${dias} dias (até ${new Date(exp * 1000).toLocaleString("pt-BR")}), limite de ${max} cadastros.\n`);
console.log("1) Ative o convite:");
console.log("   npx wrangler kv bulk put convite.bulk.json --binding ALLOW --remote\n");
console.log("2) Link para o grupo:");
console.log(`   https://www.nucleogravitas.com.br/hub/entrar?convite=${code}\n`);
console.log("Para cancelar este link antes do prazo:");
console.log(`   npx wrangler kv key delete "convite:${code}" --binding ALLOW --remote`);

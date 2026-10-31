// Gera o arquivo de carga da lista de alunos a partir de um CSV/TXT.
// Uso:  node scripts/allowlist.mjs alunos.csv            -> cria allowlist.bulk.json
//       npx wrangler kv bulk put allowlist.bulk.json --binding ALLOW --remote
// Aceita qualquer arquivo em que os e-mails apareçam (uma coluna, várias colunas, uma linha por e-mail).
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeEmail } from "../src/email.js";

const [arquivo, saida = "allowlist.bulk.json"] = process.argv.slice(2);
if (!arquivo) {
  console.error("Uso: node scripts/allowlist.mjs <arquivo.csv|txt> [saida.json]");
  process.exit(1);
}

const texto = readFileSync(arquivo, "utf8");
const achados = texto.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
const unicos = [...new Set(achados.map(normalizeEmail).filter(Boolean))];

writeFileSync(saida, JSON.stringify(unicos.map((key) => ({ key, value: "1" })), null, 2));
console.log(`${achados.length} e-mails lidos, ${unicos.length} únicos (duplicados e variações de Gmail unificados).`);
console.log(`Arquivo gerado: ${saida}`);
console.log("Próximo passo: npx wrangler kv bulk put " + saida + " --binding ALLOW --remote");

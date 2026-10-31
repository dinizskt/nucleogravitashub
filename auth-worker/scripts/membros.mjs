// Lista quem tem acesso e quando entrou.
// Uso: npx wrangler kv key list --binding ALLOW --remote > membros.json
//      node scripts/membros.mjs membros.json            (gera membros.csv)
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/membros.mjs membros.json");
  process.exit(1);
}

const keys = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
const linhas = [];
const convites = [];
for (const { name, metadata, expiration } of keys) {
  if (name.startsWith("convite:")) {
    convites.push(`${name.slice(8, 14)}…  vence ${expiration ? new Date(expiration * 1000).toLocaleString("pt-BR") : "nunca"}`);
    continue;
  }
  linhas.push([name, metadata?.via || "lista", metadata?.t || "", metadata?.c || ""]);
}
linhas.sort((a, b) => (b[2] || "").localeCompare(a[2] || ""));

writeFileSync("membros.csv", ["email,origem,entrou_em,convite", ...linhas.map((l) => l.join(","))].join("\n"));
console.log(`${linhas.length} e-mails com acesso (${linhas.filter((l) => l[1] === "convite").length} pelo convite). Salvo em membros.csv.`);
if (convites.length) console.log(`Convites ativos:\n  ${convites.join("\n  ")}`);

// Normaliza e-mails para comparar com a lista de alunos.
// No Gmail, pontos e "+etiqueta" não mudam a conta, então joao.silva+x@gmail.com == joaosilva@gmail.com.
export function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return "";
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }
  return local && domain ? `${local}@${domain}` : "";
}

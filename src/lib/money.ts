/** Utilitários de valor monetário no formato brasileiro (0,00). */

/** Interpreta texto digitado pelo usuário (vírgula ou ponto como decimal) em número. */
export function parseValorBR(texto: string): number {
  const limpo = texto.replace(/[^\d,.]/g, "");
  if (!limpo) return NaN;
  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");
  let normalizado = limpo;
  if (temVirgula && temPonto) {
    // 1.234,56 → ponto é separador de milhar
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  }
  return Number(normalizado);
}

/** Formata número como moeda brasileira sem o símbolo (1.234,56). */
export function formatValorBR(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

import { describe, expect, it } from "vitest";
import { formatValorBR, parseValorBR } from "./money";

describe("parseValorBR", () => {
  it("interpreta vírgula como decimal", () => {
    expect(parseValorBR("12,50")).toBe(12.5);
    expect(parseValorBR("0,00")).toBe(0);
  });

  it("interpreta ponto como decimal quando não há vírgula", () => {
    expect(parseValorBR("12.34")).toBe(12.34);
  });

  it("interpreta ponto de milhar com vírgula decimal", () => {
    expect(parseValorBR("1.234,56")).toBe(1234.56);
    expect(parseValorBR("12.345,67")).toBe(12345.67);
  });

  it("ignora símbolos e espaços", () => {
    expect(parseValorBR("R$ 1.234,56")).toBe(1234.56);
  });

  it("retorna NaN para texto vazio", () => {
    expect(Number.isNaN(parseValorBR(""))).toBe(true);
  });
});

describe("formatValorBR", () => {
  it("formata com vírgula decimal e duas casas", () => {
    expect(formatValorBR(1234.5)).toBe("1.234,50");
    expect(formatValorBR(0)).toBe("0,00");
  });
});

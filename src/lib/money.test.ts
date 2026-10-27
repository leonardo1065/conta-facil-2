import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatValorBR, parseValorBR } from "./money";

describe("parseValorBR", () => {
  it("interpreta vírgula como decimal", () => {
    assert.equal(parseValorBR("12,50"), 12.5);
    assert.equal(parseValorBR("0,00"), 0);
  });

  it("interpreta ponto como decimal quando não há vírgula", () => {
    assert.equal(parseValorBR("12.34"), 12.34);
  });

  it("interpreta ponto de milhar com vírgula decimal", () => {
    assert.equal(parseValorBR("1.234,56"), 1234.56);
    assert.equal(parseValorBR("12.345,67"), 12345.67);
  });

  it("ignora símbolos e espaços", () => {
    assert.equal(parseValorBR("R$ 1.234,56"), 1234.56);
  });

  it("retorna NaN para texto vazio", () => {
    assert.ok(Number.isNaN(parseValorBR("")));
  });
});

describe("formatValorBR", () => {
  it("formata com vírgula decimal e duas casas", () => {
    assert.equal(formatValorBR(1234.5), "1.234,50");
    assert.equal(formatValorBR(0), "0,00");
  });
});

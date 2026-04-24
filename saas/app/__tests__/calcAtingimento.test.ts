import { describe, it, expect } from "vitest";
import { calcAtingimento, calcNota } from "../app/lib/calc";

// Casos da tabela de validação obrigatória (spec fórmula universal)
describe("calcAtingimento — tabela de validação", () => {
  it("meta=100 realizado=120 maior_melhor → 1.20", () => {
    expect(calcAtingimento(100, 120, "MAIOR_MELHOR")).toBeCloseTo(1.20);
  });

  it("meta=100 realizado=80 maior_melhor → 0.80", () => {
    expect(calcAtingimento(100, 80, "MAIOR_MELHOR")).toBeCloseTo(0.80);
  });

  it("meta=75 realizado=65 menor_melhor → 1.1333", () => {
    expect(calcAtingimento(75, 65, "MENOR_MELHOR")).toBeCloseTo(1.1333, 3);
  });

  it("meta=75 realizado=85 menor_melhor → 0.8667", () => {
    expect(calcAtingimento(75, 85, "MENOR_MELHOR")).toBeCloseTo(0.8667, 3);
  });

  it("meta=100 realizado=200 menor_melhor → 0.0 (piso)", () => {
    expect(calcAtingimento(100, 200, "MENOR_MELHOR")).toBe(0.0);
  });

  it("meta=-50 realizado=-30 maior_melhor → 1.40", () => {
    expect(calcAtingimento(-50, -30, "MAIOR_MELHOR")).toBeCloseTo(1.40);
  });

  it("meta=-50 realizado=-80 maior_melhor → 0.40", () => {
    expect(calcAtingimento(-50, -80, "MAIOR_MELHOR")).toBeCloseTo(0.40);
  });

  it("meta=-50 realizado=10 maior_melhor → 1.50 (cap no teto)", () => {
    expect(calcAtingimento(-50, 10, "MAIOR_MELHOR")).toBeCloseTo(1.50);
  });

  it("meta=100 realizado=-20 maior_melhor → 0.0 (piso)", () => {
    expect(calcAtingimento(100, -20, "MAIOR_MELHOR")).toBe(0.0);
  });

  it("meta=0 realizado=50 maior_melhor → 1.0 (bonusMetaZero)", () => {
    expect(calcAtingimento(0, 50, "MAIOR_MELHOR")).toBe(1.0);
  });

  it("meta=0 realizado=-10 maior_melhor → 0.0", () => {
    expect(calcAtingimento(0, -10, "MAIOR_MELHOR")).toBe(0.0);
  });
});

describe("calcAtingimento — parâmetros", () => {
  it("teto customizado reduz resultado", () => {
    expect(calcAtingimento(100, 200, "MAIOR_MELHOR", { teto: 1.2 })).toBeCloseTo(1.2);
  });

  it("piso customizado eleva resultado mínimo", () => {
    expect(calcAtingimento(100, 0, "MAIOR_MELHOR", { piso: 0.5 })).toBeCloseTo(0.5);
  });

  it("gatilho: abaixo retorna 0", () => {
    expect(calcAtingimento(100, 75, "MAIOR_MELHOR", { gatilho: 0.8 })).toBe(0.0);
  });

  it("gatilho: acima aplica normalmente", () => {
    expect(calcAtingimento(100, 90, "MAIOR_MELHOR", { gatilho: 0.8 })).toBeCloseTo(0.90);
  });

  it("bonusMetaZero customizado", () => {
    expect(calcAtingimento(0, 100, "MAIOR_MELHOR", { bonusMetaZero: 1.3 })).toBe(1.3);
  });

  it("meta=0 menor_melhor realizado=0 → bonusMetaZero", () => {
    expect(calcAtingimento(0, 0, "MENOR_MELHOR")).toBe(1.0);
  });

  it("meta=0 menor_melhor realizado>0 → 0", () => {
    expect(calcAtingimento(0, 10, "MENOR_MELHOR")).toBe(0.0);
  });
});

describe("calcAtingimento — PROJETO_MARCO", () => {
  it("realizado >= 1 → 1.0", () => {
    expect(calcAtingimento(1, 1, "PROJETO_MARCO")).toBe(1.0);
    expect(calcAtingimento(1, 5, "PROJETO_MARCO")).toBe(1.0);
  });

  it("realizado = 0 → 0.0", () => {
    expect(calcAtingimento(1, 0, "PROJETO_MARCO")).toBe(0.0);
  });
});

describe("calcNota — integração com calcAtingimento", () => {
  it("maior_melhor meta=100 realizado=120 → nota=120", () => {
    expect(calcNota({ tipo: "MAIOR_MELHOR", metaAlvo: 100 }, 120)).toBeCloseTo(120);
  });

  it("menor_melhor meta=100 realizado=80 → nota=120 (cap 150, mas padrão teto=1.5)", () => {
    expect(calcNota({ tipo: "MENOR_MELHOR", metaAlvo: 100 }, 80)).toBeCloseTo(120);
  });

  it("teto parametrizado no indicador", () => {
    expect(calcNota({ tipo: "MAIOR_MELHOR", metaAlvo: 100, teto: 1.2 }, 200)).toBeCloseTo(120);
  });

  it("faixas têm precedência sobre fórmula", () => {
    const ind = { tipo: "MAIOR_MELHOR", metaAlvo: 100, faixas: [{ de: 0, ate: 200, nota: 75 }] };
    expect(calcNota(ind, 120)).toBe(75);
  });

  it("sem metaAlvo → 0", () => {
    expect(calcNota({ tipo: "MAIOR_MELHOR" }, 100)).toBe(0);
  });
});

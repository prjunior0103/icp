import { describe, it, expect } from "vitest";
import { calcAtingimento, calcAtingimentoAuditado, calcNota } from "../app/lib/calc";

// Casos da tabela de validação obrigatória (spec fórmula universal)
describe("calcAtingimento — tabela de validação", () => {
  it("meta=100 realizado=120 maior_melhor → 1.20", () => {
    expect(calcAtingimento(100, 120, "maior_melhor")).toBeCloseTo(1.20);
  });

  it("meta=100 realizado=80 maior_melhor → 0.80", () => {
    expect(calcAtingimento(100, 80, "maior_melhor")).toBeCloseTo(0.80);
  });

  it("meta=75 realizado=65 menor_melhor → 1.1333", () => {
    expect(calcAtingimento(75, 65, "menor_melhor")).toBeCloseTo(1.1333, 3);
  });

  it("meta=75 realizado=85 menor_melhor → 0.8667", () => {
    expect(calcAtingimento(75, 85, "menor_melhor")).toBeCloseTo(0.8667, 3);
  });

  it("meta=100 realizado=200 menor_melhor → 0.0 (piso)", () => {
    expect(calcAtingimento(100, 200, "menor_melhor")).toBe(0.0);
  });

  it("meta=-50 realizado=-30 maior_melhor → 1.40", () => {
    expect(calcAtingimento(-50, -30, "maior_melhor")).toBeCloseTo(1.40);
  });

  it("meta=-50 realizado=-80 maior_melhor → 0.40", () => {
    expect(calcAtingimento(-50, -80, "maior_melhor")).toBeCloseTo(0.40);
  });

  it("meta=-50 realizado=10 maior_melhor → 1.50 (cap no teto)", () => {
    expect(calcAtingimento(-50, 10, "maior_melhor")).toBeCloseTo(1.50);
  });

  it("meta=100 realizado=-20 maior_melhor → 0.0 (piso)", () => {
    expect(calcAtingimento(100, -20, "maior_melhor")).toBe(0.0);
  });

  it("meta=0 realizado=50 maior_melhor → 1.0 (bonusMetaZero)", () => {
    expect(calcAtingimento(0, 50, "maior_melhor")).toBe(1.0);
  });

  it("meta=0 realizado=-10 maior_melhor → 0.0", () => {
    expect(calcAtingimento(0, -10, "maior_melhor")).toBe(0.0);
  });
});

describe("calcAtingimento — parâmetros", () => {
  it("teto customizado reduz resultado", () => {
    expect(calcAtingimento(100, 200, "maior_melhor", { teto: 1.2 })).toBeCloseTo(1.2);
  });

  it("piso customizado eleva resultado mínimo", () => {
    expect(calcAtingimento(100, 0, "maior_melhor", { piso: 0.5 })).toBeCloseTo(0.5);
  });

  it("gatilho: abaixo retorna 0", () => {
    expect(calcAtingimento(100, 75, "maior_melhor", { gatilho: 0.8 })).toBe(0.0);
  });

  it("gatilho: acima aplica normalmente", () => {
    expect(calcAtingimento(100, 90, "maior_melhor", { gatilho: 0.8 })).toBeCloseTo(0.90);
  });

  it("bonusMetaZero customizado", () => {
    expect(calcAtingimento(0, 100, "maior_melhor", { bonusMetaZero: 1.3 })).toBe(1.3);
  });

  it("meta=0 menor_melhor realizado=0 → bonusMetaZero", () => {
    expect(calcAtingimento(0, 0, "menor_melhor")).toBe(1.0);
  });

  it("meta=0 menor_melhor realizado>0 → 0", () => {
    expect(calcAtingimento(0, 10, "menor_melhor")).toBe(0.0);
  });
});

describe("calcAtingimento — callback de auditoria", () => {
  it("onAudit recebe todos os campos", () => {
    const audits: ReturnType<typeof calcAtingimentoAuditado>["auditoria"][] = [];
    calcAtingimento(100, 120, "maior_melhor", {
      onAudit: (a) => audits.push(a),
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].meta).toBe(100);
    expect(audits[0].realizado).toBe(120);
    expect(audits[0].polaridade).toBe("maior_melhor");
    expect(audits[0].atingimentoFinal).toBeCloseTo(1.2);
    expect(audits[0].timestamp).toBeDefined();
  });
});

describe("calcAtingimentoAuditado", () => {
  it("retorna atingimento e auditoria juntos", () => {
    const { atingimento, auditoria } = calcAtingimentoAuditado(100, 120, "maior_melhor");
    expect(atingimento).toBeCloseTo(1.2);
    expect(auditoria.atingimentoFinal).toBeCloseTo(1.2);
    expect(auditoria.piso).toBe(0);
    expect(auditoria.teto).toBe(1.5);
    expect(auditoria.gatilho).toBeNull();
    expect(auditoria.bonusMetaZero).toBe(1.0);
  });
});

describe("calcNota — integração com calcAtingimento", () => {
  it("maior_melhor meta=100 realizado=120 → nota=120", () => {
    expect(calcNota({ tipo: "MAIOR_MELHOR", metaAlvo: 100 }, 120)).toBeCloseTo(120);
  });

  it("menor_melhor meta=100 realizado=80 → nota=120", () => {
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

  it("PROJETO_MARCO realizado >= 1 → 100", () => {
    expect(calcNota({ tipo: "PROJETO_MARCO", metaAlvo: 1 }, 1)).toBe(100);
    expect(calcNota({ tipo: "PROJETO_MARCO", metaAlvo: 1 }, 5)).toBe(100);
  });

  it("PROJETO_MARCO realizado = 0 → 0", () => {
    expect(calcNota({ tipo: "PROJETO_MARCO", metaAlvo: 1 }, 0)).toBe(0);
  });
});

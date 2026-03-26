import { describe, it, expect } from "vitest";
import {
  calcularNota,
  calcularPremio,
  normalizarLinhaColaborador,
  parseSalario,
} from "../app/lib/calc";

// ─── calcularNota ─────────────────────────────────────────────────────────────

describe("calcularNota — MAIOR_MELHOR", () => {
  const tipo = "VOLUME_FINANCEIRO";
  const pol = "MAIOR_MELHOR";

  it("realizado = alvo → nota 100", () => {
    expect(calcularNota(tipo, pol, 100, 100, null, null)).toBe(100);
  });

  it("realizado > alvo sem cap → nota proporcional capped em 120", () => {
    expect(calcularNota(tipo, pol, 130, 100, null, null)).toBe(120);
  });

  it("realizado > alvo com metaMaxima → cap pelo máximo", () => {
    // alvo=100, max=120 → cap = 120%; realizado=130 → seria 130, cap em 120
    expect(calcularNota(tipo, pol, 130, 100, 80, 120)).toBe(120);
    // alvo=100, max=110 → cap = 110%; realizado=150 → capped em 110
    expect(calcularNota(tipo, pol, 150, 100, null, 110)).toBeCloseTo(110);
  });

  it("realizado < metaMinima → nota 0", () => {
    expect(calcularNota(tipo, pol, 70, 100, 80, null)).toBe(0);
  });

  it("realizado entre min e alvo → nota proporcional entre 0 e 100", () => {
    const nota = calcularNota(tipo, pol, 90, 100, 80, null);
    expect(nota).toBeGreaterThan(0);
    expect(nota).toBeLessThan(100);
    expect(nota).toBeCloseTo(90);
  });

  it("metaAlvo zero → retorna 0 (evitar divisão por zero)", () => {
    expect(calcularNota(tipo, pol, 100, 0, null, null)).toBe(0);
  });

  it("realizado negativo → nota 0", () => {
    expect(calcularNota(tipo, pol, -10, 100, null, null)).toBe(0);
  });
});

describe("calcularNota — MENOR_MELHOR", () => {
  const tipo = "CUSTO_PRAZO";
  const pol = "MENOR_MELHOR";

  it("realizado = alvo → nota 100", () => {
    expect(calcularNota(tipo, pol, 100, 100, null, null)).toBe(100);
  });

  it("realizado < alvo (melhor) → nota > 100, capped em 120", () => {
    // alvo=100, realizado=80 → 100/80*100 = 125, cap 120
    expect(calcularNota(tipo, pol, 80, 100, null, null)).toBe(120);
  });

  it("realizado > alvo (pior) → nota < 100", () => {
    // alvo=100, realizado=125 → 100/125*100 = 80
    expect(calcularNota(tipo, pol, 125, 100, null, null)).toBeCloseTo(80);
  });

  it("realizado > metaMaxima (teto) → nota 0", () => {
    // metaMaxima é o limite máximo aceitável (além disso = zero)
    expect(calcularNota(tipo, pol, 150, 100, null, 140)).toBe(0);
  });

  it("realizado = 0 → nota 120 (melhor possível)", () => {
    expect(calcularNota(tipo, pol, 0, 100, null, null)).toBe(120);
  });
});

describe("calcularNota — PROJETO_MARCO", () => {
  const tipo = "PROJETO_MARCO";
  const pol = "MAIOR_MELHOR";

  it("realizado >= 1 → nota 100 (entregue)", () => {
    expect(calcularNota(tipo, pol, 1, 1, null, null)).toBe(100);
    expect(calcularNota(tipo, pol, 5, 1, null, null)).toBe(100);
  });

  it("realizado = 0 → nota 0 (não entregue)", () => {
    expect(calcularNota(tipo, pol, 0, 1, null, null)).toBe(0);
  });

  it("sem cap de 120 (passe/falha)", () => {
    // Projeto marco não sofre cap adicional
    expect(calcularNota(tipo, pol, 1, 1, null, null)).toBe(100);
  });
});

// ─── calcularPremio ───────────────────────────────────────────────────────────

describe("calcularPremio", () => {
  it("fórmula base: salario * 12 * bonus% * nota% * peso%", () => {
    // salario=10000, bonus=15%, nota=100%, peso=100%
    // 10000 * 12 * 0.15 * 1.00 * 1.00 = 18000
    expect(calcularPremio(10000, 15, 100, 100)).toBeCloseTo(18000);
  });

  it("nota parcial reduz prêmio proporcionalmente", () => {
    // salario=10000, bonus=15%, nota=50%, peso=100%
    // 18000 * 0.50 = 9000
    expect(calcularPremio(10000, 15, 50, 100)).toBeCloseTo(9000);
  });

  it("peso parcial reduz prêmio proporcionalmente", () => {
    // salario=10000, bonus=15%, nota=100%, peso=50%
    // 18000 * 0.50 = 9000
    expect(calcularPremio(10000, 15, 100, 50)).toBeCloseTo(9000);
  });

  it("nota e peso parciais combinados", () => {
    // salario=10000, bonus=15%, nota=80%, peso=60%
    // 18000 * 0.80 * 0.60 = 8640
    expect(calcularPremio(10000, 15, 80, 60)).toBeCloseTo(8640);
  });

  it("nota 0 → prêmio 0", () => {
    expect(calcularPremio(10000, 15, 0, 100)).toBe(0);
  });

  it("salário zero → prêmio zero", () => {
    expect(calcularPremio(0, 15, 100, 100)).toBe(0);
  });

  it("nota acima de 100 (superação) gera prêmio superior ao alvo", () => {
    // nota=120% → prêmio 20% acima do target
    expect(calcularPremio(10000, 15, 120, 100)).toBeCloseTo(21600);
  });
});

// ─── normalizarLinhaColaborador ───────────────────────────────────────────────

describe("normalizarLinhaColaborador", () => {
  it("remove BOM do início das chaves", () => {
    const row = { "\uFEFFmatricula": "001", "nome": "João" };
    const result = normalizarLinhaColaborador(row);
    expect(result["matricula"]).toBe("001");
    expect(result["\uFEFFmatricula"]).toBeUndefined();
  });

  it("faz trim de chaves e valores", () => {
    const row = { "  matricula  ": "  001  ", " nome ": " João " };
    const result = normalizarLinhaColaborador(row);
    expect(result["matricula"]).toBe("001");
    expect(result["nome"]).toBe("João");
  });

  it("converte valores null/undefined para string vazia", () => {
    const row = { "gestorMatricula": null, "observacao": undefined };
    const result = normalizarLinhaColaborador(row);
    expect(result["gestorMatricula"]).toBe("");
    expect(result["observacao"]).toBe("");
  });

  it("preserva valores normais intactos", () => {
    const row = { "email": "joao@empresa.com", "cpf": "123.456.789-00" };
    const result = normalizarLinhaColaborador(row);
    expect(result["email"]).toBe("joao@empresa.com");
    expect(result["cpf"]).toBe("123.456.789-00");
  });
});

// ─── parseSalario ─────────────────────────────────────────────────────────────

describe("parseSalario", () => {
  it("parse número com ponto decimal", () => {
    expect(parseSalario("8000.50")).toBeCloseTo(8000.5);
  });

  it("parse número com vírgula decimal (formato BR)", () => {
    expect(parseSalario("8000,50")).toBeCloseTo(8000.5);
  });

  it("parse número inteiro como string", () => {
    expect(parseSalario("10000")).toBe(10000);
  });

  it("string vazia → 0", () => {
    expect(parseSalario("")).toBe(0);
  });

  it("valor inválido → 0", () => {
    expect(parseSalario("abc")).toBe(0);
  });
});

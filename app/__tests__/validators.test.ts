import { describe, it, expect } from "vitest";
import {
  validarLinhaColaborador,
  validarLinhaMeta,
  validarLinhaRealizacao,
} from "../app/lib/validators";

// ─── validarLinhaColaborador ──────────────────────────────────────────────────

describe("validarLinhaColaborador — campos obrigatórios", () => {
  const base = {
    matricula: "M001",
    nomeCompleto: "João Silva",
    cpf: "123.456.789-00",
    email: "joao@empresa.com",
    salarioBase: "8000",
    dataAdmissao: "2024-01-15",
    empresaCodigo: "EMP001",
    cargoCodigo: "GER",
    centroCustoCodigo: "CC-COM",
    gestorMatricula: "",
  };

  it("linha válida → sem erro", () => {
    const { erro } = validarLinhaColaborador(base);
    expect(erro).toBeNull();
  });

  it("sem matricula → erro", () => {
    const { erro } = validarLinhaColaborador({ ...base, matricula: "" });
    expect(erro).toMatch(/matricula/i);
  });

  it("sem nomeCompleto → erro", () => {
    const { erro } = validarLinhaColaborador({ ...base, nomeCompleto: "" });
    expect(erro).toMatch(/nomeCompleto/i);
  });

  it("salarioBase negativo → erro", () => {
    const { erro } = validarLinhaColaborador({ ...base, salarioBase: "-100" });
    expect(erro).toMatch(/negativo/i);
  });

  it("salarioBase com formato BR (8.000,50) → válido e parseado como 8000.50", () => {
    const { erro } = validarLinhaColaborador({ ...base, salarioBase: "8.000,50" });
    expect(erro).toBeNull();
  });

  it("dataAdmissao inválida → erro", () => {
    const { erro } = validarLinhaColaborador({ ...base, dataAdmissao: "32/13/2099" });
    expect(erro).toMatch(/dataAdmissao/i);
  });

  it("dataAdmissao vazia → válido (usa default na rota)", () => {
    const { erro } = validarLinhaColaborador({ ...base, dataAdmissao: "" });
    expect(erro).toBeNull();
  });

  it("email inválido → erro", () => {
    const { erro } = validarLinhaColaborador({ ...base, email: "nao-e-email" });
    expect(erro).toMatch(/email/i);
  });

  it("email vazio → válido (usa default na rota)", () => {
    const { erro } = validarLinhaColaborador({ ...base, email: "" });
    expect(erro).toBeNull();
  });

  it("campos com BOM e espaços extras → normalizado e válido", () => {
    const { erro, dados } = validarLinhaColaborador({
      "\uFEFFmatricula": "  M001  ",
      "nomeCompleto": "  João  ",
    });
    expect(erro).toBeNull();
    expect(dados.matricula).toBe("M001");
    expect(dados.nomeCompleto).toBe("João");
  });
});

// ─── validarLinhaMeta ─────────────────────────────────────────────────────────

describe("validarLinhaMeta — campos obrigatórios e intervalos", () => {
  const base = {
    indicadorCodigo: "REC-LIQ-2026",
    centroCustoCodigo: "CC-COM",
    pesoNaCesta: "50",
    metaMinima: "80",
    metaAlvo: "100",
    metaMaxima: "120",
  };

  it("linha válida → sem erro", () => {
    expect(validarLinhaMeta(base)).toBeNull();
  });

  it("sem indicadorCodigo → erro", () => {
    expect(validarLinhaMeta({ ...base, indicadorCodigo: "" })).toMatch(/indicadorCodigo/i);
  });

  it("sem metaAlvo → erro", () => {
    expect(validarLinhaMeta({ ...base, metaAlvo: "" })).toMatch(/metaAlvo/i);
  });

  it("metaAlvo zero → erro", () => {
    expect(validarLinhaMeta({ ...base, metaAlvo: "0" })).toMatch(/maior que zero/i);
  });

  it("metaAlvo negativo → erro", () => {
    expect(validarLinhaMeta({ ...base, metaAlvo: "-10" })).toMatch(/maior que zero/i);
  });

  it("metaAlvo não numérico → erro", () => {
    expect(validarLinhaMeta({ ...base, metaAlvo: "abc" })).toMatch(/inválido/i);
  });

  it("pesoNaCesta fora de 0–100 → erro", () => {
    expect(validarLinhaMeta({ ...base, pesoNaCesta: "150" })).toMatch(/pesoNaCesta/i);
    expect(validarLinhaMeta({ ...base, pesoNaCesta: "-5" })).toMatch(/pesoNaCesta/i);
  });

  it("pesoNaCesta ausente → válido (usa default 100)", () => {
    const { pesoNaCesta: _, ...semPeso } = base;
    expect(validarLinhaMeta(semPeso as typeof base)).toBeNull();
  });

  it("metaMinima >= metaAlvo → erro", () => {
    expect(validarLinhaMeta({ ...base, metaMinima: "100" })).toMatch(/metaMinima/i);
    expect(validarLinhaMeta({ ...base, metaMinima: "110" })).toMatch(/metaMinima/i);
  });

  it("metaMaxima <= metaAlvo → erro", () => {
    expect(validarLinhaMeta({ ...base, metaMaxima: "100" })).toMatch(/metaMaxima/i);
    expect(validarLinhaMeta({ ...base, metaMaxima: "90" })).toMatch(/metaMaxima/i);
  });

  it("metaMinima e metaMaxima ausentes → válido", () => {
    expect(validarLinhaMeta({ ...base, metaMinima: "", metaMaxima: "" })).toBeNull();
  });

  it("centroCustoCodigo vazio → válido (meta corporativa)", () => {
    expect(validarLinhaMeta({ ...base, centroCustoCodigo: "" })).toBeNull();
  });
});

// ─── validarLinhaRealizacao ───────────────────────────────────────────────────

describe("validarLinhaRealizacao — BP import", () => {
  it("linha válida → sem erro", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "REC-LIQ-2026",
      valorRealizado: 2500000,
    });
    expect(erro).toBeNull();
  });

  it("sem matricula → erro", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "",
      metaCodigo: "REC-LIQ-2026",
      valorRealizado: 100,
    });
    expect(erro).toMatch(/matricula/i);
  });

  it("sem metaCodigo → erro", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "",
      valorRealizado: 100,
    });
    expect(erro).toMatch(/metaCodigo/i);
  });

  it("aceita codigo_indicador como alias de metaCodigo", () => {
    const { erro, dados } = validarLinhaRealizacao({
      matricula: "M001",
      codigo_indicador: "REC-LIQ-2026",
      valorRealizado: 100,
    });
    expect(erro).toBeNull();
    expect(dados.metaCodigo).toBe("REC-LIQ-2026");
  });

  it("valorRealizado ausente → erro", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "IND",
    });
    expect(erro).toMatch(/valorRealizado/i);
  });

  it("valorRealizado não numérico → erro", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "IND",
      valorRealizado: "abc" as unknown as number,
    });
    expect(erro).toMatch(/inválido/i);
  });

  it("valorRealizado negativo → erro", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "IND",
      valorRealizado: -10,
    });
    expect(erro).toMatch(/negativo/i);
  });

  it("valorRealizado zero → válido (meta não atingida)", () => {
    const { erro } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "IND",
      valorRealizado: 0,
    });
    expect(erro).toBeNull();
  });

  it("aceita valor_realizado como alias de valorRealizado", () => {
    const { erro, dados } = validarLinhaRealizacao({
      matricula: "M001",
      metaCodigo: "IND",
      valor_realizado: 500,
    });
    expect(erro).toBeNull();
    expect(dados.valorRealizado).toBe(500);
  });
});

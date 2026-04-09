// Motor de cálculo ICP — funções puras

export interface FaixaIndicador { de: number; ate: number; nota: number; }

export interface IndicadorCalc {
  tipo: string;           // MAIOR_MELHOR | MENOR_MELHOR | PROJETO_MARCO
  metaMinima?: number | null;
  metaAlvo?: number | null;
  metaMaxima?: number | null;
  faixas?: FaixaIndicador[];
}

/** Calcula nota (0–120) dado o valor realizado e a config do indicador */
export function calcNota(ind: IndicadorCalc, valorRealizado: number): number {
  const { tipo, metaMinima, metaAlvo, metaMaxima, faixas } = ind;

  // Faixas têm precedência sobre cálculo linear
  if (faixas && faixas.length > 0) {
    const faixa = faixas.find(f => valorRealizado >= f.de && valorRealizado <= f.ate);
    return faixa ? faixa.nota : 0;
  }

  if (tipo === "PROJETO_MARCO") return valorRealizado >= 1 ? 100 : 0;

  if (!metaAlvo || metaAlvo === 0) return 0;

  let nota: number;
  if (tipo === "MAIOR_MELHOR") {
    nota = (valorRealizado / metaAlvo) * 100;
  } else {
    // MENOR_MELHOR
    nota = (metaAlvo / valorRealizado) * 100;
  }

  // Abaixo do mínimo → 0
  if (metaMinima != null && valorRealizado < metaMinima) return 0;

  // Teto 120
  return Math.min(nota, 120);
}

/** MID = nota × (peso do indicador no agrupamento / 100) */
export function calcMID(nota: number, pesoIndicadorNoAgrupamento: number): number {
  return nota * (pesoIndicadorNoAgrupamento / 100);
}

/** Atingimento do agrupamento = soma dos MIDs dos seus indicadores */
export function calcAtingimentoAgrupamento(
  indicadores: { nota: number; peso: number }[]
): number {
  return indicadores.reduce((sum, i) => sum + calcMID(i.nota, i.peso), 0);
}

/** Resultado do colaborador = soma(atingimentoAgrupamento × pesoNaCesta / 100) */
export function calcResultadoColaborador(
  agrupamentos: { atingimento: number; pesoNaCesta: number }[]
): number {
  return agrupamentos.reduce((sum, a) => sum + a.atingimento * (a.pesoNaCesta / 100), 0);
}

/** Prêmio projetado = salárioBase × target × (resultado / 100) */
export function calcPremio(salarioBase: number, target: number, resultado: number): number {
  return salarioBase * (target / 100) * (resultado / 100);
}

/** Gera os períodos de um ciclo de acordo com a periodicidade do indicador */
export function gerarPeriodos(
  anoFiscal: number,
  mesInicio: number,
  mesFim: number,
  periodicidade: string
): string[] {
  const periodos: string[] = [];
  if (periodicidade === "ANUAL") {
    return [`${anoFiscal}`];
  }
  if (periodicidade === "SEMESTRAL") {
    const s1 = mesInicio <= 6 ? 1 : 2;
    const s2 = mesFim >= 7 ? 2 : 1;
    for (let s = s1; s <= s2; s++) periodos.push(`${anoFiscal}-S${s}`);
    return periodos;
  }
  if (periodicidade === "TRIMESTRAL") {
    for (let m = mesInicio; m <= mesFim; m += 3) {
      const t = Math.ceil(m / 3);
      periodos.push(`${anoFiscal}-T${t}`);
    }
    return periodos;
  }
  // MENSAL
  for (let m = mesInicio; m <= mesFim; m++) {
    periodos.push(`${anoFiscal}-${String(m).padStart(2, "0")}`);
  }
  return periodos;
}

/** Agrega múltiplos valores pelo critério do indicador */
export function agregarRealizacoes(
  valores: number[],
  criterio: string
): number | null {
  if (valores.length === 0) return null;
  if (criterio === "SOMA") return valores.reduce((a, b) => a + b, 0);
  if (criterio === "MEDIA") return valores.reduce((a, b) => a + b, 0) / valores.length;
  // ULTIMA_POSICAO
  return valores[valores.length - 1];
}

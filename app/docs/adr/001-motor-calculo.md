# ADR 001 — Motor de Cálculo ICP

**Status:** Accepted  
**Data:** 2026-04-11  
**Contexto:** Decisões de design do motor de cálculo de notas e prêmios em `app/lib/calc.ts`

## Decisões

### 1. Teto de nota em 120%
Indicadores com atingimento acima de 120% da meta são truncados em 120. Evita distorção do prêmio por outliers.

### 2. Abaixo do mínimo → nota zero
Se o valor realizado for menor que `metaMinima`, a nota é 0 (não proporcional). Isso é um piso absoluto.

### 3. Tipo PROJETO_MARCO
Lógica binária: nota = 100 se realizado >= 1, senão 0. Não existe atingimento parcial.

### 4. Faixas (lookup table)
Quando um indicador tem faixas configuradas, a nota é determinada por lookup (não interpolação). A faixa é `de <= valor < ate`. Faixas sobrescrevem o cálculo linear.

### 5. MENOR_MELHOR
nota = (metaAlvo / valorRealizado) × 100. Quanto menor o realizado, melhor. Aplica teto de 120 e piso de `metaMinima`.

### 6. Critério de apuração temporal
- `ULTIMA_POSICAO`: usa o último período com dado
- `SOMA`: soma todos os períodos
- `MEDIA`: média simples dos períodos com dado

### 7. Indicadores compostos (numerador/divisor)
Calculados como: `agregarRealizacoes(numerador) / agregarRealizacoes(divisor)`. Se divisor = 0, resultado = null (sem nota).

### 8. MID (Medida de Impacto por Desempenho)
`MID = (nota / 100) × peso`. Representa quanto o indicador contribui para o atingimento total do agrupamento.

## Consequências
- Mudanças no motor afetam todos os cálculos retroativamente. **Qualquer alteração requer ADR atualizado.**
- Faixas têm precedência sobre cálculo linear — verificar se indicadores críticos têm faixas configuradas antes de interpretar notas.

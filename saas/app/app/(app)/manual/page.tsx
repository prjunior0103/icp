"use client";

import React, { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Users,
  Target,
  BarChart3,
  Calculator,
  Settings,
  ArrowRight,
  FileText,
  Shield,
  Play,
  RefreshCw,
  TrendingUp,
  Award,
  Layers,
  GitBranch,
} from "lucide-react";

// ────────────────────────────────────────────────
// Tipos e constantes
// ────────────────────────────────────────────────

type Perfil = "GUARDIÃO" | "BP" | "GESTOR" | "COLABORADOR" | "CLIENTE";

const PERFIL_BADGE: Record<Perfil, string> = {
  GUARDIÃO: "bg-purple-100 text-purple-800",
  BP: "bg-blue-100 text-blue-800",
  GESTOR: "bg-green-100 text-green-800",
  COLABORADOR: "bg-gray-100 text-gray-700",
  CLIENTE: "bg-yellow-100 text-yellow-800",
};

function Badge({ perfil }: { perfil: Perfil }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PERFIL_BADGE[perfil]}`}>
      {perfil}
    </span>
  );
}

// ────────────────────────────────────────────────
// Accordion
// ────────────────────────────────────────────────

interface AccordionSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  content: React.ReactNode;
}

function Accordion({ sections }: { sections: AccordionSection[] }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.id ?? null);
  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div key={s.id} className={`border-l-4 ${s.color} bg-white rounded-lg shadow-sm overflow-hidden`}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(open === s.id ? null : s.id)}
            aria-expanded={open === s.id}
          >
            <div className="flex items-center gap-3 font-semibold text-gray-800">
              {s.icon}
              {s.title}
            </div>
            {open === s.id ? (
              <ChevronUp size={16} className="text-gray-400 shrink-0" />
            ) : (
              <ChevronDown size={16} className="text-gray-400 shrink-0" />
            )}
          </button>
          {open === s.id && (
            <div className="px-5 pb-5 pt-1 text-sm text-gray-600 space-y-4 border-t border-gray-100">
              {s.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// Componentes auxiliares de conteúdo
// ────────────────────────────────────────────────

function InfoCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
      <div className="flex items-center gap-2 font-medium text-blue-800 mb-2">
        {icon}
        {title}
      </div>
      <div className="text-blue-700 space-y-1">{children}</div>
    </div>
  );
}

function WarnCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
      <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="text-amber-800">{children}</div>
    </div>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <code className="block font-mono text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-800">
      {children}
    </code>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Conteúdo das seções
// ────────────────────────────────────────────────

function SecaoVisaoGeral() {
  return (
    <>
      <p>
        O <strong>ICP (Incentivo de Curto Prazo)</strong> é um sistema de gestão de performance e cálculo de bônus
        baseado em metas individuais e coletivas. Permite definir indicadores, acompanhar apurações periódicas e calcular
        o prêmio de cada colaborador ao fim de um ciclo.
      </p>
      <div>
        <p className="font-medium text-gray-700 mb-2">Ciclo de vida do Ciclo Anual</p>
        <div className="flex flex-wrap items-center gap-2">
          {(["SETUP", "ATIVO", "ENCERRADO"] as const).map((s, i, arr) => (
            <React.Fragment key={s}>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                s === "SETUP" ? "bg-yellow-100 text-yellow-800" :
                s === "ATIVO" ? "bg-green-100 text-green-800" :
                "bg-gray-200 text-gray-600"
              }`}>{s}</span>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-gray-400" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <InfoCard title="Fluxo Geral" icon={<GitBranch size={14} />}>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Criar ciclo fiscal (ano)</li>
          <li>Importar áreas e colaboradores</li>
          <li>Definir indicadores e metas</li>
          <li>Abrir janelas de apuração periódicas</li>
          <li>Preencher Orçado/Realizado e anexar evidências</li>
          <li>Calcular resultados e prêmios automaticamente</li>
        </ol>
      </InfoCard>
    </>
  );
}

function SecaoPrimeirosPassos() {
  return (
    <>
      <div className="space-y-3">
        <Step n={1}>
          <strong>Criar ciclo:</strong> Acesse <em>Configurações → Ciclos</em> e clique em "Novo Ciclo". Informe o
          ano fiscal e configure o multiplicador salarial e o status inicial (SETUP).
        </Step>
        <Step n={2}>
          <strong>Importar áreas:</strong> Em <em>Configurações → Áreas</em>, use o template XLSX para importar
          as unidades organizacionais de forma massiva.
        </Step>
        <Step n={3}>
          <strong>Importar colaboradores:</strong> Em <em>Colaboradores → Importar</em>, faça o upload do arquivo
          XLSX com matrícula, nome, cargo, área e salário base. O sistema detecta movimentações automaticamente.
        </Step>
        <Step n={4}>
          <strong>Ativar o ciclo:</strong> Após configurar áreas e colaboradores, mude o status do ciclo para
          <strong> ATIVO</strong> para liberar as funcionalidades de metas e apuração.
        </Step>
      </div>
      <InfoCard title="Templates XLSX" icon={<FileText size={14} />}>
        <p>Baixe os modelos em <em>Configurações → Importações</em>. Preencha sem alterar os cabeçalhos das colunas.</p>
      </InfoCard>
    </>
  );
}

function SecaoMetas() {
  return (
    <>
      <div>
        <p className="font-medium text-gray-700 mb-2">Tipos de indicador</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { tipo: "MAIOR_MELHOR", desc: "Quanto maior o realizado, melhor a nota (ex: receita, vendas)." },
            { tipo: "MENOR_MELHOR", desc: "Quanto menor o realizado, melhor a nota (ex: custo, turnover)." },
            { tipo: "PROJETO_MARCO", desc: "100% se realizado ≥ 1; 0% caso contrário (sim/não)." },
            { tipo: "FAIXAS", desc: "Nota definida por intervalos customizados (ex: faixas de NPS)." },
            { tipo: "COMPOSTO", desc: "Combina outros indicadores com pesos próprios." },
          ].map(({ tipo, desc }) => (
            <div key={tipo} className="border border-gray-200 rounded-lg p-3">
              <p className="font-mono text-xs text-blue-700 mb-1">{tipo}</p>
              <p className="text-xs text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium text-gray-700 mb-2">Agrupamentos e pesos</p>
        <p>
          Indicadores são organizados em <strong>agrupamentos</strong> (ex: Financeiro, Operacional). Cada
          agrupamento tem um peso percentual na cesta total. A soma dos pesos deve ser 100%.
        </p>
      </div>
      <div>
        <p className="font-medium text-gray-700 mb-2">Atribuições</p>
        <ul className="space-y-1">
          <li><CheckCircle2 size={13} className="inline text-green-500 mr-1" /><strong>pesoNaCesta:</strong> percentual do indicador dentro do agrupamento</li>
          <li><CheckCircle2 size={13} className="inline text-green-500 mr-1" /><strong>Cascata:</strong> meta replicada de uma área para sub-áreas automaticamente</li>
        </ul>
      </div>
    </>
  );
}

function SecaoApuracao() {
  return (
    <>
      <p>
        A apuração ocorre em <strong>períodos</strong> (mensal, trimestral etc.) com janelas de preenchimento.
        Cada colaborador ou área deve informar os valores Orçado e Realizado dentro da janela aberta.
      </p>
      <div>
        <p className="font-medium text-gray-700 mb-2">Status da janela</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "ABERTA", color: "bg-green-100 text-green-800" },
            { label: "PRORROGADA", color: "bg-yellow-100 text-yellow-800" },
            { label: "FECHADA", color: "bg-red-100 text-red-800" },
          ].map(({ label, color }) => (
            <span key={label} className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Submissões só são aceitas em janelas ABERTA ou PRORROGADA. Um <em>Waiver</em> aprovado permite submissão mesmo com janela fechada.</p>
      </div>
      <InfoCard title="Evidências" icon={<FileText size={14} />}>
        <p>Anexe arquivos PDF ou Excel como comprovante do realizado. O sistema os vincula à submissão do período.</p>
      </InfoCard>
      <WarnCard>
        A aba <strong>Resultados</strong> exibe os cálculos automaticamente após o preenchimento. Não é necessário acionar nenhum botão de "calcular".
      </WarnCard>
    </>
  );
}

function SecaoMovimentacoes() {
  return (
    <>
      <p>
        O sistema detecta automaticamente movimentações ao importar colaboradores com alterações nos campos
        de área, cargo ou status.
      </p>
      <div>
        <p className="font-medium text-gray-700 mb-2">Tipos de movimentação</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "ADMISSAO",
            "DESLIGAMENTO",
            "MUDANCA_AREA",
            "MUDANCA_CARGO",
            "AFASTAMENTO",
            "RETORNO",
          ].map((t) => (
            <div key={t} className="font-mono text-xs bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-gray-700">
              {t}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium text-gray-700 mb-2">Tratamento de pendências</p>
        <p>
          Movimentações ficam com status <em>PENDENTE</em> até serem revisadas. Acesse{" "}
          <em>Colaboradores → Movimentações</em> para aprovar, rejeitar ou ajustar a data efetiva.
        </p>
      </div>
    </>
  );
}

const RELATORIOS = [
  { icon: <BarChart3 size={14} />, nome: "Resumo Geral", desc: "Visão consolidada de todos os indicadores do ciclo." },
  { icon: <Users size={14} />, nome: "Por Colaborador", desc: "Nota e prêmio individual de cada colaborador." },
  { icon: <Target size={14} />, nome: "Por Indicador", desc: "Desempenho histórico de cada meta." },
  { icon: <Award size={14} />, nome: "Ranking", desc: "Classificação de colaboradores por nota." },
  { icon: <TrendingUp size={14} />, nome: "Evolução", desc: "Tendência de realização ao longo dos períodos." },
  { icon: <Layers size={14} />, nome: "Por Área", desc: "Performance agregada por unidade organizacional." },
  { icon: <RefreshCw size={14} />, nome: "Movimentações", desc: "Histórico de admissões, desligamentos e transferências." },
  { icon: <Shield size={14} />, nome: "Auditoria", desc: "Registro de todas as ações do sistema (somente GUARDIÃO)." },
  { icon: <FileText size={14} />, nome: "Carta ICP", desc: "Documento de comunicação do prêmio ao colaborador." },
  { icon: <Calculator size={14} />, nome: "Cálculo Detalhado", desc: "Fórmulas e valores intermediários de cada indicador." },
  { icon: <Settings size={14} />, nome: "Configuração do Ciclo", desc: "Parâmetros definidos para o ciclo vigente." },
  { icon: <Play size={14} />, nome: "Simulação", desc: "Projeção de prêmios com valores hipotéticos." },
];

function SecaoRelatorios() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {RELATORIOS.map(({ icon, nome, desc }) => (
        <div key={nome} className="flex gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
          <div className="text-blue-600 mt-0.5 shrink-0">{icon}</div>
          <div>
            <p className="font-medium text-gray-800 text-sm">{nome}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecaoConfiguracoes() {
  return (
    <>
      <div>
        <p className="font-medium text-gray-700 mb-2">Gerenciamento de usuários</p>
        <p>
          Apenas <Badge perfil="GUARDIÃO" /> pode criar, editar ou desativar usuários. Acesse{" "}
          <em>Configurações → Usuários</em> para gerenciar acessos.
        </p>
      </div>
      <div>
        <p className="font-medium text-gray-700 mb-2">Carta ICP</p>
        <ul className="space-y-1">
          <li><CheckCircle2 size={13} className="inline text-green-500 mr-1" /><strong>Gatilho:</strong> nota mínima exigida para elegibilidade ao prêmio</li>
          <li><CheckCircle2 size={13} className="inline text-green-500 mr-1" /><strong>Regulador do Pool:</strong> fator multiplicador que ajusta o total do orçamento de prêmios</li>
          <li><CheckCircle2 size={13} className="inline text-green-500 mr-1" /><strong>Critérios:</strong> regras adicionais de elegibilidade (tempo de casa, avaliação de desempenho etc.)</li>
        </ul>
      </div>
    </>
  );
}

const PERFIS_TABELA: { perfil: Perfil; permissoes: string[] }[] = [
  {
    perfil: "GUARDIÃO",
    permissoes: [
      "Acesso total ao sistema",
      "Criar e encerrar ciclos",
      "Gerenciar usuários e perfis",
      "Configurar Carta ICP e regulador",
      "Ver relatório de auditoria",
      "Aprovar waivers",
    ],
  },
  {
    perfil: "BP",
    permissoes: [
      "Gerenciar metas e áreas sob sua responsabilidade",
      "Importar colaboradores",
      "Preencher apuração",
      "Visualizar relatórios das suas áreas",
    ],
  },
  {
    perfil: "GESTOR",
    permissoes: [
      "Visualizar metas e apuração da sua equipe",
      "Acompanhar resultados",
      "Ver relatórios da equipe",
    ],
  },
  {
    perfil: "COLABORADOR",
    permissoes: [
      "Visualizar suas próprias metas",
      "Ver seu cockpit pessoal",
      "Acompanhar nota e prêmio estimado",
    ],
  },
  {
    perfil: "CLIENTE",
    permissoes: [
      "Visualizar relatórios e dashboard",
      "Sem permissão de edição",
    ],
  },
];

function SecaoPerfis() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2 text-left font-medium text-gray-700">Perfil</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Permissões</th>
          </tr>
        </thead>
        <tbody>
          {PERFIS_TABELA.map(({ perfil, permissoes }) => (
            <tr key={perfil} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 align-top">
                <Badge perfil={perfil} />
              </td>
              <td className="px-4 py-3">
                <ul className="space-y-0.5">
                  {permissoes.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-gray-600">
                      <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecaoFormulas() {
  return (
    <>
      <div>
        <p className="font-medium text-gray-700 mb-2">Nota por tipo de indicador</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">MAIOR_MELHOR</p>
            <Formula>Nota = (Realizado / Meta) × 100</Formula>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">MENOR_MELHOR</p>
            <Formula>Nota = (Meta / Realizado) × 100</Formula>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">PROJETO_MARCO</p>
            <Formula>Nota = Realizado ≥ 1 ? 100 : 0</Formula>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">FAIXAS</p>
            <Formula>Nota = Nota definida pela faixa em que o realizado se enquadra</Formula>
          </div>
        </div>
      </div>
      <WarnCard>
        Nota máxima é limitada a <strong>120%</strong>. Nota abaixo do mínimo configurado resulta em <strong>0%</strong>.
      </WarnCard>
      <div>
        <p className="font-medium text-gray-700 mb-2">MID — Média Ponderada dos Indicadores</p>
        <Formula>MID = Σ (Nota_i × Peso_i) / Σ Peso_i</Formula>
      </div>
      <div>
        <p className="font-medium text-gray-700 mb-2">Prêmio Individual</p>
        <Formula>Prêmio = SalárioBase × Múltiplo × (MID / 100) × (PesoNaCesta / 100)</Formula>
      </div>
      <div>
        <p className="font-medium text-gray-700 mb-2">Gate mínimo</p>
        <p>
          Se o MID for inferior ao <em>gate mínimo</em> configurado, o prêmio é <strong>zero</strong>,
          independente das notas individuais.
        </p>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────

const SECTIONS: AccordionSection[] = [
  {
    id: "visao-geral",
    icon: <BookOpen size={16} className="text-blue-600" />,
    title: "1. Visão Geral",
    color: "border-blue-500",
    content: <SecaoVisaoGeral />,
  },
  {
    id: "primeiros-passos",
    icon: <Play size={16} className="text-green-600" />,
    title: "2. Primeiros Passos",
    color: "border-green-500",
    content: <SecaoPrimeirosPassos />,
  },
  {
    id: "metas",
    icon: <Target size={16} className="text-orange-600" />,
    title: "3. Metas e Indicadores",
    color: "border-orange-500",
    content: <SecaoMetas />,
  },
  {
    id: "apuracao",
    icon: <BarChart3 size={16} className="text-indigo-600" />,
    title: "4. Apuração",
    color: "border-indigo-500",
    content: <SecaoApuracao />,
  },
  {
    id: "movimentacoes",
    icon: <RefreshCw size={16} className="text-cyan-600" />,
    title: "5. Movimentações",
    color: "border-cyan-500",
    content: <SecaoMovimentacoes />,
  },
  {
    id: "relatorios",
    icon: <FileText size={16} className="text-violet-600" />,
    title: "6. Relatórios",
    color: "border-violet-500",
    content: <SecaoRelatorios />,
  },
  {
    id: "configuracoes",
    icon: <Settings size={16} className="text-gray-600" />,
    title: "7. Configurações",
    color: "border-gray-400",
    content: <SecaoConfiguracoes />,
  },
  {
    id: "perfis",
    icon: <Users size={16} className="text-pink-600" />,
    title: "8. Perfis de Acesso",
    color: "border-pink-500",
    content: <SecaoPerfis />,
  },
  {
    id: "formulas",
    icon: <Calculator size={16} className="text-red-600" />,
    title: "9. Fórmulas de Cálculo",
    color: "border-red-500",
    content: <SecaoFormulas />,
  },
];

export default function ManualPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <BookOpen size={24} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manual do Sistema ICP</h1>
          <p className="text-gray-500 text-sm mt-1">
            Guia completo de uso — Incentivo de Curto Prazo
          </p>
        </div>
      </div>

      {/* Perfis rápidos */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">Perfis:</span>
        {(["GUARDIÃO", "BP", "GESTOR", "COLABORADOR", "CLIENTE"] as Perfil[]).map((p) => (
          <Badge key={p} perfil={p} />
        ))}
      </div>

      {/* Accordion */}
      <Accordion sections={SECTIONS} />
    </div>
  );
}

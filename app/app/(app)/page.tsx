import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral do ciclo ICP</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {["Colaboradores", "Metas", "Indicadores", "Prêmio projetado"].map((label) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center text-center min-h-64">
        <LayoutDashboard size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Dashboard em construção</p>
        <p className="text-gray-400 text-sm mt-1">Os módulos serão adicionados nos próximos milestones</p>
      </div>
    </div>
  );
}

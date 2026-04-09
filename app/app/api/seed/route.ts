import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  try {
    const passwordHash = await hash("admin", 10);

    const admin = await prisma.user.upsert({
      where: { email: "admin@empresa.com" },
      update: {},
      create: {
        email: "admin@empresa.com",
        name: "Administrador",
        passwordHash,
        role: "GUARDIAO",
      },
    });

    const ciclo = await prisma.cicloICP.upsert({
      where: { anoFiscal: 2026 },
      update: {},
      create: {
        anoFiscal: 2026,
        status: "ATIVO",
        mesInicio: 1,
        mesFim: 12,
      },
    });

    await prisma.parametroSistema.upsert({
      where: { id: 1 },
      update: { cicloAtivoId: ciclo.id },
      create: { id: 1, cicloAtivoId: ciclo.id },
    });

    return NextResponse.json({
      message: "Seed concluído",
      admin: { email: admin.email, role: admin.role },
      ciclo: { anoFiscal: ciclo.anoFiscal, status: ciclo.status },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

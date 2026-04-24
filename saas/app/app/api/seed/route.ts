import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/app/lib/prisma";

async function runSeed() {
  const passwordHash = await hash("admin", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@empresa.com" },
    update: { passwordHash },
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

  return {
    message: "Seed concluído",
    admin: { email: admin.email, role: admin.role },
    ciclo: { anoFiscal: ciclo.anoFiscal, status: ciclo.status },
  };
}

export async function GET() {
  try {
    return NextResponse.json(await runSeed());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json(await runSeed());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

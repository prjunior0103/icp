import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO" && role !== "BP") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const usuarios = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ usuarios });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { name, email, password, userRole } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "nome, email e senha são obrigatórios" }, { status: 400 });

  const validRoles = ["GUARDIAO", "BP", "GESTOR", "COLABORADOR", "CLIENTE"];
  if (userRole && !validRoles.includes(userRole)) return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });

  const passwordHash = await hash(password, 10);
  const usuario = await prisma.user.create({
    data: { name, email, passwordHash, role: userRole ?? "COLABORADOR" },
    select: { id: true, name: true, email: true, role: true },
  });

  const auditUser = getAuditUser(session);
  await logAudit({ ...auditUser, entidade: "Usuario", entidadeId: usuario.id, acao: "CRIAR", descricao: `Usuário ${name} criado`, dadosNovos: { name, email, role: usuario.role } });

  return NextResponse.json({ usuario }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id, name, userRole, password } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const validRoles = ["GUARDIAO", "BP", "GESTOR", "COLABORADOR", "CLIENTE"];
  if (userRole && !validRoles.includes(userRole)) return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });

  const data: Record<string, string> = {};
  if (name) data.name = name;
  if (userRole) data.role = userRole;
  if (password) data.passwordHash = await hash(password, 10);

  const usuario = await prisma.user.update({
    where: { id: id },
    data,
    select: { id: true, name: true, email: true, role: true },
  });

  const auditUser = getAuditUser(session);
  await logAudit({ ...auditUser, entidade: "Usuario", entidadeId: usuario.id, acao: "EDITAR", descricao: `Usuário ${usuario.name} editado`, dadosNovos: data });

  return NextResponse.json({ usuario });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const sessionUser = session.user as { id?: string };
  if (String(sessionUser.id) === id) return NextResponse.json({ error: "Não é possível excluir o próprio usuário" }, { status: 400 });

  await prisma.user.delete({ where: { id: id } });
  return NextResponse.json({ ok: true });
}

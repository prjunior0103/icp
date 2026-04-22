import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const cicloId = formData.get("cicloId") as string | null;
  const indicadorId = formData.get("indicadorId") as string | null;

  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido. Use PDF ou Excel." }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 10MB." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const subDir = `uploads/${cicloId ?? "geral"}/${indicadorId ?? "ind"}`;
  const uploadDir = path.join(process.cwd(), "public", subDir);

  await mkdir(uploadDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(uploadDir, safeName), Buffer.from(bytes));

  const anexoPath = `/${subDir}/${safeName}`;
  return NextResponse.json({ anexoPath }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";
import { createSetupLink, currentUser, isRole, originOf, ROLES } from "@/lib/users";

// An admin changes a person's role, switches their account off or on, or
// makes a new setup link (for a forgotten password).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (me?.role !== "admin") return jsonError("Only admins can change the team.", 403);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("Person not found.", 404);
  const body = (await request.json().catch(() => ({}))) as { role?: string; active?: boolean; newLink?: boolean };

  const otherAdmins = await prisma.user.count({ where: { role: "admin", active: true, id: { not: id } } });
  const losesAdmin = (body.role !== undefined && body.role !== "admin") || body.active === false;
  if (user.role === "admin" && losesAdmin && otherAdmins === 0) return jsonError("The team needs at least one admin. Make someone else an admin first.");
  if (id === me.id && body.active === false) return jsonError("You cannot switch off your own account.");

  const data: { role?: string; active?: boolean } = {};
  if (body.role !== undefined && isRole(body.role)) data.role = body.role;
  if (typeof body.active === "boolean") data.active = body.active;
  if (Object.keys(data).length) await prisma.user.update({ where: { id }, data });

  if (data.role && data.role !== user.role) await logLearning("team", `${me.name} made ${user.name} ${ROLES.find((r) => r.key === data.role)?.label.toLowerCase()}.`);
  if (data.active === false && user.active) await logLearning("team", `${me.name} switched off ${user.name}'s account.`);
  if (data.active === true && !user.active) await logLearning("team", `${me.name} switched ${user.name}'s account back on.`);

  const setupUrl = body.newLink ? await createSetupLink(id, originOf(request)) : undefined;
  return NextResponse.json({ ok: true, setupUrl });
}

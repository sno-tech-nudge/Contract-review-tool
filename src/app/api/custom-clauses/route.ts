import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";
import { cleanCustomClause } from "@/lib/library/custom-input";
import { scopePhrase } from "@/lib/library/custom";
import { currentUser } from "@/lib/users";

// Add a clause to the clause library that reviews will check for.
export async function POST(request: Request) {
  const me = await currentUser();
  if (me?.role === "member") return jsonError("Only admins and legal reviewers can change the clause library.", 403);
  const data = cleanCustomClause((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (!data.name) return jsonError("Give the clause a name.");
  const clause = await prisma.customClause.create({ data: { ...data, createdBy: me?.kind === "person" ? me.name : "" } });
  await logLearning(
    "library",
    `Added "${data.name}" to the clause library. Reviews of ${scopePhrase({ contractTypes: data.contractTypes.split(";").filter(Boolean), entities: data.entities.split(";").filter(Boolean) })} now check for it.`
  );
  return NextResponse.json({ id: clause.id });
}

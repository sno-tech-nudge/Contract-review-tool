import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { accountCount, currentUser, MIN_PASSWORD, ROLES } from "@/lib/users";
import { TeamManager } from "@/components/team/TeamManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team · Contract review" };

export default async function TeamPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const [count, people] = await Promise.all([
    accountCount(),
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, active: true, passwordHash: true, setupExpires: true, lastSeenAt: true } }),
  ]);
  return (
    <TeamManager
      me={{ id: me.id, role: me.role, kind: me.kind }}
      firstAccount={count === 0}
      minPassword={MIN_PASSWORD}
      roles={ROLES}
      people={people.map(({ passwordHash, setupExpires, lastSeenAt, ...p }) => ({
        ...p,
        status: !p.active ? "off" : passwordHash ? "active" : setupExpires && setupExpires > new Date() ? "invited" : "expired",
        lastSeenAt: lastSeenAt?.toISOString() ?? null,
      }))}
    />
  );
}

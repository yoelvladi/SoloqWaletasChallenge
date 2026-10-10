import { Scoreboard } from "@/components/scoreboard";
import { requireUser } from "@/server/auth";
import { publicScoreboard } from "@/server/access-mode";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (publicScoreboard()) return <Scoreboard publicBoard />;
  const user = await requireUser();
  return <Scoreboard user={user} />;
}

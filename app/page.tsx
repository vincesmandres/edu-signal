import { requireChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <Dashboard user={{ displayName: user.displayName, email: user.email }} />;
}

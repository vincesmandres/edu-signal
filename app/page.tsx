import { requireRole } from "../lib/auth";
import { redirect } from "next/navigation";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await requireRole(["teacher", "student", "coordinator", "admin"]);
  if (profile.role === "student") redirect("/student");
  if (profile.role === "coordinator") redirect("/coordinator");
  if (profile.role === "admin") redirect("/admin");
  return <Dashboard user={{ displayName: profile.displayName, email: "" }} />;
}

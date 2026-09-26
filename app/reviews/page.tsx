import { requireRole } from "@/lib/auth";
import ReviewStudio from "./ReviewStudio";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const teacher = await requireRole("teacher", "/reviews");
  return <ReviewStudio teacherName={teacher.displayName} />;
}

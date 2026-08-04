import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type AiBinding = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
const moduleSchema = { type: "object", properties: { title: { type: "string" }, drivingQuestion: { type: "string" }, objectives: { type: "array", items: { type: "string" } }, sequence: { type: "array", items: { type: "object", properties: { phase: { type: "string" }, activity: { type: "string" }, evidence: { type: "string" } }, required: ["phase", "activity", "evidence"] } }, assessmentIdeas: { type: "array", items: { type: "string" } } }, required: ["title", "drivingQuestion", "objectives", "sequence", "assessmentIdeas"] };

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const ai = (env as unknown as { AI?: AiBinding }).AI;
  if (!ai) return Response.json({ error: "La IA de Cloudflare aún no está habilitada para este Worker." }, { status: 503 });
  const body = await request.json() as { subject?: string; grade?: string; context?: string; methodologies?: string[] };
  if (!body.subject?.trim() || !body.context?.trim()) return Response.json({ error: "Asignatura y contexto son obligatorios." }, { status: 400 });
  const prompt = `Eres un diseñador pedagógico para Edu Signal. Crea una propuesta breve y aplicable para ${body.subject.trim()}${body.grade ? `, nivel ${body.grade.trim()}` : ""}. Contexto: ${body.context.trim()}. Metodologías preferidas: ${(body.methodologies ?? ["ABP"]).join(", ")}. Devuelve únicamente JSON válido en español, sin markdown, siguiendo el esquema solicitado. Incluye una pregunta guía auténtica, objetivos observables, una secuencia de actividades y evidencias evaluables.`;
  try {
    const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", { prompt, response_format: { type: "json_schema", json_schema: moduleSchema } });
    const raw = typeof result === "object" && result !== null && "response" in result ? (result as { response: unknown }).response : result;
    const proposal = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Response.json({ proposal }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("ai_module_failed", error);
    return Response.json({ error: "No se pudo generar la propuesta." }, { status: 502 });
  }
}

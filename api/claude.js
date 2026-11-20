// Función de servidor: recibe las solicitudes de la página y llama a Claude con la clave guardada en el servidor.
// La clave (ANTHROPIC_API_KEY) nunca llega al navegador.
import Anthropic from "@anthropic-ai/sdk";

const MAX_PROMPT_CHARS = 250_000;
const MAX_IMAGES = 4;
const MAX_IMAGE_B64_CHARS = 1_400_000; // ~1 MB por imagen; el límite de Vercel es 4.5 MB por solicitud

let client = null;
function getClient() {
  if (!client) client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
  return client;
}

export default async function handler(req, res) {
  const enabled = Boolean(process.env.ANTHROPIC_API_KEY);
  const accessCode = process.env.APP_ACCESS_CODE || "";

  if (req.method === "GET") {
    return res.status(200).json({ enabled, needsCode: Boolean(accessCode) });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ code: "invalid_request", message: "Método no permitido" });
  }
  if (!enabled) {
    return res.status(503).json({ code: "sampling_disabled", message: "Falta configurar ANTHROPIC_API_KEY" });
  }
  if (accessCode && req.headers["x-access-code"] !== accessCode) {
    return res.status(401).json({ code: "not_granted", message: "Código de acceso incorrecto" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const images = Array.isArray(body.images) ? body.images : [];
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    return res.status(400).json({ code: "invalid_request", message: "Texto vacío o demasiado largo" });
  }
  if (images.length > MAX_IMAGES || images.some((d) => typeof d !== "string" || d.length > MAX_IMAGE_B64_CHARS)) {
    return res.status(400).json({ code: "image_rejected", message: "Demasiadas imágenes o imágenes muy grandes" });
  }

  const content = [
    ...images.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
    { type: "text", text: prompt },
  ];

  try {
    // Streaming para evitar cortes por tiempo en respuestas largas; se devuelve el mensaje completo.
    // fallbacks "default": si el modelo rechaza la solicitud, el servidor de Anthropic la reintenta con otro modelo.
    const stream = getClient().beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return res.status(422).json({ code: "refused", message: "Claude no pudo procesar este contenido" });
    }
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text.trim()) return res.status(502).json({ code: "empty_completion", message: "Respuesta vacía" });
    return res.status(200).json({ text, truncated: message.stop_reason === "max_tokens" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ code: "rate_limited", message: "Límite de uso alcanzado" });
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return res.status(500).json({ code: "sampling_disabled", message: "La clave de Anthropic no es válida" });
    }
    if (error instanceof Anthropic.BadRequestError) {
      return res.status(400).json({ code: "invalid_request", message: error.message });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(502).json({ code: "upstream_error", message: `Error ${error.status}` });
    }
    return res.status(502).json({ code: "upstream_error", message: "No se pudo conectar con Claude" });
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

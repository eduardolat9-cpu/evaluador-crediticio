// Intermediario gratuito (Cloudflare Workers) entre la página y Google Gemini.
// La clave vive solo aquí, como secreto (GEMINI_API_KEY): nunca llega al navegador ni al repositorio.
const ALLOWED_ORIGINS = ["https://eduardolat9-cpu.github.io"];
const GEM = "https://generativelanguage.googleapis.com/v1beta";
const MAX_BODY_CHARS = 6_000_000; // ~4 MB de imágenes en base64
const MAX_PARTS = 12;
const RATE_LIMIT = 20; // solicitudes por minuto y por IP (por instancia del Worker)

let modelCache = null;
const hits = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-access-code",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, message) =>
      new Response(JSON.stringify({ error: { code: status, message } }), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST" && request.method !== "GET") return reply(405, "Método no permitido");
    if (!allowed) return reply(403, "Origen no permitido");
    if (!env.GEMINI_API_KEY || !env.ACCESS_CODE) return reply(500, "Falta configurar GEMINI_API_KEY y ACCESS_CODE");

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
    if (recent.length >= RATE_LIMIT) return reply(429, "Demasiadas solicitudes; espera un minuto");
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();

    // Contraseña del propietario: sin ella no se usa la clave de Gemini. Se valida aquí, en el servidor.
    if (!sameText(request.headers.get("x-access-code") || "", env.ACCESS_CODE)) {
      return reply(401, "Código de acceso incorrecto");
    }
    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return reply(413, "Solicitud demasiado grande");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, "JSON inválido");
    }
    const contents = body && body.contents;
    if (!Array.isArray(contents) || contents.length === 0) return reply(400, "Falta contents");
    const parts = contents.flatMap((c) => (c && Array.isArray(c.parts) ? c.parts : []));
    if (parts.length === 0 || parts.length > MAX_PARTS) return reply(400, "Cantidad de partes no válida");

    // Solo se reenvían los campos esperados.
    const gc = body.generationConfig || {};
    const payload = {
      contents,
      generationConfig: {
        maxOutputTokens: Math.min(Number(gc.maxOutputTokens) || 32768, 32768),
        ...(gc.responseMimeType === "application/json" ? { responseMimeType: "application/json" } : {}),
      },
    };

    const model = env.GEMINI_MODEL || (await pickModel(env.GEMINI_API_KEY));
    const upstream = await fetch(`${GEM}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(payload),
    });
    if (upstream.status === 404) modelCache = null; // el modelo pudo retirarse: se vuelve a elegir
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  },
};

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Elige el modelo Flash estable más reciente disponible para la clave.
async function pickModel(key) {
  if (modelCache) return modelCache;
  try {
    const r = await fetch(`${GEM}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
    const j = await r.json();
    const ok = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name).replace(/^models\//, ""));
    const ver = (n) => {
      const m = n.match(/gemini-(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : 0;
    };
    const stable = ok
      .filter((n) => /flash/.test(n) && !/lite|preview|exp|image|tts|live|audio|thinking|embed/.test(n))
      .sort((a, b) => ver(b) - ver(a));
    const any = ok.filter((n) => /flash/.test(n) && !/image|tts|live|audio|embed/.test(n)).sort((a, b) => ver(b) - ver(a));
    modelCache = stable[0] || any[0] || "gemini-3.8-flash";
  } catch {
    modelCache = "gemini-3.8-flash";
  }
  return modelCache;
}

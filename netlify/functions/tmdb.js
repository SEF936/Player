// netlify/functions/tmdb.js
export default async (req) => {
  try {
    const TMDB_TOKEN = Netlify.env.get("TMDB_TOKEN"); // Netlify Functions runtime env :contentReference[oaicite:2]{index=2}
    if (!TMDB_TOKEN) {
      return new Response(JSON.stringify({ error: "TMDB_TOKEN missing" }), { status: 500 });
    }

    const url = new URL(req.url);
    const path = url.searchParams.get("path"); // ex: /search/movie
    if (!path || !path.startsWith("/")) {
      return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400 });
    }

// Allowlist (endpoints utilisés par l'app)
const allowed = [
  "/search/movie",
  "/search/tv",
  "/movie/",      // /movie/{id}
  "/tv/",         // /tv/{id} et /tv/{id}/season/.../episode/...
];

const ok = allowed.some((a) => (a.endsWith("/") ? path.startsWith(a) : path === a));
if (!ok) {
  return { statusCode: 403, body: JSON.stringify({ error: "Path not allowed", path }) };
}


    // Rebuild TMDB URL
    const tmdbUrl = new URL("https://api.themoviedb.org/3" + path);
    // Forward all other query params except path
    url.searchParams.forEach((v, k) => {
      if (k !== "path") tmdbUrl.searchParams.set(k, v);
    });

    const res = await fetch(tmdbUrl.toString(), {
      headers: {
        Authorization: `Bearer ${TMDB_TOKEN}`, // TMDB Bearer token auth :contentReference[oaicite:3]{index=3}
        "Content-Type": "application/json",
      },
    });

    const body = await res.text();

    // Option: cache côté client (Netlify ne cache pas par défaut les functions) :contentReference[oaicite:4]{index=4}
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // 1h (ajuste)
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
};

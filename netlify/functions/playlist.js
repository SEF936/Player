// netlify/functions/playlist.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      return { statusCode: 400, body: "Missing username/password" };
    }

    // 🔧 IMPORTANT: remplace par ton domaine/URL base (sans https obligatoire)
    // Exemple:
    // const BASE = "http://qwhfjjf.43:80";
    // const url = `${BASE}/get.php?...`
    const BASE = process.env.BASE_URL; // recommandé (env var Netlify)
    if (!BASE) {
      return { statusCode: 500, body: "Missing env BASE_URL" };
    }

    const u = new URL(BASE.replace(/\/+$/,"") + "/get.php");
    u.searchParams.set("username", username);
    u.searchParams.set("password", password);
    u.searchParams.set("type", "m3u_plus");
    u.searchParams.set("output", "mpegts");

    const url = u.toString();
    console.log("Fetching M3U:", url.replace(password, "******"));

    const res = await fetch(url, {
      headers: {
        "User-Agent": "netlify-function-playlist-fetch"
      }
    });

    const text = await res.text();

    // Certains providers renvoient 200 + html d'erreur, donc on garde le body pour debug
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text.slice(0, 2000) // limite debug
      };
    }

    // renvoie le fichier m3u brut
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: text
    };

  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};

// netlify/functions/playlist.js
const zlib = require("zlib");

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

    const BASE = process.env.BASE_URL;
    if (!BASE) {
      return { statusCode: 500, body: "Missing env BASE_URL" };
    }

    const u = new URL(BASE.replace(/\/+$/, "") + "/get.php");
    u.searchParams.set("username", username);
    u.searchParams.set("password", password);
    u.searchParams.set("type", "m3u_plus");
    u.searchParams.set("output", "mpegts");

    const url = u.toString();
    console.log("Fetching M3U:", url.replace(password, "******"));

    const res = await fetch(url, {
      headers: { "User-Agent": "netlify-playlist-fetch" },
    });
    const text = await res.text();

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text.slice(0, 2000),
      };
    }

    // ✅ gzip pour passer la limite Netlify
    const gz = zlib.gzipSync(Buffer.from(text, "utf-8"), { level: 9 });

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Content-Encoding": "gzip",
        "Cache-Control": "no-store",
      },
      body: gz.toString("base64"),
    };
  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};

/* metadata.js - TMDB provider (optionnel)
   L'app fonctionne sans token. Si tu ajoutes un token: infos Film/Série.
*/

(function(){


 async function get(path, params = {}) {
  const url = new URL("/.netlify/functions/tmdb", window.location.origin);
  url.searchParams.set("path", path);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString());
 if (!res.ok) {
  const t = await res.text().catch(() => "");
  console.warn("TMDB proxy error", res.status, "path=", path, "resp=", t);
  throw new Error(`TMDB proxy ${res.status}`);
}
  return res.json();
}


  function cleanTitle(t){
    let s = String(t||"").trim();
    s = s.replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, "");
    s = s.replace(/\((multi|vf|vostfr|vo|fr)\)/gi, "");
    s = s.replace(/\b(4k|uhd|fhd|hd|webrip|web-dl|bluray|x264|x265|hevc)\b/gi, "");
    s = s.replace(/\s+/g," ").trim();
    return s;
  }
  function yearFromTitle(t){
    const m = String(t||"").match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
  }
  function genresStr(genres){
    return (genres||[]).map(g=>g.name).filter(Boolean).join(" / ");
  }
  function castStr(credits){
    const cast = credits?.cast || [];
    return cast.slice(0,8).map(x=>x.name).filter(Boolean).join(", ");
  }
  function director(credits){
    const crew = credits?.crew || [];
    return crew.find(x=>x.job==="Director")?.name || "";
  }
  function creators(tv){
    const cr = tv?.created_by || [];
    return cr.slice(0,2).map(x=>x.name).filter(Boolean).join(", ");
  }
  function img(path, size="w500"){
    return path ? `${API.img}${size}${path}` : "";
  }

Metadata.getMovie = async (rawTitle) => {
  const original = String(rawTitle || "").trim();

  // variantes de query (du plus strict au plus large)
  const year = yearFromTitle(original);
  const base = cleanTitle(original);

  const variants = [];
  const push = (s) => {
    s = String(s || "").trim();
    if (s && !variants.includes(s)) variants.push(s);
  };

  push(base);
  push(base.replace(/\([^)]*\)/g, "").trim());            // enlever ( ... )
  push(base.replace(/\b(19\d{2}|20\d{2})\b/g, "").trim()); // enlever années résiduelles
  push(base.split(" - ")[0].trim());                      // avant " - "
  push(base.split(":")[0].trim());                        // avant ":"
  push(original.replace(/\([^)]*\)/g, "").trim());         // très large

  // petit cache (si tu veux)
  const cacheKey = `tmdb:movie:${base}:${year || ""}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && cached.title) return cached;
  } catch {}

  // helper de scoring
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const qNorm = norm(base);

  function scoreMovie(r) {
    const title = norm(r.title || r.original_title || "");
    const y = (r.release_date || "").slice(0, 4);
    let score = 0;

    // similarité simple
    if (title === qNorm) score += 100;
    if (title.includes(qNorm)) score += 40;
    if (qNorm.includes(title) && title.length > 3) score += 20;

    // année proche si dispo
    if (year && y) {
      const dy = Math.abs(Number(y) - Number(year));
      score += Math.max(0, 25 - dy * 6);
    }

    // popularité/vote (bonus léger)
    score += Math.min(10, (r.popularity || 0) / 50);
    score += Math.min(10, (r.vote_count || 0) / 500);

    return score;
  }

  async function searchOnce(query, useYear) {
    const params = {
      query,
      language: API.language,
      include_adult: "false"
    };
    if (useYear && year) params.year = String(year);

    const s = await get("/search/movie", params);
    const results = s?.results || [];
    if (!results.length) return null;

    // choisir le meilleur via score
    let best = results[0];
    let bestScore = scoreMovie(best);

    for (const r of results.slice(1, 12)) {
      const sc = scoreMovie(r);
      if (sc > bestScore) {
        best = r; bestScore = sc;
      }
    }
    return best;
  }

  // 1) strict: variantes + année
  let best = null;
  for (const v of variants) {
    best = await searchOnce(v, true);
    if (best) break;
  }

  // 2) fallback: variantes sans année
  if (!best) {
    for (const v of variants) {
      best = await searchOnce(v, false);
      if (best) break;
    }
  }

  if (!best) throw new Error("No match movie");

  const m = await get(`/movie/${best.id}`, {
    language: API.language,
    append_to_response: "credits"
  });

  const payload = {
    kind: "movie",
    title: m.title || base,
    year: (m.release_date || "").slice(0, 4) || (year ? String(year) : ""),
    date: (m.release_date || "").slice(0, 10) || "",
    runtime: m.runtime || null,
    genres: genresStr(m.genres),
    overview: m.overview || "",
    director: director(m.credits),
    vote: typeof m.vote_average === "number" ? m.vote_average : null,
    poster: img(m.poster_path, "w500"),
    backdrop: img(m.backdrop_path, "w1280"),
    castList: (m.credits?.cast || []).slice(0, 12).map(p => ({
      name: p.name,
      profile: p.profile_path ? img(p.profile_path, "w185") : ""
    })),
    cast: castStr(m.credits)
  };

  try { localStorage.setItem(cacheKey, JSON.stringify(payload)); } catch {}
  return payload;
};


  Metadata.getShow = async (rawTitle) => {
    const year = yearFromTitle(rawTitle);
    const title = cleanTitle(rawTitle);

    const s = await get("/search/tv", { query: title, first_air_date_year: year || "", language: API.language });
    const best = s?.results?.[0];
    if(!best) throw new Error("No match tv");

    const tv = await get(`/tv/${best.id}`, { language: API.language, append_to_response: "credits" });

    return {
      kind: "tv",
      title: tv.name || title,
      year: (tv.first_air_date||"").slice(0,4) || (year?String(year):""),
      date: (tv.first_air_date||"").slice(0,10) || "",
      genres: genresStr(tv.genres),
      overview: tv.overview || "",
      cast: castStr(tv.credits),
      creator: creators(tv) || director(tv.credits),
      poster: img(tv.poster_path, "w500"),
    };
  };
Metadata.getShowPoster = async (rawTitle) => {
  const year = yearFromTitle(rawTitle);
  const title = cleanTitle(rawTitle);

  const cacheKey = `tmdb:tvposter:${title}:${year || ""}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && cached.poster) return cached.poster;
  } catch {}

  const s = await get("/search/tv", {
    query: title,
    first_air_date_year: year || "",
    language: API.language
  });

  const best = s?.results?.[0];
  if (!best) throw new Error("No match tv");

  const poster = best.poster_path ? img(best.poster_path, "w500") : "";

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ poster }));
  } catch {}

  return poster;
};

Metadata.getMoviePoster = async (rawTitle) => {
  const original = String(rawTitle || "").trim();
  const year = yearFromTitle(original);
  const base = cleanTitle(original);

  // cache (poster only)
  const cacheKey = `tmdb:movieposter:${base}:${year || ""}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && cached.poster) return cached.poster;
  } catch {}

  const variants = [];
  const push = (s) => {
    s = String(s || "").trim();
    if (s && !variants.includes(s)) variants.push(s);
  };

  push(base);
  push(base.replace(/\([^)]*\)/g, "").trim());
  push(base.replace(/\b(19\d{2}|20\d{2})\b/g, "").trim());
  push(base.split(" - ")[0].trim());
  push(base.split(":")[0].trim());

  async function searchOnce(query, useYear) {
    const params = { query, language: API.language, include_adult: "false" };
    if (useYear && year) params.year = String(year);
    const s = await get("/search/movie", params);
    const results = s?.results || [];
    return results[0] || null;
  }

  // 1) strict: variantes + year
  let best = null;
  for (const v of variants) {
    best = await searchOnce(v, true);
    if (best) break;
  }
  // 2) fallback: variantes sans year
  if (!best) {
    for (const v of variants) {
      best = await searchOnce(v, false);
      if (best) break;
    }
  }
  if (!best) throw new Error("No match movie");

  const poster = best.poster_path ? img(best.poster_path, "w500") : "";

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ poster }));
  } catch {}

  return poster;
};

  window.Metadata = Metadata;
})();

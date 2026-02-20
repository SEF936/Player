// src/services/metadata.js
const API = {
  language: "fr-FR",
  img: "https://image.tmdb.org/t/p/",
};

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

function img(path, size = "w500") {
  return path ? `${API.img}${size}${path}` : "";
}

function cleanTitle(t) {
  let s = String(t || "").trim();
  s = s.replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, "");
  s = s.replace(/\((multi|vf|vostfr|vo|fr)\)/gi, "");
  s = s.replace(/\b(4k|3d|uhd|fhd|hd|webrip|web-dl|bluray|x264|x265|hevc)\b/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
function yearFromTitle(t) {
  const m = String(t || "").match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}
function genresStr(genres) {
  return (genres || []).map(g => g.name).filter(Boolean).join(" / ");
}
function castStr(credits) {
  const cast = credits?.cast || [];
  return cast.slice(0, 10).map(x => x.name).filter(Boolean).join(", ");
}
function director(credits) {
  const crew = credits?.crew || [];
  return crew.find(x => x.job === "Director")?.name || "";
}
function creators(tv) {
  const cr = tv?.created_by || [];
  return cr.slice(0, 2).map(x => x.name).filter(Boolean).join(", ");
}

function normBasic(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --- PUBLIC API ---
export const Metadata = {
  setLanguage(lang = "fr-FR") {
    API.language = lang;
  },

  // ✅ Poster-only MOVIE (FAST) -> grid
  async getMoviePoster(rawTitle, { size = "w342" } = {}) {
    const original = String(rawTitle || "").trim();
    const year = yearFromTitle(original);
    const base = cleanTitle(original);

    const variants = [];
    const push = (s) => {
      s = String(s || "").trim();
      if (s && !variants.includes(s)) variants.push(s);
    };

    push(base);
    push(base.replace(/\([^)]*\)/g, "").trim());
    push(base.replace(/\b(19\d{2}|20\d{2})\b/g, "").trim());
    push(base.split(" - ")[0]?.trim());
    push(base.split(":")[0]?.trim());
    push(original.replace(/\([^)]*\)/g, "").trim());

    const qNorm = normBasic(base);

    function scoreMovie(r) {
      const title = normBasic(r.title || r.original_title || "");
      const y = (r.release_date || "").slice(0, 4);
      let score = 0;
      if (title === qNorm) score += 120;
      if (title.includes(qNorm)) score += 50;
      if (qNorm.includes(title) && title.length > 3) score += 20;

      if (year && y) {
        const dy = Math.abs(Number(y) - Number(year));
        score += Math.max(0, 30 - dy * 8);
      }

      score += Math.min(10, (r.popularity || 0) / 50);
      score += Math.min(10, (r.vote_count || 0) / 500);
      return score;
    }

    async function searchOnce(query, lang, useYear) {
      const params = { query, language: lang, include_adult: "false" };
      if (useYear && year) params.year = String(year);

      const s = await get("/search/movie", params);
      const results = s?.results || [];
      if (!results.length) return null;

      let best = results[0];
      let bestScore = scoreMovie(best);
      for (const r of results.slice(1, 12)) {
        const sc = scoreMovie(r);
        if (sc > bestScore) { best = r; bestScore = sc; }
      }
      return best;
    }

    async function findBest(lang) {
      for (const v of variants) {
        const best = await searchOnce(v, lang, true);
        if (best) return best;
      }
      for (const v of variants) {
        const best = await searchOnce(v, lang, false);
        if (best) return best;
      }
      return null;
    }

    let best = await findBest(API.language);
    if (!best) best = await findBest("en-US");
    if (!best?.poster_path) return "";

    return img(best.poster_path, size);
  },

  // ✅ Poster-only TV (FAST) -> grid
  async getShowPoster(rawTitle, { size = "w342" } = {}) {
    const year = yearFromTitle(rawTitle);
    const title = cleanTitle(rawTitle);

    async function searchOnce(lang) {
      const s = await get("/search/tv", {
        query: title,
        language: lang,
        first_air_date_year: year ? String(year) : ""
      });
      return s?.results?.[0] || null;
    }

    let best = await searchOnce(API.language);
    if (!best) best = await searchOnce("en-US");
    if (!best?.poster_path) return "";

    return img(best.poster_path, size);
  },

  // ----------------------------
  // FULL DETAILS (pour pages détail)
  // ----------------------------
  async getMovie(rawTitle) {
    const original = String(rawTitle || "").trim();
    const year = yearFromTitle(original);
    const base = cleanTitle(original);

    const variants = [];
    const push = (s) => {
      s = String(s || "").trim();
      if (s && !variants.includes(s)) variants.push(s);
    };

    push(base);
    push(base.replace(/\([^)]*\)/g, "").trim());
    push(base.replace(/\b(19\d{2}|20\d{2})\b/g, "").trim());
    push(base.split(" - ")[0]?.trim());
    push(base.split(":")[0]?.trim());
    push(original.replace(/\([^)]*\)/g, "").trim());

    const qNorm = normBasic(base);

    function scoreMovie(r) {
      const title = normBasic(r.title || r.original_title || "");
      const y = (r.release_date || "").slice(0, 4);
      let score = 0;

      if (title === qNorm) score += 120;
      if (title.includes(qNorm)) score += 50;
      if (qNorm.includes(title) && title.length > 3) score += 20;

      if (year && y) {
        const dy = Math.abs(Number(y) - Number(year));
        score += Math.max(0, 30 - dy * 8);
      }

      score += Math.min(10, (r.popularity || 0) / 50);
      score += Math.min(10, (r.vote_count || 0) / 500);

      return score;
    }

    async function searchOnce(query, lang, useYear) {
      const params = { query, language: lang, include_adult: "false" };
      if (useYear && year) params.year = String(year);

      const s = await get("/search/movie", params);
      const results = s?.results || [];
      if (!results.length) return null;

      let best = results[0];
      let bestScore = scoreMovie(best);

      for (const r of results.slice(1, 12)) {
        const sc = scoreMovie(r);
        if (sc > bestScore) { best = r; bestScore = sc; }
      }

      return best;
    }

    async function findBest(lang) {
      for (const v of variants) {
        const best = await searchOnce(v, lang, true);
        if (best) return best;
      }
      for (const v of variants) {
        const best = await searchOnce(v, lang, false);
        if (best) return best;
      }
      return null;
    }

    let best = await findBest(API.language);
    if (!best) best = await findBest("en-US");
    if (!best) throw new Error("No match movie");

    const m = await get(`/movie/${best.id}`, {
      language: API.language,
      append_to_response: "credits"
    });

    return {
      kind: "movie",
      id: m.id,
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
      cast: castStr(m.credits),
      castList: (m.credits?.cast || []).slice(0, 12).map(p => ({
        name: p.name,
        profile: p.profile_path ? img(p.profile_path, "w185") : ""
      }))
    };
  },

  async getShow(rawTitle) {
    const year = yearFromTitle(rawTitle);
    const title = cleanTitle(rawTitle);

    const s = await get("/search/tv", {
      query: title,
      language: API.language,
      first_air_date_year: year ? String(year) : ""
    });
    const best = s?.results?.[0];
    if (!best) throw new Error("No match tv");

    const tv = await get(`/tv/${best.id}`, {
      language: API.language,
      append_to_response: "credits"
    });

    return {
      kind: "tv",
      id: tv.id,
      title: tv.name || title,
      year: (tv.first_air_date || "").slice(0, 4) || (year ? String(year) : ""),
      date: (tv.first_air_date || "").slice(0, 10) || "",
      genres: genresStr(tv.genres),
      overview: tv.overview || "",
      cast: castStr(tv.credits),
      creator: creators(tv) || "",
      poster: img(tv.poster_path, "w500"),
      backdrop: img(tv.backdrop_path, "w1280")
    };
  }
};

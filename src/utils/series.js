// ---- Helpers séries IPTV ----

// Supprime S01 E02 du titre
export function normalizeShowKey(name){
  return String(name || "")
    .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, "")
    .trim()
    .toLowerCase();
}

// Extrait saison / épisode
export function extractSE(name){
  const m = String(name || "").match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
  return m
    ? { season: Number(m[1]), episode: Number(m[2]) }
    : null;
}

// Regroupe épisodes → séries
export function buildShows(seriesItems){
  const map = new Map();

  for(const it of seriesItems){
    const showKey = normalizeShowKey(it.name);
    const se = extractSE(it.name) || { season:1, episode:1 };

    if(!map.has(showKey)){
      map.set(showKey, {
        showKey,
        showName: String(it.name)
          .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, "")
          .trim(),
        logo: it.logo || "",
        groupTitle: (it.groupTitle || "Autres").trim() || "Autres",
        seasons: new Map(),
        totalEpisodes: 0,
        minIdx: it.__idx
      });
    }

    const show = map.get(showKey);

    if(!show.seasons.has(se.season)){
      show.seasons.set(se.season, []);
    }

    show.seasons.get(se.season).push(it);
    show.totalEpisodes++;
    show.minIdx = Math.min(show.minIdx, it.__idx);
  }

  // Conserver ordre playlist
  const shows = Array.from(map.values())
    .sort((a,b)=>a.minIdx - b.minIdx);

  // Trier épisodes dans chaque saison
  for(const show of shows){
    for(const [season, eps] of show.seasons.entries()){
      eps.sort((a,b)=>(a.__idx ?? 0) - (b.__idx ?? 0));
      show.seasons.set(season, eps);
    }
  }

  return shows;
}

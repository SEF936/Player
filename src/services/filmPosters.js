// src/services/filmPosters.js
import { Metadata } from "./metadata.js";
import { PosterCache } from "./posterCache.js";
import { state } from "../state.js"; // adapte le chemin selon ton projet

let running = false;

const CONCURRENCY = 6; // bon compromis perf/quotas
const GRID_SIZE = "w342"; // plus léger que w500 pour la grille

function toGridSize(url) {
  // si ton metadata renvoie w500 par défaut, on convertit
  if (!url) return "";
  return url.replace("/w500/", `/${GRID_SIZE}/`).replace("/w780/", `/${GRID_SIZE}/`);
}



function setPoster(imgEl, url){
  const posterBox = imgEl.closest(".poster");
  if(url){
    imgEl.src = url;
    imgEl.style.display = "block";
    posterBox?.classList.remove("noposter");

    // ✅ mémorise dans state (évite re-hydrate au retour)
    const card = imgEl.closest(".mediaCard");
    const idx = card?.dataset?.idx;
    if(idx) state.posterByIdx[idx] = url;

  }else{
    posterBox?.classList.add("noposter");
  }
}


// mini pool de promesses (limite de parallélisme)
async function runPool(tasks, limit = CONCURRENCY) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      await tasks[idx]();
    }
  });
  await Promise.all(workers);
}

export async function hydrateFilmPosters(containerEl, { batch = 30 } = {}) {
  if (running) return;
  running = true;

  try {
const imgs = Array.from(containerEl.querySelectorAll("img.filmPosterImg"))
  .filter(img => {
    // si déjà traité
    if (img.dataset.done) return false;

    // si déjà un src (poster déjà injecté depuis state ou cache)
    if (img.getAttribute("src")) {
      img.dataset.done = "1";
      return false;
    }

    return true;
  })
  .slice(0, batch);


    const tasks = imgs.map((img) => async () => {
      img.dataset.done = "1";

      const title = img.dataset.movietitle || "";
      const year = img.dataset.movieyear || ""; // optionnel
      const m3uLogo = img.dataset.m3ulogo || "";

      if (!title) {
        setPoster(img, m3uLogo || "");
        return;
      }

      const key = PosterCache.makeKey("movie", title, year);

      // 1) cache
      const cached = PosterCache.get(key);
      if (cached) {
        setPoster(img, cached);
        return;
      }

      // 2) TMDB poster-only (beaucoup plus rapide)
      try {
        let poster = "";

        // 👉 si tu as getMoviePoster, on l’utilise
        if (typeof Metadata.getMoviePoster === "function") {
          poster = await Metadata.getMoviePoster(title);
        } else {
          // fallback compat si tu n’as que getMovie (moins optimal)
          const meta = await Metadata.getMovie(title);
          poster = meta?.poster || "";
        }

        poster = toGridSize(poster);

        if (poster) {
          PosterCache.set(key, poster);
          setPoster(img, poster);
        } else {
          // 3) fallback m3u
          setPoster(img, m3uLogo || "");
        }
      } catch (e) {
        // 3) fallback m3u
        setPoster(img, m3uLogo || "");
      }
    });

    // ⚡️ parallélisation contrôlée
    await runPool(tasks, CONCURRENCY);
  } finally {
    running = false;

    // relance si il reste des posters à hydrater
    const remaining = containerEl.querySelector(
      "img.filmPosterImg:not([data-done])"
    );
    if (remaining) setTimeout(() => hydrateFilmPosters(containerEl, { batch }), 80);
  }
}


// src/services/seriesPosters.js
import { Metadata } from "./metadata.js";
import { PosterCache } from "./posterCache.js";
import { state } from "../state.js"; // adapte le chemin

let running = false;

const CONCURRENCY = 6;
const GRID_SIZE = "w342";



function setPoster(imgEl, url){
  const posterBox = imgEl.closest(".poster");
  if(url){
    imgEl.src = url;
    imgEl.style.display = "block";
    posterBox?.classList.remove("noposter");

    const card = imgEl.closest(".mediaCard");
    const key = card?.dataset?.showkey;
    if(key) state.posterByShowKey[key] = url;

  }else{
    posterBox?.classList.add("noposter");
  }
}


async function runPool(tasks, limit = CONCURRENCY){
  let i = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async ()=>{
    while(i < tasks.length){
      const idx = i++;
      await tasks[idx]();
    }
  });
  await Promise.all(workers);
}

export async function hydrateSeriesPosters(containerEl, { batch=30 } = {}){
  if(running) return;
  running = true;

  try{
    const imgs = Array.from(containerEl.querySelectorAll("img.seriesPosterImg"))
      .filter(img => !img.dataset.done)
      .slice(0, batch);

    const tasks = imgs.map(img => async ()=>{
      img.dataset.done = "1";

      const title = img.dataset.showtitle || "";
      const year  = img.dataset.showyear || "";
      const m3uLogo = img.dataset.m3ulogo || "";

      if(!title){
        setPoster(img, m3uLogo || "");
        return;
      }

      const key = PosterCache.makeKey("tv", title, year);
      const cached = PosterCache.get(key);
      if(cached){
        setPoster(img, cached);
        return;
      }

      try{
        // ✅ poster-only (FAST)
        const poster = await Metadata.getShowPoster(title, { size: GRID_SIZE });
        if(poster){
          PosterCache.set(key, poster);
          setPoster(img, poster);
        }else{
          setPoster(img, m3uLogo || "");
        }
      }catch{
        setPoster(img, m3uLogo || "");
      }
    });

    await runPool(tasks, CONCURRENCY);
  }finally{
    running = false;
    const remaining = containerEl.querySelector("img.seriesPosterImg:not([data-done])");
    if(remaining) setTimeout(()=>hydrateSeriesPosters(containerEl, { batch }), 80);
  }
}

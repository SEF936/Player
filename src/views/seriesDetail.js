// src/views/seriesDetail.js
import { state } from "../state.js";
import { Metadata } from "../services/metadata.js";
import { show } from "../router.js";
import { PosterCache } from "../services/posterCache.js";


function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function extractSE(name){
  const m = String(name||"").match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
  return m ? { season:Number(m[1]), episode:Number(m[2]) } : { season:1, episode:1 };
}

export async function renderSeriesDetail(el, { setStatus, onBackView = "viewSeries" } = {}) {
  const sh = state.currentShow;
  if (!sh) {
    el.innerHTML = `<div class="muted small">Aucune série sélectionnée.</div>`;
    return;
  }

  const seasons = Array.from(sh.seasons.keys()).sort((a,b)=>a-b);
  let currentSeason = seasons[0] || 1;

  el.innerHTML = `
    <div class="seriesDetail">
      <div class="seriesTopbar">
        <button class="btnGhost" id="backBtn">← Retour</button>
      </div>

      <div class="detailHero">
        <div class="detailPoster">
          <img id="seriesPoster" ${sh.logo ? `src="${esc(sh.logo)}"` : ""} alt="">
          <div class="posterFallback">🎬</div>
        </div>

        <div>
          <div id="seriesTitle" class="detailTitle">${esc(sh.showName)}</div>
          <div class="muted small" id="seriesMeta">${sh.seasons.size} saison(s) • ${sh.totalEpisodes} épisode(s)</div>

          <div class="detailFacts">
            <div class="fact"><span>Créateur</span><b id="seriesCreator">—</b></div>
            <div class="fact"><span>Date</span><b id="seriesDate">—</b></div>
            <div class="fact"><span>Genres</span><b id="seriesGenres">—</b></div>
            <div class="fact"><span>Cast</span><b id="seriesCast">—</b></div>
          </div>

          <div class="detailPlot">
            <div class="sectionTitle">Synopsis</div>
            <div id="seriesPlot" class="plotText">—</div>
            <button id="plotToggle" class="linkBtn" type="button">Lire plus</button>
          </div>

          <div style="margin-top:16px;">
            <div class="sectionTitle">Saison</div>
            <select id="seasonSelect" class="subcatSelect" style="width: min(420px, 100%);">
              ${seasons.map(s=>`<option value="${s}">Saison ${s}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      <div class="sectionTitle" style="margin-top:18px;" id="episodesTitle"></div>
      <div class="episodesList" id="episodesList"></div>
    </div>
  `;

  el.querySelector("#backBtn").onclick = ()=> show(onBackView);

  const plotEl = el.querySelector("#seriesPlot");
  const plotToggle = el.querySelector("#plotToggle");
  plotToggle.onclick = ()=>{
    const exp = plotEl.classList.toggle("expanded");
    plotToggle.textContent = exp ? "Réduire" : "Lire plus";
  };

  const episodesTitle = el.querySelector("#episodesTitle");
  const episodesList = el.querySelector("#episodesList");

  function renderEpisodes(){
    const eps = sh.seasons.get(currentSeason) || [];
    episodesTitle.textContent = `Saison ${currentSeason} • ${eps.length} épisode(s)`;

    episodesList.innerHTML = eps.map(ep=>{
      const se = extractSE(ep.name);
      const code = `S${String(se.season).padStart(2,"0")}E${String(se.episode).padStart(2,"0")}`;
      const thumb = ep.logo || sh.logo || "";

      return `
        <div class="episodeRow" data-idx="${ep.__idx}">
          <div class="episodeThumb">
            ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy"
              onerror="this.remove();">` : ""}
            <div class="posterFallback">▶</div>
          </div>
          <div>
            <div class="episodeMeta muted small">${esc(code)}</div>
            <div class="episodeName">${esc(ep.name)}</div>
            <div class="muted small">${esc(ep.groupTitle || "")}</div>
          </div>
        </div>
      `;
    }).join("");

    episodesList.querySelectorAll(".episodeRow").forEach(row=>{
      row.onclick = ()=>{
        const idx = Number(row.dataset.idx);
        const it = state.allItems.find(x=>x.__idx===idx);
        if(!it) return;

        // simple pour l’instant : open new tab
        window.open(it.url, "_blank", "noopener");
      };
    });
  }

  // season select
  const seasonSelect = el.querySelector("#seasonSelect");
  seasonSelect.onchange = ()=>{
    currentSeason = Number(seasonSelect.value);
    renderEpisodes();
  };

  renderEpisodes();

  // TMDB info
  setStatus?.("Chargement infos série (TMDB)…");
  try{
    const meta = await Metadata.getShow(sh.showName);

    el.querySelector("#seriesTitle").textContent = meta.title || sh.showName;
    el.querySelector("#seriesCreator").textContent = meta.creator || "—";
    el.querySelector("#seriesDate").textContent = meta.date || "—";
    el.querySelector("#seriesGenres").textContent = meta.genres || "—";
    el.querySelector("#seriesCast").textContent = meta.cast || "—";
    plotEl.textContent = meta.overview || "—";

    // poster TMDB > logo M3U
    const poster = meta.poster || sh.logo || "";
    const posterImg = el.querySelector("#seriesPoster");
    if(poster){
      posterImg.src = poster;
    }

    setStatus?.("");
  }catch(e){
    console.warn("TMDB series meta failed", e);
    setStatus?.("Infos TMDB indisponibles (fallback playlist).");
  }
}

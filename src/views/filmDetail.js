// src/views/filmDetail.js
import { state } from "../state.js";
import { Metadata } from "../services/metadata.js";
import { show } from "../router.js";

function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export async function renderFilmDetail(el, { setStatus, onBackView = "viewCategory" } = {}) {
  const it = state.currentFilm;
  if (!it) {
    el.innerHTML = `<div class="muted small">Aucun film sélectionné.</div>`;
    return;
  }

  // base UI immédiate (fallback)
  el.innerHTML = `
<div class="filmDetailPage">
  <div class="filmBackdrop" id="filmBackdrop"></div>
  <div class="filmBackdropShade"></div>

  <header class="filmHeader">
    <button class="btnGhost" id="backBtn" type="button">← Retour</button>
    <div class="filmHeaderRight">
      <button class="iconBtn" id="filmFavBtn" type="button" aria-label="Favori">♡</button>
    </div>
  </header>

  <!-- HERO -->
  <section class="filmHeroNew">
    <!-- LEFT -->
    <div class="filmLeftCol">
      <div class="filmPosterWrap">
        <img id="filmPoster" alt="" />
        <div class="posterFallback">🎬</div>
      </div>

      <!-- Rating sous poster -->
      <div class="filmRatingBlock">
        <div id="filmStars" class="filmStars"></div>
      </div>
    </div>

    <!-- RIGHT -->
    <div class="filmRightCol">
      <h1 id="filmTitle" class="filmTitleBig">—</h1>

      <div class="filmFactsList">
        <div class="factRow">
          <span>Réalisateur</span>
          <b id="filmDirector">—</b>
        </div>
        <div class="factRow">
          <span>Date</span>
          <b id="filmDate">—</b>
        </div>
        <div class="factRow">
          <span>Durée</span>
          <b id="filmDuration">—</b>
        </div>
        <div class="factRow">
          <span>Genres</span>
          <b id="filmGenres">—</b>
        </div>
        <div class="factRow">
          <span>Cast</span>
          <b id="filmCast">—</b>
        </div>
      </div>

      <div class="filmActionsRow">
        <button id="filmPlayBtn" class="btnPrimary" type="button">PLAY</button>
        <button id="filmDownloadBtn" class="btnGhost" type="button">Télécharger</button>
        <button id="filmVlcBtn" class="btnGhost" type="button">Ouvrir VLC</button>
      </div>
    </div>
  </section>

  <!-- SYNOPSIS full width -->
  <section class="filmSection">
    <div class="filmSectionTitle">Synopsis</div>
    <div id="filmPlot" class="filmPlotText">—</div>
    <button id="plotToggle" class="linkBtnInline" type="button">Lire plus</button>
  </section>

  <!-- CAST full width -->
  <section class="filmSection">
    <div class="filmSectionTitle">Casting</div>
    <div id="filmCastStrip" class="castStrip"></div>
  </section>
</div>
  `;

  // actions
  el.querySelector("#backBtn").onclick = ()=> show(onBackView);
  el.querySelector("#filmDownloadBtn").onclick = ()=> window.open(it.url, "_blank", "noopener");
  el.querySelector("#filmVlcBtn").onclick = ()=> window.open(`vlc://${it.url}`, "_blank");
  el.querySelector("#filmPlayBtn").onclick = ()=> window.open(it.url, "_blank", "noopener"); // (player intégré ensuite)

  const plotEl = el.querySelector("#filmPlot");
  const plotToggle = el.querySelector("#plotToggle");
  plotToggle.onclick = ()=>{
    const exp = plotEl.classList.toggle("expanded");
    plotToggle.textContent = exp ? "Réduire" : "Lire plus";
  };

  // fetch TMDB
  setStatus?.("Chargement infos film (TMDB)…");
  try{
    const meta = await Metadata.getMovie(it.name);

    // poster/backdrop : TMDB -> m3u -> placeholder (déjà géré)
    const poster = meta.poster || it.logo || "";
    const posterImg = el.querySelector("#filmPoster");
    if (poster) {
      posterImg.src = poster;
      posterImg.parentElement?.classList.remove("noposter");
    }

    const backdrop = meta.backdrop || "";
    const backdropEl = el.querySelector("#filmBackdrop");
    backdropEl.style.backgroundImage = backdrop ? `url("${backdrop}")` : "";

    el.querySelector("#filmTitle").textContent = meta.title || it.name || "Film";
    el.querySelector("#filmDirector").textContent = meta.director || "—";
    el.querySelector("#filmDate").textContent = meta.date || "—";
    el.querySelector("#filmGenres").textContent = meta.genres || "—";
    el.querySelector("#filmCast").textContent = meta.cast || "—";
    plotEl.textContent = meta.overview || "—";

    // duration
    const dur = el.querySelector("#filmDuration");
    if (meta.runtime) {
      const h = Math.floor(meta.runtime / 60);
      const m = meta.runtime % 60;
      dur.textContent = `${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`;
    } else dur.textContent = "—";

    // stars
    const starsEl = el.querySelector("#filmStars");
    const vote = typeof meta.vote === "number" ? meta.vote : 0;
    const n = vote ? Math.round(vote / 2) : 0;
    starsEl.innerHTML = Array.from({length:5}).map((_,i)=>(
      `<span class="${i < n ? "" : "starMuted"}">★</span>`
    )).join("");

    // cast strip
    const strip = el.querySelector("#filmCastStrip");
    strip.innerHTML = (meta.castList||[]).map(p=>`
      <div class="castChip">
        <div class="castAvatar">${p.profile ? `<img src="${esc(p.profile)}" alt="" loading="lazy">` : ""}</div>
        <div class="castName">${esc(p.name||"")}</div>
      </div>
    `).join("");

    setStatus?.("");
  }catch(e){
    console.warn("TMDB film meta failed", e);
    setStatus?.("Infos TMDB indisponibles (fallback playlist).");
  }
}

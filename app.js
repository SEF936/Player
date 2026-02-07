/* app.js - base fonctionnelle "ancienne"
   - Import m3u/m3u8
   - Dashboard TV/FILMS/SERIES
   - Category view: subcats + search + lazy load 30 (ordre playlist)
   - SERIES: regroupement show/saisons/épisodes (1 card show)
   - Series detail: saisons + épisodes + infos TMDB si dispo
   - Film detail: infos TMDB si dispo + boutons download/vlc
   - Modal actions: TV + épisodes
*/
function setText(el, value) {
  if (!el) return false;
  el.textContent = value ?? "";
  return true;
}
function setHTML(el, value) {
  if (!el) return false;
  el.innerHTML = value ?? "";
  return true;
}
function setBg(el, url) {
  if (!el) return false;
  el.style.backgroundImage = url ? `url("${url}")` : "";
  return true;
}
function setSrc(el, url) {
  if (!el) return false;
  if (url) el.src = url;
  else el.removeAttribute("src");
  return true;
}
function requireEl(el, id) {
  if (!el) console.warn(`⚠️ Missing element in HTML: #${id}`);
  return el;
}

const $ = (s) => document.querySelector(s);
const BATCH = 30;

const refreshAllBtn = $("#refreshAllBtn");
const lastUpdatedEl = $("#lastUpdated");
const logoutBtn = $("#logoutBtn");

// Views
const viewLogin = $("#viewLogin");
const viewDash = $("#viewDash");
const viewCategory = $("#viewCategory");
const viewSeriesDetail = $("#viewSeriesDetail");
const viewFilmDetail = $("#viewFilmDetail");

// Login UI
const loginPlaylistName = $("#loginPlaylistName");
const loginUser = $("#loginUser");
const loginPass = $("#loginPass");
const loginBtn = $("#loginBtn");
const statusLine = $("#statusLine");

// Appbar
const topDate = $("#topDate");

// Dash UI
const tvCard = $("#tvCard");
const filmsCard = $("#filmsCard");
const seriesCard = $("#seriesCard");
const tvCount = $("#tvCount");
const filmsCount = $("#filmsCount");
const seriesCount = $("#seriesCount");
const dashInfo = $("#dashInfo");
const changePlaylistBtn = $("#changePlaylistBtn");

// Category UI
const catBackBtn = $("#catBackBtn");
const catTitle = $("#catTitle");
const catSubtitle = $("#catSubtitle");
const catSearch = $("#catSearch");
const subcatList = $("#subcatList");
const grid = $("#grid");
const emptyState = $("#emptyState");
const subcatSelect = $("#subcatSelect");

// Series detail UI
const seriesBackBtn = $("#seriesBackBtn");
const seriesPoster = $("#seriesPoster");
const seriesTitleEl = $("#seriesTitle");
const seriesMetaEl = $("#seriesMeta");
const seriesCreatorEl = $("#seriesCreator");
const seriesDateEl = $("#seriesDate");
const seriesGenresEl = $("#seriesGenres");
const seriesCastEl = $("#seriesCast");
const seriesPlotEl = $("#seriesPlot");
const seriesPlotToggleBtn = $("#seriesPlotToggleBtn");
const seasonTabs = $("#seasonTabs");
const episodesTitle = $("#episodesTitle");
const episodesList = $("#episodesList");

// Film detail UI
const filmBackdrop = requireEl($("#filmBackdrop"), "filmBackdrop");
const filmDurationEl = requireEl($("#filmDuration"), "filmDuration");
const filmStarsEl = requireEl($("#filmStars"), "filmStars");
const filmCastStrip = requireEl($("#filmCastStrip"), "filmCastStrip");
const filmCastToggleBtn = requireEl(
  $("#filmCastToggleBtn"),
  "filmCastToggleBtn",
);
const filmFavBtn = requireEl($("#filmFavBtn"), "filmFavBtn");

// existants déjà chez toi normalement :
const filmPoster = requireEl($("#filmPoster"), "filmPoster");
const filmTitleEl = requireEl($("#filmTitle"), "filmTitle");
const filmDirectorEl = requireEl($("#filmDirector"), "filmDirector");
const filmDateEl = requireEl($("#filmDate"), "filmDate");
const filmGenresEl = requireEl($("#filmGenres"), "filmGenres");
const filmCastEl = requireEl($("#filmCast"), "filmCast");
const filmPlotEl = requireEl($("#filmPlot"), "filmPlot");
const filmPlotToggleBtn = requireEl(
  $("#filmPlotToggleBtn"),
  "filmPlotToggleBtn",
);
const filmDownloadBtn = requireEl($("#filmDownloadBtn"), "filmDownloadBtn");
const filmVlcBtn = requireEl($("#filmVlcBtn"), "filmVlcBtn");

// Modal UI
const actionModal = $("#actionModal");
const modalCloseBtn = $("#modalCloseBtn");
const modalCancelBtn = $("#modalCancelBtn");
const modalDownloadBtn = $("#modalDownloadBtn");
const modalVlcBtn = $("#modalVlcBtn");
const modalItemName = $("#modalItemName");
const modalItemMeta = $("#modalItemMeta");

// State
let allItems = [];
let activeCategory = null; // "TV"|"FILMS"|"SERIES"
let activeSubcat = "__ALL__";
let searchQuery = "";

// For category rendering
let renderList = []; // array of items or shows (for SERIES)
let rendered = 0;

// For SERIES detail
let currentShow = null; // show object
let currentSeason = 1;

// For modal
let modalCurrent = null;

// ---------- utils ----------
function setTopDate() {
  const d = new Date();
  topDate.textContent = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function setStatus(msg) {
  if (statusLine) statusLine.textContent = msg || "";
}

function showView(name) {
  const map = {
    login: viewLogin,
    dash: viewDash,
    category: viewCategory,
    seriesDetail: viewSeriesDetail,
    filmDetail: viewFilmDetail,
  };
  Object.entries(map).forEach(([k, el]) => {
    if (el) el.classList.toggle("hidden", k !== name);
  });
  history.pushState({ view: name }, "", `#${name}`);
}

window.addEventListener("popstate", (e) => {
  const v = e.state?.view || "login";
  const map = {
    login: viewLogin,
    dash: viewDash,
    category: viewCategory,
    seriesDetail: viewSeriesDetail,
    filmDetail: viewFilmDetail,
  };
  Object.entries(map).forEach(([k, el]) => {
    if (el) el.classList.toggle("hidden", k !== v);
  });
});

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- parsing m3u ----------
function parseAttrs(extinfLine) {
  const attrs = {};
  const re = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(extinfLine)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function categorizeByUrl(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("/movie/")) return "FILMS";
  if (u.includes("/series/")) return "SERIES";
  return "TV";
}

function parseM3U(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];
  let pending = null;
  let idx = 0;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      const attrs = parseAttrs(line);
      const name =
        attrs["tvg-name"] ||
        line.split(",").slice(1).join(",").trim() ||
        "Sans titre";
      const logo = attrs["tvg-logo"] || "";
      const groupTitle = attrs["group-title"] || "Autres";
      pending = { name, logo, groupTitle };
      continue;
    }
    if (pending && !line.startsWith("#")) {
      const url = line;
      items.push({
        __idx: idx++,
        category: categorizeByUrl(url),
        url,
        name: pending.name,
        logo: pending.logo,
        groupTitle: pending.groupTitle,
      });
      pending = null;
    }
  }
  return items;
}

// ---------- dashboard ----------
function updateCounts() {
  const tv = allItems.filter((x) => x.category === "TV").length;
  const films = allItems.filter((x) => x.category === "FILMS").length;

  // séries uniques (pas épisodes)
  const seriesItems = allItems.filter((x) => x.category === "SERIES");
  const uniqueShows = buildShows(seriesItems).length;

  tvCount.textContent = String(tv);
  filmsCount.textContent = String(films);
  seriesCount.textContent = String(uniqueShows);

  dashInfo.textContent = `Total: ${allItems.length} éléments`;
}

// ---------- subcats (keep order of appearance) ----------
function buildSubcats(items) {
  const order = [];
  const counts = new Map();
  for (const it of items) {
    const key = (it.groupTitle || "Autres").trim() || "Autres";
    if (!counts.has(key)) {
      counts.set(key, 0);
      order.push(key);
    }
    counts.set(key, counts.get(key) + 1);
  }
  return { order, counts };
}
function buildSubcatsForShows(shows) {
  const order = [];
  const counts = new Map();

  for (const sh of shows) {
    const key = (sh.groupTitle || "Autres").trim() || "Autres";
    if (!counts.has(key)) {
      counts.set(key, 0);
      order.push(key);
    }
    counts.set(key, counts.get(key) + 1);
  }

  return { order, counts };
}

// ---------- SERIES grouping ----------
function normalizeShowKey(name) {
  return String(name || "")
    .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, "")
    .trim()
    .toLowerCase();
}

function extractSE(name) {
  const m = String(name || "").match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
  return m ? { season: Number(m[1]), episode: Number(m[2]) } : null;
}

function buildShows(seriesItems) {
  const map = new Map();

  for (const it of seriesItems) {
    const showKey = normalizeShowKey(it.name);
    const se = extractSE(it.name) || { season: 1, episode: 1 };

    if (!map.has(showKey)) {
      map.set(showKey, {
        showKey,
        showName: String(it.name)
          .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, "")
          .trim(),
        logo: it.logo || "",
        groupTitle: (it.groupTitle || "Autres").trim() || "Autres",
        seasons: new Map(),
        totalEpisodes: 0,
        minIdx: it.__idx,
      });
    }

    const sh = map.get(showKey);
    if (!sh.seasons.has(se.season)) sh.seasons.set(se.season, []);
    sh.seasons.get(se.season).push(it);
    sh.totalEpisodes++;
    sh.minIdx = Math.min(sh.minIdx, it.__idx);
  }

  // keep playlist order by first appearance
  const arr = Array.from(map.values()).sort((a, b) => a.minIdx - b.minIdx);

  // keep episode order in season
  for (const sh of arr) {
    for (const [s, eps] of sh.seasons.entries()) {
      eps.sort((a, b) => (a.__idx ?? 0) - (b.__idx ?? 0));
      sh.seasons.set(s, eps);
    }
  }
  return arr;
}

// ---------- modal ----------
function openModal({ url, name, meta }) {
  modalCurrent = { url, name, meta };
  modalItemName.textContent = name || "Élément";
  modalItemMeta.textContent = meta || url;
  actionModal.classList.remove("hidden");
}
function closeModal() {
  actionModal.classList.add("hidden");
  modalCurrent = null;
}

modalCloseBtn.addEventListener("click", closeModal);
modalCancelBtn.addEventListener("click", closeModal);
actionModal.addEventListener("click", (e) => {
  if (e.target === actionModal) closeModal();
});

modalDownloadBtn.addEventListener("click", () => {
  if (!modalCurrent) return;
  console.log("🌐 Open link:", modalCurrent.url);
  window.open(modalCurrent.url, "_blank", "noopener");
  closeModal();
});

modalVlcBtn.addEventListener("click", () => {
  if (!modalCurrent) return;
  console.log("▶ VLC:", modalCurrent.url);
  window.open(`vlc://${modalCurrent.url}`, "_blank");
  closeModal();
});

// ---------- rendering category ----------
function subcatBtnHtml(key, label, count, active) {
  return `
    <button class="subcatBtn ${active ? "active" : ""}" type="button" data-key="${escapeHtml(key)}">
      <span class="subcatName">${escapeHtml(label)}</span>
      <span class="subcatCount">${count}</span>
    </button>
  `;
}

function renderSubcats(list, totalOverride = null) {
  const isShows = activeCategory === "SERIES";
  const built = isShows ? buildSubcatsForShows(list) : buildSubcats(list);
  const { order, counts } = built;

  const total = totalOverride !== null ? totalOverride : list.length;

  // --- Desktop list (inchangé) ---
  const rows = [];
  rows.push(
    subcatBtnHtml("__ALL__", "TOUT", total, activeSubcat === "__ALL__"),
  );
  for (const key of order) {
    rows.push(
      subcatBtnHtml(key, key, counts.get(key) || 0, activeSubcat === key),
    );
  }
  subcatList.innerHTML = rows.join("");

  subcatList.querySelectorAll(".subcatBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeSubcat = btn.dataset.key;
      rendered = 0;
      grid.scrollTop = 0;
      renderCategoryContent();
    });
  });

  // --- Mobile dropdown ---
  if (subcatSelect) {
    const opts = [];
    opts.push(`<option value="__ALL__">TOUT (${total})</option>`);
    for (const key of order) {
      const c = counts.get(key) || 0;
      opts.push(
        `<option value="${escapeHtml(key)}">${escapeHtml(key)} (${c})</option>`,
      );
    }
    subcatSelect.innerHTML = opts.join("");
    subcatSelect.value = activeSubcat;

    // bind une seule fois
    if (!subcatSelect.dataset.bound) {
      subcatSelect.dataset.bound = "1";
      subcatSelect.addEventListener("change", () => {
        activeSubcat = subcatSelect.value;
        rendered = 0;
        grid.scrollTop = 0;
        renderCategoryContent();
      });
    }
  }
}

function applyFilters(items) {
  let scoped = items;

  if (activeSubcat !== "__ALL__") {
    scoped = scoped.filter(
      (it) => ((it.groupTitle || "Autres").trim() || "Autres") === activeSubcat,
    );
  }

  const q = (searchQuery || "").trim().toLowerCase();
  if (q) {
    scoped = scoped.filter((it) => (it.name || "").toLowerCase().includes(q));
  }

  // playlist order
  scoped = [...scoped].sort((a, b) => (a.__idx ?? 0) - (b.__idx ?? 0));
  return scoped;
}

function filmCardHtml(it) {
  const name = it.name || "Film";
  return `
    <div class="mediaCard" data-idx="${it.__idx}">
      <div class="poster noposter">
        <img class="filmPosterImg"
             data-movietitle="${escapeHtml(name)}"
             alt=""
             loading="lazy">
        <div class="posterFallback">🎬</div>
      </div>
      <div class="mediaTitle">${escapeHtml(name)}</div>
    </div>
  `;
}

function showCardHtml(sh) {
  const name = sh.showName || "Série";
  const meta = `${sh.seasons.size} saison${sh.seasons.size > 1 ? "s" : ""} • ${sh.totalEpisodes} épisode${sh.totalEpisodes > 1 ? "s" : ""}`;

  return `
    <div class="mediaCard" data-showkey="${escapeHtml(sh.showKey)}">
      <div class="poster noposter">
        <img class="seriesPosterImg"
             data-showtitle="${escapeHtml(name)}"
             alt=""
             loading="lazy"
             style="display:none;">
        <div class="posterFallback">🎬</div>
      </div>
      <div class="mediaTitle">${escapeHtml(name)}</div>
      <div class="muted small">${escapeHtml(meta)}</div>
    </div>
  `;
}

function cardHtml(it) {
  const name = it.name || "Élément";
  const logo = it.logo || ""; // tvg-logo (fallback)
  const meta = it.groupTitle || "TV";

  return `
    <div class="mediaCard" data-idx="${it.__idx}">
      <div class="poster ${logo ? "" : "noposter"}">
        ${
          logo
            ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy"
          onerror="this.remove(); this.closest('.poster')?.classList.add('noposter');">`
            : ""
        }
        <div class="posterFallback">▶</div>
      </div>
      <div class="mediaTitle">${escapeHtml(name)}</div>
      <div class="muted small">${escapeHtml(meta)}</div>
    </div>
  `;
}

function renderMore() {
  const total = renderList.length;
  if (rendered >= total) return;

  const slice = renderList.slice(rendered, rendered + BATCH);
  rendered += slice.length;

  const html = slice
    .map((x) => {
      if (activeCategory === "SERIES") return showCardHtml(x);
      if (activeCategory === "FILMS") return filmCardHtml(x);
      return cardHtml(x); // TV
    })
    .join("");

  grid.insertAdjacentHTML("beforeend", html);

  bindGridClicks();

  // posters TMDB (films)
  if (activeCategory === "FILMS") {
    setTimeout(hydrateFilmPosters, 0);
  }
  // posters TMDB (series) si tu as la fonction
  if (
    activeCategory === "SERIES" &&
    typeof hydrateSeriesPosters === "function"
  ) {
    setTimeout(hydrateSeriesPosters, 0);
  }
}

function bindGridClicks() {
  // items
  grid.querySelectorAll(".mediaCard[data-idx]").forEach((el) => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.idx);
      const it = allItems.find((x) => x.__idx === idx);
      if (!it) return;

      if (activeCategory === "FILMS") {
        openFilmDetail(it);
        return;
      }

      // TV
      openModal({
        url: it.url,
        name: it.name,
        meta: it.groupTitle || activeCategory,
      });
    });
  });

  // shows
  grid.querySelectorAll(".mediaCard[data-showkey]").forEach((el) => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", () => {
      const key = el.dataset.showkey;
      const shows = renderList; // current shows list
      const sh = shows.find((s) => s.showKey === key);
      if (sh) openSeriesDetail(sh);
    });
  });
}

let __posterQueueRunning = false;

async function hydrateSeriesPosters() {
  if (__posterQueueRunning) return;
  if (
    !(window.Metadata && window.Metadata.isReady && window.Metadata.isReady())
  )
    return;

  __posterQueueRunning = true;

  try {
    const imgs = Array.from(grid.querySelectorAll("img.seriesPosterImg"))
      .filter((img) => !img.dataset.tmdbDone)
      .slice(0, 30); // batch raisonnable

    for (const img of imgs) {
      img.dataset.tmdbDone = "1";

      const title = img.dataset.showtitle || "";
      if (!title) continue;

      try {
        // Utilise le fetch TMDB (poster only idéal)
        const poster = await window.Metadata.getShowPoster(title);

        if (poster) {
          img.src = poster;
          img.style.display = "block";
          const posterBox = img.closest(".poster");
          posterBox?.classList.remove("noposter");
        }
      } catch {
        // Si TMDB fail => on laisse le placeholder (pas de tvg-logo)
      }
    }
  } finally {
    __posterQueueRunning = false;

    // relance en micro-batch si il reste des posters à charger
    const remaining = grid.querySelector(
      "img.seriesPosterImg:not([data-tmdb-done])",
    );
    if (remaining) setTimeout(hydrateSeriesPosters, 50);
  }
}
let __filmPosterQueueRunning = false;

async function hydrateFilmPosters() {
  if (__filmPosterQueueRunning) return;
  if (
    !(window.Metadata && window.Metadata.isReady && window.Metadata.isReady())
  )
    return;

  __filmPosterQueueRunning = true;

  try {
    const imgs = Array.from(grid.querySelectorAll("img.filmPosterImg"))
      .filter((img) => !img.dataset.tmdbDone)
      .slice(0, 30);

    for (const img of imgs) {
      img.dataset.tmdbDone = "1";

      const title = img.dataset.movietitle || "";
      if (!title) continue;

      try {
        const poster = await window.Metadata.getMoviePoster(title);

        if (poster) {
          img.src = poster;
          img.closest(".poster")?.classList.remove("noposter");
        }
      } catch (e) {
        console.warn("🎞 poster fail:", title, e);
      }
    }
  } finally {
    __filmPosterQueueRunning = false;

    const remaining = grid.querySelector(
      "img.filmPosterImg:not([data-tmdb-done])",
    );
    if (remaining) setTimeout(hydrateFilmPosters, 80);
  }
}

function bindInfiniteScroll() {
  grid.onscroll = null;
  grid.addEventListener(
    "scroll",
    () => {
      const near =
        grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 300;
      if (near) renderMore();
    },
    { passive: true },
  );
}

function renderCategoryContent() {
  grid.innerHTML = "";
  emptyState.classList.add("hidden");
  rendered = 0;

  const itemsCat = allItems.filter((x) => x.category === activeCategory);

  // sous-cats (ordre du fichier)
  renderSubcats(itemsCat);

  // build list
  if (activeCategory === "SERIES") {
    // ✅ 1) Sidebar toujours basée sur TOUTES les séries (pas filtrées)
    const allShows = buildShows(itemsCat);
    renderSubcats(allShows, allShows.length);

    // ✅ 2) Filtre appliqué uniquement à la grille
    let scoped = allShows;

    if (activeSubcat !== "__ALL__") {
      scoped = scoped.filter(
        (sh) =>
          ((sh.groupTitle || "Autres").trim() || "Autres") === activeSubcat,
      );
    }

    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      scoped = scoped.filter((sh) =>
        (sh.showName || "").toLowerCase().includes(q),
      );
    }

    renderList = scoped;
    catSubtitle.textContent = `${renderList.length} série(s)`;
  } else {
    // TV / FILMS inchangé
    renderSubcats(itemsCat);

    renderList = applyFilters(itemsCat);
    catSubtitle.textContent = `${renderList.length} élément(s)`;
  }

  if (!renderList.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  renderMore();
  bindInfiniteScroll();
}

function openCategory(cat) {
  activeCategory = cat;
  activeSubcat = "__ALL__";
  searchQuery = "";
  catSearch.value = "";
  catTitle.textContent = cat;
  renderCategoryContent();
  showView("category");
}

// ---------- Series detail ----------
function bindPlotToggle(btn, el) {
  btn.addEventListener("click", () => {
    const exp = el.classList.toggle("expanded");
    btn.textContent = exp ? "Réduire" : "Lire plus";
  });
}
bindPlotToggle(seriesPlotToggleBtn, seriesPlotEl);
bindPlotToggle(filmPlotToggleBtn, filmPlotEl);

function openSeriesDetail(show) {
  currentShow = show;
  const seasons = Array.from(show.seasons.keys()).sort((a, b) => a - b);
  currentSeason = seasons[0] || 1;
  renderSeriesDetail();
  showView("seriesDetail");
}

function episodeRowHtml(ep) {
  const se = extractSE(ep.name) || { season: 1, episode: 1 };
  const code = `S${String(se.season).padStart(2, "0")}E${String(se.episode).padStart(2, "0")}`;
  const thumb = ep.logo || currentShow.logo || "";
  return `
    <div class="episodeRow" data-idx="${ep.__idx}">
      <div class="episodeThumb">
        ${
          thumb
            ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy"
          onerror="this.remove();">`
            : ""
        }
        <div class="posterFallback">▶</div>
      </div>
      <div>
        <div class="episodeMeta muted small">${escapeHtml(code)}</div>
        <div class="episodeName">${escapeHtml(ep.name)}</div>
      </div>
    </div>
  `;
}

async function renderSeriesDetail() {
  const sh = currentShow;
  if (!sh) return;

  seriesTitleEl.textContent = sh.showName;
  seriesMetaEl.textContent = `${sh.seasons.size} saison${sh.seasons.size > 1 ? "s" : ""} • ${sh.totalEpisodes} épisode${sh.totalEpisodes > 1 ? "s" : ""}`;

  // poster initial m3u
  if (sh.logo) {
    seriesPoster.src = sh.logo;
    seriesPoster.style.display = "block";
  } else {
    seriesPoster.removeAttribute("src");
  }

  // reset info
  seriesCreatorEl.textContent = "—";
  seriesDateEl.textContent = "—";
  seriesGenresEl.textContent = "—";
  seriesCastEl.textContent = "—";
  seriesPlotEl.textContent = "—";
  seriesPlotEl.classList.remove("expanded");
  seriesPlotToggleBtn.textContent = "Lire plus";

  // seasons tabs
  const seasons = Array.from(sh.seasons.keys()).sort((a, b) => a - b);
  seasonTabs.innerHTML = seasons
    .map((s) => {
      return `<button class="seasonTab ${s === currentSeason ? "active" : ""}" type="button" data-season="${s}">Saison ${s}</button>`;
    })
    .join("");

  seasonTabs.querySelectorAll(".seasonTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSeason = Number(btn.dataset.season);
      renderSeriesDetail();
    });
  });

  const eps = sh.seasons.get(currentSeason) || [];
  episodesTitle.textContent = `Saison ${currentSeason} • ${eps.length} épisode${eps.length > 1 ? "s" : ""}`;
  episodesList.innerHTML = eps.map(episodeRowHtml).join("");

  episodesList.querySelectorAll(".episodeRow").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = Number(row.dataset.idx);
      const it = allItems.find((x) => x.__idx === idx);
      if (!it) return;
      openModal({
        url: it.url,
        name: it.name,
        meta: `${sh.showName} • Saison ${currentSeason}`,
      });
    });
  });

  // TMDB info if configured
  try {
    if (window.Metadata && window.Metadata.isReady()) {
      const meta = await window.Metadata.getShow(sh.showName);
      seriesCreatorEl.textContent = meta.creator || "—";
      seriesDateEl.textContent = meta.date || "—";
      seriesGenresEl.textContent = meta.genres || "—";
      seriesCastEl.textContent = meta.cast || "—";
      seriesPlotEl.textContent = meta.overview || "—";
      if (meta.poster) {
        seriesPoster.src = meta.poster;
      }
    }
  } catch {
    // keep m3u data
  }
}

// ---------- Film detail ----------
async function openFilmDetail(it) {
  // Actions (toujours)
  if (filmDownloadBtn)
    filmDownloadBtn.onclick = () => {
      window.open(it.url, "_blank", "noopener");
    };
  if (filmVlcBtn)
    filmVlcBtn.onclick = () => {
      window.open(`vlc://${it.url}`, "_blank");
    };

  // Reset UI (safe)
  setText(filmTitleEl, it.name || "Film");
  setText(filmDirectorEl, "—");
  setText(filmDateEl, "—");
  setText(filmDurationEl, "—");
  setText(filmGenresEl, "—");
  setText(filmCastEl, "—");
  setText(filmPlotEl, "—");
  if (filmPlotEl) filmPlotEl.classList.remove("expanded");
  setText(filmPlotToggleBtn, "Read more");

  setHTML(filmCastStrip, "");
  setHTML(filmStarsEl, "");
  setBg(filmBackdrop, "");

  if (filmFavBtn) filmFavBtn.textContent = "♡";

  // Poster fallback (m3u)
  setSrc(filmPoster, it.logo || "");

  showView("filmDetail");

  // Fetch TMDB
  try {
    if (
      window.Metadata &&
      window.Metadata.isReady &&
      window.Metadata.isReady()
    ) {
      const meta = await window.Metadata.getMovie(it.name);

      setText(filmTitleEl, meta.title || it.name);
      setBg(filmBackdrop, meta.backdrop || "");
      setSrc(filmPoster, meta.poster || it.logo || "");

      setText(filmDirectorEl, meta.director || "—");
      setText(filmDateEl, meta.date || "—");

      if (filmDurationEl) {
        if (meta.runtime) {
          const h = Math.floor(meta.runtime / 60);
          const m = meta.runtime % 60;
          filmDurationEl.textContent = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
        } else {
          filmDurationEl.textContent = "—";
        }
      }

      setText(filmGenresEl, meta.genres || "—");

      // Cast line + toggle
      const castFull = meta.cast || "—";
      let castExpanded = false;

      function renderCastLine() {
        if (!filmCastEl) return;
        if (!filmCastToggleBtn) {
          filmCastEl.textContent = castFull;
          return;
        }
        if (castExpanded || castFull.length <= 120) {
          filmCastEl.textContent = castFull;
          filmCastToggleBtn.textContent = "Hide";
        } else {
          filmCastEl.textContent = castFull.slice(0, 120).trim() + "…";
          filmCastToggleBtn.textContent = "Read more";
        }
      }

      if (filmCastToggleBtn) {
        filmCastToggleBtn.onclick = () => {
          castExpanded = !castExpanded;
          renderCastLine();
        };
      }
      renderCastLine();

      // Plot + toggle
      setText(filmPlotEl, meta.overview || "—");
      if (filmPlotToggleBtn) {
        filmPlotToggleBtn.onclick = () => {
          if (!filmPlotEl) return;
          const exp = filmPlotEl.classList.toggle("expanded");
          filmPlotToggleBtn.textContent = exp ? "Hide" : "Read more";
        };
      }

      // Stars
      if (filmStarsEl) {
        const vote = typeof meta.vote === "number" ? meta.vote : 0;
        const starCount = vote ? Math.round(vote / 2) : 0;
        let html = "";
        for (let i = 1; i <= 5; i++) {
          html += `<span class="${i <= starCount ? "" : "starMuted"}">★</span>`;
        }
        filmStarsEl.innerHTML = html;
      }

      // Cast strip photos
      if (filmCastStrip && Array.isArray(meta.castList)) {
        filmCastStrip.innerHTML = meta.castList
          .map(
            (p) => `
          <div class="castChip">
            <div class="castAvatar">
              ${p.profile ? `<img src="${escapeHtml(p.profile)}" alt="" loading="lazy">` : ""}
            </div>
            <div class="castName">${escapeHtml(p.name || "")}</div>
          </div>
        `,
          )
          .join("");
      }
    }
  } catch (e) {
    console.warn("TMDB film meta failed", e);
  }
}

// ---------- events ----------
catBackBtn.addEventListener("click", () => showView("dash"));
seriesBackBtn.addEventListener("click", () => showView("category"));
filmBackBtn.addEventListener("click", () => showView("category"));

catSearch.addEventListener("input", () => {
  searchQuery = catSearch.value || "";
  rendered = 0;
  grid.scrollTop = 0;
  renderCategoryContent();
});

tvCard.addEventListener("click", () => openCategory("TV"));
filmsCard.addEventListener("click", () => openCategory("FILMS"));
seriesCard.addEventListener("click", () => openCategory("SERIES"));

changePlaylistBtn.addEventListener("click", () => {
  setStatus("");
  showView("login");
});

async function fetchPlaylistViaNetlify(username, password) {
  const res = await fetch("/.netlify/functions/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("❌ playlist function error", res.status, text);
    throw new Error(`Erreur fetch (${res.status})`);
  }
  return text;
}

function saveLoginSession() {
  const sess = {
    playlistName: (loginPlaylistName?.value || "").trim(),
    username: (loginUser?.value || "").trim(),
  };
  localStorage.setItem("iptv_session", JSON.stringify(sess));
}

function loadLoginSession() {
  try {
    const s = JSON.parse(localStorage.getItem("iptv_session") || "null");
    if (!s) return;
    if (loginPlaylistName && s.playlistName)
      loginPlaylistName.value = s.playlistName;
    if (loginUser && s.username) loginUser.value = s.username;
  } catch {}
}

function setBusyLogin(b) {
  if (loginBtn) loginBtn.disabled = !!b;
}

function bindLogin() {
  // Pré-remplissage si session existante
  try {
    const s = JSON.parse(localStorage.getItem("iptv_session") || "null");
    if (s) {
      if (loginPlaylistName && s.playlistName)
        loginPlaylistName.value = s.playlistName;
      if (loginUser && s.username) loginUser.value = s.username;
    }
  } catch {}

  const run = async () => {
    const plName = (loginPlaylistName?.value || "").trim();
    const user = (loginUser?.value || "").trim();
    const pass = (loginPass?.value || "").trim();

    if (!plName) {
      setStatus("⚠️ Merci de renseigner un nom de playlist.");
      return;
    }
    if (!user || !pass) {
      setStatus("⚠️ User et password requis.");
      return;
    }

    if (loginBtn) loginBtn.disabled = true;

    try {
      setStatus("⏳ Téléchargement de la playlist…");

      const text = await fetchPlaylistViaNetlify(user, pass);

      // debug utile
      console.log("📄 Taille playlist (chars):", text.length);
      const bytes = new TextEncoder().encode(text).length;
      console.log("📦 Taille playlist (Mo):", (bytes / 1024 / 1024).toFixed(2));

      setStatus("⏳ Analyse de la playlist…");
      allItems = parseM3U(text);

      setStatus("⏳ Chargement des catégories…");
      updateCounts();

      // Sauvegarde session (persistante)
      localStorage.setItem(
        "iptv_session",
        JSON.stringify({
          playlistName: plName,
          username: user,
          password: pass,
          updatedAt: Date.now(),
        }),
      );

      setStatus(`Playlist chargée ✅ (${allItems.length} éléments)`);
      showView("dash");
    } catch (e) {
      console.error(e);
      setStatus(`❌ Échec du chargement (${e?.message || e})`);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
      if (loginPass) loginPass.value = ""; // on vide toujours le champ password
    }
  };

  loginBtn?.addEventListener("click", run);

  [loginPlaylistName, loginUser, loginPass].forEach((el) => {
    el?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") run();
    });
  });
}

// Init
(async function init() {
  setTopDate();
  bindLogin();
  bindDashActions?.(); // si tu as bien ajouté refresh / logout

  // Tentative auto-login
  try {
    const s = JSON.parse(localStorage.getItem("iptv_session") || "null");
    if (s?.username && s?.password) {
      setStatus("⏳ Reconnexion automatique…");

      const text = await fetchPlaylistViaNetlify(s.username, s.password);

      setStatus("⏳ Analyse de la playlist…");
      allItems = parseM3U(text);

      setStatus("⏳ Chargement des catégories…");
      updateCounts();

      if (typeof setLastUpdated === "function") {
        setLastUpdated(s.updatedAt || Date.now());
      }

      setStatus(`Playlist chargée ✅ (${allItems.length} éléments)`);
      showView("dash");
      return;
    }
  } catch (e) {
    console.warn("Auto-login failed", e);
  }

  // Fallback : afficher login
  showView("login");
})();

function setLastUpdated(ts) {
  if (!lastUpdatedEl) return;
  const d = new Date(ts);
  lastUpdatedEl.textContent = `Dernière mise à jour : ${d.toLocaleString("fr-FR")}`;
  try {
    const s = JSON.parse(localStorage.getItem("iptv_session") || "null") || {};
    s.updatedAt = ts;
    localStorage.setItem("iptv_session", JSON.stringify(s));
  } catch {}
}

async function refreshPlaylist() {
  const s = JSON.parse(localStorage.getItem("iptv_session") || "null");
  if (!s?.username || !s?.password) {
    setStatus("⚠️ Session manquante. Reconnecte-toi.");
    showView("login");
    return;
  }

  try {
    setStatus("⏳ Rafraîchissement de la playlist…");
    if (refreshAllBtn) refreshAllBtn.disabled = true;

    const text = await fetchPlaylistViaNetlify(s.username, s.password);

    setStatus("⏳ Analyse de la playlist…");
    allItems = parseM3U(text);

    setStatus("⏳ Mise à jour des catégories…");
    updateCounts();
    setLastUpdated(Date.now());

    // si l'utilisateur est dans une catégorie, on re-render
    if (activeCategory) renderCategoryContent();

    setStatus("✅ Playlist rafraîchie.");
  } catch (e) {
    console.error(e);
    setStatus(`❌ Refresh échoué: ${e?.message || e}`);
  } finally {
    if (refreshAllBtn) refreshAllBtn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem("iptv_session");
  allItems = [];
  activeCategory = null;
  activeSubcat = "__ALL__";
  searchQuery = "";
  setStatus("Déconnecté.");
  showView("login");
}

function bindDashActions() {
  refreshAllBtn?.addEventListener("click", refreshPlaylist);
  logoutBtn?.addEventListener("click", logout);

  // "Changer de playlist" = logout + retour login
  changePlaylistBtn.addEventListener("click", () => {
    logout();
  });
}

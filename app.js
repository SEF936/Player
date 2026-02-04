/* M3U Player - Single Tab SPA */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* Views */
const viewImport = $("#viewImport");
const viewDashboard = $("#viewDashboard");
const viewCategory = $("#viewCategory");

/* Header */
const topDate = $("#topDate");

/* Import UI */
const dropZone = $("#dropZone");
const m3uFileInput = $("#m3uFileInput");
const dzMeta = $("#dzMeta");
const importStatus = $("#importStatus");
const clearBtn = $("#clearBtn");

/* Dashboard UI */
const countTV = $("#countTV");
const countFILMS = $("#countFILMS");
const countSERIES = $("#countSERIES");
const playlistInfo = $("#playlistInfo");
const backToImportBtn = $("#backToImportBtn");

/* Category UI */
const backBtn = $("#backBtn");
const catTitle = $("#catTitle");
const catSubtitle = $("#catSubtitle");
const subcatList = $("#subcatList");
const grid = $("#grid");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");

// Series detail UI
const viewSeriesDetail = $("#viewSeriesDetail");
const seriesBackBtn = $("#seriesBackBtn");
const seriesPoster = $("#seriesPoster");
const seriesPosterWrap = $("#seriesPosterWrap");
const seriesTitleEl = $("#seriesTitle");
const seriesMetaEl = $("#seriesMeta");
const seriesGroupEl = $("#seriesGroup");
const seasonTabs = $("#seasonTabs");
const episodesTitle = $("#episodesTitle");
const episodesList = $("#episodesList");


// Modal UI
const actionModal = $("#actionModal");
const modalCloseBtn = $("#modalCloseBtn");
const modalCancelBtn = $("#modalCancelBtn");
const modalDownloadBtn = $("#modalDownloadBtn");
const modalVlcBtn = $("#modalVlcBtn");
const modalItemName = $("#modalItemName");
const modalItemMeta = $("#modalItemMeta");
const modalHint = $("#modalHint");



/* State (en mémoire) */
let allItems = [];
let fileName = "";
let activeCategory = "TV";
let activeSubcat = "TOUT";
let search = "";
let sortMode = "file";
const PAGE_SIZE = 30;

let currentItems = [];   // items filtrés + triés
let visibleCount = 0;    // combien sont affichés

let modalCurrent = null; 
// { url, name, filename, meta }


// Mode de navigation spécifique aux SERIES
let seriesMode = "shows"; // "shows" | "seasons" | "episodes"
let selectedShowKey = null;
let selectedSeason = null;
let seriesDetailSourceItems = []; // items filtrés (SERIES) au moment d’ouvrir la série


/* -------- Utils -------- */
function setStatus(el, msg) { el.textContent = msg || ""; }

function formatDateFR(d = new Date()) {
  return d.toLocaleDateString("fr-CH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function humanFileSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeGroupTitle(gt) {
  const s = (gt || "").trim();
  return s ? s : "Autres";
}
function normalizeGroupKey(gt) {
  return String(gt || "")
    .replace(/\u00A0/g, " ")     // NBSP -> espace normal
    .replace(/\s+/g, " ")        // espaces multiples -> 1 espace
    .trim();
}
function normalizeGroupKey(gt) {
  return String(gt || "")
    .replace(/\u00A0/g, " ")   // NBSP -> espace
    .replace(/\s+/g, " ")      // espaces multiples -> 1 espace
    .trim();
}

function groupLabel(gt) {
  const s = String(gt || "").trim();
  return s ? s : "Autres";
}


function sanitizeFilename(name) {
  return String(name || "media")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function guessExtFromUrl(url) {
  try {
    const u = new URL(url);
    const p = u.pathname || "";
    const m = p.match(/\.([a-z0-9]{2,5})$/i);
    return m ? `.${m[1].toLowerCase()}` : "";
  } catch {
    const m = String(url || "").match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
    return m ? `.${m[1].toLowerCase()}` : "";
  }
}

function openActionModal({ url, name, meta }) {
  const ext = guessExtFromUrl(url);
  const filename = sanitizeFilename(name) + (ext || ".mp4"); // défaut mp4 si inconnu

  modalCurrent = { url, name, meta, filename };

  modalItemName.textContent = name || "Élément";
  modalItemMeta.textContent = meta || url;

  actionModal.classList.remove("hidden");
  if (modalHint) modalHint.textContent = "";

}

function closeActionModal() {
  actionModal.classList.add("hidden");
  modalCurrent = null;
}



//------Helpers -----//
function parseSeriesSE(title) {
  // Ex: "F is for Family (MULTI) FHD S01 E01"
  const t = String(title || "").trim();
  const m = t.match(/^(.*?)(?:\s+|\s*\|?\s*)S(\d{1,2})\s*E(\d{1,3})\b/i);
  if (!m) return null;

  const show = m[1].trim();
  const season = Number(m[2]);
  const episode = Number(m[3]);

  if (!show || Number.isNaN(season) || Number.isNaN(episode)) return null;
  return { show, season, episode };
}
function getSeriesShows(itemsSeries) {
  // itemsSeries = items avec category === "SERIES"
  // retourne array de shows (unique) via buildSeriesIndex
  return buildSeriesIndex(itemsSeries);
}

function countShowsByGroupKey(shows) {
  // shows: array d'objets show (issus de buildSeriesIndex)
  // Retourne Map(groupKey -> {label, count})
  const map = new Map();

  for (const s of shows) {
    const key = s.groupKey || "Autres";
    const label = groupLabel(s.groupTitle);
    const prev = map.get(key);

    if (!prev) map.set(key, { label, count: 1 });
    else map.set(key, { label: prev.label, count: prev.count + 1 });
  }

  return map;
}


function makeShowKey(showName) {
  // clé stable (insensible aux espaces)
  return showName
    .toLowerCase()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSeriesIndex(episodeItems) {
  // episodeItems = items déjà filtrés (cat=SERIES + subcat + search éventuellement)
  // Retour : array de shows avec saisons/épisodes + stats utiles
  const shows = new Map(); // showKey -> showObj

  for (const it of episodeItems) {
    const info = parseSeriesSE(it.name);
    if (!info) continue; // si pas de Sxx Exx, on ignore ou on pourrait les traiter à part

    const showKey = makeShowKey(info.show);
    if (!shows.has(showKey)) {
      shows.set(showKey, {
        showKey,
        showName: info.show,
        logo: it.logo || "",
        groupKey: it.groupKey || "Autres",
        groupTitle: it.groupTitle || "",
        minIdx: it.__idx ?? 0,
        maxIdx: it.__idx ?? 0,

        seasons: new Map(), // season -> episodes[]
        totalEpisodes: 0
      });
    }

    const s = shows.get(showKey);
    s.totalEpisodes += 1;
    s.minIdx = Math.min(s.minIdx, it.__idx ?? 0);
    s.maxIdx = Math.max(s.maxIdx, it.__idx ?? 0);

    if (!s.logo && it.logo) s.logo = it.logo; // récupère un logo si manquant

    if (!s.seasons.has(info.season)) s.seasons.set(info.season, []);
    s.seasons.get(info.season).push({ ...it, _season: info.season, _episode: info.episode, _showName: info.show });
  }

  // Trier épisodes par numéro dans chaque saison
  for (const s of shows.values()) {
    for (const [season, eps] of s.seasons.entries()) {
      eps.sort((a, b) => (a._episode ?? 0) - (b._episode ?? 0));
      s.seasons.set(season, eps);
    }
  }

  return Array.from(shows.values());
}

function sortShows(showsArr) {
  const arr = [...showsArr];

  if (sortMode === "az") {
    arr.sort((a, b) => a.showName.localeCompare(b.showName, "fr", { sensitivity: "base" }));
  } else if (sortMode === "za") {
    arr.sort((a, b) => b.showName.localeCompare(a.showName, "fr", { sensitivity: "base" }));
  } else if (sortMode === "last") {
    // dernier ajouté = show dont l'épisode le plus récent est le plus bas dans le fichier
    arr.sort((a, b) => (b.maxIdx ?? 0) - (a.maxIdx ?? 0));
  } else {
    // ✅ ordre du fichier = show dont le premier épisode apparaît le plus tôt
    // On calcule minIdx si tu l'as, sinon on utilise maxIdx en inverse logique.
    // => meilleure option : stocker minIdx dans buildSeriesIndex.
    arr.sort((a, b) => (a.minIdx ?? a.maxIdx ?? 0) - (b.minIdx ?? b.maxIdx ?? 0));
  }

  return arr;
}

function openSeriesDetail(showKey, sourceItems) {
  // sourceItems = items SERIES déjà filtrés par sous-catégorie + recherche
  seriesDetailShowKey = showKey;
  seriesDetailSourceItems = sourceItems;

  // build index sur le scope courant pour cohérence filtre/recherche
  const shows = buildSeriesIndex(seriesDetailSourceItems);
  const show = shows.find(s => s.showKey === showKey);
  if (!show) return;

  // season par défaut = plus petite saison
  const seasons = Array.from(show.seasons.keys()).sort((a,b)=>a-b);
  seriesDetailSeason = seasons[0] ?? 1;

  renderSeriesDetail(show);
  showView("seriesDetail", true);
}

function renderSeriesDetail(show) {
  // Poster + title + meta
  seriesTitleEl.textContent = show.showName;

  const seasons = Array.from(show.seasons.keys()).sort((a,b)=>a-b);
  const totalEps = show.totalEpisodes;
  seriesMetaEl.textContent = `${seasons.length} saison${seasons.length>1?"s":""} • ${totalEps} épisode${totalEps>1?"s":""}`;

  const gt = (show.groupTitle || "").trim();
  seriesGroupEl.textContent = gt ? gt : "—";

  // Poster
  const poster = show.logo || "";
  if (poster) {
    seriesPoster.src = poster;
    seriesPoster.style.display = "block";
    seriesPoster.onerror = () => {
      seriesPoster.style.display = "none";
    };
  } else {
    seriesPoster.style.display = "none";
  }

  // Season tabs
  seasonTabs.innerHTML = seasons.map(seasonNum => {
    const active = seasonNum === seriesDetailSeason ? "active" : "";
    return `<button class="seasonTab ${active}" type="button" data-season="${seasonNum}">Saison ${seasonNum}</button>`;
  }).join("");

  seasonTabs.querySelectorAll(".seasonTab").forEach(btn => {
    btn.addEventListener("click", () => {
      seriesDetailSeason = Number(btn.dataset.season);
      renderSeriesDetail(show); // re-render simple
    });
  });

  // Episodes list (saison sélectionnée)
  const eps = show.seasons.get(seriesDetailSeason) || [];
  const sTxt = String(seriesDetailSeason).padStart(2, "0");
  episodesTitle.textContent = `Saison ${seriesDetailSeason} • ${eps.length} épisode${eps.length>1?"s":""}`;

  episodesList.innerHTML = eps.map(ep => episodeRowHtml(ep, sTxt)).join("");

  // click episode -> copie URL + VLC
episodesList.querySelectorAll(".episodeRow").forEach(row => {
  row.addEventListener("click", () => {
    const url = row.dataset.url;
    const name = row.querySelector(".episodeName")?.textContent?.trim() || "Épisode";
    const meta = `${show.showName} • Saison ${seriesDetailSeason}`;
    openActionModal({ url, name, meta });
  });
});

}

function episodeRowHtml(ep, sTxt) {
  const eMatch = String(ep.name || "").match(/\bE(\d{1,3})\b/i);
  const eNum = eMatch ? String(Number(eMatch[1])).padStart(2,"0") : "??";
  const code = `S${sTxt}E${eNum}`;

  const thumb = ep.logo || ""; // tu peux garder le poster de la série aussi si tu veux
  const title = ep.name || "Épisode";

  return `
    <div class="episodeRow" data-url="${escapeHtml(ep.url || "")}">
      <div class="episodeThumb">
        ${
          thumb
            ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy"
                 onerror="this.closest('.episodeThumb').classList.add('noposter'); this.remove();">`
            : ``
        }
        <div class="posterFallback">▶</div>
      </div>
      <div>
        <div class="episodeMeta">${escapeHtml(code)}</div>
        <div class="episodeName">${escapeHtml(title)}</div>
      </div>
    </div>
  `;
}


/* -------- Parsing -------- */
function parseM3U(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const items = [];
  let currentInf = null;

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      currentInf = parseExtInf(line);
      continue;
    }

    if (currentInf && !line.startsWith("#")) {
      items.push({ ...currentInf, url: line });
      currentInf = null;
    }
  }
  return items;
}

function parseExtInf(extinfLine) {
  // On parse SUR TOUTE la ligne pour capter tvg-logo même si format atypique
  // Supporte:
  // key="value"
  // key='value'
  // key=value   (sans espaces)
  const attrs = {};
  const attrRe = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"\s,]+))/g;

  let m;
  while ((m = attrRe.exec(extinfLine)) !== null) {
    const key = m[1];
    const val = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    attrs[key] = val;
  }

  // Fallback titre après virgule (si tvg-name vide)
  const after = extinfLine.split(":", 2)[1] || "";
  const commaIdx = after.lastIndexOf(",");
  const commaTitle = commaIdx >= 0 ? after.slice(commaIdx + 1).trim() : "";

  const tvgName = (attrs["tvg-name"] || "").trim();
  const tvgLogo = (attrs["tvg-logo"] || "").trim();
  const groupTitle = (attrs["group-title"] || "").trim();



  return {
    name: tvgName || commaTitle || "Sans titre",
    logo: tvgLogo || "",
    groupTitle,
    groupKey: normalizeGroupKey(groupTitle) || "Autres",
    raw: extinfLine
  };

}



/* Catégorisation demandée */
function categorize(item) {
  const url = (item.url || "").toLowerCase();
  const gt = (item.groupTitle || "").toLowerCase();
  const name = (item.name || "").toUpperCase();

  // 1) Priorité URL (le plus fiable)
  if (url.includes("/series/")) return "SERIES";
  if (url.includes("/movie/")) return "FILMS";

  // Variantes très courantes
  if (url.includes("/vod/")) return "FILMS";
  if (url.includes("type=movie")) return "FILMS";
  if (url.includes("type=series")) return "SERIES";

  // 2) Fallback group-title
  // (attention aux accents : on cherche des patterns simples)
  if (gt.includes("film") || gt.includes("films") || gt.includes("vod") || gt.includes("cinema") || gt.includes("movie")) {
    return "FILMS";
  }
  if (gt.includes("serie") || gt.includes("série") || gt.includes("series") || gt.includes("tv show")) {
    return "SERIES";
  }

  // 3) Fallback name (format Sxx Exx)
  if (/\bS\d{1,2}\s*E\d{1,2}\b/.test(name)) return "SERIES";

  return "TV";
}


/* -------- Navigation SPA -------- */
function showView(name, push = true) {
  viewImport.classList.toggle("hidden", name !== "import");
  viewDashboard.classList.toggle("hidden", name !== "dashboard");
  viewCategory.classList.toggle("hidden", name !== "category");
  viewSeriesDetail.classList.toggle("hidden", name !== "seriesDetail");


  const state = { view: name, cat: activeCategory };
  if (push) history.pushState(state, "", `#${name}${name === "category" ? `/${activeCategory}` : ""}`);
}

window.addEventListener("popstate", (e) => {
  const st = e.state;
  if (!st?.view) {
    showView("import", false);
    return;
  }
  if (st.view === "category" && st.cat) activeCategory = st.cat;

  if (st.view === "dashboard") renderDashboard();
  if (st.view === "category") renderCategory();

  showView(st.view, false);
});

/* -------- Dashboard -------- */
function renderDashboard() {
  const tvItems = allItems.filter(i => i.category === "TV");
  const filmItems = allItems.filter(i => i.category === "FILMS");
  const seriesItems = allItems.filter(i => i.category === "SERIES");

  const shows = getSeriesShows(seriesItems); // ✅ séries uniques

  countTV.textContent = String(tvItems.length);
  countFILMS.textContent = String(filmItems.length);
  countSERIES.textContent = String(shows.length); // ✅ pas les épisodes

  playlistInfo.textContent = fileName
    ? `Playlist: ${fileName} · ${allItems.length} éléments`
    : `Playlist chargée · ${allItems.length} éléments`;
}


/* -------- Category View -------- */
function setActiveSubcatButton(key) {
  $$(".subcatBtn").forEach(b => b.classList.toggle("active", b.dataset.key === key));
}



function sortItems(items) {
  const arr = [...items];

  if (sortMode === "az") {
    arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
  } else if (sortMode === "za") {
    arr.sort((a, b) => (b.name || "").localeCompare(a.name || "", "fr", { sensitivity: "base" }));
  } else if (sortMode === "last") {
    // Derniers ajoutés (inverse de l'ordre du fichier)
    arr.sort((a, b) => (b.__idx ?? 0) - (a.__idx ?? 0));
  } else {
    // ✅ Par défaut: ordre du fichier (croissant)
    arr.sort((a, b) => (a.__idx ?? 0) - (b.__idx ?? 0));
  }

  return arr;
}


function subcatBtnHtml(label, key, count) {
  return `
    <button class="subcatBtn" type="button" data-key="${escapeHtml(key)}">
      <span class="subcatName">${escapeHtml(label)}</span>
      <span class="subcatCount">${count}</span>
    </button>
  `;
}



function renderSubcats(itemsCat) {
  // ✅ CAS SERIES : sidebar doit compter des "séries" (shows), pas des épisodes
  if (activeCategory === "SERIES") {
    const shows = getSeriesShows(itemsCat);

    // Map conserve l'ordre d'apparition (ordre M3U)
    const map = new Map(); // groupKey -> { label, count }

    for (const s of shows) {
      const key = s.groupKey || "Autres";
      const label = groupLabel(s.groupTitle);

      if (!map.has(key)) map.set(key, { label, count: 1 });
      else {
        const prev = map.get(key);
        map.set(key, { label: prev.label, count: prev.count + 1 });
      }
    }

    const entries = Array.from(map.entries()); // ✅ pas de tri => ordre M3U

    subcatList.innerHTML = [
      subcatBtnHtml("TOUT", "__ALL__", shows.length), // ✅ total séries
      ...entries.map(([key, v]) => subcatBtnHtml(v.label, key, v.count))
    ].join("");

    subcatList.querySelectorAll(".subcatBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeSubcat = btn.dataset.key;
        setActiveSubcatButton(activeSubcat);

        // Quand on change de sous-catégorie, on revient au niveau "shows"
        seriesMode = "shows";
        selectedShowKey = null;
        selectedSeason = null;

        renderGrid(true);
      });
    });

    setActiveSubcatButton(activeSubcat);
    return;
  }

  // ✅ CAS FILMS / TV : comportement normal (items)
  const map = new Map(); // groupKey -> { label, count }

  for (const it of itemsCat) {
    const key = it.groupKey || "Autres";
    const label = groupLabel(it.groupTitle);

    if (!map.has(key)) map.set(key, { label, count: 1 });
    else {
      const prev = map.get(key);
      map.set(key, { label: prev.label, count: prev.count + 1 });
    }
  }

  const entries = Array.from(map.entries()); // ✅ ordre M3U

  subcatList.innerHTML = [
    subcatBtnHtml("TOUT", "__ALL__", itemsCat.length),
    ...entries.map(([key, v]) => subcatBtnHtml(v.label, key, v.count))
  ].join("");

  subcatList.querySelectorAll(".subcatBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeSubcat = btn.dataset.key;
      setActiveSubcatButton(activeSubcat);
      renderGrid(true);
    });
  });

  setActiveSubcatButton(activeSubcat);
}





function cardHtml(it) {
  const title = it.name || "Sans titre";
  const poster = it.logo || "";

  return `
    <div class="mediaCard" data-url="${escapeHtml(it.url || "")}" title="${escapeHtml(title)}">
      <div class="poster">
        ${poster
      ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy"
                 onerror="this.closest('.poster').classList.add('noposter'); this.remove();">`
      : ``
    }
        <div class="posterFallback">🎬</div>
      </div>
      <div class="mediaTitle">${escapeHtml(title)}</div>
    </div>
  `;
}
function seriesCardHtml(x) {
  // x peut être show / season / episode
  const poster = x.logo || "";
  let title = "";
  let meta = "";

  if (x._type === "show") {
    title = x.showName;
    meta = `${x.seasonsCount} saison(s) · ${x.episodesCount} épisode(s)`;
  } else if (x._type === "season") {
    title = `Saison ${String(x.season).padStart(2, "0")}`;
    meta = `${x.episodesCount} épisode(s)`;
  } else {
    // episode
    title = x.name || "Épisode";
    meta = groupLabel(x.groupTitle);
  }

  return `
    <div class="mediaCard" data-type="${x._type}" data-showkey="${escapeHtml(x.showKey || "")}" data-season="${x.season ?? ""}" data-url="${escapeHtml(x.url || "")}">
      <div class="poster">
        ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy"
          onerror="this.closest('.poster').classList.add('noposter'); this.remove();">` : ``}
        <div class="posterFallback">🎬</div>
      </div>
      <div class="mediaTitle">${escapeHtml(title)}</div>
      <div class="muted small">${escapeHtml(meta)}</div>
    </div>
  `;
}

function bindSeriesCardClicks() {
  grid.querySelectorAll(".mediaCard").forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";

    el.addEventListener("click", async () => {
      const type = el.dataset.type;

     if (type === "show") {
  // ✅ on reconstruit les items SERIES filtrés actuels (mêmes règles que renderGrid)
  const itemsCat = allItems.filter(it => it.category === "SERIES");
  let scoped = itemsCat;

  if (activeSubcat !== "__ALL__") {
    scoped = scoped.filter(it => (it.groupKey || "Autres") === activeSubcat);
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    scoped = scoped.filter(it =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.groupTitle || "").toLowerCase().includes(q)
    );
  }

  openSeriesDetail(el.dataset.showkey, scoped);
  return;
}


      if (type === "season") {
        seriesMode = "episodes";
        selectedSeason = Number(el.dataset.season);
        renderGrid(true);
        showView("category", true);
        return;
      }

      // episode -> action lecture
      const url = el.dataset.url;
      try { await navigator.clipboard.writeText(url); } catch { }
      window.open(`vlc://${url}`, "_blank");
    });
  });
}

seriesBackBtn.addEventListener("click", () => {
  showView("category", true);   // retour à la liste des séries (shows)
});


function renderGrid(reset = true) {
  const itemsCat = allItems.filter(it => it.category === activeCategory);
  let items = itemsCat;

  // Filtre sous-catégorie (groupKey)
  if (activeSubcat !== "__ALL__") {
    items = items.filter(it => (it.groupKey || "Autres") === activeSubcat);
  }

  // Recherche
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(it =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.groupTitle || "").toLowerCase().includes(q)
    );
  }

  // ✅ CAS SERIES : transformer épisodes -> shows/saisons/épisodes
  if (activeCategory === "SERIES") {
    const shows = buildSeriesIndex(items); // items = épisodes filtrés (source)

    let listToShow = [];

    if (seriesMode === "shows") {
      // 1 card par série
      listToShow = sortShows(shows).map(s => ({
        _type: "show",
        showKey: s.showKey,
        showName: s.showName,
        logo: s.logo,
        seasonsCount: s.seasons.size,
        episodesCount: s.totalEpisodes,
        maxIdx: s.maxIdx
      }));

    } else if (seriesMode === "seasons") {
      // liste des saisons d'une série
      const show = shows.find(x => x.showKey === selectedShowKey);
      if (!show) {
        seriesMode = "shows";
        selectedShowKey = null;
        selectedSeason = null;
        return renderGrid(true);
      }

      const seasons = Array.from(show.seasons.keys()).sort((a, b) => a - b);
      listToShow = seasons.map(seasonNum => ({
        _type: "season",
        showKey: show.showKey,
        showName: show.showName,
        logo: show.logo,
        season: seasonNum,
        episodesCount: show.seasons.get(seasonNum).length,
        maxIdx: show.maxIdx
      }));

    } else if (seriesMode === "episodes") {
      // liste des épisodes d'une saison
      const show = shows.find(x => x.showKey === selectedShowKey);
      if (!show || !show.seasons.has(selectedSeason)) {
        seriesMode = "shows";
        selectedShowKey = null;
        selectedSeason = null;
        return renderGrid(true);
      }

      const eps = show.seasons.get(selectedSeason);

      // tri épisodes selon le tri global
      const epsSorted = sortItems(eps);
      listToShow = epsSorted.map(ep => ({
        _type: "episode",
        ...ep
      }));
    }

    // Pagination (30/30)
    currentItems = listToShow;
    if (reset) {
      visibleCount = PAGE_SIZE;
      grid.innerHTML = "";
      grid.scrollTop = 0;
    }

    const slice = currentItems.slice(0, visibleCount);

    // Title & Subtitle (cohérents)
    if (seriesMode === "shows") {
      catTitle.textContent = "SERIES";
      catSubtitle.textContent = `${shows.length} séries · Affichés: ${slice.length}`;
    } else if (seriesMode === "seasons") {
      const showName = shows.find(x => x.showKey === selectedShowKey)?.showName || "";
      catTitle.textContent = `SERIES · ${showName}`;
      catSubtitle.textContent = `Saisons · Affichés: ${slice.length}`;
    } else {
      const showName = shows.find(x => x.showKey === selectedShowKey)?.showName || "";
      const sNum = String(selectedSeason).padStart(2, "0");
      catTitle.textContent = `SERIES · ${showName} · S${sNum}`;
      catSubtitle.textContent = `Épisodes · Affichés: ${slice.length}`;
    }

    grid.innerHTML = slice.map(seriesCardHtml).join("");
    emptyState.classList.toggle("hidden", slice.length !== 0);

    bindSeriesCardClicks();
    return;
  }

  // ✅ CAS TV / FILMS : comportement normal + pagination
  items = sortItems(items);
  currentItems = items;

  if (reset) {
    visibleCount = PAGE_SIZE;
    grid.innerHTML = "";
    grid.scrollTop = 0;
  }

  const slice = currentItems.slice(0, visibleCount);

  catTitle.textContent = activeCategory;
  catSubtitle.textContent = `${itemsCat.length} éléments · Affichés: ${slice.length}`;

  grid.innerHTML = slice.map(cardHtml).join("");
  emptyState.classList.toggle("hidden", slice.length !== 0);

  bindCardClicks();
}


function loadMoreIfNeeded() {
  // rien à charger
  if (!currentItems || visibleCount >= currentItems.length) return;

  const prevCount = visibleCount;
  visibleCount = Math.min(visibleCount + PAGE_SIZE, currentItems.length);

  // on ajoute uniquement les nouveaux items
  const newSlice = currentItems.slice(prevCount, visibleCount);

  // append (⚠️ pas innerHTML = sinon reset)
  const html =
    activeCategory === "SERIES"
      ? newSlice.map(seriesCardHtml).join("")
      : newSlice.map(cardHtml).join("");

  grid.insertAdjacentHTML("beforeend", html);

  // rebind uniquement les nouveaux
  if (activeCategory === "SERIES") {
    bindSeriesCardClicks();
  } else {
    bindCardClicks();
  }
}

function bindCardClicks() {
  grid.querySelectorAll(".mediaCard").forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";

    el.addEventListener("click", () => {
      const url = el.dataset.url;
      const name = el.querySelector(".mediaTitle")?.textContent?.trim() || "Élément";
      const meta = activeCategory; // TV / FILMS
      openActionModal({ url, name, meta });
    });
  });
}




function renderCategory() {
  if (activeCategory === "SERIES") {
    seriesMode = "shows";
    selectedShowKey = null;
    selectedSeason = null;
  }

  search = "";
  searchInput.value = "";
  sortMode = "file";
  sortSelect.value = "file";


  activeSubcat = "__ALL__";


  const itemsCat = allItems.filter(it => it.category === activeCategory);
  renderSubcats(itemsCat);
  renderGrid();
}

/* -------- Import -------- */
async function handleFile(file) {
  if (!file) return;

  const lower = (file.name || "").toLowerCase();
  const okExt = lower.endsWith(".m3u") || lower.endsWith(".m3u8");
  const okType = (file.type || "").includes("mpegurl") || (file.type || "").includes("text");

  if (!okExt && !okType) {
    setStatus(importStatus, "Format non supporté. Charge un fichier .m3u ou .m3u8");
    return;
  }

  setStatus(importStatus, "Lecture et analyse du fichier…");
  const text = await file.text();

  const base = parseM3U(text);

  allItems = base.map((it, idx) => ({
    ...it,
    __idx: idx,
    category: categorize(it)

  }));
  console.log("EXTINF sample raw:", base[0]?.raw);
  console.log("Parsed sample:", base[0]);

  // DEBUG : voir les sous-catégories détectées pour FILMS
  const filmGroups = allItems
    .filter(x => x.category === "FILMS")
    .map(x => (x.groupTitle || "").trim())
    .filter(Boolean);

  const unique = Array.from(new Set(filmGroups)).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  console.log("FILMS - sous catégories (uniques):", unique.length, unique);



  fileName = file.name;
  dzMeta.textContent = `${file.name} · ${humanFileSize(file.size)} · ${allItems.length} éléments`;
  setStatus(importStatus, `Playlist analysée ✅ (${allItems.length} éléments).`);

  renderDashboard();
  showView("dashboard", true);
}

function initDropZone() {
  const openPicker = () => m3uFileInput.click();

  dropZone.addEventListener("click", openPicker);
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openPicker();
  });

  m3uFileInput.addEventListener("change", () => {
    handleFile(m3uFileInput.files?.[0]);
  });

  ["dragenter", "dragover"].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    handleFile(e.dataTransfer?.files?.[0]);
  });
}

/* -------- Events -------- */

// Dashboard -> category
$$(".catCard").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!allItems.length) return;
    activeCategory = btn.dataset.cat;
    renderCategory();
    showView("category", true);
  });
});

backBtn.addEventListener("click", () => {
  if (activeCategory === "SERIES") {
    if (seriesMode === "episodes") {
      seriesMode = "seasons";
      selectedSeason = null;
      renderGrid(true);
      return;
    }
    if (seriesMode === "seasons") {
      seriesMode = "shows";
      selectedShowKey = null;
      renderGrid(true);
      return;
    }
  }

  // comportement normal
  renderDashboard();
  showView("dashboard", true);
});


// Dashboard -> back import
backToImportBtn.addEventListener("click", () => {
  showView("import", true);
});

// Search / sort
searchInput.addEventListener("input", () => {
  search = searchInput.value;
  renderGrid();
});
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderGrid();
});

// Reset (reviens à import et purge mémoire)
clearBtn.addEventListener("click", () => {
  allItems = [];
  fileName = "";
  dzMeta.textContent = "";
  setStatus(importStatus, "Charge une playlist M3U pour démarrer.");
  showView("import", true);
});

/* -------- Init -------- */
topDate.textContent = formatDateFR(new Date());
initDropZone();
setStatus(importStatus, "Charge une playlist M3U pour démarrer.");
history.replaceState({ view: "import" }, "", "#import");
grid.addEventListener("scroll", () => {
  const threshold = grid.scrollHeight * 0.8;
  const position = grid.scrollTop + grid.clientHeight;

  if (position >= threshold) {
    loadMoreIfNeeded();
  }
});

modalCloseBtn.addEventListener("click", closeActionModal);
modalCancelBtn.addEventListener("click", closeActionModal);

// clic hors de la carte => ferme
actionModal.addEventListener("click", (e) => {
  if (e.target === actionModal) closeActionModal();
});

// ESC => ferme
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !actionModal.classList.contains("hidden")) {
    closeActionModal();
  }
});

modalVlcBtn.addEventListener("click", () => {
  if (!modalCurrent) return;
  const url = modalCurrent.url;
  closeActionModal();
  window.open(`vlc://${url}`, "_blank");
});

modalDownloadBtn.addEventListener("click", () => {
  if (!modalCurrent) return;

  const { url } = modalCurrent;

  console.log("🌐 Open download link in new tab");
  console.log("➡️ URL:", url);

  // Ouverture immédiate (méthode la plus fiable IPTV)
  window.open(url, "_blank", "noopener");

  closeActionModal();
});





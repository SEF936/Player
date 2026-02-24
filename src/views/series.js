import { state } from "../state.js";
import { buildShows } from "../utils/series.js";
import { hydrateSeriesPosters } from "../services/seriesPosters.js";

export function renderSeries(el, { setStatus, onBack, onOpenShow }) {
  const seriesItems = state.allItems.filter((x) => x.category === "SERIES");
  const shows = buildShows(seriesItems);

  el.innerHTML = `
    <header class="catHeader">
      <div class="catHeaderLeft">
        <button class="btnGhost" type="button" data-role="back">← Retour</button>
        <div class="catHeaderTitle">
          <div class="catTitle">SÉRIES</div>
          <div class="muted small">${shows.length} série(s)</div>
        </div>
      </div>
      <div class="catHeaderRight">
        <input class="catSearch" data-role="search" placeholder="Rechercher…">
      </div>
    </header>

    <div class="catLayout">
      <aside class="catSidebar">
        <div class="catSidebarTitle">Sous-catégories</div>
        <div class="subcatList" data-role="subcats"></div>
      </aside>

      <section class="catGridWrap">
        <div class="catGrid" data-role="grid"></div>
        <div class="emptyState hidden" data-role="empty">Aucun résultat.</div>
      </section>
    </div>
  `;

  const backBtn = el.querySelector('[data-role="back"]');
  const searchEl = el.querySelector('[data-role="search"]');
  const subcatsEl = el.querySelector('[data-role="subcats"]');
  const gridEl = el.querySelector('[data-role="grid"]');
  const emptyEl = el.querySelector('[data-role="empty"]');

  backBtn.onclick = () => onBack?.();

  // ----------------------------
  // Local state (DOIT être déclaré avant usage)
  // ----------------------------
  let activeSubcat = "__ALL__";
  let q = "";

  // ----------------------------
  // Sous-catégories (comptées en séries uniques)
  // ----------------------------
  const order = [];
  const counts = new Map();

  for (const sh of shows) {
    const k = (sh.groupTitle || "Autres").trim() || "Autres";
    if (!counts.has(k)) {
      counts.set(k, 0);
      order.push(k);
    }
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  // ✅ Default subcat: "récemment ajouté" (après remplissage order)
  const def = pickDefaultRecentSubcat(order);
  if (def && def !== "__ALL__") activeSubcat = def;

  function subBtn(label, count, active) {
    return `
      <button class="subcatBtn ${active ? "active" : ""}" data-k="${escapeHtml(
        label
      )}" type="button">
        <span class="subcatName">${escapeHtml(label)}</span>
        <span class="subcatCount">${count}</span>
      </button>
    `;
  }

  function renderSubcats() {
    const rows = [];
    rows.push(subBtn("TOUT", shows.length, activeSubcat === "__ALL__"));

    for (const k of order) {
      rows.push(subBtn(k, counts.get(k) || 0, activeSubcat === k));
    }

    subcatsEl.innerHTML = rows.join("");

    subcatsEl.querySelectorAll(".subcatBtn").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.k;
        activeSubcat = key === "TOUT" ? "__ALL__" : key;

        // ✅ surbrillance correcte
        renderSubcats();

        // ✅ reset + reload
        gridEl.scrollTop = 0;
        renderGrid();
      };
    });
  }

  function showCard(sh) {
    const meta =
      `${sh.seasons.size} saison${sh.seasons.size > 1 ? "s" : ""} • ` +
      `${sh.totalEpisodes} épisode${sh.totalEpisodes > 1 ? "s" : ""}`;

    const cachedPoster = state.posterByShowKey[sh.showKey];
const fallback = sh.logo || "";
const initial = cachedPoster || fallback;

    return `
  <div class="mediaCard" data-showkey="${escapeHtml(sh.showKey)}">
    <div class="poster ${initial ? "" : "noposter"}">
      <img class="seriesPosterImg"
           data-showtitle="${escapeHtml(sh.showName)}"
           data-m3ulogo="${escapeHtml(fallback)}"
           loading="lazy"
           decoding="async"
           style="${initial ? "display:block;" : "display:none;"}"
           ${initial ? `src="${escapeHtml(initial)}"` : ""}>
      <div class="posterFallback">🎬</div>
    </div>
    <div class="mediaTitle">${escapeHtml(sh.showName)}</div>
    <div class="muted small">${escapeHtml(meta)}</div>
  </div>
    `;
  }

  // ---------- Posters IO ----------
  let io = null;

  function setupObserver() {
    if (io) {
      io.disconnect();
      io = null;
    }

    io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target);
        if (!visible.length) return;

        // stop observing; hydrate will mark done
        visible.forEach((img) => io.unobserve(img));

        // ✅ hydrate 30 posters max (pour la sous-cat courante)
        hydrateSeriesPosters(gridEl, { batch: 30 });
      },
      {
        root: gridEl,
        rootMargin: "600px 0px",
        threshold: 0.01,
      }
    );
  }

  function observeImgs() {
    if (!io) return;
    gridEl
      .querySelectorAll("img.seriesPosterImg:not([data-observed])")
      .forEach((img) => {
        img.dataset.observed = "1";
        io.observe(img);
      });
  }

  function bindShowClicks(currentList) {
    gridEl.querySelectorAll(".mediaCard").forEach((card) => {
      if (card.dataset.bound) return;
      card.dataset.bound = "1";

      card.onclick = () => {
        const key = card.dataset.showkey;
        const sh = currentList.find((s) => s.showKey === key);
        if (!sh) {
          console.warn("❌ show not found for key:", key);
          return;
        }
        onOpenShow?.(sh);
      };
    });
  }

  // ----------------------------
  // Grid rendering (lazy + posters)
  // ----------------------------
  let rendered = 0;
  const BATCH = 30;
  let currentList = [];

  function computeList() {
    let list = shows;

    if (activeSubcat !== "__ALL__") {
      list = list.filter(
        (sh) => ((sh.groupTitle || "Autres").trim() || "Autres") === activeSubcat
      );
    }

    if (q) {
      const qq = q.toLowerCase();
      list = list.filter((sh) => (sh.showName || "").toLowerCase().includes(qq));
    }

    // ordre playlist conservé par buildShows (minIdx) + safety
    list = [...list].sort((a, b) => (a.minIdx ?? 0) - (b.minIdx ?? 0));
    return list;
  }

  function renderMore() {
    const slice = currentList.slice(rendered, rendered + BATCH);
    rendered += slice.length;

    gridEl.insertAdjacentHTML("beforeend", slice.map(showCard).join(""));
    bindShowClicks(currentList);

    // Observe new images; hydrate will happen via IO + a small kick
    observeImgs();
    setTimeout(() => hydrateSeriesPosters(gridEl, { batch: 30 }), 0);
  }

  function renderGrid() {
    currentList = computeList();

    gridEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", currentList.length > 0);

    // reset scroll & counters
    rendered = 0;
    gridEl.scrollTop = 0;

    if (!currentList.length) {
      if (io) {
        io.disconnect();
        io = null;
      }
      return;
    }

    // Setup IO once per render
    setupObserver();

    // first batch
    renderMore();

    gridEl.onscroll = null;
    gridEl.addEventListener(
      "scroll",
      () => {
        const near =
          gridEl.scrollTop + gridEl.clientHeight >= gridEl.scrollHeight - 300;
        if (near && rendered < currentList.length) renderMore();
      },
      { passive: true }
    );
  }

  // Search
  searchEl.addEventListener("input", (e) => {
    q = (e.target.value || "").trim().toLowerCase();
    gridEl.scrollTop = 0;
    renderGrid();
  });

  renderSubcats();
  renderGrid();
  setStatus?.("");
}

// ---- helpers ----
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function pickDefaultRecentSubcat(order) {
  const candidates = order.filter((k) => {
    const n = norm(k);
    return n.includes("recemment") && n.includes("ajoutees");
  });
  return candidates[0] || "__ALL__";
}

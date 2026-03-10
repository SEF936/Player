import { state } from "../state.js";
import { buildShows } from "../utils/series.js";
import { hydrateSeriesPosters } from "../services/seriesPosters.js";

export function renderSeries(el, { setStatus, onBack, onOpenShow }) {
  const seriesItems = state.allItems.filter((x) => x.category === "SERIES");
  const shows = buildShows(seriesItems);

  el.innerHTML = `
    <header class="catHeader">
      <div class="catHeaderLeft">
        <button class="btnGhost" type="button" data-role="back">&larr; Retour</button>
        <div class="catHeaderTitle">
          <div class="catTitle">S&Eacute;RIES</div>
          <div class="muted small">${shows.length} s&eacute;rie(s)</div>
        </div>
      </div>
      <div class="catHeaderRight">
        <div class="catSearchWrap" data-role="search-wrap">
          <button
            class="catSearchToggle"
            data-role="search-toggle"
            type="button"
            aria-label="Ouvrir la recherche"
            aria-expanded="false"
          >
            🔍
          </button>
          <input class="catSearch" data-role="search" placeholder="Rechercher...">
        </div>
      </div>
    </header>

    <div class="mobileSubcatBar">
      <select
        class="subcatSelect"
        data-role="subcat-select"
        aria-label="Sous-cat&eacute;gorie S&eacute;ries"
      >
        <option value="__ALL__">TOUT</option>
      </select>
    </div>

    <div class="catLayout">
      <aside class="catSidebar">
        <div class="catSidebarTitle">Sous-cat&eacute;gories</div>
        <div class="subcatList" data-role="subcats"></div>
      </aside>

      <section class="catGridWrap">
        <div class="catGrid" data-role="grid"></div>
        <div class="emptyState hidden" data-role="empty">Aucun r&eacute;sultat.</div>
      </section>
    </div>
  `;

  const backBtn = el.querySelector('[data-role="back"]');
  const searchEl = el.querySelector('[data-role="search"]');
  const searchWrapEl = el.querySelector('[data-role="search-wrap"]');
  const searchToggleEl = el.querySelector('[data-role="search-toggle"]');
  const subcatsEl = el.querySelector('[data-role="subcats"]');
  const subcatSelectEl = el.querySelector('[data-role="subcat-select"]');
  const gridEl = el.querySelector('[data-role="grid"]');
  const emptyEl = el.querySelector('[data-role="empty"]');

  backBtn.onclick = () => onBack?.();

  function collapseMobileSearchOnSubcatChange() {
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    if (!isMobile || !searchWrapEl || !searchToggleEl || !searchEl) return;
    q = "";
    searchEl.value = "";
    searchWrapEl.classList.remove("is-open");
    searchToggleEl.setAttribute("aria-expanded", "false");
    searchToggleEl.setAttribute("aria-label", "Ouvrir la recherche");
    searchEl.blur();
  }

  // ----------------------------
  // Local state (DOIT Ãªtre dÃ©clarÃ© avant usage)
  // ----------------------------
  let activeSubcat = "__ALL__";
  let q = "";

  // ----------------------------
  // Sous-catÃ©gories (comptÃ©es en sÃ©ries uniques)
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

  // âœ… Default subcat: "rÃ©cemment ajoutÃ©" (aprÃ¨s remplissage order)
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

  function applySubcat(key) {
    activeSubcat = key === "TOUT" ? "__ALL__" : key;
    renderSubcats();
    collapseMobileSearchOnSubcatChange();
    gridEl.scrollTop = 0;
    renderGrid();
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
        applySubcat(btn.dataset.k);
      };
    });

    if (subcatSelectEl) {
      const options = [
        `<option value="__ALL__"${
          activeSubcat === "__ALL__" ? " selected" : ""
        }>TOUT (${shows.length})</option>`,
      ];

      for (const k of order) {
        options.push(
          `<option value="${escapeHtml(k)}"${
            activeSubcat === k ? " selected" : ""
          }>${escapeHtml(k)} (${counts.get(k) || 0})</option>`
        );
      }

      subcatSelectEl.innerHTML = options.join("");
      subcatSelectEl.value = activeSubcat;
    }
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
      <div class="posterFallback">&#127916;</div>
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

        // âœ… hydrate 30 posters max (pour la sous-cat courante)
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
          console.warn("âŒ show not found for key:", key);
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

    // ordre playlist conservÃ© par buildShows (minIdx) + safety
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

  if (subcatSelectEl) {
    const closeSelect = () => subcatSelectEl.setAttribute("size", "1");
    const openSelect = () => {
      if (!window.matchMedia("(max-width: 720px)").matches) return;
      subcatSelectEl.setAttribute("size", "8");
    };

    subcatSelectEl.addEventListener("focus", openSelect);
    subcatSelectEl.addEventListener("click", openSelect);
    subcatSelectEl.addEventListener("blur", closeSelect);

    subcatSelectEl.addEventListener("change", (e) => {
      applySubcat(e.target.value || "__ALL__");
      closeSelect();
      subcatSelectEl.blur();
    });
  }

  if (searchWrapEl && searchToggleEl && searchEl) {
    const setSearchOpen = (open) => {
      const keepOpen = q.length > 0;
      const isOpen = open || keepOpen;
      searchWrapEl.classList.toggle("is-open", isOpen);
      searchToggleEl.setAttribute("aria-expanded", String(isOpen));
      searchToggleEl.setAttribute(
        "aria-label",
        isOpen ? "Fermer la recherche" : "Ouvrir la recherche"
      );
      if (isOpen) searchEl.focus();
    };

    searchToggleEl.addEventListener("click", () => {
      setSearchOpen(!searchWrapEl.classList.contains("is-open"));
    });

    searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !q) {
        setSearchOpen(false);
        searchEl.blur();
      }
    });

    searchEl.addEventListener("blur", () => {
      if (!q) setSearchOpen(false);
    });
  }

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

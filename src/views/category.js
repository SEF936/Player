import { state } from "../state.js";
import { hydrateFilmPosters } from "../services/filmPosters.js";

export function renderCategory(
  el,
  { setStatus, onBack, onOpenFilm, onOpenTvItem, category }
) {
  const cat = category || state.activeCategory || "TV";
  const items = state.allItems.filter((x) => x.category === cat);

  el.innerHTML = `
    <header class="catHeader">
      <div class="catHeaderLeft">
        <button class="btnGhost" data-role="back">&larr; Retour</button>
        <div class="catHeaderTitle">
          <div class="catTitle">${escapeHtml(cat)}</div>
          <div class="muted small">${items.length} &eacute;l&eacute;ment(s)</div>
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
        aria-label="Sous-cat&eacute;gorie ${escapeHtml(cat)}"
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
  // Local filter state (DOIT Ãªtre dÃ©clarÃ© avant usage)
  // ----------------------------
  let activeSubcat = "__ALL__";
  let q = "";

  // ----------------------------
  // Sous-catÃ©gories (ordre playlist)
  // ----------------------------
  const order = [];
  const counts = new Map();

  for (const it of items) {
    const key = (it.groupTitle || "Autres").trim() || "Autres";
    if (!counts.has(key)) {
      counts.set(key, 0);
      order.push(key);
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // âœ… Default subcat: "rÃ©cemment ajoutÃ©" pour FILMS (aprÃ¨s remplissage de order)
  if (cat === "FILMS") {
    const def = pickDefaultRecentSubcat(order);
    if (def && def !== "__ALL__") activeSubcat = def;
  }

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
    rows.push(subBtn("TOUT", items.length, activeSubcat === "__ALL__"));

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
        }>TOUT (${items.length})</option>`,
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

  // ----------------------------
  // Card HTML
  // ----------------------------
  function card(it) {
    if (cat === "FILMS") {
      const cachedPoster = state.posterByIdx[it.__idx];
      const fallback = it.logo || "";
      const initial = cachedPoster || fallback;
      return `
  <div class="mediaCard" data-idx="${it.__idx}">
    <div class="poster ${initial ? "" : "noposter"}">
      <img class="filmPosterImg"
           data-movietitle="${escapeHtml(it.name || "")}"
           data-m3ulogo="${escapeHtml(fallback)}"
           loading="lazy"
           decoding="async"
           style="${initial ? "display:block;" : "display:none;"}"
           ${initial ? `src="${escapeHtml(initial)}"` : ""}>
      <div class="posterFallback">&#127916;</div>
    </div>
    <div class="mediaTitle">${escapeHtml(it.name || "Film")}</div>
  </div>
      `;
    }

    // TV
    const logo = it.logo || "";

    return `
      <div class="mediaCard" data-idx="${it.__idx}">
        <div class="poster ${logo ? "" : "noposter"}">
          ${
            logo
              ? `<img src="${escapeHtml(logo)}"
                     alt=""
                     loading="lazy"
                     onerror="this.remove(); this.closest('.poster')?.classList.add('noposter');">`
              : ""
          }
          <div class="posterFallback">&#9654;</div>
        </div>
        <div class="mediaTitle">${escapeHtml(it.name || "Élément")}</div>
      </div>
    `;
  }

  // ----------------------------
  // Grid rendering (lazy + posters)
  // ----------------------------
  let rendered = 0;
  const BATCH = 30;
  let currentList = []; // list filtrÃ©e courante (pour scroll)

  function computeList() {
    let list = items;

    if (activeSubcat !== "__ALL__") {
      list = list.filter(
        (x) => ((x.groupTitle || "Autres").trim() || "Autres") === activeSubcat
      );
    }

    if (q) {
      const qq = q.toLowerCase();
      list = list.filter((x) => (x.name || "").toLowerCase().includes(qq));
    }

    // ðŸ”¥ ordre playlist strict
    list = [...list].sort((a, b) => (a.__idx ?? 0) - (b.__idx ?? 0));
    return list;
  }

  function bindClicks() {
    gridEl.querySelectorAll(".mediaCard").forEach((cardEl) => {
      if (cardEl.dataset.bound) return;
      cardEl.dataset.bound = "1";

      cardEl.onclick = () => {
        const idx = Number(cardEl.dataset.idx);
        const it = state.allItems.find((x) => x.__idx === idx);
        if (!it) return;

        if (cat === "FILMS") return onOpenFilm?.(it);
        return onOpenTvItem?.(it);
      };
    });
  }

  function hydratePostersIfNeeded() {
    if (cat === "FILMS") {
      // âœ… 30 posters max pour les 30 cards affichÃ©es
      hydrateFilmPosters(gridEl, { batch: 30 });
    }
  }

  function renderMore() {
    const slice = currentList.slice(rendered, rendered + BATCH);
    rendered += slice.length;

    gridEl.insertAdjacentHTML("beforeend", slice.map(card).join(""));
    bindClicks();

    // posters seulement pour ce qui vient dâ€™Ãªtre rendu
    hydratePostersIfNeeded();
  }

  function renderGrid() {
    currentList = computeList();

    gridEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", currentList.length > 0);

    rendered = 0;
    gridEl.scrollTop = 0;

    if (!currentList.length) return;

    // 1er batch = 30 items
    renderMore();

    gridEl.onscroll = null;
    gridEl.addEventListener(
      "scroll",
      () => {
        const near =
          gridEl.scrollTop + gridEl.clientHeight >= gridEl.scrollHeight - 300;
        if (near && rendered < currentList.length) {
          renderMore();
        }
      },
      { passive: true }
    );
  }

  // ----------------------------
  // Search
  // ----------------------------
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

  // Initial render
  renderSubcats();
  renderGrid();
  setStatus?.("");
}

// --------------------------------
// Helpers
// --------------------------------
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
    return n.includes("recemment") && n.includes("ajoutes");
  });
  return candidates[0] || "__ALL__";
}

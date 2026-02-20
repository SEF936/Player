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
        <button class="btnGhost" data-role="back">← Retour</button>
        <div class="catHeaderTitle">
          <div class="catTitle">${escapeHtml(cat)}</div>
          <div class="muted small">${items.length} élément(s)</div>
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
  // Local filter state (DOIT être déclaré avant usage)
  // ----------------------------
  let activeSubcat = "__ALL__";
  let q = "";

  // ----------------------------
  // Sous-catégories (ordre playlist)
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

  // ✅ Default subcat: "récemment ajouté" pour FILMS (après remplissage de order)
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

  function renderSubcats() {
    const rows = [];
    rows.push(subBtn("TOUT", items.length, activeSubcat === "__ALL__"));

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

        // ✅ reset + reload 30 premiers + 30 posters
        gridEl.scrollTop = 0;
        renderGrid();
      };
    });
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
      <div class="posterFallback">🎬</div>
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
          <div class="posterFallback">▶</div>
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
  let currentList = []; // list filtrée courante (pour scroll)

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

    // 🔥 ordre playlist strict
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
      // ✅ 30 posters max pour les 30 cards affichées
      hydrateFilmPosters(gridEl, { batch: 30 });
    }
  }

  function renderMore() {
    const slice = currentList.slice(rendered, rendered + BATCH);
    rendered += slice.length;

    gridEl.insertAdjacentHTML("beforeend", slice.map(card).join(""));
    bindClicks();

    // posters seulement pour ce qui vient d’être rendu
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

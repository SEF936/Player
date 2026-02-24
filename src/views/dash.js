import { state } from "../state.js";
import { buildShows } from "../utils/series.js";

export function renderDash(el, { setStatus, onOpenCategory, onLogout } = {}) {

  const tvItems = state.allItems.filter(x => x.category === "TV");
  const filmItems = state.allItems.filter(x => x.category === "FILMS");
  const seriesItems = state.allItems.filter(x => x.category === "SERIES");
  const uniqueShows = buildShows(seriesItems);

  el.innerHTML = `
    <div class="dashMain">
      <div class="dashCenter">

        <div class="cards">
          <button id="tvCard" class="catCard" type="button">
            <div class="catName">TV</div>
            <div class="catCount">${tvItems.length}</div>
            <div class="catHint">Chaînes & live</div>
          </button>

          <button id="filmsCard" class="catCard" type="button">
            <div class="catName">FILMS</div>
            <div class="catCount">${filmItems.length}</div>
            <div class="catHint">Films</div>
          </button>

          <button id="seriesCard" class="catCard" type="button">
            <div class="catName">SÉRIES</div>
            <div class="catCount">${uniqueShows.length}</div>
            <div class="catHint">Séries (regroupées)</div>
          </button>
        </div>

        <div class="dashFooterRow">
          <div class="muted small">
            Total éléments playlist : ${state.allItems.length}
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="logoutBtn" class="btnGhost" type="button">Déconnexion</button>
          </div>
        </div>

      </div>
    </div>
  `;

  // ✅ Bind clicks ici (sinon rien ne se passe)
  el.querySelector("#tvCard")?.addEventListener("click", () => onOpenCategory?.("TV"));
  el.querySelector("#filmsCard")?.addEventListener("click", () => onOpenCategory?.("FILMS"));
  el.querySelector("#seriesCard")?.addEventListener("click", () => onOpenCategory?.("SERIES"));

  el.querySelector("#logoutBtn")?.addEventListener("click", () => onLogout?.());

  setStatus?.("");
}

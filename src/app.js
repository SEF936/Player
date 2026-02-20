import { registerView, show } from "./router.js";
import { state } from "./state.js";

import { renderLogin } from "./views/login.js";
import { renderDash } from "./views/dash.js";
import { renderCategory } from "./views/category.js";
import { renderSeries } from "./views/series.js";
import { renderFilmDetail } from "./views/filmDetail.js";
import { renderSeriesDetail } from "./views/seriesDetail.js";

const $ = (s) => document.querySelector(s);

const topDate = $("#topDate");
const statusLine = $("#statusLine");

function setStatus(msg) {
  if (statusLine) statusLine.textContent = msg || "";
}

function setTopDate() {
  const d = new Date();
  if (topDate) {
    topDate.textContent = d.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  }
}

// ---------------------------
// Pages
// ---------------------------
function openTvPage() {
  state.activeCategory = "TV";

  renderCategory($("#viewCategory"), {
    category: "TV", // ✅ force
    setStatus,
    onBack: () => show("viewDash"),
    onOpenFilm: null,
    onOpenTvItem: (it) => {
      window.open(it.url, "_blank", "noopener");
    },
  });

  show("viewCategory");
}

function openFilmsPage() {
  state.activeCategory = "FILMS";

  renderCategory($("#viewCategory"), {
    category: "FILMS", // ✅ force
    setStatus,
    onBack: () => show("viewDash"),
    onOpenFilm: (it) => {
      state.currentFilm = it;
      openFilmDetailPage();
    },
    onOpenTvItem: null,
  });

  show("viewCategory");
}

function openSeriesPage() {
  state.activeCategory = "SERIES";

  renderSeries($("#viewSeries"), {
    setStatus,
    onBack: () => show("viewDash"),
    onOpenShow: (sh) => {
      state.currentShow = sh;
      openSeriesDetailPage();
    },
  });

  show("viewSeries");
}

function openFilmDetailPage() {
  renderFilmDetail($("#viewFilmDetail"), {
    setStatus,
    film: state.currentFilm,
    onBack: () => show("viewCategory"),
  });
  show("viewFilmDetail");
}

function openSeriesDetailPage() {
  renderSeriesDetail($("#viewSeriesDetail"), {
    setStatus,
    showObj: state.currentShow,
    onBack: () => show("viewSeries"),
  });
  show("viewSeriesDetail");
}

// ---------------------------
// Dashboard render
// ---------------------------
function rerenderDash() {
  renderDash($("#viewDash"), {
    setStatus,
    onOpenCategory: (cat) => {
      if (cat === "TV") return openTvPage();
      if (cat === "FILMS") return openFilmsPage();
      if (cat === "SERIES") return openSeriesPage();
    },
    onLogout: () => {
      // Déconnexion simple (session à adapter si tu stockes username/password)
      try { localStorage.removeItem("iptv_session"); } catch {}
      state.allItems = [];
      state.currentFilm = null;
      state.currentShow = null;
      state.activeCategory = "TV";
      setStatus("Déconnecté.");
      show("viewLogin");
    },
  });
}

// ---------------------------
// Init
// ---------------------------
(async function init() {
  setTopDate();

  // register views (doivent exister dans index.html)
  registerView("viewLogin", $("#viewLogin"));
  registerView("viewDash", $("#viewDash"));
  registerView("viewCategory", $("#viewCategory")); // TV/FILMS
  registerView("viewSeries", $("#viewSeries"));     // SERIES list
  registerView("viewFilmDetail", $("#viewFilmDetail"));
  registerView("viewSeriesDetail", $("#viewSeriesDetail"));

  // login page
  renderLogin($("#viewLogin"), {
    setStatus,
    onLoaded: () => {
      // playlist chargée
      rerenderDash();
      show("viewDash");
    },
  });

  // start
  show("viewLogin", false);
})();

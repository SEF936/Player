const views = {};

export function registerView(name, el) {
  if (!el) {
    console.warn(`View "${name}" non trouvée dans le DOM`);
    return;
  }
  views[name] = el;
}

export function show(name, push = true) {
  if (!views[name]) {
    console.warn(`View "${name}" non enregistrée`);
    return;
  }

  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", k !== name);
  });

  if (push) {
    history.pushState({ view: name }, "", `#${name}`);
  }
}

// 🔹 Gestion bouton back navigateur
window.addEventListener("popstate", (e) => {
  const view = e.state?.view || location.hash.replace("#", "") || "viewLogin";

  if (!views[view]) return;

  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", k !== view);
  });
});

// 🔹 Au chargement de la page
window.addEventListener("DOMContentLoaded", () => {
  const initialView = location.hash.replace("#", "") || "viewLogin";

  if (views[initialView]) {
    Object.entries(views).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== initialView);
    });
  }
});

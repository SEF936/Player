// src/state.js

// -----------------------------
// STATE GLOBAL
// -----------------------------

export const state = {
  allItems: [],
  activeCategory: "TV",

  // session login
  session: null, // { username, password }

  // dernière mise à jour playlist
  lastUpdate: null,

  // navigation courante
  currentFilm: null,
  currentShow: null,
  currentVideoUrl: null,
  lastView: "viewDash", // vue précédente
  posterByIdx: Object.create(null),     // idx -> url
  posterByShowKey: Object.create(null), // showKey -> url
};


// -----------------------------
// PARSE M3U
// -----------------------------

function parseAttrs(extinfLine){
  const attrs = {};
  const re = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
  let m;
  while((m = re.exec(extinfLine)) !== null){
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function categorizeByUrl(url){
  const u = String(url || "").toLowerCase();
  if(u.includes("/movie/")) return "FILMS";
  if(u.includes("/series/")) return "SERIES";
  return "TV";
}

export function parseM3U(text){
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const items = [];
  let pending = null;
  let idx = 0;

  for(const line of lines){

    if(line.startsWith("#EXTINF")){
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

    if(pending && !line.startsWith("#")){
      const url = line;

      items.push({
        __idx: idx++,
        category: categorizeByUrl(url),
        url,
        name: pending.name,
        logo: pending.logo,
        groupTitle: pending.groupTitle
      });

      pending = null;
    }
  }

  return items;
}


// -----------------------------
// SESSION
// -----------------------------

export function saveSession(username, password){
  state.session = { username, password };
  localStorage.setItem("iptv_session", JSON.stringify(state.session));
}

export function loadSession(){
  try{
    const s = JSON.parse(localStorage.getItem("iptv_session") || "null");
    if(s?.username && s?.password){
      state.session = s;
      return true;
    }
  }catch{}
  return false;
}

export function clearSession(){
  state.session = null;
  localStorage.removeItem("iptv_session");
}


// -----------------------------
// FETCH PLAYLIST VIA NETLIFY
// -----------------------------

export async function reloadPlaylist(){

  if(!state.session){
    throw new Error("No session available");
  }

  const res = await fetch("/.netlify/functions/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: state.session.username,
      password: state.session.password
    })
  });

  if(!res.ok){
    throw new Error(`Playlist fetch failed (${res.status})`);
  }

  const text = await res.text();

  state.allItems = parseM3U(text);
  state.lastUpdate = new Date();

  return state.allItems.length;
}

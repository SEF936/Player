// src/services/posterCache.js
// Cache hybride: mémoire + localStorage (avec limite et eviction simple)

const MEM = new Map();
const LS_KEY = "tmdb_poster_cache_v1";
const MAX_ITEMS = 1200; // ajuste selon ton usage

function loadStore(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(store){
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); }
  catch {}
}

function now(){ return Date.now(); }

export const PosterCache = {
  get(key){
    if(MEM.has(key)) return MEM.get(key);

    const store = loadStore();
    const hit = store[key];
    if(hit?.url){
      MEM.set(key, hit.url);
      return hit.url;
    }
    return "";
  },

  set(key, url){
    if(!url) return;

    MEM.set(key, url);

    const store = loadStore();
    store[key] = { url, t: now() };

    // eviction simple: si trop gros, on supprime les plus anciens
    const keys = Object.keys(store);
    if(keys.length > MAX_ITEMS){
      keys.sort((a,b)=>(store[a]?.t||0)-(store[b]?.t||0));
      const toRemove = keys.length - MAX_ITEMS;
      for(let i=0;i<toRemove;i++) delete store[keys[i]];
    }

    saveStore(store);
  },

  makeKey(kind, title, year=""){
    const norm = (s)=>String(s||"")
      .toLowerCase()
      .replace(/[’']/g,"")
      .replace(/[^a-z0-9]+/g," ")
      .trim();
    return `${kind}:${norm(title)}:${year||""}`;
  }
};

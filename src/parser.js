function parseAttrs(extinfLine){
  const attrs = {};
  const re = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
  let m;
  while((m = re.exec(extinfLine)) !== null) attrs[m[1]] = m[2];
  return attrs;
}
function categorizeByUrl(url){
  const u = String(url||"").toLowerCase();
  if(u.includes("/movie/")) return "FILMS";
  if(u.includes("/series/")) return "SERIES";
  return "TV";
}

export function parseM3U(text){
  const lines = String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const items = [];
  let pending = null;
  let idx = 0;

  for(const line of lines){
    if(line.startsWith("#EXTINF")){
      const attrs = parseAttrs(line);
      const name = attrs["tvg-name"] || line.split(",").slice(1).join(",").trim() || "Sans titre";
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

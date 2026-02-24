function normalizeStreamUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  if (/^vlc:\/\//i.test(raw)) return raw;
  return raw;
}

function buildVlcCandidates(streamUrl) {
  const normalized = normalizeStreamUrl(streamUrl);
  if (!normalized) return [];

  if (/^vlc:\/\//i.test(normalized)) return [normalized];

  // Format standard VLC desktop: vlc://http://...
  const direct = `vlc://${normalized}`;

  // Certains navigateurs gèrent mieux la variante encodée.
  const encoded = `vlc://${encodeURIComponent(normalized)}`;

  return direct === encoded ? [direct] : [direct, encoded];
}

function openProtocolUrl(url) {
  const a = document.createElement("a");
  a.href = url;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function openInVlc(streamUrl) {
  const candidates = buildVlcCandidates(streamUrl);
  if (!candidates.length) return false;

  // Tentative principale dans le geste utilisateur.
  openProtocolUrl(candidates[0]);

  // Fallback si le navigateur ignore la première tentative.
  if (candidates[1]) {
    setTimeout(() => openProtocolUrl(candidates[1]), 220);
  }

  return true;
}

export { normalizeStreamUrl, buildVlcCandidates };
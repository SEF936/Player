export async function fetchPlaylistViaNetlify(username, password){
  const res = await fetch("/.netlify/functions/playlist", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ username, password })
  });
  const text = await res.text();
  if(!res.ok) throw new Error(`Fetch playlist failed (${res.status})`);
  return text;
}

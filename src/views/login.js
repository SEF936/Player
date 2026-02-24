import { fetchPlaylistViaNetlify } from "../api.js";
import { parseM3U } from "../parser.js";
import { state } from "../state.js";
import { show } from "../router.js";

export function renderLogin(el, { setStatus, onLoaded }){
  el.innerHTML = `
    <div class="heroWrap">

      <div class="dropzoneLarge loginBox">
        <div class="dzTitle">Se connecter à une playlist</div>

        <div class="loginForm">
          <label class="loginField">
            <span class="loginLabel">Nom de playlist</span>
            <input id="loginPlaylistName" class="loginInput" type="text" placeholder="Ex: Maison">
          </label>
          <label class="loginField">
            <span class="loginLabel">User</span>
            <input id="loginUser" class="loginInput" type="text" placeholder="user" autocomplete="username">
          </label>
          <label class="loginField">
            <span class="loginLabel">Password</span>
            <input id="loginPass" class="loginInput" type="password" placeholder="password" autocomplete="current-password">
          </label>
          <button id="loginBtn" class="btnPrimary wideBtn" type="button">Charger la playlist</button>
        </div>
        <div class="dzMeta">Session conservée jusqu’à déconnexion.</div>
      </div>
    </div>
  `;

  const nameEl = el.querySelector("#loginPlaylistName");
  const userEl = el.querySelector("#loginUser");
  const passEl = el.querySelector("#loginPass");
  const btn = el.querySelector("#loginBtn");

  // preload session
  try{
    const s = JSON.parse(localStorage.getItem("iptv_session")||"null");
    if(s?.playlistName) nameEl.value = s.playlistName;
    if(s?.username) userEl.value = s.username;
  }catch{}

  async function run(){
    const playlistName = nameEl.value.trim();
    const username = userEl.value.trim();
    const password = passEl.value.trim();
    if(!playlistName) return setStatus("⚠️ Nom de playlist requis.");
    if(!username || !password) return setStatus("⚠️ User / password requis.");

    btn.disabled = true;
    try{
      setStatus("⏳ Téléchargement de la playlist…");
      const text = await fetchPlaylistViaNetlify(username, password);

      setStatus("⏳ Analyse de la playlist…");
      state.allItems = parseM3U(text);

      localStorage.setItem("iptv_session", JSON.stringify({
        playlistName, username, password, updatedAt: Date.now()
      }));

      setStatus("⏳ Chargement des catégories…");
      onLoaded?.();

      setStatus(`Playlist chargée ✅ (${state.allItems.length} éléments)`);
      show("viewDash");
      state.lastUpdate = new Date();

    }catch(e){
      console.error(e);
      setStatus(`❌ Échec: ${e.message}`);
    }finally{
      btn.disabled = false;
      passEl.value = "";
    }
  }

  btn.addEventListener("click", run);
  [nameEl,userEl,passEl].forEach(x=>x.addEventListener("keydown",(ev)=> ev.key==="Enter" && run()));
}

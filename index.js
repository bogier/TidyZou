/* === TidyZou ===
   Fichier unique index.js — version intégrale
   - Navigation flèches ← → (Jour, Semaine, Mois)
   - Label du jour courant sous le bouton "Semaine" (vue Jour)
   - Bouton actif reste bleu marine (.tabs button.active)
   - Sidebar + accordéon enfants
   - Vues Jour/Semaine/Mois + Résultats + Historique 
   - Puzzle progressif + upload/suppression image
*/
/* ================= Profil device (figé au démarrage) ================= */

(function initDeviceProfileOnce() {
  // On prend la vraie taille de l'écran, pas le viewport qui bouge avec le clavier
  const sw = (window.screen && window.screen.width)  || window.innerWidth  || 1024;
  const sh = (window.screen && window.screen.height) || window.innerHeight || 768;
  const minSide = Math.min(sw, sh);

  const profile = {
    width: sw,
    height: sh,
    isSmallPhone: minSide <= 380,
    isPhone:     minSide > 380 && minSide <= 480,
    isTablet:    minSide > 480 && minSide <= 900,
    isDesktop:   minSide > 900
  };

  // Accessible partout si besoin de logique JS plus tard
  window.DEVICE_PROFILE = profile;

  const root = document.documentElement;

  if (profile.isSmallPhone) {
    root.classList.add("device-small-phone", "device-phone");
  } else if (profile.isPhone) {
    root.classList.add("device-phone");
  } else if (profile.isTablet) {
    root.classList.add("device-tablet");
  } else {
    root.classList.add("device-desktop");
  }
})();
/* ================= backup auto ================= */
// 🔢 Version actuelle du schéma de données interne
const CURRENT_SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = "TIDYZOU_SCHEMA_VERSION";
const CHILDREN_KEY = "children";

// 🧱 Point d’entrée central pour charger les données
function loadChildrenFromStorage() {
  const raw = localStorage.getItem(CHILDREN_KEY);
  let children;

  try {
    children = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[TidyZou] JSON children corrompu, reset → []", e);
    children = [];
  }

  let storedVersion = parseInt(localStorage.getItem(SCHEMA_VERSION_KEY) || "0", 10);
  if (Number.isNaN(storedVersion)) storedVersion = 0;

  const { migratedChildren, newVersion } = migrateChildrenIfNeeded(children, storedVersion);

  // On persiste la version + les données migrées
  localStorage.setItem(CHILDREN_KEY, JSON.stringify(migratedChildren));
  localStorage.setItem(SCHEMA_VERSION_KEY, String(newVersion));

  return migratedChildren;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// v0 → v1 : pour l’instant, on se contente de normaliser à un tableau
function migrate0to1(oldChildren) {
  if (!Array.isArray(oldChildren)) return [];
  return oldChildren;
}

// 🔁 Table de migrations : version N → N+1
const MIGRATIONS = {
  // 0 → 1 : exemple pour les vieux users (ou première vraie version)
  0: migrate0to1,
  // 1: migrate1to2,
  // 2: migrate2to3,
  // etc.
};

function migrateChildrenIfNeeded(children, fromVersion) {
  let version = fromVersion;
  let data = children;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrationFn = MIGRATIONS[version];
    if (typeof migrationFn !== "function") {
      console.warn(
        `[TidyZou] Aucune migration définie pour passer de v${version} à v${version + 1}. ` +
        "Les données peuvent être incohérentes."
      );
      break;
    }
    console.log(`[TidyZou] Migration schéma v${version} → v${version + 1}`);
    data = migrationFn(data);
    version++;
  }

  return { migratedChildren: data, newVersion: version };
}

/* ================= Données & utilitaires ================= */

let children = loadChildrenFromStorage();
let currentChild = 0;
const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function getChild(){
  if (!children || !children.length) return null;
  if (currentChild < 0 || currentChild >= children.length) return null;
  return children[currentChild];
}

function saveChildren(){
  localStorage.setItem(CHILDREN_KEY, JSON.stringify(children));
  localStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
}


/* ------------------- Init enfants ------------------- */
function bootstrapIfEmpty(){
  // 🚫 Ne rien recréer si une purge totale vient d’être faite
  if (localStorage.getItem("purged") === "1") return;
  if(!children.length){
    children=[{
      settings:{
        childName:"Bertrand",
        rewardLow:"Petit cadeau",
        rewardHigh:"Grande sortie",
        thresholdLow:30,
        thresholdHigh:50
      },
      tasks:[
        { name:"Brosser les dents", weights:[1,1,1,1,1,0,0] },
        { name:"Devoirs",           weights:[1,1,1,1,1,0,0] }
      ],
      notes:{},
      history:[],
      rewardsByWeek:{}   // ✅ placé à l’intérieur de l’objet enfant
    }];
    saveChildren();
  }
}
bootstrapIfEmpty();


/* ------------------- Dates ------------------- */
function formatDateFR(d){ return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}); }
function monthLabel(d){ return d.toLocaleDateString('fr-FR',{month:'long', year:'numeric'}); }
function getMonday(d){ d=new Date(d); const day=d.getDay(); const diff=d.getDate()-day+(day==0?-6:1); return new Date(d.setDate(diff)); }
function getWeekNumber(d){ d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7)); const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-yearStart)/86400000)+1)/7); }
function getSunday(m){ const s=new Date(m); s.setDate(m.getDate()+6); return s; }

let currentDate=new Date();
function getWeekData(){ const m=getMonday(currentDate),s=getSunday(m); return {num:getWeekNumber(m),annee:m.getFullYear(),lundi:formatDateFR(m),dim:formatDateFR(s), m,s}; }
function getWeekKey(){ const w=getWeekData(); return `${w.num}-${w.annee}`; }
function getCurrentWeekKey(){ const today=new Date(); return `${getWeekNumber(today)}-${today.getFullYear()}`; }

function syncCustomWeekIfVisible(){
  const pane = document.getElementById("vue-recompenses");
  const input = document.getElementById("customWeek");
  if (pane && pane.classList.contains("active") && input) {
    input.value = getWeekKey();
  }
}


function changerSemaine(delta){ currentDate.setDate(currentDate.getDate()+delta*7); majUI(); syncCustomWeekIfVisible(); }

/* ================= Sidebar & Gestion enfants ================= */

function setChildAvatar(){
  document.querySelectorAll(".avatar").forEach(img=>{
    img.onerror = () => { img.onerror = null; img.src = "img/default.png"; };
  });
}

function rebuildSidebar(){
  const container=document.getElementById("childrenList");
  if(!container) return;
  container.innerHTML="";
  children.forEach((ch,idx)=>{
    const active=(idx===currentChild)?" active":"";
    const name = (ch.settings.childName||'Enfant').trim();
    container.insertAdjacentHTML("beforeend",`
      <li class="child-accordion${active}" data-idx="${idx}">
        <h3>
          <span><img src="${ch.settings.avatar || "img/default.png"}" class="avatar" alt=""> ${name}</span>
          <span class="arrow">▼</span>
        </h3>
		
        <ul class="options">
		<li onclick="openNameAvatar(${idx})" class="menu-nom-avatar">
		<img src="appli/NomEtAvatars.png" alt="Nom et avatar" class="icon-nom-avatar">
		  <span>Nom et avatar</span>
		</li>
		<li onclick="openTaskManager(${idx})" class="menu-taches">
		  <img src="appli/taches.png" alt="Tâches" class="icon-taches">
		  <span>Tâches</span>
		</li>
		<li onclick="openRewardsManager(${idx})" class="menu-recompenses">
		  <img src="appli/recompenses.png" alt="Récompenses" class="icon-recompenses">
		  <span>Récompenses</span>
		</li>
		<li onclick="exportChild(${idx})" class="menu-exporter">
		  <img src="appli/exporter.png" alt="Exporter un enfant" class="icon-exporter">
		  <span>Exporter cet enfant</span>
		</li>
		<li onclick="deleteChild(${idx})" class="menu-supprimer">
		  <img src="appli/SupprimerEnfant.png" alt="Supprimer un enfant" class="icon-supprimer">
		  <span>Supprimer cet enfant</span>
		</li>
		<li onclick="selectChild(${idx}); showView('vue-jour')" class="menu-suivi-taches">
		  <img src="appli/taches.png" alt="Suivi des tâches" class="icon-suivi-taches">
		  <span>Suivi des tâches</span>
		</li>
		<li onclick="selectChild(${idx}); showView('vue-resultats')" class="menu-resultats">
		  <img src="appli/Resultats.png" alt="Résultats" class="icon-resultats">
		  <span>Résultats</span>
		</li>

		  
        </ul>
      </li>`);
  });
  setChildAvatar();
}


/* ---- CRUD enfants ---- */
function selectChild(i){ currentChild=i; saveChildren(); majUI(); }

function addChild(){
  // Création rapide d’un enfant vide
  const newChild = {
    settings:{
      childName:"",
      avatar:null,
      age:null,
      gender:"non-defini",
      rewardLow:"",
      rewardHigh:"",
      thresholdLow:30,
      thresholdHigh:50
    },
    tasks:[],
    notes:{},
    history:[],
    rewardsByWeek:{}   // ✅ structure pour récompenses personnalisées
  };

  // Ajout et sélection
  children.push(newChild);
  saveChildren();
  currentChild = children.length - 1;

  // ✅ Redirection immédiate vers la vue Nom & Avatar
  openNameAvatar(currentChild);

  // Ferme la sidebar pour une transition fluide
  closeMenu();
}

function deleteChild(i){
  if(!confirm("Supprimer cet enfant ?")) return;
  children.splice(i,1);
  currentChild = Math.min(currentChild, children.length-1);
  saveChildren(); majUI();
  showView('vue-accueil'); // ✅ retourne proprement à l’accueil
}
function renameChild(i){
  const cur = children[i].settings.childName || "";
  const n = prompt("Nouveau nom :", cur);
  if(!n) return;
  children[i].settings.childName = n.trim();
  saveChildren(); majUI();
}
function exportChild(i){
  const b=new Blob([JSON.stringify(children[i],null,2)],{type:"application/json"});
  const u=URL.createObjectURL(b); const a=document.createElement("a");
  a.href=u; a.download=`${children[i].settings.childName||'enfant'}.json`; a.click();
  URL.revokeObjectURL(u);
}
function exportAllData() {
  if (!children || !children.length) {
    alert("Aucune donnée à exporter (aucun enfant trouvé).");
    return;
  }

  // On prépare le payload normalisé
  const payload = {
    schema: "TidyZou-export",
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      children: children,         // on prend l’état en mémoire
      currentChild: currentChild  // index courant
    }
  };

  const json = JSON.stringify(payload, null, 2);

  // Nom de fichier : TidyZou-export-YYYYMMDD-HHMM.json
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fileName =
    "TidyZou-export-" +
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    "-" +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    ".json";

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert("✅ Fichier exporté.\nVous pouvez maintenant le communiquer (email, message, clé USB…) vers un autre appareil.");
}

function parseExportPayload(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    alert("❌ Fichier invalide : JSON non lisible.");
    return null;
  }

  // Cas “officiel” v1
  if (obj && obj.schema === "TidyZou-export") {
    const data = obj.data || {};
    if (!Array.isArray(data.children)) {
      alert("❌ Fichier TidyZou invalide : 'data.children' manquant ou incorrect.");
      return null;
    }
    return {
      children: data.children,
      currentChild: typeof data.currentChild === "number" ? data.currentChild : 0,
	  // version exportée dans le fichier, sinon 0 par défaut
	  version: typeof obj.version === "number" ? obj.version : 0
    };
  }

  // Backward compat : on accepte aussi un export brut {children:[...]}
  if (Array.isArray(obj.children)) {
    return {
      children: obj.children,
      currentChild: 0,
      version: 0   // ancien format → on considère que ça part de la V0
    };
  }

  alert("❌ Ce fichier ne semble pas être un export TidyZou valide.");
  return null;
}

function handleImportAllMerge(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = parseExportPayload(e.target.result);
    if (!parsed) return;

    let importedChildren = parsed.children || [];
    if (!importedChildren.length) {
      alert("Aucun enfant dans le fichier à fusionner.");
      return;
    }

    // On récupère la version du fichier
    const fromVersion = typeof parsed.version === "number" ? parsed.version : 0;

    // On MIGRE les enfants importés avant toute fusion
    const { migratedChildren } = migrateChildrenIfNeeded(importedChildren, fromVersion);
    importedChildren = migratedChildren;

    if (!confirm(
      "Les données du fichier vont être fusionnées avec vos enfants existants.\n" +
      "- Même prénom (et âge/genre compatibles) → données fusionnées.\n" +
      "- Autres enfants → ajoutés à la suite.\n\n" +
      "Aucune donnée actuelle ne sera supprimée.\nContinuer ?"
    )) {
      return;
    }

    if (!children) children = [];

    let mergedCount = 0;
    let addedCount = 0;

    importedChildren.forEach((impChild) => {
      const idx = findMatchingChildIndex(impChild);
      if (idx === -1) {
        // Nouvel enfant → on l'ajoute tel quel (déjà migré)
        children.push(impChild);
        addedCount++;
      } else {
        // Fusion (mergeChildData travaille maintenant sur des objets alignés sur le schéma courant)
        children[idx] = mergeChildData(children[idx], impChild);
        mergedCount++;
      }
    });

    saveChildren();
    majUI();

    alert(
      "✅ Fusion terminée.\n" +
      `- ${mergedCount} enfant(s) fusionné(s)\n` +
      `- ${addedCount} enfant(s) ajouté(s)`
    );
  };

  reader.readAsText(file);
}


function handleImportAllReplace(event) {
  const file = event.target.files[0];
  event.target.value = ""; // permet de re-sélectionner le même fichier plus tard
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = parseExportPayload(e.target.result);
    if (!parsed) return;

    if (!confirm("⚠️ Ceci va remplacer TOUTES les données actuelles (tous les enfants, tâches, historique).\nContinuer ?")) {
      return;
    }

    children = parsed.children || [];
// On passe les données importées dans le pipeline de migration
const fromVersion = typeof parsed.version === "number" ? parsed.version : 0;
const { migratedChildren, newVersion } = migrateChildrenIfNeeded(children, fromVersion);
children = migratedChildren;
currentChild = parsed.currentChild || 0;

// On met à jour la version et on sauvegarde une fois
localStorage.setItem(SCHEMA_VERSION_KEY, String(newVersion));
saveChildren();

// Sécu : currentChild dans le range
currentChild = Math.min(currentChild, Math.max(children.length - 1, 0));

majUI();
showView("vue-accueil");
alert("✅ Import terminé.\nToutes les données ont été remplacées par celles du fichier.");
  };
  reader.readAsText(file);
}


function handleImportChild(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const obj=JSON.parse(r.result);
      if(!obj?.settings?.childName){ alert("Fichier invalide"); return; }
      children.push(obj); saveChildren(); currentChild=children.length-1; majUI();
    }catch(_e){ alert("JSON invalide"); }
  };
  r.readAsText(f);
  e.target.value = "";
}
function importExample(){
  const demo={
    settings:{ childName:"Exemple", rewardLow:"Choisir un dessin animé", rewardHigh:"Sortie parc", thresholdLow:40, thresholdHigh:70 },
    tasks:[ {name:"Ranger la chambre",weights:[1,1,1,1,1,0,0]}, {name:"Lire 10 min",weights:[1,1,1,1,1,0,0]} ],
    notes:{}, history:[]
  };
  addChildSafely(demo); saveChildren(); currentChild=children.length-1; majUI();
}

function resetAllChildren(){
  if(!confirm("♻️ Réinitialiser TOUTES les données de CHAQUE enfant (nom, avatar, âge, genre, récompenses, seuils, tâches, notes, historique) ?")) return;

  children = children.map(c => ({
    settings: {
      childName: "",             // prénom vidé
      avatar: null,              // retour à l’avatar par défaut
      avatarName: undefined,
      age: null,
      gender: "non-defini",
      rewardLow: "",             // récompenses vidées
      rewardHigh: "",
      thresholdLow: 30,          // seuils par défaut
      thresholdHigh: 50
    },
    tasks: [],                   // aucune tâche
    notes: {},                   // aucune note
    history: []                  // historique vierge
  }));

  saveChildren();
  majUI();
  alert("✅ Tous les enfants ont été entièrement réinitialisés.");
}

function purgeAll(){
  if(!confirm("Tout supprimer ?")) return;

  // Supprimer tout le stockage
  localStorage.clear();
  sessionStorage.clear();

  // Marquer la purge pour bloquer le bootstrap initial
  localStorage.setItem("purged", "1");

  // Réinitialiser les variables en mémoire
  children = [];
  currentChild = 0;

  majUI();
  alert("🗑️ Tous les enfants ont été supprimés !");
   showView('vue-accueil'); // ✅ retourne proprement à l’accueil
}

/* ================= En-têtes, titres & labels ================= */

function setWeekTitle(){
  const {m,s}=getWeekData();
  const fmt=d=>d.toLocaleDateString('fr-FR',{day:'2-digit',month:'long'});
  const weekTitle=document.getElementById("weekTitle");
  if(weekTitle) weekTitle.textContent=`${fmt(m)} – ${fmt(s)}`;
  const monthTitle=document.getElementById("monthTitle");
  if(monthTitle) monthTitle.textContent=monthLabel(new Date(currentDate.getFullYear(), currentDate.getMonth(),1));
}

function setChildHeaders(){
  const child = getChild();
  if (!child) return; // ✅ aucun enfant → on ne fait rien

  const n = child.settings.childName || "Mon enfant";
  const day    = document.getElementById("currentChild_day");
  const month  = document.getElementById("currentChild_month");
  const task   = document.getElementById("currentChild_tasks");
  const rewardResults = document.getElementById("currentChild_rewards_results");
  const reward = document.getElementById("currentChild_rewards");
  
  if(day) day.textContent = n;
  if(month) month.textContent = n;
  if(task) task.textContent = n;
  if(reward) reward.textContent = n;
  if(rewardResults) rewardResults.textContent = n;
  const title = document.getElementById("childTitle");
  if(title) title.textContent = "Résultats - " + n;
}



// Renvoie le nom du jour courant (en fonction de currentDate), ex : "Lundi"
function getCurrentDayLongLabel(){
  const d = new Date(currentDate);
  const options = { weekday: 'long' };
  const jour = d.toLocaleDateString('fr-FR', options);
  return jour.charAt(0).toUpperCase() + jour.slice(1);
}

function setCurrentDayLabel(){
  const lbl = document.getElementById("currentDayLabel");
  if(lbl) lbl.textContent = getCurrentDayLongLabel();
}


/* ================= Vues Jour / Semaine / Mois ================= */

function ensureNotesForWeek(child, key){
  if (!child.notes) child.notes = {};
  const taskCount = (child.tasks?.length || 0);

  if (!Array.isArray(child.notes[key])) {
    child.notes[key] = [];
  }
  const arr = child.notes[key];

  // Assure la forme [7] par ligne existante
  for (let i = 0; i < arr.length; i++) {
    if (!Array.isArray(arr[i]) || arr[i].length !== 7) {
      arr[i] = [0,0,0,0,0,0,0];
    }
  }

  // Étend si nouvelles tâches
  while (arr.length < taskCount) {
    arr.push([0,0,0,0,0,0,0]);
  }
  // Réduit si tâches en moins (on coupe la fin, cf. removeTask ci-dessous pour le cas index ciblé)
  while (arr.length > taskCount) {
    arr.pop();
  }
}


function majVueJour(){
  const tbody=document.querySelector("#vue-jour table tbody"); 
  if(!tbody) return;
  tbody.innerHTML="";
  const child=getChild(); 
  const key=getWeekKey(); 
  ensureNotesForWeek(child,key);

  const d=new Date(currentDate); 
  const dayIdx=(d.getDay()===0)?6:(d.getDay()-1);

  if(!child.tasks.length){
    tbody.innerHTML=`<tr><td colspan="2">⚠️ Aucune tâche définie</td></tr>`; 
    return;
  }

  child.tasks.forEach((t,i)=>{
    const val = child.notes[key]?.[i]?.[dayIdx] ?? 0;
    const disable=(key!==getCurrentWeekKey())?"disabled":"";

    const name = `t${i}d${dayIdx}`;
    tbody.insertAdjacentHTML("beforeend",`
      <tr>
        <td>${escapeHtml(t.name)}</td>
        <td class="rating-cell">
          <input type="radio" id="${name}v0" name="${name}" data-task="${i}" data-day="${dayIdx}" value="0" ${val==0?'checked':''} ${disable}>
          <label for="${name}v0">🔴</label>
          <input type="radio" id="${name}v05" name="${name}" data-task="${i}" data-day="${dayIdx}" value="0.5" ${val==0.5?'checked':''} ${disable}>
          <label for="${name}v05">️🟡</label>
          <input type="radio" id="${name}v1" name="${name}" data-task="${i}" data-day="${dayIdx}" value="1" ${val==1?'checked':''} ${disable}>
          <label for="${name}v1">🟢</label>
        </td>
      </tr>`);
  });

  // Écouteurs
  tbody.querySelectorAll("input[type=radio]").forEach(r=>{
    r.addEventListener("change",()=>{
      sauverNotes(); 
      calculer();
      appliquerStyleRadio(r);   // applique style au clic
    });
    appliquerStyleRadio(r);     // applique style dès le rendu
  });
}

function majLabelGroup(groupName){
  document.querySelectorAll(`input[name='${groupName}'] + label`).forEach(lbl=>{
    lbl.style.opacity = "0.15"; // par défaut tous pâles
  });
  const checked = document.querySelector(`input[name='${groupName}']:checked`);
  if(checked) checked.nextElementSibling.style.opacity = "1"; // celui choisi est bien visible
}

function majVueMois(){
  const cal=document.querySelector("#vue-mois .calendar-month"); 
  if(!cal) return;
  cal.innerHTML="";
  const child=getChild(); 
  const key=getWeekKey(); 
  ensureNotesForWeek(child,key);

  const year=currentDate.getFullYear(), 
        month=currentDate.getMonth(), 
        lastDay=new Date(year,month+1,0).getDate();
  
  const today=new Date();
  today.setHours(0,0,0,0);

  for(let d=1; d<=lastDay; d++){
    const cell=document.createElement("div");
    cell.className="calendar-cell";

    const thisDate=new Date(year, month, d);
    thisDate.setHours(0,0,0,0);

    // Ajouter numéro du jour
    cell.innerHTML=`<span class="date">${d}</span>`;

    // Récupérer la semaine/notes correspondant à ce jour
    const weekKey = `${getWeekNumber(thisDate)}-${thisDate.getFullYear()}`;
    ensureNotesForWeek(child, weekKey);

    const dayIdx=(thisDate.getDay()===0)?6:(thisDate.getDay()-1);

    let total=0, done=0;
    (child.tasks||[]).forEach((t,i)=>{
      const val = child.notes[weekKey]?.[i]?.[dayIdx] ?? 0;
      total += 1;
      done  += parseFloat(val)||0;
    });

    // Calcul du % réalisé
    const pct = total ? (done/total*100) : 0;

    // Coloration selon résultat
    if(pct === 100){
      cell.style.background = "#e8f5e9"; // vert clair
      cell.style.border = "2px solid #aaa";
    } else if(pct > 0){
      cell.style.background = "#fff4e5"; // orange clair
      cell.style.border = "2px solid #aaa";
    } else {
      cell.style.background = "#fdecea"; // rouge clair
      cell.style.border = "2px solid #aaa";
    }

    // Statut jour courant / passé
    if(thisDate.getTime() === today.getTime()){
      cell.classList.add("today");
    } else if(thisDate < today){
      cell.classList.add("past");
    }

    // Ajouter le % au centre
    if(total>0){
      const span=document.createElement("div");
      span.className="percent";
      span.textContent=`${pct.toFixed(0)}%`;
      cell.appendChild(span);
    }

    cal.appendChild(cell);
  }
}


function sauverNotes(){
  const key=getWeekKey(), child=getChild(); 
  ensureNotesForWeek(child,key);

  // Sauvegarde toutes les radios cochées
  document.querySelectorAll("#vue-jour input[type=radio]:checked").forEach(r=>{
    const i=r.dataset.task, d=r.dataset.day;
    if(i!==undefined && d!==undefined){
      child.notes[key][i][d]=parseFloat(r.value);
    }
  });

  saveChildren();
  majVueMois();
  // 🔹 Réafficher la vue jour immédiatement
  majVueJour();
  majAvancementJournee();
  renderRadials();
  calculer();
}

/* ================= Calcul, Résultats & Historique ================= */

/**
 * Renvoie les seuils (globaux) et les récompenses (overridables par semaine)
 * pour la SEMAINE courante.
 */
function getWeeklyPaliersConfig(child, weekKey){
  const t1 = Number(child?.settings?.thresholdLow  ?? 30);
  const t2 = Number(child?.settings?.thresholdHigh ?? 50);

  // Par défaut : récompenses globales
  let r1 = child?.settings?.rewardLow  || "";
  let r2 = child?.settings?.rewardHigh || "";

  // Normalisation libellé palier
  const tag = (s) => String(s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g,""); // "Palier 1" -> "palier1"

  // Overrides semaine (prioritaires)
  const arr = child?.rewardsByWeek?.[weekKey];
  if (Array.isArray(arr) && arr.length){
    for (const r of arr){
      const p = tag(r.palier);
      if ((p === "1" || p === "p1" || p === "palier1") && r?.reward) r1 = r.reward;
      if ((p === "2" || p === "p2" || p === "palier2") && r?.reward) r2 = r.reward;
    }
  }
  return { t1, r1, t2, r2 };
}





/**
 * Met à jour l’affichage des 2 bandeaux “semaine”.
 * - Affiche Palier 1 si pctWeek ≥ t1 ET r1 non vide
 * - Affiche Palier 2 si pctWeek ≥ t2 ET r2 non vide
 */
function updateWeeklyRewardBanners(pctWeek, cfg){
  const b1 = document.getElementById('rewardBannerW1');
  const b2 = document.getElementById('rewardBannerW2');

  if (b1){ b1.className = 'reward-banner hidden'; b1.innerHTML = ''; }
  if (b2){ b2.className = 'reward-banner hidden'; b2.innerHTML = ''; }

  const show1 = (pctWeek >= cfg.t1) && !!cfg.r1?.trim();
  const show2 = (pctWeek >= cfg.t2) && !!cfg.r2?.trim();

  if (show1 && b1){
    b1.innerHTML = `<span class="badge">Palier 1</span> ${escapeHtml(cfg.r1)} <span style="opacity:.6;font-weight:600">(${pctWeek.toFixed(1)}%)</span>`;
    b1.classList.remove('hidden'); b1.classList.add('palier-1','pop');
    setTimeout(()=> b1.classList.remove('pop'), 300);
  }
  if (show2 && b2){
    b2.innerHTML = `<span class="badge">Palier 2</span> ${escapeHtml(cfg.r2)} <span style="opacity:.6;font-weight:600">(${pctWeek.toFixed(1)}%)</span>`;
    b2.classList.remove('hidden'); b2.classList.add('palier-2','pop');
    setTimeout(()=> b2.classList.remove('pop'), 300);
  }
}


function calculer(){
  const child = getChild(); 
  const key = getWeekKey(); 
  ensureNotesForWeek(child,key);
  const notes = child.notes[key] || []; 
  let total = 0, done = 0;

  (child.tasks || []).forEach((t,i)=>{
    (notes[i] || []).forEach((val=0)=>{ 
      total += 1;         
      done += parseFloat(val) || 0; 
    });
  });

  const pct = total ? (done/total*100) : 0;

  const res = document.getElementById("resultat"); 
  if(res) res.textContent = `✅ ${done.toFixed(1)}/${total} pts (${pct.toFixed(1)}%)`;
  const pb = document.getElementById("progressBar"); 
  if(pb) pb.style.width = Math.min(100,Math.max(0,pct)) + "%";
  
  // ✅ Répéter l’affichage pour la vue Jour si présente
const resJour = document.getElementById("resultatJour");
if (resJour) resJour.textContent = `✅ ${done.toFixed(1)}/${total} pts (${pct.toFixed(1)}%)`;
const pbJour = document.getElementById("progressBarJour");
if (pbJour) pbJour.style.width = Math.min(100, Math.max(0, pct)) + "%";


// ✅ Support multi-paliers par semaine
const week = getWeekKey();
let reward = "❌ Aucune récompense", palier = "-";
const customRewards = child.rewardsByWeek?.[week];

if (Array.isArray(customRewards) && customRewards.length > 0) {
  // concatène tous les paliers en texte
  reward = customRewards.map(r => r.reward).join(" + ");
  palier = customRewards.map(r => r.palier).join(", ");
} else {
  if (pct >= (child.settings.thresholdHigh || 50) && child.settings.rewardHigh) {
    reward = `${child.settings.rewardHigh}`;
    palier = "Palier 2";
  } else if (pct >= (child.settings.thresholdLow || 30) && child.settings.rewardLow) {
    reward = `${child.settings.rewardLow}`;
    palier = "Palier 1";
  }
}


  // ⚙️ suite inchangée
  child.history = child.history || [];
  const existing = child.history.find(h => h.week === week);
  if(existing){
    existing.pct = pct.toFixed(1); 
    existing.reward = reward; 
    existing.palier = palier;
  } else {
    child.history.push({ week, pct:pct.toFixed(1), reward, palier });
  }
  saveChildren();
  
// ➕ MAJ bandeaux RECOMPENSE (SEMAINE) — basé sur % de la SEMAINE
const weekKey = getWeekKey();
const cfg = getWeeklyPaliersConfig(child, weekKey);
updateWeeklyRewardBanners(pct, cfg);

  afficherHistorique();
  setChildHeaders();
}


function majAvancementJournee() {
  const pct = computeDailyProgressFromData();
  const bar = document.getElementById('progressBarJournee');
  const label = document.getElementById('resultatJournee');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = pct + '%';
}

// Calcule l'avancement du jour en lisant les données (0/1/2) pour le dayIdx courant.
// Hypothèse: notes[weekKey][taskIdx][dayIdx][childIdx] ∈ {0,1,2}
function computeDailyProgressFromData() {
  try {
    const child = getChild();
    const weekKey = getWeekKey();
    ensureNotesForWeek(child, weekKey);

    const d = new Date(currentDate);
    const dayIdx = (d.getDay() === 0) ? 6 : (d.getDay() - 1);

    let total = 0, sum = 0;
    (child.tasks || []).forEach((t, i) => {
      const val = child.notes[weekKey]?.[i]?.[dayIdx];
      if (val !== undefined && val !== null) {
        total += 1;
        sum += parseFloat(val) || 0;
      }
    });

    if (total === 0) return 0;
    return Math.round((sum / total) * 100);
  } catch {
    return 0;
  }
}


function initDailyProgressListeners() {
  const container = document.getElementById('vue-jour');
  if (!container) return;
  container.addEventListener('change', (e) => {
    if (e.target && e.target.matches('input[type="radio"]')) {
      // Laisse d'abord ton handler existant sauvegarder la valeur, puis recalcule
      setTimeout(majAvancementJournee, 0);
    }
  });
}

/* ====== Radials (SVG segmentés) ====== */
function polarToCartesian(cx, cy, r, angleDeg){
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle){
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/* Retourne le % semaine (sans effets de bord) */
function computeWeekProgress(){
  const child = getChild();
  const key = getWeekKey();
  ensureNotesForWeek(child, key);
  let total = 0, done = 0;
  (child.tasks || []).forEach((t,i)=>{
    (child.notes[key]?.[i] || []).forEach(v => { total += 1; done += parseFloat(v)||0; });
  });
  return total ? Math.round(done/total*100) : 0;
}

/* Retourne le % mois courant */
function computeMonthProgress(){
  const child = getChild();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const last = new Date(year, month+1, 0).getDate();
  let total = 0, done = 0;

  for(let d=1; d<=last; d++){
    const date = new Date(year, month, d);
    const dayIdx = (date.getDay() === 0) ? 6 : (date.getDay() - 1);
    const weekKey = `${getWeekNumber(date)}-${date.getFullYear()}`;
    ensureNotesForWeek(child, weekKey);
    (child.tasks || []).forEach((t,i)=>{
      const v = child.notes[weekKey]?.[i]?.[dayIdx];
      if(v !== undefined){
        total += 1;
        done += parseFloat(v)||0;
      }
    });
  }
  return total ? Math.round(done/total*100) : 0;
}

function ensureNotesForWeekChild(child, weekKey){
  if(!child.notes) child.notes = {};
  if(!Array.isArray(child.notes[weekKey]) || child.notes[weekKey].length !== (child.tasks?.length || 0)){
    child.notes[weekKey] = (child.tasks || []).map(()=>[0,0,0,0,0,0,0]);
  }
}

function computeDailyForChildIdx(idx){
  const child = children[idx]; if(!child) return 0;
  const weekKey = getWeekKey();
  ensureNotesForWeekChild(child, weekKey);
  const d = new Date(currentDate);
  const dayIdx = (d.getDay()===0)?6:(d.getDay()-1);
  let total=0, sum=0;
  (child.tasks || []).forEach((t,i)=>{
    const v = child.notes[weekKey]?.[i]?.[dayIdx];
    if(v !== undefined){ total+=1; sum += parseFloat(v)||0; }
  });
  return total? Math.round(sum/total*100) : 0;
}

function computeWeekForChildIdx(idx){
  const child = children[idx]; if(!child) return 0;
  const key = getWeekKey();
  ensureNotesForWeekChild(child, key);
  let total=0, sum=0;
  (child.tasks || []).forEach((t,i)=>{
    (child.notes[key]?.[i] || []).forEach(v=>{ total+=1; sum += parseFloat(v)||0; });
  });
  return total? Math.round(sum/total*100) : 0;
}

function computeMonthForChildIdx(idx){
  const child = children[idx]; if(!child) return 0;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const last = new Date(year, month+1, 0).getDate();
  let total=0, sum=0;

  for(let d=1; d<=last; d++){
    const date = new Date(year, month, d);
    const dayIdx = (date.getDay()===0)?6:(date.getDay()-1);
    const weekKey = `${getWeekNumber(date)}-${date.getFullYear()}`;
    ensureNotesForWeekChild(child, weekKey);
    (child.tasks || []).forEach((t,i)=>{
      const v = child.notes[weekKey]?.[i]?.[dayIdx];
      if(v !== undefined){ total+=1; sum += parseFloat(v)||0; }
    });
  }
  return total? Math.round(sum/total*100) : 0;
}


/* Dessine une jauge segmentée type "donut" avec 12 segments */
function drawRadial(containerId, percent, strokeColor, label){
  const host = document.getElementById(containerId);
  if(!host) return;
  host.innerHTML = "";
  
   // 🔹 Normalisation du % entre 0 et 1
  const ratio = Math.max(0, Math.min(1, percent / 100));

  // 🔹 Mapping vers tes “ratios”
  // background-size: de 50% (petit) à 70% (plus grand)
  const bgSize = 60 + ratio * 20; // 50% -> 70%

  // opacity: de 0.08 (discret) à 0.25 (bien visible)
  const bgOpacity = 0.5 + ratio * (0.25 - 0.08);

  // 🔹 On pousse ça dans les variables CSS du conteneur
  host.style.setProperty("--bg-size", bgSize + "%");
  host.style.setProperty("--bg-opacity", bgOpacity.toFixed(2));

  const size = 140;
  const cx = size/2, cy = size/2;
  const outerR = 64;     // anneau externe gris
  const r = 56;          // rayon des segments
  const segments = 12;   // nbre de “parts”
  const gapDeg = 6;      // écart visuel entre parts
  const partDeg = 360/segments;
  const fillParts = Math.floor((percent/100) * segments);

  // SVG
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

  // anneau gris externe
  const outer = document.createElementNS(svg.namespaceURI, "circle");
  outer.setAttribute("class", "outer-ring");
  outer.setAttribute("cx", cx);
  outer.setAttribute("cy", cy);
  outer.setAttribute("r", outerR);
  svg.appendChild(outer);

  // segments de fond (gris)
  for(let i=0;i<segments;i++){
    const start = i*partDeg + gapDeg/2;
    const end   = (i+1)*partDeg - gapDeg/2;
    const p = document.createElementNS(svg.namespaceURI, "path");
    p.setAttribute("d", describeArc(cx, cy, r, start, end));
    p.setAttribute("class", "seg-bg");
    svg.appendChild(p);
  }

  // segments colorés (jusqu’au floor du %)
  for(let i=0;i<fillParts;i++){
    const start = i*partDeg + gapDeg/2;
    const end   = (i+1)*partDeg - gapDeg/2;
    const p = document.createElementNS(svg.namespaceURI, "path");
    p.setAttribute("d", describeArc(cx, cy, r, start, end));
    p.setAttribute("class", "seg-fill");
    p.setAttribute("stroke", strokeColor);
    svg.appendChild(p);
  }

  host.appendChild(svg);

  // pastille centrale (valeur + libellé)
  const center = document.createElement("div");
  center.className = "center";
  center.innerHTML = `
    <div class="badge">
      <div class="pct">${percent}%</div>
      <div class="lbl">${label}</div>
    </div>`;
  host.appendChild(center);
}

/* Met à jour les 3 jauges */
function renderRadials(){
  const pctDay  = computeDailyProgressFromData();
  const pctWeek = computeWeekProgress();
  const pctMonth= computeMonthProgress();

  const css = getComputedStyle(document.documentElement);

  drawRadial("radial-jour",    pctDay,  css.getPropertyValue("--color-jour").trim()    || "#1e63d1", "jour");
  drawRadial("radial-semaine", pctWeek, css.getPropertyValue("--color-semaine").trim() || "#2ecc71", "semaine");
  drawRadial("radial-mois",    pctMonth,css.getPropertyValue("--color-mois").trim()    || "#8e44ad", "mois");
}

function renderHome(){
  const hero = document.getElementById('homeHero');
  const title = document.getElementById('homeTitle');
  const subtitle = document.getElementById('homeSubtitle');
  const illustration = document.getElementById('homeIllustration');
  const list = document.getElementById('homeChildren');

  if(!hero || !title || !list) return;
    // ✅ toujours repartir d’un conteneur vide
  list.innerHTML = "";

  const hasChildren = (children && children.length > 0);
  
  if(!hasChildren){
    // Mode "Bienvenue"
    title.textContent = "Bienvenue dans TidyZou";
    if(subtitle) subtitle.style.display = "";
    if(illustration) illustration.style.display = "";
    list.style.display = "none";
    hero.style.display = "";
    return;
  }
  
  // Mode "Récapitulatif"
  const weekNum = getWeekData().num;
  title.textContent = "Bilan semaine " + weekNum;

  if(subtitle) subtitle.style.display = "none";
  if(illustration) illustration.style.display = "none";
  hero.style.display = "";         // on garde le titre
  list.style.display = "";         // on montre la grille

  // Libellé du jour traité (ex : "Lundi")
  const dayLabel = getCurrentDayLongLabel();

  list.innerHTML = ""; // reset
  children.forEach((ch, idx)=>{

    const name = (ch?.settings?.childName || "Mon enfant").trim();
	const safeName = escapeHtml(name);               // ✅ on ajoute ça
    const avatar = ch?.settings?.avatar || "img/default.png";

    const pctDay   = computeDailyForChildIdx(idx);
    const pctWeek  = computeWeekForChildIdx(idx);
    const pctMonth = computeMonthForChildIdx(idx);

    const card = document.createElement('article');
    card.className = "child-card";
    card.innerHTML = `
      <img class="card-avatar" src="${avatar}" alt="${safeName}">
      <div>
        <div class="card-title">${safeName}</div>

        <div class="hc-bars">
          <div class="hc-row">
            <div class="hc-label">${dayLabel}</div>
            <div class="hc-bar"><div class="hc-fill day"   style="width:${pctDay}%"></div></div>
            <div class="hc-pct">${pctDay}%</div>
          </div>

          <div class="hc-row">
            <div class="hc-label">Semaine</div>
            <div class="hc-bar"><div class="hc-fill week"  style="width:${pctWeek}%"></div></div>
            <div class="hc-pct">${pctWeek}%</div>
          </div>
          <div class="hc-row">
            <div class="hc-label">Mois</div>
            <div class="hc-bar"><div class="hc-fill month" style="width:${pctMonth}%"></div></div>
            <div class="hc-pct">${pctMonth}%</div>
          </div>
        </div>
      </div>
    `;
	// Rendre la carte cliquable → ouvrir la vue Jour de l’enfant
card.setAttribute('role', 'button');
card.setAttribute('tabindex', '0');
card.setAttribute('title', `Ouvrir le suivi de ${name}`);

card.addEventListener('click', () => {
  selectChild(idx);
  showView('vue-jour');
});

card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectChild(idx);
    showView('vue-jour');
  }
});

    list.appendChild(card);
  });
}

function afficherHistorique() {
  const body = document.getElementById("historiqueBody");
  if (!body) return;

  body.innerHTML = "";

  const child = getChild();
  if (!child) return;

  const hist = child.history || [];

  let totalPct = 0;
  let countNonZero = 0;

  hist.forEach(h => {
    const pct = parseFloat(h.pct) || 0;

    // 👉 on ignore les semaines à 0%
    if (pct === 0) return;

    totalPct += pct;
    countNonZero++;

    body.insertAdjacentHTML(
      "beforeend",
      `<tr>
         <td>${h.week}</td>
         <td>${pct}%</td>
         <td>${h.reward || ""}</td>
       </tr>`
    );
  });

  // 👉 Moyenne (seulement sur les semaines affichées)
  if (countNonZero > 0) {
    const avg = (totalPct / countNonZero).toFixed(1);
    body.insertAdjacentHTML(
      "beforeend",
      `<tr class="row-average">
         <td>Moyenne</td>
         <td>${avg}%</td>
         <td></td>
       </tr>`
    );
  }
}



/* ================= Sidebar open/close + Accordéon ================= */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.querySelector(".menu-btn");

function openMenu(){ sidebar?.classList.add("show"); overlay?.classList.add("show"); }
function closeMenu(){ sidebar?.classList.remove("show"); overlay?.classList.remove("show"); }

menuBtn?.addEventListener("click", ()=>{ sidebar?.classList.contains("show") ? closeMenu() : openMenu(); });
overlay?.addEventListener("click", closeMenu);
document.querySelector(".nav-list li:first-child")?.addEventListener("click", closeMenu);


/* Accordéon enfants */
document.addEventListener("click",(e)=>{
  const h3 = e.target.closest(".child-accordion > h3");
  if(!h3) return;
  h3.parentElement.classList.toggle("open");
});

/* ================= Gestion des vues ================= */

function showView(id){
  // Masquer toutes les vues
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  // Afficher la vue demandée
  document.getElementById(id)?.classList.add("active");

  // Mettre à jour l’état actif des onglets
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  if(id === "vue-jour") {
    document.querySelectorAll('.tabs button').forEach(btn=>{
      if(btn.textContent.trim() === "Jour") btn.classList.add("active");
    });
  } else if(id === "vue-mois") {
    document.querySelectorAll('.tabs button').forEach(btn=>{
      if(btn.textContent.trim() === "Mois") btn.classList.add("active");
    });
  }
  // ✅ rafraîchir le contenu réel de l’accueil à chaque navigation
  if(id === "vue-accueil"){ renderHome(); }

  // Toujours fermer le menu quand on change de vue
  closeMenu();
}




function switchTab(btn,id){
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  showView(id);
}
window.showView = showView;
window.switchTab = switchTab;

/* ================= Initialisation ================= */

function majUI(){
  rebuildSidebar();
  renderHome();

  // ✅ Si aucun enfant, on arrête là (pas de calculs, pas d’accès à getChild)
  if (!children || children.length === 0) {
    // On force l’accueil comme vue principale
    showView("vue-accueil");

    // On (re)branche quand même les boutons de maintenance
    document.getElementById("btnResetChildren")?.addEventListener("click", resetAllChildren);
    document.getElementById("btnPurgeAll")?.addEventListener("click", purgeAll);
    return;
  }

  // ======= À partir d’ici, on sait qu’il y a au moins 1 enfant =======
  setWeekTitle();
  setChildHeaders();
  setCurrentDayLabel();
  majVueJour();
  majAvancementJournee();
  majVueMois();
  calculer();
  renderRadials();
  syncCustomWeekIfVisible();

  // 🔹 (re)branche les boutons
  document.getElementById("btnResetChildren")?.addEventListener("click", resetAllChildren);
  document.getElementById("btnPurgeAll")?.addEventListener("click", purgeAll);

  // Si aucune vue active, afficher la page d’accueil par défaut
  if (!document.querySelector(".view.active")) {
    showView("vue-accueil");
  }
}


/* ===== Nom & Avatar ===== */
function openNameAvatar(i){
  selectChild(i);
  showView("vue-nom-avatar");
  const child = getChild();

  // Nom existant
  const nameInput = document.getElementById("inputChildName");
  if(nameInput){
    nameInput.value = child.settings.childName || "";
    nameInput.oninput = () => {
      child.settings.childName = nameInput.value.trim() || "Mon enfant";
      saveChildren();
      majUI();
    };
  }


// Avatar existant
const avatarPreview = document.getElementById("avatarPreview");
const avatarFileName = document.getElementById("avatarFileName");

console.log("avatarPreview trouvé ?", avatarPreview);

if (child.settings.avatar) {
  console.log("Avatar trouvé dans localStorage :", child.settings.avatar.substring(0, 50));
  avatarPreview.src = child.settings.avatar;
  avatarFileName.textContent = child.settings.avatarName || "Image importée";
} else {
  console.log("Pas d’avatar → utilisation du défaut");
  avatarPreview.src = "img/default.png";
  avatarFileName.textContent = "Avatar par défaut";
}

  // Âge
  const ageInput = document.getElementById("inputChildAge");
  if(ageInput){
    ageInput.value = child.settings.age || "";
    ageInput.oninput = () => {
      child.settings.age = parseInt(ageInput.value) || null;  // <= sauvegarde dans settings
      saveChildren();   // <= écrit dans localStorage
    };
  }

  // Genre
  document.querySelectorAll("input[name='childGender']").forEach(radio=>{
    radio.checked = (child.settings.gender || "non-defini") === radio.value;
    radio.onchange = () => {
      if(radio.checked){
        child.settings.gender = radio.value;  // <= sauvegarde dans settings
        saveChildren();                       // <= écrit dans localStorage
      }
    };
  });



  // Upload avatar
  const inputAvatar = document.getElementById("inputAvatar");
  if(inputAvatar){
    inputAvatar.value = "";
inputAvatar.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // ✅ Refus si trop gros (>5 Mo)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("⚠️ L’image est trop lourde (max 5 Mo). Choisis une image plus légère.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // ✅ Redimensionnement automatique à 200x200 px max
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      // ✅ Export compressé en PNG base64 (qualité 80%)
      const dataUrl = canvas.toDataURL("image/png", 0.8);

      // ✅ Mise à jour UI + stockage
      avatarPreview.src = dataUrl;
      children[currentChild].settings.avatar = dataUrl;
      children[currentChild].settings.avatarName = file.name;
      avatarFileName.textContent = file.name;
      saveChildren();
      majUI(); // ✅ met à jour la sidebar immédiatement
      console.log("✅ Avatar compressé et sauvegardé", dataUrl.substring(0, 50));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
};


  }

  showView("vue-nom-avatar");
}




function deleteAvatar(){
  const child = getChild();
  child.settings.avatar = null;
  delete child.settings.avatarName;
  saveChildren();

  const avatarPreview = document.getElementById("avatarPreview");
  if(avatarPreview) avatarPreview.src = "img/default.png";

  const avatarFileName = document.getElementById("avatarFileName");
  if(avatarFileName) avatarFileName.textContent = "Avatar par défaut";

  const inputAvatar = document.getElementById("inputAvatar");
  if(inputAvatar) inputAvatar.value = "";

  majUI();
  alert("✅ Avatar réinitialisé à l’image par défaut");
}




/* ===== Gestion des tâches ===== */
// Insère une ligne de notes (7 jours) à la fin pour toutes les semaines
function notesAppendRowForAllWeeks(child){
  if (!child.notes) child.notes = {};
  for (const wk of Object.keys(child.notes)) {
    child.notes[wk].push([0,0,0,0,0,0,0]);
  }
}

// Supprime la ligne i pour toutes les semaines
function notesRemoveRowForAllWeeks(child, i){
  if (!child.notes) return;
  for (const wk of Object.keys(child.notes)) {
    if (Array.isArray(child.notes[wk]) && child.notes[wk][i] !== undefined) {
      child.notes[wk].splice(i,1);
    }
  }
}

// Échange les lignes i et j pour toutes les semaines (pour moveTask)
function notesSwapRowsForAllWeeks(child, i, j){
  if (!child.notes) return;
  for (const wk of Object.keys(child.notes)) {
    const arr = child.notes[wk];
    if (Array.isArray(arr) && arr[i] !== undefined && arr[j] !== undefined) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

function normalizeName(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findMatchingChildIndex(importedChild) {
  if (!importedChild || !importedChild.settings) return -1;

  const nameImp = normalizeName(importedChild.settings.childName || "");
  if (!nameImp) return -1;

  const ageImp = importedChild.settings.age ?? null;
  const genderImp = importedChild.settings.gender || null;

  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (!c || !c.settings) continue;

    const nameCur = normalizeName(c.settings.childName || "");
    if (!nameCur || nameCur !== nameImp) continue;

    const ageCur = c.settings.age ?? null;
    const genderCur = c.settings.gender || null;

    // Si les deux ont un âge, il doit matcher
    if (ageImp !== null && ageCur !== null && ageImp !== ageCur) continue;

    // Si les deux ont un genre, il doit matcher
    if (genderImp && genderCur && genderImp !== genderCur) continue;

    return i;
  }
  return -1;
}

function mergeChildSettings(target, source) {
  if (!target.settings) target.settings = {};
  if (!source.settings) return;

  const t = target.settings;
  const s = source.settings;

  // On garde ce qui existe côté target, on complète avec source si vide
  if (!t.childName && s.childName) t.childName = s.childName;
  if (!t.avatar && s.avatar) {
    t.avatar = s.avatar;
    if (s.avatarName) t.avatarName = s.avatarName;
  }
  if ((t.age === null || t.age === undefined) && (s.age !== null && s.age !== undefined)) {
    t.age = s.age;
  }
  if (!t.gender && s.gender) t.gender = s.gender;

  // Récompenses globales : on ne remplace pas ce qui est renseigné
  if (!t.rewardLow && s.rewardLow) t.rewardLow = s.rewardLow;
  if (!t.rewardHigh && s.rewardHigh) t.rewardHigh = s.rewardHigh;
  if ((t.thresholdLow === undefined || t.thresholdLow === null) && s.thresholdLow !== undefined) {
    t.thresholdLow = s.thresholdLow;
  }
  if ((t.thresholdHigh === undefined || t.thresholdHigh === null) && s.thresholdHigh !== undefined) {
    t.thresholdHigh = s.thresholdHigh;
  }
}

function mergeRewardsByWeek(target, source) {
  if (!source.rewardsByWeek) return;
  if (!target.rewardsByWeek) target.rewardsByWeek = {};

  for (const [week, arr] of Object.entries(source.rewardsByWeek)) {
    if (!Array.isArray(arr) || !arr.length) continue;
    if (!Array.isArray(target.rewardsByWeek[week])) {
      target.rewardsByWeek[week] = [];
    }
    const destArr = target.rewardsByWeek[week];

    arr.forEach(r => {
      if (!r) return;
      const rewardTxt = (r.reward || "").trim();
      const pal = (r.palier || "").trim();
      if (!rewardTxt) return;

      const exists = destArr.some(x =>
        (x.reward || "").trim() === rewardTxt &&
        (x.palier || "").trim() === pal
      );
      if (!exists) destArr.push({ reward: rewardTxt, palier: pal });
    });
  }
}

function mergeHistory(target, source) {
  if (!source.history || !Array.isArray(source.history)) return;
  if (!target.history || !Array.isArray(target.history)) target.history = [];

  const existingWeeks = new Set(target.history.map(h => h.week));
  source.history.forEach(h => {
    if (!h || !h.week) return;
    if (!existingWeeks.has(h.week)) {
      target.history.push(h);
      existingWeeks.add(h.week);
    }
  });
}

function mergeTasksAndNotes(target, source) {
  if (!target.tasks) target.tasks = [];
  if (!target.notes) target.notes = {};
  if (!source.tasks) source.tasks = [];
  if (!source.notes) source.notes = {};

  const targetTasks = target.tasks;
  const sourceTasks = source.tasks;

  // Map nom normalisé -> index dans target
  const nameToIndex = {};
  targetTasks.forEach((t, i) => {
    const n = normalizeName(t.name || "");
    if (n) nameToIndex[n] = i;
  });

  // mapping : index source -> index target
  const mapping = [];

  sourceTasks.forEach((tSrc, srcIdx) => {
    const norm = normalizeName(tSrc.name || "");
    if (!norm) return;

    if (norm in nameToIndex) {
      // tâche déjà existante → on utilise l'index existant
      mapping[srcIdx] = nameToIndex[norm];
      // on pourrait fusionner les weights ici si besoin
    } else {
      // nouvelle tâche → on l'ajoute
      const newIndex = targetTasks.length;
      targetTasks.push({
        name: tSrc.name,
        weights: Array.isArray(tSrc.weights) ? tSrc.weights.slice() : [1,1,1,1,1,0,0]
      });
      // on ajoute une ligne de notes vide pour toutes les semaines déjà présentes
      notesAppendRowForAllWeeks(target);
      nameToIndex[norm] = newIndex;
      mapping[srcIdx] = newIndex;
    }
  });

  // Maintenant on fusionne les notes
  for (const [weekKey, srcRows] of Object.entries(source.notes)) {
    if (!Array.isArray(srcRows)) continue;

    // S'assure que target.notes[weekKey] existe et a la bonne taille
    ensureNotesForWeek(target, weekKey);

    const tgtRows = target.notes[weekKey];

    srcRows.forEach((rowSrc, srcIdx) => {
      const tgtIdx = mapping[srcIdx];
      if (tgtIdx === undefined || tgtIdx === null) return;
      if (!Array.isArray(rowSrc) || rowSrc.length !== 7) return;

      // S'assure que la ligne existe côté target
      if (!Array.isArray(tgtRows[tgtIdx]) || tgtRows[tgtIdx].length !== 7) {
        tgtRows[tgtIdx] = [0,0,0,0,0,0,0];
      }

      for (let d = 0; d < 7; d++) {
        const vExisting = parseFloat(tgtRows[tgtIdx][d]) || 0;
        const vImported = parseFloat(rowSrc[d]) || 0;
        // On garde le meilleur des deux
        const merged = Math.max(vExisting, vImported);
        tgtRows[tgtIdx][d] = merged;
      }
    });
  }
}

function mergeChildData(target, source) {
  if (!target || !source) return;

  mergeChildSettings(target, source);
  mergeTasksAndNotes(target, source);
  mergeRewardsByWeek(target, source);
  mergeHistory(target, source);
}


function openTaskManager(i){
  selectChild(i);
  renderTaskList();
  showView("vue-taches");
}

function renderTaskList(){
  const ul = document.getElementById("taskList");
  const child = getChild();
  if(!ul) return;
  const hdr = document.getElementById("currentChild_tasks");
  if (hdr) hdr.textContent = (child?.settings?.childName || "Mon enfant");
  ul.innerHTML = "";
  child.tasks.forEach((t, idx)=>{
    ul.insertAdjacentHTML("beforeend",`
      <li>
        ${escapeHtml(t.name)}
        <span>
          <button onclick="moveTask(${idx},-1)">⬆️</button>
          <button onclick="moveTask(${idx},1)">⬇️</button>
          <button onclick="removeTask(${idx})">🗑️</button>
        </span>
      </li>`);
  });
}

function addTask(){
  const input = document.getElementById("newTaskName");
  if(!input) return;
  const name = input.value.trim();
  if(!name) return;
  const child = getChild();
  child.tasks.push({ name, weights:[1,1,1,1,1,0,0] });
  // ↳ ajoute la ligne correspondante dans toutes les semaines existantes
  notesAppendRowForAllWeeks(child);
  // Assure la cohérence de la semaine affichée
  ensureNotesForWeek(child, getWeekKey());
  saveChildren();  
  // 💡 garantit qu'on est bien sur la vue Tâches AVANT de re-rendre
  showView("vue-taches");  
  renderTaskList();
  input.value = "";
  // 👀 focus/scroll sur la nouvelle entrée + petit flash
  requestAnimationFrame(()=>{
    const ul = document.getElementById("taskList");
    const li = ul?.lastElementChild;
    if(li){
      li.scrollIntoView({behavior:"smooth", block:"end"});
      li.classList.add("added");
      setTimeout(()=>li.classList.remove("added"), 900);
    }
    // Remettre le focus pour enchaîner les ajouts au clavier
    input?.focus();
  });
}

function removeTask(i){
  const child = getChild();
  child.tasks.splice(i,1);
  // ↳ supprime la ligne i partout
  notesRemoveRowForAllWeeks(child, i);
  ensureNotesForWeek(child, getWeekKey());
  saveChildren();
  renderTaskList();
}

function moveTask(i,dir){
  const child = getChild();
  const tasks = child.tasks;
  const j = i+dir;
  if(j<0 || j>=tasks.length) return;
  [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  // ↳ swap des lignes de notes pour toutes les semaines
  notesSwapRowsForAllWeeks(child, i, j);
  ensureNotesForWeek(child, getWeekKey());
  saveChildren();
  renderTaskList();
}

function saveRewards(){
  alert("💾 Sauvegarde automatique déjà activée !");
}

function appliquerStyleRadio(r){
  const label = r.nextElementSibling;
  if(!label) return;

  // Reset par défaut
  label.style.opacity = "0.4";
  label.style.background = "transparent";
  label.style.border = "2px solid transparent";

  if(r.checked){
    label.style.opacity = "1";
    label.style.border = "2px solid #aaa";
    if(r.value === "0") label.style.background = "#fdecea";   // rouge clair
    if(r.value === "0.5") label.style.background = "#fff4e5"; // orange clair
    if(r.value === "1") label.style.background = "#e8f5e9";   // vert clair
  }
}

function goBackToSidebar(){
  // 🔄 Sauvegarde au cas où des changements n’ont pas encore été persistés
  saveChildren();

  // ✅ Rafraîchir l’interface pour mettre à jour l’avatar dans la sidebar
  majUI();

  // ✅ Réouvrir la sidebar (comme avant)
  openMenu();
}

/* ===== Récompenses personnalisées par semaine ===== */
/* ================= Récompenses personnalisées ================= */

function addWeeklyReward() {
  const child = getChild();
const weekEl = document.getElementById("customWeek");
const week = weekEl ? weekEl.value.trim() : "";

const rewardEl = document.getElementById("customReward");
const reward = rewardEl ? rewardEl.value.trim() : "";

  const palier = document.getElementById("customPalier")?.value;

  if (!week || !reward) {
    alert("Veuillez saisir la semaine et la récompense.");
    return;
  }

  // 🔁 Toujours enregistrer sur la semaine affichée (pas sur la saisie)
  const weekKey = getWeekKey();

  // Palier normalisé (tolère 1 / p1 / palier1 / Palier 1)
  const normPalier = (p) => {
    const x = String(p || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
    if (x === "1" || x === "p1" || x === "palier1") return "Palier 1";
    if (x === "2" || x === "p2" || x === "palier2") return "Palier 2";
    return "Palier 1";
  };
  const palNorm = normPalier(palier);

  if (!child.rewardsByWeek) child.rewardsByWeek = {};
  if (!Array.isArray(child.rewardsByWeek[weekKey])) {
    child.rewardsByWeek[weekKey] = [];
  }

  // Empêche doublon exact pour cette semaine/palier
  const exists = child.rewardsByWeek[weekKey].some(
    r => r.palier === palNorm && r.reward === reward
  );
  if (exists) {
    alert("Cette récompense existe déjà pour cette semaine et ce palier.");
    return;
  }

  child.rewardsByWeek[weekKey].push({ reward, palier: palNorm });
  saveChildren();
  majTableCustomRewards();

  // ➜ rafraîchir immédiatement la vue Jour (bandeaux)
  calculer();

  const input = document.getElementById("customReward");
  if (input) input.value = "";



  saveChildren();
  majTableCustomRewards();

  // 🟢 Recalcule tout de suite pour mettre à jour les bandeaux en vue Jour
  calculer();

  document.getElementById("customReward").value = "";


  saveChildren();
  majTableCustomRewards();
  document.getElementById("customReward").value = "";
}

/* === Affichage du tableau de récompenses personnalisées === */
function majTableCustomRewards() {
  const child = getChild();
  const tbody = document.querySelector("#customRewardsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  for (const [week, rewards] of Object.entries(child.rewardsByWeek || {})) {
    rewards.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(week)}</td>
        <td>${escapeHtml(r.reward)}</td>
        <td>${escapeHtml(r.palier || "-")}</td>
        <td><button onclick="deleteWeeklyReward('${week}', ${idx})">❌</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

/* === Suppression === */
function deleteWeeklyReward(week, idx) {
  const child = getChild();
  if (!child.rewardsByWeek?.[week]) return;
  child.rewardsByWeek[week].splice(idx, 1);
  if (child.rewardsByWeek[week].length === 0) delete child.rewardsByWeek[week];
  saveChildren();
  majTableCustomRewards();
  calculer(); // met à jour les bandeaux tout de suite
}

/* === Sauvegarde / affichage au chargement === */
function openRewardsManager(i) {
  selectChild(i);
  showView("vue-recompenses");
  
// 🔒 Le champ "Semaine" est toujours la semaine affichée
const weekInput = document.getElementById("customWeek");
if (weekInput) {
  const wk = getWeekKey();          // ex. "44-2025"
  weekInput.value = wk;
  weekInput.placeholder = wk;       // visible même si disabled
  weekInput.readOnly = true;
  weekInput.disabled = true;
}

  majTableCustomRewards();
    // 🔹 Rattacher la sauvegarde automatique des seuils et récompenses de base
  const c = getChild();

  const inputRewardLow  = document.getElementById("inputRewardLow");
  const inputRewardHigh = document.getElementById("inputRewardHigh");
  const inputThresholdLow  = document.getElementById("inputThresholdLow");
  const inputThresholdHigh = document.getElementById("inputThresholdHigh");

  if (inputRewardLow) {
    inputRewardLow.value = c.settings.rewardLow || "";
    inputRewardLow.oninput = () => {
      c.settings.rewardLow = inputRewardLow.value.trim();
      saveChildren();
    };
  }

  if (inputRewardHigh) {
    inputRewardHigh.value = c.settings.rewardHigh || "";
    inputRewardHigh.oninput = () => {
      c.settings.rewardHigh = inputRewardHigh.value.trim();
      saveChildren();
    };
  }

  if (inputThresholdLow) {
    inputThresholdLow.value = c.settings.thresholdLow || 30;
    inputThresholdLow.oninput = () => {
      c.settings.thresholdLow = parseFloat(inputThresholdLow.value) || 0;
      saveChildren();
    };
  }

  if (inputThresholdHigh) {
    inputThresholdHigh.value = c.settings.thresholdHigh || 50;
    inputThresholdHigh.oninput = () => {
      c.settings.thresholdHigh = parseFloat(inputThresholdHigh.value) || 0;
      saveChildren();
    };
  }
updateRewardSummary();
}

function updateRewardSummary() {
  const c = getChild();

  const input1 = document.getElementById("summaryThreshold1");
  const input2 = document.getElementById("summaryThreshold2");
  const reward1 = document.getElementById("summaryReward1");
  const reward2 = document.getElementById("summaryReward2");

  // Initialisation des valeurs
  input1.value = c.settings.thresholdLow || 0;
  input2.value = c.settings.thresholdHigh || 0;
  reward1.value = c.settings.rewardLow || "";
  reward2.value = c.settings.rewardHigh || "";

  // Sauvegarde automatique à la saisie
  input1.oninput = () => { c.settings.thresholdLow = parseFloat(input1.value) || 0; saveChildren(); };
  input2.oninput = () => { c.settings.thresholdHigh = parseFloat(input2.value) || 0; saveChildren(); };
  reward1.oninput = () => { c.settings.rewardLow = reward1.value.trim(); saveChildren(); };
  reward2.oninput = () => { c.settings.rewardHigh = reward2.value.trim(); saveChildren(); };
}
function isValidChild(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  if (!obj.settings || typeof obj.settings.childName !== 'string') return false;
  if (!Array.isArray(obj.tasks)) return false;
  if (typeof obj.notes !== 'object' || obj.notes === null) return false;
  if (!Array.isArray(obj.history)) return false;
  return true;
}

function addChildSafely(child) {
  if (!isValidChild(child)) {
    console.warn("Child rejeté : schéma invalide");
    showToast("Données enfant invalides", "var(--danger)");
    return;
  }
  children.push(child);
  saveChildren();
}


function renderCustomRewards() {
  const c = getChild();
  const tbody = document.querySelector("#customRewardsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rewards = c.rewardsByWeek || {};
  for (const [week, data] of Object.entries(rewards)) {
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${escapeHtml(week)}</td>
        <td>${escapeHtml(data.reward)}</td>
        <td>>${escapeHtml(data.palier)}</td>
        <td><button onclick="deleteWeeklyReward('${week}')">🗑️</button></td>
      </tr>
    `);
  }
}

function showToast(message, color = "var(--primary)") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.background = color;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

/* === Vue-jour : sélection du jour === */

/** Retourne le dayIdx (0=Lundi..6=Dimanche) pour la currentDate dans SA semaine. */
function getDayIdxInWeek(date) {
  const monday = getMonday(date);                  // util déjà présent chez toi
  const diffDays = Math.round((date - monday) / (24 * 3600 * 1000));
  return Math.max(0, Math.min(6, diffDays));
}

/** Définit currentDate sur le jour d’index dayIdx dans la semaine ACTUELLEMENT affichée. */
function setDayIdxInCurrentWeek(dayIdx) {
  const monday = getMonday(currentDate);           // on ne change pas de semaine, on bouge juste le jour
  const newDate = new Date(monday);
  newDate.setDate(monday.getDate() + dayIdx);
  currentDate = newDate;

  // Rendu de la vue-jour (garde le verrouillage : radios disabled si semaine != courante)
  majVueJour();
  // <-- AJOUTER ICI :
  majAvancementJournee();
  renderRadials();

  if (typeof updateJourSelectorUI === "function") updateJourSelectorUI();
   
}

/** Met à jour la classe .active sur la bonne puce selon currentDate. */
function updateJourSelectorUI() {
  const container = document.getElementById('jour-selector');
  if (!container) return;

  const idx = getDayIdxInWeek(currentDate);
  container.querySelectorAll('.jour-btn').forEach((btn) => {
    const bIdx = parseInt(btn.getAttribute('data-day-idx'), 10);
    if (bIdx === idx) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

/** Branche les listeners sur la barre 7 jours. À appeler une fois au chargement. */
function initJourSelector() {
  const container = document.getElementById('jour-selector');
  if (!container) return;

  // Clic sur une puce
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.jour-btn');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-day-idx'), 10);
    if (Number.isNaN(idx)) return;

    // On autorise toujours la navigation jour, même si la semaine est verrouillée
    // (le verrouillage s'applique à la SAISIE via les radios déjà disabled hors semaine courante)
    setDayIdxInCurrentWeek(idx);
  });

  // Initialisation de l'état visuel
  updateJourSelectorUI();
}

/* --- IMPORTANT : appeler initJourSelector au démarrage --- */
// Exemple : dans ton init global existant
document.addEventListener("DOMContentLoaded",()=>{
  bootstrapIfEmpty();
  majUI();
  initJourSelector();
  updateJourSelectorUI(); // synchronise la puce bleue au premier rendu
  showView("vue-accueil"); // ✅ vue par défaut au lancement

  document.getElementById("btnPrev")?.addEventListener("click",()=>{
    changerSemaine(-1);
    renderRadials();
  });
  document.getElementById("btnNext")?.addEventListener("click",()=>{
    changerSemaine(1);
    renderRadials();
  });

  document.getElementById("btnPrevMonth")?.addEventListener("click",()=>{
    currentDate.setMonth(currentDate.getMonth()-1);
    majUI();
    renderRadials();
  });
  document.getElementById("btnNextMonth")?.addEventListener("click",()=>{
    currentDate.setMonth(currentDate.getMonth()+1);
    majUI();
    renderRadials();
  });

  // 🔹 Ajout à faire ici :
  initDailyProgressListeners();
  majAvancementJournee();
    // === Hook : après chaque rafraîchissement de la vue-jour, on met à jour la barre ===
  const _majVueJour = majVueJour;
  window.majVueJour = function () {
    _majVueJour.apply(this, arguments);
  // --> AJOUTS pour corriger le bug :
  majAvancementJournee();  // recalcule le % jour pour le jour affiché
  renderRadials();         // redessine les cercles (jour/semaine/mois)
  // (si tu as la barre 7 jours) :
  if (typeof updateJourSelectorUI === "function") updateJourSelectorUI();  
  };

  // Enter = Ajouter (après que le DOM est prêt)
  const newTaskInput = document.getElementById("newTaskName");
  if (newTaskInput) {
    newTaskInput.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){ addTask(); }
    });
  }

});



/* ================= Exposition des handlers (globaux) ================= */

window.selectChild = selectChild;
window.openNameAvatar = openNameAvatar;
window.openTaskManager = openTaskManager;
window.openRewardsManager = openRewardsManager;
window.exportChild = exportChild;
window.deleteChild = deleteChild;
window.handleImportChild = handleImportChild;
window.importExample = importExample;
window.addChild = addChild;
window.resetAllChildren = resetAllChildren;
window.purgeAll = purgeAll;
window.addWeeklyReward = addWeeklyReward;
window.renderCustomRewards = renderCustomRewards;
window.deleteWeeklyReward = deleteWeeklyReward;
window.exportAllData = exportAllData;
window.handleImportAllReplace = handleImportAllReplace;
window.handleImportAllMerge = handleImportAllMerge;

const $=id=>document.getElementById(id);
let lastResult=null,lastAnswer="";
const screens=["home","loading","result","saved","access"];
function showScreen(name){screens.forEach(s=>$(s).classList.toggle("active",s===name));window.scrollTo({top:0,behavior:"smooth"});if(name==="saved")renderSaved();}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));
$("openAccess").onclick=()=>showScreen("access");$("backFromAccess").onclick=()=>showScreen("home");$("backHome").onclick=()=>showScreen("home");
function speak(text){if(!("speechSynthesis"in window)){alert("La lecture vocale n’est pas disponible.");return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="fr-FR";u.rate=.92;speechSynthesis.speak(u);}
$("speakWelcome").onclick=()=>speak("Bienvenue dans PaperPilot. Choisissez une image pour analyser un document.");
$("voiceTest").onclick=()=>speak("La lecture vocale de PaperPilot fonctionne.");
function setProgress(n,msg){$("progressBar").style.width=n+"%";$("progressText").textContent=msg}
function detectType(t){const x=t.toLowerCase();if(/assurance|sinistre|garantie|assuré/.test(x))return"📄 Assurance";if(/facture|montant à payer|tva|échéance de paiement/.test(x))return"🧾 Facture";if(/impôt|taxe|déclaration|revenu fiscal|trésor public/.test(x))return"🏛️ Document fiscal";if(/contrat|conditions générales|résiliation|engagement/.test(x))return"📝 Contrat";if(/iban|virement|compte bancaire|relevé de compte/.test(x))return"🏦 Document bancaire";if(/ordonnance|prescription|posologie|médicament/.test(x))return"💊 Prescription / santé";if(/cher monsieur|cher madame|objet\s*:|cordialement/.test(x))return"✉️ Lettre / courrier";return"📄 Document général";}
function extractDates(t){const re=/\b(?:0?[1-9]|[12]\d|3[01])(?:[\/.-])(?:0?[1-9]|1[0-2])(?:[\/.-])(?:20\d{2}|19\d{2})\b/g;return[...new Set(t.match(re)||[])].slice(0,12)}
function extractAmounts(t){const re=/(?:€\s*)?\b\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})?\s*(?:€|EUR)\b|\b\d+(?:[,.]\d{2})?\s*€/gi;return[...new Set(t.match(re)||[])].slice(0,12)}

function classifyAmounts(t){
  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const amounts=extractAmounts(t), pay=[], other=[];
  amounts.forEach(a=>{
    const context=lines.find(l=>l.includes(a))||"";
    if(/à payer|payer|total|net à payer|montant dû|reste à payer|règlement/i.test(context)) pay.push(a);
    else other.push(a);
  });
  return {pay:[...new Set(pay)],other:[...new Set(other)]};
}
function findImportantDates(t){
  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean), out=[];
  extractDates(t).forEach(d=>{
    const context=lines.find(l=>l.includes(d))||"";
    if(/échéance|avant|jusqu|date limite|payer|paiement|règlement|rendez-vous|convocation|résiliation|préavis|répondre/i.test(context)) out.push({date:d,context});
  });
  return out;
}
function detectActions(t){const x=t.toLowerCase(),out=[];if(/payer|paiement|règlement|réglée|régler/.test(x))out.push("Vérifier le montant et la date de paiement.");if(/signer|signature/.test(x))out.push("Vérifier les informations avant de signer.");if(/répondre|retourner|envoyer|transmettre|joindre/.test(x))out.push("Vérifier s’il faut répondre ou envoyer un document.");if(/résilier|résiliation|préavis/.test(x))out.push("Vérifier les conditions et le délai de résiliation.");if(/rendez-vous|consultation|convocation/.test(x))out.push("Vérifier la date et l’heure du rendez-vous.");if(!out.length)out.push("Relire les informations importantes et vérifier s’il y a une échéance.");return out}
function plainSummary(type,dates,amounts,actions){let s=`Ce document semble être : ${type.replace(/^.\s/,"")}. `;if(amounts.length)s+=`J’ai repéré ${amounts.length===1?"un montant":"plusieurs montants"}. `;if(dates.length)s+=`J’ai repéré ${dates.length===1?"une date":"plusieurs dates"}. `;s+=actions[0];return s}
function block(title,items){if(!items.length)return`<div class="item"><strong>${title}</strong><span>Aucune information détectée automatiquement.</span></div>`;return`<div class="item"><strong>${title}</strong><ul>${items.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function answerFor(q){const r=lastResult;if(!r)return"Analysez d’abord un document.";if(q==="what")return`Ce document semble être : ${r.type.replace(/^.\s/,"")}. ${r.plain}`;if(q==="todo")return r.actions.join(" ");if(q==="money")return r.amountsToPay?.length?`Le montant qui semble être à payer est : ${r.amountsToPay.join(", ")}. Vérifiez le montant exact sur le document original.`:(r.amounts.length?`J’ai trouvé : ${r.amounts.join(", ")}. Je ne peux pas confirmer automatiquement lequel est à payer.`:"Je n’ai pas détecté de montant automatiquement.");if(q==="date")return r.dates.length?`J’ai trouvé ces dates : ${r.dates.join(", ")}. ${r.important?.[0]||"Vérifiez laquelle correspond à l’échéance ou au rendez-vous."}`:"Je n’ai pas détecté de date au format habituel.";return""}
document.querySelectorAll(".questionBtn").forEach(b=>b.onclick=()=>{lastAnswer=answerFor(b.dataset.q);$("assistantAnswer").textContent=lastAnswer});
$("speakAnswer").onclick=()=>speak(lastAnswer||"Choisissez une question.");
function answerFreeQuestion(question){
  const r=lastResult;
  if(!r) return "Analysez d’abord un document.";
  const q=question.toLowerCase().trim();
  if(!q) return "Écrivez une question sur le document.";
  if(/(quoi|quel type|c.?est quoi|nature|document)/.test(q)) return answerFor("what");
  if(/(faire|dois|obligation|action|payer|paie|régler|signer|signature|répondre|envoyer|résilier)/.test(q)) return answerFor("todo");
  if(/(combien|montant|prix|somme|€|euros?)/.test(q)) return answerFor("money");
  if(/(quand|date|échéance|délai|avant le|jusqu.?au)/.test(q)) return answerFor("date");

  const words=q.replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(w=>w.length>=4);
  const sentences=r.text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const hits=sentences.filter(s=>words.some(w=>s.toLowerCase().includes(w)));
  if(hits.length){
    return "J’ai trouvé ceci dans le texte du document : " + hits.slice(0,2).join(" ");
  }
  return "Je ne trouve pas de réponse certaine dans le texte reconnu. Essayez une question sur le type de document, une date, un montant ou une action à effectuer.";
}
$("askQuestion").onclick=()=>{
  lastAnswer=answerFreeQuestion($("userQuestion").value);
  $("assistantAnswer").textContent=lastAnswer;
};
$("userQuestion").addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter") $("askQuestion").click();
});
let recognition=null;
let listening=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
  recognition=new SpeechRecognition();
  recognition.lang="fr-FR";
  recognition.interimResults=false;
  recognition.continuous=false;
  recognition.onstart=()=>{
    listening=true;
    $("voiceQuestion").textContent="⏹️ Arrêter";
    $("voiceStatus").textContent="🎙️ Je vous écoute…";
    $("voiceStatus").classList.add("recording");
  };
  recognition.onresult=e=>{
    const transcript=e.results?.[0]?.[0]?.transcript||"";
    $("userQuestion").value=transcript;
    lastAnswer=answerFreeQuestion(transcript);
    $("assistantAnswer").textContent=lastAnswer;
    speak(lastAnswer);
  };
  recognition.onerror=e=>{
    $("voiceStatus").textContent=e.error==="not-allowed"?"Microphone non autorisé. Vous pouvez écrire votre question.":"La reconnaissance vocale n’a pas pu démarrer. Vous pouvez écrire votre question.";
  };
  recognition.onend=()=>{
    listening=false;
    $("voiceQuestion").textContent="🎙️ Parler";
    $("voiceStatus").textContent="Vous pouvez écrire ou utiliser votre voix si votre navigateur le permet.";
    $("voiceStatus").classList.remove("recording");
  };
  $("voiceQuestion").onclick=()=>{
    if(listening){recognition.stop();return}
    try{recognition.start()}catch(e){}
  };
}else{
  $("voiceQuestion").onclick=()=>alert("La saisie vocale n’est pas disponible dans ce navigateur. Vous pouvez écrire votre question.");
}


async function analyze(file){showScreen("loading");setProgress(8,"Préparation de la lecture…");try{if(!window.Tesseract)throw new Error("Le moteur OCR n’a pas pu être chargé. Vérifiez votre connexion internet.");const result=await Tesseract.recognize(file,"fra+eng",{logger:m=>{if(m.status==="recognizing text")setProgress(10+Math.round((m.progress||0)*75),"Lecture du document…")}});setProgress(90,"Compréhension des éléments importants…");const text=(result.data.text||"").trim();if(!text)throw new Error("Aucun texte lisible n’a été détecté. Essayez une photo plus nette et bien éclairée.");const type=detectType(text),dates=extractDates(text),amountInfo=classifyAmounts(text),amounts=[...new Set([...amountInfo.pay,...amountInfo.other])],actions=detectActions(text),importantDates=findImportantDates(text);
const important=[];
if(importantDates.length) important.push("Une date semble liée à une échéance ou à une action : "+importantDates[0].date+".");
if(amountInfo.pay.length) important.push("Un montant semble correspondre à une somme à payer : "+amountInfo.pay[0]+".");
important.push(actions[0]);
lastResult={id:Date.now(),title:type,plain:plainSummary(type,dates,amounts,actions),type,dates,amounts,amountsToPay:amountInfo.pay,actions,important,text};
$("resultTitle").textContent=type;$("plainSummary").textContent=lastResult.plain;
$("docType").innerHTML=`<strong>Type détecté :</strong> ${escapeHtml(type)}`;
$("importantBlock").innerHTML=`<div class="importantBox"><strong>⚠️ Points importants</strong><ul>${important.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`;
$("datesBlock").innerHTML=block("📅 Dates",dates);
$("amountsBlock").innerHTML=block("💶 Montants à payer",amountInfo.pay)+block("💶 Autres montants",amountInfo.other);
$("actionsBlock").innerHTML=block("✅ Actions à vérifier",actions);
$("reminderText").textContent=importantDates.length?`Date à retenir : ${importantDates[0].date}.`:"Aucune échéance claire détectée automatiquement.";
$("rawText").textContent=text;$("assistantAnswer").textContent="Choisissez une question.";lastAnswer="";setProgress(100,"Terminé.");showScreen("result");if(localStorage.getItem("paperpilot-autoSpeak")==="1")speak(lastResult.plain)}catch(e){alert(e.message||"Une erreur est survenue.");showScreen("home")}}
$("fileInput").addEventListener("change",e=>{const f=e.target.files?.[0];if(f)analyze(f);e.target.value=""});
$("speakResult").onclick=()=>lastResult&&speak(lastResult.plain+" "+lastResult.actions.join(" "));$("stopSpeech").onclick=()=>speechSynthesis.cancel();
$("saveResult").onclick=()=>{if(!lastResult)return;const a=JSON.parse(localStorage.getItem("paperpilot-docs")||"[]");a.unshift(lastResult);localStorage.setItem("paperpilot-docs",JSON.stringify(a.slice(0,30)));alert("Document enregistré sur cet appareil.")};
function renderSaved(){
  const a=JSON.parse(localStorage.getItem("paperpilot-docs")||"[]");
  const stats=$("dashboardStats"), due=$("dueList"), money=$("moneyList"), box=$("savedList");
  const dates=a.flatMap(d=>d.dates||[]), moneyVals=a.flatMap(d=>d.amountsToPay||d.amounts||[]);
  stats.innerHTML=`<div class="stat"><strong>${a.length}</strong><span>Documents</span></div><div class="stat"><strong>${dates.length}</strong><span>Dates détectées</span></div><div class="stat"><strong>${moneyVals.length}</strong><span>Montants</span></div><div class="stat"><strong>${a.filter(d=>(d.actions||[]).length).length}</strong><span>À vérifier</span></div>`;
  if(!a.length){
    due.innerHTML='<p>Aucune échéance enregistrée.</p>';
    money.innerHTML='<p>Aucun montant enregistré.</p>';
    box.innerHTML='<div class="card"><p>Aucun document enregistré pour le moment.</p></div>';
    return;
  }
  due.innerHTML=a.slice(0,10).flatMap(d=>(d.dates||[]).map(date=>`<div class="dashItem"><strong>${escapeHtml(date)}</strong><span class="status info">À vérifier</span><br><small>${escapeHtml(d.type||"Document")}</small></div>`)).join("")||"<p>Aucune date détectée.</p>";
  money.innerHTML=a.slice(0,10).flatMap(d=>(d.amountsToPay?.length?d.amountsToPay:(d.amounts||[])).map(amount=>`<div class="dashItem"><strong>${escapeHtml(amount)}</strong><span class="status warn">Montant</span><br><small>${escapeHtml(d.type||"Document")}</small></div>`)).join("")||"<p>Aucun montant détecté.</p>";
  box.innerHTML=a.map(d=>`<div class="card"><h2>${escapeHtml(d.type||"Document")}</h2><p>${escapeHtml(d.plain||"")}</p><small>Enregistré le ${new Date(d.savedAt||d.id).toLocaleString("fr-FR")}</small></div>`).join("");
}
$("clearSaved").onclick=()=>{if(confirm("Supprimer les documents enregistrés sur cet appareil ?")){localStorage.removeItem("paperpilot-docs");renderSaved()}};
$("prepareReminder").onclick=()=>{
  if(!lastResult)return;
  const m=(lastResult.important||[]).join(" ").match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}\b/);
  const text=m?`Rappel préparé : pensez à vérifier l’échéance du ${m[0]}.`:"Aucune date suffisamment claire pour préparer un rappel automatiquement.";
  $("reminderText").textContent=text;
  speak(text);
};

function setPref(key,value){localStorage.setItem(key,value?"1":"0")}
$("largeText").checked=localStorage.getItem("paperpilot-large")==="1";$("highContrast").checked=localStorage.getItem("paperpilot-contrast")==="1";$("autoSpeak").checked=localStorage.getItem("paperpilot-autoSpeak")==="1";
function applyAccess(){document.body.classList.toggle("largeText",$("largeText").checked);document.body.classList.toggle("highContrast",$("highContrast").checked)}
$("largeText").onchange=()=>{setPref("paperpilot-large",$("largeText").checked);applyAccess()};$("highContrast").onchange=()=>{setPref("paperpilot-contrast",$("highContrast").checked);applyAccess()};$("autoSpeak").onchange=()=>setPref("paperpilot-autoSpeak",$("autoSpeak").checked);applyAccess();

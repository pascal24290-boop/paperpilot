let multiPageFiles = [];
const $=id=>document.getElementById(id);
let lastResult=null,lastAnswer="";
let lastFile = null;
const screens=["home","loading","result","saved","reminders","privacy","access"];
function showScreen(name){screens.forEach(s=>$(s).classList.toggle("active",s===name));window.scrollTo({top:0,behavior:"smooth"});if(name==="saved")renderSaved();}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));

$("savedSearch")?.addEventListener("input",renderSaved);
$("categoryFilter")?.addEventListener("change",renderSaved);
$("saveCurrent")?.addEventListener("click",()=>{ if(typeof saveResult==="function") saveResult(); });
$("prepareReminder")?.addEventListener("click",prepareReminder);
$("openReminders")?.addEventListener("click",()=>{renderReminders();showScreen("reminders");});
$("backFromReminders")?.addEventListener("click",()=>showScreen("home"));


function readFullText(){
  const text=lastResult?.text || "";
  if(!text.trim()){
    updateSpeechStatus("Aucun texte complet n’est disponible pour ce document.");
    return;
  }
  speak("Lecture du texte complet. " + text);
}

function retryDocument(){
  if(lastFile && typeof analyze==="function"){
    showScreen("loading");
    analyze(lastFile);
  }else{
    $("fileInput")?.click();
  }
}
function initOCRQualityControls(){
  $("retryDocument")?.addEventListener("click",retryDocument);
  $("chooseAnother")?.addEventListener("click",()=>{$("fileInput")?.click();});
}
function initSpeechControls(){
  $("pauseSpeech")?.addEventListener("click",pauseSpeech);
  $("resumeSpeech")?.addEventListener("click",resumeSpeech);
  $("stopSpeech")?.addEventListener("click",stopSpeech);
  $("detailRead")?.addEventListener("click",readFullText);
  $("speechRate")?.addEventListener("input",e=>{
    speechRate=Number(e.target.value)||0.9;
    $("speechRateValue").textContent=speechRate.toFixed(1).replace(".",",")+"×";
    if(speechSynthesis.speaking){
      speechSynthesis.cancel();
      const remaining=speechQueue.slice(Math.max(0,speechIndex)).join(" ");
      if(remaining) speak(remaining);
    }
  });
}
function guidedWelcome(){
  const text="Bienvenue dans PaperPilot. Pour commencer, photographiez un document ou choisissez un fichier. Je vais essayer de le lire, repérer les dates et les montants, puis vous pourrez écouter le résultat ou poser une question.";
  if(typeof speak==="function") speak(text);
}
function hideWelcome(){
  const card=$("welcomeCard");
  if(card) card.hidden=true;
  try{localStorage.setItem("paperpilot-welcome-seen","1");}catch(e){}
}
function initWelcome(){
  const seen=localStorage.getItem("paperpilot-welcome-seen")==="1";
  const card=$("welcomeCard");
  if(card && seen) card.hidden=true;
  $("startGuided")?.addEventListener("click",guidedWelcome);
  $("closeWelcome")?.addEventListener("click",hideWelcome);
  $("quickPhoto")?.addEventListener("click",()=>{ $("fileInput")?.click(); });
  $("quickFile")?.addEventListener("click",()=>{ $("fileInput")?.click(); });
}
$("openAccess").onclick=()=>showScreen("access");$("openPrivacy").onclick=()=>showScreen("privacy");$("backFromPrivacy").onclick=()=>showScreen("home");$("backFromAccess").onclick=()=>showScreen("home");$("backHome").onclick=()=>showScreen("home");
let speechRate = 0.9;
let speechQueue = [];
let speechIndex = 0;
let speechCurrentText = "";

function updateSpeechStatus(message){
  const el=$("speechStatus");
  if(el) el.textContent=message;
}

function speak(text){
  if(!("speechSynthesis" in window)){
    updateSpeechStatus("La lecture vocale n’est pas disponible dans ce navigateur.");
    return;
  }
  speechSynthesis.cancel();
  speechCurrentText=String(text||"").trim();
  if(!speechCurrentText) return;
  speechQueue=splitSpeechText(speechCurrentText);
  speechIndex=0;
  speakNextChunk();
}

function splitSpeechText(text){
  const parts=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  return parts.map(s=>s.trim()).filter(Boolean);
}

function speakNextChunk(){
  if(!speechQueue.length || speechIndex>=speechQueue.length) {
    updateSpeechStatus("Lecture terminée.");
    return;
  }
  const utterance=new SpeechSynthesisUtterance(speechQueue[speechIndex]);
  utterance.lang="fr-FR";
  utterance.rate=speechRate;
  utterance.pitch=1;
  utterance.onstart=()=>updateSpeechStatus(`Lecture ${speechIndex+1} sur ${speechQueue.length}.`);
  utterance.onend=()=>{
    speechIndex++;
    speakNextChunk();
  };
  utterance.onerror=()=>updateSpeechStatus("La lecture vocale a rencontré un problème.");
  speechSynthesis.speak(utterance);
}

function pauseSpeech(){
  if("speechSynthesis" in window && speechSynthesis.speaking){
    speechSynthesis.pause();
    updateSpeechStatus("Lecture en pause.");
  }
}
function resumeSpeech(){
  if("speechSynthesis" in window && speechSynthesis.paused){
    speechSynthesis.resume();
    updateSpeechStatus("Lecture reprise.");
  }
}
function stopSpeech(){
  if("speechSynthesis" in window){
    speechSynthesis.cancel();
    speechQueue=[];
    speechIndex=0;
    updateSpeechStatus("Lecture arrêtée.");
  }
}

function guidedText(){
  const r=lastResult||{};
  const interpretation=buildInterpretation(r.text||"",r.dates||[],r.amountsToPay||[],r.actions||[]);
  return [
    `Type de document : ${interpretation.type}.`,
    interpretation.amountMeaning,
    interpretation.dateMeaning,
    r.actions?.length ? `À faire : ${r.actions.join(". ")}.` : "",
    r.plain ? `En clair : ${r.plain}` : "",
    "Vérifiez toujours le document original."
  ].filter(Boolean).join(" ");
}
$("guidedRead").onclick=()=>speak(guidedText());
$("quickRead").onclick=()=>speak("PaperPilot. " + (lastResult ? guidedText() : "Analysez un document pour pouvoir écouter son contenu."));

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





function assessOCRQuality(text, ocrConfidence){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  const length=clean.length;
  const weird=(clean.match(/[�]/g)||[]).length;
  const words=clean?clean.split(/\s+/).length:0;
  let level="low";
  let message="Peu de texte lisible a été détecté. Essayez une photo plus nette, mieux cadrée et mieux éclairée.";
  if(length>=500 && weird<5){
    level="good";
    message="La quantité de texte détectée semble correcte. Vérifiez quand même les informations importantes sur l’original.";
  } else if(length>=120 && words>=20){
    level="medium";
    message="Une partie du texte semble lisible, mais certains éléments peuvent manquer ou être mal reconnus. Vérifiez l’original.";
  }
  if(typeof ocrConfidence==="number" && ocrConfidence<45){
    level="low";
    message="La lecture automatique semble difficile. Reprenez une photo plus nette, mieux éclairée et bien cadrée.";
  } else if(typeof ocrConfidence==="number" && ocrConfidence<65 && level==="good"){
    level="medium";
    message="La lecture semble exploitable, mais certains mots peuvent être incertains. Vérifiez les informations importantes.";
  }
  return {level,message,length,words,ocrConfidence};
}

function buildVerificationList(text, dates, amounts, actions){
  const t=String(text||"").toLowerCase();
  const checks=[];
  if(amounts?.length || /(payer|montant|prix|total|facture|somme)/.test(t))
    checks.push("Vérifiez le montant exact et la devise sur le document original.");
  if(dates?.length || /(échéance|avant le|date limite|rendez-vous)/.test(t))
    checks.push("Vérifiez la date et assurez-vous qu’il s’agit bien de l’échéance ou de la date attendue.");
  if(actions?.length || /(répondre|envoyer|signer|payer|contacter|joindre)/.test(t))
    checks.push("Vérifiez l’action demandée avant de répondre, signer ou envoyer un document.");
  if(/(iban|rib|compte bancaire|carte|coordonnées bancaires|prélèvement)/.test(t))
    checks.push("Vérifiez soigneusement les coordonnées bancaires avant tout paiement.");
  if(/(mot de passe|code|identifiant|numéro de sécurité|confidentiel)/.test(t))
    checks.push("Ne partagez pas de code, mot de passe ou information confidentielle sans vérifier le destinataire.");
  if(/(ordonnance|prescription|médicament|traitement)/.test(t))
    checks.push("Pour une information de santé, vérifiez toujours l’original et demandez confirmation à un professionnel si nécessaire.");
  if(!checks.length)
    checks.push("Vérifiez les informations importantes sur le document original avant d’agir.");
  return [...new Set(checks)];
}
function renderVerificationList(text,dates,amounts,actions){
  const list=$("checkList");
  if(!list) return;
  const checks=buildVerificationList(text,dates,amounts,actions);
  list.innerHTML=checks.map(x=>`<li>${escapeHTML(x)}</li>`).join("");
  $("readChecks")?.setAttribute("data-checks",checks.join(" "));
}
function buildInterpretation(text, dates, amounts, actions){
  const t=String(text||"").toLowerCase();
  let type="courrier";
  const rules=[
    ["facture",/(facture|à payer|montant dû|total ttc|échéance)/],
    ["assurance",/(assurance|assuré|sinistre|prime|contrat d’assurance)/],
    ["contrat",/(contrat|conditions générales|résiliation|engagement)/],
    ["banque",/(relevé bancaire|iban|virement|prélèvement|solde|compte bancaire)/],
    ["impôts / administration",/(impôt|taxe|déclaration|administration|service public|avis d’imposition)/],
    ["santé",/(ordonnance|prescription|médecin|patient|pharmacie|traitement)/],
    ["lettre / courrier",/(madame|monsieur|objet\s*:|cordialement|lettre)/]
  ];
  for(const [name,rx] of rules){ if(rx.test(t)){ type=name; break; } }

  const paymentWords=/(à payer|reste à payer|montant dû|total à régler|payer avant|règlement)/;
  const paidWords=/(déjà payé|payé le|paiement reçu|acquitté|réglé le)/;
  const payContext=paymentWords.test(t);
  const paidContext=paidWords.test(t);

  let amountMeaning="Montant détecté, contexte à vérifier.";
  if(payContext) amountMeaning="Un montant semble correspondre à une somme à payer.";
  else if(paidContext) amountMeaning="Un montant semble correspondre à une somme déjà payée.";

  let dateMeaning="Date détectée, contexte à vérifier.";
  if(/(avant le|au plus tard|échéance|date limite|à régler avant)/.test(t))
    dateMeaning="Une date semble correspondre à une échéance ou une date limite.";
  else if(/(du|le|en date du|émis le|daté du)/.test(t))
    dateMeaning="Une date semble être une date du document, pas forcément une échéance.";

  const confidenceParts=[];
  if(type!=="courrier") confidenceParts.push("type");
  if(amounts?.length) confidenceParts.push("montant");
  if(dates?.length) confidenceParts.push("date");
  if(actions?.length) confidenceParts.push("action");

  return {
    type,
    summary:`Ce document ressemble à ${type}. ${confidenceParts.length?`PaperPilot a repéré ${confidenceParts.length} catégorie(s) d’information utile.`:"Peu d’éléments structurés ont été détectés."}`,
    amountMeaning,
    dateMeaning,
    caution:"Les catégories et associations sont automatiques. Vérifiez toujours le document original avant toute décision ou paiement."
  };
}
function confidenceMessage(text,dates,amounts,actions){
  let score=0;
  if(text.length>80) score++;
  if(dates.length) score++;
  if(amounts.length) score++;
  if(actions.length) score++;
  if(score>=3) return "Plusieurs éléments ont été détectés. Vérifiez néanmoins les informations sur le document original.";
  if(score===2) return "Quelques éléments ont été détectés, mais la lecture automatique reste partielle. Vérifiez le document original.";
  return "La lecture automatique est limitée. Vérifiez attentivement le document original.";
}
async function analyze(file){showScreen("loading");setProgress(8,"Préparation de la lecture…");try{if(!window.Tesseract)throw new Error("Le moteur OCR n’a pas pu être chargé. Vérifiez votre connexion internet.");const result=await Tesseract.recognize(file,"fra+eng",{logger:m=>{if(m.status==="recognizing text")setProgress(10+Math.round((m.progress||0)*75),"Lecture du document…")}});setProgress(90,"Compréhension des éléments importants…");const text=(result.data.text||"").trim();if(!text)throw new Error("Aucun texte lisible n’a été détecté. Essayez une photo plus nette et bien éclairée.");const type=detectType(text),dates=extractDates(text),amountInfo=classifyAmounts(text),amounts=[...new Set([...amountInfo.pay,...amountInfo.other])],actions=detectActions(text),importantDates=findImportantDates(text);
const important=[];
if(importantDates.length) important.push("Une date semble liée à une échéance ou à une action : "+importantDates[0].date+".");
if(amountInfo.pay.length) important.push("Un montant semble correspondre à une somme à payer : "+amountInfo.pay[0]+".");
important.push(actions[0]);
lastResult={id:Date.now(),title:type,plain:plainSummary(type,dates,amounts,actions),type,dates,amounts,amountsToPay:amountInfo.pay,actions,important,text};
$("resultTitle").textContent=type;$("resultTitle").setAttribute("tabindex","-1");$("plainSummary").textContent=lastResult.plain;$("confidenceText").textContent=confidenceMessage(text,dates,amounts,actions);
const ocrConfidence = (typeof data !== "undefined" && data?.confidence!=null) ? Number(data.confidence) : null;
const ocrQuality=assessOCRQuality(text,ocrConfidence);
$("ocrQualityText").textContent=ocrQuality.message;
$("ocrQualityCard").dataset.level=ocrQuality.level;
if(ocrQuality.level==="low") $("ocrQualityCard").classList.add("ocrWarning");
else $("ocrQualityCard").classList.remove("ocrWarning");

const interpretation=buildInterpretation(text,dates,amounts,actions);
$("interpretationSummary").textContent=interpretation.summary;
$("interpretationDetails").innerHTML=`<p><strong>🧾 Type :</strong> ${escapeHTML(interpretation.type)}</p><p><strong>💶 Montants :</strong> ${escapeHTML(interpretation.amountMeaning)}</p><p><strong>📅 Dates :</strong> ${escapeHTML(interpretation.dateMeaning)}</p>`;
$("verificationNotice").textContent="⚠️ "+interpretation.caution;
renderVerificationList(text,dates,amounts,actions);
updateDeadlineCard();$("reminderStatus").textContent="";
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
function deleteLocalData(){localStorage.removeItem("paperpilot-docs");alert("Les documents et résultats locaux ont été supprimés.");renderSaved();}

function loadReminders(){
  try { return JSON.parse(localStorage.getItem("paperpilot-reminders") || "[]"); }
  catch(e){ return []; }
}
function saveReminders(reminders){
  localStorage.setItem("paperpilot-reminders", JSON.stringify(reminders));
}
function reminderDateLabel(dateText){
  const d=new Date(dateText+"T09:00:00");
  if(Number.isNaN(d.getTime())) return dateText;
  return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
}
function nextDetectedDate(){
  const dates=(lastResult?.dates||[]).map(String);
  const parsed=dates.map(raw=>{
    const m=raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if(!m) return null;
    let y=Number(m[3]); if(y<100)y+=2000;
    const d=new Date(y,Number(m[2])-1,Number(m[1]));
    return {raw,date:d};
  }).filter(x=>x && !Number.isNaN(x.date.getTime()));
  parsed.sort((a,b)=>a.date-b.date);
  return parsed.find(x=>x.date >= new Date(new Date().setHours(0,0,0,0))) || parsed[0] || null;
}
function updateDeadlineCard(){
  const out=$("deadlineText");
  if(!out) return;
  const found=nextDetectedDate();
  if(!found){
    out.textContent="Aucune date d’échéance clairement détectée.";
    return;
  }
  out.textContent=`Date détectée : ${found.raw}. Vérifiez qu’il s’agit bien de l’échéance sur le document original.`;
}
function prepareReminder(){
  const found=nextDetectedDate();
  const status=$("reminderStatus");
  if(!found){
    if(status) status.textContent="Aucune date exploitable n’a été détectée.";
    return;
  }
  const reminders=loadReminders();
  const key=found.date.toISOString().slice(0,10);
  const duplicate=reminders.some(r=>r.date===key && r.label===found.raw);
  if(!duplicate){
    reminders.push({
      id:Date.now(),
      date:key,
      label:found.raw,
      title:lastResult?.type || "Document",
      createdAt:new Date().toISOString()
    });
    reminders.sort((a,b)=>a.date.localeCompare(b.date));
    saveReminders(reminders);
  }
  if(status) status.textContent="Rappel préparé dans PaperPilot. La version actuelle ne peut pas encore déclencher une notification système.";
  renderReminders();
}
function deleteReminder(id){
  const reminders=loadReminders().filter(r=>r.id!==id);
  saveReminders(reminders);
  renderReminders();
}
function renderReminders(){
  const box=$("reminderList");
  if(!box) return;
  const reminders=loadReminders();
  $("reminderCount").textContent=`${reminders.length} rappel${reminders.length>1?"s":""} enregistré${reminders.length>1?"s":""}`;
  if(!reminders.length){
    box.innerHTML='<p>📭 Aucun rappel préparé pour le moment.</p>';
    return;
  }
  box.innerHTML=reminders.map(r=>`<article class="reminderItem">
    <h2>🔔 ${escapeHTML(r.title)}</h2>
    <p><strong>📅 ${escapeHTML(reminderDateLabel(r.date))}</strong></p>
    <p>Date détectée : ${escapeHTML(r.label)}</p>
    <button class="dangerBtn" onclick="deleteReminder(${r.id})">🗑️ Supprimer</button>
  </article>`).join("");
}

function buildDashboardOverview(){
  const docs=loadSavedDocs();
  const reminders=loadReminders();
  const today=new Date().toISOString().slice(0,10);
  const upcoming=reminders.filter(r=>r.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const amounts=docs.flatMap(d=>d.amountsToPay||[]);
  const checks=docs.filter(d=>/vérif|attention|original/i.test((d.plain||"")+" "+(d.explanation||"")));
  return {docs,reminders,upcoming,amounts,checks};
}
function renderDashboardOverview(){
  const box=$("dashboardCards");
  if(!box) return;
  const d=buildDashboardOverview();
  const next=d.upcoming.slice(0,3);
  const recent=d.docs.slice(-3).reverse();
  box.innerHTML=`
    <article class="dashboardTile">
      <h2>📄 Documents</h2>
      <p class="dashboardNumber">${d.docs.length}</p>
      <p>document${d.docs.length>1?"s":""} enregistré${d.docs.length>1?"s":""}</p>
    </article>
    <article class="dashboardTile">
      <h2>📅 Prochaines échéances</h2>
      ${next.length ? `<ul>${next.map(r=>`<li><strong>${escapeHTML(reminderDateLabel(r.date))}</strong> — ${escapeHTML(r.title)}</li>`).join("")}</ul>` : "<p>Aucune échéance préparée.</p>"}
    </article>
    <article class="dashboardTile">
      <h2>💶 Montants à surveiller</h2>
      <p class="dashboardNumber">${d.amounts.length}</p>
      <p>montant${d.amounts.length>1?"s":""} détecté${d.amounts.length>1?"s":""}</p>
    </article>
    <article class="dashboardTile">
      <h2>⚠️ Vérifications</h2>
      <p class="dashboardNumber">${d.checks.length}</p>
      <p>document${d.checks.length>1?"s":""} à vérifier</p>
    </article>
    <article class="dashboardTile dashboardWide">
      <h2>🕘 Documents récents</h2>
      ${recent.length ? `<ul>${recent.map(x=>`<li>${escapeHTML(docLabel(x))}</li>`).join("")}</ul>` : "<p>Aucun document enregistré.</p>"}
    </article>`;
}
function readDashboardOverview(){
  const d=buildDashboardOverview();
  const parts=[
    `Tableau de bord. ${d.docs.length} document${d.docs.length>1?"s":""} enregistré${d.docs.length>1?"s":""}.`,
    d.upcoming.length ? `Prochaine échéance : ${reminderDateLabel(d.upcoming[0].date)}, ${d.upcoming[0].title}.` : "Aucune échéance préparée.",
    d.amounts.length ? `${d.amounts.length} montant${d.amounts.length>1?"s":""} détecté${d.amounts.length>1?"s":""}.` : "Aucun montant à surveiller enregistré.",
    d.checks.length ? `${d.checks.length} document${d.checks.length>1?"s":""} demande${d.checks.length>1?"nt":""} une vérification.` : "Aucun document signalé pour vérification."
  ];
  speak(parts.join(" "));
}

const defaultPreferences={speechRate:0.9,detailLevel:"simple",largeControls:false,reduceMotion:false,showUpcoming:true};
function loadPreferences(){
  try{return {...defaultPreferences,...JSON.parse(localStorage.getItem("paperpilot-preferences")||"{}")};}
  catch(e){return {...defaultPreferences};}
}
function savePreferences(prefs){
  localStorage.setItem("paperpilot-preferences",JSON.stringify(prefs));
}
function applyPreferences(){
  const prefs=loadPreferences();
  speechRate=Number(prefs.speechRate)||0.9;
  document.documentElement.classList.toggle("large-controls",!!prefs.largeControls);
  document.documentElement.classList.toggle("reduce-motion",!!prefs.reduceMotion);
}
function initPreferences(){
  const prefs=loadPreferences();
  const rate=$("prefSpeechRate");
  const rateValue=$("prefSpeechRateValue");
  const detail=$("detailLevel");
  const large=$("largeControls");
  const reduce=$("reduceMotion");
  const upcoming=$("showUpcoming");
  if(rate){rate.value=prefs.speechRate;rate.oninput=()=>{speechRate=Number(rate.value);rateValue.textContent=speechRate.toFixed(1).replace(".",",")+"×";savePreferences({...loadPreferences(),speechRate});};}
  if(rateValue) rateValue.textContent=Number(prefs.speechRate).toFixed(1).replace(".",",")+"×";
  if(detail){detail.value=prefs.detailLevel;detail.onchange=()=>savePreferences({...loadPreferences(),detailLevel:detail.value});}
  if(large){large.checked=!!prefs.largeControls;large.onchange=()=>{const p={...loadPreferences(),largeControls:large.checked};savePreferences(p);applyPreferences();};}
  if(reduce){reduce.checked=!!prefs.reduceMotion;reduce.onchange=()=>{const p={...loadPreferences(),reduceMotion:reduce.checked};savePreferences(p);applyPreferences();};}
  if(upcoming){upcoming.checked=!!prefs.showUpcoming;upcoming.onchange=()=>savePreferences({...loadPreferences(),showUpcoming:upcoming.checked});}
}

function getDocumentCategory(doc){
  const raw=((doc.type||"")+" "+(doc.text||"")+" "+(doc.plain||"")).toLowerCase();
  if(/facture|à payer|montant dû|total ttc/.test(raw)) return "facture";
  if(/assurance|assuré|sinistre|prime d’assurance/.test(raw)) return "assurance";
  if(/contrat|conditions générales|résiliation/.test(raw)) return "contrat";
  if(/iban|rib|relevé bancaire|virement|prélèvement|compte bancaire/.test(raw)) return "banque";
  if(/ordonnance|prescription|médecin|patient|pharmacie|traitement/.test(raw)) return "sante";
  if(/impôt|taxe|déclaration|administration|avis d’imposition/.test(raw)) return "administration";
  if(/madame|monsieur|objet\s*:|cordialement|lettre/.test(raw)) return "courrier";
  return "autre";
}
function categoryLabel(cat){
  return ({
    facture:"Facture",assurance:"Assurance",contrat:"Contrat",banque:"Banque",
    sante:"Santé",administration:"Administration",courrier:"Courrier",autre:"Autre"
  })[cat] || "Autre";
}

function resetMultiPage(){ multiPageFiles=[]; renderMultiPageQueue(); }
function renderMultiPageQueue(){
  const list=$("pageQueue"), status=$("multiPageStatus");
  if(!list)return;
  list.innerHTML=multiPageFiles.map((f,i)=>`<li><span><strong>Page ${i+1}</strong> — ${escapeHTML(f.name||"photo")}</span><button class="dangerBtn" onclick="removeMultiPage(${i})" aria-label="Supprimer la page ${i+1}">🗑️</button></li>`).join("");
  if(status)status.textContent=multiPageFiles.length?`${multiPageFiles.length} page${multiPageFiles.length>1?"s":""} ajoutée${multiPageFiles.length>1?"s":""}.`:"Aucune page ajoutée.";
  if($("addPage"))$("addPage").disabled=false;
  if($("analyzePages"))$("analyzePages").disabled=!multiPageFiles.length;
  if($("cancelPages"))$("cancelPages").disabled=!multiPageFiles.length;
}
function removeMultiPage(i){multiPageFiles.splice(i,1);renderMultiPageQueue();}

async function analyzePDF(file){
  if(!file) return;
  const status=$("pdfStatus");
  if(status) status.textContent="Analyse du PDF en cours…";
  showScreen("loading");
  try{
    const text=await extractPDFText(file);
    if(!text.trim()){
      showScreen("home");
      if(status) status.textContent="Ce PDF ne contient pas de texte directement lisible. Une prochaine version pourra ajouter la lecture des PDF scannés.";
      alert("Ce PDF ne contient pas de texte lisible directement. Pour le moment, utilisez des photos des pages.");
      return;
    }
    const dates=typeof detectDates==="function"?detectDates(text):[];
    const amounts=typeof detectAmounts==="function"?detectAmounts(text):[];
    const actions=typeof detectActions==="function"?detectActions(text):[];
    const type=typeof detectType==="function"?detectType(text):"Document";
    lastResult={text,type,dates,amountsToPay:amounts,actions,pageCount:null,pdf:true,plain:`PDF importé. ${dates.length?dates.length+" date(s) détectée(s). ":""}${amounts.length?amounts.length+" montant(s) détecté(s). ":""}Vérifiez toujours les informations importantes sur le document original.`};
    $("resultTitle").textContent=type;
    $("plainSummary").textContent=lastResult.plain;
    if($("confidenceText")) $("confidenceText").textContent="Texte extrait directement du PDF. Vérifiez les informations importantes sur l’original.";
    if(typeof renderVerificationList==="function") renderVerificationList(text,dates,amounts,actions);
    if(typeof updateDeadlineCard==="function") updateDeadlineCard();
    showScreen("result");
  }catch(e){
    showScreen("home");
    if(status) status.textContent="Le PDF n’a pas pu être lu.";
    alert("Impossible de lire ce PDF. Essayez un autre fichier ou utilisez les photos de ses pages.");
  }
}
async function extractPDFText(file){
  if(typeof pdfjsLib==="undefined") throw new Error("PDF.js indisponible");
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    pages.push(`Page ${i}.\n`+content.items.map(x=>x.str||"").join(" "));
  }
  return pages.join("\n\n");
}
function initPDFImport(){
  $("choosePDF")?.addEventListener("click",()=>$("pdfInput")?.click());
  $("pdfInput")?.addEventListener("change",e=>{
    const file=e.target.files?.[0];
    e.target.value="";
    if(file) analyzePDF(file);
  });
}
function initMultiPage(){
  $("startMultiPage")?.addEventListener("click",()=>{resetMultiPage();$("multiPageInput")?.click();});
  $("addPage")?.addEventListener("click",()=>$("multiPageInput")?.click());
  $("cancelPages")?.addEventListener("click",resetMultiPage);
  $("multiPageInput")?.addEventListener("change",e=>{
    [...(e.target.files||[])].forEach(f=>{if(f.type.startsWith("image/"))multiPageFiles.push(f);});
    e.target.value=""; renderMultiPageQueue();
  });
  $("analyzePages")?.addEventListener("click",analyzeMultiPage);
}
async function analyzeMultiPage(){
  if(!multiPageFiles.length||typeof Tesseract==="undefined")return;
  showScreen("loading");
  let combined=[],total=0,count=0;
  try{
    for(let i=0;i<multiPageFiles.length;i++){
      const r=await Tesseract.recognize(multiPageFiles[i],"fra+eng");
      combined.push(`Page ${i+1}.\n${r.data?.text||""}`);
      if(typeof r.data?.confidence==="number"){total+=r.data.confidence;count++;}
    }
    const text=combined.join("\n\n");
    const dates=typeof detectDates==="function"?detectDates(text):[];
    const amounts=typeof detectAmounts==="function"?detectAmounts(text):[];
    const actions=typeof detectActions==="function"?detectActions(text):[];
    const type=typeof detectType==="function"?detectType(text):"Document";
    lastResult={text,type,dates,amountsToPay:amounts,actions,pageCount:multiPageFiles.length,ocrConfidence:count?total/count:null,plain:`Document de ${multiPageFiles.length} pages. Vérifiez toujours les informations importantes sur l’original.`};
    $("resultTitle").textContent=type;$("plainSummary").textContent=lastResult.plain;
    if($("confidenceText"))$("confidenceText").textContent="Document multi-pages analysé. Vérifiez les informations importantes sur les originaux.";
    if(typeof renderVerificationList==="function")renderVerificationList(text,dates,amounts,actions);
    if(typeof updateDeadlineCard==="function")updateDeadlineCard();
    showScreen("result");
  }catch(e){showScreen("home");alert("La lecture multi-pages n’a pas pu être terminée. Essayez avec des photos plus nettes.");}
}
function loadSavedDocs(){
  try { return JSON.parse(localStorage.getItem("paperpilot-docs") || "[]"); }
  catch(e){ return []; }
}
function saveSavedDocs(docs){
  localStorage.setItem("paperpilot-docs", JSON.stringify(docs));
}
function escapeHTML(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
function docLabel(doc){
  return doc.title || doc.type || "Document";
}
function docSummary(doc){
  return doc.plain || doc.explanation || "Aucun résumé disponible.";
}
function openSavedDoc(index){
  const docs=loadSavedDocs();
  const doc=docs[index];
  if(!doc) return;
  lastResult=doc;
  $("resultTitle").textContent=doc.type || "Document";
  $("plainSummary").textContent=docSummary(doc);
  $("confidenceText").textContent="Document enregistré localement. Vérifiez toujours les informations sur l’original.";
  $("result").scrollTop=0;
  showScreen("result");
  $("resultTitle").focus();
}
function deleteSavedDoc(index){
  const docs=loadSavedDocs();
  if(!docs[index]) return;
  if(confirm("Supprimer ce document enregistré sur cet appareil ?")){
    docs.splice(index,1);
    saveSavedDocs(docs);
    renderSaved();
  }
}
function renderSaved(){
  const list=$("savedList");
  if(!list) return;
  const docs=loadSavedDocs();
  const query=($("savedSearch")?.value || "").trim().toLowerCase();
  const category=$("categoryFilter")?.value || "all";
  const filtered=docs.map((doc,index)=>({doc,index})).filter(({doc})=>{
    if(category!=="all" && getDocumentCategory(doc)!==category) return false;
    if(!query) return true;
    const hay=[docLabel(doc),doc.type,docSummary(doc),...(doc.dates||[]),...(doc.amountsToPay||[]),categoryLabel(getDocumentCategory(doc))].join(" ").toLowerCase();
    return hay.includes(query);
  });
  $("savedCount").textContent = `${filtered.length} document${filtered.length>1?"s":""} affiché${filtered.length>1?"s":""} sur ${docs.length}`;
  if(!filtered.length){
    list.innerHTML='<div class="card"><h2>📭 Aucun document</h2><p>Aucun document ne correspond à votre recherche.</p></div>';
    return;
  }
  list.innerHTML=filtered.map(({doc,index})=>{
    const cat=getDocumentCategory(doc);
    const dates=(doc.dates||[]).slice(0,3).map(d=>`<li>📅 ${escapeHTML(d)}</li>`).join("");
    const amounts=(doc.amountsToPay||[]).slice(0,2).map(a=>`<li>💶 ${escapeHTML(a)}</li>`).join("");
    return `<article class="card savedDoc">
      <p class="categoryTag">🏷️ ${escapeHTML(categoryLabel(cat))}</p>
      <h2>${escapeHTML(docLabel(doc))}</h2>
      <p>${escapeHTML(docSummary(doc))}</p>
      ${dates?`<ul>${dates}</ul>`:""}
      ${amounts?`<ul>${amounts}</ul>`:""}
      <div class="savedActions">
        <button class="bigBtn" onclick="openSavedDoc(${index})">📖 Ouvrir</button>
        <button class="outlineBtn" onclick="speak(${JSON.stringify(docSummary(doc))})">🔊 Lire</button>
        <button class="dangerBtn" onclick="deleteSavedDoc(${index})">🗑️ Supprimer</button>
      </div>
    </article>`;
  }).join("");
}
$("clearSaved").onclick=()=>{if(confirm("Supprimer les documents enregistrés sur cet appareil ?"))deleteLocalData();};$("privacyDelete").onclick=()=>{if(confirm("Supprimer toutes les données locales de PaperPilot ?"))deleteLocalData();};
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

initWelcome();

initSpeechControls();

initOCRQualityControls();

initSafetyControls();

initMultiPage();
renderMultiPageQueue();

initPDFImport();


function getShareText(){
  const r=window.lastResult || (typeof lastResult!=="undefined"?lastResult:null);
  if(!r) return "PaperPilot — aucun résultat disponible.";
  const parts=[
    "PaperPilot",
    "",
    "Type : "+(r.type||"Document"),
    r.plain||"",
    r.dates?.length ? "Dates détectées : "+r.dates.join(", ") : "",
    r.amountsToPay?.length ? "Montants détectés : "+r.amountsToPay.join(", ") : "",
    r.actions?.length ? "Actions : "+r.actions.join(" ; ") : "",
    "",
    "À vérifier avant d’agir : vérifiez les informations importantes sur le document original."
  ];
  return parts.filter(Boolean).join("\n");
}
async function sharePaperPilotResult(){
  const text=getShareText();
  const status=$("shareStatus");
  try{
    if(navigator.share){
      await navigator.share({title:"PaperPilot — résultat",text});
      if(status) status.textContent="Résultat partagé.";
      return;
    }
    await navigator.clipboard.writeText(text);
    if(status) status.textContent="Le partage n’est pas disponible ici : le résumé a été copié.";
  }catch(e){
    if(e?.name==="AbortError"){
      if(status) status.textContent="Partage annulé.";
      return;
    }
    if(status) status.textContent="Impossible de partager automatiquement. Essayez « Copier le résumé ».";
  }
}
async function copyPaperPilotResult(){
  const text=getShareText();
  const status=$("shareStatus");
  try{
    await navigator.clipboard.writeText(text);
    if(status) status.textContent="Résumé copié dans le presse-papiers.";
  }catch(e){
    if(status) status.textContent="La copie n’est pas disponible sur cet appareil.";
  }
}
function downloadPaperPilotResult(){
  const text=getShareText();
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="PaperPilot-resume.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  const status=$("shareStatus");
  if(status) status.textContent="Résumé enregistré sur l’appareil.";
}
function initSharing(){
  $("shareResult")?.addEventListener("click",sharePaperPilotResult);
  $("copyResult")?.addEventListener("click",copyPaperPilotResult);
  $("downloadResult")?.addEventListener("click",downloadPaperPilotResult);
}

initSharing();


const PP_REMINDER_TIMERS = new Map();

function getStoredReminders(){
  try { return JSON.parse(localStorage.getItem("paperpilot_reminders")||"[]"); }
  catch(e){ return []; }
}
function setStoredReminders(list){
  localStorage.setItem("paperpilot_reminders", JSON.stringify(list));
}
function notificationSupported(){
  return "Notification" in window;
}
async function enablePaperPilotNotifications(){
  const status=$("notificationStatus");
  if(!notificationSupported()){
    if(status) status.textContent="Les notifications ne sont pas disponibles dans ce navigateur.";
    return false;
  }
  try{
    const permission=await Notification.requestPermission();
    if(permission==="granted"){
      if(status) status.textContent="Notifications autorisées sur cet appareil.";
      scheduleAllReminderNotifications();
      return true;
    }
    if(status) status.textContent="Notifications non autorisées. Vos rappels restent visibles dans « Mes rappels ».";
  }catch(e){
    if(status) status.textContent="Impossible d’activer les notifications ici.";
  }
  return false;
}
function fireReminderNotification(reminder){
  if(!notificationSupported() || Notification.permission!=="granted") return;
  const title="PaperPilot — rappel";
  const body=reminder.text || "Vous avez un rappel PaperPilot.";
  try{
    new Notification(title,{body,tag:"paperpilot-"+reminder.id});
  }catch(e){}
}
function scheduleReminderNotification(reminder){
  if(!reminder || !reminder.id || !reminder.when) return;
  const when=new Date(reminder.when).getTime();
  const delay=when-Date.now();
  if(delay<=0) return;
  if(PP_REMINDER_TIMERS.has(reminder.id)) clearTimeout(PP_REMINDER_TIMERS.get(reminder.id));
  if(delay > 2147483647) return;
  const timer=setTimeout(()=>{
    fireReminderNotification(reminder);
    PP_REMINDER_TIMERS.delete(reminder.id);
  },delay);
  PP_REMINDER_TIMERS.set(reminder.id,timer);
}
function scheduleAllReminderNotifications(){
  if(!notificationSupported() || Notification.permission!=="granted") return;
  getStoredReminders().forEach(scheduleReminderNotification);
}
function addPaperPilotReminder(text, when){
  const list=getStoredReminders();
  const reminder={id:"r"+Date.now(),text,when,createdAt:new Date().toISOString()};
  list.push(reminder);
  setStoredReminders(list);
  scheduleReminderNotification(reminder);
  return reminder;
}
function deletePaperPilotReminder(id){
  const timer=PP_REMINDER_TIMERS.get(id);
  if(timer) clearTimeout(timer);
  PP_REMINDER_TIMERS.delete(id);
  setStoredReminders(getStoredReminders().filter(r=>r.id!==id));
}
async function testPaperPilotNotification(){
  const status=$("notificationStatus");
  if(!notificationSupported()){
    if(status) status.textContent="Les notifications ne sont pas disponibles dans ce navigateur.";
    return;
  }
  if(Notification.permission!=="granted"){
    const ok=await enablePaperPilotNotifications();
    if(!ok) return;
  }
  fireReminderNotification({id:"test",text:"Ceci est un test de notification PaperPilot."});
  if(status) status.textContent="Notification de test envoyée.";
}
function initNotifications(){
  $("enableNotifications")?.addEventListener("click",enablePaperPilotNotifications);
  $("testNotification")?.addEventListener("click",testPaperPilotNotification);
  if(notificationSupported()){
    const status=$("notificationStatus");
    if(status){
      status.textContent=Notification.permission==="granted"
        ?"Notifications déjà autorisées."
        :"Notifications non activées.";
    }
    scheduleAllReminderNotifications();
  }
}

initNotifications();

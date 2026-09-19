const $=id=>document.getElementById(id);
let lastResult=null,lastAnswer="";
let lastFile = null;
const screens=["home","loading","result","saved","reminders","privacy","access"];
function showScreen(name){screens.forEach(s=>$(s).classList.toggle("active",s===name));window.scrollTo({top:0,behavior:"smooth"});if(name==="saved")renderSaved();}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));

$("savedSearch")?.addEventListener("input",renderSaved);
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
  const filtered=docs.map((doc,index)=>({doc,index})).filter(({doc})=>{
    if(!query) return true;
    const hay=[docLabel(doc),doc.type,docSummary(doc),...(doc.dates||[]),...(doc.amountsToPay||[])].join(" ").toLowerCase();
    return hay.includes(query);
  });
  $("savedCount").textContent = `${filtered.length} document${filtered.length>1?"s":""} affiché${filtered.length>1?"s":""} sur ${docs.length}`;
  if(!filtered.length){
    list.innerHTML='<div class="card"><h2>📭 Aucun document</h2><p>Aucun document ne correspond à votre recherche.</p></div>';
    return;
  }
  list.innerHTML=filtered.map(({doc,index})=>{
    const dates=(doc.dates||[]).slice(0,3).map(d=>`<li>📅 ${escapeHTML(d)}</li>`).join("");
    const amounts=(doc.amountsToPay||[]).slice(0,2).map(a=>`<li>💶 ${escapeHTML(a)}</li>`).join("");
    return `<article class="card savedDoc">
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

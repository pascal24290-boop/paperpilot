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
function detectActions(t){const x=t.toLowerCase(),out=[];if(/payer|paiement|règlement|réglée|régler/.test(x))out.push("Vérifier le montant et la date de paiement.");if(/signer|signature/.test(x))out.push("Vérifier les informations avant de signer.");if(/répondre|retourner|envoyer|transmettre|joindre/.test(x))out.push("Vérifier s’il faut répondre ou envoyer un document.");if(/résilier|résiliation|préavis/.test(x))out.push("Vérifier les conditions et le délai de résiliation.");if(/rendez-vous|consultation|convocation/.test(x))out.push("Vérifier la date et l’heure du rendez-vous.");if(!out.length)out.push("Relire les informations importantes et vérifier s’il y a une échéance.");return out}
function plainSummary(type,dates,amounts,actions){let s=`Ce document semble être : ${type.replace(/^.\s/,"")}. `;if(amounts.length)s+=`J’ai repéré ${amounts.length===1?"un montant":"plusieurs montants"}. `;if(dates.length)s+=`J’ai repéré ${dates.length===1?"une date":"plusieurs dates"}. `;s+=actions[0];return s}
function block(title,items){if(!items.length)return`<div class="item"><strong>${title}</strong><span>Aucune information détectée automatiquement.</span></div>`;return`<div class="item"><strong>${title}</strong><ul>${items.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function answerFor(q){const r=lastResult;if(!r)return"Analysez d’abord un document.";if(q==="what")return`Ce document semble être : ${r.type.replace(/^.\s/,"")}. ${r.plain}`;if(q==="todo")return r.actions.join(" ");if(q==="money")return r.amounts.length?`J’ai trouvé : ${r.amounts.join(", ")}. Vérifiez le montant exact sur le document original.`:"Je n’ai pas détecté de montant automatiquement.";if(q==="date")return r.dates.length?`J’ai trouvé ces dates : ${r.dates.join(", ")}. Vérifiez laquelle correspond à l’échéance ou au rendez-vous.`:"Je n’ai pas détecté de date au format habituel.";return""}
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

async function analyze(file){showScreen("loading");setProgress(8,"Préparation de la lecture…");try{if(!window.Tesseract)throw new Error("Le moteur OCR n’a pas pu être chargé. Vérifiez votre connexion internet.");const result=await Tesseract.recognize(file,"fra+eng",{logger:m=>{if(m.status==="recognizing text")setProgress(10+Math.round((m.progress||0)*75),"Lecture du document…")}});setProgress(90,"Compréhension des éléments importants…");const text=(result.data.text||"").trim();if(!text)throw new Error("Aucun texte lisible n’a été détecté. Essayez une photo plus nette et bien éclairée.");const type=detectType(text),dates=extractDates(text),amounts=extractAmounts(text),actions=detectActions(text);lastResult={id:Date.now(),title:type,plain:plainSummary(type,dates,amounts,actions),type,dates,amounts,actions,text};$("resultTitle").textContent=type;$("plainSummary").textContent=lastResult.plain;$("docType").innerHTML=`<strong>Type détecté :</strong> ${escapeHtml(type)}`;$("datesBlock").innerHTML=block("📅 Dates",dates);$("amountsBlock").innerHTML=block("💶 Montants",amounts);$("actionsBlock").innerHTML=block("✅ Actions à vérifier",actions);$("rawText").textContent=text;$("assistantAnswer").textContent="Choisissez une question.";lastAnswer="";setProgress(100,"Terminé.");showScreen("result");if(localStorage.getItem("paperpilot-autoSpeak")==="1")speak(lastResult.plain)}catch(e){alert(e.message||"Une erreur est survenue.");showScreen("home")}}
$("fileInput").addEventListener("change",e=>{const f=e.target.files?.[0];if(f)analyze(f);e.target.value=""});
$("speakResult").onclick=()=>lastResult&&speak(lastResult.plain+" "+lastResult.actions.join(" "));$("stopSpeech").onclick=()=>speechSynthesis.cancel();
$("saveResult").onclick=()=>{if(!lastResult)return;const a=JSON.parse(localStorage.getItem("paperpilot-docs")||"[]");a.unshift(lastResult);localStorage.setItem("paperpilot-docs",JSON.stringify(a.slice(0,30)));alert("Document enregistré sur cet appareil.")};
function renderSaved(){const a=JSON.parse(localStorage.getItem("paperpilot-docs")||"[]"),box=$("savedList");if(!a.length){box.innerHTML='<div class="card"><p>Aucun document enregistré pour le moment.</p></div>';return}box.innerHTML=a.map(d=>`<div class="card"><h2>${escapeHtml(d.type)}</h2><p>${escapeHtml(d.plain)}</p><small>${new Date(d.id).toLocaleString("fr-FR")}</small></div>`).join("")}
$("clearSaved").onclick=()=>{if(confirm("Supprimer les documents enregistrés sur cet appareil ?")){localStorage.removeItem("paperpilot-docs");renderSaved()}};
function setPref(key,value){localStorage.setItem(key,value?"1":"0")}
$("largeText").checked=localStorage.getItem("paperpilot-large")==="1";$("highContrast").checked=localStorage.getItem("paperpilot-contrast")==="1";$("autoSpeak").checked=localStorage.getItem("paperpilot-autoSpeak")==="1";
function applyAccess(){document.body.classList.toggle("largeText",$("largeText").checked);document.body.classList.toggle("highContrast",$("highContrast").checked)}
$("largeText").onchange=()=>{setPref("paperpilot-large",$("largeText").checked);applyAccess()};$("highContrast").onchange=()=>{setPref("paperpilot-contrast",$("highContrast").checked);applyAccess()};$("autoSpeak").onchange=()=>setPref("paperpilot-autoSpeak",$("autoSpeak").checked);applyAccess();

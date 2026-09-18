const $=id=>document.getElementById(id);let data={text:"",dates:[],amounts:[],actions:[],kind:"Document"};
function show(id){["home","loading","result","profile"].forEach(x=>$(x).hidden=x!==id)}
$("camera").onclick=()=>$("file").click();$("gallery").onclick=()=>$("file").click();$("back").onclick=()=>show("home");$("backLoad").onclick=()=>show("home");
$("settings").onclick=()=>show("profile");$("large").onclick=()=>document.documentElement.classList.toggle("largeText");$("contrast").onclick=()=>document.body.classList.toggle("contrast");
$("speakTest").onclick=()=>speak("Bienvenue dans PaperPilot. Votre assistant pour comprendre vos documents.");
$("file").onchange=e=>{if(e.target.files[0])analyze(e.target.files[0])};
async function analyze(file){show("loading");$("bar").style.width="10%";$("status").textContent="Lecture du document…";try{
let r=await Tesseract.recognize(file,"fra+eng",{logger:m=>{if(m.status==="recognizing text"){let n=20+Math.round(m.progress*70);$("bar").style.width=n+"%";$("status").textContent="Reconnaissance du texte : "+n+"%"}}});
data.text=(r.data.text||"").trim();interpret();$("bar").style.width="100%";setTimeout(()=>show("result"),300)
}catch(e){data.text="La lecture a échoué. Essayez une photo nette et bien éclairée.";interpret();show("result")}}
function interpret(){let t=data.text,l=t.toLowerCase();data.dates=[];data.amounts=[];data.actions=[];
let m,re=/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;while((m=re.exec(t)))data.dates.push(m[0]);
re=/\b(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(20\d{2})\b/gi;while((m=re.exec(t)))data.dates.push(m[0]);
re=/\b\d{1,5}(?:[ .]\d{3})*(?:,\d{2})?\s*(?:€|euros?)\b/gi;while((m=re.exec(t)))data.amounts.push(m[0]);
if(/assurance/.test(l))data.kind="Document d’assurance";else if(/facture|montant à payer|total à payer/.test(l))data.kind="Facture";else if(/impôt|impots|fiscal|taxe/.test(l))data.kind="Document fiscal";else if(/contrat/.test(l))data.kind="Contrat";else if(/banque|relevé bancaire/.test(l))data.kind="Document bancaire";else if(/courrier|madame|monsieur/.test(l))data.kind="Courrier";
if(/payer|paiement|régler|regler/.test(l))data.actions.push("Vérifier le montant et la date limite de paiement.");
if(/échéance|echeance|renouvellement|renouvelé|renouvele/.test(l))data.actions.push("Vérifier l’échéance et les conditions de renouvellement.");
if(/signature|signer/.test(l))data.actions.push("Vérifier les informations avant de signer.");
if(/répondre|réponse|reponse|délai|delai/.test(l))data.actions.push("Vérifier s’il faut répondre dans le délai indiqué.");
if(!data.actions.length)data.actions.push("Relire les informations importantes et vérifier les dates détectées.");
$("title").textContent=data.kind;$("kind").textContent=`Ce document ressemble à : ${data.kind}.`;
$("summary").textContent=t?`PaperPilot a reconnu le document. Il contient ${data.dates.length} date(s) et ${data.amounts.length} montant(s). Consultez les rubriques ci-dessous pour les éléments à vérifier.`:"Aucun texte exploitable n’a été reconnu.";
$("dates").innerHTML=data.dates.length?data.dates.map(x=>`<div class="date">📅 ${x}</div>`).join(""):"Aucune date détectée.";
$("amounts").innerHTML=data.amounts.length?data.amounts.map(x=>`<div class="amount">💶 ${x}</div>`).join(""):"Aucun montant détecté.";
$("actions").innerHTML=data.actions.map(x=>`<div class="action">☐ ${x}</div>`).join("");$("raw").textContent=t||"Aucun texte reconnu."}
function speak(s){if("speechSynthesis"in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(s))}}
$("listen").onclick=()=>speak(`${data.kind}. ${$("summary").textContent}. Dates : ${data.dates.join(", ")||"aucune"}. Montants : ${data.amounts.join(", ")||"aucun"}. À vérifier : ${data.actions.join(" ")}`);
$("save").onclick=()=>{localStorage.setItem("paperpilotLast",JSON.stringify(data));$("save").textContent="✓ Enregistré"};
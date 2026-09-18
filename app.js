const screens=[...document.querySelectorAll(".screen")];const nav=[...document.querySelectorAll(".nav-item")];const fileInput=document.getElementById("fileInput");let autoSpeak=false;
function go(id){screens.forEach(s=>s.classList.toggle("active",s.id===id));nav.forEach(n=>n.classList.toggle("active",n.dataset.go===id));window.scrollTo(0,0)}
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
function startAnalysis(){go("analysis");setTimeout(()=>{go("result");if(autoSpeak)speakSummary()},1600)}
["scanBtn","cameraBtn","galleryBtn","fileBtn"].forEach(id=>document.getElementById(id).addEventListener("click",()=>fileInput.click()));
fileInput.addEventListener("change",()=>{if(fileInput.files.length)startAnalysis()});
function speakSummary(){if(!("speechSynthesis"in window)){alert("La lecture vocale n’est pas disponible sur ce navigateur.");return}const text="Il s'agit de votre contrat d'assurance habitation. Il arrive à échéance le quinze octobre deux mille vingt-six et semble être renouvelé automatiquement. Vous devez vérifier le nouveau tarif et les garanties.";speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(text))}
document.getElementById("speakBtn").addEventListener("click",speakSummary);
document.getElementById("saveBtn").addEventListener("click",()=>{localStorage.setItem("paperpilotSaved","1");document.getElementById("saveBtn").textContent="✓ Enregistré";renderDocs()});
function renderDocs(){const el=document.getElementById("documentList");el.innerHTML=localStorage.getItem("paperpilotSaved")?'<div class="doc-row"><span>🏠</span><div><strong>Contrat d’assurance habitation</strong><div class="small">Échéance : 15 octobre 2026</div></div></div>':'<div class="note">Aucun document enregistré pour le moment.</div>'}
renderDocs();
document.getElementById("largeText").addEventListener("click",()=>document.documentElement.classList.toggle("large-text"));
document.getElementById("contrast").addEventListener("click",()=>document.body.classList.toggle("high-contrast"));
document.getElementById("autoSpeak").addEventListener("click",e=>{autoSpeak=!autoSpeak;e.currentTarget.textContent=autoSpeak?"✓ Lecture automatique activée":"🔊 Lecture automatique du résultat"});
document.getElementById("accessibilityBtn").addEventListener("click",()=>go("profile"));

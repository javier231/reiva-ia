const $=id=>document.getElementById(id);
const messages=$("messages"), promptBox=$("prompt"), welcome=$("welcome");
let history=[], selectedImage=null, busy=false;
function addMessage(role,text,imageUrl){
  const el=document.createElement("div"); el.className="message "+role;
  if(imageUrl){const im=document.createElement("img");im.src=imageUrl;el.appendChild(im);}
  const span=document.createElement("span");span.textContent=text;el.appendChild(span);
  messages.appendChild(el); $("chat").scrollTop=$("chat").scrollHeight; return el;
}
function showChat(){welcome.classList.add("hidden");}
function reset(){history=[];messages.innerHTML="";welcome.classList.remove("hidden");$("status").textContent="";selectedImage=null;$("preview").classList.add("hidden");}
$("newChat").onclick=reset;
document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>{promptBox.value=b.textContent;promptBox.focus();});
$("imageInput").onchange=async e=>{
  const file=e.target.files[0]; if(!file)return;
  if(!file.type.startsWith("image/"))return;
  if(file.size>5*1024*1024){alert("La imagen debe pesar menos de 5 MB.");e.target.value="";return;}
  selectedImage=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  $("preview").innerHTML=`<img src="${selectedImage}" alt="Imagen adjunta"><button type="button" id="removeImage">Quitar</button>`;
  $("preview").classList.remove("hidden");$("removeImage").onclick=()=>{selectedImage=null;$("preview").classList.add("hidden");$("imageInput").value="";};
};
$("composer").onsubmit=async e=>{
  e.preventDefault(); if(busy)return;
  const text=promptBox.value.trim(); if(!text&&!selectedImage)return;
  const image=selectedImage; showChat(); addMessage("user",text||"Analiza esta imagen.",image);
  history.push({role:"user",content:text||"Analiza esta imagen.",image});
  promptBox.value="";promptBox.style.height="auto";selectedImage=null;$("preview").classList.add("hidden");$("imageInput").value="";
  busy=true;$("send").disabled=true;$("status").textContent="REIVA IA está pensando…";
  const typing=addMessage("assistant","Estoy preparando tu respuesta…");
  try{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:history.slice(-16).map(m=>({role:m.role,content:m.content,image:m.image||undefined}))})});
    const data=await res.json(); if(!res.ok)throw new Error(data.error||"No se pudo obtener respuesta.");
    typing.querySelector("span").textContent=data.reply||"No recibí texto de respuesta.";
    history.push({role:"assistant",content:data.reply||""});
  }catch(err){typing.querySelector("span").textContent="No pude conectarme: "+err.message+"\nRevisa tu conexión o la configuración de REIVA IA.";}
  finally{busy=false;$("send").disabled=false;$("status").textContent="";$("chat").scrollTop=$("chat").scrollHeight;}
};
promptBox.addEventListener("input",()=>{promptBox.style.height="auto";promptBox.style.height=Math.min(promptBox.scrollHeight,130)+"px";});
promptBox.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit();}});
async function checkSession(){
  try{const r=await fetch("/api/session");const d=await r.json();if(d.authRequired&&!d.authenticated){$("login").classList.remove("hidden");$("chat").classList.add("hidden");$("composer").classList.add("hidden");}}
  catch(e){$("status").textContent="No se pudo verificar la conexión.";}
}
$("loginForm").onsubmit=async e=>{
  e.preventDefault();$("loginError").textContent="";
  try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:$("password").value})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo iniciar sesión.");$("login").classList.add("hidden");$("chat").classList.remove("hidden");$("composer").classList.remove("hidden");}
  catch(err){$("loginError").textContent=err.message;}
};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
checkSession();
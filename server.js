const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

if (!API_KEY) console.warn("Falta configurar OPENAI_API_KEY.");
if (!APP_PASSWORD) console.warn("Falta configurar APP_PASSWORD. Configúrala antes de publicar.");

app.set("trust proxy", 1);
app.use(express.json({ limit: "8mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "cambia-este-secreto-antes-de-publicar",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*60*60*1000 }
}));
const loginLimiter = rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false});
const apiLimiter = rateLimit({windowMs:60*1000,limit:20,standardHeaders:true,legacyHeaders:false});
function auth(req,res,next){if(!APP_PASSWORD || req.session.authenticated)return next();return res.status(401).json({error:"Inicia sesión para usar REIVA IA."});}

app.post("/api/login",loginLimiter,(req,res)=>{
  if(!APP_PASSWORD)return res.status(503).json({error:"El acceso aún no está configurado."});
  if(req.body.password!==APP_PASSWORD)return res.status(401).json({error:"Contraseña incorrecta."});
  req.session.authenticated=true;res.json({ok:true});
});
app.get("/api/session",(req,res)=>res.json({authRequired:!!APP_PASSWORD,authenticated:!!req.session.authenticated}));
app.post("/api/chat",auth,apiLimiter,async(req,res)=>{
  try{
    if(!API_KEY)return res.status(503).json({error:"Falta configurar la clave de OpenAI en el servidor."});
    const msgs=Array.isArray(req.body.messages)?req.body.messages.slice(-16):[];
    if(!msgs.length)return res.status(400).json({error:"Escribe una pregunta."});
    const input=msgs.map(m=>{
      const content=[];
      if(m.content)content.push({type:"input_text",text:String(m.content).slice(0,12000)});
      if(m.image && m.role==="user" && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(m.image))
        content.push({type:"input_image",image_url:m.image,detail:"auto"});
      return {role:m.role==="assistant"?"assistant":"user",content:content.length?content:[{type:"input_text",text:"Continúa la conversación."}]};
    });
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{"Authorization":`Bearer ${API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        instructions:"Eres REIVA IA, un asistente personal útil, claro, amable y honesto. Responde en español salvo que el usuario pida otro idioma. Ayuda con temas generales, escritura, aprendizaje, tecnología, cálculos y análisis de imágenes. Si no sabes algo, dilo. No inventes datos. Cuando la pregunta requiera información reciente, usa la herramienta de búsqueda web.",
        tools:[{type:"web_search"}],
        input
      })
    });
    const data=await response.json();
    if(!response.ok){console.error("OpenAI API error:",data);return res.status(response.status).json({error:data.error?.message||"Error del servicio de inteligencia artificial."});}
    const reply=(data.output||[]).flatMap(item=>item.content||[]).filter(c=>c.type==="output_text").map(c=>c.text).join("\n").trim();
    res.json({reply:reply||"No pude generar una respuesta. Intenta de nuevo."});
  }catch(err){console.error(err);res.status(500).json({error:"Error interno. Intenta nuevamente."});}
});
app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`REIVA IA escuchando en puerto ${PORT}`));
const $ = (s) => document.querySelector(s);
const grid = $("#grid"), empty = $("#empty"), chipsEl = $("#chips");
let categoriaAtiva = "Todos";
let galFotos = [], galIdx = 0, galBoneco = null, galI = 0;
let galRatio = 1;
let listaAtual = [];   // índices (em BONECOS) na ordem exibida, para navegar entre bonecos
const ratioCache = {};   // proporção (largura/altura) já conhecida de cada foto

const PALETAS = [["#ff4d8d","#7c5cff"],["#ffb627","#ff4d8d"],["#35e0c2","#7c5cff"],["#7c5cff","#35e0c2"]];

function esc(t){ const d=document.createElement("div"); d.textContent=t??""; return d.innerHTML; }
function fmtData(d){ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}); }
function ehNovo(b){ const d=(Date.now()-new Date(b.data+"T12:00:00"))/864e5; return d>=-1 && d<=14; }
function slugN(b){ return (b.nome||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function fmtHoras(h){ const hh=Math.floor(h), mm=Math.round((h-hh)*60); return mm? `${hh}h${String(mm).padStart(2,"0")}` : `${hh}h`; }

// aceita "fotos: [...]" (galeria) ou "foto: '...'" (uma só)
function fotosDe(b){ return b.fotos?.length ? b.fotos : (b.foto ? [b.foto] : []); }

function placeholder(b, i){
  const [a,c] = PALETAS[i % PALETAS.length];
  return `<div class="ph" style="--a:${a};--b:${c}">${esc(b.emoji||"🧸")}</div>`;
}

function imagem(b, i, src){
  const ph = placeholder(b,i);
  if(!src) return ph;
  return `<img src="${esc(src)}" alt="${esc(b.nome)}" loading="lazy" onerror="this.outerHTML=this.dataset.ph" data-ph="${esc(ph)}">`;
}

function render(){
  const q = $("#search").value.trim().toLowerCase();
  let lista = BONECOS.map((b,i)=>({...b,_i:i})).filter(b=>{
    const okCat = categoriaAtiva==="Todos" || b.categoria===categoriaAtiva;
    const texto = [b.nome,b.categoria,b.descricao,...(b.tags||[])].join(" ").toLowerCase();
    return okCat && texto.includes(q);
  });
  const ord = $("#sort").value;
  if(ord==="recent") lista.sort((a,b)=>b.data.localeCompare(a.data));
  if(ord==="name") lista.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  if(ord==="time") lista.sort((a,b)=>(b.tempo||0)-(a.tempo||0));

  listaAtual = lista.map(b=>b._i);
  const rs = $("#resultado");
  if(rs) rs.textContent = (q||categoriaAtiva!=="Todos") ? `${lista.length} de ${BONECOS.length} bonecos` : "";
  grid.innerHTML = lista.map((b,n)=>{
    const fotos = fotosDe(b);
    return `
    <article class="card" data-i="${b._i}" style="--accent:${esc(b.cor||"#7c5cff")};--d:${Math.min(n,12)*45}ms" tabindex="0" role="button" aria-label="Abrir ${esc(b.nome)}">
      <div class="thumb">${imagem(b,b._i,fotos[0])}
        ${ehNovo(b)?`<span class="novo">Novo</span>`:""}
        <span class="badge">${esc(b.categoria)}</span>
        ${fotos.length>1?`<span class="count">📷 ${fotos.length}</span>`:""}
      </div>
      <div class="body">
        <h3>${esc(b.nome)}</h3>
        <div class="meta">
          <span class="pill">${fmtData(b.data)}</span>
          ${b.tempo?`<span class="pill">⏱ ${fmtHoras(b.tempo)}</span>`:""}
        </div>
        <div class="tags">${(b.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div>
      </div>
    </article>`;}).join("");
  empty.hidden = lista.length>0;
}

function chips(){
  const cats = ["Todos",...new Set(BONECOS.map(b=>b.categoria))];
  chipsEl.innerHTML = cats.map(c=>`<button class="chip ${c===categoriaAtiva?"active":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
}

function stats(){
  const horas = BONECOS.reduce((s,b)=>s+(b.tempo||0),0);
  const categorias = new Set(BONECOS.map(b=>b.categoria)).size;
  $("#stats").innerHTML = `
    <div class="stat"><b data-n="${BONECOS.length}">0</b><small>bonecos</small></div>
    <div class="stat"><b data-n="${Math.round(horas)}" data-s="h">0h</b><small>de impressão</small></div>
    <div class="stat"><b data-n="${categorias}">0</b><small>categorias</small></div>`;
  // números sobem até o valor final
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("#stats b").forEach(el=>{
    const alvo=+el.dataset.n, suf=el.dataset.s||"";
    if(reduz||alvo<2){ el.textContent=alvo+suf; return; }
    const t0=performance.now(), dur=900;
    const passo=t=>{ const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3); el.textContent=Math.round(alvo*e)+suf; if(k<1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  });
}

/* ---------- Galeria (esquerda) + info (direita) ---------- */
function renderGaleria(){
  const total = galFotos.length;
  const atual = galFotos[galIdx];
  $("#lbImg").innerHTML = `
    <div class="stage">
      ${imagem(galBoneco,galI,atual)}
      ${total>1?`
        <button class="nav prev" data-dir="-1" aria-label="Foto anterior">‹</button>
        <button class="nav next" data-dir="1" aria-label="Próxima foto">›</button>
        <span class="counter">${galIdx+1} / ${total}</span>`:""}
    </div>
    ${total>1?`<div class="thumbs">${galFotos.map((f,k)=>`
      <button class="th ${k===galIdx?"on":""}" data-k="${k}" aria-label="Foto ${k+1}">
        <img src="${esc(f)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      </button>`).join("")}</div>`:""}`;

  // tamanho provisório (usa a proporção já conhecida da foto, se houver)
  galRatio = ratioCache[atual] || galRatio || 1;
  encaixar(galRatio);
  const im = $("#lbImg .stage img");
  if(im){
    im.loading = "eager";
    const aplicar = ()=>{
      if(!im.naturalWidth) return;
      galRatio = ratioCache[atual] = im.naturalWidth / im.naturalHeight;
      encaixar(galRatio);
    };
    if(im.complete) aplicar(); else im.addEventListener("load",aplicar);
  }
}

// Ajusta a área da foto à proporção dela (horizontal, vertical ou quadrada),
// ocupando o maior espaço possível, sem faixas vazias nas laterais.
function encaixar(ratio){
  const stage = $("#lbImg .stage"); if(!stage) return;
  const mob = innerWidth <= 720;
  const thumbsH = galFotos.length>1 ? 96 : 0;
  const maxW = mob ? innerWidth*0.96 : Math.min(innerWidth*0.96,1500) - 360;
  const maxH = mob ? innerHeight*0.78 : Math.min(innerHeight*0.92,920) - thumbsH;
  let W = maxW, H = W/ratio;
  if(H > maxH){ H = maxH; W = H*ratio; }
  stage.style.width = Math.floor(W)+"px";
  stage.style.height = Math.floor(H)+"px";
  $("#lightbox").dataset.orient = ratio>1.05 ? "horizontal" : (ratio<0.95 ? "vertical" : "quadrada");
}

function mover(d){
  if(galFotos.length<2) return;
  galIdx = (galIdx + d + galFotos.length) % galFotos.length;
  renderGaleria();
}

function abrir(i){
  const b = BONECOS[i];
  galBoneco = b; galI = i; galFotos = fotosDe(b); galIdx = 0;
  renderGaleria();
  $("#lbInfo").innerHTML = `
    <span class="pill" style="align-self:flex-start">${esc(b.categoria)}</span>
    <h2>${esc(b.nome)}</h2>
    <p>${esc(b.descricao||"")}</p>
    <dl>
      ${b.tempo?`<dt>Tempo</dt><dd>${fmtHoras(b.tempo)}</dd>`:""}
      <dt>Impresso em</dt><dd>${fmtData(b.data)}</dd>
    </dl>
    <div class="tags">${(b.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div>
    ${listaAtual.length>1?`<div class="lb-nav">
      <button type="button" data-b="-1" aria-label="Boneco anterior">‹ Anterior</button>
      <span>${Math.max(1,listaAtual.indexOf(i)+1)} / ${listaAtual.length}</span>
      <button type="button" data-b="1" aria-label="Próximo boneco">Próximo ›</button>
    </div>`:""}`;
  $("#lightbox").hidden = false;
  document.body.style.overflow = "hidden";
  try{ history.replaceState(null,"","#"+slugN(b)); }catch(e){}
}
function outroBoneco(d){
  if(listaAtual.length<2) return;
  const pos = listaAtual.indexOf(galI);
  abrir(listaAtual[(pos+d+listaAtual.length)%listaAtual.length]);
}
function fechar(){
  $("#lightbox").hidden = true; document.body.style.overflow = "";
  try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){}
}

grid.addEventListener("click",e=>{ const c=e.target.closest(".card"); if(c) abrir(+c.dataset.i); });
grid.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ const c=e.target.closest(".card"); if(c){ e.preventDefault(); abrir(+c.dataset.i); } }});
chipsEl.addEventListener("click",e=>{ const b=e.target.closest(".chip"); if(!b) return; categoriaAtiva=b.dataset.c; chips(); render(); });
$("#lbInfo").addEventListener("click",e=>{ const n=e.target.closest("[data-b]"); if(n) outroBoneco(+n.dataset.b); });
$("#limpar").addEventListener("click",()=>{ $("#search").value=""; categoriaAtiva="Todos"; chips(); render(); $("#search").focus(); });
$("#lbImg").addEventListener("click",e=>{
  const n=e.target.closest(".nav"); if(n) return mover(+n.dataset.dir);
  const t=e.target.closest(".th"); if(t){ galIdx=+t.dataset.k; renderGaleria(); }
});
$("#search").addEventListener("input",render);
$("#sort").addEventListener("change",render);
$("#lbClose").addEventListener("click",fechar);
$("#lightbox").addEventListener("click",e=>{ if(e.target.id==="lightbox") fechar(); });
document.addEventListener("keydown",e=>{
  if($("#lightbox").hidden) return;
  if(e.key==="Escape") fechar();
  if(e.key==="ArrowLeft") mover(-1);
  if(e.key==="ArrowRight") mover(1);
  if(e.key==="ArrowUp") { e.preventDefault(); outroBoneco(-1); }
  if(e.key==="ArrowDown") { e.preventDefault(); outroBoneco(1); }
});

// swipe no celular
let x0=null;
$("#lbImg").addEventListener("touchstart",e=>{ x0=e.touches[0].clientX; },{passive:true});
$("#lbImg").addEventListener("touchend",e=>{
  if(x0===null) return;
  const dx=e.changedTouches[0].clientX-x0; x0=null;
  if(Math.abs(dx)>40) mover(dx<0?1:-1);
});

window.addEventListener("resize",()=>{ if(!$("#lightbox").hidden) encaixar(galRatio); });

$("#year").textContent = new Date().getFullYear();
stats(); chips(); render();
// link direto para um boneco: site.com/#nome-do-boneco
(function(){ const h=decodeURIComponent(location.hash.slice(1)); if(!h) return;
  const i=BONECOS.findIndex(b=>slugN(b)===h); if(i>=0) abrir(i); })();

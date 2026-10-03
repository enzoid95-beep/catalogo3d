const $ = (s) => document.querySelector(s);
const grid = $("#grid"), empty = $("#empty"), chipsEl = $("#chips");
let categoriaAtiva = "Todos";
let galFotos = [], galIdx = 0, galBoneco = null, galI = 0;

const PALETAS = [["#ff4d8d","#7c5cff"],["#ffb627","#ff4d8d"],["#35e0c2","#7c5cff"],["#7c5cff","#35e0c2"]];

function esc(t){ const d=document.createElement("div"); d.textContent=t??""; return d.innerHTML; }
function fmtData(d){ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}); }
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

  grid.innerHTML = lista.map(b=>{
    const fotos = fotosDe(b);
    return `
    <article class="card" data-i="${b._i}" style="--accent:${esc(b.cor||"#7c5cff")}" tabindex="0" role="button" aria-label="Abrir ${esc(b.nome)}">
      <div class="thumb">${imagem(b,b._i,fotos[0])}
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
    <div class="stat"><b>${BONECOS.length}</b><small>bonecos</small></div>
    <div class="stat"><b>${Math.round(horas)}h</b><small>de impressão</small></div>
    <div class="stat"><b>${categorias}</b><small>categorias</small></div>`;
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
    <div class="tags">${(b.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div>`;
  $("#lightbox").hidden = false;
  document.body.style.overflow = "hidden";
}
function fechar(){ $("#lightbox").hidden = true; document.body.style.overflow = ""; }

grid.addEventListener("click",e=>{ const c=e.target.closest(".card"); if(c) abrir(+c.dataset.i); });
grid.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ const c=e.target.closest(".card"); if(c){ e.preventDefault(); abrir(+c.dataset.i); } }});
chipsEl.addEventListener("click",e=>{ const b=e.target.closest(".chip"); if(!b) return; categoriaAtiva=b.dataset.c; chips(); render(); });
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
});

// swipe no celular
let x0=null;
$("#lbImg").addEventListener("touchstart",e=>{ x0=e.touches[0].clientX; },{passive:true});
$("#lbImg").addEventListener("touchend",e=>{
  if(x0===null) return;
  const dx=e.changedTouches[0].clientX-x0; x0=null;
  if(Math.abs(dx)>40) mover(dx<0?1:-1);
});

$("#year").textContent = new Date().getFullYear();
stats(); chips(); render();

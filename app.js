const $ = s => document.querySelector(s);
const grid = $('#grid'), empty = $('#empty'), chipsEl = $('#chips');
let categoriaAtiva = null;
let galFotos = [], galIdx = 0, galBoneco = null, galI = 0, galRatio = 1;
let listaAtual = [], returnFocus = null;
const ratioCache = new Map();
const pecas = typeof BONECOS !== 'undefined' && Array.isArray(BONECOS) ? BONECOS : [];
function esc(t){ return String(t ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizar(t){ return String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function fmtData(d){ const dt=new Date(d+'T12:00:00'); return Number.isNaN(dt.getTime()) ? 'Data não informada' : dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtHoras(h){ const total=Math.max(0,Math.round((Number(h)||0)*60)), hh=Math.floor(total/60), mm=total%60; return mm ? `${hh}h${String(mm).padStart(2,'0')}` : `${hh}h`; }
function ehNovo(b){ const d=(Date.now()-new Date(b.data+'T12:00:00'))/864e5; return d>=0 && d<=14; }
function slugN(b){ return normalizar(b.nome).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function fotosDe(b){ return Array.isArray(b.fotos) && b.fotos.length ? b.fotos : (b.foto ? [b.foto] : []); }
function capaDe(b){ const c=b.capa||{}; return {ajuste:c.ajuste==='cover'?'cover':'contain',x:Math.min(100,Math.max(0,Number.isFinite(Number(c.x))?Number(c.x):50)),y:Math.min(100,Math.max(0,Number.isFinite(Number(c.y))?Number(c.y):50))}; }
function linkSeguro(s){ try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';} }
function placeholder(b){ return `<div class="ph" aria-label="Peça sem foto">${esc(b.emoji||'🧸')}</div>`; }
function imagem(b,src,cover=false){
  if(!src) return placeholder(b);
  const c=capaDe(b);
  const style=cover?` style="object-fit:${c.ajuste};object-position:${c.x}% ${c.y}%"`:'';
  return `<img src="${esc(src)}" alt="${esc(b.nome)}" loading="lazy"${style}>`;
}
function tratarImagens(container,b){container.querySelectorAll('img').forEach(im=>im.addEventListener('error',()=>{
  if(im.closest('.th')) im.style.visibility='hidden';
  else {const d=document.createElement('div');d.className='ph';d.textContent=b?.emoji||'🧸';d.setAttribute('aria-label','Foto indisponível');im.replaceWith(d);}
},{once:true}));}
function render(){
  const q=normalizar($('#search').value.trim());
  const lista=pecas.map((b,i)=>({...b,_i:i})).filter(b=>{
    const texto=normalizar([b.nome,b.categoria,b.descricao,b.material,b.observacoes,...(Array.isArray(b.tags)?b.tags:[])].join(' '));
    return (categoriaAtiva===null || b.categoria===categoriaAtiva) && texto.includes(q);
  });
  const ord=$('#sort').value;
  if(ord==='recent') lista.sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))||b._i-a._i);
  if(ord==='name') lista.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  if(ord==='time') lista.sort((a,b)=>(Number(b.tempo)||0)-(Number(a.tempo)||0));
  listaAtual=lista.map(b=>b._i);
  $('#resultado').textContent= q||categoriaAtiva!==null ? `${lista.length} de ${pecas.length} peças` : `${pecas.length} ${pecas.length===1?'peça na coleção':'peças na coleção'}`;
  grid.innerHTML=lista.map(b=>{
    const fotos=fotosDe(b);
    return `<article class="card" data-i="${b._i}" tabindex="0" role="button" aria-label="Abrir ${esc(b.nome)}">
      <div class="thumb">${imagem(b,fotos[0],true)}${ehNovo(b)?'<span class="novo">Nova</span>':''}${fotos.length>1?`<span class="count">${fotos.length} fotos</span>`:''}</div>
      <div class="body"><h3>${esc(b.nome)}</h3><span class="piece-category">${esc(b.categoria||'Sem categoria')}</span>
        <div class="meta"><span class="pill">${fmtData(b.data)}</span>${Number(b.tempo)>0?`<span class="pill">⏱ ${fmtHoras(b.tempo)}</span>`:''}</div>
      </div></article>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(card=>tratarImagens(card,pecas[Number(card.dataset.i)]));
  empty.hidden=lista.length>0;
  empty.querySelector('p').textContent=pecas.length?'Nenhuma peça encontrada. Tente outro nome ou categoria.':'A coleção está começando. As peças aparecerão aqui depois do primeiro cadastro.';
}
function chips(){
  const cats=[...new Set(pecas.map(b=>b.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  chipsEl.innerHTML=`<button type="button" class="chip ${categoriaAtiva===null?'active':''}" data-all="true" aria-pressed="${categoriaAtiva===null}">Todas <small>${pecas.length}</small></button>`+cats.map(c=>`<button type="button" class="chip ${c===categoriaAtiva?'active':''}" data-c="${esc(c)}" aria-pressed="${c===categoriaAtiva}">${esc(c)} <small>${pecas.filter(b=>b.categoria===c).length}</small></button>`).join('');
}
function stats(){
  const horas=pecas.reduce((s,b)=>s+Math.max(0,Number(b.tempo)||0),0), categorias=new Set(pecas.map(b=>b.categoria).filter(Boolean)).size;
  $('#stats').innerHTML=`<div class="stat"><b>${pecas.length}</b><small>${pecas.length===1?'peça':'peças'}</small></div><div class="stat"><b>${fmtHoras(horas)}</b><small>de impressão</small></div><div class="stat"><b>${categorias}</b><small>${categorias===1?'categoria':'categorias'}</small></div>`;
}
function renderGaleria(){
  const atual=galFotos[galIdx],total=galFotos.length;
  $('#lbImg').innerHTML=`<div class="stage">${imagem(galBoneco,atual)}${total>1?`<button type="button" class="nav prev" data-dir="-1" aria-label="Foto anterior">‹</button><button type="button" class="nav next" data-dir="1" aria-label="Próxima foto">›</button><span class="counter" aria-live="polite">${galIdx+1} / ${total}</span>`:''}</div>${total>1?`<div class="thumbs">${galFotos.map((f,k)=>`<button type="button" class="th ${k===galIdx?'on':''}" data-k="${k}" aria-label="Foto ${k+1}" aria-pressed="${k===galIdx}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}`;
  tratarImagens($('#lbImg'),galBoneco);
  galRatio=ratioCache.get(atual)||1;encaixar(galRatio);
  const im=$('#lbImg .stage img');
  if(im){
    im.loading='eager';
    const aplicar=()=>{if(!im.isConnected||!im.naturalWidth||galFotos[galIdx]!==atual)return;galRatio=im.naturalWidth/im.naturalHeight;ratioCache.set(atual,galRatio);encaixar(galRatio);};
    if(im.complete)aplicar();else im.addEventListener('load',aplicar,{once:true});
  }
}
function encaixar(ratio){
  const stage=$('#lbImg .stage');if(!stage)return;
  ratio=Number.isFinite(ratio)&&ratio>0?ratio:1;
  const mob=innerWidth<=720,thumbsH=galFotos.length>1?92:0;
  const maxW=Math.max(100,mob?innerWidth*.96-2:Math.min(innerWidth*.96,1500)-362);
  const maxH=Math.max(100,mob?innerHeight*.65:Math.min(innerHeight*.92,920)-thumbsH-2);
  let W=maxW,H=W/ratio;if(H>maxH){H=maxH;W=H*ratio;}
  stage.style.width=Math.floor(W)+'px';stage.style.height=Math.floor(H)+'px';
}
function mover(d){if(galFotos.length<2)return;galIdx=(galIdx+d+galFotos.length)%galFotos.length;renderGaleria();}
function abrir(i){
  const b=pecas[i];if(!b)return;
  if($('#lightbox').hidden)returnFocus=document.activeElement;
  galBoneco=b;galI=i;galFotos=fotosDe(b);galIdx=0;renderGaleria();
  const modelo=linkSeguro(b.modelo), tags=Array.isArray(b.tags)?b.tags:[];
  $('#lbInfo').innerHTML=`<span class="piece-category">${esc(b.categoria||'Sem categoria')}</span><h2 id="pieceTitle">${esc(b.nome)}</h2>${b.descricao?`<p>${esc(b.descricao)}</p>`:''}<dl>${Number(b.tempo)>0?`<dt>Tempo</dt><dd>${fmtHoras(b.tempo)}</dd>`:''}<dt>Impressa em</dt><dd>${fmtData(b.data)}</dd>${b.material?`<dt>Material</dt><dd>${esc(b.material)}</dd>`:''}${Number(b.filamento)>0?`<dt>Filamento</dt><dd>${Number(b.filamento).toLocaleString('pt-BR')} g</dd>`:''}${b.tamanho?`<dt>Tamanho</dt><dd>${esc(b.tamanho)}</dd>`:''}</dl>${b.observacoes?`<h3>Observações da impressão</h3><p>${esc(b.observacoes)}</p>`:''}${modelo?`<a href="${esc(modelo)}" target="_blank" rel="noopener noreferrer">Ver modelo original ↗</a>`:''}${tags.length?`<div class="tags">${tags.map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div>`:''}${listaAtual.length>1?`<div class="lb-nav"><button type="button" data-b="-1" aria-label="Peça anterior">‹ Anterior</button><span>${listaAtual.indexOf(i)+1} / ${listaAtual.length}</span><button type="button" data-b="1" aria-label="Próxima peça">Próxima ›</button></div>`:''}`;
  $('#lightbox').hidden=false;document.body.style.overflow='hidden';$('#lbClose').focus({preventScroll:true});
  try{history.replaceState(null,'','#'+slugN(b));}catch{}
}
function outroBoneco(d){if(listaAtual.length<2)return;const pos=listaAtual.indexOf(galI);abrir(listaAtual[(pos+d+listaAtual.length)%listaAtual.length]);}
function fechar(){ $('#lightbox').hidden=true;document.body.style.overflow='';try{history.replaceState(null,'',location.pathname+location.search);}catch{}if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true}); }
grid.addEventListener('click',e=>{const c=e.target.closest('.card');if(c)abrir(Number(c.dataset.i));});
grid.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const c=e.target.closest('.card');if(c){e.preventDefault();abrir(Number(c.dataset.i));}}});
chipsEl.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;categoriaAtiva=b.dataset.all?null:b.dataset.c;chips();render();const selector=categoriaAtiva===null?'[data-all]':null;const buttons=[...chipsEl.querySelectorAll('button')];(selector?chipsEl.querySelector(selector):buttons.find(x=>x.dataset.c===categoriaAtiva))?.focus({preventScroll:true});});
$('#lbInfo').addEventListener('click',e=>{const n=e.target.closest('[data-b]');if(n)outroBoneco(Number(n.dataset.b));});
$('#limpar').addEventListener('click',()=>{$('#search').value='';categoriaAtiva=null;chips();render();$('#search').focus();});
$('#lbImg').addEventListener('click',e=>{const n=e.target.closest('.nav');if(n)return mover(Number(n.dataset.dir));const t=e.target.closest('.th');if(t){galIdx=Number(t.dataset.k);renderGaleria();$('#lbImg').querySelector(`.th[data-k="${galIdx}"]`)?.focus({preventScroll:true});}});
let searchTimer;$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(render,100);});
$('#sort').addEventListener('change',render);$('#lbClose').addEventListener('click',fechar);$('#lightbox').addEventListener('click',e=>{if(e.target.id==='lightbox')fechar();});
document.addEventListener('keydown',e=>{
  if($('#lightbox').hidden)return;
  if(e.key==='Escape')fechar();
  if(e.key==='Tab'){
    const controls=[...$('#lightbox').querySelectorAll('button,a[href]')].filter(x=>!x.disabled);
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
  if(e.key==='ArrowLeft'){e.preventDefault();mover(-1);}if(e.key==='ArrowRight'){e.preventDefault();mover(1);}
  if(e.key==='ArrowUp'){e.preventDefault();outroBoneco(-1);}if(e.key==='ArrowDown'){e.preventDefault();outroBoneco(1);}
});
let x0=null,y0=null;$('#lbImg').addEventListener('touchstart',e=>{if(e.target.closest('button'))return;x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
$('#lbImg').addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;y0=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))mover(dx<0?1:-1);});
$('#lbImg').addEventListener('touchcancel',()=>{x0=null;y0=null;});
window.addEventListener('resize',()=>{if(!$('#lightbox').hidden)encaixar(galRatio);});
$('#year').textContent=new Date().getFullYear();stats();chips();render();
try{const h=decodeURIComponent(location.hash.slice(1));if(h){const i=pecas.findIndex(b=>slugN(b)===h);if(i>=0)abrir(i);}}catch{}

(function(){
'use strict';
const $=id=>document.getElementById(id),CE=window.CE,types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
let fest=null,items=[],drag=-1,collegeId='';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>{const n=$('carousel-admin-notice');if(n){n.hidden=false;n.textContent=m}};
const key=a=>a.key||('photo:'+a.url);
function storagePath(url){try{const marker='/storage/v1/object/public/'+CE.BUCKET+'/',p=new URL(url).pathname;return p.includes(marker)?decodeURIComponent(p.split(marker)[1]):''}catch(_){return ''}}
function build(f){
 const a=(f.photo_urls||[]).map(url=>({key:'photo:'+url,url,label:'Fest photo'}));
 (f.activities||[]).forEach(x=>{if(x.photo_url)a.push({key:'activity:'+(x.id||x.photo_url),url:x.photo_url,label:x.title||'Activity poster'});});
 const order=f.carousel_order||[],map=new Map(a.map(x=>[x.key,x])),seen=new Set(),ordered=order.map(k=>{if(seen.has(k))return null;seen.add(k);return map.get(k)}).filter(Boolean);
 return ordered.concat(a.filter(x=>!seen.has(x.key)));
}
function render(){
 const root=$('carousel-slides-admin');
 root.innerHTML=items.map((s,i)=>'<article class="fest-carousel-admin-item" draggable="true" data-i="'+i+'"><img src="'+esc(s.url)+'" alt="'+esc(s.label)+'" loading="lazy"><div><strong>'+(i===0?'★ Cover · ':'')+esc(s.label)+'</strong><br><small>Slide '+(i+1)+'</small></div><div class="fest-carousel-admin-controls">'+(i?'<button type="button" data-cover="'+i+'">Set as cover</button>':'<button type="button" data-cover="0" disabled>Cover selected</button>')+'<button type="button" data-up="'+i+'" '+(!i?'disabled':'')+'>↑</button><button type="button" data-down="'+i+'" '+(i===items.length-1?'disabled':'')+'>↓</button><button type="button" data-remove="'+i+'">Remove</button></div></article>').join('')||'<p class="muted">No slides yet. Add fest photos or activity posters.</p>';
 root.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(img.dataset.fallback){img.hidden=true;return}img.dataset.fallback='1';img.src='../assets/images/og-image.png'}));
}
function previewMarkup(){
 if(!items.length)return '<p class="muted">Add at least one slide to preview this carousel.</p>';
 return '<div class="fest-carousel-preview-head"><h3>'+esc(fest.title)+' · Preview</h3><span class="hint">'+items.length+' slide'+(items.length===1?'':'s')+'</span></div><section class="hapn-carousel" data-carousel="admin-preview"><div class="hapn-carousel-frame"><div class="hapn-carousel-track" tabindex="0" aria-label="Preview fest slides">'+items.map((s,i)=>'<figure class="hapn-carousel-slide"><img src="'+esc(s.url)+'" alt="'+esc(s.label)+' '+(i+1)+'" loading="'+(i?'lazy':'eager')+'" decoding="async"><figcaption><span>'+esc(s.label)+'</span></figcaption></figure>').join('')+'</div>'+(items.length>1?'<button class="hapn-carousel-arrow is-prev" data-prev aria-label="Previous slide" disabled>‹</button><button class="hapn-carousel-arrow is-next" data-next aria-label="Next slide">›</button>':'')+'<span class="hapn-carousel-count" aria-live="polite">1/'+items.length+'</span></div>'+(items.length>1?'<div class="hapn-carousel-pagination">'+items.map((_,i)=>'<button type="button" data-dot="'+i+'" aria-label="Go to slide '+(i+1)+'" '+(!i?'aria-current="true"':'')+'></button>').join('')+'</div>':'')+'</section>';
}
function wirePreview(){
 const root=$('carousel-preview'),box=root.querySelector('[data-carousel]');if(!box)return;
 const track=box.querySelector('.hapn-carousel-track'),count=box.querySelector('.hapn-carousel-count'),prev=box.querySelector('[data-prev]'),next=box.querySelector('[data-next]'),dots=[...box.querySelectorAll('[data-dot]')];let index=0;
 const go=n=>track.scrollTo({left:Math.max(0,Math.min(items.length-1,n))*track.clientWidth,behavior:'smooth'});
 const sync=()=>{index=Math.max(0,Math.min(items.length-1,Math.round(track.scrollLeft/(track.clientWidth||1))));count.textContent=(index+1)+'/'+items.length;if(prev)prev.disabled=index===0;if(next)next.disabled=index===items.length-1;dots.forEach((d,i)=>i===index?d.setAttribute('aria-current','true'):d.removeAttribute('aria-current'))};
 track.addEventListener('scroll',sync,{passive:true});prev?.addEventListener('click',()=>go(index-1));next?.addEventListener('click',()=>go(index+1));dots.forEach(d=>d.addEventListener('click',()=>go(+d.dataset.dot)));
 track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(index+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(index-1)}});
 track.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(img.dataset.fallback){img.hidden=true;return}img.dataset.fallback='1';img.src='../assets/images/og-image.png'}));
}
function renderPreview(){const root=$('carousel-preview');if(!root.hidden){root.innerHTML=previewMarkup();wirePreview()}}
function broadcast(patch,updatedAt){window.dispatchEvent(new CustomEvent('hapn:fest-record-updated',{detail:{id:fest.id,patch,updated_at:updatedAt}}))}
async function save(patch){
 const {data,error}=await sb.from('fests').update(patch).eq('id',fest.id).eq('college_id',collegeId).eq('updated_at',fest.updated_at).select('updated_at').maybeSingle();
 if(error)throw error;if(!data)throw new Error('Another admin changed this fest. Refresh before saving to avoid overwriting their changes.');
 fest={...fest,...patch,updated_at:data.updated_at};broadcast(patch,data.updated_at);items=build(fest);render();renderPreview();
}
async function reload(){
 const {data,error}=await sb.from('fests').select('id,title,college_id,photo_urls,activities,carousel_order,updated_at').eq('id',fest.id).eq('college_id',collegeId).single();
 if(error){say(error.message);return}fest={...fest,...data};items=build(fest);render();renderPreview();
}
async function reorder(from,to){
 if(from<0||to<0||from>=items.length||to>=items.length||from===to)return;
 const previous=items,n=[...items],x=n.splice(from,1)[0];n.splice(to,0,x);items=n;render();renderPreview();
 try{await save({carousel_order:items.map(key)});say('Slide order saved.')}
 catch(e){items=previous;say(e.message);await reload()}
}
async function setCover(i){if(i<=0||i>=items.length)return;await reorder(i,0);say('Cover image updated.')}
async function remove(i){
 const s=items[i];if(!s||!confirm('Remove this slide? The activity details will remain.'))return;
 try{
  const n=items.filter((_,x)=>x!==i),patch={carousel_order:n.map(key)};
  if(s.key.startsWith('photo:'))patch.photo_urls=(fest.photo_urls||[]).filter(u=>u!==s.url);
  else patch.activities=(fest.activities||[]).map(a=>a.photo_url&&(a.id||a.photo_url)===s.key.slice(9)?{...a,photo_url:null}:a);
  await save(patch);const path=storagePath(s.url);if(path.startsWith(collegeId+'/')){const {error}=await sb.storage.from(CE.BUCKET).remove([path]);if(error)say('Slide removed from the post; storage cleanup needs retry.');else say('Slide removed.')}
 }catch(e){say(e.message||'Could not remove slide.');await reload()}
}
async function upload(){
 const input=$('carousel-add-files'),files=[...(input.files||[])];if(!files.length){say('Choose images to upload first.');return}
 if(files.length>10||files.some(f=>!types[f.type]||f.size>5242880)){say('Select up to 10 JPG, PNG or WebP images, max 5 MB each.');return}
 const btn=$('carousel-upload');btn.disabled=true;const uploaded=[];
 try{
  for(const f of files){const path=collegeId+'/fests/'+crypto.randomUUID()+'.'+types[f.type],{error}=await sb.storage.from(CE.BUCKET).upload(path,f,{contentType:f.type,cacheControl:'31536000',upsert:false});if(error)throw error;uploaded.push({path,url:sb.storage.from(CE.BUCKET).getPublicUrl(path).data.publicUrl})}
  const photos=[...(fest.photo_urls||[]),...uploaded.map(x=>x.url)],newSlides=uploaded.map(x=>({key:'photo:'+x.url,url:x.url,label:'Fest photo'})),slides=[...items,...newSlides];
  await save({photo_urls:photos,carousel_order:slides.map(key)});say('Uploaded and saved '+uploaded.length+' slide(s).');input.value='';
 }catch(e){const paths=uploaded.map(x=>x.path);if(paths.length)await sb.storage.from(CE.BUCKET).remove(paths);say(e.message||'Upload failed. Uploaded files were cleaned up.');}
 finally{btn.disabled=false}
}
async function start(){
 if(!window.sb||!CE)return;await CE.auth.requireAdmin();collegeId=CE.currentProfile?.college_id||'';const id=new URLSearchParams(location.search).get('id');if(!id||!collegeId){say('Fest ID or assigned college is missing.');return}
 const {data,error}=await sb.from('fests').select('id,title,college_id,photo_urls,activities,carousel_order,updated_at').eq('id',id).eq('college_id',collegeId).single();
 if(error){say(error.message);return}fest=data;items=build(fest);render();
 $('carousel-upload').addEventListener('click',upload);
 $('carousel-preview-toggle').addEventListener('click',()=>{const root=$('carousel-preview'),show=root.hidden;root.hidden=!show;$('carousel-preview-toggle').setAttribute('aria-expanded',String(show));$('carousel-preview-toggle').textContent=show?'Hide preview':'Preview carousel';if(show)renderPreview()});
 const root=$('carousel-slides-admin');
 root.addEventListener('click',e=>{const cover=e.target.closest('[data-cover]'),up=e.target.closest('[data-up]'),down=e.target.closest('[data-down]'),rm=e.target.closest('[data-remove]');if(cover&&!cover.disabled)setCover(+cover.dataset.cover);if(up)reorder(+up.dataset.up,+up.dataset.up-1);if(down)reorder(+down.dataset.down,+down.dataset.down+1);if(rm)remove(+rm.dataset.remove)});
 root.addEventListener('dragstart',e=>{const el=e.target.closest('[data-i]');if(el){drag=+el.dataset.i;el.classList.add('is-dragging')}});
 root.addEventListener('dragover',e=>{if(e.target.closest('[data-i]'))e.preventDefault()});
 root.addEventListener('drop',e=>{const el=e.target.closest('[data-i]');if(el){e.preventDefault();reorder(drag,+el.dataset.i);drag=-1}});
 root.addEventListener('dragend',()=>root.querySelectorAll('.is-dragging').forEach(x=>x.classList.remove('is-dragging')));
 window.addEventListener('hapn:fest-record-updated',e=>{const d=e.detail;if(!d||d.id!==fest.id)return;fest={...fest,...(d.patch||{}),updated_at:d.updated_at||fest.updated_at};items=build(fest);render();renderPreview()});
}
start();
})();
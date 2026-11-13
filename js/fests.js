(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'/assets/images/og-image.png'}catch(_){return '/assets/images/og-image.png'}};
const date=(s,e)=>{if(!s)return 'Date to be announced';const f=x=>new Date(x.slice(0,10)+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});return f(s)+(e&&e!==s?' – '+f(e):'')};
const photos=f=>(Array.isArray(f.photo_urls)?f.photo_urls:[]).filter(Boolean);
function slides(f){
 const all=photos(f).map(url=>({key:'photo:'+url,url,label:'Fest photo'}));
 (Array.isArray(f.activities)?f.activities:[]).forEach(a=>{if(a.photo_url)all.push({key:'activity:'+(a.id||a.photo_url),url:a.photo_url,label:a.title||a.category||'Activity poster'});});
 const order=Array.isArray(f.carousel_order)?f.carousel_order:[],map=new Map(all.map(s=>[s.key,s])),seen=new Set();
 const ordered=order.map(k=>{if(seen.has(k))return null;seen.add(k);return map.get(k)}).filter(Boolean);
 return ordered.concat(all.filter(s=>!seen.has(s.key)));
}
function carousel(f,id,priority){
 const a=slides(f);if(!a.length)return '<p class="muted">Photos and activity posters will be added soon.</p>';
 return '<section class="hapn-carousel" data-carousel="'+esc(id)+'"><div class="hapn-carousel-frame"><div class="hapn-carousel-track" tabindex="0" aria-label="Swipe through '+esc(f.title)+' slides">'+a.map((s,i)=>'<figure class="hapn-carousel-slide"><img src="'+esc(safe(s.url))+'" alt="'+esc(s.label)+' '+(i+1)+' of '+a.length+'" loading="'+(i===0&&priority?'eager':'lazy')+'" decoding="async"'+(i===0&&priority?' fetchpriority="high"':'')+'><figcaption><span>'+esc(s.label)+'</span></figcaption></figure>').join('')+'</div>'+(a.length>1?'<button class="hapn-carousel-arrow is-prev" data-prev aria-label="Previous slide" disabled>‹</button><button class="hapn-carousel-arrow is-next" data-next aria-label="Next slide">›</button>':'')+'<span class="hapn-carousel-count" aria-live="polite">1/'+a.length+'</span></div>'+(a.length>1?'<div class="hapn-carousel-pagination" aria-label="Slide navigation">'+a.map((_,i)=>'<button type="button" data-dot="'+i+'" aria-label="Go to slide '+(i+1)+'" '+(!i?'aria-current="true"':'')+'></button>').join('')+'</div>':'')+'</section>';
}
function wire(root){
 root.querySelectorAll('[data-carousel]').forEach(box=>{
  if(box.dataset.wired)return;box.dataset.wired='1';
  const track=box.querySelector('.hapn-carousel-track'),count=box.querySelector('.hapn-carousel-count'),prev=box.querySelector('[data-prev]'),next=box.querySelector('[data-next]'),dots=[...box.querySelectorAll('[data-dot]')],total=box.querySelectorAll('.hapn-carousel-slide').length;
  let i=0,frame=0;
  const go=n=>{const target=Math.max(0,Math.min(total-1,n));track.scrollTo({left:target*track.clientWidth,behavior:'smooth'});};
  const sync=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;i=Math.max(0,Math.min(total-1,Math.round(track.scrollLeft/(track.clientWidth||1))));count.textContent=(i+1)+'/'+total;if(prev)prev.disabled=i===0;if(next)next.disabled=i===total-1;dots.forEach((d,n)=>n===i?d.setAttribute('aria-current','true'):d.removeAttribute('aria-current'));});};
  track.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(img.dataset.fallback){img.hidden=true;return;}img.dataset.fallback='1';img.src='/assets/images/og-image.png';}));
  track.addEventListener('scroll',sync,{passive:true});
  prev?.addEventListener('click',()=>go(i-1));next?.addEventListener('click',()=>go(i+1));
  dots.forEach(d=>d.addEventListener('click',()=>go(Number(d.dataset.dot))));
  track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(i+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(i-1)}});
  sync();
 });
}
const list=document.getElementById('all-fests'),detail=document.getElementById('fest-detail');
async function listFests(){
 if(!list||!window.sbPublic)return;
 list.innerHTML='<p class="muted">Loading your college fests…</p>';
 await (window.HapnCollegeSelection?.ready||Promise.resolve());
 const collegeId=window.HapnCollegeSelection?.get()||'';
 if(!collegeId){list.innerHTML='<div class="fest-empty"><strong>Select your college to explore its fests.</strong></div>';return;}
 const {data,error}=await sbPublic.from('fests').select('id,title,college_id,college_name,start_date,end_date,photo_urls,activities,carousel_order,description,registration_link').eq('college_id',collegeId).eq('is_published',true).order('start_date',{ascending:true});
 if(error){console.warn('Fests feed:',error.message);list.innerHTML='<div class="fest-empty"><strong>Fests could not be loaded right now.</strong><p>Please try again in a moment.</p></div>';return;}
 if(!data?.length){list.innerHTML='<div class="fest-empty"><strong>No published fests for this college yet.</strong></div>';return;}
 list.classList.add('fest-feed');
 list.innerHTML=data.map((f,index)=>'<article class="fest-feed-post"><header class="fest-feed-header"><span class="fest-feed-avatar" aria-hidden="true">H</span><div><p>'+esc(f.college_name)+'</p><h2>'+esc(f.title)+'</h2><p>'+esc(date(f.start_date,f.end_date))+'</p></div><a href="/fest/?id='+encodeURIComponent(f.id)+'" aria-label="Open '+esc(f.title)+' details">↗</a></header>'+carousel(f,'feed-'+f.id,index===0)+'<div class="fest-feed-body">'+(f.description?'<p>'+esc(f.description)+'</p>':'')+'<div class="fest-feed-actions"><a class="btn btn-primary" href="/fest/?id='+encodeURIComponent(f.id)+'">View fest &amp; activities</a>'+(f.registration_link?'<a class="btn btn-outline" target="_blank" rel="noopener" href="'+esc(safe(f.registration_link))+'">Register</a>':'')+'</div></div></article>').join('');
 wire(list);
}
async function detailFest(){
 if(!detail||!window.sb)return;
 const id=new URLSearchParams(location.search).get('id');if(!id)return;
 await (window.HapnCollegeSelection?.ready||Promise.resolve());
 const selectedCollege=window.HapnCollegeSelection?.get()||'';
 if(!selectedCollege){detail.textContent='Choose your college on the Fests page to view this fest.';return;}
 const {data:f,error}=await sbPublic.from('fests').select('*').eq('id',id).eq('college_id',selectedCollege).eq('is_published',true).maybeSingle();
 if(error||!f){detail.textContent='This fest is not available for your selected college.';return;}
 document.title=f.title+' | Hapn';
 const activities=Array.isArray(f.activities)?f.activities:[];
 const activityHtml=activities.map(a=>'<article class="fest-event">'+(a.photo_url?'<img class="activity-poster" loading="lazy" decoding="async" src="'+esc(safe(a.photo_url))+'" alt="'+esc(a.title)+' poster">':'')+'<h3>'+esc(a.title)+'</h3>'+(a.date?'<p>'+esc(a.date)+' '+esc(a.time||'')+'</p>':'')+(a.venue?'<p>'+esc(a.venue)+'</p>':'')+(a.description?'<p>'+esc(a.description)+'</p>':'')+(a.registration_link?'<a class="btn btn-primary btn-sm" href="'+esc(safe(a.registration_link))+'" target="_blank" rel="noopener">Register</a>':'')+'</article>').join('');
 let linked='';
 if(Array.isArray(f.event_ids)&&f.event_ids.length){
  const {data:events}=await sb.from('events').select('id,title,date,time,venue,category,registration_link').in('id',f.event_ids).eq('is_published',true).order('date');
  if(events&&events.length)linked='<div class="fest-events-grid">'+events.map(e=>'<article class="fest-event"><h3><a href="/event/?id='+encodeURIComponent(e.id)+'">'+esc(e.title)+'</a></h3><p>'+esc([e.date,e.time,e.venue].filter(Boolean).join(' · '))+'</p>'+(e.registration_link?'<a class="btn btn-primary btn-sm" href="'+esc(safe(e.registration_link))+'" target="_blank" rel="noopener">Register</a>':'<a class="btn btn-outline btn-sm" href="/event/?id='+encodeURIComponent(e.id)+'">Details</a>')+'</article>').join('')+'</div>';
 }
 const place=[f.venue,f.college_name].filter(Boolean).join(', ');
 detail.innerHTML='<header class="fest-detail-head"><p class="fest-college">'+esc(f.college_name)+'</p><h1>'+esc(f.title)+'</h1><p>'+esc(date(f.start_date,f.end_date))+'</p>'+(f.description?'<p>'+esc(f.description)+'</p>':'')+'</header>'+carousel(f,'detail-'+f.id,true)+'<div class="fest-action-row">'+(f.registration_link?'<a class="btn btn-primary" href="'+esc(safe(f.registration_link))+'" target="_blank" rel="noopener">Register for the fest</a>':'')+(place?'<a class="btn btn-outline" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place)+'" target="_blank" rel="noopener">Get directions</a>':'')+'</div><section class="section fest-schedule"><h2>Fest activities &amp; events</h2>'+(activityHtml?'<div class="fest-events-grid">'+activityHtml+'</div>':'<p class="muted">Activity schedule will be announced soon.</p>')+linked+'</section>';
 wire(detail);
}
document.addEventListener('hapn:collegechange',()=>{listFests();if(detail)detailFest()});
listFests();detailFest();
})();
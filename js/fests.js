(function () {
 'use strict';
 const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateLabel = (start,end) => { if(!start) return 'Date to be announced'; const f=s=>new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}); return f(start)+(end&&end!==start?' – '+f(end):''); };
 const activityDate = (date,time) => {const d=date?new Date(String(date).slice(0,10)+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';const t=time?String(time).slice(0,5):'';return [d,t].filter(Boolean).join(' · ');};
 const calendarDate = (value) => String(value||'').replace(/-/g,'');
 const calendarUrl = (f) => {if(!f.start_date)return '';const start=calendarDate(f.start_date),end=calendarDate(f.end_date||f.start_date);const nextDay=(iso)=>{const d=new Date(String(iso).slice(0,10)+'T12:00:00');d.setDate(d.getDate()+1);return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')};return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(f.title)+'&dates='+start+'/'+nextDay(f.end_date||f.start_date)+'&details='+encodeURIComponent(f.description||'College fest on Hapn')+'&location='+encodeURIComponent([f.venue,f.college_name].filter(Boolean).join(', '));};
 const directionsUrl = (f) => {const place=[f.venue,f.college_name].filter(Boolean).join(', ');return place?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place):'';};
 const festActions = (f) => '<div class="fest-action-row">'+(f.registration_link?'<a class="btn btn-primary" href="'+esc(f.registration_link)+'" target="_blank" rel="noopener noreferrer">Register for the fest</a>':'')+(directionsUrl(f)?'<a class="btn btn-outline" href="'+esc(directionsUrl(f))+'" target="_blank" rel="noopener noreferrer">Get directions</a>':'')+(calendarUrl(f)?'<a class="btn btn-outline" href="'+esc(calendarUrl(f))+'" target="_blank" rel="noopener noreferrer">Add to calendar</a>':'')+'</div>';
 const listRoot=document.getElementById('all-fests'), detailRoot=document.getElementById('fest-detail');
 async function loadList() {
  if(!listRoot||!window.sb)return;
  const {data,error}=await sb.from('fests').select('id,title,college_name,start_date,end_date,photo_urls').eq('is_published',true).order('start_date',{ascending:true});
  if(error||!data||!data.length){listRoot.innerHTML='<div class="fest-empty"><strong>No published fests yet.</strong><p>Check back soon for verified college fests.</p></div>';return;}
  listRoot.innerHTML=data.map(f=>{const photos=Array.isArray(f.photo_urls)?f.photo_urls:[];return '<article class="fest-card"><a class="fest-card-cover" href="fest.html?id='+encodeURIComponent(f.id)+'"><img loading="lazy" decoding="async" src="'+esc(photos[0]||'assets/images/og-image.png')+'" alt="'+esc(f.title)+'"><span class="fest-photo-count">'+photos.length+' photos</span></a><div class="fest-card-body"><p class="fest-college">'+esc(f.college_name)+'</p><h2><a href="fest.html?id='+encodeURIComponent(f.id)+'">'+esc(f.title)+'</a></h2><p>'+esc(dateLabel(f.start_date,f.end_date))+'</p><a class="btn btn-primary btn-block" href="fest.html?id='+encodeURIComponent(f.id)+'">View fest & events</a></div></article>';}).join('');
 }
 function renderActivity(a,i){
  const meta=activityDate(a.date,a.time);
  return '<article class="fest-event">'+(a.photo_url?'<img class="activity-poster" loading="lazy" decoding="async" src="'+esc(a.photo_url)+'" alt="'+esc(a.title||'Activity poster')+'">':'')+'<div class="activity-card-top"><span class="activity-number">'+String(i+1).padStart(2,'0')+'</span>'+(a.category?'<span class="activity-category">'+esc(a.category)+'</span>':'')+'</div><h3>'+esc(a.title)+'</h3>'+(meta?'<p>'+esc(meta)+'</p>':'')+(a.venue?'<p>'+esc(a.venue)+'</p>':'')+(a.description?'<p class="activity-description">'+esc(a.description)+'</p>':'')+(a.registration_link?'<a class="btn btn-primary btn-sm" href="'+esc(a.registration_link)+'" target="_blank" rel="noopener noreferrer">Register</a>':'')+'</article>';
 }
 async function loadDetail() {
  if(!detailRoot||!window.sb)return;
  const id=new URLSearchParams(location.search).get('id');
  if(!id){detailRoot.innerHTML='<p>Fest link is missing or invalid.</p>';return;}
  const {data:f,error}=await sb.from('fests').select('*').eq('id',id).eq('is_published',true).maybeSingle();
  if(error||!f){detailRoot.innerHTML='<p>This fest is unavailable or has not been published yet.</p>';return;}
  document.title=f.title+' | Hapn';
  const photos=Array.isArray(f.photo_urls)?f.photo_urls:[], activities=Array.isArray(f.activities)?f.activities:[];
  const gallery=photos.length?'<div class="fest-gallery">'+photos.map((url,i)=>'<figure><img src="'+esc(url)+'" alt="'+esc(f.title)+' photo '+(i+1)+'" loading="'+(i===0?'eager':'lazy')+'" decoding="async"><figcaption>Photo '+(i+1)+' of '+photos.length+'</figcaption></figure>').join('')+'</div>':'';
  let linkedEventsHtml='';
  if(Array.isArray(f.event_ids)&&f.event_ids.length){
   const {data:events}=await sb.from('events').select('id,title,poster_url,date,time,venue,category,registration_link').in('id',f.event_ids).eq('is_published',true).order('date');
   if(events&&events.length)linkedEventsHtml='<div class="fest-events-grid">'+events.map(e=>'<article class="fest-event"><div class="activity-card-top">'+(e.category?'<span class="activity-category">'+esc(e.category)+'</span>':'')+'</div><h3><a href="event.html?id='+encodeURIComponent(e.id)+'">'+esc(e.title)+'</a></h3><p>'+esc(activityDate(e.date,e.time))+'</p><p>'+esc(e.venue||'Venue to be announced')+'</p>'+(e.registration_link?'<a class="btn btn-primary btn-sm" href="'+esc(e.registration_link)+'" target="_blank" rel="noopener noreferrer">Register</a>':'<a class="btn btn-outline btn-sm" href="event.html?id='+encodeURIComponent(e.id)+'">Details</a>')+'</article>').join('')+'</div>';
  }
  let schedule='';
  if(activities.length||linkedEventsHtml){
   schedule='<section class="section fest-schedule"><h2>Fest activities & events</h2><p class="muted">All activities are listed here under one college fest.</p>'+(activities.length?'<div class="fest-events-grid">'+activities.map(renderActivity).join('')+'</div>':'')+linkedEventsHtml+'</section>';
  }else{
   schedule='<section class="section fest-schedule"><h2>Fest activities & events</h2><p class="muted">Activity schedule will be announced soon.</p></section>';
  }
  detailRoot.innerHTML='<header class="fest-detail-head"><p class="fest-college">'+esc(f.college_name)+'</p><h1>'+esc(f.title)+'</h1><p>'+esc(dateLabel(f.start_date,f.end_date))+'</p>'+(f.venue?'<p>'+esc(f.venue)+'</p>':'')+(f.description?'<p>'+esc(f.description)+'</p>':'')+'</header>'+gallery+festActions(f)+schedule;
 }
 loadList();loadDetail();
})();
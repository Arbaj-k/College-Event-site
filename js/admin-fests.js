(function(){
'use strict';
const $=id=>document.getElementById(id), CE=window.CE;
const safe=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let events=[];
async function start(){
 const user=await CE.auth.requireAdmin(); if(!user)return;
 const {data,error}=await sb.from('events').select('id,title,date,category,is_published').eq('is_published',true).order('date');
 const wrap=$('event-options');
 if(error)wrap.textContent='Could not load events. You can still create the fest.';
 else {events=data||[];wrap.innerHTML=events.length?events.map(e=>'<label class="check" style="display:flex;margin:.45rem 0"><input type="checkbox" name="fest-event" value="'+safe(e.id)+'"> '+safe(e.title)+' · '+safe(e.date||'Date TBD')+' · '+safe(e.category||'Other')+'</label>').join(''):'No published events yet.';}
 $('photos').addEventListener('change',()=>{const files=Array.from($('photos').files||[]);$('photo-preview').innerHTML=files.slice(0,10).map(f=>'<figure><img alt="" src="'+URL.createObjectURL(f)+'"><figcaption>'+safe(f.name)+'</figcaption></figure>').join('');});
 $('fest-form').addEventListener('submit',submit);
}
async function submit(e){
 e.preventDefault();const files=Array.from($('photos').files||[]),err=$('fest-error'),btn=$('save-fest');err.hidden=true;
 if(files.length<1||files.length>10){CE.showNotice(err,'Choose between 1 and 10 photos.');return;}
 if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){CE.showNotice(err,'Each photo must be JPG, PNG or WebP and no larger than 5 MB.');return;}
 if($('end').value&&$('start').value&&$('end').value<$('start').value){CE.showNotice(err,'The end date cannot be before the start date.');return;}
 btn.disabled=true;btn.textContent='Uploading photos…';const uploaded=[];
 try{
  for(const file of files){
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
   const path='fests/'+crypto.randomUUID()+'.'+ext;
   const {error}=await sb.storage.from(CE.BUCKET).upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});
   if(error)throw error;
   uploaded.push(sb.storage.from(CE.BUCKET).getPublicUrl(path).data.publicUrl);
  }
  const eventIds=Array.from(document.querySelectorAll('input[name="fest-event"]:checked')).map(el=>el.value);
  btn.textContent='Saving fest…';
  const payload={title:$('title').value.trim(),college_name:$('college').value.trim(),description:$('description').value.trim()||null,venue:$('venue').value.trim()||null,start_date:$('start').value||null,end_date:$('end').value||null,photo_urls:uploaded,event_ids:eventIds,is_published:$('publish').checked};
  const {error}=await sb.from('fests').insert(payload);
  if(error)throw error;
  CE.toast('Fest created successfully!');
  setTimeout(()=>location.href='dashboard.html',900);
 }catch(ex){
  console.error(ex);CE.showNotice(err,/row-level security|permission denied/i.test(ex.message||'')?'You do not have permission to create a fest.':(ex.message||'Could not create fest. Check that the fest database migration has been run.'));
  for(const url of uploaded){try{const marker='/storage/v1/object/public/'+CE.BUCKET+'/';const path=decodeURIComponent(url.split(marker)[1]||'');if(path)await sb.storage.from(CE.BUCKET).remove([path]);}catch(_){}}
  btn.disabled=false;btn.textContent='Create Fest';
 }
}
start();
})();
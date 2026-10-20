(function(){
'use strict';
const $=id=>document.getElementById(id), CE=window.CE;
const safe=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let events=[], activityCount=0;
function activityRow(item={}){
 const id=++activityCount;
 const value=(key)=>safe(item[key]||'');
 return '<fieldset class="activity-row" data-activity-row><legend>Activity '+id+'</legend><div class="activity-fields">'+
 '<div class="field"><label>Activity name *</label><input data-activity="title" maxlength="120" placeholder="e.g. Battle of Bands" value="'+value('title')+'"></div>'+
 '<div class="field"><label>Category</label><input data-activity="category" maxlength="60" placeholder="Music / Dance / Gaming" value="'+value('category')+'"></div>'+
 '<div class="field"><label>Date</label><input data-activity="date" type="date" value="'+value('date')+'"></div>'+
 '<div class="field"><label>Time</label><input data-activity="time" type="time" value="'+value('time')+'"></div>'+
 '<div class="field"><label>Venue</label><input data-activity="venue" maxlength="200" placeholder="Stage / Room" value="'+value('venue')+'"></div>'+
 '<div class="field"><label>Registration link (optional)</label><input data-activity="registration_link" type="url" maxlength="1000" placeholder="https://…" value="'+value('registration_link')+'"></div>'+
 '<div class="field full"><label>Short details (optional)</label><textarea data-activity="description" rows="2" maxlength="800" placeholder="Rules, eligibility, prizes, or other details">'+value('description')+'</textarea></div></div>'+
 '<button class="btn btn-danger-outline btn-sm" type="button" data-remove-activity>Remove activity</button></fieldset>';
}
function addActivity(item){const wrap=$('activity-list');if(wrap.querySelectorAll('[data-activity-row]').length>=20){CE.toast('A fest can have up to 20 activities.');return;}wrap.insertAdjacentHTML('beforeend',activityRow(item));renumberActivities();}
function renumberActivities(){Array.from($('activity-list').querySelectorAll('[data-activity-row]')).forEach((row,i)=>{row.querySelector('legend').textContent='Activity '+(i+1);});$('add-activity').disabled=$('activity-list').querySelectorAll('[data-activity-row]').length>=20;}
function collectActivities(){
 const rows=Array.from($('activity-list').querySelectorAll('[data-activity-row]'));
 const activities=[];
 for(const row of rows){
  const item={};row.querySelectorAll('[data-activity]').forEach(el=>item[el.dataset.activity]=el.value.trim());
  if(!item.title&&!item.category&&!item.date&&!item.time&&!item.venue&&!item.registration_link&&!item.description)continue;
  if(!item.title)throw new Error('Har activity ka naam bharna zaroori hai, ya us blank row ko remove karein.');
  if(item.registration_link){let u;try{u=new URL(item.registration_link);}catch(_){throw new Error('Registration link valid URL hona chahiye.');}if(u.protocol!=='https:')throw new Error('Registration link https:// se shuru hona chahiye.');}
  if(item.date&&$('start').value&&item.date<$('start').value){} // Activities may begin before or after the fest's displayed start date.
  activities.push(item);
 }
 return activities;
}
async function start(){
 const user=await CE.auth.requireAdmin();if(!user)return;
 const {data,error}=await sb.from('events').select('id,title,date,category,is_published').eq('is_published',true).order('date');
 const wrap=$('event-options');
 if(error)wrap.textContent='Could not load events. You can still create the fest.';
 else {events=data||[];wrap.innerHTML=events.length?events.map(e=>'<label class="check" style="display:flex;margin:.45rem 0"><input type="checkbox" name="fest-event" value="'+safe(e.id)+'"> '+safe(e.title)+' · '+safe(e.date||'Date TBD')+' · '+safe(e.category||'Other')+'</label>').join(''):'No published events yet.';}
 $('add-activity').addEventListener('click',()=>addActivity());
 $('activity-list').addEventListener('click',e=>{const btn=e.target.closest('[data-remove-activity]');if(btn){btn.closest('[data-activity-row]').remove();renumberActivities();}});
 $('photos').addEventListener('change',()=>{const files=Array.from($('photos').files||[]);$('photo-preview').innerHTML=files.slice(0,10).map(f=>'<figure><img alt="" src="'+URL.createObjectURL(f)+'"><figcaption>'+safe(f.name)+'</figcaption></figure>').join('');});
 $('fest-form').addEventListener('submit',submit);
 addActivity();
}
async function submit(e){
 e.preventDefault();const files=Array.from($('photos').files||[]),err=$('fest-error'),btn=$('save-fest');err.hidden=true;
 if(files.length<1||files.length>10){CE.showNotice(err,'Choose between 1 and 10 photos.');return;}
 if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){CE.showNotice(err,'Each photo must be JPG, PNG or WebP and no larger than 5 MB.');return;}
 if($('end').value&&$('start').value&&$('end').value<$('start').value){CE.showNotice(err,'The end date cannot be before the start date.');return;}
 let activities;try{activities=collectActivities();}catch(ex){CE.showNotice(err,ex.message);return;}
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
  const payload={title:$('title').value.trim(),college_name:$('college').value.trim(),description:$('description').value.trim()||null,venue:$('venue').value.trim()||null,start_date:$('start').value||null,end_date:$('end').value||null,photo_urls:uploaded,activities,event_ids:eventIds,is_published:$('publish').checked};
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
(function(){'use strict';
const $=id=>document.getElementById(id),form=$('submit-form'),other=$('other_category'),posterInput=$('poster');
form.querySelectorAll('input[name="category"]').forEach(x=>x.addEventListener('change',()=>{$('other-wrap').hidden=!form.querySelector('input[name="category"][value="Other"]').checked;}));
posterInput.addEventListener('change',()=>{const f=posterInput.files[0],img=$('poster-preview');if(!f){img.hidden=true;return;}if(f.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type)){img.hidden=true;return;}img.src=URL.createObjectURL(f);img.hidden=false;});
form.addEventListener('submit',async e=>{e.preventDefault();const btn=$('submit-btn'),notice=$('submit-notice'),fd=new FormData(form),file=fd.get('poster');const show=(msg,kind)=>window.CE.showNotice(notice,msg,kind);
const cats=[...form.querySelectorAll('input[name="category"]:checked')].map(x=>x.value);
if(cats.includes('Other')&&other.value.trim())cats[cats.indexOf('Other')]=other.value.trim();
const date=fd.get('date')||null,end=fd.get('end_date')||null;if(end&&date&&end<date){show('To date cannot be before From date.');return;}
const link=String(fd.get('registration_link')||'').trim();if(link&&!/^https:\/\//i.test(link)){show('Registration link must start with https://');return;}
if(file&&file.size&&(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))){show('Poster must be JPG, PNG or WebP and no larger than 5 MB.');return;}
btn.disabled=true;btn.textContent='Submitting…';
try{let poster=null;if(file&&file.size){const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type],path='submissions/'+crypto.randomUUID()+'.'+ext;const up=await sb.storage.from('event-posters').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;poster=sb.storage.from('event-posters').getPublicUrl(path).data.publicUrl;}
const row={title:String(fd.get('title')).trim(),poster_url:poster,date,time:fd.get('time')||null,end_date:end,end_time:fd.get('end_time')||null,venue:String(fd.get('venue')||'').trim()||null,organizer:String(fd.get('organizer')||'').trim()||null,category:cats.join(', ')||null,short_description:String(fd.get('short_description')||'').trim()||null,description:String(fd.get('description')||'').trim()||null,registration_deadline:fd.get('registration_deadline')||null,registration_link:link||null,submitter_name:String(fd.get('submitter_name')).trim(),submitter_email:String(fd.get('submitter_email')).trim(),status:'pending'};
const result=await sb.from('event_submissions').insert(row);if(result.error)throw result.error;form.reset();$('other-wrap').hidden=true;$('poster-preview').hidden=true;show('Submitted successfully! Your event is pending admin review and will not be public until approved.','success');
}catch(err){console.error(err);show(err.message||'Could not submit your event. Please try again.');}finally{btn.disabled=false;btn.textContent='Submit for Review';}});
})();
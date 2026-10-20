(function(){
'use strict';
const $=id=>document.getElementById(id), CE=window.CE;
const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function start(){
 const user=await CE.auth.requireAdmin();if(!user)return;
 $('photos').addEventListener('change',()=>{
  const files=Array.from($('photos').files||[]);
  $('photo-preview').innerHTML=files.slice(0,10).map(f=>'<figure><img alt="" src="'+URL.createObjectURL(f)+'"><figcaption>'+safe(f.name)+'</figcaption></figure>').join('');
 });
 $('fest-form').addEventListener('submit',submit);
 $('existing-fests').addEventListener('click',manageExistingFests);
 await loadExistingFests();
}
async function loadExistingFests(){
 const list=$('existing-fests');list.innerHTML='<p class="muted">Loading fests…</p>';
 const {data,error}=await sb.from('fests').select('id,title,college_name,start_date,end_date,is_published,created_at').order('created_at',{ascending:false});
 if(error){list.innerHTML='<p class="error-text">Could not load fests: '+safe(error.message)+'</p>';return;}
 if(!data||!data.length){list.innerHTML='<p class="muted">No fests created yet.</p>';return;}
 list.innerHTML=data.map(f=>'<article class="activity-manager-item"><div class="activity-manager-copy"><h3>'+safe(f.title)+'</h3><p>'+safe(f.college_name)+' · '+safe(f.start_date||'Date not set')+' · '+(f.is_published?'Published':'Draft')+'</p><div class="form-actions"><a class="btn btn-outline btn-sm" href="manage-fest-activities.html?id='+encodeURIComponent(f.id)+'">Manage activities</a><a class="btn btn-outline btn-sm" href="../fest.html?id='+encodeURIComponent(f.id)+'" target="_blank" rel="noopener">View page</a><button class="btn btn-danger-outline btn-sm" type="button" data-delete-fest="'+safe(f.id)+'" data-title="'+safe(f.title)+'">Delete fest</button></div></div></article>').join('');
}
async function manageExistingFests(e){
 const button=e.target.closest('[data-delete-fest]');if(!button)return;
 const id=button.dataset.deleteFest,title=button.dataset.title||'this fest';
 if(!confirm('Delete "'+title+'" permanently? Its activities will also be deleted, and the fest will disappear from the public website. This cannot be undone.'))return;
 button.disabled=true;button.textContent='Deleting…';
 try{
  const {data,error:readError}=await sb.from('fests').select('photo_urls,activities').eq('id',id).maybeSingle();if(readError)throw readError;
  const {error}=await sb.from('fests').delete().eq('id',id);if(error)throw error;
  const urls=[...(data?.photo_urls||[]),...((data?.activities||[]).map(a=>a.photo_url).filter(Boolean))];
  const marker='/storage/v1/object/public/'+CE.BUCKET+'/';const paths=urls.map(url=>{try{return decodeURIComponent(new URL(url).pathname.split(marker)[1]||'')}catch(_){return ''}}).filter(Boolean);
  if(paths.length){const {error:storageError}=await sb.storage.from(CE.BUCKET).remove(paths);if(storageError)console.warn('Fest deleted but some poster files may remain in storage:',storageError.message);}
  CE.toast('Fest deleted.');await loadExistingFests();
 }catch(ex){console.error(ex);CE.showNotice($('fest-error'),ex.message||'Could not delete fest. Check admin permissions and try again.');button.disabled=false;button.textContent='Delete fest';}
}
async function submit(e){
 e.preventDefault();const files=Array.from($('photos').files||[]),err=$('fest-error'),btn=$('save-fest');err.hidden=true;
 if(files.length<1||files.length>10){CE.showNotice(err,'Choose between 1 and 10 main fest photos.');return;}
 if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){CE.showNotice(err,'Each photo must be JPG, PNG or WebP and no larger than 5 MB.');return;}
 if($('end').value&&$('start').value&&$('end').value<$('start').value){CE.showNotice(err,'The end date cannot be before the start date.');return;}
 const registrationLink=$('registration-link').value.trim();
 if(registrationLink){try{const u=new URL(registrationLink);if(u.protocol!=='https:')throw new Error();}catch(_){CE.showNotice(err,'Main fest registration link must be a valid https:// URL.');return;}}
 btn.disabled=true;const uploaded=[];
 try{
  btn.textContent='Uploading fest photos…';
  for(const file of files){
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path='fests/'+crypto.randomUUID()+'.'+ext;
   const {error}=await sb.storage.from(CE.BUCKET).upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});if(error)throw error;
   uploaded.push(sb.storage.from(CE.BUCKET).getPublicUrl(path).data.publicUrl);
  }
  btn.textContent='Saving fest…';
  const payload={title:$('title').value.trim(),college_name:$('college').value.trim(),description:$('description').value.trim()||null,venue:$('venue').value.trim()||null,registration_link:registrationLink||null,start_date:$('start').value||null,end_date:$('end').value||null,photo_urls:uploaded,activities:[],event_ids:[],is_published:$('publish').checked};
  const {data,error}=await sb.from('fests').insert(payload).select('id').single();if(error)throw error;
  CE.toast('Main fest saved. Now add its activities.');location.href='manage-fest-activities.html?id='+encodeURIComponent(data.id);
 }catch(ex){
  console.error(ex);CE.showNotice(err,/row-level security|permission denied/i.test(ex.message||'')?'You do not have permission to create a fest.':(ex.message||'Could not create fest. Check the database migration and try again.'));
  for(const url of uploaded){try{const marker='/storage/v1/object/public/'+CE.BUCKET+'/';const path=decodeURIComponent(url.split(marker)[1]||'');if(path)await sb.storage.from(CE.BUCKET).remove([path]);}catch(_){}}
  btn.disabled=false;btn.textContent='Save Fest & Continue';
 }
}
start();
})();
(function(){
'use strict';
const $=id=>document.getElementById(id),CE=window.CE;
const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let collegeId='',collegeName='';
function storagePath(url){try{const marker='/storage/v1/object/public/'+CE.BUCKET+'/';const p=new URL(url).pathname;return p.includes(marker)?decodeURIComponent(p.split(marker)[1]):''}catch(_){return ''}}
async function start(){
 const user=await CE.auth.requireAdmin();if(!user)return;
 const profile=CE.currentProfile;
 if(!profile||profile.role!=='college_admin'||!profile.college_id){CE.showNotice($('fest-error'),'Your account is not assigned to an active college. Ask the Super Admin to assign your College Admin profile.');return}
 collegeId=profile.college_id;
 const {data:college,error}=await sb.from('colleges').select('id,name,is_active').eq('id',collegeId).maybeSingle();
 if(error||!college||!college.is_active){CE.showNotice($('fest-error'),'Your assigned college is unavailable. Ask the Super Admin to check your college assignment.');return}
 collegeName=college.name;
 $('photos').addEventListener('change',()=>{const files=Array.from($('photos').files||[]);$('photo-preview').innerHTML=files.slice(0,10).map(f=>'<figure><img alt="" src="'+URL.createObjectURL(f)+'"><figcaption>'+safe(f.name)+'</figcaption></figure>').join('')});
 $('fest-form').addEventListener('submit',submit);$('existing-fests').addEventListener('click',manageExistingFests);await loadExistingFests();
}
async function loadExistingFests(){
 const list=$('existing-fests');list.innerHTML='<p class="muted">Loading fests…</p>';
 const {data,error}=await sb.from('fests').select('id,title,college_name,start_date,end_date,is_published,created_at').eq('college_id',collegeId).order('created_at',{ascending:false});
 if(error){list.innerHTML='<p class="error-text">Could not load fests: '+safe(error.message)+'</p>';return}
 if(!data?.length){list.innerHTML='<p class="muted">No fests created yet.</p>';return}
 list.innerHTML=data.map(f=>'<article class="activity-manager-item"><div class="activity-manager-copy"><h3>'+safe(f.title)+'</h3><p>'+safe(f.college_name)+' · '+safe(f.start_date||'Date not set')+' · '+(f.is_published?'Published':'Draft')+'</p><div class="form-actions"><a class="btn btn-outline btn-sm" href="manage-fest-activities.html?id='+encodeURIComponent(f.id)+'">Manage activities & slides</a><a class="btn btn-outline btn-sm" href="../fest/?id='+encodeURIComponent(f.id)+'" target="_blank" rel="noopener">View page</a><button class="btn btn-danger-outline btn-sm" type="button" data-delete-fest="'+safe(f.id)+'" data-title="'+safe(f.title)+'">Delete fest</button></div></div></article>').join('');
}
async function manageExistingFests(e){
 const button=e.target.closest('[data-delete-fest]');if(!button)return;const id=button.dataset.deleteFest,title=button.dataset.title||'this fest';
 if(!confirm('Delete "'+title+'" permanently? Its activities will also be deleted. This cannot be undone.'))return;
 button.disabled=true;button.textContent='Deleting…';
 try{const {data,error:readError}=await sb.from('fests').select('photo_urls,activities').eq('id',id).eq('college_id',collegeId).maybeSingle();if(readError)throw readError;
 const {data:deleted,error}=await sb.from('fests').delete().eq('id',id).eq('college_id',collegeId).select('id').maybeSingle();if(error)throw error;if(!deleted)throw new Error('Fest was not deleted. Refresh and check your college access.');
 const urls=[...(data?.photo_urls||[]),...((data?.activities||[]).map(a=>a.photo_url).filter(Boolean))],paths=urls.map(storagePath).filter(p=>p.startsWith(collegeId+'/'));
 if(paths.length){const {error:se}=await sb.storage.from(CE.BUCKET).remove(paths);if(se)console.warn('Fest deleted; some old media could not be removed:',se.message)}
 CE.toast('Fest deleted.');await loadExistingFests();
 }catch(ex){console.error(ex);CE.showNotice($('fest-error'),ex.message||'Could not delete fest.');button.disabled=false;button.textContent='Delete fest'}
}
async function submit(e){
 e.preventDefault();const files=Array.from($('photos').files||[]),err=$('fest-error'),btn=$('save-fest');err.hidden=true;
 if(!$('college').value.trim()){CE.showNotice(err,'Enter the college hosting or organising this fest.');return}
 if(!files.length||files.length>10){CE.showNotice(err,'Choose between 1 and 10 fest photos.');return}
 if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){CE.showNotice(err,'Each image must be JPG, PNG or WebP and no larger than 5 MB.');return}
 if($('end').value&&$('start').value&&$('end').value<$('start').value){CE.showNotice(err,'End date cannot be before start date.');return}
 const registrationLink=$('registration-link').value.trim();if(registrationLink){try{if(new URL(registrationLink).protocol!=='https:')throw 0}catch(_){CE.showNotice(err,'Registration link must be a valid HTTPS URL.');return}}
 btn.disabled=true;const uploaded=[];
 try{
  btn.textContent='Uploading fest photos…';
  for(const file of files){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=collegeId+'/fests/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from(CE.BUCKET).upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});if(error)throw error;uploaded.push(sb.storage.from(CE.BUCKET).getPublicUrl(path).data.publicUrl)}
  btn.textContent='Saving fest…';
  const payload={title:$('title').value.trim(),college_name:$('college').value.trim(),college_id:collegeId,description:$('description').value.trim()||null,venue:$('venue').value.trim()||null,registration_link:registrationLink||null,start_date:$('start').value||null,end_date:$('end').value||null,photo_urls:uploaded,activities:[],event_ids:[],is_published:$('publish').checked};
  const {data,error}=await sb.from('fests').insert(payload).select('id').single();if(error)throw error;
  CE.toast('Fest created. Add activities and arrange its carousel slides.');location.href='manage-fest-activities.html?id='+encodeURIComponent(data.id);
 }catch(ex){console.error(ex);CE.showNotice(err,/row-level security|permission denied/i.test(ex.message||'')?'Your College Admin account could not create this fest. Check that your college assignment is active.':(ex.message||'Could not create fest.'));
  for(const url of uploaded){const p=storagePath(url);if(p.startsWith(collegeId+'/'))try{await sb.storage.from(CE.BUCKET).remove([p])}catch(_){}}
  btn.disabled=false;btn.textContent='Save Fest & Continue';
 }
}
start();
})();
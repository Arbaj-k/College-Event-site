(function(){
'use strict';
const $=id=>document.getElementById(id),CE=window.CE;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let fest=null,editingIndex=-1,collegeId='';
function storagePath(url){try{const marker='/storage/v1/object/public/'+CE.BUCKET+'/',p=new URL(url).pathname;return p.includes(marker)?decodeURIComponent(p.split(marker)[1]):''}catch(_){return ''}}
const fields={title:'activity-title',category:'activity-category',date:'activity-date',time:'activity-time',venue:'activity-venue',registration_link:'activity-link',description:'activity-description'};
function getField(key){return $(fields[key]).value.trim()}
function notifyRecord(patch,updatedAt){window.dispatchEvent(new CustomEvent('hapn:fest-record-updated',{detail:{id:fest.id,patch,updated_at:updatedAt}}))}
function setForm(a={}){Object.entries(fields).forEach(([key,id])=>$(id).value=a[key]||'');$('activity-photo').value='';$('activity-photo-preview').innerHTML=a.photo_url?'<img class="activity-poster-preview" src="'+esc(a.photo_url)+'" alt="Current activity poster">':'';$('activity-form-title').textContent=editingIndex>=0?'Edit activity':'Add an activity';$('save-activity').textContent=editingIndex>=0?'Save changes':'Save activity';$('cancel-edit').hidden=editingIndex<0;$('photo-required').textContent=editingIndex>=0?'(optional)':'*'}
function fillFestForm(){const f=fest;$('edit-fest-title').value=f.title||'';$('edit-fest-college-name').value=f.college_name||'';$('edit-fest-start').value=f.start_date||'';$('edit-fest-end').value=f.end_date||'';$('edit-fest-venue').value=f.venue||'';$('edit-fest-registration').value=f.registration_link||'';$('edit-fest-description').value=f.description||'';$('edit-fest-publish').checked=!!f.is_published}
function render(){
 const activities=Array.isArray(fest.activities)?fest.activities:[];
 $('activity-count').textContent='('+activities.length+')';
 $('fest-summary').innerHTML='<strong>'+esc(fest.title)+'</strong> · '+esc(fest.college_name)+' · '+(fest.is_published?'Published':'Draft');
 $('view-public-fest').href='../fest/?id='+encodeURIComponent(fest.id);
 if(!activities.length){$('activity-list').innerHTML='<div class="fest-empty"><strong>No activities added yet.</strong><p>Use the form above to add the first activity and its poster.</p></div>';return}
 $('activity-list').innerHTML=activities.map((a,i)=>'<article class="activity-manager-item">'+(a.photo_url?'<img class="activity-manager-poster" src="'+esc(a.photo_url)+'" alt="'+esc(a.title)+' poster" loading="lazy">':'<div class="activity-manager-poster activity-manager-no-poster">No poster</div>')+'<div class="activity-manager-copy"><div class="activity-card-top"><span class="activity-number">'+String(i+1).padStart(2,'0')+'</span>'+(a.category?'<span class="activity-category">'+esc(a.category)+'</span>':'')+'</div><h3>'+esc(a.title)+'</h3><p>'+esc([a.date,a.time,a.venue].filter(Boolean).join(' · ')||'Schedule to be announced')+'</p>'+(a.registration_link?'<p><a href="'+esc(a.registration_link)+'" target="_blank" rel="noopener noreferrer">Registration link</a></p>':'')+(a.description?'<p>'+esc(a.description)+'</p>':'')+'<div class="form-actions"><button class="btn btn-outline btn-sm" type="button" data-edit="'+i+'">Edit</button><button class="btn btn-danger-outline btn-sm" type="button" data-delete="'+i+'">Delete</button></div></div></article>').join('');
}
async function persist(next){
 const {data,error}=await sb.from('fests').update({activities:next,updated_at:new Date().toISOString()}).eq('id',fest.id).eq('college_id',collegeId).eq('updated_at',fest.updated_at).select('id,activities,updated_at').maybeSingle();
 if(error)throw error;if(!data)throw new Error('Another admin changed this fest. Refresh before saving to avoid overwriting their changes.');
 fest.activities=Array.isArray(data.activities)?data.activities:next;fest.updated_at=data.updated_at;notifyRecord({activities:fest.activities},data.updated_at);render();
}
function notice(message){CE.showNotice($('manager-notice'),message)}
async function saveFestDetails(e){
 e.preventDefault();const title=$('edit-fest-title').value.trim(),host=$('edit-fest-college-name').value.trim(),start=$('edit-fest-start').value,end=$('edit-fest-end').value,link=$('edit-fest-registration').value.trim();
 if(!title||!host){notice('Fest name and hosting college are required.');return}
 if(start&&end&&end<start){notice('End date cannot be before start date.');return}
 if(link){try{if(new URL(link).protocol!=='https:')throw 0}catch(_){notice('Registration link must be a valid HTTPS URL.');return}}
 const patch={title,college_name:host,start_date:start||null,end_date:end||null,venue:$('edit-fest-venue').value.trim()||null,registration_link:link||null,description:$('edit-fest-description').value.trim()||null,is_published:$('edit-fest-publish').checked};
 const btn=$('save-fest-details');btn.disabled=true;btn.textContent='Saving…';
 try{const {data,error}=await sb.from('fests').update({...patch,updated_at:new Date().toISOString()}).eq('id',fest.id).eq('college_id',collegeId).eq('updated_at',fest.updated_at).select('updated_at').maybeSingle();if(error)throw error;if(!data)throw new Error('Another admin changed this fest. Refresh before saving.');fest={...fest,...patch,updated_at:data.updated_at};notifyRecord(patch,data.updated_at);render();document.title=fest.title+' activities | Hapn Admin';$('page-title').textContent='Manage activities: '+fest.title;CE.toast('Fest details saved.')}catch(ex){notice(ex.message||'Could not save fest details.')}finally{btn.disabled=false;btn.textContent='Save fest details'}
}
async function start(){
 const user=await CE.auth.requireAdmin();if(!user)return;const id=new URLSearchParams(location.search).get('id');if(!id){notice('Fest ID missing. Open this page after creating a fest.');return}
 const {data,error}=await sb.from('fests').select('id,title,college_name,college_id,is_published,activities,photo_urls,carousel_order,start_date,end_date,venue,registration_link,description,updated_at').eq('id',id).maybeSingle();
 if(error||!data){notice(error?.message||'Fest not found, or you do not have permission to manage it.');return}
 collegeId=CE.currentProfile?.college_id||'';if(!collegeId||data.college_id!==collegeId){notice('This fest does not belong to your assigned college.');return}
 fest=data;document.title=fest.title+' activities | Hapn';$('page-title').textContent='Manage activities: '+fest.title;fillFestForm();render();setForm();
 $('fest-edit-form').addEventListener('submit',saveFestDetails);
 $('delete-main-fest').addEventListener('click',deleteMainFest);
 $('activity-form').addEventListener('submit',saveActivity);
 $('cancel-edit').addEventListener('click',()=>{editingIndex=-1;setForm()});
 $('activity-photo').addEventListener('change',()=>{const f=$('activity-photo').files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024){notice('Poster must be JPG, PNG or WebP and no larger than 5 MB.');$('activity-photo').value='';return}$('activity-photo-preview').innerHTML='<img class="activity-poster-preview" src="'+URL.createObjectURL(f)+'" alt="Selected poster preview">'});
 $('activity-list').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit){editingIndex=Number(edit.dataset.edit);setForm(fest.activities[editingIndex]||{});$('activity-form').scrollIntoView({behavior:'smooth',block:'start'});return}if(del){const i=Number(del.dataset.delete);if(!Number.isInteger(i)||!fest.activities[i])return;if(!confirm('Delete this activity from the fest?'))return;try{const next=fest.activities.filter((_,idx)=>idx!==i);await persist(next);if(editingIndex===i){editingIndex=-1;setForm()}else if(editingIndex>i)editingIndex--;CE.toast('Activity deleted.')}catch(ex){notice(ex.message||'Could not delete activity.')}}});
 window.addEventListener('hapn:fest-record-updated',e=>{const d=e.detail;if(!d||d.id!==fest.id)return;fest={...fest,...(d.patch||{}),updated_at:d.updated_at||fest.updated_at};fillFestForm();render()});
}
async function deleteMainFest(){
 if(!fest||!confirm('Delete the entire fest "'+fest.title+'" permanently? All activities will also be deleted. This cannot be undone.'))return;
 const btn=$('delete-main-fest');btn.disabled=true;btn.textContent='Deleting fest…';
 try{
  const {data:deleted,error}=await sb.from('fests').delete().eq('id',fest.id).eq('college_id',collegeId).eq('updated_at',fest.updated_at).select('id').maybeSingle();
  if(error)throw error;if(!deleted)throw new Error('The fest changed or could not be deleted. Refresh and try again.');
  const urls=[...(fest.photo_urls||[]),...((fest.activities||[]).map(a=>a.photo_url).filter(Boolean))],paths=urls.map(storagePath).filter(p=>p.startsWith(collegeId+'/'));
  if(paths.length){const {error:storageError}=await sb.storage.from(CE.BUCKET).remove(paths);if(storageError)console.warn('Fest deleted but some poster files may remain:',storageError.message)}
  alert('Fest deleted.');location.href='create-fest.html';
 }catch(ex){console.error(ex);notice(ex.message||'Could not delete fest.');btn.disabled=false;btn.textContent='Delete entire fest'}
}
async function saveActivity(e){
 e.preventDefault();$('manager-notice').hidden=true;const title=getField('title');if(!title){notice('Activity name is required.');return}
 const link=getField('registration_link');if(link){try{if(new URL(link).protocol!=='https:')throw 0}catch(_){notice('Registration link must be a valid HTTPS URL.');return}}
 const file=$('activity-photo').files[0];if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)){notice('Poster must be JPG, PNG or WebP and no larger than 5 MB.');return}
 const activities=Array.isArray(fest.activities)?[...fest.activities]:[];if(editingIndex<0&&!file){notice('Please choose a poster/photo for this activity.');return}
 const btn=$('save-activity');btn.disabled=true;let uploadedPath='';
 try{
  let photoUrl=editingIndex>=0?activities[editingIndex].photo_url||null:null;
  if(file){btn.textContent='Uploading poster…';const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];uploadedPath=collegeId+'/fests/activities/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from(CE.BUCKET).upload(uploadedPath,file,{contentType:file.type,cacheControl:'31536000',upsert:false});if(error)throw error;photoUrl=sb.storage.from(CE.BUCKET).getPublicUrl(uploadedPath).data.publicUrl}
  const oldPhoto=editingIndex>=0?activities[editingIndex].photo_url:null;
  const item={id:editingIndex>=0?(activities[editingIndex].id||crypto.randomUUID()):crypto.randomUUID(),title,category:getField('category'),date:getField('date'),time:getField('time'),venue:getField('venue'),registration_link:link,description:getField('description'),photo_url:photoUrl};
  if(editingIndex>=0)activities[editingIndex]=item;else activities.push(item);
  btn.textContent='Saving activity…';await persist(activities);
  if(oldPhoto&&file){const p=storagePath(oldPhoto);if(p.startsWith(collegeId+'/')){const {error}=await sb.storage.from(CE.BUCKET).remove([p]);if(error)console.warn('Old activity poster could not be removed:',error.message)}}
  editingIndex=-1;setForm();CE.toast('Activity saved.');
 }catch(ex){console.error(ex);notice(ex.message||'Could not save activity.');if(uploadedPath)await sb.storage.from(CE.BUCKET).remove([uploadedPath]).catch(()=>{});}
 finally{btn.disabled=false;btn.textContent=editingIndex>=0?'Save changes':'Save activity'}
}
start();
})();
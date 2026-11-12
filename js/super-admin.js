(function(){
'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null, colleges=[], admins=[], invitations=[], events=[], currentView='overview', adminTab='admins';
const titles={overview:'Overview',colleges:'Colleges',admins:'College Admins',events:'All Events',analytics:'Analytics',archive:'Event Archive',settings:'Settings'};
function note(t,ok=false){$('notice').hidden=false;$('notice').className='notice'+(ok?' success':'');$('notice').textContent=t;}
function clearNote(){$('notice').hidden=true;}
async function checkAccess(){
 if(!window.sb){$('gate').textContent='Supabase is not configured.';return false;}
 const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('/admin/login.html');return false;}
 const {data:u,error:ue}=await sb.auth.getUser();if(ue||!u.user){await sb.auth.signOut();location.replace('/admin/login.html');return false;}
 const {data:p,error}=await sb.from('profiles').select('role,is_active').eq('user_id',u.user.id).maybeSingle();
 if(error||p?.role!=='super_admin'||p.is_active!==true){$('gate').textContent='Access denied. This page is restricted to approved Super Admin accounts.';await sb.auth.signOut();return false;}
 user=u.user;$('user-email').textContent=user.email||'';$('gate').hidden=true;$('app').hidden=false;return true;
}
function go(view){currentView=view;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('page-title').textContent=titles[view];$('sidebar').classList.remove('open');if(view==='colleges')renderColleges();if(view==='admins')loadAdmins();if(view==='events')renderEvents();if(view==='analytics')renderAnalytics();if(view==='archive')loadArchive();}
async function loadBase(){
 const [c,a,e]=await Promise.all([
 sb.from('colleges').select('*').order('name'),
 sb.from('profiles').select('user_id,email,full_name,college_id,is_active,created_at').eq('role','college_admin').order('created_at',{ascending:false}),
 sb.from('events').select('id,title,date,end_date,is_published,college_id,created_at').order('created_at',{ascending:false}).limit(500)
 ]);
 if(c.error||a.error||e.error)throw c.error||a.error||e.error;
 colleges=c.data||[];admins=a.data||[];events=e.data||[];
 $('metric-colleges').textContent=colleges.length;$('metric-admins').textContent=admins.filter(x=>x.is_active).length;$('metric-events').textContent=events.length;$('metric-published').textContent=events.filter(x=>x.is_published).length;
 $('a-colleges').textContent=colleges.length;$('a-admins').textContent=admins.filter(x=>x.is_active).length;$('a-events').textContent=events.length;$('a-published').textContent=events.filter(x=>x.is_published).length;
 const collegeName=id=>colleges.find(c=>c.id===id)?.name||'Unassigned';
 $('recent-events').innerHTML=events.slice(0,6).length?table(['EVENT','COLLEGE','DATE','STATUS'],events.slice(0,6).map(e=>[esc(e.title||'Untitled'),esc(collegeName(e.college_id)),esc(e.date||'—'),e.is_published?'<span class="pill">Published</span>':'<span class="pill off">Draft</span>'])):'<div class="empty">No events found.</div>';
 $('event-college-filter').innerHTML='<option value="">All colleges</option>'+colleges.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
 $('invite-college').innerHTML='<option value="">Select college</option>'+colleges.filter(c=>c.is_active).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
 renderAnalytics();
}
function table(headers,rows){return '<table class="data-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function renderColleges(){
 const q=$('college-search').value.toLowerCase();const list=colleges.filter(c=>c.name.toLowerCase().includes(q));
 $('college-count').textContent=list.length+' colleges';
 $('colleges-list').innerHTML=list.map(c=>{const count=events.filter(e=>e.college_id===c.id).length,adminCount=admins.filter(a=>a.college_id===c.id).length;return '<article class="college-card"><div class="college-top">'+(c.logo_url?'<img class="college-logo" src="'+esc(c.logo_url)+'" alt="">':'<span class="college-logo college-logo-fallback">'+esc(c.name.slice(0,1).toUpperCase())+'</span>')+'<div><h3>'+esc(c.name)+'</h3><span class="pill '+(c.is_active?'':'off')+'">'+(c.is_active?'Active':'Inactive')+'</span></div></div><p>'+esc(c.description||'No description added.')+'</p><div class="college-meta"><span>'+count+' events</span><span>'+adminCount+' admins</span></div><div class="card-actions"><button class="small-btn" data-edit-college="'+c.id+'">Edit</button><button class="small-btn" data-toggle-college="'+c.id+'">'+(c.is_active?'Deactivate':'Activate')+'</button></div></article>';}).join('')||'<div class="empty">No colleges match your search.</div>';
}
function renderAdmins(){
 if(adminTab==='admins'){$('admins-list').innerHTML=admins.length?table(['ADMINISTRATOR','EMAIL','COLLEGE','STATUS','ACTIONS'],admins.map(a=>[esc(a.full_name||'—'),esc(a.email),esc(colleges.find(c=>c.id===a.college_id)?.name||'—'),a.is_active?'<span class="pill">Active</span>':'<span class="pill off">Inactive</span>','<button class="small-btn" data-reassign="'+a.user_id+'">Reassign</button> <button class="small-btn" data-admin-status="'+a.user_id+'" data-active="'+(!a.is_active)+'">'+(a.is_active?'Deactivate':'Activate')+'</button>'])):'<div class="empty">No College Admins yet.</div>';}
 else $('admins-list').innerHTML=invitations.length?table(['EMAIL','COLLEGE','STATUS','EXPIRES','ACTION'],invitations.map(i=>[esc(i.email),esc(colleges.find(c=>c.id===i.college_id)?.name||'—'),esc(i.status),new Date(i.expires_at).toLocaleDateString(),i.status==='pending'?'<button class="small-btn danger" data-revoke="'+i.id+'">Revoke</button>':'—'])):'<div class="empty">No invitations found.</div>';
}
async function loadAdmins(){const [a,i]=await Promise.all([sb.from('profiles').select('user_id,email,full_name,college_id,is_active,created_at').eq('role','college_admin').order('created_at',{ascending:false}),sb.from('admin_invitations').select('*').order('created_at',{ascending:false})]);if(a.error||i.error){note((a.error||i.error).message);return;}admins=a.data||[];invitations=i.data||[];renderAdmins();}
function renderEvents(){const q=$('event-search').value.toLowerCase(),college=$('event-college-filter').value;const list=events.filter(e=>(!college||e.college_id===college)&&(!q||String(e.title).toLowerCase().includes(q)));$('events-list').innerHTML=list.length?table(['EVENT','COLLEGE','DATE','STATUS','ACTIONS'],list.map(e=>[esc(e.title||'Untitled'),esc(colleges.find(c=>c.id===e.college_id)?.name||'Unassigned'),esc(e.date||'—'),e.is_published?'<span class="pill">Published</span>':'<span class="pill off">Draft</span>','<a class="small-btn" href="/admin/add-event.html?id='+encodeURIComponent(e.id)+'">Edit</a>'])):'<div class="empty">No events found.</div>';}
function renderAnalytics(){const rows=colleges.map(c=>({name:c.name,n:events.filter(e=>e.college_id===c.id).length})).sort((a,b)=>b.n-a.n),max=Math.max(1,...rows.map(r=>r.n));$('college-analytics').innerHTML=rows.map(r=>'<div class="bar-row"><span>'+esc(r.name)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(r.n/max*100)+'%"></div></div><b>'+r.n+'</b></div>').join('')||'<div class="empty">Add colleges and events to see analytics.</div>';}
async function loadArchive(){const {data,error}=await sb.from('event_archive').select('id,event_title,college_name,event_date,archived_at').order('archived_at',{ascending:false}).limit(500);$('archive-list').innerHTML=error?'<div class="empty">'+esc(error.message)+'</div>':data.length?table(['EVENT','COLLEGE','EVENT DATE','ARCHIVED ON'],data.map(x=>[esc(x.event_title),esc(x.college_name),esc(x.event_date||'—'),esc(new Date(x.archived_at).toLocaleString())])):'<div class="empty">Archive is empty.</div>';}
function openCollege(c){$('college-dialog-title').textContent=c?'Edit college':'Add college';$('college-id').value=c?.id||'';$('college-name').value=c?.name||'';$('college-logo').value=c?.logo_url||'';$('college-website').value=c?.website_url||'';$('college-description').value=c?.description||'';$('college-active').checked=c?.is_active!==false;$('college-dialog').showModal();}
async function callApi(body){const {data:{session}}=await sb.auth.getSession();const {data,error}=await sb.functions.invoke('super-admin-api',{body,headers:{Authorization:'Bearer '+session.access_token}});if(error)throw error;if(data?.error)throw new Error(data.error);return data;}
async function init(){
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
 document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
 $('menu-toggle').onclick=()=>$('sidebar').classList.toggle('open');
 $('logout').onclick=async()=>{await sb.auth.signOut();location.replace('/admin/login.html');};
 $('new-college').onclick=()=>openCollege(null);$('new-invite').onclick=()=>{$('invite-dialog').showModal();};
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('college-search').oninput=renderColleges;$('event-search').oninput=renderEvents;$('event-college-filter').onchange=renderEvents;
 $('side-nav').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit-college]');if(edit)openCollege(colleges.find(c=>c.id===edit.dataset.editCollege));
 const toggle=e.target.closest('[data-toggle-college]');if(toggle){const c=colleges.find(x=>x.id===toggle.dataset.toggleCollege);const {error}=await sb.from('colleges').update({is_active:!c.is_active}).eq('id',c.id);if(error)note(error.message);else{note('College updated.',true);await refresh();}}
 });
 $('colleges-list').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-college]');if(edit)openCollege(colleges.find(c=>c.id===edit.dataset.editCollege));const toggle=e.target.closest('[data-toggle-college]');if(toggle){const c=colleges.find(x=>x.id===toggle.dataset.toggleCollege);const {error}=await sb.from('colleges').update({is_active:!c.is_active}).eq('id',c.id);if(error)note(error.message);else{note('College updated.',true);await refresh();}}});
 $('college-form').onsubmit=async e=>{e.preventDefault();const id=$('college-id').value,payload={name:$('college-name').value.trim(),logo_url:$('college-logo').value.trim()||null,website_url:$('college-website').value.trim()||null,description:$('college-description').value.trim()||null,is_active:$('college-active').checked};const r=id?await sb.from('colleges').update(payload).eq('id',id):await sb.from('colleges').insert(payload);if(r.error){note(r.error.message);return;} $('college-dialog').close();note('College saved.',true);await refresh();};
 $('invite-form').onsubmit=async e=>{e.preventDefault();try{await callApi({action:'invite_college_admin',college_id:$('invite-college').value,email:$('invite-email').value,full_name:$('invite-name').value});$('invite-dialog').close();note('Invitation email sent.',true);await loadAdmins();}catch(err){note(err.message||'Could not send invitation.');}};
 document.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.adminTab;document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===b));renderAdmins();});
 $('admins-list').addEventListener('click',async e=>{
 const status=e.target.closest('[data-admin-status]');if(status){try{await callApi({action:'set_admin_status',user_id:status.dataset.adminStatus,is_active:status.dataset.active==='true'});note('Admin status updated.',true);await loadAdmins();}catch(err){note(err.message);}}
 const revoke=e.target.closest('[data-revoke]');if(revoke){try{await callApi({action:'revoke_invitation',invitation_id:revoke.dataset.revoke});note('Invitation revoked.',true);await loadAdmins();}catch(err){note(err.message);}}
 const reassign=e.target.closest('[data-reassign]');if(reassign){const a=admins.find(x=>x.user_id===reassign.dataset.reassign);const choice=prompt('Enter the exact new college name:\n'+colleges.map(c=>c.name).join('\n'));const c=colleges.find(x=>x.name.toLowerCase()===String(choice||'').toLowerCase());if(c){try{await callApi({action:'reassign_admin',user_id:a.user_id,college_id:c.id});note('Administrator reassigned.',true);await refresh();}catch(err){note(err.message);}}}
 });
 $('refresh-analytics').onclick=refresh;
 $('run-archive').onclick=async()=>{if(!confirm('Archive and permanently remove all events whose end date is at least seven days past?'))return;const {data,error}=await sb.rpc('archive_expired_events');if(error)note(error.message);else{note((data||0)+' event(s) archived and removed.',true);await refresh();await loadArchive();}};
 if(!await checkAccess())return;
 try{await refresh();go('overview');}catch(err){note(err.message||'Could not load platform data.');}
}
async function refresh(){await loadBase();if(currentView==='colleges')renderColleges();if(currentView==='admins')await loadAdmins();if(currentView==='events')renderEvents();}
document.addEventListener('DOMContentLoaded',init);
})();
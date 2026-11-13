(function(){
'use strict';
const KEY='hapn_selected_college_id',COOKIE='hapn_college_id';
let colleges=[],selected='';
function read(){
 try{const v=localStorage.getItem(KEY);if(v)return v}catch(_){}
 try{const m=document.cookie.match(new RegExp('(?:^|; )'+COOKIE+'=([^;]*)'));if(m)return decodeURIComponent(m[1])}catch(_){}
 return '';
}
function persist(value){
 selected=value||'';
 try{if(selected)localStorage.setItem(KEY,selected);else localStorage.removeItem(KEY)}catch(e){console.warn('College preference local storage unavailable',e)}
 try{document.cookie=COOKIE+'='+encodeURIComponent(selected)+'; Path=/; Max-Age='+(selected?31536000:0)+'; SameSite=Lax; Secure'}catch(_){}
}
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function init(){
 selected=read();
 const nodes=[...document.querySelectorAll('[data-college-selector]')];
 if(!window.sbPublic){nodes.forEach(n=>n.innerHTML='<option value="">Could not load colleges</option>');return}
 let data,error;
 try{({data,error}=await sbPublic.from('colleges').select('id,name').eq('is_active',true).order('name'))}catch(e){error=e}
 if(error||!data?.length){
  nodes.forEach(n=>{n.innerHTML='<option value="">College list unavailable — saved choice retained</option>';n.value=''});
  console.warn('College list unavailable; keeping saved selection',error);
  return;
 }
 colleges=data;
 // Do not erase a saved preference just because the list is temporarily stale.
 nodes.forEach(n=>{
  n.innerHTML='<option value="">Choose your college</option>'+colleges.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
  n.value=selected;
  n.addEventListener('change',()=>{
   persist(n.value);
   nodes.forEach(x=>{if(x!==n)x.value=selected});
   document.dispatchEvent(new CustomEvent('hapn:collegechange',{detail:{collegeId:selected}}));
  });
 });
}
window.HapnCollegeSelection={
 ready:init(),
 get:()=>selected||read(),
 getName:()=>colleges.find(c=>c.id===(selected||read()))?.name||'',
 change:()=>{persist('');document.dispatchEvent(new CustomEvent('hapn:collegechange',{detail:{collegeId:''}}));}
};
})();
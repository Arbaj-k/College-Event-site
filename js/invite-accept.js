(function(){
  const msg=document.getElementById('invite-msg'), form=document.getElementById('invite-form'), btn=document.getElementById('activate-btn');
  function show(text,ok=false){msg.hidden=false;msg.className='notice '+(ok?'notice-success':'notice-warn');msg.textContent=text;}
  if(!window.sb){show('Hapn authentication is not configured.');btn.disabled=true;return;}
  form.addEventListener('submit',async e=>{
    e.preventDefault();const p=document.getElementById('new-password').value,c=document.getElementById('confirm-password').value;
    if(p!==c){show('Passwords do not match.');return;}if(p.length<10){show('Use at least 10 characters.');return;}
    btn.disabled=true;btn.textContent='Activating…';
    try{
      const {data:{session},error:sessionError}=await sb.auth.getSession();if(sessionError||!session)throw new Error('Open the invitation link from your email again to continue.');
      const {data:{user},error}=await sb.auth.updateUser({password:p,data:{full_name:document.getElementById('full-name').value.trim()}});
      if(error)throw error;
      const {data:activation,error:activationError}=await sb.functions.invoke('super-admin-api',{body:{action:'finalize_admin_activation',full_name:document.getElementById('full-name').value.trim()},headers:{Authorization:'Bearer '+session.access_token}});
      if(activationError||activation?.error)throw new Error(activation?.error||activationError.message||'Invitation activation failed.');
      show('Your account is active. Sign in using the existing Admin Login page.',true);form.hidden=true;await sb.auth.signOut();
    }catch(err){show(err.message||'Could not activate this account.');}
    finally{btn.disabled=false;btn.textContent='Activate account';}
  });
})();
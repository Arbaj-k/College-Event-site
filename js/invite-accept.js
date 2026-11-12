(function(){
  const msg=document.getElementById('invite-msg'), form=document.getElementById('invite-form'), btn=document.getElementById('activate-btn');
  function show(text,ok=false){msg.hidden=false;msg.className='notice '+(ok?'notice-success':'notice-warn');msg.textContent=text;}
  if(!window.sb){show('Hapn authentication is not configured.');btn.disabled=true;return;}
  btn.disabled=true;
  (async()=>{
    try {
      const hash=new URLSearchParams(location.hash.slice(1));
      const query=new URLSearchParams(location.search);
      const accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token'),code=query.get('code');
      if(accessToken&&refreshToken){const {error}=await sb.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw error;history.replaceState(null,'',location.pathname);}
      else if(code){const {error}=await sb.auth.exchangeCodeForSession(code);if(error)throw error;history.replaceState(null,'',location.pathname);}
      const {data:{session}}=await sb.auth.getSession();
      if(!session){show('Please open the secure invitation link from your email to activate this account.');btn.disabled=true;}
      else btn.disabled=false;
    } catch(err){show(err.message||'This invitation link could not be verified.');btn.disabled=true;}
  })();
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
(() => {
  const form=document.querySelector('#navigate'),input=document.querySelector('#address'),frame=document.querySelector('#page'),status=document.querySelector('#status'),welcome=document.querySelector('#welcome'),go=document.querySelector('#go');
  let session=null,busy=false;
  async function makeSession(){const response=await fetch('/session',{method:'POST'});if(!response.ok)throw Error(response.status===429?'Too many sessions. Wait a minute and try again.':'Could not start a session. Please try again.');return (await response.json()).id;}
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;go.disabled=true;
    try{
      const text=input.value.trim(),url=new URL(/^[a-z][a-z\d+.-]*:/i.test(text)?text:'https://'+text);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Enter an HTTP or HTTPS website address.');
      status.textContent='Connecting…';session ||= await makeSession();
      frame.src='/'+session+'/'+url.href;frame.hidden=false;welcome.hidden=true;input.value=url.href;
      status.textContent='Loading website. If your session expired, choose New session and try again.';
    }catch(error){status.textContent=error.message;}finally{busy=false;go.disabled=false;}
  });
  frame.addEventListener('load',()=>{if(!frame.hidden)status.textContent='Page loaded. Use New session to start fresh.';});
  document.querySelector('#reload').addEventListener('click',()=>{if(!frame.hidden)try{frame.contentWindow.location.reload();}catch{frame.src=frame.src;}});
  document.querySelector('#new-session').addEventListener('click',()=>{if(busy)return;if(session)fetch('/end-session?id='+encodeURIComponent(session),{method:'POST',keepalive:true}).catch(()=>{});session=null;frame.removeAttribute('src');frame.hidden=true;welcome.hidden=false;status.textContent='Fresh start. Enter a website to create a new session.';input.focus();});
})();

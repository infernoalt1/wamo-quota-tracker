(() => {
  const sequence=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowLeft','ArrowRight','ArrowRight'];
  const research=document.querySelector('#research'),shell=document.querySelector('#browser-shell'),frame=document.querySelector('#proxy-frame'),status=document.querySelector('#proxy-status'),retry=document.querySelector('#retry');
  let keys=[],last=0,unlocked=false,generation=0,loadingTimer;
  async function unlock(){
    unlocked=true;keys=[];research.hidden=true;shell.hidden=false;document.body.classList.add('browsing');window.scrollTo(0,0);
    const current=++generation;status.hidden=false;retry.hidden=true;status.textContent='Connecting to your browsing server…';
    try{
      const response=await fetch('/rammerhead/config',{cache:'no-store'}),data=await response.json();
      if(current!==generation)return;
      if(!response.ok)throw Error(data.error || 'Browsing is unavailable.');
      const origin=new URL(data.origin);
      if(origin.origin===location.origin || !['https:','http:'].includes(origin.protocol))throw Error('The proxy needs a separate origin.');
      frame.onload=()=>{if(current!==generation)return;clearTimeout(loadingTimer);status.hidden=true;};
      frame.src=origin.origin+'/';frame.hidden=false;
      loadingTimer=setTimeout(()=>{if(current!==generation)return;status.hidden=false;status.textContent='The browsing server is taking too long to respond. Check its hostname and try again.';retry.hidden=false;},15000);
    }catch(error){if(current===generation){status.textContent=error.message;retry.hidden=false;}}
  }
  function lock(){unlocked=false;generation++;clearTimeout(loadingTimer);keys=[];frame.removeAttribute('src');frame.hidden=true;shell.hidden=true;research.hidden=false;document.body.classList.remove('browsing');document.querySelector('.logo').focus();}
  function direction(key){if(unlocked)return;if(Date.now()-last>6000)keys=[];last=Date.now();keys.push(key);keys=keys.slice(-sequence.length);if(keys.join()===sequence.join())unlock();}
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&unlocked){lock();return;}
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(!unlocked&&sequence.includes(event.key)){event.preventDefault();direction(event.key);}else if(!unlocked)keys=[];
  });
  document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>direction(button.dataset.direction)));
  document.querySelector('#lock').addEventListener('click',lock);retry.addEventListener('click',unlock);
})();

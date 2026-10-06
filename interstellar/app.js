(() => {
  const code=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  const $=s=>document.querySelector(s),frame=$('#proxy-frame');
  let keys=[],last=0,unlocked=false,generation=0,timer;
  async function unlock(){
    unlocked=true;keys=[];$('#research').hidden=true;$('#browser-shell').hidden=false;document.body.classList.add('browsing');window.scrollTo(0,0);
    const current=++generation;$('#proxy-status').hidden=false;$('#proxy-status').textContent='Opening Interstellar…';$('#retry').hidden=true;
    try{
      if(!window.isSecureContext)throw Error('Interstellar needs HTTPS, or localhost for development.');
      if(!('serviceWorker' in navigator))throw Error('This browser does not support service workers. Try a current Chrome, Edge, or Firefox browser.');
      const response=await fetch('/interstellar/health',{cache:'no-store'});if(!response.ok)throw Error('The browsing server is unavailable. Please try again.');
      if(current!==generation)return;
      frame.onload=()=>{if(current!==generation)return;clearTimeout(timer);$('#proxy-status').hidden=true;};
      frame.src='/interstellar/browser/';frame.hidden=false;
      timer=setTimeout(()=>{if(current!==generation)return;$('#proxy-status').hidden=false;$('#proxy-status').textContent='Still connecting. The Render service may be waking up.';$('#retry').hidden=false;},15000);
    }catch(error){if(current===generation){$('#proxy-status').textContent=error.message;$('#retry').hidden=false;}}
  }
  function lock(){unlocked=false;generation++;clearTimeout(timer);keys=[];frame.removeAttribute('src');frame.hidden=true;$('#browser-shell').hidden=true;$('#research').hidden=false;document.body.classList.remove('browsing');$('.logo').focus();}
  function press(key){if(unlocked)return;if(Date.now()-last>6000)keys=[];last=Date.now();keys.push(key);keys=keys.slice(-code.length);if(keys.join()===code.join())unlock();}
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&unlocked){lock();return;}
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(!unlocked&&code.includes(key)){event.preventDefault();press(key);}else if(!unlocked)keys=[];
  });
  document.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('click',()=>press(button.dataset.key)));
  $('#lock').addEventListener('click',lock);$('#retry').addEventListener('click',unlock);
})();

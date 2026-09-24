export async function requestJSON(url,options={},fetcher=globalThis.fetch){
  const response=await fetcher(url,{...options,signal:AbortSignal.timeout(10000)});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||`Request failed (${response.status})`);error.status=response.status;throw error;}
  return result;
}
export function mergeChat(previous,incoming){
  const seen=new Set();return [...previous,...incoming].filter(m=>{if(m.id&&seen.has(m.id))return false;if(m.id)seen.add(m.id);return true;}).slice(-250);
}
// Reconnect only after checking the session. A failed network request is not an expired room.
export class LiveConnection {
  constructor({url,resume,onEvent,onStatus,onExpired,EventSourceClass=globalThis.EventSource,clock=Date.now}){
    Object.assign(this,{url,resume,onEvent,onStatus,onExpired,EventSourceClass,clock});
    this.closed=false;this.lastEvent=clock();this.timer=setInterval(()=>this.checkHealth(),3000);this.open();
  }
  checkHealth(){if(this.clock()-this.lastEvent>12000)return this.recover();}
  open(){
    if(this.closed)return;this.stream?.close();this.lastEvent=this.clock();
    const stream=this.stream=new this.EventSourceClass(this.url);
    for(const type of ['history','state','drawing','stroke','chat','solved'])stream.addEventListener(type,event=>{
      if(stream!==this.stream||this.closed)return;this.lastEvent=this.clock();
      if(type==='state')this.onStatus('connected');this.onEvent(type,JSON.parse(event.data));
    });
    stream.onerror=()=>{if(stream===this.stream)this.recover();};
  }
  async recover(){
    if(this.closed||this.recovering)return;clearTimeout(this.retry);this.recovering=true;this.onStatus('reconnecting');this.stream?.close();
    try{await this.resume();if(!this.closed)this.open();}
    catch(error){
      if(this.closed)return;
      if(error.status===410){this.close();this.onExpired();}
      // Keep retrying across brief Wi-Fi losses, proxy resets, and suspended tabs.
      else this.retry=setTimeout(()=>this.recover(),2000);
    }finally{this.recovering=false;}
  }
  close(){this.closed=true;clearInterval(this.timer);clearTimeout(this.retry);this.stream?.close();}
}

// Static, generated summary markup is fetched only when a disclosure opens.
// Share requests across duplicate abilities and retain viewed cards offline.
export function createRulesLoader(fetcher=fetch,cacheStorage=globalThis.caches){
  const requests=new Map();
  async function request(url){
    try{
      const response=await fetcher(url,{cache:'no-cache'});
      if(!response.ok)throw Error('Rules download failed');
      const html=await response.text();
      if(cacheStorage)void cacheStorage.open('lyrian-planner-rule-cards-v1').then(cache=>cache.put(url,new Response(html,{headers:{'Content-Type':'text/html'}}))).catch(()=>{});
      return html;
    }catch(error){
      const cached=await cacheStorage?.open('lyrian-planner-rule-cards-v1').then(cache=>cache.match(url)).catch(()=>null);
      if(cached)return cached.text();
      throw error;
    }
  }
  return async function load(details){
    const url=details.dataset.builderRulesUrl,body=details.querySelector('.builder-rules-body');
    if(!details.open||!url||!body||details.dataset.rulesLoaded==='true')return;
    body.setAttribute('aria-busy','true');
    try{
      if(!requests.has(url))requests.set(url,request(url).catch(error=>{requests.delete(url);throw error;}));
      const html=await requests.get(url);
      if(!details.isConnected)return;
      body.innerHTML=html;details.dataset.rulesLoaded='true';
    }catch{
      if(details.isConnected)body.innerHTML='<p role="status">Could not load these rules. You can still open the summary page from the name above.</p><button type="button" data-retry-builder-rules>Retry rules</button>';
    }finally{body.removeAttribute('aria-busy');}
  };
}

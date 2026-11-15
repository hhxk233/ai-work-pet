/* Embed the same companion in an isolated shadow tree on the comic site. */
(() => {
  if(document.querySelector('deepseek-companion'))return;
  const base=new URL('.',document.currentScript.src),host=document.createElement('deepseek-companion');
  host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1000';document.body.append(host);
  const root=host.attachShadow({mode:'open'}),style=document.createElement('link');style.rel='stylesheet';style.href=new URL('pet.css',base);root.append(style);
  const overrides=document.createElement('style');overrides.textContent=`:host{font-family:system-ui,"Microsoft YaHei",sans-serif;color:#426287;pointer-events:none}:host *{box-sizing:border-box}[hidden]{display:none!important}.pet,.dock,.menu,.help,.restore{pointer-events:auto}.pet{width:210px;height:228px}.dock{left:auto;right:16px;bottom:12px;transform:none;padding:3px;gap:0}.dock button{padding:8px 11px;font-size:11px}.status{display:none}.restore{position:fixed;right:16px;bottom:16px;border:1px solid #ccddeb;background:#ffffffe8;color:#52749c;border-radius:25px;padding:10px 15px;box-shadow:0 4px 15px #34516c12;font-size:12px;cursor:pointer}:host(.pet-size-large) .pet{width:288px;height:312px}@media(max-width:620px){.pet{width:145px;height:157px}.dock{right:10px;bottom:10px}.dock button{padding:7px 9px;font-size:10px}.speech{font-size:11px;padding:8px 10px}.help{max-width:calc(100vw - 30px);padding:22px}:host(.pet-size-large) .pet{width:210px;height:228px}}`;root.append(overrides);
  const loadScript=name=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(name,base);s.onload=resolve;s.onerror=reject;document.head.append(s);});
  async function start(){
    const response=await fetch(new URL('index.html',base));if(!response.ok)throw Error('Companion markup unavailable');
    const doc=new DOMParser().parseFromString(await response.text(),'text/html'),wrapper=document.createElement('div');
    for(const selector of ['#pet','#status','#menu','#help'])wrapper.append(doc.querySelector(selector));
    wrapper.querySelectorAll('a[href]').forEach(a=>{if(!a.getAttribute('href').startsWith('https:'))a.href=new URL(a.getAttribute('href'),base);});
    const dock=document.createElement('nav');dock.className='dock';dock.setAttribute('aria-label','大肥鱼互动');dock.innerHTML='<button data-auto aria-pressed="true">自动闲逛</button><button data-menu aria-expanded="false" aria-controls="menu">动作 ⋯</button><button data-help aria-label="桌宠玩法">?</button><button data-hide>收起</button>';wrapper.append(dock);root.append(wrapper);
    const restore=document.createElement('button');restore.className='restore';restore.textContent='大肥鱼';restore.setAttribute('aria-label','展开大肥鱼桌宠');restore.hidden=true;root.append(restore);
    window.DEEPSEEK_EMBED_ONLY=true;await loadScript('motion.js');await loadScript('props.js');await loadScript('pet.js');
    let companion=null;
    const show=()=>{wrapper.hidden=false;restore.hidden=true;companion=window.createDeepSeekCompanion(root,base);window.petCompanion=companion;try{localStorage.removeItem('deepseek-pet-hidden');}catch{}};
    const hide=()=>{companion?.dispose();wrapper.hidden=true;restore.hidden=false;try{localStorage.setItem('deepseek-pet-hidden','1');}catch{}};
    dock.querySelector('[data-hide]').onclick=hide;restore.onclick=show;
    let hidden=false;try{hidden=localStorage.getItem('deepseek-pet-hidden')==='1';}catch{}
    if(hidden)hide();else show();
  }
  start().catch(error=>{console.error('Companion failed to load',error);host.remove();});
})();

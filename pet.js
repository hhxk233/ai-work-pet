/* Self-contained browser companion. Generated art is loaded lazily, never redrawn. */
window.createDeepSeekCompanion=(root=document,assetBase=document.baseURI) => {
  const embedded=root!==document;
  const manifest=window.DEEPSEEK_PET,pet=root.querySelector('#pet'),canvas=pet.querySelector('canvas'),ctx=canvas.getContext('2d'),bubble=pet.querySelector('.speech'),status=root.querySelector('#status'),menu=root.querySelector('#menu');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const abort=new AbortController(),on=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:abort.signal});
  const cache=new Map(),pending=new Map();
  let automatic=!reduced.matches,state='idle',clipStart=performance.now(),sequence=[],stateUntil=0,decisionAt=performance.now()+4500,token=0,raf=0,last=0,visible=true,hiddenAt=0,menuOpen=false,speechUntil=0,transitioning=false,pausedAt=0;
  let x=0,y=0,destination=null,drag=null,longPress=null,dragged=false,paused=false;
  const names={idle:'眨眼发呆', 'running-right':'向右小跑','running-left':'向左小跑',waving:'挥手打招呼',jumping:'开心跳跃',failed:'委屈一下，再振作',waiting:'抱着小鲸鱼休息',running:'电脑开工',review:'认真吃白米饭','laptop-intro':'把小电脑打开','rice-intro':'端起小饭碗','sleepy-stretch':'伸个懒腰，揉揉眼睛'};
  const say=text=>{bubble.textContent=text;bubble.classList.add('show');speechUntil=performance.now()+3200;};
  function bounds(){const r=pet.getBoundingClientRect();return {w:r.width,h:r.height,minX:-r.width*.12,maxX:Math.max(0,innerWidth-r.width*.88),minY:Math.min(embedded?80:150,innerHeight*.25),maxY:Math.max(160,innerHeight-r.height-(embedded?52:75))};}
  function constrain(){const b=bounds();x=Math.max(b.minX,Math.min(b.maxX,x));y=Math.max(b.minY,Math.min(b.maxY,y));if(destination){destination.x=Math.max(b.minX,Math.min(b.maxX,destination.x));destination.y=Math.max(b.minY,Math.min(b.maxY,destination.y));}position();}
  function position(){pet.style.transform=`translate3d(${x}px,${y}px,0)`;}
  function syncAuto(){root.querySelectorAll('[data-auto]').forEach(b=>{b.setAttribute('aria-pressed',String(automatic));b.textContent=automatic?'自动闲逛':'开始闲逛';});}
  function pageFor(name,index=0){const clip=manifest.clips[name];return clip.pages.find(p=>index>=p.firstFrame&&index<p.firstFrame+p.frames);}
  function pageKey(name,page){return `${name}:${page.firstFrame}`;}
  async function load(name,index=0){
    const page=pageFor(name,index),key=pageKey(name,page);
    if(cache.has(key)){const image=cache.get(key);cache.delete(key);cache.set(key,image);return image;}
    if(pending.has(key))return pending.get(key);
    const job=new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>{cache.set(key,image);while(cache.size>(innerWidth<620?2:3)){const old=[...cache.keys()].find(k=>k!==key);if(!old)break;cache.delete(old);}pending.delete(key);resolve(image);};image.onerror=()=>{pending.delete(key);reject(new Error(`Could not load ${key}`));};image.src=new URL(`web/${page.file}`,assetBase).href;});
    pending.set(key,job);return job;
  }
  async function setState(name,seconds=0){
    const id=++token;transitioning=true;stateUntil=0;status.textContent=`准备${names[name]||name}……`;
    try{await load(name);if(id!==token)return false;state=name;transitioning=false;clipStart=performance.now();stateUntil=seconds?clipStart+seconds*1000:0;status.textContent=names[name]||name;pet.setAttribute('aria-label',`大肥鱼：${names[name]||name}。点击互动，右键选择动作。`);if(manifest.clips[name].pages.length>1)load(name,manifest.clips[name].pages[1].firstFrame).catch(()=>{});return true;}
    catch(error){if(id===token){transitioning=false;decisionAt=performance.now()+5000;status.textContent='这个动作暂时没有加载好';say('点一下，再试试吧。');console.error(error);}return false;}
  }
  function goIdle(delay=4500){sequence=[];destination=null;setState('idle');decisionAt=performance.now()+delay;}
  function runSequence(steps,text){destination=null;sequence=steps.slice(1);if(text)say(text);setState(steps[0].name,steps[0].seconds);decisionAt=Infinity;}
  function walk(dir=null){
    const b=bounds(),target=dir==='left'?b.minX+15:dir==='right'?b.maxX-15:b.minX+Math.random()*(b.maxX-b.minX);
    if(Math.abs(target-x)<45){goIdle(1500);return;}
    sequence=[];destination={x:target,y:b.maxY-Math.random()*Math.min(65,Math.max(0,b.maxY-b.minY))};
    setState(target>x?'running-right':'running-left');decisionAt=Infinity;
  }
  function action(name){
    closeMenu();drag=null;pet.classList.remove('dragging');sequence=[];destination=null;
    const duration=n=>(manifest.clips[n].frames/manifest.clips[n].fps);
    if(name==='work')runSequence([{name:'laptop-intro',seconds:duration('laptop-intro')},{name:'running',seconds:7}], '小电脑放好，开始工作！');
    else if(name==='rice')runSequence([{name:'rice-intro',seconds:duration('rice-intro')},{name:'review',seconds:7}], '啊呜！你也要好好吃饭哦。');
    else if(name==='rest')runSequence([{name:'waiting',seconds:7},{name:'sleepy-stretch',seconds:duration('sleepy-stretch')}], '抱着小鲸鱼，歇一小会儿。');
    else if(name==='stretch')runSequence([{name:'sleepy-stretch',seconds:duration('sleepy-stretch')}], '忙了一会儿，伸个懒腰～');
    else if(name==='left'||name==='right')walk(name);
    else if(name==='idle'){goIdle(6000);say('好呀，就在这里陪你。');}
    else {const key=name==='wave'?'waving':name==='jump'?'jumping':'failed';runSequence([{name:key,seconds:duration(key)*2}],key==='waving'?'你好呀，我在呢！':key==='jumping'?'好耶！发现你啦！':'呜……再试一次就好。');}
  }
  function chooseRandom(){
    const n=Math.random();if(n<.4)walk();else if(n<.57)action('work');else if(n<.71)action('rice');else if(n<.86)action('rest');else if(n<.94)action('stretch');else action('jump');
  }
  function paint(now){
    const c=manifest.clips[state];if(!c)return;
    let index=Math.max(0,Math.floor((now-clipStart)/1000*c.fps));
    if(reduced.matches&&!stateUntil)index=0;else index=c.loop?index%c.frames:Math.min(c.frames-1,index);
    const page=pageFor(state,index),key=pageKey(state,page),image=cache.get(key);
    if(!image){load(state,index).catch(()=>{});return;}
    cache.delete(key);cache.set(key,image);
    const local=index-page.firstFrame,cols=page.columns||c.columns;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,local%cols*c.frameWidth,Math.floor(local/cols)*c.frameHeight,c.frameWidth,c.frameHeight,0,0,canvas.width,canvas.height);
    if(!reduced.matches&&index>=page.firstFrame+page.frames-12){let next=page.firstFrame+page.frames;if(next>=c.frames)next=c.loop?0:-1;if(next>=0)load(state,next).catch(()=>{});}
  }
  function loop(now){
    if(!visible)return;
    const dt=Math.min(.05,last?(now-last)/1000:0);last=now;
    if(!paused&&!menuOpen&&!drag&&!transitioning){
      if(destination){
        const dx=destination.x-x,dy=destination.y-y,length=Math.hypot(dx,dy),speed=innerWidth<620?72:103;
        if(length<3){x=destination.x;y=destination.y;goIdle(2800+Math.random()*4500);}else{x+=dx/length*Math.min(length,speed*dt);y+=dy/length*Math.min(length,speed*dt);position();}
      }else if(stateUntil&&now>=stateUntil){
        if(sequence.length){const next=sequence.shift();setState(next.name,next.seconds);}else goIdle(3500+Math.random()*6000);
      }else if(!stateUntil&&automatic&&now>=decisionAt)chooseRandom();
    }
    if(!paused)paint(now);
    if(speechUntil&&now>speechUntil){bubble.classList.remove('show');speechUntil=0;}
    raf=requestAnimationFrame(loop);
  }
  function closeMenu(){menu.hidden=true;menuOpen=false;root.querySelector('[data-menu]').setAttribute('aria-expanded','false');}
  function openMenu(px,py){menu.hidden=false;menuOpen=true;root.querySelector('[data-menu]').setAttribute('aria-expanded','true');const r=menu.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-r.width-10,px))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-r.height-10,py))}px`;menu.querySelector('button').focus();}
  on(pet,'contextmenu',e=>{e.preventDefault();openMenu(e.clientX,e.clientY);});
  on(pet,'pointerdown',e=>{if(e.button!==0)return;dragged=false;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x,y};pet.setPointerCapture(e.pointerId);longPress=setTimeout(()=>{if(drag&&!dragged){openMenu(e.clientX,e.clientY);drag=null;}},550);});
  on(pet,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>7){dragged=true;clearTimeout(longPress);pet.classList.add('dragging');destination=null;sequence=[];x=drag.x+dx;y=drag.y+dy;constrain();}});
  on(pet,'pointerup',e=>{clearTimeout(longPress);if(!drag)return;drag=null;pet.classList.remove('dragging');if(!dragged){action(['wave','jump','wave','rest'][Math.floor(Math.random()*4)]);}else{goIdle(6500);say('换个位置，也继续陪着你。');}});
  on(pet,'pointercancel',()=>{clearTimeout(longPress);drag=null;pet.classList.remove('dragging');});
  on(pet,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action('wave');}if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=pet.getBoundingClientRect();openMenu(r.x+r.width*.6,r.y);}});
  on(document,'pointerdown',e=>{if(menuOpen&&!e.composedPath().includes(menu)&&!e.composedPath().some(n=>n.matches?.('[data-menu]')))closeMenu();});
  on(menu,'keydown',e=>{const items=[...menu.querySelectorAll('button')];if(e.key==='Escape'){closeMenu();pet.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
  root.querySelectorAll('[data-action]').forEach(button=>on(button,'click',()=>action(button.dataset.action)));
  root.querySelectorAll('[data-auto]').forEach(button=>on(button,'click',()=>{automatic=!automatic;syncAuto();closeMenu();if(automatic){decisionAt=performance.now()+2000;say('好呀，我自己逛一会儿。');}else{destination=null;goIdle(Infinity);say('好，就在这里待着。');}}));
  on(root.querySelector('[data-menu]'),'click',e=>{const r=e.currentTarget.getBoundingClientRect();if(menuOpen)closeMenu();else openMenu(r.x,r.y-400);});
  on(root.querySelector('[data-size]'),'click',()=>{(embedded?root.host:document.body).classList.toggle('pet-size-large');closeMenu();constrain();});
  on(root.querySelector('[data-pause]'),'click',e=>{paused=!paused;e.currentTarget.textContent=paused?'继续动画':'暂停动画';e.currentTarget.setAttribute('aria-pressed',String(paused));if(paused)pausedAt=performance.now();else{const delta=performance.now()-pausedAt;clipStart+=delta;if(stateUntil)stateUntil+=delta;decisionAt+=delta;}});
  const help=root.querySelector('#help');on(root.querySelector('[data-help]'),'click',()=>help.showModal());on(help.querySelector('button'),'click',()=>help.close());
  on(window,'resize',constrain);
  on(document,'visibilitychange',()=>{if(document.hidden){visible=false;hiddenAt=performance.now();cancelAnimationFrame(raf);}else{const delta=performance.now()-hiddenAt;clipStart+=delta;if(stateUntil)stateUntil+=delta;decisionAt+=delta;visible=true;last=0;raf=requestAnimationFrame(loop);}});
  on(window,'pagehide',()=>{cancelAnimationFrame(raf);clearTimeout(longPress);abort.abort();cache.clear();pending.clear();});
  canvas.width=384;canvas.height=416;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const b=bounds();x=Math.min(b.maxX,innerWidth*.6);y=b.maxY;position();syncAuto();
  setState('idle').then(()=>{say(reduced.matches?'我在这里。你可以点我互动。':'你好呀，我会自己逛一会儿～');decisionAt=performance.now()+4500;});raf=requestAnimationFrame(loop);
  // Introspection supports deterministic behavior checks without changing user timing.
  return {get state(){return state;},get position(){return {x,y};},get automatic(){return automatic;},get cacheSize(){return cache.size;},action,dispose:()=>{cancelAnimationFrame(raf);abort.abort();clearTimeout(longPress);cache.clear();}};
};
if(!window.DEEPSEEK_EMBED_ONLY)window.petCompanion=window.createDeepSeekCompanion();

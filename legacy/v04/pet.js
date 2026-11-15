/* Live parameterized companion; generated pixels stay registered to one model. */
window.createDeepSeekCompanion=(root=document,assetBase=document.baseURI)=>{
  const embedded=root!==document,pet=root.querySelector('#pet'),canvas=pet.querySelector('canvas'),bubble=pet.querySelector('.speech'),status=root.querySelector('#status'),menu=root.querySelector('#menu'),motion=window.DeepSeekMotion;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),abort=new AbortController(),on=(el,type,fn,options={})=>el?.addEventListener(type,fn,{...options,signal:abort.signal});
  const overlay=document.createElement('canvas');overlay.className='prop-overlay';overlay.setAttribute('aria-hidden','true');pet.append(overlay);
  const names={idle:'眨眼发呆',walk:'小步走动',wave:'挥手打招呼',jump:'开心跳一下',failed:'歪头撒个娇',rest:'抱着小鲸鱼休息',work:'搬出电脑，打开工作',rice:'端碗、舀饭、慢慢吃',stretch:'伸个懒腰',think:'歪头想一想'};
  let player=null,propRenderer=null,ready=false,disposed=false,raf=0,last=0,state='idle',start=performance.now(),until=0,nextDecision=start+5000,automatic=!reduced.matches;
  let x=0,y=0,destination=null,drag=null,dragged=false,longPress=null,paused=false,menuOpen=false,freezeAt=0,frozenTotal=0,hidden=false,hiddenAt=0,speechUntil=0;
  let walkAmount=0,gait=0,lastPose=null,exitPose=null,exitStart=0,queued=null,blendFrom=null,blendStart=0;
  const nowClock=now=>(now-frozenTotal)/1000;
  const readyPromise=(async()=>{
    const {P2LPlayer}=await import(new URL('model/p2l.js',assetBase));
    player=await P2LPlayer.create(canvas,new URL('model/p2l_runtime.wasm',assetBase),new URL('model/model.p2lrt',assetBase));
    player.stop();player.play(null);player.behaviors(0);player.setAdvanced(0);propRenderer=await window.createDeepSeekProps(overlay,assetBase);
    if(disposed){player.dispose();return;}ready=true;status.textContent=names.idle;
  })().catch(error=>{status.textContent='模型暂时没有加载好';console.error(error);});
  function say(text){bubble.textContent=text;bubble.classList.add('show');speechUntil=performance.now()+3200;}
  function bounds(){const r=pet.getBoundingClientRect();return{minX:0,maxX:Math.max(0,innerWidth-r.width),minY:Math.min(embedded?75:140,innerHeight*.2),maxY:Math.max(120,innerHeight-r.height-(embedded?50:75))};}
  function position(){pet.style.transform=`translate3d(${x}px,${y}px,0)`;}
  function constrain(){const b=bounds();x=Math.max(b.minX,Math.min(b.maxX,x));y=Math.max(b.minY,Math.min(b.maxY,y));if(destination){destination.x=Math.max(b.minX,Math.min(b.maxX,destination.x));destination.y=Math.max(b.minY,Math.min(b.maxY,destination.y));}position();}
  function syncAuto(){root.querySelectorAll('[data-auto]').forEach(b=>{b.setAttribute('aria-pressed',String(automatic));b.textContent=automatic?'自动闲逛':'开始闲逛';});}
  function setState(name,seconds=0){blendFrom=lastPose;blendStart=performance.now();state=name;start=performance.now();until=seconds?start+seconds*1000:0;status.textContent=names[name]||name;pet.setAttribute('aria-label',`大肥鱼：${names[name]||name}。点击互动，右键选择动作。`);}
  function idle(delay=5000){destination=null;setState('idle');nextDecision=performance.now()+delay;}
  function walk(direction){const b=bounds(),target=direction==='left'?b.minX:direction==='right'?b.maxX:b.minX+Math.random()*(b.maxX-b.minX);if(Math.abs(target-x)<40){idle(2000);return;}destination={x:target,y:b.maxY-Math.random()*Math.min(40,b.maxY-b.minY)};setState('walk');nextDecision=Infinity;}
  function begin(name){
    destination=null;drag=null;pet.classList.remove('dragging');
    if(name==='left'||name==='right'){walk(name);return;}if(name==='idle'){idle(6000);say('好呀，就在这里陪你。');return;}
    setState(name,motion.duration[name]||6);nextDecision=Infinity;
    say(({work:'搬出小电脑，打开以后认真工作。',rice:'端稳小饭碗，一口一口吃。',rest:'抱着小鲸鱼，歇一小会儿。',wave:'你好呀，我在呢！',jump:'好耶！发现你啦！',stretch:'忙了一会儿，伸个懒腰～',think:'唔……让我认真想一想。',failed:'蹭蹭～再陪我一会儿嘛。'})[name]||'我在这里。');
  }
  function action(name){closeMenu();if(lastPose?.props.some(x=>x.alpha>.01)&&state!=='idle'){if(!exitPose){exitPose=structuredClone(lastPose);exitStart=performance.now();}queued=name;destination=null;say(state==='work'?'等我收好小电脑～':'等我把手里的东西放好～');}else begin(name);}
  function choose(){const n=Math.random();if(n<.38)walk();else action(n<.56?'work':n<.73?'rice':n<.86?'rest':n<.94?'think':'wave');}
  function paint(now,dt,forced=null){
    if(!ready)return;const clock=forced?.clock??nowClock(now),target=destination?1:0;
    walkAmount+=(target-walkAmount)*(1-Math.exp(-dt/.23));gait+=dt*18*walkAmount;
    let pose=forced?motion.sample(forced.name,forced.t,clock,forced.walk||0,forced.gait??clock*18):motion.sample(state==='walk'?'idle':state,(now-start)/1000,clock,walkAmount,gait);
    if(exitPose&&!forced){const t=(now-exitStart)/1000;pose=motion.exit(exitPose,t,clock);if(t>=1.8){exitPose=null;const name=queued;queued=null;begin(name||'idle');pose=motion.sample(state,0,clock);}}
    else if(blendFrom&&!forced){
      const u=motion.ease((now-blendStart)/550);
      if(!pose.props.some(pr=>pr.alpha>.01)){
        const seat=motion.mix(blendFrom.parameters.ParamSeat,pose.parameters.ParamSeat,u),p={...pose.parameters,ParamSeat:seat};
        const left=motion.armPath('L',blendFrom.left,pose.left,u,seat),right=motion.armPath('R',blendFrom.right,pose.right,u,seat),L=motion.ik('L',[left[0],left[1]-65*seat]),R=motion.ik('R',[right[0],right[1]-65*seat]);
        for(const id of ['ParamHeadTilt','ParamBodyTilt','ParamBodyBob','ParamHairSway','ParamTailSwing','ParamEyeLOpen','ParamEyeROpen','ParamMouthOpenY'])p[id]=motion.mix(blendFrom.parameters[id],p[id],u);
        p.ParamArmScreenL=L.upper;p.ParamElbowScreenL=L.elbow;p.ParamArmScreenR=R.upper;p.ParamElbowScreenR=R.elbow;
        const wrist=sol=>-Math.atan2(Math.sin((sol.upper+sol.elbow)*Math.PI/180),Math.cos((sol.upper+sol.elbow)*Math.PI/180))*180/Math.PI*(1-p.ParamPropMode);
        p.ParamWristScreenL=wrist(L);p.ParamWristScreenR=wrist(R);pose={...pose,parameters:p,left,right};
      }
      if(u>=1)blendFrom=null;
    }
    player.view.zoom=1.08;player.view.y=0;player.view.x=0;
    for(const [id,value] of Object.entries(pose.parameters))player.setParameter(id,value);
    player.update(dt);player.draw();propRenderer.draw(pose,player);lastPose=pose;
    const shadow=pet.querySelector('.shadow');if(shadow)shadow.style.opacity=String(.24+.08*pose.parameters.ParamSeat);
  }
  function loop(now){
    if(disposed||hidden)return;const dt=Math.min(.05,last?(now-last)/1000:0);last=now;
    if(!paused&&!menuOpen&&!drag){
      if(destination&&!exitPose){const dx=destination.x-x,dy=destination.y-y,len=Math.hypot(dx,dy),speed=36*walkAmount*Math.min(1,Math.sqrt(len/22));if(len<1.5){x=destination.x;y=destination.y;idle(3500+Math.random()*4000);}else{x+=dx/len*Math.min(len,speed*dt);y+=dy/len*Math.min(len,speed*dt);position();}}
      else if(!exitPose&&until&&now>=until)idle(4000+Math.random()*5000);
      else if(!exitPose&&!until&&automatic&&now>=nextDecision)choose();
      paint(now,dt);
    }
    if(speechUntil&&now>speechUntil){bubble.classList.remove('show');speechUntil=0;}raf=requestAnimationFrame(loop);
  }
  function freeze(){if(!freezeAt)freezeAt=performance.now();}
  function thaw(){if(freezeAt&&!paused&&!menuOpen){const d=performance.now()-freezeAt;start+=d;if(until)until+=d;nextDecision+=d;exitStart+=d;blendStart+=d;frozenTotal+=d;freezeAt=0;last=0;}}
  function closeMenu(){menu.hidden=true;menuOpen=false;root.querySelector('[data-menu]')?.setAttribute('aria-expanded','false');thaw();}
  function openMenu(px,py){freeze();menuOpen=true;menu.hidden=false;root.querySelector('[data-menu]')?.setAttribute('aria-expanded','true');const r=menu.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-r.width-10,px))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-r.height-10,py))}px`;menu.querySelector('button')?.focus();}
  on(pet,'contextmenu',e=>{e.preventDefault();openMenu(e.clientX,e.clientY);});
  on(pet,'pointerdown',e=>{if(e.button!==0)return;dragged=false;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x,y};pet.setPointerCapture(e.pointerId);longPress=setTimeout(()=>{if(drag&&!dragged){openMenu(e.clientX,e.clientY);drag=null;}},550);});
  on(pet,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>7){dragged=true;clearTimeout(longPress);destination=null;pet.classList.add('dragging');x=drag.x+dx;y=drag.y+dy;constrain();}});
  on(pet,'pointerup',()=>{clearTimeout(longPress);if(!drag)return;drag=null;pet.classList.remove('dragging');if(!dragged)action(['wave','jump','think'][Math.floor(Math.random()*3)]);else{action('idle');say('换个位置，也继续陪着你。');}});
  on(pet,'pointercancel',()=>{clearTimeout(longPress);drag=null;pet.classList.remove('dragging');});
  on(pet,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action('wave');}if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=pet.getBoundingClientRect();openMenu(r.x+r.width*.6,r.y);}});
  on(document,'pointerdown',e=>{if(menuOpen&&!e.composedPath().includes(menu)&&!e.composedPath().some(n=>n.matches?.('[data-menu]')))closeMenu();});
  on(menu,'keydown',e=>{const items=[...menu.querySelectorAll('button')];if(e.key==='Escape'){closeMenu();pet.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const current=items.indexOf((root.activeElement||document.activeElement));items[e.key==='Home'?0:e.key==='End'?items.length-1:(current+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
  root.querySelectorAll('[data-action]').forEach(b=>on(b,'click',()=>action(b.dataset.action)));
  root.querySelectorAll('[data-auto]').forEach(b=>on(b,'click',()=>{automatic=!automatic;syncAuto();closeMenu();if(automatic){nextDecision=performance.now()+2000;say('好呀，我自己逛一会儿。');}else{destination=null;action('idle');nextDecision=Infinity;}}));
  on(root.querySelector('[data-menu]'),'click',e=>{const r=e.currentTarget.getBoundingClientRect();if(menuOpen)closeMenu();else openMenu(r.x,r.y-400);});
  on(root.querySelector('[data-size]'),'click',()=>{(embedded?root.host:document.body).classList.toggle('pet-size-large');closeMenu();constrain();});
  on(root.querySelector('[data-pause]'),'click',e=>{paused=!paused;e.currentTarget.textContent=paused?'继续动画':'暂停动画';e.currentTarget.setAttribute('aria-pressed',String(paused));if(paused)freeze();else thaw();});
  const help=root.querySelector('#help');on(root.querySelector('[data-help]'),'click',()=>help.showModal());on(help?.querySelector('button'),'click',()=>help.close());
  on(window,'resize',constrain);
  on(document,'visibilitychange',()=>{if(document.hidden){hidden=true;hiddenAt=performance.now();cancelAnimationFrame(raf);}else{const d=performance.now()-hiddenAt;start+=d;if(until)until+=d;nextDecision+=d;exitStart+=d;blendStart+=d;frozenTotal+=d;hidden=false;last=0;raf=requestAnimationFrame(loop);}});
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);clearTimeout(longPress);abort.abort();overlay.remove();player?.dispose();}
  on(window,'pagehide',dispose);canvas.width=768;canvas.height=832;const b=bounds();x=Math.min(b.maxX,innerWidth*.6);y=b.maxY;position();syncAuto();
  readyPromise.then(()=>{if(ready){say(reduced.matches?'我在这里。你可以点我互动。':'你好呀，我会自己逛一会儿～');start=performance.now();nextDecision=start+5000;}});raf=requestAnimationFrame(loop);
  return{readyPromise,get ready(){return ready;},get player(){return player;},get pose(){return lastPose;},get state(){return state;},get position(){return{x,y};},get automatic(){return automatic;},get cacheSize(){return 1;},action,dispose,renderAt:(name,t,clock=t,walk=0,gait=clock*18)=>{destination=null;exitPose=null;blendFrom=null;state=name;start=performance.now()-t*1000;paint(performance.now(),1/60,{name,t,clock,walk,gait});return lastPose;}};
};
if(!window.DEEPSEEK_EMBED_ONLY)window.petCompanion=window.createDeepSeekCompanion(document,new URL('.',document.currentScript.src));

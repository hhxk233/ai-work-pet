/* One continuously evaluated layered rig. No generated-frame interpolation. */
window.createDeepSeekCompanion=(root=document,assetBase=document.baseURI) => {
  const embedded=root!==document;
  const pet=root.querySelector('#pet'),canvas=pet.querySelector('canvas'),bubble=pet.querySelector('.speech'),status=root.querySelector('#status'),menu=root.querySelector('#menu');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const abort=new AbortController(),on=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:abort.signal});
  const cache=new Map();let player=null,ready=false,disposed=false,walkAmount=0,gait=0,lastPose=null,abortPose=null,abortStarted=0,queuedAction=null,menuOpenedAt=0,blendFrom=null,blendStarted=0;
  const overlay=document.createElement('canvas');overlay.className='prop-overlay';overlay.setAttribute('aria-hidden','true');pet.append(overlay);const propCtx=overlay.getContext('2d');
  const props=new Map(),motion=window.DeepSeekMotion;let rigDrive=null;
  const readyPromise=(async()=>{
    const {P2LPlayer}=await import(new URL('model/p2l.js',assetBase));
    player=await P2LPlayer.create(canvas,new URL('model/p2l_runtime.wasm',assetBase),new URL('model/model.p2lrt',assetBase));
    player.stop();player.play(null);player.behaviors(0);player.setAdvanced(0);
    if(!player.parameterRanges().some(p=>p.id==='ParamArmScreenL')){const map=await fetch(new URL('model/mesh-map.json',assetBase)).then(r=>r.json());rigDrive=window.bindDeepSeekRig(player,map);}
    for(const name of ['rice-bowl','rice-spoon','rice-spoon-empty','laptop-base','laptop-lid','whale-plush','arm-left','arm-right']){const im=new Image();im.src=new URL(`rig/parts/${name}.png`,assetBase);await im.decode();props.set(name,im);}
    if(disposed){if(player?.rig)player.dispose();return;}ready=true;status.textContent='眨眼发呆';
  })().catch(error=>{status.textContent='模型暂时没有加载好';console.error(error);});
  let automatic=!reduced.matches,state='idle',clipStart=performance.now(),sequence=[],stateUntil=0,decisionAt=performance.now()+4500,token=0,raf=0,last=0,visible=true,hiddenAt=0,menuOpen=false,speechUntil=0,transitioning=false,pausedAt=0;
  let x=0,y=0,destination=null,drag=null,longPress=null,dragged=false,paused=false;
  const names={idle:'眨眼发呆',walk:'轻轻小跑',wave:'挥手打招呼',jump:'开心跳跃',failed:'委屈一下，再振作',rest:'抱着小鲸鱼休息',work:'打开电脑工作',rice:'端碗、舀饭、慢慢吃',stretch:'伸个懒腰',think:'抬头想一想'};
  const say=text=>{bubble.textContent=text;bubble.classList.add('show');speechUntil=performance.now()+3200;};
  function bounds(){const r=pet.getBoundingClientRect();return {w:r.width,h:r.height,minX:-r.width*.12,maxX:Math.max(0,innerWidth-r.width*.88),minY:Math.min(embedded?80:150,innerHeight*.25),maxY:Math.max(160,innerHeight-r.height-(embedded?52:75))};}
  function constrain(){const b=bounds();x=Math.max(b.minX,Math.min(b.maxX,x));y=Math.max(b.minY,Math.min(b.maxY,y));if(destination){destination.x=Math.max(b.minX,Math.min(b.maxX,destination.x));destination.y=Math.max(b.minY,Math.min(b.maxY,destination.y));}position();}
  function position(){pet.style.transform=`translate3d(${x}px,${y}px,0)`;}
  function syncAuto(){root.querySelectorAll('[data-auto]').forEach(b=>{b.setAttribute('aria-pressed',String(automatic));b.textContent=automatic?'自动闲逛':'开始闲逛';});}
  async function setState(name,seconds=0){
    blendFrom=lastPose?{...lastPose.parameters}:null;blendStarted=performance.now();state=name;clipStart=performance.now();stateUntil=seconds?clipStart+seconds*1000:0;transitioning=false;status.textContent=names[name]||name;
    pet.setAttribute('aria-label',`大肥鱼：${names[name]||name}。点击互动，右键选择动作。`);return true;
  }
  function goIdle(delay=4500){sequence=[];destination=null;setState('idle');decisionAt=performance.now()+delay;}
  function runSequence(steps,text){destination=null;sequence=steps.slice(1);if(text)say(text);setState(steps[0].name,steps[0].seconds);decisionAt=Infinity;}
  function walk(dir=null){
    const b=bounds(),target=dir==='left'?b.minX+15:dir==='right'?b.maxX-15:b.minX+Math.random()*(b.maxX-b.minX);
    if(Math.abs(target-x)<45){goIdle(1500);return;}
    sequence=[];destination={x:target,y:b.maxY-Math.random()*Math.min(65,Math.max(0,b.maxY-b.minY))};
    setState('walk');decisionAt=Infinity;
  }
  function beginAction(name){
    closeMenu();drag=null;pet.classList.remove('dragging');sequence=[];destination=null;
    if(name==='left'||name==='right'){walk(name);return;}
    if(name==='idle'){goIdle(6000);say('好呀，就在这里陪你。');return;}
    const text={work:'小电脑放好，慢慢打开，开始工作！',rice:'端稳小饭碗，一口一口慢慢吃。',rest:'抱着小鲸鱼，歇一小会儿。',wave:'你好呀，我在呢！',jump:'好耶！发现你啦！',stretch:'忙了一会儿，伸个懒腰～',think:'唔……让我认真想一想。',failed:'呜……再试一次就好。'};
    say(text[name]||text.wave);setState(name,motion.duration[name]||6);decisionAt=Infinity;
  }
  function action(name){
    closeMenu();
    if(lastPose?.props.length&&state!=='idle'){
      if(!abortPose){abortPose=structuredClone(lastPose);abortStarted=performance.now();}
      queuedAction=name;destination=null;return;
    }
    beginAction(name);
  }
  function chooseRandom(){
    const n=Math.random();if(n<.4)walk();else if(n<.57)action('work');else if(n<.71)action('rice');else if(n<.86)action('rest');else if(n<.94)action('stretch');else action('jump');
  }
  function drawProps(pose){
    const r=canvas.getBoundingClientRect(),ratio=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));
    if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
    propCtx.setTransform(1,0,0,1,0,0);propCtx.clearRect(0,0,w,h);
    const scale=Math.min(r.width/640,r.height/640)*player.view.zoom;
    propCtx.setTransform(scale*ratio,0,0,scale*ratio,(r.width/2-320*scale+player.view.x)*ratio,(r.height/2-320*scale+player.view.y)*ratio);
    propCtx.translate(320,279+pose.parameters.ParamBodyBob);propCtx.rotate(pose.parameters.ParamBodyTilt*Math.PI/180);propCtx.translate(-320,-279);
    // Closed lid covers the keyboard; its unchanged hinge stays at the base's rear edge.
    const ordered=pose.props;
    for(const pr of ordered){const im=props.get(pr.name);if(!im||pr.alpha<=.001)continue;propCtx.save();propCtx.globalAlpha=pr.alpha;propCtx.translate(pr.x,pr.y);propCtx.rotate(pr.angle||0);
      if(pr.kind==='lid'){
        // A single rigid lid projects around its unchanged lower hinge. Closed: extends toward the viewer.
        const angle=pr.open*Math.PI*.50,sy=-.90*Math.cos(angle)+Math.sin(angle);
        if(pr.open>.99){propCtx.scale(pr.scale,pr.scale*sy);propCtx.drawImage(im,-pr.pivot[0],-pr.pivot[1]);}
        else if(Math.abs(sy)>.002){
          const project=(x,y)=>[(x-pr.pivot[0])*pr.scale*(1+.42*(1-y/277)*Math.cos(angle)),(y-pr.pivot[1])*pr.scale*sy];
          const A=[0,0],B=[im.width,0],C=[im.width,im.height],D=[0,im.height];
          for(const tri of [[A,B,D],[B,C,D]]){
            const [a,b,c]=tri,[u,v,z]=tri.map(q=>project(...q));
            const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
            const aa=((v[0]-u[0])*(c[1]-a[1])-(z[0]-u[0])*(b[1]-a[1]))/det,cc=((z[0]-u[0])*(b[0]-a[0])-(v[0]-u[0])*(c[0]-a[0]))/det;
            const bb=((v[1]-u[1])*(c[1]-a[1])-(z[1]-u[1])*(b[1]-a[1]))/det,dd=((z[1]-u[1])*(b[0]-a[0])-(v[1]-u[1])*(c[0]-a[0]))/det;
            propCtx.save();propCtx.beginPath();propCtx.moveTo(...u);propCtx.lineTo(...v);propCtx.lineTo(...z);propCtx.closePath();propCtx.clip();
            propCtx.transform(aa,bb,cc,dd,u[0]-aa*a[0]-cc*a[1],u[1]-bb*a[0]-dd*a[1]);propCtx.drawImage(im,0,0);propCtx.restore();
          }
        }
        propCtx.restore();continue;
      }
      propCtx.scale(pr.mirror?-pr.scale:pr.scale,pr.scale);
      if(pr.kind==='spoon'){propCtx.drawImage(props.get('rice-spoon-empty'),-pr.pivot[0],-pr.pivot[1]);propCtx.globalAlpha=pr.alpha*(pr.food??1);}
      propCtx.drawImage(im,-pr.pivot[0],-pr.pivot[1]);propCtx.restore();
    }
    {
      // Only the original cuffs/hands pass in front of props; rounded model joints remain unobscured.
      for(const side of ['L','R']){
        const im=props.get(side==='L'?'arm-left':'arm-right'),S=side==='L'?[278,303]:[362,303],E=side==='L'?[265,357]:[374,357];
        const origin=side==='L'?[278-192*.26,303-73*.26]:[362-115*.26,303-73*.26];
        const a=pose.parameters[`ParamArmScreen${side}`]*Math.PI/180,b=pose.parameters[`ParamElbowScreen${side}`]*Math.PI/180;
        const ex=S[0]+Math.cos(a)*(E[0]-S[0])-Math.sin(a)*(E[1]-S[1]),ey=S[1]+Math.sin(a)*(E[0]-S[0])+Math.cos(a)*(E[1]-S[1]);
        if(pose.props.length){propCtx.save();propCtx.translate(ex,ey);propCtx.rotate(a+b);propCtx.drawImage(im,0,470,im.width,im.height-470,origin[0]-E[0],origin[1]+470*.26-E[1],im.width*.26,(im.height-470)*.26);propCtx.restore();}
      }
    }
  }
  function paint(now,dt,forced=null){
    if(!ready)return;
    const targetWalk=destination&&!drag&&!menuOpen?1:0;
    walkAmount+=(targetWalk-walkAmount)*(1-Math.exp(-dt/0.22));gait+=dt*(2+7*walkAmount);
    let pose=forced?motion.sample(forced.name,forced.t,forced.clock,forced.walk||0,forced.gait||forced.clock*8):motion.sample(state==='walk'?'idle':state,(now-clipStart)/1000,now/1000,walkAmount,gait);
    if(abortPose){
      const t=Math.min(1,(now-abortStarted)/1500),u=motion.ease(t),rest=motion.sample('idle',now/1000,now/1000);
      const k=motion.ease((t-.24)/.76);pose=structuredClone(abortPose);
      for(const id in pose.parameters)pose.parameters[id]=motion.mix(abortPose.parameters[id],rest.parameters[id],k);
      const L=motion.ik('L',[motion.mix(abortPose.left[0],254,k)-30*Math.sin(k*Math.PI),motion.mix(abortPose.left[1],413,k)]),R=motion.ik('R',[motion.mix(abortPose.right[0],386,k)+42*Math.sin(k*Math.PI),motion.mix(abortPose.right[1],413,k)]);
      pose.left=L.hand;pose.right=R.hand;pose.parameters.ParamArmScreenL=L.upper;pose.parameters.ParamElbowScreenL=L.elbow;pose.parameters.ParamArmScreenR=R.upper;pose.parameters.ParamElbowScreenR=R.elbow;
      pose.props=pose.props.map(pr=>{let x=pr.x,y=pr.y;if(pr.kind==='spoon'){[x,y]=R.hand;}else if(pr.name==='rice-bowl'){x=L.hand[0]+30;y=L.hand[1]-13;}else{x=(L.hand[0]+R.hand[0])/2;y=(L.hand[1]+R.hand[1])/2-(pr.name==='whale-plush'?13:9);}return {...pr,x,y,open:pr.kind==='lid'?motion.mix(pr.open,0,motion.ease(t/.28)):pr.open,alpha:pr.alpha*(1-motion.ease((t-.38)/.45))};});
      if(t>=1){abortPose=null;const next=queuedAction;queuedAction=null;beginAction(next||'idle');pose=motion.sample('idle',now/1000,now/1000);}
    }
    else if(blendFrom&&!forced){const u=motion.ease((now-blendStarted)/550);for(const id in pose.parameters)pose.parameters[id]=motion.mix(blendFrom[id]??pose.parameters[id],pose.parameters[id],u);if(u>=1)blendFrom=null;}
    player.view.zoom=1.22;player.view.y=canvas.clientHeight*.085;
    for(const [id,value] of Object.entries(pose.parameters))player.setParameter(id,value);
    player.update(dt);rigDrive?.apply(pose);player.draw();drawProps(pose);lastPose=pose;
  }
  function loop(now){
    if(!visible)return;
    const dt=Math.min(.05,last?(now-last)/1000:0);last=now;
    if(!paused&&!menuOpen&&!drag&&!transitioning&&!abortPose){
      if(destination){
        const dx=destination.x-x,dy=destination.y-y,length=Math.hypot(dx,dy),speed=(innerWidth<620?72:103)*Math.max(.05,walkAmount)*Math.min(1,Math.sqrt(length/35));
        if(length<3){x=destination.x;y=destination.y;goIdle(2800+Math.random()*4500);}else{x+=dx/length*Math.min(length,speed*dt);y+=dy/length*Math.min(length,speed*dt);position();}
      }else if(stateUntil&&now>=stateUntil){
        if(sequence.length){const next=sequence.shift();setState(next.name,next.seconds);}else goIdle(3500+Math.random()*6000);
      }else if(!stateUntil&&automatic&&now>=decisionAt)chooseRandom();
    }
    if(!paused&&!menuOpen)paint(now,dt);
    if(speechUntil&&now>speechUntil){bubble.classList.remove('show');speechUntil=0;}
    raf=requestAnimationFrame(loop);
  }
  function closeMenu(){if(menuOpen&&!paused){const delta=performance.now()-menuOpenedAt;clipStart+=delta;if(stateUntil)stateUntil+=delta;decisionAt+=delta;if(abortPose)abortStarted+=delta;}menu.hidden=true;menuOpen=false;root.querySelector('[data-menu]').setAttribute('aria-expanded','false');}
  function openMenu(px,py){if(!menuOpen)menuOpenedAt=performance.now();menu.hidden=false;menuOpen=true;root.querySelector('[data-menu]').setAttribute('aria-expanded','true');const r=menu.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-r.width-10,px))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-r.height-10,py))}px`;menu.querySelector('button').focus();}
  on(pet,'contextmenu',e=>{e.preventDefault();openMenu(e.clientX,e.clientY);});
  on(pet,'pointerdown',e=>{if(e.button!==0)return;dragged=false;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x,y};pet.setPointerCapture(e.pointerId);longPress=setTimeout(()=>{if(drag&&!dragged){openMenu(e.clientX,e.clientY);drag=null;}},550);});
  on(pet,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>7){dragged=true;clearTimeout(longPress);pet.classList.add('dragging');destination=null;sequence=[];x=drag.x+dx;y=drag.y+dy;constrain();}});
  on(pet,'pointerup',e=>{clearTimeout(longPress);if(!drag)return;drag=null;pet.classList.remove('dragging');if(!dragged){action(['wave','jump','wave','rest'][Math.floor(Math.random()*4)]);}else{action('idle');say('换个位置，也继续陪着你。');}});
  on(pet,'pointercancel',()=>{clearTimeout(longPress);drag=null;pet.classList.remove('dragging');});
  on(pet,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action('wave');}if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=pet.getBoundingClientRect();openMenu(r.x+r.width*.6,r.y);}});
  on(document,'pointerdown',e=>{if(menuOpen&&!e.composedPath().includes(menu)&&!e.composedPath().some(n=>n.matches?.('[data-menu]')))closeMenu();});
  on(menu,'keydown',e=>{const items=[...menu.querySelectorAll('button')];if(e.key==='Escape'){closeMenu();pet.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
  root.querySelectorAll('[data-action]').forEach(button=>on(button,'click',()=>action(button.dataset.action)));
  root.querySelectorAll('[data-auto]').forEach(button=>on(button,'click',()=>{automatic=!automatic;syncAuto();closeMenu();if(automatic){decisionAt=performance.now()+2000;say('好呀，我自己逛一会儿。');}else{destination=null;goIdle(Infinity);say('好，就在这里待着。');}}));
  on(root.querySelector('[data-menu]'),'click',e=>{const r=e.currentTarget.getBoundingClientRect();if(menuOpen)closeMenu();else openMenu(r.x,r.y-400);});
  on(root.querySelector('[data-size]'),'click',()=>{(embedded?root.host:document.body).classList.toggle('pet-size-large');closeMenu();constrain();});
  on(root.querySelector('[data-pause]'),'click',e=>{paused=!paused;e.currentTarget.textContent=paused?'继续动画':'暂停动画';e.currentTarget.setAttribute('aria-pressed',String(paused));if(paused)pausedAt=performance.now();else{const delta=performance.now()-pausedAt;clipStart+=delta;if(stateUntil)stateUntil+=delta;decisionAt+=delta;if(abortPose)abortStarted+=delta;}});
  const help=root.querySelector('#help');on(root.querySelector('[data-help]'),'click',()=>help.showModal());on(help.querySelector('button'),'click',()=>help.close());
  on(window,'resize',constrain);
  on(document,'visibilitychange',()=>{if(document.hidden){visible=false;hiddenAt=performance.now();cancelAnimationFrame(raf);}else{const delta=performance.now()-hiddenAt;clipStart+=delta;if(stateUntil)stateUntil+=delta;decisionAt+=delta;if(abortPose)abortStarted+=delta;visible=true;last=0;raf=requestAnimationFrame(loop);}});
  on(window,'pagehide',()=>{cancelAnimationFrame(raf);clearTimeout(longPress);abort.abort();if(player?.rig)player.dispose();overlay.remove();disposed=true;});
  canvas.width=480;canvas.height=568;const b=bounds();x=Math.min(b.maxX,innerWidth*.6);y=b.maxY;position();syncAuto();
  setState('idle').then(()=>{say(reduced.matches?'我在这里。你可以点我互动。':'你好呀，我会自己逛一会儿～');decisionAt=performance.now()+4500;});raf=requestAnimationFrame(loop);
  // Introspection supports deterministic behavior checks without changing user timing.
  return {get state(){return state;},get position(){return {x,y};},get automatic(){return automatic;},get cacheSize(){return 1;},get ready(){return ready;},get pose(){return lastPose;},get player(){return player;},readyPromise,renderAt:(name,t,clock=t,walk=0)=>{state=name;clipStart=performance.now()-t*1000;destination=null;walkAmount=0;paint(performance.now(),1/60,{name,t,clock,walk});return lastPose;},action,dispose:()=>{cancelAnimationFrame(raf);abort.abort();clearTimeout(longPress);if(player?.rig)player.dispose();overlay.remove();disposed=true;}};
};
if(!window.DEEPSEEK_EMBED_ONLY)window.petCompanion=window.createDeepSeekCompanion(document,new URL('.',document.currentScript.src));

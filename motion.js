/* Authored continuous motion. All angles are degrees; all positions use the640px model canvas. */
(() => {
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
  const point=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
  const raise=(a,b,t,side='R')=>{const p=point(a,b,t);p[0]+=(side==='L'?-1:1)*42*Math.sin(t*Math.PI);return p;};
  const duration={idle:Infinity,wave:4,jump:3.5,think:7,work:14,rice:15,rest:9,stretch:6,failed:6};
  function ik(side,target){
    const S=side==='L'?[278,303]:[362,303],E=side==='L'?[265,357]:[374,357],H=side==='L'?[254,413]:[386,413];
    const l1=Math.hypot(E[0]-S[0],E[1]-S[1]),l2=Math.hypot(H[0]-E[0],H[1]-E[1]);
    const dx=target[0]-S[0],dy=target[1]-S[1],d=Math.max(Math.abs(l1-l2)+.01,Math.min(l1+l2-.01,Math.hypot(dx,dy)));
    const angle=Math.atan2(dy,dx),offset=Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))));
    // Keep one elbow branch throughout the lift; changing branches at shoulder height pops the joint.
    const q1=angle+(side==='L'?-1:1)*offset;
    const elbow=[S[0]+Math.cos(q1)*l1,S[1]+Math.sin(q1)*l1];
    const reachable=[S[0]+dx/Math.hypot(dx,dy)*d,S[1]+dy/Math.hypot(dx,dy)*d];
    const q2=Math.atan2(reachable[1]-elbow[1],reachable[0]-elbow[0]);
    const rest1=Math.atan2(E[1]-S[1],E[0]-S[0]),rest2=Math.atan2(H[1]-E[1],H[0]-E[0]);
    let bend=q2-q1-rest2+rest1;while(bend>Math.PI)bend-=Math.PI*2;while(bend< -Math.PI)bend+=Math.PI*2;
    let upper=q1-rest1;while(upper>Math.PI)upper-=Math.PI*2;while(upper< -Math.PI)upper+=Math.PI*2;
    return {upper:upper*180/Math.PI,elbow:bend*180/Math.PI,hand:reachable};
  }
  function sample(action,t,clock=t,walking=0,gait=clock*8){
    const D=duration[action]||6,env=ease(t/.8)*ease((D-t)/.8),breath=Math.sin(clock*1.7);
    const p={ParamHeadTilt:1.2*Math.sin(clock*.8),ParamBodyTilt:.45*Math.sin(clock*.7),ParamBodyBob:breath*.7,ParamHairSway:.5*Math.sin(clock*1.25),ParamTailSwing:2*Math.sin(clock*1.4),ParamLegScreenL:0,ParamLegScreenR:0,ParamEyeLOpen:1,ParamEyeROpen:1,ParamMouthOpenY:.12};
    let left=[254,413],right=[386,413]; const props=[];
    const blink=(clock%4.7); if(blink>4.38&&blink<4.65){const a=Math.sin((blink-4.38)/.27*Math.PI);p.ParamEyeLOpen=p.ParamEyeROpen=1-a*a;}
    if(walking>.001){
      const v=Math.sin(gait),v2=Math.cos(gait*2);p.ParamLegScreenL=v*8*walking;p.ParamLegScreenR=-v*8*walking;
      p.ParamBodyBob+=(-2+2.5*v2)*walking;p.ParamBodyTilt+=1.1*v*walking;p.ParamHeadTilt+=.6*v*walking;
      p.ParamHairSway+=Math.sin(gait-.4)*1.2*walking;p.ParamTailSwing+=3*Math.sin(gait-.7)*walking;
      left=[254+13*v*walking,413-4*Math.abs(v)*walking];right=[386-13*v*walking,413-4*Math.abs(v)*walking];
    }
    if(action==='wave'){right=raise(right,[414+5*Math.sin(t*8),222+5*Math.cos(t*8)],env);p.ParamHeadTilt+=-4*env;}
    if(action==='think'){right=raise(right,[377,268],env);p.ParamHeadTilt+=-6*env;p.ParamMouthOpenY=.05;}
    if(action==='jump'){const j=ease(t/.7)*ease((2.3-t)/.65);p.ParamBodyBob-=28*Math.sin(clamp((t-.4)/1.7)*Math.PI)*j;left=point(left,[230,312],j);right=point(right,[410,312],j);}
    if(action==='stretch'){left=raise(left,[222,228],env,'L');right=raise(right,[418,228],env);p.ParamHeadTilt+=3*env;p.ParamEyeLOpen=p.ParamEyeROpen=mix(p.ParamEyeROpen,.1,env);}
    if(action==='failed'){p.ParamHeadTilt+=6*env;p.ParamBodyBob+=4*env;right=raise(right,[385,280],env);p.ParamMouthOpenY=.03;}
    if(action==='work'){
      const lift=ease(t/1.8)*ease((D-t)/1.8),open=ease((t-1.8)/1.6)*ease((D-t-1.8)/1.2),typing=ease((t-3.5)/.5)*ease((D-t-3)/.5);
      const y=mix(407,400,lift),tap=Math.sin(t*14)*2.2*typing;
      const grip=ease(lift/.45),reveal=ease((lift-.42)/.4);
      left=point(left,[283,y+9+tap],grip);right=point(right,[356,y+9-tap],grip);
      p.ParamHeadTilt+=.7*Math.sin(t*2)*typing;p.ParamMouthOpenY=.06;
      props.push({name:'laptop-base',x:320,y,scale:.255,pivot:[300,20],alpha:reveal,kind:'base'});
      props.push({name:'laptop-lid',x:320,y,scale:.202,pivot:[271,277],alpha:reveal,kind:'lid',open});
    }
    if(action==='rice'){
      const lift=ease(t/1.8)*ease((D-t)/1.8),y=mix(400,395,lift),active=ease((t-2.2)/.6)*ease((D-t-2)/.6);
      const cycle=((Math.max(0,t-2.5))%3.6)/3.6;
      const food=cycle<.52?1:cycle<.62?1-ease((cycle-.52)/.10):cycle<.94?0:ease((cycle-.94)/.06);
      let bite=cycle<.18?0:cycle<.47?ease((cycle-.18)/.29):cycle<.64?1:cycle<.94?1-ease((cycle-.64)/.30):0;
      const grip=ease(lift/.45),reveal=ease((lift-.42)/.4);
      bite*=active;left=point(left,[290,y+13],grip);
      right=point(right,[mix(355,374,bite)+45*Math.sin(bite*Math.PI),mix(y+17,270,bite)],grip);
      p.ParamMouthOpenY=mix(.08,.8,bite);p.ParamHeadTilt+=-2*bite;
      props.push({name:'rice-bowl',x:320,y,scale:.24,pivot:[174,147],alpha:reveal});
      props.push({name:'rice-spoon',x:right[0],y:right[1],scale:.20,pivot:[60,213],alpha:reveal,mirror:true,angle:mix(0,-.40,bite),kind:'spoon',bite,food:mix(1,food,active)});
    }
    if(action==='rest'){
      const lift=ease(t/1.6)*ease((D-t)/1.6),y=mix(402,399,lift),grip=ease(lift/.45);
      left=point(left,[282,y+13],grip);right=point(right,[358,y+12],grip);p.ParamHeadTilt+=-5*lift;
      props.push({name:'whale-plush',x:320,y,scale:.25,pivot:[269,156],alpha:ease((lift-.42)/.4)});
    }
    const L=ik('L',left),R=ik('R',right);
    p.ParamArmScreenL=L.upper;p.ParamElbowScreenL=L.elbow;p.ParamArmScreenR=R.upper;p.ParamElbowScreenR=R.elbow;
    return {parameters:p,props,left:L.hand,right:R.hand,duration:D,action,t};
  }
  window.DeepSeekMotion={sample,duration,ik,ease,mix};
})();

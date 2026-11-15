/* Continuous model-space choreography for the user-approved v04 character. */
(() => {
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));},mix=(a,b,t)=>a+(b-a)*t;
  const point=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)],deg=x=>x*180/Math.PI,rad=x=>x*Math.PI/180;
  const wrap=x=>{while(x>Math.PI)x-=2*Math.PI;while(x< -Math.PI)x+=2*Math.PI;return x;};
  const J={body:[487,655.68],head:[487,563.52],mouth:[487,525.36],shoulderL:[436.6,595.2],elbowL:[361,663.6],handL:[404.2,638.4],shoulderR:[537.4,595.2],elbowR:[620.2,660],handR:[577,634.8]};
  const duration={idle:Infinity,wave:5,jump:4,think:7,work:19,rice:18,rest:10,stretch:6,failed:6};
  function ik(side,target){
    const S=J['shoulder'+side],E=J['elbow'+side],H=J['hand'+side];
    const l1=Math.hypot(E[0]-S[0],E[1]-S[1]),l2=Math.hypot(H[0]-E[0],H[1]-E[1]);
    const dx=target[0]-S[0],dy=target[1]-S[1],requested=Math.hypot(dx,dy),d=Math.max(Math.abs(l1-l2)+.01,Math.min(l1+l2-.01,requested));
    const theta=Math.atan2(dy,dx),offset=Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))));
    // This branch is derived from the actual folded neutral elbows, not handedness assumptions.
    const q1=theta+(side==='L'?1:-1)*offset,elbow=[S[0]+l1*Math.cos(q1),S[1]+l1*Math.sin(q1)];
    const hand=[S[0]+dx/(requested||1)*d,S[1]+dy/(requested||1)*d],q2=Math.atan2(hand[1]-elbow[1],hand[0]-elbow[0]);
    const rest1=Math.atan2(E[1]-S[1],E[0]-S[0]),rest2=Math.atan2(H[1]-E[1],H[0]-E[0]);
    return {upper:deg(wrap(q1-rest1)),elbow:deg(wrap(q2-q1-rest2+rest1)),hand,joint:elbow,error:Math.abs(d-requested)};
  }
  function headPoint(p,tilt=0,seat=0){const a=rad(tilt),x=p[0]-J.head[0],y=p[1]-J.head[1];return[J.head[0]+x*Math.cos(a)-y*Math.sin(a),J.head[1]+x*Math.sin(a)+y*Math.cos(a)+65*seat];}
  function armPath(side,a,b,u,seat=0){
    if(u<=0)return [...a];if(u>=1)return [...b];
    const S=[J['shoulder'+side][0],J['shoulder'+side][1]+65*seat],E=J['elbow'+side],H=J['hand'+side],base=J['shoulder'+side];
    const l1=Math.hypot(E[0]-base[0],E[1]-base[1]),l2=Math.hypot(H[0]-E[0],H[1]-E[1]);
    const v=[a[0]-S[0],a[1]-S[1]],w=[b[0]-S[0],b[1]-S[1]],ang=Math.atan2(v[1],v[0])+wrap(Math.atan2(w[1],w[0])-Math.atan2(v[1],v[0]))*u;
    const radius=Math.max(Math.abs(l1-l2)+.5,Math.min(l1+l2-.5,mix(Math.hypot(...v),Math.hypot(...w),u)+7*Math.sin(u*Math.PI)));
    return[S[0]+Math.cos(ang)*radius,S[1]+Math.sin(ang)*radius];
  }
  const spoonScale=.20;
  function spoonOffset(angle){const x=(86-269)*spoonScale,y=(78-208)*spoonScale;return[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];}
  function laptopGeometry(x,y,open){
    const a=open*Math.PI*105/180,half=95+16*Math.cos(a),freeY=y+87*Math.cos(a)-130*Math.sin(a);
    return {hinge:[x,y],open,quad:[[x-half,freeY],[x+half,freeY],[x+78,y],[x-78,y]],leftFree:[x-half,freeY],rightFree:[x+half,freeY]};
  }
  function finish(p,left,right,props,extra={}){
    const seat=65*p.ParamSeat,L=ik('L',[left[0],left[1]-seat]),R=ik('R',[right[0],right[1]-seat]);
    p.ParamArmScreenL=L.upper;p.ParamElbowScreenL=L.elbow;p.ParamArmScreenR=R.upper;p.ParamElbowScreenR=R.elbow;
    // Rigid wrist counterrotation preserves the registered fist/cuff orientation.
    const wrist=(side,sol,target)=>{
      const raised=1-p.ParamPropMode;
      return -deg(wrap(rad(sol.upper+sol.elbow)))*raised;
    };
    p.ParamWristScreenL=wrist('L',L,left);p.ParamWristScreenR=wrist('R',R,right);
    const moved=Math.max(Math.hypot(left[0]-J.handL[0],left[1]-seat-J.handL[1]),Math.hypot(right[0]-J.handR[0],right[1]-seat-J.handR[1]));
    p.ParamSleeveReveal=ease(moved/28);
    const actualL=[L.hand[0],L.hand[1]+seat],actualR=[R.hand[0],R.hand[1]+seat];
    return {parameters:p,props,left:actualL,right:actualR,elbowL:[L.joint[0],L.joint[1]+seat],elbowR:[R.joint[0],R.joint[1]+seat],ikError:[L.error,R.error],...extra};
  }
  function sample(action,t,clock=t,walking=0,gait=clock*8){
    const D=duration[action]||6,env=ease(t/1.1)*ease((D-t)/1.1);
    const p={ParamHeadTilt:.65*Math.sin(clock*.75),ParamBodyTilt:.22*Math.sin(clock*.6),ParamBodyBob:.65*Math.sin(clock*1.65),ParamHairSway:.12*Math.sin(clock*1.1),ParamTailSwing:.6*Math.sin(clock*1.2),ParamLegScreenL:0,ParamLegScreenR:0,ParamFootLiftL:0,ParamFootLiftR:0,ParamEyeLOpen:1,ParamEyeROpen:1,ParamMouthOpenY:1,ParamSeat:0,ParamPropMode:0,ParamSleeveReveal:0};
    let left=[...J.handL],right=[...J.handR],props=[],meta={action,t,duration:D};
    const blink=clock%4.65;if(blink>4.36&&blink<4.60){const v=Math.sin((blink-4.36)/.24*Math.PI);p.ParamEyeLOpen=p.ParamEyeROpen=1-v*v;}
    if(walking>.001){
      const v=Math.sin(gait);p.ParamLegScreenL=9*v*walking;p.ParamLegScreenR=-9*v*walking;
      p.ParamFootLiftL=Math.max(0,-Math.cos(gait))*walking;p.ParamFootLiftR=Math.max(0,Math.cos(gait))*walking;
      p.ParamBodyBob-=walking*(2+2*Math.cos(gait*2));p.ParamBodyTilt+=.7*v*walking;p.ParamHeadTilt+=.35*v*walking;
      p.ParamTailSwing+=.6*Math.sin(gait-.4)*walking;
      left[0]+=5*v*walking;right[0]-=5*v*walking;
    }
    if(action==='wave'){
      right=armPath('R',right,[598+8*Math.sin(t*7),548+3*Math.cos(t*7)],env);p.ParamHeadTilt-=1.4*env;
    }
    if(action==='think'){
      right=armPath('R',right,[566,538],env);p.ParamHeadTilt-=2*env;p.ParamMouthOpenY=mix(1,0,env);
    }
    if(action==='jump'){
      const u=clamp((t-.65)/1.2),jump=Math.sin(ease(u)*Math.PI)*ease(t/.5)*ease((D-t)/.7);
      p.ParamBodyBob-=10*jump;left=armPath('L',left,[375,591],jump);right=armPath('R',right,[609,588],jump);
    }
    if(action==='stretch'){
      left=armPath('L',left,[384,546],env);right=armPath('R',right,[604,543],env);p.ParamEyeLOpen=p.ParamEyeROpen=mix(p.ParamEyeROpen,.1,env);p.ParamMouthOpenY=mix(1,0,env);
    }
    if(action==='failed'){
      p.ParamHeadTilt+=2*env;p.ParamBodyBob+=4*env;p.ParamEyeLOpen=p.ParamEyeROpen=mix(p.ParamEyeROpen,.1,env);p.ParamMouthOpenY=mix(1,0,env);
    }
    if(action==='work'){
      const seated=ease((t-1.5)/1.5)*ease((D-t-1.3)/1.4),open=ease((t-3.1)/1.9)*ease((D-t-3.0)/1.6);
      const reveal=ease((t-.35)/.75)*ease((D-t-.2)/.85),carry=ease(t/1.1)*ease((D-t)/1.2);
      p.ParamSeat=seated;p.ParamPropMode=reveal;p.ParamHeadTilt=.3*Math.sin(t*1.4);p.ParamMouthOpenY=mix(1,0,seated);
      const typing=ease((t-5)/.9)*ease((D-t-5)/.9),y=mix(660,705,seated)+45*typing,pc=laptopGeometry(500,y,open);
      const holdL=[393,mix(710,765,seated)],holdR=[607,mix(710,765,seated)];
      const opening=ease((t-2.8)/.4)*ease((D-t-2.8)/.4);
      left=armPath('L',[left[0],left[1]+65*seated],holdL,carry,seated);right=armPath('R',[right[0],right[1]+65*seated],holdR,carry,seated);
      left=armPath('L',left,[439,y+53],opening,seated);right=armPath('R',right,pc.rightFree,opening,seated);
      left=armPath('L',left,[465,y+34+Math.sin(t*13)*1.4],typing,seated);right=armPath('R',right,[537,y+34-Math.sin(t*13)*1.4],typing,seated);
      props.push({kind:'laptop',name:'laptop',x:500,y,open,alpha:reveal,geometry:pc});
      meta={...meta,pc,typing,grips:reveal>0?['typing','typing']:null};
    }
    if(action==='rice'){
      const reveal=ease((t-.35)/.75)*ease((D-t-.25)/1.0),lift=ease(t/1.5)*ease((D-t)/1.6);
      const active=ease((t-2.1)/.4)*(t<14.8?1:0),cycle=t<14.8?((Math.max(0,t-2.5))%4.1)/4.1:0;
      const bite=(cycle<.18?0:cycle<.49?ease((cycle-.18)/.31):cycle<.63?1:cycle<.94?1-ease((cycle-.63)/.31):0)*active;
      const support=armPath('L',J.handL,[487,685],lift);left=support;
      p.ParamHeadTilt=.2*Math.sin(clock*.7)*(1-bite);p.ParamMouthOpenY=mix(.05,.85,ease((bite-.78)/.2));
      p.ParamPropMode=reveal;
      const mouth=headPoint(J.mouth,p.ParamHeadTilt),rice=[support[0]+7,support[1]-(281-123)*.36];
      const cup=point(rice,mouth,bite);cup[0]+=90*Math.sin(Math.PI*bite);
      if(cycle<.18)cup[1]+=5*Math.sin(cycle/.18*Math.PI)*active;
      const angle=mix(.18,-.60,bite),off=spoonOffset(angle);right=armPath('R',J.handR,[cup[0]-off[0],cup[1]-off[1]],lift);
      const food=cycle<.13?0:cycle<.19?ease((cycle-.13)/.06):cycle<.52?1:cycle<.61?1-ease((cycle-.52)/.09):0;
      props.push({kind:'bowl',name:'rice-bowl-full',x:support[0],y:support[1],scale:.36,pivot:[175,281],alpha:reveal});
      props.push({kind:'spoon',name:'rice-spoon-loaded',x:right[0],y:right[1],scale:spoonScale,pivot:[269,208],angle,alpha:reveal,food:food*active});
      meta={...meta,bite,food,spoonCup:cup,spoonAngle:angle,bowlSupport:support,grips:['bowl','spoon']};
    }
    if(action==='rest'){
      const lift=ease(t/1.2)*ease((D-t)/1.3),reveal=ease((t-.3)/.7)*ease((D-t-.15)/.8);
      left=armPath('L',left,[408,713],lift);right=armPath('R',right,[575,713],lift);p.ParamPropMode=reveal;
      p.ParamHeadTilt-=1.7*lift;p.ParamEyeLOpen=p.ParamEyeROpen=mix(p.ParamEyeROpen,.1,lift);p.ParamMouthOpenY=mix(1,0,lift);
      props.push({kind:'plush',name:'whale-plush',x:487,y:700,scale:.22,pivot:[530,326],alpha:reveal});meta={...meta,grips:['bowl','bowl']};
    }
    return finish(p,left,right,props,meta);
  }
  function exit(start,t,clock){
    const u=ease(t/1.8),rest=sample('idle',clock,clock),p={...start.parameters},seat0=start.parameters.ParamSeat||0;
    for(const id of Object.keys(rest.parameters))if(!/ArmScreen|ElbowScreen|WristScreen|SleeveReveal|PropMode|Seat/.test(id))p[id]=mix(start.parameters[id]??rest.parameters[id],rest.parameters[id],u);
    // Interpolate shoulder angle and polar radius on the neutral IK branch.
    // Unlike a straight hand chord this cannot cross the unreachable inner disk.
    // Interpolated shoulder angles also stay inside the authored joint interval.
    const local=(v,seat=seat0)=>[v[0],v[1]-65*seat],world=(v,seat)=>[v[0],v[1]+65*seat];
    const polar=(side,a,b,v)=>{
      if(v<=0)return [...a];if(v>=1)return [...b];
      const S=J['shoulder'+side],E=J['elbow'+side],H=J['hand'+side],l1=Math.hypot(E[0]-S[0],E[1]-S[1]),l2=Math.hypot(H[0]-E[0],H[1]-E[1]);
      const A=ik(side,a),B=ik(side,b),radius=mix(Math.hypot(a[0]-S[0],a[1]-S[1]),Math.hypot(b[0]-S[0],b[1]-S[1]),v);
      const r=Math.max(Math.abs(l1-l2)+.01,Math.min(l1+l2-.5,radius));
      const off=Math.acos(Math.max(-1,Math.min(1,(l1*l1+r*r-l2*l2)/(2*l1*r)))),restAngle=Math.atan2(E[1]-S[1],E[0]-S[0]);
      const angle=restAngle+rad(mix(A.upper,B.upper,v))-(side==='L'?1:-1)*off;
      return[S[0]+r*Math.cos(angle),S[1]+r*Math.sin(angle)];
    };
    const aL=local(start.left),aR=local(start.right);let seat=seat0*(1-u),fade=1-ease((t-.35)/.6),settle=u,phase='return';
    let left=world(polar('L',aL,J.handL,settle),seat),right=world(polar('R',aR,J.handR,settle),seat),props=structuredClone(start.props);
    const pc0=props.find(x=>x.kind==='laptop'),bowl=props.find(x=>x.kind==='bowl'),spoon=props.find(x=>x.kind==='spoon');
    if(start.action==='work'&&pc0&&pc0.alpha>1e-5){
      // First lift the computer into the arm annulus and acquire its lid edge.
      // Keep the lid fixed until contact, close while supported, then put away.
      const acquire=ease(t/.5),close=ease((t-.5)/.65),putAway=ease((t-1.4)/.4);
      seat=seat0*(1-putAway);fade=1-ease((t-1.05)/.35);p.ParamSeat=seat;
      const safeY=625+65*seat0,y=mix(pc0.y,safeY,acquire)-65*(seat0-seat),open=pc0.open*(1-close),pc=laptopGeometry(pc0.x,y,open);
      const base=[pc0.x-61,y+53],free=pc.rightFree;
      if(t<.5){left=world(polar('L',aL,local(base,seat),acquire),seat);right=world(polar('R',aR,local(free,seat),acquire),seat);phase='acquire-lid';}
      else if(t<=1.4){left=base;right=free;phase='lid-contact';}
      else{
        const closed=laptopGeometry(pc0.x,625,0);
        left=world(polar('L',[pc0.x-61,678],J.handL,putAway),seat);
        right=world(polar('R',closed.rightFree,J.handR,putAway),seat);
      }
      props=[{...pc0,y,open,geometry:pc,alpha:pc0.alpha*fade}];
    }else if(start.action==='rice'&&bowl&&spoon&&Math.max(bowl.alpha,spoon.alpha)>1e-5){
      const withdraw=ease(t/.75),putAway=ease((t-1.15)/.65),angle=mix(spoon.angle,.18,withdraw),off=spoonOffset(.18);
      seat=seat0*(1-putAway);fade=1-ease((t-.8)/.35);
      const cup=[bowl.x+7,bowl.y-(281-123)*.36],goal=local([cup[0]-off[0],cup[1]-off[1]]);
      left=world(polar('L',aL,J.handL,putAway),seat);
      right=world(t<=1.15?polar('R',aR,goal,withdraw):polar('R',goal,J.handR,putAway),seat);
      for(const pr of props){pr.alpha*=fade;if(pr.kind==='spoon'){pr.x=right[0];pr.y=right[1];pr.angle=angle;pr.food=(pr.food||0)*(1-withdraw);}else if(pr.kind==='bowl'){pr.x=left[0];pr.y=left[1];}}
      phase=t<=1.15?'spoon-withdraw':'return';
    }else if(start.action==='rest'&&props.some(pr=>pr.alpha>1e-5)){
      fade=1-ease(t/.6);settle=ease((t-.6)/1.2);seat=seat0*(1-settle);
      left=world(polar('L',aL,J.handL,settle),seat);right=world(polar('R',aR,J.handR,settle),seat);
      for(const pr of props)pr.alpha*=fade;
    }else for(const pr of props)pr.alpha*=fade;
    p.ParamSeat=seat;p.ParamPropMode=(start.parameters.ParamPropMode||0)*fade;
    return finish(p,left,right,props,{action:'exit',t,duration:1.8,grips:start.grips,exitPhase:phase});
  }
  window.DeepSeekMotion={sample,exit,duration,ik,ease,mix,point,armPath,J,headPoint,spoonOffset,laptopGeometry};
})();

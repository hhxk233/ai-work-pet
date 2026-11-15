/* Draw generated rigid props and registered gripping hands over the live rig. */
window.createDeepSeekProps=async(canvas,assetBase)=>{
  const names=['laptop-base','laptop-lid','rice-bowl-full','rice-bowl-half','rice-spoon-empty','rice-spoon-loaded','whale-plush','arm-grip-bowl-left','arm-grip-spoon-right','arm-grip-typing-left','arm-grip-typing-right'];
  const parts=new Map();await Promise.all(names.map(async name=>{const im=new Image();im.src=new URL(`rig/parts/${name}.png`,assetBase);await im.decode();parts.set(name,im);}));
  const ctx=canvas.getContext('2d'),spoon=document.createElement('canvas');spoon.width=340;spoon.height=266;const sc=spoon.getContext('2d');
  function triangle(im,a,b,c,u,v,z){
    const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    const aa=((v[0]-u[0])*(c[1]-a[1])-(z[0]-u[0])*(b[1]-a[1]))/det,cc=((z[0]-u[0])*(b[0]-a[0])-(v[0]-u[0])*(c[0]-a[0]))/det;
    const bb=((v[1]-u[1])*(c[1]-a[1])-(z[1]-u[1])*(b[1]-a[1]))/det,dd=((z[1]-u[1])*(b[0]-a[0])-(v[1]-u[1])*(c[0]-a[0]))/det;
    const center=[(u[0]+v[0]+z[0])/3,(u[1]+v[1]+z[1])/3],expand=q=>{const dx=q[0]-center[0],dy=q[1]-center[1],n=Math.hypot(dx,dy);return[q[0]+dx/n*.7,q[1]+dy/n*.7];};
    ctx.save();ctx.beginPath();ctx.moveTo(...expand(u));ctx.lineTo(...expand(v));ctx.lineTo(...expand(z));ctx.closePath();ctx.clip();
    ctx.transform(aa,bb,cc,dd,u[0]-aa*a[0]-cc*a[1],u[1]-bb*a[0]-dd*a[1]);ctx.drawImage(im,0,0);ctx.restore();
  }
  function lid(pc){
    const src=[[61,11],[427,16],[381,269],[7,269]],dst=pc.quad,im=parts.get('laptop-lid');
    triangle(im,src[0],src[1],src[3],dst[0],dst[1],dst[3]);triangle(im,src[1],src[2],src[3],dst[1],dst[2],dst[3]);
  }
  function sprite(im,pr){ctx.save();ctx.globalAlpha=pr.alpha;ctx.translate(pr.x,pr.y);ctx.rotate(pr.angle||0);ctx.scale(pr.scale,pr.scale);ctx.drawImage(im,-pr.pivot[0],-pr.pivot[1]);ctx.restore();}
  function grip(pose,side,kind){
    const hand=side==='L'?pose.left:pose.right,elbow=side==='L'?pose.elbowL:pose.elbowR;
    let name,root,contact;
    if(kind==='bowl'){name='arm-grip-bowl-left';root=[89,153];contact=[310,116];}
    else if(kind==='spoon'){name='arm-grip-spoon-right';root=[311,256];contact=[69,93];}
    else if(side==='L'){name='arm-grip-typing-left';root=[108,106];contact=[265,315];}
    else{name='arm-grip-typing-right';root=[282,108];contact=[124,315];}
    const v=[contact[0]-root[0],contact[1]-root[1]],w=[hand[0]-elbow[0],hand[1]-elbow[1]],scale=Math.hypot(...w)/Math.hypot(...v),angle=kind==='spoon'?0:Math.atan2(w[1],w[0])-Math.atan2(v[1],v[0]);
    ctx.save();ctx.globalAlpha=pose.parameters.ParamPropMode;ctx.translate(...hand);ctx.rotate(angle);ctx.scale(scale,scale);ctx.drawImage(parts.get(name),-contact[0],-contact[1]);ctx.restore();
  }
  function draw(pose,player){
    const r=canvas.getBoundingClientRect(),ratio=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
    const scale=Math.min(r.width/1024,r.height/1024)*player.view.zoom;
    ctx.setTransform(scale*ratio,0,0,scale*ratio,(r.width/2-512*scale+player.view.x)*ratio,(r.height/2-512*scale+player.view.y)*ratio);
    const M=window.DeepSeekMotion,J=M.J;ctx.translate(J.body[0],J.body[1]+pose.parameters.ParamBodyBob);ctx.rotate(pose.parameters.ParamBodyTilt*Math.PI/180);ctx.translate(-J.body[0],-J.body[1]);
    for(const pr of pose.props){
      if(pr.alpha<=.001)continue;
      if(pr.kind==='laptop'){
        ctx.save();ctx.globalAlpha=pr.alpha;ctx.translate(pr.x,pr.y);ctx.scale(.48,.48);ctx.drawImage(parts.get('laptop-base'),-235,-14);ctx.restore();
        ctx.save();ctx.globalAlpha=pr.alpha;lid(pr.geometry);ctx.restore();
      }else if(pr.kind==='spoon'){
        sc.globalCompositeOperation='source-over';sc.globalAlpha=1;sc.clearRect(0,0,340,266);sc.drawImage(parts.get('rice-spoon-empty'),0,0);
        sc.globalCompositeOperation='source-atop';sc.globalAlpha=pr.food;sc.drawImage(parts.get('rice-spoon-loaded'),0,0);sprite(spoon,pr);
      }else sprite(parts.get(pr.name),pr);
    }
    if(pose.parameters.ParamPropMode>.001){grip(pose,'L',pose.grips?.[0]||'typing');grip(pose,'R',pose.grips?.[1]||'typing');}
  }
  return {draw,parts};
};

/* Continuous rigid joint evaluation over the exported model's actual meshes. */
window.bindDeepSeekRig=(player,map)=>{
  player.stop();player.play(null);player.behaviors(0);player.update(0);
  const names=new Map(map.items.map(x=>[x.target.replace('mesh:',''),x.name]));
  const rest=player.meshes.map((_,m)=>new Float32Array(player.meshVertices(m))),alpha=rest.map(()=>1);
  const originalDraw=player.drawMesh.bind(player);
  player.drawMesh=(m,opacity,mask)=>originalDraw(m,opacity*alpha[m],mask);
  const rad=d=>d*Math.PI/180;
  function rot(x,y,cx,cy,angle){const c=Math.cos(angle),s=Math.sin(angle),dx=x-cx,dy=y-cy;return [cx+c*dx-s*dy,cy+s*dx+c*dy];}
  return {apply(pose){
    const p=pose.parameters,head=rad(p.ParamHeadTilt),body=rad(p.ParamBodyTilt),bob=p.ParamBodyBob;
    for(let m=0;m<rest.length;m++){
      const name=names.get(player.meshIds[m])||player.meshIds[m],a=rest[m],out=player.meshVertices(m);alpha[m]=1;
      for(let i=0;i<a.length;i+=2){
        let x=a[i],y=a[i+1];
        if(name==='Tail')[x,y]=rot(x,y,382,430,rad(p.ParamTailSwing));
        else if(name==='HairBack'){[x,y]=rot(x,y,320,169,rad(p.ParamHairSway));[x,y]=rot(x,y,320,279,head);}
        else if(name.startsWith('LegScreen'))[x,y]=rot(x,y,name.endsWith('Left')?300:340,455,rad(name.endsWith('Left')?p.ParamLegScreenL:p.ParamLegScreenR));
        else if(/^(UpperArm|Forearm)Screen/.test(name)){
          const left=name.endsWith('Left'),S=left?[278,303]:[362,303],E=left?[265,357]:[374,357],u=rad(left?p.ParamArmScreenL:p.ParamArmScreenR),f=rad(left?p.ParamElbowScreenL:p.ParamElbowScreenR);
          if(name.startsWith('Forearm'))[x,y]=rot(x,y,E[0],E[1],f);
          [x,y]=rot(x,y,S[0],S[1],u);
        }else if(name==='Head'||/^Face/.test(name)){
          if(name.includes('Eye')){
            const left=name.includes('ScreenL'),v=left?p.ParamEyeLOpen:p.ParamEyeROpen,cx=left?280:359,cy=230;
            if(name.endsWith('Open')){y=cy+(y-cy)*Math.max(.02,v);alpha[m]=Math.min(1,v*4);}
            else if(name.endsWith('Closed'))alpha[m]=Math.max(0,1-v*3);
          }
          if(name==='FaceMouthOpen'){const v=p.ParamMouthOpenY;y=260+(y-260)*Math.max(.03,v);alpha[m]=Math.min(1,v*4);}
          if(name==='FaceMouthSmile')alpha[m]=Math.max(0,1-p.ParamMouthOpenY*3);
          [x,y]=rot(x,y,320,279,head);
        }
        [x,y]=rot(x,y,320,279,body);out[i]=x;out[i+1]=y+bob;
      }
    }
  },rest,names};
};

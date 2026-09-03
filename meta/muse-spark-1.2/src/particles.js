import * as THREE from 'three';
// 零GC 粒子池 雨涵手搓的 诶嘿 好耶
export class ParticlePool{
  constructor(scene, max=180){
    this.scene=scene; this.max=max;
    this.pool=[];
    this.active=[];
    // 准备小球mesh池
    const geo=new THREE.SphereGeometry(0.14,6,6);
    for(let i=0;i<max;i++){
      const mat=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0});
      const m=new THREE.Mesh(geo, mat); m.visible=false; m.scale.set(1,1,1); scene.add(m);
      this.pool.push({mesh:m, vel:new THREE.Vector3(), life:0, maxLife:1, rot:new THREE.Vector3(), drag:0.98, gravity:-8});
    }
    // 点状拖尾用 Points
    const pGeo=new THREE.BufferGeometry();
    const cnt=120;
    const pos=new Float32Array(cnt*3); const col=new Float32Array(cnt*3); const sz=new Float32Array(cnt);
    for(let i=0;i<cnt;i++){ pos[i*3]=0; pos[i*3+1]=-100; pos[i*3+2]=0; col[i*3]=1; col[i*3+1]=1; col[i*3+2]=1; sz[i]=0; }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col,3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(sz,1));
    const pMat=new THREE.PointsMaterial({size:0.25, vertexColors:true, transparent:true, opacity:0.9, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending});
    this.points=new THREE.Points(pGeo, pMat); this.points.frustumCulled=false; this.scene.add(this.points);
    this.pointCnt=cnt; this.pointPos=pos; this.pointCol=col; this.pointSize=sz; this.pointLife=new Float32Array(cnt); this.pointVel=[]; for(let i=0;i<cnt;i++) this.pointVel.push(new THREE.Vector3());
  }
  spawn(pos, {count=10, color=0xffd54f, spread=2.2, up=2, life=0.6, size=1}={}){
    for(let i=0;i<count;i++){
      const p=this.pool.find(e=>e.life<=0); if(!p) break;
      p.mesh.position.copy(pos); p.mesh.position.x+=(Math.random()-0.5)*0.6; p.mesh.position.z+=(Math.random()-0.5)*0.6;
      p.mesh.material.color.setHex(color); p.mesh.material.opacity=1; p.mesh.visible=true;
      p.vel.set((Math.random()-0.5)*spread, Math.random()*up+1, (Math.random()-0.5)*spread);
      p.life=p.maxLife=life*(0.7+Math.random()*0.6); p.mesh.scale.set(size,size,size);
      p.rot.set((Math.random()-0.5)*8,(Math.random()-0.5)*8,(Math.random()-0.5)*8);
      p.drag=0.97; p.gravity=-12; this.active.push(p);
    }
  }
  spawnPoints(pos, count=14, color=new THREE.Color(0x00e5ff)){
    for(let i=0;i<count;i++){
      const idx=this.pointLife.findIndex(v=>v<=0); if(idx<0) break;
      this.pointPos[idx*3]=pos.x+(Math.random()-0.5)*1.2;
      this.pointPos[idx*3+1]=pos.y+Math.random()*0.8;
      this.pointPos[idx*3+2]=pos.z+(Math.random()-0.5)*1.2;
      this.pointCol[idx*3]=color.r; this.pointCol[idx*3+1]=color.g; this.pointCol[idx*3+2]=color.b;
      this.pointSize[idx]=0.28+Math.random()*0.22;
      this.pointLife[idx]=0.7+Math.random()*0.4;
      this.pointVel[idx].set((Math.random()-0.5)*3, Math.random()*4+1, (Math.random()-0.5)*3);
    }
  }
  burstCoin(pos, superMode=false){
    this.spawn(pos,{count:6,color: superMode?0xfff2a8:0xffd54f, spread:3.2, up:3.5, life:0.55, size:superMode?1.2:1});
    this.spawnPoints(pos, 6, new THREE.Color(superMode?0xffeaa0:0xffd54f));
  }
  burstHit(pos){
    this.spawn(pos,{count:14,color:0xff3b9a, spread:4, up:4, life:0.6, size:1.1});
    this.spawn(pos,{count:8,color:0x00e5ff, spread:3, up:3, life:0.5, size:0.9});
  }
  trail(pos, color=0xa890ff){
    // 单个拖尾点
    const p=this.pool.find(e=>e.life<=0); if(!p) return;
    p.mesh.position.copy(pos); p.mesh.material.color.setHex(color); p.mesh.material.opacity=0.9; p.mesh.visible=true;
    p.vel.set((Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6);
    p.life=p.maxLife=0.4; p.mesh.scale.set(0.5,0.5,0.5); p.drag=0.96; p.gravity=0;
    this.active.push(p);
  }
  update(dt){
    for(let i=this.active.length-1;i>=0;i--){
      const p=this.active[i];
      p.life-=dt; if(p.life<=0){ p.mesh.visible=false; p.mesh.material.opacity=0; this.active.splice(i,1); continue; }
      p.vel.y+=p.gravity*dt; p.vel.multiplyScalar(p.drag);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x+=p.rot.x*dt; p.mesh.rotation.y+=p.rot.y*dt;
      p.mesh.material.opacity=p.life/p.maxLife;
      const s= THREE.MathUtils.lerp(0.2, 1, p.life/p.maxLife); p.mesh.scale.set(s,s,s);
    }
    // points
    const posAttr=this.points.geometry.attributes.position; const colAttr=this.points.geometry.attributes.color; const sizeAttr=this.points.geometry.attributes.size;
    for(let i=0;i<this.pointCnt;i++){
      if(this.pointLife[i]>0){
        this.pointLife[i]-=dt;
        this.pointVel[i].y-=9*dt; this.pointPos[i*3]+=this.pointVel[i].x*dt; this.pointPos[i*3+1]+=this.pointVel[i].y*dt; this.pointPos[i*3+2]+=this.pointVel[i].z*dt;
        this.pointSize[i]*=0.98;
        if(this.pointLife[i]<=0){ this.pointPos[i*3+1]=-100; this.pointSize[i]=0; }
      }
    }
    posAttr.needsUpdate=true; sizeAttr.needsUpdate=true; colAttr.needsUpdate=true;
    this.points.material.opacity=0.9;
  }
}

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Player{
  constructor(scene){
    this.scene=scene;
    this.group=new THREE.Group();
    scene.add(this.group);

    // lane
    this.lane=1; // 0 left 1 mid 2 right
    this.targetX=0; this.x=0; this.z=0;
    this.y=0; this.vy=0; this.grounded=true;
    this.coyote=0; this.buffer=0; this.jumpCount=0;
    this.sliding=false; this.slideTime=0;
    this.facing=0;

    // build mesh
    this.mesh=new THREE.Group();
    this.group.add(this.mesh);
    this.mesh.position.y=0.95;

    // body capsule style
    const bodyGeo=new THREE.CapsuleGeometry(0.35, 0.6, 4, 10);
    const bodyMat=new THREE.MeshStandardMaterial({color:0xa890ff, roughness:0.6, metalness:0.1, emissive:0x201040, emissiveIntensity:0.25});
    this.body=new THREE.Mesh(bodyGeo, bodyMat); this.body.position.y=0.45; this.mesh.add(this.body);
    // head
    const headGeo=new THREE.SphereGeometry(0.32,14,14);
    const headMat=new THREE.MeshStandardMaterial({color:0xffe4d0, roughness:0.7});
    this.head=new THREE.Mesh(headGeo, headMat); this.head.position.set(0,1.05,0.05); this.mesh.add(this.head);
    // eyes
    const eyeGeo=new THREE.SphereGeometry(0.07,8,8); const eyeMat=new THREE.MeshStandardMaterial({color:0x0a0a14});
    this.eyeL=new THREE.Mesh(eyeGeo, eyeMat); this.eyeL.position.set(-0.12,1.1,0.28); this.mesh.add(this.eyeL);
    this.eyeR=this.eyeL.clone(); this.eyeR.position.x=0.12; this.mesh.add(this.eyeR);
    // hair
    const hairGeo=new THREE.SphereGeometry(0.34,10,10,0,Math.PI*2,0,Math.PI*0.6);
    const hairMat=new THREE.MeshStandardMaterial({color:0x1a1a2e}); this.hair=new THREE.Mesh(hairGeo, hairMat); this.hair.position.set(0,1.18,0); this.hair.rotation.x=Math.PI; this.mesh.add(this.hair);
    // blue streak
    const streakGeo=new THREE.CapsuleGeometry(0.04,0.3,4,6); const streakMat=new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00aaff, emissiveIntensity:0.9});
    this.streak=new THREE.Mesh(streakGeo, streakMat); this.streak.position.set(0.14,1.15,0.02); this.streak.rotation.z=0.2; this.mesh.add(this.streak);
    // glasses
    const glasGeo=new THREE.TorusGeometry(0.12,0.025,6,12); const glasMat=new THREE.MeshStandardMaterial({color:0xff3b3b});
    this.glasL=new THREE.Mesh(glasGeo, glasMat); this.glasL.position.set(-0.12,1.08,0.29); this.mesh.add(this.glasL);
    this.glasR=this.glasL.clone(); this.glasR.position.x=0.12; this.mesh.add(this.glasR);
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.02,0.02), glasMat); bridge.position.set(0,1.08,0.29); this.mesh.add(bridge);
    // arms
    const armGeo=new THREE.CapsuleGeometry(0.09,0.42,4,8);
    const armMat=new THREE.MeshStandardMaterial({color:0xffe4d0});
    this.armL=new THREE.Mesh(armGeo, armMat); this.armL.position.set(-0.48,0.55,0); this.mesh.add(this.armL);
    this.armR=this.armL.clone(); this.armR.position.x=0.48; this.mesh.add(this.armR);
    // legs
    const legGeo=new THREE.CapsuleGeometry(0.11,0.5,4,8);
    const legMat=new THREE.MeshStandardMaterial({color:0x2a2f6a}); // pants
    this.legL=new THREE.Mesh(legGeo, legMat); this.legL.position.set(-0.16,0.0,0); this.mesh.add(this.legL);
    this.legR=this.legL.clone(); this.legR.position.x=0.16; this.mesh.add(this.legR);
    // shoes
    const shoeGeo=new THREE.BoxGeometry(0.18,0.1,0.26);
    const shoeMat=new THREE.MeshStandardMaterial({color:0xffffff});
    this.shoeL=new THREE.Mesh(shoeGeo, shoeMat); this.shoeL.position.set(-0.16,-0.32,0.05); this.mesh.add(this.shoeL);
    this.shoeR=this.shoeL.clone(); this.shoeR.position.x=0.16; this.mesh.add(this.shoeR);
    // scarf
    const scarfGeo=new THREE.BoxGeometry(0.28,0.12,0.06); const scarfMat=new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x0088ff, emissiveIntensity:0.5});
    this.scarf=new THREE.Mesh(scarfGeo, scarfMat); this.scarf.position.set(0,0.78,0.22); this.mesh.add(this.scarf);
    const scarfTail=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.28,0.04), scarfMat); scarfTail.position.set(0.08,0.62,0.28); scarfTail.rotation.z=0.12; this.mesh.add(scarfTail);

    // mount (star beast)
    this.mountGroup=new THREE.Group(); this.mountGroup.visible=false;
    const mountBody=new THREE.Mesh(new THREE.CapsuleGeometry(0.5,0.8,4,10), new THREE.MeshStandardMaterial({color:0xffd54f, emissive:0xff8a00, emissiveIntensity:0.25, roughness:0.5}));
    mountBody.rotation.z=Math.PI/2; mountBody.position.set(0,0.45,0); this.mountGroup.add(mountBody);
    const mountHead=new THREE.Mesh(new THREE.SphereGeometry(0.38,10,10), new THREE.MeshStandardMaterial({color:0xffeaa0})); mountHead.position.set(0.55,0.75,0); this.mountGroup.add(mountHead);
    const hornGeo=new THREE.ConeGeometry(0.12,0.5,6); const hornMat=new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xa890ff, emissiveIntensity:0.4});
    const horn=new THREE.Mesh(hornGeo,hornMat); horn.position.set(0.62,1.1,0); horn.rotation.z=-0.3; this.mountGroup.add(horn);
    const mLegGeo=new THREE.CapsuleGeometry(0.13,0.35,4,6); const mLegMat=new THREE.MeshStandardMaterial({color:0xff8a00});
    [-0.35,0.35].forEach(x=>{ [-0.25,0.25].forEach(z=>{ const l=new THREE.Mesh(mLegGeo,mLegMat); l.position.set(x,0.15,z); this.mountGroup.add(l); })});
    this.group.add(this.mountGroup);

    // pet
    this.pet=new THREE.Group();
    const petBody=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00aaff, emissiveIntensity:0.7, roughness:0.3}));
    this.pet.add(petBody);
    const petRing=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.04,8,16), new THREE.MeshStandardMaterial({color:0xa890ff, emissive:0xa890ff, emissiveIntensity:0.6}));
    petRing.rotation.x=Math.PI/2; this.pet.add(petRing);
    const petEye=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), new THREE.MeshStandardMaterial({color:0x0a0a14})); petEye.position.set(0,0.08,0.18); this.pet.add(petEye);
    this.pet.position.set(1.0,1.6, -0.6);
    scene.add(this.pet);
    this.petVisible=true;
    this.petTime=0;

    // collider
    this.height=1.7; this.radius=0.42;
    this.invincible=0; this.hasShield=false; this.hasMount=false; this.mountTime=0;
    this.runTime=0;
  }
  setMount(active, duration=12){
    this.hasMount=active; this.mountTime= active? duration:0;
    this.mountGroup.visible=active;
    if(active){ this.mesh.position.y=1.55; this.height=2.0; } else { this.mesh.position.y=0.95; this.height=1.7; }
  }
  setPetVisible(v){ this.petVisible=v; this.pet.visible=v; }
  setShield(v){ this.hasShield=v; this.body.material.emissiveIntensity= v?0.9:0.25; this.body.material.emissive.setHex(v?0x00e5ff:0x201040); }
  setInvincible(t){ this.invincible=t; }
  isInvincible(){ return this.invincible>0 || this.sliding && false; } // sliding not invincible to monster stomp check handled separately
  // input: lane shift
  moveLane(dir){
    this.lane= THREE.MathUtils.clamp(this.lane+dir,0,2);
    this.targetX= (this.lane-1)*CONFIG.laneWidth;
  }
  jump(){
    if(this.grounded || this.coyote>0){
      this.vy=CONFIG.jumpVel; this.grounded=false; this.coyote=0; this.jumpCount=1; this.buffer=0; return 'jump';
    } else if(this.jumpCount<2){
      this.vy=CONFIG.doubleJumpVel; this.jumpCount=2; this.buffer=0; return 'double';
    } else {
      this.buffer=CONFIG.jumpBuffer; return null;
    }
  }
  slide(){
    if(this.grounded && !this.sliding){
      this.sliding=true; this.slideTime=CONFIG.slideDuration; this.height=0.9;
      return true;
    } else if(!this.grounded){
      // air dive
      if(this.vy>-2) this.vy=-14;
      return 'dive';
    }
    return false;
  }
  update(dt, speed){
    this.runTime+=dt*speed*0.9;
    // lane lerp
    this.x= THREE.MathUtils.lerp(this.x, this.targetX, Math.min(1, CONFIG.laneLerp*dt));
    this.group.position.x=this.x;
    this.group.position.z=this.z;
    // vertical
    if(!this.grounded){
      this.vy-=CONFIG.gravity*dt;
      this.y+=this.vy*dt;
      if(this.y<=0){ this.y=0; this.vy=0; this.grounded=true; this.jumpCount=0; // land
        if(this.buffer>0){ this.buffer=0; this.jump(); }
      }
    } else {
      if(this.buffer>0){ this.buffer-=dt; }
      if(this.coyote>0) this.coyote-=dt;
    }
    if(this.grounded) this.coyote=CONFIG.coyote;
    else this.coyote-=dt;

    // slide timer
    if(this.sliding){
      this.slideTime-=dt; if(this.slideTime<=0){ this.sliding=false; this.height= this.hasMount?2.0:1.7; }
    }

    // mount timer
    if(this.hasMount){
      this.mountTime-=dt; if(this.mountTime<=0){ this.setMount(false); }
    }
    if(this.invincible>0) this.invincible-=dt;

    this.group.position.y=this.y;

    // animations
    const t=this.runTime;
    if(this.grounded && !this.sliding){
      const s=Math.sin(t*1.1); const c=Math.cos(t*1.1);
      this.legL.rotation.x= s*0.7; this.legR.rotation.x= -s*0.7;
      this.armL.rotation.x= -s*0.7; this.armR.rotation.x= s*0.7;
      this.mesh.position.y= (this.hasMount?1.55:0.95) + Math.abs(Math.sin(t*2.2))*0.06;
      this.mesh.rotation.z= Math.sin(t*0.9)*0.04;
      this.head.rotation.y= Math.sin(t*0.6)*0.08;
      this.scarf.rotation.x= Math.sin(t*1.8)*0.15;
    } else if(this.sliding){
      this.mesh.rotation.x= 0.45; this.mesh.position.y=0.55;
      this.legL.rotation.x= -0.6; this.legR.rotation.x= -0.6;
    } else {
      // air
      this.mesh.rotation.x= THREE.MathUtils.lerp(this.mesh.rotation.x, this.vy>0? -0.25:0.35, dt*8);
      this.legL.rotation.x= -0.3; this.legR.rotation.x= -0.3;
      this.armL.rotation.x= -0.9; this.armR.rotation.x= -0.9;
    }
    if(this.sliding) this.mesh.scale.y=0.72; else this.mesh.scale.y=1;
    // invincible flicker
    if(this.invincible>0){
      const blink= Math.floor(this.invincible*12)%2===0;
      this.mesh.visible=blink; this.mountGroup.visible= this.hasMount? blink:false;
    } else { this.mesh.visible=true; if(this.hasMount) this.mountGroup.visible=true; }

    // pet orbit
    if(this.petVisible){
      this.petTime+=dt;
      const px=this.x + Math.cos(this.petTime*1.6)*1.1 + 0.6;
      const py= this.y + 1.5 + Math.sin(this.petTime*2.1)*0.25 + (this.hasMount?0.6:0);
      const pz= this.z -0.2 + Math.sin(this.petTime*1.3)*0.5;
      this.pet.position.lerp(new THREE.Vector3(px,py,pz), 0.12);
      this.pet.rotation.y+=dt*2.2;
      this.pet.children[1].rotation.z+=dt*3;
    }

    // adjust collider center
    this.colliderY= this.y + this.height*0.5 + (this.sliding?0:0.05);
  }
  getAABB(){
    // return x,z,y box
    return {
      minX:this.x - this.radius, maxX:this.x + this.radius,
      minY:this.colliderY - this.height*0.5, maxY:this.colliderY + this.height*0.5,
      minZ:this.z -0.5, maxZ:this.z+0.5
    };
  }
  getPos(){ return new THREE.Vector3(this.x, this.colliderY, this.z); }
}

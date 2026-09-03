import * as THREE from 'three';
import { CONFIG, loadBest, saveBest } from './config.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { ParticlePool } from './particles.js';
import { AudioMgr } from './audio.js';

export class Game{
  constructor(container){
    this.container=container;
    this.width=container.clientWidth; this.height=container.clientHeight;

    this.scene=new THREE.Scene();
    this.scene.fog=new THREE.Fog(0x0a0b1a, 22, 78);
    this.camera=new THREE.PerspectiveCamera(66, this.width/this.height, 0.1, 200);
    this.camera.position.set(0,5.6,11.5);
    this.renderer=new THREE.WebGLRenderer({antialias:true, alpha:false});
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(this.width,this.height);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // lights
    this.scene.add(new THREE.HemisphereLight(0x8a8dff, 0x0a0a14, 1.1));
    const dir=new THREE.DirectionalLight(0xffffff, 1.35); dir.position.set(6,12,6); dir.castShadow=true;
    dir.shadow.mapSize.set(2048,2048); dir.shadow.camera.near=0.5; dir.shadow.camera.far=50;
    dir.shadow.camera.left=-18; dir.shadow.camera.right=18; dir.shadow.camera.top=18; dir.shadow.camera.bottom=-18;
    this.scene.add(dir);
    const fill=new THREE.DirectionalLight(0xa890ff, 0.55); fill.position.set(-6,6,-4); this.scene.add(fill);

    // ground shadow plane for perf
    this.player=new Player(this.scene);
    this.level=new Level(this.scene);
    this.particles=new ParticlePool(this.scene, 180);
    this.audio=new AudioMgr();

    this.state='menu'; // menu playing paused over
    this.mode='normal'; // normal super cross
    this.modeTime=0;
    this.speed=CONFIG.baseSpeed;
    this.distance=0;
    this.score=0;
    this.coins=0;
    this.stomps=0;
    this.mult=1;
    this.superMeter=0;
    this.needSuper=CONFIG.superNeed;
    this.magnetTime=0; this.shieldTime=0; this.dashTime=0; this.dashCd=0;
    this.invincibleTime=0;
    this.canRevive=true; this.reviveTimer=0;
    this.best=loadBest();
    this.combo=0; this.comboTime=0;

    this.clock=new THREE.Clock();
    this.t=0;

    // events
    window.addEventListener('resize', ()=>this.resize());
    this.setupSceneEnv();
    this.loop();
  }
  setupSceneEnv(){
    // fog colors per mode will be updated
    this.baseFog=new THREE.Color(0x0a0b1a);
    this.superFog=new THREE.Color(0x3a2a12);
    this.crossFog=new THREE.Color(0x08101f);
  }
  resize(){
    this.width=this.container.clientWidth; this.height=this.container.clientHeight;
    this.camera.aspect=this.width/this.height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width,this.height);
  }
  start(){
    this.audio.init(); this.audio.startBGM();
    this.state='playing'; this.mode='normal'; this.modeTime=0;
    this.distance=0; this.score=0; this.coins=0; this.stomps=0; this.mult=1;
    this.speed=CONFIG.baseSpeed; this.superMeter=0;
    this.magnetTime=0; this.shieldTime=0; this.dashTime=0; this.dashCd=0; this.invincibleTime=1.0;
    this.canRevive=true;
    this.player.group.position.set(0,0,0); this.player.x=0; this.player.targetX=0; this.player.lane=1;
    this.player.y=0; this.player.vy=0; this.player.grounded=true; this.player.setMount(false); this.player.setShield(false);
    this.player.setInvincible(1.2);
    this.combo=0; this.comboTime=0;
    this.level.root.position.z=0; this.level.setMode(false,false);
    this.updateFog(0);
    // reset chunks positions? keep as is but rebuild
    // ensure player invincible flash handled
  }
  pause(){ if(this.state==='playing'){ this.state='paused'; this.audio.stopBGM(); } }
  resume(){ if(this.state==='paused'){ this.state='playing'; this.audio.startBGM(); if(this.audio.ctx && this.audio.ctx.state==='suspended') this.audio.ctx.resume(); } }
  gameOver(){
    this.state='over'; this.audio.stopBGM(); this.audio.die();
    // save best
    let isNew=false;
    if(this.score>this.best.score || this.distance>this.best.dist){
      this.best={score:Math.max(this.best.score,this.score), dist:Math.max(this.best.dist, Math.floor(this.distance)), coins:Math.max(this.best.coins,this.coins)};
      saveBest(this.best); isNew=true;
    }
    if(this.onOver) this.onOver(isNew);
    if(this.canRevive) this.reviveTimer=5;
  }
  revive(){
    if(!this.canRevive || this.state!=='over') return false;
    this.canRevive=false; this.reviveTimer=0;
    this.state='playing';
    this.player.setInvincible(3.0); this.dashTime=3.0; this.speed=Math.max(CONFIG.baseSpeed, this.speed*0.92);
    this.audio.revive(); this.spawnFlash('#a890ff',0.35);
    this.showToast('复活成功！3s 无敌冲刺');
    this.audio.startBGM();
    return true;
  }
  triggerSuper(){
    if(this.mode!=='normal') return;
    this.mode='super'; this.modeTime=CONFIG.superDuration; this.mult=3;
    this.level.setMode(true,false); this.spawnFlash('#ffd54f',0.45); this.audio.superEnter();
    this.player.setInvincible(CONFIG.superDuration+0.6);
    this.showCombo('SUPER REWARD', '金币风暴 · x3 倍率');
    this.updateFog(1);
  }
  triggerCross(){
    if(this.mode!=='normal') return;
    this.mode='cross'; this.modeTime=CONFIG.crossDuration; this.mult=2;
    this.level.setMode(false,true); this.spawnFlash('#00e5ff',0.5); this.audio.portal();
    this.player.setInvincible(CONFIG.crossDuration+0.6);
    this.showCombo('穿越奖励', '星际隧道 · 高速巡航');
    this.updateFog(2);
  }
  endMode(){
    this.mode='normal'; this.mult=1; this.level.setMode(false,false); this.player.setInvincible(1.6);
    this.spawnFlash('#ffffff',0.25); this.updateFog(0);
  }
  updateFog(mode){
    if(mode===1){ this.scene.fog.color.copy(this.superFog); this.scene.background=new THREE.Color(0x2a1f0a); }
    else if(mode===2){ this.scene.fog.color.copy(this.crossFog); this.scene.background=new THREE.Color(0x050a18); }
    else { this.scene.fog.color.copy(this.baseFog); this.scene.background=new THREE.Color(0x070816); }
  }
  spawnFlash(color, amount){
    const el=document.getElementById('flash');
    if(!el) return;
    el.style.background=color; el.style.opacity=amount; el.style.transition='none';
    requestAnimationFrame(()=>{ el.style.transition='opacity 420ms ease'; el.style.opacity='0'; });
  }
  showCombo(title, sub){
    const el=document.getElementById('combo');
    if(!el) return;
    el.innerHTML=`${title}<small>${sub}</small>`; el.classList.remove('hidden');
    el.animate([{transform:'translateX(-50%) scale(0.85)', opacity:0},{transform:'translateX(-50%) scale(1)', opacity:1}],{duration:320, easing:'cubic-bezier(.16,1,.3,1)'});
    clearTimeout(this._comboTO); this._comboTO=setTimeout(()=>el.classList.add('hidden'), 1800);
  }
  showToast(msg){
    const el=document.getElementById('toast');
    if(!el) return;
    el.textContent=msg; el.classList.remove('hidden');
    clearTimeout(this._toastTO); this._toastTO=setTimeout(()=>el.classList.add('hidden'), 1600);
  }
  handleInput(action){
    if(this.state!=='playing') return;
    if(action==='jump'){
      const res=this.player.jump();
      if(res==='jump') { this.audio.jump(); this.particles.spawn(this.player.getPos(),{count:4,color:0xffffff, spread:0.6, up:1, life:0.28, size:0.6}); }
      else if(res==='double') { this.audio.doubleJump(); this.particles.spawn(this.player.getPos(),{count:7,color:0x00e5ff, spread:1.2, up:2, life:0.35, size:0.7}); }
    } else if(action==='slide'){
      const r=this.player.slide();
      if(r===true) { this.particles.spawn(new THREE.Vector3(this.player.x,0.15,this.player.z),{count:6,color:0x8a8dff, spread:1.4, up:0.6, life:0.35,size:0.6}); }
      else if(r==='dive') { this.particles.spawn(this.player.getPos(),{count:5,color:0xff3b9a, spread:1, up:0.2, life:0.3,size:0.7}); }
    } else if(action==='dash'){
      if(this.dashCd>0){ this.showToast(`冲刺冷却 ${this.dashCd.toFixed(1)}s`); return; }
      this.dashTime=CONFIG.dashDuration; this.dashCd=CONFIG.dashCooldown;
      this.player.setInvincible(CONFIG.dashDuration+0.2);
      this.audio.dash(); this.spawnFlash('#a890ff',0.18);
      this.particles.spawn(this.player.getPos(),{count:12,color:0xa890ff, spread:2, up:1.2, life:0.5,size:0.9});
      this.showCombo('NOVA 冲刺','无敌破障 · 3s');
    } else if(action==='left'){ this.player.moveLane(-1); }
    else if(action==='right'){ this.player.moveLane(1); }
  }
  update(dt){
    if(this.state==='paused' || this.state==='menu'){
      // still animate BG slowly
      this.particles.update(dt);
      this.player.update(dt, 0);
      return;
    }
    if(this.state==='over'){
      if(this.canRevive && this.reviveTimer>0){ this.reviveTimer-=dt; if(this.onReviveTick) this.onReviveTick(this.reviveTimer); if(this.reviveTimer<=0){ this.canRevive=false; if(this.onReviveEnd) this.onReviveEnd(); } }
      this.particles.update(dt);
      return;
    }
    // playing
    this.t+=dt;

    // speed ramp
    const targetMax= this.mode==='super'? CONFIG.maxSpeed -2 : this.mode==='cross'? CONFIG.maxSpeed -1 : CONFIG.maxSpeed;
    const add= this.mode==='cross'? 0.9: this.mode==='super'? 0.3 : CONFIG.accel;
    this.speed= Math.min(targetMax, this.speed + add*dt);
    let curSpeed=this.speed;
    if(this.dashTime>0) curSpeed+=CONFIG.dashSpeedBoost;
    if(this.mode==='cross') curSpeed*=1.28;
    if(this.mode==='super') curSpeed*=0.92; // slightly slower for collecting

    // timers
    if(this.magnetTime>0){ this.magnetTime-=dt; if(this.magnetTime<=0) this.magnetTime=0; }
    if(this.shieldTime>0){ this.shieldTime-=dt; if(this.shieldTime<=0) this.player.setShield(false); }
    if(this.dashTime>0) this.dashTime-=dt;
    if(this.dashCd>0) this.dashCd-=dt;
    if(this.comboTime>0){ this.comboTime-=dt; if(this.comboTime<=0) this.combo=0; }

    // mode timer
    if(this.mode!=='normal'){
      this.modeTime-=dt;
      if(this.modeTime<=0) this.endMode();
    }

    // distance/score
    this.distance+= curSpeed*dt*1.02;
    const baseScore= curSpeed*dt*10;
    this.score+= baseScore * this.mult;

    // level move
    this.level.update(curSpeed, dt);
    this.player.update(dt, curSpeed);
    this.particles.update(dt);

    // camera follow
    const camTargetX= this.player.x*0.32;
    this.camera.position.x= THREE.MathUtils.lerp(this.camera.position.x, camTargetX, dt*3);
    this.camera.position.y= THREE.MathUtils.lerp(this.camera.position.y, this.player.hasMount?6.2:5.6 + (this.player.y*0.18), dt*4);
    const fovBase=66 + (curSpeed- CONFIG.baseSpeed)*0.55 + (this.dashTime>0?8:0) + (this.mode==='cross'?6:0);
    this.camera.fov= THREE.MathUtils.lerp(this.camera.fov, fovBase, dt*3); this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.player.x*0.45, 1.0+this.player.y*0.35, -6);

    // camera shake
    if(this._shake>0){
      this._shake-=dt; const s=this._shake*0.5;
      this.camera.position.x+=(Math.random()-0.5)*s;
      this.camera.position.y+=(Math.random()-0.5)*s;
    }

    // collisions
    this.checkCollisions(curSpeed);
  }
  checkCollisions(curSpeed){
    const nearby=this.level.getNearby(this.player.group.position.z);
    const pAABB=this.player.getAABB();
    const inv= this.player.invincible>0 || this.dashTime>0 || this.mode!=='normal'; // super/cross invincible

    // obstacles
    for(const {o, wCollider} of nearby.obs){
      // quick lane check for pillar/monster? but we use AABB
      // gate needs special crouch check
      let hit=false;
      if(o.type==='gate'){
        // gate block: if player height > gap and overlaps XZ, then hit
        const overlapX= pAABB.maxX > wCollider.minX && pAABB.minX < wCollider.maxX;
        const overlapZ= pAABB.maxZ > wCollider.minZ && pAABB.minZ < wCollider.maxZ;
        const playerTop= pAABB.maxY; // minY is ground 0
        const needsCrouch= playerTop > wCollider.minY +0.25;
        if(overlapX && overlapZ){
          if(needsCrouch){
            if(!this.player.sliding) hit=true;
          } else {
            // passing under, not hit, but ensure not hitting pillars? already check x overlap includes pillars but gap passes
            // if player not sliding, still may clip top? we already handled
          }
        }
      } else if(o.type==='monster'){
        const overlapX= pAABB.maxX > wCollider.minX && pAABB.minX < wCollider.maxX;
        const overlapZ= pAABB.maxZ > wCollider.minZ && pAABB.minZ < wCollider.maxZ;
        const overlapY= pAABB.maxY > wCollider.minY && pAABB.minY < wCollider.maxY;
        if(overlapX && overlapZ && overlapY){
          // check stomp: player descending and bottom above monster top - threshold
          const isFalling= this.player.vy< -1;
          const playerBottom= pAABB.minY;
          const monsterTop= wCollider.maxY;
          const above= playerBottom > monsterTop -0.35 && this.player.y > 0.7;
          if((isFalling || above) && this.player.vy<=-0.2){
            // stomp success
            hit=false;
            // remove monster
            o.mesh.visible=false;
            // bounce
            this.player.vy= 10;
            this.player.grounded=false;
            this.stomps++; this.score+= 500*this.mult; this.combo++; this.comboTime=1.8;
            this.particles.burstHit(new THREE.Vector3(o.collider.minX+ (o.collider.maxX-o.collider.minX)/2, 0.9, wCollider.minZ));
            this.audio.stomp();
            this.showCombo(`STOMP x${this.combo}`, `+${500*this.mult}`);
            // small shake
            this._shake=0.35;
          } else {
            hit=true;
          }
        }
      } else {
        // spike/pillar generic AABB
        const overlapX= pAABB.maxX > wCollider.minX && pAABB.minX < wCollider.maxX;
        const overlapZ= pAABB.maxZ > wCollider.minZ && pAABB.minZ < wCollider.maxZ;
        const overlapY= pAABB.maxY > wCollider.minY && pAABB.minY < wCollider.maxY;
        if(overlapX && overlapZ && overlapY) hit=true;
      }

      if(hit){
        if(inv){
          // in dash/super/cross: break obstacle visually but not die
          if(this.dashTime>0 || this.mode!=='normal'){
            // smash
            if(o.mesh.visible){
              o.mesh.visible=false;
              this.particles.burstHit(new THREE.Vector3((wCollider.minX+wCollider.maxX)/2, 0.8, (wCollider.minZ+wCollider.maxZ)/2));
              this.score+= 150*this.mult;
              if(this.dashTime>0) this._shake=0.18;
            }
          }
          continue;
        }
        // check shield / mount
        if(this.player.hasShield){
          this.player.setShield(false); this.shieldTime=0;
          this.player.setInvincible(CONFIG.invincibleAfterDamage);
          this.particles.burstHit(this.player.getPos()); this.audio.hit(); this._shake=0.6; this.spawnFlash('#ffd54f',0.28);
          this.showToast('护盾抵挡一次伤害');
          o.mesh.visible=false;
          continue;
        }
        if(this.player.hasMount){
          this.player.setMount(false); this.player.setInvincible(CONFIG.invincibleAfterDamage);
          this.particles.burstHit(this.player.getPos()); this.audio.hit(); this._shake=0.6; this.spawnFlash('#a890ff',0.28);
          this.showToast('坐骑保护了一次！');
          o.mesh.visible=false;
          continue;
        }
        // die
        this.particles.burstHit(this.player.getPos());
        this._shake=0.9; this.spawnFlash('#ff3b5a',0.38);
        this.gameOver();
        return;
      }
    }

    // powers
    for(const {p, wz, wx, wy} of nearby.powers){
      if(p.mesh.visible===false) continue;
      // 使用 mesh 实时位置 诶嘿 更准
      const pwX= p.mesh.position.x;
      const pwY= p.mesh.position.y;
      const dx= Math.abs(this.player.x - pwX);
      const dz= Math.abs(0 - wz);
      const dy= Math.abs(this.player.colliderY - pwY);
      if(dx<1.05 && dz<1.05 && dy<1.45){
        p.mesh.visible=false;
        this.collectPower(p.type);
      } else if(this.magnetTime>0){
        const pullDist= Math.hypot(dx, dz);
        if(pullDist < CONFIG.magnetRadius){
          p.mesh.userData._pulling=true;
          const lerp= 9*0.016;
          p.mesh.position.x= THREE.MathUtils.lerp(p.mesh.position.x, this.player.x, lerp*4);
          p.mesh.position.y= THREE.MathUtils.lerp(p.mesh.position.y, this.player.colliderY, lerp*4);
          p.x=p.mesh.position.x;
        }
      }
    }

    // coins with magnet
    for(const {coin, wz, wx, wy} of nearby.coins){
      if(coin.collected) continue;
      // 用实时 mesh 位置算距离 否则会被 hover 覆盖 呜哇
      const cwX= coin.mesh.position.x;
      const cwY= coin.mesh.position.y;
      let dx= this.player.x - cwX;
      let dz= 0 - wz;
      let dy= this.player.colliderY - cwY;
      let distSq= dx*dx + dy*dy + dz*dz;
      let attract= this.magnetTime>0 || this.player.petVisible; // pet gives small magnet
      let radius= this.magnetTime>0? CONFIG.magnetRadius : 1.9;
      if(attract && this.magnetTime<=0) radius=2.8;
      if(distSq < 1.45*1.45){
        this.collectCoin(coin);
      } else if(attract && distSq < radius*radius){
        coin._pulling=true;
        const factor= this.magnetTime>0? 18: 9;
        const inv= 1/Math.sqrt(distSq);
        dx*=inv; dy*=inv; dz*=inv;
        const move= factor*0.016;
        coin.mesh.position.x+= dx*move*2.2;
        coin.mesh.position.y+= dy*move*2.2;
        coin.mesh.position.z+= dz*move*1.2;
        coin.x=coin.mesh.position.x; coin.y=coin.mesh.position.y; coin.z=coin.mesh.position.z;
      }
    }

    // portals
    for(const {portal, wz, wx} of nearby.portals){
      if(!portal.visible) continue;
      const dx=Math.abs(this.player.x - wx);
      const dz=Math.abs(0 - wz);
      if(dx<1.25 && dz<1.2){
        portal.visible=false;
        this.triggerCross();
      }
    }
  }
  collectCoin(coin){
    if(coin.collected) return;
    coin.collected=true; coin.mesh.visible=false;
    const isSuperCoin= coin.isSuper;
    const val= isSuperCoin? 200 : 100;
    this.coins++; this.score+= val*this.mult;
    this.combo++; this.comboTime=1.6;
    // super meter
    if(this.mode==='normal'){
      this.superMeter+= 1;
      if(this.superMeter>= this.needSuper){
        this.superMeter=0;
        this.triggerSuper();
      }
    } else if(this.mode==='super'){
      this.score+= 80; // extra
    }
    this.particles.burstCoin(coin.mesh.position, isSuperCoin || this.mode==='super');
    if(isSuperCoin || this.mode==='super') this.audio.coinSuper(); else this.audio.coin();
    // quick trail
    if(this.combo>3){
      const el=document.getElementById('combo');
      // update combo display in HUD handled by ui, but show popup for big combo
      if(this.combo>=5 && this.combo%5===0) this.showCombo(`COMBO x${this.combo}`, `金币 ${this.coins}`);
    }
  }
  collectPower(type){
    if(type==='magnet'){
      this.magnetTime= CONFIG.magnetDuration;
      this.audio.shield(); this.showToast('🧲 磁铁 8s 吸附');
      this.particles.spawn(this.player.getPos(),{count:10,color:0x00e5ff, spread:1.6, up:1.2, life:0.5,size:0.75});
    } else if(type==='shield'){
      this.shieldTime= CONFIG.shieldDuration;
      this.player.setShield(true);
      this.audio.shield(); this.showToast('🛡 护盾已激活');
      this.particles.spawn(this.player.getPos(),{count:10,color:0xffd54f, spread:1.4, up:1, life:0.5,size:0.75});
    } else if(type==='dash'){
      this.dashTime= CONFIG.dashDuration; this.dashCd=0;
      this.player.setInvincible(CONFIG.dashDuration+0.2);
      this.audio.dash(); this.spawnFlash('#ff3b9a',0.22);
      this.showToast('🚀 冲刺爆发！');
    } else if(type==='mount'){
      this.player.setMount(true, 14);
      this.audio.shield(); this.showToast('★ 星兽坐骑降临！可抵挡一次');
      this.particles.spawn(this.player.getPos(),{count:12,color:0xa890ff, spread:1.8, up:1.4, life:0.55,size:0.8});
    }
  }
  loop(){
    requestAnimationFrame(()=>this.loop());
    const dt=Math.min(0.033, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
  getHUD(){
    return {
      score: Math.floor(this.score),
      dist: Math.floor(this.distance),
      coins: this.coins,
      speed: this.speed + (this.dashTime>0? CONFIG.dashSpeedBoost:0) + (this.mode==='cross'? this.speed*0.28:0),
      mult:this.mult,
      superPct: Math.min(1, this.superMeter/this.needSuper),
      magnet: this.magnetTime,
      shield: this.shieldTime,
      dashCd: Math.max(0,this.dashCd),
      dashActive: this.dashTime>0,
      mode:this.mode, modeTime:this.modeTime,
      combo:this.combo
    };
  }
}

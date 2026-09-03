export function bindUI(game){
  const hud=document.getElementById('hud');
  const screenStart=document.getElementById('screen-start');
  const screenPause=document.getElementById('screen-pause');
  const screenOver=document.getElementById('screen-over');

  const els={
    hudScore: document.getElementById('hud-score'),
    hudMult: document.getElementById('hud-mult'),
    hudDist: document.getElementById('hud-dist'),
    hudCoins: document.getElementById('hud-coins'),
    hudSpeed: document.getElementById('hud-speed'),
    meterFill: document.getElementById('meter-fill'),
    meterPct: document.getElementById('meter-pct'),
    buffs: document.getElementById('buffs'),
    modeBanner: document.getElementById('mode-banner'),
    modeTitle: document.getElementById('mode-title'),
    modeTimer: document.getElementById('mode-timer'),
    modeSub: document.getElementById('mode-sub'),
    modeProgress: document.getElementById('mode-progress-fill'),
    skillCd: document.getElementById('skill-cd'),
    tJump: document.getElementById('t-jump'),
    tSlide: document.getElementById('t-slide'),
    tSkill: document.getElementById('t-skill'),
    btnPause: document.getElementById('btn-pause'),
    btnMute: document.getElementById('btn-mute'),
  };

  const startBtn=document.getElementById('btn-start');
  const btnResume=document.getElementById('btn-resume');
  const btnRestart1=document.getElementById('btn-restart1');
  const btnQuit1=document.getElementById('btn-quit1');
  const btnRestart2=document.getElementById('btn-restart2');
  const btnQuit2=document.getElementById('btn-quit2');
  const btnRevive=document.getElementById('btn-revive');
  const reviveWrap=document.getElementById('revive-wrap');
  const reviveCount=document.getElementById('revive-count');

  const startBest=document.getElementById('start-best');
  const startDist=document.getElementById('start-dist');
  const startCoins=document.getElementById('start-coins');
  const pauseScore=document.getElementById('pause-score');
  const pauseDist=document.getElementById('pause-dist');
  const overScore=document.getElementById('over-score');
  const overDist=document.getElementById('over-dist');
  const overCoins=document.getElementById('over-coins');
  const overStomp=document.getElementById('over-stomp');
  const overBest=document.getElementById('over-best');
  const newRecord=document.getElementById('new-record');

  const optMount=document.getElementById('opt-mount');
  const optPet=document.getElementById('opt-pet');
  const optChar=document.getElementById('opt-char');

  let mountOn=true, petOn=true;
  let muted=false;

  function refreshBest(){
    const b=game.best;
    startBest.textContent=b.score; startDist.textContent=b.dist+'m'; startCoins.textContent=b.coins;
    overBest.textContent=b.score;
  }
  refreshBest();

  optMount.addEventListener('click',()=>{
    mountOn=!mountOn; optMount.classList.toggle('on', mountOn);
    optMount.textContent= mountOn? optMount.dataset.on : optMount.dataset.off;
    game.player.setMount(mountOn && game.state==='playing'? true:false, 999);
    if(!mountOn) game.player.setMount(false);
  });
  optPet.addEventListener('click',()=>{
    petOn=!petOn; optPet.classList.toggle('on', petOn);
    optPet.textContent= petOn? optPet.dataset.on : optPet.dataset.off;
    game.player.setPetVisible(petOn);
  });
  let charIdx=0; const chars=['诺瓦','星羽','璃'];
  optChar.addEventListener('click',()=>{
    charIdx=(charIdx+1)%chars.length;
    optChar.textContent='角色: '+chars[charIdx];
    // tint body
    const cols=[0xa890ff,0xff7ab8,0x7af0ff];
    game.player.body.material.color.setHex(cols[charIdx]);
  });

  function showStart(){
    screenStart.classList.remove('hidden');
    hud.classList.add('hidden');
    screenPause.classList.add('hidden');
    screenOver.classList.add('hidden');
    refreshBest();
  }
  function showHUD(){
    screenStart.classList.add('hidden');
    screenPause.classList.add('hidden');
    screenOver.classList.add('hidden');
    hud.classList.remove('hidden');
  }
  function showPause(){
    screenPause.classList.remove('hidden');
    pauseScore.textContent=Math.floor(game.score);
    pauseDist.textContent=Math.floor(game.distance)+'m';
  }
  function showOver(isNew){
    screenOver.classList.remove('hidden');
    hud.classList.add('hidden');
    overScore.textContent=Math.floor(game.score);
    overDist.textContent=Math.floor(game.distance)+'m';
    overCoins.textContent=game.coins;
    overStomp.textContent=game.stomps;
    newRecord.classList.toggle('hidden', !isNew);
    refreshBest();
    if(game.canRevive){ reviveWrap.style.display=''; } else { reviveWrap.style.display='none'; }
  }

  startBtn.addEventListener('click',()=>{
    // apply opts
    game.player.setPetVisible(petOn);
    // if mount toggle on, give mount at start? we treat as cosmetic for later but start without invincibility advantage delay
    // keep mount toggle as future mount spawn: if on, set mount true for 20s intro
    if(mountOn){ /* start with mount for 8s showcase */ }
    game.start();
    if(mountOn){ game.player.setMount(true, 10); }
    showHUD();
  });

  els.btnPause.addEventListener('click',()=>{
    if(game.state==='playing'){ game.pause(); showPause(); els.btnPause.textContent='▶'; }
    else if(game.state==='paused'){ game.resume(); screenPause.classList.add('hidden'); els.btnPause.textContent='Ⅱ'; }
  });
  btnResume.addEventListener('click',()=>{ game.resume(); screenPause.classList.add('hidden'); els.btnPause.textContent='Ⅱ'; });
  btnRestart1.addEventListener('click',()=>{ game.start(); showHUD(); els.btnPause.textContent='Ⅱ'; });
  btnQuit1.addEventListener('click',()=>{ game.state='menu'; game.audio.stopBGM(); showStart(); els.btnPause.textContent='Ⅱ'; });
  btnRestart2.addEventListener('click',()=>{ game.start(); showHUD(); });
  btnQuit2.addEventListener('click',()=>{ game.state='menu'; game.audio.stopBGM(); showStart(); });

  btnRevive.addEventListener('click',()=>{
    if(game.revive()){ screenOver.classList.add('hidden'); hud.classList.remove('hidden'); }
  });

  els.btnMute.addEventListener('click',()=>{
    muted=!muted; game.audio.setMuted(muted); els.btnMute.textContent= muted?'♫̸':'♪';
    els.btnMute.style.opacity= muted? '0.6':'1';
  });

  // touch
  els.tJump.addEventListener('touchstart', e=>{ e.preventDefault(); game.handleInput('jump'); },{passive:false});
  els.tJump.addEventListener('click', ()=> game.handleInput('jump'));
  els.tSlide.addEventListener('touchstart', e=>{ e.preventDefault(); game.handleInput('slide'); },{passive:false});
  els.tSlide.addEventListener('click', ()=> game.handleInput('slide'));
  els.tSkill.addEventListener('touchstart', e=>{ e.preventDefault(); game.handleInput('dash'); },{passive:false});
  els.tSkill.addEventListener('click', ()=> game.handleInput('dash'));

  game.onOver=(isNew)=> showOver(isNew);
  game.onReviveTick=(t)=>{ if(reviveCount) reviveCount.textContent= Math.ceil(t); if(t<=0) reviveWrap.style.display='none'; };
  game.onReviveEnd=()=>{ reviveWrap.style.display='none'; };

  // keyboard
  window.addEventListener('keydown', (e)=>{
    if(e.repeat) return;
    if(e.code==='Space' || e.code==='ArrowUp' || e.code==='KeyW'){ e.preventDefault(); if(game.state==='playing') game.handleInput('jump'); else if(game.state==='menu') startBtn.click(); }
    else if(e.code==='ArrowDown' || e.code==='KeyS'){ e.preventDefault(); game.handleInput('slide'); }
    else if(e.code==='KeyF' || e.code==='ShiftLeft' || e.code==='KeyE'){ game.handleInput('dash'); }
    else if(e.code==='KeyA' || e.code==='ArrowLeft'){ game.handleInput('left'); }
    else if(e.code==='KeyD' || e.code==='ArrowRight'){ game.handleInput('right'); }
    else if(e.code==='KeyP' || e.code==='Escape'){
      if(game.state==='playing'){ game.pause(); showPause(); }
      else if(game.state==='paused'){ game.resume(); screenPause.classList.add('hidden'); }
    }
    else if(e.code==='KeyM'){ muted=!muted; game.audio.setMuted(muted); els.btnMute.textContent= muted?'♫̸':'♪'; }
  });

  // swipe
  let touchStart=null;
  window.addEventListener('touchstart', e=>{
    if(e.touches.length===1) touchStart={x:e.touches[0].clientX, y:e.touches[0].clientY, t:performance.now()};
  },{passive:true});
  window.addEventListener('touchend', e=>{
    if(!touchStart) return;
    const t=e.changedTouches[0];
    const dx=t.clientX - touchStart.x; const dy=t.clientY - touchStart.y; const dt=performance.now()-touchStart.t;
    if(dt>500) {touchStart=null; return;}
    if(Math.abs(dx)>30 && Math.abs(dx)>Math.abs(dy)){
      if(dx<0) game.handleInput('left'); else game.handleInput('right');
    } else if(Math.abs(dy)>28){
      if(dy<0) game.handleInput('jump'); else game.handleInput('slide');
    } else {
      // tap right side = jump, left = slide
      if(t.clientX > window.innerWidth*0.5) game.handleInput('jump'); else game.handleInput('slide');
    }
    touchStart=null;
  },{passive:true});

  // per frame HUD update
  function tick(){
    requestAnimationFrame(tick);
    const h=game.getHUD();
    els.hudScore.textContent=h.score;
    els.hudDist.textContent=h.dist+'m';
    els.hudCoins.textContent=h.coins;
    els.hudSpeed.textContent=h.speed.toFixed(1);
    els.hudMult.textContent='x'+h.mult;
    els.hudMult.classList.toggle('hidden', h.mult===1);
    els.meterFill.style.width=(h.superPct*100)+'%';
    els.meterPct.textContent=Math.floor(h.superPct*100)+'%';
    document.getElementById('meter-glow').style.opacity= h.superPct>0.98? '1':'0';

    // buffs
    els.buffs.innerHTML='';
    if(h.magnet>0) els.buffs.innerHTML+=`<span class="buff mag">🧲 ${h.magnet.toFixed(1)}s</span>`;
    else if(game.player.petVisible) els.buffs.innerHTML+=`<span class="buff" style="opacity:.65">⊕ 宠物吸币</span>`;
    if(h.shield>0) els.buffs.innerHTML+=`<span class="buff shd">🛡 ${h.shield.toFixed(1)}s</span>`;
    else if(game.player.hasShield) els.buffs.innerHTML+=`<span class="buff shd">🛡 护盾</span>`;
    if(h.dashActive) els.buffs.innerHTML+=`<span class="buff dash">⚡ 冲刺 ${game.dashTime.toFixed(1)}s</span>`;
    if(game.player.hasMount) els.buffs.innerHTML+=`<span class="buff" style="background:#a890ff22;border-color:#a890ff55;color:#d1c2ff">★ 星兽</span>`;
    if(h.mode!=='normal') els.buffs.innerHTML+=`<span class="buff inv">★ ${h.mode==='super'?'SUPER':'CROSS'} ${h.modeTime.toFixed(1)}s</span>`;

    // mode banner
    if(h.mode!=='normal'){
      els.modeBanner.classList.remove('hidden');
      els.modeBanner.className='mode-banner '+(h.mode==='super'?'super':'cross');
      els.modeTitle.textContent= h.mode==='super'?'SUPER REWARD':'CROSS WARP';
      els.modeTimer.textContent= h.modeTime.toFixed(1)+'s';
      els.modeSub.textContent= h.mode==='super'?'金币风暴 · 无敌 · x3':'高速隧道 · 无敌 · x2';
      const pct= Math.max(0, h.modeTime/(h.mode==='super'? 9:8));
      els.modeProgress.style.transform=`scaleX(${pct})`;
    } else els.modeBanner.classList.add('hidden');

    // skill cd
    if(h.dashCd>0){
      els.tSkill.classList.add('cooldown');
      els.skillCd.textContent= h.dashCd.toFixed(1)+'s';
      els.skillCd.style.opacity='1';
    } else {
      els.tSkill.classList.remove('cooldown');
      els.skillCd.style.opacity='0';
    }
  }
  tick();

  // expose
  return {showStart, showHUD};
}

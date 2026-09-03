// 雨涵的合成小音箱 WebAudio 从零搓音效 呜哇好玩
export class AudioMgr{
  constructor(){
    this.ctx=null; this.muted=false; this.bgmGain=null; this.sfxGain=null; this.bgmTimer=null; this.enabled=false;
  }
  init(){
    if(this.ctx) return;
    try{
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.bgmGain=this.ctx.createGain(); this.bgmGain.gain.value=0.12; this.bgmGain.connect(this.ctx.destination);
      this.sfxGain=this.ctx.createGain(); this.sfxGain.gain.value=0.28; this.sfxGain.connect(this.ctx.destination);
      this.enabled=true;
    }catch{ this.enabled=false; }
  }
  setMuted(m){ this.muted=m; if(this.bgmGain) this.bgmGain.gain.value= m?0:0.12; if(this.sfxGain) this.sfxGain.gain.value= m?0:0.28; }
  _tone({freq=440, freq2=null, type='sine', dur=0.2, gain=0.5, slide=0, attack=0.01}){
    if(!this.enabled||this.muted||!this.ctx) return;
    if(this.ctx.state==='suspended') this.ctx.resume();
    const o=this.ctx.createOscillator(); const g=this.ctx.createGain();
    o.type=type; o.frequency.value=freq;
    if(freq2!==null) o.frequency.linearRampToValueAtTime(freq2, this.ctx.currentTime+dur);
    else if(slide) o.frequency.linearRampToValueAtTime(freq+slide, this.ctx.currentTime+dur);
    g.gain.value=0; g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime+attack);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+dur);
    o.connect(g).connect(this.sfxGain); o.start(); o.stop(this.ctx.currentTime+dur+0.02);
  }
  jump(){ this._tone({freq:220,freq2:720,type:'square',dur:0.18,gain:0.45}); }
  doubleJump(){ this._tone({freq:360,freq2:880,type:'square',dur:0.16,gain:0.42}); setTimeout(()=>this._tone({freq:880,freq2:1200,type:'sine',dur:0.12,gain:0.25}),80); }
  coin(){ this._tone({freq:900,freq2:1400,type:'sine',dur:0.14,gain:0.35}); }
  coinSuper(){ this._tone({freq:1100,freq2:1600,type:'triangle',dur:0.12,gain:0.32}); }
  dash(){ this._tone({freq:120,freq2:480,type:'sawtooth',dur:0.35,gain:0.6}); this._tone({freq:60,freq2:120,type:'square',dur:0.4,gain:0.3}); }
  shield(){ this._tone({freq:300,freq2:600,type:'triangle',dur:0.4,gain:0.4}); }
  hit(){ this._tone({freq:180,freq2:40,type:'square',dur:0.32,gain:0.6}); this._noise(0.2,0.4); }
  stomp(){ this._tone({freq:500,freq2:200,type:'square',dur:0.22,gain:0.5}); this._tone({freq:1000,type:'sine',dur:0.12,gain:0.3}); }
  portal(){ this._tone({freq:400,freq2:900,type:'sine',dur:0.5,gain:0.5}); setTimeout(()=>this._tone({freq:700,freq2:1400,type:'triangle',dur:0.4,gain:0.35}),120); }
  superEnter(){ [0,150,300].forEach(d=>setTimeout(()=>this._tone({freq:600+d,freq2:900+d,type:'square',dur:0.25,gain:0.45}),d)); }
  die(){ this._tone({freq:400,freq2:80,type:'sawtooth',dur:0.6,gain:0.5}); }
  revive(){ this._tone({freq:500,freq2:800,type:'sine',dur:0.5,gain:0.5}); }
  _noise(dur,gain){
    if(!this.enabled||this.muted||!this.ctx) return;
    const len=this.ctx.sampleRate*dur; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate); const d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const g=this.ctx.createGain(); g.gain.value=gain; g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);
    const f=this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=800;
    src.connect(f).connect(g).connect(this.sfxGain); src.start();
  }
  startBGM(){
    if(!this.enabled||this.muted||!this.ctx) return;
    this.stopBGM();
    const ctx=this.ctx;
    let step=0;
    const notes=[261.6,293.6,329.6,392,329.6,293.6,261.6,329.6, 392,440,493.8,523.2,493.8,440,392,329.6];
    const play=()=>{
      if(!this.enabled||this.muted) return;
      const freq=notes[step%notes.length];
      const o=ctx.createOscillator(); const g=ctx.createGain(); const f=ctx.createBiquadFilter();
      o.type= step%4===0?'square':'triangle'; o.frequency.value=freq*0.5;
      f.type='lowpass'; f.frequency.value=1200;
      g.gain.value=0; g.gain.linearRampToValueAtTime(0.08, ctx.currentTime+0.04);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime+0.28);
      o.connect(f).connect(g).connect(this.bgmGain);
      o.start(); o.stop(ctx.currentTime+0.32);
      // kick
      if(step%4===0){
        const k=ctx.createOscillator(); const kg=ctx.createGain();
        k.type='sine'; k.frequency.setValueAtTime(120,ctx.currentTime); k.frequency.exponentialRampToValueAtTime(40,ctx.currentTime+0.12);
        kg.gain.setValueAtTime(0.18,ctx.currentTime); kg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
        k.connect(kg).connect(this.bgmGain); k.start(); k.stop(ctx.currentTime+0.16);
      }
      step++;
    };
    play(); this.bgmTimer=setInterval(play, 220);
  }
  stopBGM(){ if(this.bgmTimer) clearInterval(this.bgmTimer); this.bgmTimer=null; }
}

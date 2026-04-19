class RetroSounds {
  constructor(){this.ctx=null;this.on=true}
  init(){this.ctx=new(window.AudioContext||window.webkitAudioContext)()}
  resume(){if(this.ctx?.state==='suspended')this.ctx.resume()}
  tone(f,d,t='square',v=0.12,dl=0){
    if(!this.on||!this.ctx)return;const tm=this.ctx.currentTime+dl;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=t;o.frequency.setValueAtTime(f,tm);
    g.gain.setValueAtTime(v,tm);g.gain.exponentialRampToValueAtTime(0.001,tm+d);
    o.connect(g).connect(this.ctx.destination);o.start(tm);o.stop(tm+d);
  }
  msgIn(){this.tone(988,.07);this.tone(1319,.15,'square',.1,.07)}
  msgOut(){this.tone(523,.04);this.tone(659,.04,'square',.08,.04)}
  newScene(){[262,330,392,523,659,784].forEach((f,i)=>this.tone(f,.08,'square',.1,i*.06))}
  start(){[330,392,659,523,587,784].forEach((f,i)=>this.tone(f,.1,'square',.1,i*.1))}
  click(){this.tone(660,.03,'square',.06)}
  doorbell(){this.tone(660,.15);this.tone(523,.2,'square',.1,.15)}
  sad(){this.tone(330,.2);this.tone(294,.2,'square',.08,.2);this.tone(262,.3,'square',.08,.4)}
  happy(){this.tone(523,.08);this.tone(659,.08,'square',.1,.08);this.tone(784,.12,'square',.1,.16)}
  toggle(){this.on=!this.on;return this.on}
}
const sounds = new RetroSounds();

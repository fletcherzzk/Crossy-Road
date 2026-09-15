/* Crossy Road gameplay. Rendering lives in brick-renderer.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  let renderer;
  try { renderer=new BrickRenderer(canvas); }
  catch(error) {
    $('render-error').hidden=false;$('start').disabled=true;
    console.error('Unable to initialize the 3D renderer:',error);return;
  }
  const WORLD = 16, HOP_TIME = .16, FORWARD_LIMIT = 5;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width, height, camera = 0, cameraX = 0;
  let state = 'welcome', lanes = new Map(), player, score = 0, best = 0, oldBest = 0;
  let clock = 0, lastTime = 0, idleTime = 0, deathTime = 0, toastTime = 0;
  let nextRow = -8, queue = null, particles = [], shake = 0;
  let pointer = null;
  try { best = Math.max(0, parseInt(localStorage.getItem('crossy-road-best'), 10) || 0); } catch (_) {}
  $('best').textContent = best;
  const random = (a,b) => a + Math.random() * (b-a);
  const choose = a => a[Math.floor(Math.random()*a.length)];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const mod = (n,m) => ((n % m)+m)%m;
  function notify(message) {
    $('toast').textContent = message; $('toast').classList.add('show'); toastTime=2.7;
  }
  let timerTenth=-1, timerWarning=false;
  function updateTimer() {
    const remaining=Math.max(0,FORWARD_LIMIT-idleTime);
    const tenth=Math.ceil(remaining*10-1e-8);
    if(tenth!==timerTenth) {
      $('timer-value').textContent=(tenth/10).toFixed(1);
      $('timer-meter').setAttribute('aria-valuenow',(tenth/10).toFixed(1));
      timerTenth=tenth;
    }
    $('timer-fill').style.transform='scaleX('+(remaining/FORWARD_LIMIT)+')';
    $('timer').dataset.urgent=remaining<=2?'true':'false';
    $('timer-note').textContent=remaining<=2?'HOP FORWARD NOW!':'Forward hops reset the clock';
    if(remaining<=2&&!timerWarning&&state==='playing') {
      timerWarning=true;notify('2 SECONDS LEFT — HOP FORWARD!');
    }
  }
  function makeLane(y) {
    let type = 'grass';
    if (y > 2) {
      const previous = lanes.get(y-1);
      const roll = Math.random();
      type = roll < .49 ? 'road' : roll < .70 ? 'grass' : roll < .91 ? 'water' : 'rail';
      if (y < 7) type = y === 6 ? 'grass' : 'road';
      if (y === 8 || y === 9) type = 'water';
      if (y === 10) type = 'grass';
      if (y === 12) type = 'rail';
      // Banks separate different hazards; short groups always have a safe rest.
      if (previous && previous.type !== 'grass' && previous.type !== type) type='grass';
      if ([1,2,3].every(n => lanes.get(y-n)?.type !== 'grass')) type='grass';
    }
    const direction = Math.random() < .5 ? -1 : 1;
    const difficulty = Math.min(y/100,1.4);
    const lane = { y,type,direction,speed:0,items:[],trees:[],flowers:[], phase:random(0,9),period:random(9,13) };
    if (type === 'road') {
      lane.speed = direction * random(1.4,2.4+difficulty);
      const spacing=random(5.2,7.5), offset=random(0,spacing);
      for(let x=-WORLD;x<WORLD;x+=spacing) {
        const truck = Math.random() < .22;
        lane.items.push({ x:x+offset, length:truck?2.5:1.75, truck, color:choose(['#f5bd18','#cf3428','#f5f2e7','#177eae','#8564a8']) });
      }
    }
    if (type === 'water') {
      lane.speed = direction * random(.8,1.4);
      for(let x=-WORLD;x<WORLD;x+=5.2) lane.items.push({x:x+random(-.4,.4),length:3.45});
    }
    if (type === 'grass') {
      // A continuous central corridor keeps every generated bank traversable.
      for(let x=-WORLD;x<=WORLD;x++) {
        if (Math.abs(x)>2 && Math.random()<.23) lane.trees.push({x,size:random(.85,1.3),pine:Math.random()<.3});
        else if(Math.random()<.25) lane.flowers.push({x:x+random(-.3,.3),color:choose(['#e7e89b','#ecf0c9','#78b75d'])});
      }
    }
    lanes.set(y,lane);
  }
  function generate() {
    while(nextRow < Math.max(20,Math.floor(camera)+22)) makeLane(nextRow++);
    for(const y of lanes.keys()) if(y < camera-13) lanes.delete(y);
  }
  function reset() {
    lanes = new Map(); nextRow=-8; camera=0; cameraX=0; score=0; clock=0; idleTime=0;
    player={x:0,y:0,z:0,hop:null,facing:'up',dead:false};
    particles=[]; queue=null; shake=0; deathTime=0; timerWarning=false; timerTenth=-1;
    oldBest=best; generate(); $('score').textContent='0'; $('biome').textContent='A FRESH START';
  }
  function start() {
    reset(); draw(); state='playing'; lastTime=performance.now();
    $('timer').hidden=false;updateTimer();
    $('welcome').hidden=true; $('overlay').hidden=true; $('scoreboard').hidden=false;
    $('pause').hidden=false; $('pause').textContent='Ⅱ'; $('pause').setAttribute('aria-label','Pause game');
    $('touch-controls').hidden=false; $('wash').classList.add('off');
    canvas.focus({preventScroll:true});
    notify('FORWARD HOPS RESET YOUR 5-SECOND TIMER.');
  }
  function pause() {
    if(state==='playing') {
      state='paused'; queue=null;
      $('overlay-title').textContent='TAKE A BREATHER';
      $('result-kicker').textContent='THE ROAD CAN WAIT';
      $('reason').textContent='Your chicken is right where you left it.';
      $('result-stats').hidden=true; $('restart').innerHTML='KEEP HOPPING <span aria-hidden="true">↗</span>';
      $('restart-hint').textContent='or press P / Escape';
      $('overlay').hidden=false; $('pause').textContent='▶'; $('pause').setAttribute('aria-label','Resume game');
      $('restart').focus({preventScroll:true});
    } else if(state==='paused') {
      state='playing'; $('overlay').hidden=true; $('pause').textContent='Ⅱ';
      $('pause').setAttribute('aria-label','Pause game'); canvas.focus({preventScroll:true});
    }
  }
  function die(kind) {
    if(state!=='playing') return;
    state='dying'; player.dead=true; player.hop=null; queue=null; deathTime=0;
    shake = reducedMotion ? 0 : .22;
    const messages = {
      car:['ROADKILL!',"Those cars don't stop for chickens."],
      water:['OH, CLUCK.','Chickens are great hoppers. Swimmers? Not so much.'],
      train:['WRONG TRACK.','Next time, wait for the train to pass.'],
      edge:['OUT OF BOUNDS!','Stay on the path, little wanderer.'],
      idle:["TIME'S UP!",'Five seconds without a forward hop. Keep heading up the road!']
    };
    const [title,reason]=messages[kind];
    $('overlay-title').textContent=title; $('reason').textContent=reason;
    $('result-kicker').textContent=score>oldBest?'A NEW PERSONAL BEST!':'EVERY HOP IS A LITTLE BRAVER';
    $('final-score').textContent=score; $('final-best').textContent=best;
    $('result-stats').hidden=false;
    $('restart').innerHTML='ONE MORE HOP <span aria-hidden="true">↗</span>';
    $('restart-hint').textContent='or press Enter / Space';
    updateTimer();
    if(kind==='water') player.z=-.4;
    for(let i=0;i<16;i++) particles.push({x:player.x,y:player.y,z:.3,vx:random(-2,2),vy:random(-2,2),vz:random(2,5),life:random(.3,.8),color:kind==='water'?'#c1eef0':'#fff9d9'});

  }
  function hop(dx,dy) {
    if(state!=='playing') return;
    if(player.hop) { queue={dx,dy}; return; }
    const tx=Math.round(player.x)+dx, ty=player.y+dy;
    if(Math.abs(tx)>10) { return; }
    const lane=lanes.get(ty);
    if(!lane || lane.trees.some(tree=>Math.abs(tree.x-tx)<.7)) { return; }
    player.facing='up';
    player.hop={sx:player.x,sy:player.y,tx,ty,t:0};
  }
  function trainPosition(lane) {
    const phase=mod(clock+lane.phase,lane.period);
    return {warning:phase>lane.period-2.2,active:phase<1.55,x:lane.direction*(-25+phase*34)};
  }
  function update(dt,elapsed=dt) {
    if(state==='paused'||state==='over') return;
    clock+=dt;
    if(toastTime>0) { toastTime-=dt; if(toastTime<=0) $('toast').classList.remove('show'); }
    for(const lane of lanes.values()) for(const item of lane.items) item.x=mod(item.x+lane.speed*dt+WORLD,WORLD*2)-WORLD;
    if(state==='playing') {
      idleTime+=elapsed;
      updateTimer();
      if(idleTime>=FORWARD_LIMIT) { die('idle'); return; }
      if(player.hop) {
        const h=player.hop; h.t+=dt;
        const t=clamp(h.t/HOP_TIME,0,1);
        player.x=h.sx+(h.tx-h.sx)*t; player.y=h.sy+(h.ty-h.sy)*t;
        player.z=Math.sin(t*Math.PI)*.55;
        if(t>=1) {
          player.x=h.tx; player.y=h.ty; player.z=0; player.hop=null;
          if(h.ty>h.sy) { idleTime=0; timerWarning=false; updateTimer(); }
          const previous=score; score=Math.max(score,player.y);
          if(score!==previous) {
            $('score').textContent=score;
            if(score>best) {
              best=score; $('best').textContent=best;
              try { localStorage.setItem('crossy-road-best',String(best)); } catch (_) {}
            }
            if(score%10===0) { notify(score+' HOPS. LOOK AT YOU GO!'); }
            $('biome').textContent=score<10?'FIND YOUR FEET':score<25?'JUST ONE MORE HOP':score<50?'A CHICKEN ON A MISSION':'UNSTOPPABLE. ALMOST.';
          }
        }
      }
      const lane=lanes.get(Math.round(player.y));
      if(lane?.type==='road' && lane.items.some(item=>Math.abs(item.x-player.x)<item.length/2+.23) && Math.abs(player.y-lane.y)<.68) die('car');
      if(lane?.type==='rail') {
        const train=trainPosition(lane);
        if(train.active && Math.abs(train.x-player.x)<6.1 && Math.abs(player.y-lane.y)<.65) die('train');
      }
      if(state==='playing' && !player.hop && lane?.type==='water') {
        const log=lane.items.find(item=>Math.abs(item.x-player.x)<item.length/2-.12);
        if(!log) die('water');
        else { player.x+=lane.speed*dt; if(Math.abs(player.x)>10.5) die('edge'); }
      }
      if(state==='playing' && !player.hop && queue) { const move=queue; queue=null; hop(move.dx,move.dy); }
      if(player.y<camera-7) die('edge');
    }
    if(state==='dying') {
      deathTime+=dt;
      if(deathTime>.7) { state='over'; $('overlay').hidden=false; $('pause').hidden=true; $('touch-controls').hidden=true; $('restart').focus({preventScroll:true}); }
    }
    const target=state==='welcome'?1:Math.max(camera,player.y-.3);
    camera+=(target-camera)*Math.min(1,dt*6);
    cameraX+=(player.x-cameraX)*Math.min(1,dt*6);
    shake=Math.max(0,shake-dt);
    for(const p of particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vz-=12*dt; p.life-=dt; }
    particles=particles.filter(p=>p.life>0);
    generate();
  }
  function draw() {
    renderer.draw({lanes,player,camera,cameraX,state,clock,particles,trainPosition});
  }
  function resize() {
    width=window.innerWidth;height=window.innerHeight;
    renderer.resize(width,height);draw();
  }
  const moves={ArrowUp:[0,1],w:[0,1],ArrowDown:[0,-1],s:[0,-1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
  document.addEventListener('keydown',event=>{
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(moves[key]) {
      event.preventDefault();
      if(state==='welcome') start();
      hop(...moves[key]);
    } else if(key==='p'||key==='Escape') { event.preventDefault(); pause(); }
    else if(key==='Enter'||key===' ') {
      // Preserve native activation of focused buttons.
      if(document.activeElement?.tagName==='BUTTON') return;
      event.preventDefault();
      if(state==='welcome'||state==='over') start();
      else if(state==='paused') pause();
      else if(state==='playing') hop(0,1);
    }
  });
  canvas.addEventListener('pointerdown',event=>{
    pointer={x:event.clientX,y:event.clientY,id:event.pointerId};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup',event=>{
    if(!pointer||event.pointerId!==pointer.id) return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;
    if(state==='welcome') { start(); return; }
    if(Math.hypot(dx,dy)<18) hop(0,1);
    else if(Math.abs(dx)>Math.abs(dy)) hop(Math.sign(dx),0);
    else hop(0,-Math.sign(dy));
  });
  canvas.addEventListener('pointercancel',()=>{pointer=null;});
  document.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();
      const direction={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]}[button.dataset.move];
      hop(...direction);
    });
  });
  $('start').addEventListener('click',start);
  $('restart').addEventListener('click',()=>state==='paused'?pause():start());
  $('pause').addEventListener('click',pause);
  window.addEventListener('resize',resize);
  window.addEventListener('blur',()=>{if(state==='playing') pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing') pause();});
  reset();resize();
  function frame(time) {
    const elapsed=Math.max(0,(time-lastTime)/1000||0);
    lastTime=time;
    // Catch up movement in small steps; a slow frame must not slow the countdown.
    let remaining=Math.min(elapsed,.25);
    if(elapsed>remaining)update(0,elapsed-remaining);
    while(remaining>1e-8) {
      const dt=Math.min(remaining,1/60);update(dt,dt);remaining-=dt;
    }
    if(state!=='paused'&&state!=='over')draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

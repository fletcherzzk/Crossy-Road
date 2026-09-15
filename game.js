/* Crossy Road: zero-dependency Canvas 2D isometric renderer and game. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const WORLD = 16, HOP_TIME = .16;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = { grass:'#a7ce79', grass2:'#b2d585', road:'#5a6571', water:'#66bfc9', rail:'#9fada0' };
  let width, height, scale, originX, originY, camera = 0, cameraX = 0;
  let state = 'welcome', lanes = new Map(), player, score = 0, best = 0, oldBest = 0;
  let clock = 0, lastTime = 0, idleTime = 0, deathTime = 0, toastTime = 0;
  let nextRow = -8, queue = null, particles = [], shake = 0, soundOn = false, audio;
  let objects = [], lastRailWarning = -1, pointer = null;
  try { best = Math.max(0, parseInt(localStorage.getItem('crossy-road-best'), 10) || 0); } catch (_) {}
  $('best').textContent = best;
  const random = (a,b) => a + Math.random() * (b-a);
  const choose = a => a[Math.floor(Math.random()*a.length)];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const mod = (n,m) => ((n % m)+m)%m;
  function tone(freq, duration=.07, type='square', volume=.025, end=freq/2) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq,audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),audio.currentTime+duration);
      gain.gain.setValueAtTime(volume,audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(); osc.stop(audio.currentTime+duration);
    } catch (_) { /* Audio is optional. */ }
  }
  function notify(message) {
    $('toast').textContent = message; $('toast').classList.add('show'); toastTime=2.7;
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
        lane.items.push({ x:x+offset, length:truck?2.6:1.65, truck, color:choose(['#f0c44f','#ed7867','#dcece8','#75b6cc','#987dbe']) });
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
    particles=[]; queue=null; shake=0; deathTime=0; lastRailWarning=-1;
    oldBest=best; generate(); $('score').textContent='0'; $('biome').textContent='A FRESH START';
  }
  function start() {
    reset(); state='playing';
    $('welcome').hidden=true; $('overlay').hidden=true; $('scoreboard').hidden=false;
    $('pause').hidden=false; $('pause').textContent='Ⅱ'; $('pause').setAttribute('aria-label','Pause game');
    $('touch-controls').hidden=false; $('wash').classList.add('off');
    canvas.focus({preventScroll:true}); tone(440,.1,'sine',.04,880);
    notify('HOP TO IT! WATCH THE TRAFFIC.');
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
      idle:['KEEP IT MOVING!','Adventure waits for no chicken.']
    };
    const [title,reason]=messages[kind];
    $('overlay-title').textContent=title; $('reason').textContent=reason;
    $('result-kicker').textContent=score>oldBest?'A NEW PERSONAL BEST!':'EVERY HOP IS A LITTLE BRAVER';
    $('final-score').textContent=score; $('final-best').textContent=best;
    $('result-stats').hidden=false;
    $('restart').innerHTML='ONE MORE HOP <span aria-hidden="true">↗</span>';
    $('restart-hint').textContent='or press Enter / Space';
    if(kind==='water') player.z=-.4;
    for(let i=0;i<16;i++) particles.push({x:player.x,y:player.y,z:.3,vx:random(-2,2),vy:random(-2,2),vz:random(2,5),life:random(.3,.8),color:kind==='water'?'#c1eef0':'#fff9d9'});
    tone(kind==='water'?160:100,.25,'sawtooth',.04,25);
  }
  function hop(dx,dy) {
    if(state!=='playing') return;
    if(player.hop) { queue={dx,dy}; return; }
    const tx=Math.round(player.x)+dx, ty=player.y+dy;
    if(Math.abs(tx)>10) { tone(100,.04); return; }
    const lane=lanes.get(ty);
    if(!lane || lane.trees.some(tree=>Math.abs(tree.x-tx)<.7)) { tone(110,.04); return; }
    player.facing=dy>0?'up':dy<0?'down':dx>0?'right':'left';
    player.hop={sx:player.x,sy:player.y,tx,ty,t:0};
    idleTime=0; tone(random(520,620),.055,'sine',.035,320);
  }
  function trainPosition(lane) {
    const phase=mod(clock+lane.phase,lane.period);
    return {warning:phase>lane.period-2.2,active:phase<1.55,x:lane.direction*(-25+phase*34)};
  }
  function update(dt) {
    if(state==='paused'||state==='over') return;
    clock+=dt;
    if(toastTime>0) { toastTime-=dt; if(toastTime<=0) $('toast').classList.remove('show'); }
    for(const lane of lanes.values()) for(const item of lane.items) item.x=mod(item.x+lane.speed*dt+WORLD,WORLD*2)-WORLD;
    if(state==='playing') {
      idleTime+=dt;
      if(idleTime>12) { die('idle'); return; }
      if(idleTime>8 && toastTime<=0) notify('DON\'T ROOST HERE — KEEP HOPPING!');
      if(player.hop) {
        const h=player.hop; h.t+=dt;
        const t=clamp(h.t/HOP_TIME,0,1);
        player.x=h.sx+(h.tx-h.sx)*t; player.y=h.sy+(h.ty-h.sy)*t;
        player.z=Math.sin(t*Math.PI)*.55;
        if(t>=1) {
          player.x=h.tx; player.y=h.ty; player.z=0; player.hop=null;
          const previous=score; score=Math.max(score,player.y);
          if(score!==previous) {
            $('score').textContent=score;
            if(score>best) {
              best=score; $('best').textContent=best;
              try { localStorage.setItem('crossy-road-best',String(best)); } catch (_) {}
            }
            if(score%10===0) { notify(score+' HOPS. LOOK AT YOU GO!'); tone(880,.15,'sine',.04,1320); }
            $('biome').textContent=score<10?'FIND YOUR FEET':score<25?'JUST ONE MORE HOP':score<50?'A CHICKEN ON A MISSION':'UNSTOPPABLE. ALMOST.';
          }
        }
      }
      const lane=lanes.get(Math.round(player.y));
      if(lane?.type==='road' && lane.items.some(item=>Math.abs(item.x-player.x)<item.length/2+.23) && Math.abs(player.y-lane.y)<.68) die('car');
      if(lane?.type==='rail') {
        const train=trainPosition(lane);
        if(train.active && Math.abs(train.x-player.x)<6.1 && Math.abs(player.y-lane.y)<.65) die('train');
        if(train.warning && lastRailWarning!==lane.y) { lastRailWarning=lane.y; tone(680,.18,'square',.025,620); }
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
    cameraX+=(player.x*.38-cameraX)*Math.min(1,dt*3);
    shake=Math.max(0,shake-dt);
    for(const p of particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vz-=12*dt; p.life-=dt; }
    particles=particles.filter(p=>p.life>0);
    generate();
  }
  function project(x,y,z=0) {
    return {x:originX+((x-cameraX)*.92+(y-camera)*.43)*scale,
      y:originY+((x-cameraX)*.25-(y-camera)*.53-z*.9)*scale};
  }
  function shade(hex,factor) {
    const n=parseInt(hex.slice(1),16);
    return '#'+[n>>16,(n>>8)&255,n&255].map(c=>Math.round(clamp(c*factor,0,255)).toString(16).padStart(2,'0')).join('');
  }
  function polygon(points,color) {
    ctx.fillStyle=color; ctx.beginPath();
    points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.closePath();ctx.fill();
  }
  function plane(x,y,w,d,z,color) {
    polygon([project(x-w/2,y-d/2,z),project(x+w/2,y-d/2,z),project(x+w/2,y+d/2,z),project(x-w/2,y+d/2,z)],color);
  }
  function box(x,y,z,w,d,h,color) {
    const a=project(x-w/2,y-d/2,z),b=project(x+w/2,y-d/2,z),c=project(x+w/2,y+d/2,z);
    const A=project(x-w/2,y-d/2,z+h),B=project(x+w/2,y-d/2,z+h),C=project(x+w/2,y+d/2,z+h),D=project(x-w/2,y+d/2,z+h);
    polygon([a,b,B,A],shade(color,.79));
    polygon([b,c,C,B],shade(color,.63));
    polygon([A,B,C,D],color);
  }
  function shadow(x,y,w,d,opacity=.13) {
    ctx.globalAlpha=opacity; plane(x+.13,y-.15,w,d,.015,'#203a37'); ctx.globalAlpha=1;
  }
  function addObject(x,y,draw,bias=0) { objects.push({depth:x*.25-y*.53+bias,draw}); }
  function drawTree(tree,y) {
    const x=tree.x, s=tree.size;
    shadow(x,y,1.2*s,1.1*s);
    box(x,y,0,.25,.27,.8,'#967754');
    if(tree.pine) {
      box(x,y,.5,1*s,.9*s,.65,'#568a58');
      box(x,y,1.1,.7*s,.65*s,.55,'#649b60');
      box(x,y,1.65,.38*s,.35*s,.4,'#83b56a');
    } else {
      box(x,y,.7,1.02*s,.91*s,1.13*s,'#6a9c59');
      box(x-.12,y+.05,1.75*s,.65*s,.64*s,.25,'#82ae64');
    }
  }
  function drawCar(item,lane) {
    const x=item.x,y=lane.y,dir=lane.direction,w=item.length;
    shadow(x,y,w+.2,.95);
    for(const dx of [-w*.31,w*.31]) {
      box(x+dx,y+.32,.1,.29,.18,.36,'#303b40');
      box(x+dx,y-.37,.1,.29,.18,.36,'#303b40');
      box(x+dx,y-.47,.19,.14,.025,.14,'#89959a');
    }
    box(x,y,.3,w,.78,.42,item.color);
    if(item.truck) {
      box(x-dir*.3,y,.72,w*.65,.77,.9,'#e5e4d4');
      box(x+dir*w*.34,y,.72,.6,.69,.52,item.color);
      box(x+dir*w*.35,y-.351,.86,.36,.015,.27,'#46646c');
    } else {
      box(x-dir*.08,y,.72,.89,.66,.4,shade(item.color,1.08));
      box(x-dir*.07,y-.338,.79,.66,.018,.24,'#405f6a');
      box(x+dir*.385,y,.79,.018,.52,.24,'#70919b');
      box(x-dir*.08,y-.355,.78,.055,.025,.31,item.color);
    }
    box(x+dir*(w/2-.065),y-.26,.43,.14,.17,.16,'#fff0be');
    box(x+dir*(w/2-.065),y+.26,.43,.14,.17,.16,'#fff0be');
    box(x-dir*(w/2-.05),y-.29,.43,.1,.15,.13,'#ce574c');
    box(x,y-.405,.31,w*.92,.04,.08,'#b4bdb5');
  }
  function drawLog(item,lane) {
    const x=item.x,y=lane.y;
    shadow(x,y,item.length+.2,.83,.07);
    box(x,y,.01,item.length,.74,.22,'#ac8357');
    for(let i=-1;i<=1;i++) plane(x+i*.8,y,.025,.68,.235,'#866442');
    box(x+item.length/2+.004,y,.055,.018,.55,.13,'#d4b581');
    plane(x-.3,y-.13,item.length*.68,.035,.236,'#c39b67');
  }
  function drawTrain(lane,t) {
    for(let i=2;i>=0;i--) {
      const x=t.x+(i-1)*3.9;
      shadow(x,lane.y,3.7,.98);
      box(x,lane.y,.17,3.65,.84,.35,'#364a4e');
      box(x,lane.y,.5,3.7,.87,1.04,'#e9b94c');
      box(x,lane.y,1.54,3.78,.91,.16,'#eee3bd');
      for(let j=-1;j<=1;j++) box(x+j*.95,lane.y-.448,.95,.69,.025,.4,'#45646b');
      box(x,lane.y-.454,.64,3.7,.035,.12,'#e77653');
    }
  }
  function drawChicken() {
    const x=player.x,y=player.y,z=player.z;
    if(player.dead && z<0) return;
    shadow(x,y,.7,.66,.18);
    if(player.dead) { box(x,y,.03,.85,.8,.18,'#f5f2dc'); box(x+.38,y,.06,.25,.2,.1,'#eda73d'); return; }
    // Rotate every voxel around the chicken's center to match the hop direction.
    const direction={up:0,right:-Math.PI/2,down:Math.PI,left:Math.PI/2}[player.facing];
    const cubes=[];
    function part(dx,dy,dz,w,d,h,color) {
      const rx=dx*Math.cos(direction)-dy*Math.sin(direction),ry=dx*Math.sin(direction)+dy*Math.cos(direction);
      const sideways=player.facing==='left'||player.facing==='right';
      cubes.push({x:x+rx,y:y+ry,z:z+dz,w:sideways?d:w,d:sideways?w:d,h,color,depth:rx*.25-ry*.53+dz*.02});
    }
    part(-.17,.02,.035,.13,.32,.12,'#eeb44b'); part(.17,.02,.035,.13,.32,.12,'#eeb44b');
    part(0,-.06,.17,.61,.58,.55,'#faf7e7');
    part(0,.15,.62,.48,.45,.39,'#fffcec');
    part(0,.13,1.01,.13,.32,.18,'#e85d4c');
    part(0,.47,.65,.25,.24,.17,'#f3b84a');
    part(0,.39,.49,.12,.12,.2,'#e76b53');
    part(-.25,.26,.82,.035,.09,.095,'#283e40'); part(.25,.26,.82,.035,.09,.095,'#283e40');
    part(-.34,-.13,.3,.13,.33,.28,'#e2e5d8'); part(.34,-.13,.3,.13,.33,.28,'#e2e5d8');
    part(0,-.42,.42,.3,.18,.32,'#f1f0dc');
    cubes.sort((a,b)=>a.depth-b.depth).forEach(p=>box(p.x,p.y,p.z,p.w,p.d,p.h,p.color));
  }
  function draw() {
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    ctx.fillStyle='#b4d48b';ctx.fillRect(0,0,width,height);
    scale=clamp(width/19,37, seventy());
    originX=width*(state==='welcome'?(width<700?.76:.66):.5);
    originY=height*(width<700?.64:.70);
    if(shake>0) { originX+=random(-5,5)*shake*4;originY+=random(-4,4)*shake*4; }
    objects=[];
    const rows=[...lanes.values()].sort((a,b)=>b.y-a.y);
    for(const lane of rows) {
      const y=lane.y;
      plane(0,y,WORLD*2+8,1.012,-.06,lane.type==='grass'?(y%2?colors.grass:colors.grass2):colors[lane.type]);
      if(lane.type==='road') {
        if(lanes.get(y-1)?.type==='grass') plane(0,y-.46,WORLD*2+8,.06,-.048,'#e6e4c1');
        for(let x=-WORLD;x<WORLD;x+=2) plane(x,y+.48,.82,.035,-.045,'#d0d2bf');
      }
      if(lane.type==='water') {
        for(let x=-WORLD;x<WORLD;x+=1.7) {
          const offset=mod(clock*.3+x*.7,1);
          plane(x+offset,y+.2*Math.sin(x+y),.35,.025,-.035,'#92d7d8');
          plane(x-.35+offset,y-.27,.6,.024,-.034,'#78cbd0');
        }
      }
      if(lane.type==='rail') {
        for(let x=-WORLD;x<WORLD;x+=.6) plane(x,y,.15,.85,-.035,'#788578');
        plane(0,y-.26,WORLD*2,.065,-.02,'#dce0d1');
        plane(0,y+.26,WORLD*2,.065,-.02,'#dce0d1');
        const t=trainPosition(lane);
        for(const x of [-7,7]) addObject(x,y,()=>{
          box(x,y,0,.13,.13,1.6,'#e0dcc7');
          box(x,y,1.3,.5,.18,.31,'#425551');
          box(x-.13,y-.1,1.39,.14,.035,.14,t.warning&&Math.sin(clock*12)>0?'#ff6656':'#8b5c50');
          box(x+.13,y-.1,1.39,.14,.035,.14,t.warning&&Math.sin(clock*12)<0?'#ff6656':'#8b5c50');
          box(x,y,1.82,.62,.12,.12,'#f5efd6');
          box(x,y,1.63,.12,.12,.5,'#f5efd6');
        });
        if(t.active) addObject(t.x,y,()=>drawTrain(lane,t));
      }
      for(const flower of lane.flowers) plane(flower.x,y+.22,.12,.12,.002,flower.color);
    }
    for(const lane of rows) {
      for(const tree of lane.trees) addObject(tree.x,lane.y,()=>drawTree(tree,lane.y));
      for(const item of lane.items) addObject(item.x,lane.y,()=>lane.type==='road'?drawCar(item,lane):drawLog(item,lane));
      // Low, blocky roadside details frame the playable corridor.
      if(lane.type==='grass' && lane.y%4===0) for(const x of [-9,9]) addObject(x,lane.y,()=>{
        box(x,lane.y,0,.12,.12,.55,'#f1edce');
        box(x+.75,lane.y,0,.12,.12,.55,'#f1edce');
        box(x+.38,lane.y,.3,.9,.09,.12,'#e7dfbc');
      });
    }
    addObject(player.x,player.y,drawChicken,.035);
    for(const p of particles) addObject(p.x,p.y,()=>box(p.x,p.y,Math.max(.03,p.z),.09,.09,.09,p.color));
    objects.sort((a,b)=>a.depth-b.depth);
    for(const object of objects) object.draw();
    const vignette=ctx.createLinearGradient(0,0,0,height);
    vignette.addColorStop(0,'rgba(234,240,207,.28)');vignette.addColorStop(.24,'rgba(234,240,207,0)');vignette.addColorStop(1,'rgba(48,80,58,.06)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
  }
  function seventy() { return height<550?53:76; }
  function resize() {
    width=window.innerWidth;height=window.innerHeight;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    draw();
  }
  const moves={ArrowUp:[0,1],w:[0,1],ArrowDown:[0,-1],s:[0,-1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
  document.addEventListener('keydown',event=>{
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(moves[key]) {
      event.preventDefault();
      if(state==='welcome') start();
      hop(...moves[key]);
    } else if(key==='p'||key==='Escape') { event.preventDefault(); pause(); }
    else if(key==='m') $('sound').click();
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
  $('sound').addEventListener('click',()=>{
    soundOn=!soundOn;
    $('sound').setAttribute('aria-pressed',String(soundOn));
    $('sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');
    tone(660,.1,'sine',.04,880);
  });
  window.addEventListener('resize',resize);
  window.addEventListener('blur',()=>{if(state==='playing') pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing') pause();});
  reset();resize();
  function frame(time) {
    const dt=Math.min((time-lastTime)/1000||0,.035);
    lastTime=time;update(dt);draw();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

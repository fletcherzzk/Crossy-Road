const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map(),saved={};
function el(id){if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,style:{},dataset:{},attributes:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v},addEventListener(){},focus(){}});return elements.get(id)}
class Renderer {resize(){}draw(){}}
const sandbox={console,Math,Map,parseInt,performance,BrickRenderer:Renderer,document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},activeElement:null},window:{innerWidth:1280,innerHeight:800,addEventListener(){}},localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v},matchMedia:()=>({matches:false}),requestAnimationFrame(){}};
let src=fs.readFileSync('game.js','utf8');
src=src.replace(/\}\)\(\);\s*$/, 'globalThis.test={start,hop,update,pause,reset,generate,resize,trainPosition,get state(){return state},get player(){return player},get lanes(){return lanes},get score(){return score},get best(){return best},get idle(){return idleTime},setClock(v){clock=v},setCamera(v){camera=v}};})();');
vm.runInNewContext(src,sandbox);const g=sandbox.test;let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name)}
function step(seconds){const n=Math.floor(seconds/.01);for(let i=0;i<n;i++)g.update(.01);const tail=seconds-n*.01;if(tail>1e-9)g.update(tail)}
function safe(){g.start();for(let y=-1;y<=2;y++)g.lanes.set(y,{y,type:'grass',trees:[],flowers:[],items:[],speed:0})}
check('timer starts at five seconds',()=>{safe();assert.equal(el('timer-value').textContent,'5.0');assert.equal(el('timer').hidden,false)});
check('alive immediately before five seconds',()=>{step(4.99);assert.equal(g.state,'playing');assert.equal(el('timer-value').textContent,'0.1')});
check('defeated at five seconds',()=>{g.update(.011);assert.equal(g.state,'dying');assert.equal(el('timer-value').textContent,'0.0');assert.equal(el('overlay-title').textContent,"TIME'S UP!")});
check('forward hop resets upon completion',()=>{safe();step(2);g.hop(0,1);assert(g.idle>=1.99);step(.16);assert.equal(g.player.y,1);assert.equal(el('timer-value').textContent,'5.0');assert.equal(g.score,1)});
check('sideways movement cannot reset timer',()=>{safe();step(2);g.hop(1,0);step(.17);assert(g.idle>2.15);assert.equal(g.player.facing,'up')});
check('backward movement cannot reset timer',()=>{safe();step(2);g.hop(0,-1);step(.17);assert(g.idle>2.15)});
check('forward hop revisiting a row resets timer',()=>{g.hop(0,1);step(.16);assert.equal(el('timer-value').textContent,'5.0')});
check('blocked forward input cannot reset timer',()=>{safe();g.lanes.get(1).trees.push({x:0});step(3);g.hop(0,1);assert.equal(g.player.hop,null);assert(g.idle>2.99)});
check('log drift cannot reset timer',()=>{safe();g.lanes.set(0,{y:0,type:'water',trees:[],items:[{x:0,length:3.45}],speed:.1});step(3);assert(g.idle>2.99);assert(g.player.x>0)});
check('pause freezes countdown',()=>{safe();step(1);g.pause();const remaining=g.idle;g.update(.035,20);assert.equal(g.idle,remaining);assert.equal(g.state,'paused');g.pause();g.update(.1);assert(g.idle>remaining)});
check('long frames use elapsed time for deadline',()=>{safe();g.update(.035,4.5);assert.equal(el('timer-value').textContent,'0.5');g.update(.035,.5);assert.equal(g.state,'dying')});
check('last two seconds show urgent warning',()=>{safe();g.update(.035,3);assert.equal(el('timer').dataset.urgent,'true');assert.equal(el('timer-note').textContent,'HOP FORWARD NOW!')});
check('forward hop clears urgent warning',()=>{g.hop(0,1);step(.16);assert.equal(el('timer').dataset.urgent,'false');assert.equal(el('timer-value').textContent,'5.0')});
check('restart clears timer, score, and warning',()=>{safe();assert.equal(g.score,0);assert.equal(g.idle,0);assert.equal(el('timer').dataset.urgent,'false')});
check('cars still cause defeat',()=>{safe();g.lanes.set(0,{y:0,type:'road',trees:[],items:[{x:0,length:1.75}],speed:0});step(.01);assert.equal(g.state,'dying')});
check('water without log causes defeat',()=>{safe();g.lanes.set(0,{y:0,type:'water',trees:[],items:[],speed:0});step(.01);assert.equal(g.state,'dying')});
check('train collisions still work',()=>{safe();g.lanes.set(0,{y:0,type:'rail',trees:[],items:[],phase:25/34-.01,period:10,direction:1});step(.01);assert.equal(g.state,'dying')});
check('best score persists across runs',()=>{safe();assert(g.best>=1);assert(Number(saved['crossy-road-best'])>=1)});
check('world remains bounded',()=>{for(let row=0;row<1000;row+=5){g.setCamera(row);g.generate();assert(g.lanes.size<40)}});
check('all static page assets exist locally',()=>{const html=fs.readFileSync('index.html','utf8');for(const [,file] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert(fs.existsSync(file),file);assert(!/id="sound"|Sound \(M\)/.test(html))});
console.log(count+' gameplay and delivery checks passed.');

/* Original brick models, rendered with the bundled Three.js library. */
(() => {
  'use strict';
  const T = THREE;
  const geometryCache = new Map(), materialCache = new Map(), prefabCache = new Map();
  const P = { green:'#4f9d38',lime:'#74b544',darkGreen:'#267544',brown:'#76452b',tan:'#b4804b',
    white:'#f5f3e9',red:'#c92d25',yellow:'#f7bd19',black:'#202329',glass:'#365c75',silver:'#bec5cd' };
  const stampCanvas=document.createElement('canvas');
  stampCanvas.width=stampCanvas.height=128;
  const stampPaint=stampCanvas.getContext('2d');
  stampPaint.fillStyle='#808080';stampPaint.fillRect(0,0,128,128);
  stampPaint.fillStyle='#bcbcbc';stampPaint.font='bold 31px Arial';stampPaint.textAlign='center';stampPaint.textBaseline='middle';
  stampPaint.fillText('LEGO',64,64);
  const stamp=new T.CanvasTexture(stampCanvas);
  function material(color,finish='plastic') {
    const key=color+finish;
    if(!materialCache.has(key)) materialCache.set(key,new T.MeshStandardMaterial({
      color,roughness:finish==='rubber'?.85:finish==='glass'?.12:.28,metalness:finish==='metal'?.45:0,
      ...(finish==='stud'?{bumpMap:stamp,bumpScale:.006}:{}),
      ...(finish==='signal'?{emissive:color,emissiveIntensity:1.4}:{})
    }));
    return materialCache.get(key);
  }
  function geometry(key,make) {
    if(!geometryCache.has(key)) {
      const raw=make(),flat=raw.index?raw.toNonIndexed():raw;
      if(raw!==flat) raw.dispose();
      geometryCache.set(key,flat);
    }
    return geometryCache.get(key);
  }
  function part(parts,g,color,x,y,z,rotation=null,finish='plastic') {
    const q=new T.Quaternion();
    if(rotation) q.setFromEuler(new T.Euler(...rotation));
    parts.push({g,mat:material(color,finish),matrix:new T.Matrix4().compose(new T.Vector3(x,z,-y),q,new T.Vector3(1,1,1))});
  }
  // The bevel is small relative to the brick: hard plastic edges, not pill shapes.
  function box(parts,x,y,z,w,d,h,color,finish='plastic') {
    const g=geometry('box:'+w+':'+d+':'+h,()=>{
      const e=Math.min(.014,w*.06,d*.06,h*.12);
      const shape=new T.Shape();
      shape.moveTo(-w/2+e,-d/2+e);shape.lineTo(w/2-e,-d/2+e);
      shape.lineTo(w/2-e,d/2-e);shape.lineTo(-w/2+e,d/2-e);shape.closePath();
      const result=new T.ExtrudeGeometry(shape,{depth:h-2*e,bevelEnabled:true,bevelThickness:e,bevelSize:e,bevelSegments:2,steps:1,curveSegments:1});
      result.translate(0,0,e);result.rotateX(-Math.PI/2);
      return result;
    });
    part(parts,g,color,x,y,z,null,finish);
  }
  function stud(parts,x,y,z,r,color) {
    const h=r*.48;
    part(parts,geometry('stud:'+r,()=>new T.CylinderGeometry(r,r,h,16,1,true)),color,x,y,z+h/2);
    part(parts,geometry('cap:'+r,()=>new T.CircleGeometry(r,16)),color,x,y,z+h,[-Math.PI/2,0,0],'stud');
  }
  function brick(parts,x,y,z,nx,ny,plates,color,pitch=.25) {
    const w=nx*pitch-.012,d=ny*pitch-.012,h=plates*.1-.008;
    box(parts,x,y,z,w,d,h,color);
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++)
      stud(parts,x+(i-(nx-1)/2)*pitch,y+(j-(ny-1)/2)*pitch,z+h,pitch*.30,color);
  }
  function slope(parts,x,y,z,w,d,h,color,reverse=false) {
    const g=geometry('slope:'+w+':'+d+':'+h+':'+reverse,()=>{
      const lo=reverse?h:.025,hi=reverse?.025:h;
      const verts=[[-w/2,0,d/2],[w/2,0,d/2],[w/2,lo,d/2],[-w/2,lo,d/2],
        [-w/2,0,-d/2],[w/2,0,-d/2],[w/2,hi,-d/2],[-w/2,hi,-d/2]];
      const ids=[0,1,2,0,2,3,5,4,7,5,7,6,4,0,3,4,3,7,1,5,6,1,6,2,3,2,6,3,6,7,4,5,1,4,1,0];
      const result=new T.BufferGeometry();
      result.setAttribute('position',new T.Float32BufferAttribute(ids.flatMap(i=>verts[i]),3));
      result.computeVertexNormals();return result;
    });
    part(parts,g,color,x,y,z);
  }
  // Merge static pieces by material: many visible bricks, only a few draw calls.
  function build(parts) {
    const buckets=new Map(),root=new T.Group();
    for(const p of parts) {if(!buckets.has(p.mat))buckets.set(p.mat,[]);buckets.get(p.mat).push(p);}
    for(const [mat,list] of buckets) {
      const count=list.reduce((n,p)=>n+p.g.attributes.position.count,0);
      const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
      let offset=0;
      for(const p of list) {
        const pos=p.g.attributes.position,normal=p.g.attributes.normal,uv=p.g.attributes.uv,m=p.matrix.elements;
        for(let i=0;i<pos.count;i++) {
          const a=offset*3,b=offset*2,x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
          positions[a]=m[0]*x+m[4]*y+m[8]*z+m[12];positions[a+1]=m[1]*x+m[5]*y+m[9]*z+m[13];positions[a+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
          const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
          normals[a]=m[0]*nx+m[4]*ny+m[8]*nz;normals[a+1]=m[1]*nx+m[5]*ny+m[9]*nz;normals[a+2]=m[2]*nx+m[6]*ny+m[10]*nz;
          if(uv){uvs[b]=uv.getX(i);uvs[b+1]=uv.getY(i);}
          offset++;
        }
      }
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uvs,2));g.computeBoundingSphere();
      const mesh=new T.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    }
    return root;
  }
  function prefab(key,make) {
    if(!prefabCache.has(key)){const parts=[];make(parts);prefabCache.set(key,build(parts));}
    return prefabCache.get(key).clone();
  }
  function tree(parts,x,y,pine) {
    brick(parts,x,y,0,2,2,1,P.brown);
    for(let i=0;i<3;i++) brick(parts,x,y,.1+i*.3,1,1,3,i%2?P.tan:P.brown);
    if(pine) {
      for(let layer=0;layer<4;layer++) {
        const n=5-layer;
        brick(parts,x,y,.65+layer*.3,n,n,3,layer%2?P.green:P.darkGreen);
      }
    } else {
      brick(parts,x,y,.75,4,3,3,P.darkGreen);
      brick(parts,x-.25,y,1.05,2,4,3,P.green);
      brick(parts,x+.25,y,1.05,2,4,3,P.lime);
      brick(parts,x,y,1.35,3,3,3,P.green);
      brick(parts,x-.125,y+.125,1.65,2,2,1,P.lime);
    }
  }
  function wheel(parts,x,y,z) {
    part(parts,geometry('tire',()=>new T.TorusGeometry(.153,.067,8,20)),P.black,x,y,z,null,'rubber');
    part(parts,geometry('hub',()=>new T.CylinderGeometry(.105,.105,.10,16)),P.silver,x,y,z,[Math.PI/2,0,0],'metal');
    for(let i=0;i<5;i++) {
      const a=i*Math.PI*2/5;
      part(parts,geometry('hub-hole',()=>new T.CylinderGeometry(.017,.017,.008,8)),P.black,x+Math.cos(a)*.065,y-.058,z+Math.sin(a)*.065,[Math.PI/2,0,0]);
    }
  }
  function car(parts,item) {
    const c=item.color,w=item.length;
    box(parts,0,0,.18,w-.12,.6,.13,P.black);
    brick(parts,0,0,.31,item.truck?10:7,3,2,c);
    for(const side of [-1,1]) for(const ax of [-w*.31,w*.31]) wheel(parts,ax,side*.40,.23);
    if(item.truck) {
      for(let row=0;row<3;row++) {
        brick(parts,-.375,-.125,.52+row*.3,6,2,3,row%2?P.white:'#ddd9c9');
        brick(parts,-.375,.25,.52+row*.3,6,1,3,P.white);
      }
      brick(parts,-.375,0,1.42,6,3,1,P.white);
      box(parts,.88,0,.53,.65,.69,.48,c);
      box(parts,.91,-.358,.72,.4,.022,.24,P.glass,'glass');
      brick(parts,.875,0,1.02,3,3,1,c);
    } else {
      box(parts,-.06,0,.53,.83,.63,.35,P.glass,'glass');
      // Separate pillars and a sloped, transparent-looking windshield.
      slope(parts,.46,0,.53,.28,.63,.32,P.glass);
      brick(parts,-.125,0,.89,4,3,1,c);
      for(const side of [-1,1]) {
        box(parts,-.12,side*.326,.55,.045,.025,.34,c);
        box(parts,-.32,side*.344,.56,.11,.024,.032,P.silver);
      }
      brick(parts,.625,0,.52,2,3,1,c);
      brick(parts,-.69,0,.52,1,3,1,c);
    }
    for(const side of [-1,1]) {
      box(parts,w/2-.045,side*.235,.38,.08,.15,.13,'#fff1a1');
      box(parts,-w/2+.04,side*.235,.38,.07,.13,.12,P.red);
    }
    box(parts,w/2-.025,0,.23,.08,.74,.1,P.silver,'metal');
    box(parts,-w/2+.025,0,.23,.08,.74,.1,P.silver,'metal');
    box(parts,0,-.387,.33,w-.14,.025,.045,P.silver);
  }
  function chicken(parts) {
    for(const side of [-1,1]) {
      brick(parts,side*.20,.075,.02,1,2,1,P.yellow,.15);
      box(parts,side*.20,-.01,.12,.10,.13,.16,'#e69916');
    }
    brick(parts,0,0,.25,3,3,3,'#e9e8df');
    brick(parts,0,0,.55,3,3,2,P.white);
    brick(parts,0,.16,.77,2,2,3,P.white);
    for(let i=0;i<3;i++) brick(parts,0,.02+i*.14,1.09,1,1,i===1?2:1,P.red,.13);
    box(parts,0,.48,.81,.22,.21,.13,P.yellow);
    box(parts,0,.41,.69,.1,.10,.16,P.red);
    for(const side of [-1,1]) {
      slope(parts,side*.405,-.03,.39,.16,.48,.30,'#dfdfd6',true);
      box(parts,side*.256,.31,.94,.014,.095,.085,P.black);
      slope(parts,side*.15,-.43,.50,.14,.25,side===0?.36:.23,P.white,true);
    }
    slope(parts,0,-.45,.51,.16,.29,.39,P.white,true);
  }
  class BrickRenderer {
    constructor(canvas) {
      this.webgl=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      this.webgl.outputColorSpace=T.SRGBColorSpace;
      this.webgl.toneMapping=T.ACESFilmicToneMapping;this.webgl.toneMappingExposure=1.12;
      this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=T.PCFSoftShadowMap;
      this.scene=new T.Scene();this.scene.background=new T.Color('#dce6cc');
      this.camera=new T.OrthographicCamera(-8,8,6,-6,.1,100);
      this.scene.add(new T.HemisphereLight('#f5f7ff','#738554',2.3));
      this.sun=new T.DirectionalLight('#fff0d2',3.3);this.sun.castShadow=true;
      this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-14;this.sun.shadow.camera.right=14;
      this.sun.shadow.camera.top=17;this.sun.shadow.camera.bottom=-15;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=60;
      this.sun.shadow.normalBias=.018;this.sun.shadow.bias=-.00015;this.sun.shadow.radius=3;
      this.scene.add(this.sun,this.sun.target);
      const fill=new T.DirectionalLight('#d8eaff',.8);fill.position.set(8,9,-12);this.scene.add(fill);
      this.rows=new Map();this.lastLanes=null;
      this.chicken=prefab('chicken',chicken);this.scene.add(this.chicken);
      this.particleGeometry=new T.BoxGeometry(.095,.095,.095);
      this.particleMesh=new T.InstancedMesh(this.particleGeometry,material(P.white),24);this.particleMesh.count=0;this.scene.add(this.particleMesh);
      this.width=1;this.height=1;
    }
    clearRows() {for(const row of this.rows.values())this.removeRow(row);this.rows.clear();}
    removeRow(row) {
      this.scene.remove(row.root);
      // Dynamic prefabs share geometry; only dispose this lane's merged scenery.
      row.static.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    }
    createRow(lane) {
      const root=new T.Group(),parts=[],moving=[];
      const grass=lane.type==='grass',water=lane.type==='water';
      const ground=grass?(lane.y%2?P.green:P.lime):water?'#168cbd':lane.type==='road'?'#535e69':'#99a090';
      for(let x=-16;x<16;x++) {
        if(grass) brick(parts,x+.5,0,-.135,2,2,1,ground,.5);
        else {
          box(parts,x+.5,0,-.13,.988,.988,.10,ground);
          if(water) {
            box(parts,x+.21,.22,-.025,.33,.08,.012,'#5ac4de','glass');
            if(x%2===0)stud(parts,x+.72,-.18,-.025,.105,'#2399c5');
          }
        }
        if(lane.type==='road'&&x%2===0)box(parts,x+.5,.47,-.018,.57,.035,.01,'#eee7c7');
        if(lane.type==='rail')box(parts,x+.5,0,-.015,.16,.86,.065,P.brown);
      }
      if(lane.type==='rail')for(const y of [-.25,.25])box(parts,0,y,.04,32,.055,.07,P.silver,'metal');
      for(const t of lane.trees)tree(parts,t.x,0,t.pine);
      for(const f of lane.flowers)if(Math.abs(f.x)<11) {
        stud(parts,f.x,.20,0,.065,'#f4d449');
        box(parts,f.x,.20,.03,.07,.07,.09,'#f3f1d5');
      }
      if(grass&&lane.y%4===0)for(const x of [-9,9]) {
        brick(parts,x,0,0,1,1,4,P.white);
        brick(parts,x+.75,0,0,1,1,4,P.white);
        box(parts,x+.375,0,.25,.75,.1,.12,P.white);
      }
      const scenery=build(parts);root.add(scenery);root.position.z=-lane.y;
      for(const item of lane.items) {
        const key=water?'log':('car:'+item.color+':'+item.truck);
        const node=prefab(key,p=>{
          if(water)for(let i=0;i<7;i++)brick(p,(i-3)*.49,0,.015,2,3,2,i%2?P.brown:P.tan);
          else car(p,item);
        });
        if(!water&&lane.direction<0)node.rotation.y=Math.PI;
        root.add(node);moving.push({node,item});
      }
      const signals=[];
      let train=null;
      if(lane.type==='rail') {
        train=prefab('train',p=>{
          for(let wagon=-1;wagon<=1;wagon++) {
            const x=wagon*3.9;
            box(p,x,0,.2,3.75,.77,.3,P.black);
            brick(p,x,0,.5,15,3,3,P.yellow);
            box(p,x,0,.81,3.72,.77,.55,P.yellow);
            brick(p,x,0,1.38,15,3,1,P.white);
            for(const side of [-1,1]) {
              for(let i=-1;i<=1;i++)box(p,x+i*.93,side*.398,.92,.66,.025,.31,P.glass,'glass');
              box(p,x,side*.402,.61,3.65,.03,.13,P.red);
              wheel(p,x-1.25,side*.40,.26);wheel(p,x+1.25,side*.40,.26);
            }
          }
        });
        root.add(train);
        for(const x of [-7,7]) {
          const sign=prefab('signal',p=>{
            brick(p,0,0,0,2,2,1,P.white);
            box(p,0,0,.1,.12,.12,1.25,P.silver);
            box(p,0,0,1.25,.53,.17,.28,P.black);
            box(p,0,0,1.64,.55,.12,.1,P.white);
            box(p,0,0,1.5,.1,.12,.38,P.white);
          });sign.position.x=x;root.add(sign);
          for(const side of [-1,1]) {
            const light=new T.Mesh(new T.SphereGeometry(.065,10,8),material('#6b2721'));
            light.position.set(x+side*.135,1.39,.105);root.add(light);signals.push(light);
          }
        }
      }
      this.scene.add(root);
      return {root,static:scenery,moving,train,signals};
    }
    resize(width,height) {
      this.width=width;this.height=height;
      this.webgl.setPixelRatio(Math.min(window.devicePixelRatio||1,2));this.webgl.setSize(width,height,false);
      const pixels=width<700?48:Math.min(88,Math.max(58,width/16));
      this.halfWidth=width/pixels/2;this.halfHeight=height/pixels/2;
      this.camera.left=-this.halfWidth;this.camera.right=this.halfWidth;
      this.camera.top=this.halfHeight;this.camera.bottom=-this.halfHeight;this.camera.updateProjectionMatrix();
    }
    draw({lanes,player,camera,cameraX,state,clock,particles,trainPosition}) {
      if(this.lastLanes!==lanes){this.clearRows();this.lastLanes=lanes;}
      for(const [y,row] of this.rows)if(!lanes.has(y)){this.removeRow(row);this.rows.delete(y);}
      for(const lane of lanes.values()) {
        if(!this.rows.has(lane.y))this.rows.set(lane.y,this.createRow(lane));
        const row=this.rows.get(lane.y);
        for(const {node,item} of row.moving) {
          node.position.x=item.x;
          node.visible=Math.abs(item.x-cameraX)<this.halfWidth+3;
        }
        if(row.train) {
          const t=trainPosition(lane);row.train.visible=t.active;row.train.position.x=t.x;
          row.signals.forEach((s,i)=>s.material=material(t.warning&&Math.sin(clock*12+i*Math.PI)>0?'#ff3c24':'#6b2721',t.warning?'signal':'plastic'));
        }
      }
      const x=state==='welcome'?-this.halfWidth*.42:cameraX,forward=camera+3.5;
      this.camera.position.set(x,15,-camera+17);this.camera.lookAt(x,0,-forward);
      this.sun.position.set(x-7,15,-camera+6);this.sun.target.position.set(x,0,-camera-3);
      this.chicken.position.set(player.x,Math.max(-.65,player.z),-player.y);
      this.chicken.scale.set(1,player.dead?.22:1,1);
      this.chicken.visible=!(player.dead&&player.z<0);
      this.particleMesh.count=Math.min(particles.length,24);
      const m=new T.Matrix4();
      particles.slice(0,24).forEach((p,i)=>{m.makeTranslation(p.x,p.z,-p.y);this.particleMesh.setMatrixAt(i,m);});
      this.particleMesh.instanceMatrix.needsUpdate=true;
      this.webgl.render(this.scene,this.camera);
    }
  }
  window.BrickRenderer=BrickRenderer;
})();

import {YardSimulation, CAR_LENGTHS, CAR_NAMES, PHASE_LABELS} from './simulation.js';

const $ = id => document.getElementById(id);
const sim = new YardSimulation();
const keys = new Set();
let muted = true, audioContext, sceneView, lastPhase = 0, lastMoving = false;
let toastTimeout, destinationPath = [], lastUI = 0, hasStarted = false;
let modeAfterReset = 'mission';

function icon(id,name){$(id).querySelector('use')?.setAttribute('href',`#i-${name}`);}
function formatTime(seconds){const m=Math.floor(seconds/60);return `${String(m).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function notify(message,type='info'){
  const toast=$('toast');
  toast.querySelector('span').textContent=message;
  toast.querySelector('use').setAttribute('href',type==='warning'?'#i-shield':type==='success'?'#i-check':'#i-radio');
  toast.className=`toast visible${type==='warning'?' warning':''}`;
  clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>toast.classList.remove('visible'),4200);
}
function beep(kind){
  if(muted)return;
  try{
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const frequencies=kind==='success'?[523,659,784]:kind==='warning'?[220,160]:kind==='couple'?[180,95]:[640,510];
    frequencies.forEach((frequency,i)=>{
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();
      osc.type=kind==='couple'?'triangle':'sine';osc.frequency.value=frequency;
      const t=audioContext.currentTime+i*.095;
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.075,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+.16);
      osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.18);
    });
  }catch{}
}
function drainEvents(){
  const events=sim.events.splice(0);
  for(const event of events){notify(event.message,event.type);if(['success','couple','uncouple','warning'].includes(event.type))beep(event.type);}
}
function act(action){hasStarted=true;sim.interact(action);drainEvents();updateUI();}
function radio(dir){hasStarted=true;sim.setDirection(dir);if(!sim.paused&&sim.direction===dir)beep('radio');drainEvents();updateUI();}

function synchronizePause(){
  sim.paused=!!document.querySelector('dialog[open]');
  keys.clear();
  icon('pause-btn',sim.paused?'play':'pause');
  $('pause-btn').setAttribute('aria-label',sim.paused?'이어서 작업':'일시정지');
  updateUI();
}
function openDialog(id){sim.paused=true;keys.clear();$(id).showModal();synchronizePause();}
function closeDialog(id){$(id).close();synchronizePause();}
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('close',synchronizePause);
  dialog.addEventListener('click',e=>{if(e.target===dialog&&dialog.id==='help-dialog'){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog.id);}});
});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.close)));
$('help-btn').addEventListener('click',()=>openDialog('help-dialog'));
$('pause-btn').addEventListener('click',()=>{if($('pause-dialog').open)closeDialog('pause-dialog');else openDialog('pause-dialog');});
$('resume-btn').addEventListener('click',()=>closeDialog('pause-dialog'));
$('reset-btn').addEventListener('click',()=>{modeAfterReset=sim.mode;openDialog('reset-dialog');});
$('confirm-reset').addEventListener('click',()=>reset(modeAfterReset));
$('replay-btn').addEventListener('click',()=>reset('mission'));
$('continue-free').addEventListener('click',()=>{
  closeDialog('success-dialog');sim.mode='free';sim.phase=0;lastPhase=0;sim.paused=false;destinationPath=[];updateMode();notify('자유 연습입니다. 모든 연결기를 자유롭게 연결·분리해보세요.');
});
for(const mode of ['mission','free'])$(mode+'-mode').addEventListener('click',()=>{
  if(sim.mode===mode)return;
  if(hasStarted){modeAfterReset=mode;openDialog('reset-dialog');}else reset(mode);
});
$('sound-btn').addEventListener('click',()=>{muted=!muted;icon('sound-btn',muted?'mute':'sound');$('sound-btn').setAttribute('aria-label',muted?'효과음 켜기':'효과음 끄기');$('sound-btn').title=muted?'효과음 켜기':'효과음 끄기';beep('radio');});
$('connect-btn').addEventListener('click',()=>act('connect'));
$('uncouple-btn').addEventListener('click',()=>act('uncouple'));
$('push-btn').addEventListener('click',()=>radio(1));
$('pull-btn').addEventListener('click',()=>radio(-1));
$('stop-btn').addEventListener('click',()=>{sim.stop();beep('radio');notify('정지 무전 · 차량이 멈췄습니다.');updateUI();});

function reset(mode='mission'){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  sim.reset(mode);lastPhase=0;lastMoving=false;hasStarted=false;keys.clear();destinationPath=[];sceneView?.resetCamera();
  icon('pause-btn','pause');updateMode();updateUI();notify(mode==='mission'?'새 작업을 시작합니다. ‘밀기’로 기관차를 접근시키세요.':'자유 연습입니다. 연결·분리와 입환 무전을 자유롭게 사용하세요.');
}
function updateMode(){
  const free=sim.mode==='free';
  for(const mode of ['mission','free']){const active=sim.mode===mode;$(mode+'-mode').classList.toggle('active',active);$(mode+'-mode').setAttribute('aria-pressed',String(active));}
  $('mission-title').innerHTML=free?'나만의 편성으로,<br>자유롭게 연습하세요.':'세 량을 연결하고,<br>한 량을 남겨보세요.';
  $('mission-subtitle').innerHTML=free?'원하는 연결기 옆으로 이동해<br>화차를 연결하거나 분리하세요.':'기관차와 화차를 연결한 뒤<br>B201 화차를 지정 구역에 유치하세요.';
  document.querySelector('.mission-no').textContent=free?'FREE PLAY':'MISSION 01';
  document.querySelector('.difficulty').textContent=free?'자유 연습':'기초 입환';
  document.querySelector('.progress-heading>span').textContent=free?'편성 연결 상태':'작업 진행률';
  document.querySelector('.mission-steps').style.opacity=free?'.45':'';
  updateUI();
}
function updateUI(){
  const free=sim.mode==='free', connected=sim.links.filter(Boolean).length;
  $('timer').textContent=formatTime(sim.elapsed);$('score').textContent=String(sim.score).padStart(4,'0');
  $('progress-text').textContent=free?`${connected} / 3`:`${Math.min(sim.phase,4)} / 4`;
  $('progress-fill').style.width=(free?connected/3*100:sim.phase*25)+'%';
  document.querySelector('.progress-track').setAttribute('aria-valuenow',String(free?connected:sim.phase));
  document.querySelector('.progress-track').setAttribute('aria-valuemax',free?'3':'4');
  document.querySelectorAll('[data-step]').forEach((li,i)=>{
    li.classList.toggle('active',!free&&sim.phase===i);li.classList.toggle('done',!free&&sim.phase>i);
    li.querySelector('use').setAttribute('href',!free&&sim.phase>i?'#i-check':['#i-link','#i-move','#i-unlink','#i-flag'][i]);
  });
  let instruction='';
  if(free)instruction='연결기 옆에서 E로 연결, R로 분리하세요. J/L로 이동하고 Space로 정지합니다.';
  else if(sim.phase===0)instruction=sim.gap(0)>.12?'‘밀기’로 기관차를 화차에 접근시킨 뒤, 파란 표식 옆에서 연결하세요.':'연결기가 맞닿았습니다. 파란 표식 옆에서 E를 눌러 세 량을 연결하세요.';
  else if(sim.phase===1)instruction=`‘밀기’로 편성을 오른쪽 유치 구역까지 이동하세요. ${Math.max(0,2-sim.cars[1]).toFixed(1)}m 남음 · 도착 시 자동 정지`;
  else if(sim.phase===2)instruction='주황 표식으로 이동하세요. A102 · B201 사이에서 R을 누르면 마지막 화차가 분리됩니다.';
  else if(sim.phase===3)instruction=`‘당기기’로 기관차와 A101 · A102를 왼쪽으로 이동하세요. ${Math.max(0,4-(sim.extractionStart-sim.cars[0])).toFixed(1)}m 남음`;
  else instruction='수고하셨습니다! B201 화차를 유치하고 나머지 편성을 인출했습니다.';
  $('instruction').textContent=instruction;
  $('stage-caption').textContent=free?'자유 연습 · 원하는 편성을 만들어보세요':`${PHASE_LABELS[sim.phase]} · 기관차 + 화차 ${sim.component().length-1}량`;
  const moving=sim.moving()&&!sim.paused;
  $('motion-status').textContent=sim.paused?'일시정지':moving?sim.direction>0?'오른쪽 이동':'왼쪽 이동':'차량 정지';
  $('motion-dot').classList.toggle('moving',moving);
  $('speed').textContent=moving?(sim.speed*3.6).toFixed(1):'0.0';
  $('push-btn').classList.toggle('active',moving&&sim.direction===1);$('pull-btn').classList.toggle('active',moving&&sim.direction===-1);
  for(let i=0;i<3;i++){$('link-'+i).classList.toggle('joined',sim.links[i]);$('link-'+i).textContent=sim.links[i]?'—':'···';}
  const nearest=sim.nearestCoupler(),can=sim.canReach(nearest)&&!sim.moving()&&!sim.paused;
  $('connect-btn').classList.toggle('unavailable',!can||sim.links[nearest]);
  $('uncouple-btn').classList.toggle('unavailable',!can||!sim.links[nearest]);
  if(sim.phase!==lastPhase){
    lastPhase=sim.phase;
    if(sim.phase===4&&!free){sim.stop();destinationPath=[];$('final-score').textContent=sim.score.toLocaleString();$('final-time').textContent=formatTime(sim.elapsed);openDialog('success-dialog');}
  }
}

const movementCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
document.addEventListener('keydown',e=>{
  if(e.code==='KeyP'&&!e.repeat){e.preventDefault();if($('pause-dialog').open)closeDialog('pause-dialog');else if(!document.querySelector('dialog[open]'))openDialog('pause-dialog');return;}
  if(document.querySelector('dialog[open]'))return;
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if([...movementCodes,'Space','KeyE','KeyR','KeyJ','KeyK','KeyL','KeyC'].includes(e.code))e.preventDefault();
  if(movementCodes.includes(e.code)){keys.add(e.code);destinationPath=[];hasStarted=true;}
  if(e.repeat)return;
  if(e.code==='KeyE')act('connect');if(e.code==='KeyR')act('uncouple');
  if(e.code==='KeyJ')radio(-1);if(e.code==='KeyL')radio(1);
  if(e.code==='Space'||e.code==='KeyK'){sim.stop();updateUI();}
  if(e.code==='KeyC')sceneView?.toggleView();
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(!document.querySelector('dialog[open]')&&hasStarted)openDialog('pause-dialog');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();sim.stop();if(hasStarted&&!document.querySelector('dialog[open]'))openDialog('pause-dialog');}});
const touchCodes={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD'};
document.querySelectorAll('[data-move]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(sim.paused)return;button.setPointerCapture(e.pointerId);keys.add(touchCodes[button.dataset.move]);destinationPath=[];hasStarted=true;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(touchCodes[button.dataset.move]));
});

// A bounded navigation grid keeps click-to-walk routes outside vehicle bodies.
function walkTo(x,z){
  if(sim.paused)return;
  hasStarted=true;
  x=Math.max(-38,Math.min(38,x));z=Math.max(-3.2,Math.min(9.8,z));
  if(sim.blocked(x,z,.35))z=sim.player.z>=0?3.2:-3.2;
  const grid=.65,minX=-39,minZ=-3.9;
  const node=(x,z)=>({x:Math.round((x-minX)/grid),z:Math.round((z-minZ)/grid)});
  const world=n=>({x:minX+n.x*grid,z:minZ+n.z*grid});
  const key=n=>n.x+','+n.z;
  const start=node(sim.player.x,sim.player.z),end=node(x,z),endKey=key(end);
  const open=[{...start,g:0,f:0}],seen=new Set(),parents=new Map(),cost=new Map([[key(start),0]]);
  let found=null;
  for(let steps=0;open.length&&steps<4200;steps++){
    open.sort((a,b)=>a.f-b.f);const current=open.shift(),currentKey=key(current);
    if(seen.has(currentKey))continue;seen.add(currentKey);
    if(currentKey===endKey){found=current;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const next={x:current.x+dx,z:current.z+dz},nextKey=key(next),pos=world(next);
      if(seen.has(nextKey)||sim.blocked(pos.x,pos.z,.36))continue;
      if(dx&&dz){const p1=world({x:current.x+dx,z:current.z}),p2=world({x:current.x,z:current.z+dz});if(sim.blocked(p1.x,p1.z,.36)||sim.blocked(p2.x,p2.z,.36))continue;}
      const g=current.g+Math.hypot(dx,dz);
      if(g>=(cost.get(nextKey)??Infinity))continue;
      cost.set(nextKey,g);parents.set(nextKey,current);open.push({...next,g,f:g+Math.hypot(next.x-end.x,next.z-end.z)});
    }
  }
  if(!found){notify('이동할 수 있는 선로 옆 바닥을 선택하세요.');return;}
  const route=[];let current=found;
  while(key(current)!==key(start)){route.unshift(world(current));current=parents.get(key(current));}
  route.push({x,z});destinationPath=route;sceneView?.setDestination(x,z);
}

async function boot(){
  const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js');
  const viewport=$('viewport'),stage=$('stage');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
  viewport.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();sim.paused=true;$('loading').classList.remove('hidden');$('loading').innerHTML='<b>3D 화면 연결이 잠시 끊겼습니다.</b><p>페이지를 새로고침하면 다시 시작할 수 있습니다.</p><button class="modal-primary" style="width:auto" id="reload-game">다시 열기</button>';$('reload-game').onclick=()=>location.reload();});
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d8e5e7');scene.fog=new THREE.Fog('#d8e5e7',95,190);
  const camera=new THREE.OrthographicCamera(-30,30,20,-20,.1,300);
  const target=new THREE.Vector3(-.5,0,1.5);let desiredTarget=target.clone();
  let yaw=.53,pitch=.72,zoom=1,view=viewport.clientWidth<560?'follow':'overview',width=1,height=1;
  let drag=null,frameTime=0,walkCycle=0;
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  scene.add(new THREE.HemisphereLight('#eefbff','#a79d79',2.1));
  const sun=new THREE.DirectionalLight('#fff4dc',3.2);sun.position.set(-26,45,27);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-52,right:52,top:40,bottom:-40,near:1,far:120});sun.shadow.bias=-.00012;sun.shadow.normalBias=.035;scene.add(sun);
  const fillLight=new THREE.DirectionalLight('#dceeff',.4);fillLight.position.set(24,18,-32);scene.add(fillLight);
  const materials=new Map(),boxGeometry=new THREE.BoxGeometry(1,1,1),cylinderCache=new Map();
  function material(color,options={}){const key=color+JSON.stringify(options);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.82,...options}));return materials.get(key);}
  function box(parent,x,y,z,w,h,d,color,options={}){const m=new THREE.Mesh(boxGeometry,material(color,options));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function cylinder(parent,x,y,z,rt,rb,h,color,segments=12,options={}){const key=[rt,rb,h,segments].join(',');if(!cylinderCache.has(key))cylinderCache.set(key,new THREE.CylinderGeometry(rt,rb,h,segments));const m=new THREE.Mesh(cylinderCache.get(key),material(color,options));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function textPlane(parent,text,x,y,z,w,h,color='#ffffff',background=null,rotation=0,font='bold 70px Arial'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,512,128);}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=font;ctx.fillText(text,256,68,490);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
  }
  // The yard is a fully modelled, real-time scene; tracks use metre-based proportions.
  box(scene,0,-.45,0,250,.7,200,'#92b3a3');
  box(scene,0,-.04,-1,87,.16,39,'#c3c4b3');
  box(scene,0,.01,9,88,.13,4.7,'#ced1c3');
  box(scene,0,.045,11.2,87,.08,.14,'#eff0df');
  box(scene,0,.04,6.7,87,.08,.14,'#eff0df');
  for(let x=-41;x<43;x+=4){box(scene,x,.09,9,1.6,.02,.075,'#efeee0');box(scene,x,.11,3.95,1.8,.02,.11,'#e8dec0');}
  const sleeperGeometry=new THREE.BoxGeometry(.24,.17,2.85),sleepers=new THREE.InstancedMesh(sleeperGeometry,material('#646b62'),348);
  const dummy=new THREE.Object3D();let sleeperN=0;
  for(const z of [0,-7.7,-15.4]){
    box(scene,0,.02,z,86,.28,3.85,'#9b9e92');
    box(scene,0,.14,z,84,.16,2.95,'#969b94');
    for(let x=-42;x<=42;x+=.74){dummy.position.set(x,.21,z);dummy.updateMatrix();sleepers.setMatrixAt(sleeperN++,dummy.matrix);}
    for(const rz of [z-.7175,z+.7175]){
      box(scene,0,.265,rz,85,.055,.17,'#656f6f',{metalness:.6,roughness:.4});
      box(scene,0,.325,rz,85,.105,.055,'#697676',{metalness:.65,roughness:.35});
      box(scene,0,.4,rz,85,.045,.1,'#aab8b6',{metalness:.8,roughness:.23});
    }
    box(scene,42.4,.72,z,.45,1.1,2.4,'#394b4a');
    for(const rz of [-.8,.8])box(scene,42.25,1.1,z+rz,.12,.23,.47,'#d67852');
  }
  sleepers.count=sleeperN;sleepers.castShadow=false;sleepers.receiveShadow=true;scene.add(sleepers);
  // Instanced fasteners and ballast add detail without hundreds of draw calls.
  const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.13,0),material('#afb1a6'),750);
  let seed=7351;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  for(let i=0;i<750;i++){const z=[0,-7.7,-15.4][i%3];dummy.position.set((rand()-.5)*84,.22,z+(rand()>.5?1:-1)*(1.25+rand()*.68));dummy.rotation.set(rand(),rand(),rand());dummy.scale.setScalar(.6+rand()*.7);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);}stones.receiveShadow=true;scene.add(stones);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);
  // Painted destination rectangle, corresponding exactly to the final wagon position.
  const destination=new THREE.Group();destination.position.x=18;
  box(destination,0,.25,0,8.3,.025,3.75,'#efcf66',{transparent:true,opacity:.28,depthWrite:false});
  for(const z of [-1.9,1.9])box(destination,0,.28,z,8.3,.03,.09,'#e8bb3e');
  for(const x of [-4.15,4.15])box(destination,x,.28,0,.09,.03,3.85,'#e8bb3e');
  scene.add(destination);
  // Freight terminal and storage buildings beyond the working tracks.
  function warehouse(x,z,w,d){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);box(g,0,3.2,0,w,6.4,d,'#d6dfd7');box(g,0,.55,0,w+.2,1.1,d+.2,'#a2aaa3');box(g,0,6.48,0,w+.6,.24,d+.6,'#527778');
    for(let n=-w/2+1;n<w/2;n+=2){box(g,n,3.4,d/2+.035,.065,5.7,.055,'#becbc3');}
    for(let n=-w/2+2.3;n<w/2-1;n+=5.3){box(g,n,2.1,d/2+.075,3.6,3.4,.12,'#657d7d');for(let j=0;j<7;j++)box(g,n,.65+j*.45,d/2+.145,3.55,.045,.025,'#8a9e98');box(g,n,4.75,d/2+.095,3.5,.8,.07,'#a7c7ca',{metalness:.2,roughness:.3});}
    textPlane(g,'KORAIL  LOGISTICS',0,5.65,d/2+.16,w*.5,.65,'#346175');return g;}
  warehouse(-13,-26,29,9);warehouse(24,-26,24,10);
  function container(x,y,z,color,len=7.1,parent=scene){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);box(g,0,1.35,0,len,2.7,2.4,color);
    const ribColor=new THREE.Color(color).multiplyScalar(.87).getHex();for(let i=-len/2+.18;i<len/2;i+=.32){box(g,i,1.35,1.215,.07,2.47,.045,ribColor);box(g,i,1.35,-1.215,.07,2.47,.045,ribColor);}
    box(g,0,2.735,0,len+.06,.08,2.46,color);for(const xx of [-len/2,len/2])for(const zz of [-1.22,1.22])box(g,xx,1.35,zz,.09,2.7,.09,ribColor);
    return g;
  }
  for(const [x,z,c] of [[-31,-23,'#637d86'],[-31,-26,'#97735f'],[-38,-23,'#ab775a'],[-38,-26,'#798e71'],[35,-23,'#a08a61'],[35,-26,'#668789']]){container(x,0,z,c,6);if(x===-31||x===35)container(x,2.85,z,c,6);}
  // Service cabin, fence, poles, trees and distant low-poly hills.
  const cabin=new THREE.Group();cabin.position.set(-31,0,14.2);scene.add(cabin);box(cabin,0,1.65,0,5.2,3.3,3.6,'#e4e7da');box(cabin,0,3.45,0,5.6,.3,4,'#526f78');box(cabin,-.9,2.1,1.84,2.6,1.2,.06,'#7697a0',{metalness:.15});box(cabin,1.5,1.28,1.84,1.15,2.5,.09,'#627b7e');textPlane(cabin,'입환 작업장',0,3,1.88,3.3,.45,'#436775',null,0,'bold 54px sans-serif');
  for(let x=-43;x<=43;x+=3){cylinder(scene,x,1.05,18.5,.035,.035,2.1,'#5d7470',6);}
  for(const y of [.6,1.45,2.08])box(scene,0,y,18.5,86,.025,.035,'#769087');
  function lightPole(x,z){cylinder(scene,x,5.9,z,.11,.15,11.8,'#778981',8);box(scene,x,11.8,z,2.7,.13,.16,'#6e817d');for(const dx of [-.9,.9]){const light=box(scene,x+dx,11.68,z+.12,.63,.25,.45,'#dddcd0');light.rotation.x=.22;box(scene,x+dx,11.55,z+.15,.49,.03,.35,'#fff3cd',{emissive:'#e9dca1',emissiveIntensity:.3});}}
  lightPole(-25,-4.6);lightPole(26,-4.6);lightPole(4,-19.5);
  const treeGeo=new THREE.IcosahedronGeometry(1,0);
  function tree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);cylinder(g,0,1,0,.13,.2,2,'#7f8063',7);for(const [xx,yy,zz,r]of [[0,3.3,0,1.75],[-.55,2.5,.3,1.2],[.65,2.75,.1,1.1]]){const foliage=new THREE.Mesh(treeGeo,material(['#578d78','#679b81','#7da48b'][Math.floor(rand()*3)]));foliage.position.set(xx,yy,zz);foliage.scale.set(r,r*1.2,r);foliage.castShadow=true;g.add(foliage);}}
  for(let i=0;i<37;i++){const x=(rand()-.5)*128,z=i<20?-36-rand()*18:23+rand()*24;tree(x,z,.65+rand()*.65);}
  for(let i=0;i<7;i++){const hill=new THREE.Mesh(new THREE.ConeGeometry(17+rand()*15,13+rand()*15,5),material(i%2?'#88a89e':'#9db7a9'));hill.position.set(-85+i*28,5,-78-rand()*10);hill.rotation.y=rand()*3;scene.add(hill);}
  // Two static wagons identify the secondary storage track.
  const stored1=container(-1,.92,-15.4,'#7c9381',10);const stored2=container(10.8,.92,-15.4,'#b7a68b',10);
  for(const cx of [-1,10.8]){box(scene,cx,.9,-15.4,10.6,.25,2.5,'#5a6965');for(const dx of [-3.7,3.7])for(const zz of [-.8,.8]){const w=cylinder(scene,cx+dx,.63,-15.4+zz,.3,.3,.16,'#4b5754',12);w.rotation.x=Math.PI/2;}}
  // Coupler geometry, buffers, bogies, wheel flanges and chassis are shared by all vehicles.
  const carGroups=[],wheelGroups=[],couplerParts=[];
  const steel='#40515a',wheelMaterial=material('#394746',{metalness:.5,roughness:.58});
  function chassis(g,length){
    box(g,0,1.05,0,length,.3,2.38,steel);box(g,0,.85,0,length-.2,.16,.7,'#34434c');
    const wheels=[];
    for(const bogieX of [-(length/2-1.35),length/2-1.35]){
      box(g,bogieX,.75,0,1.72,.3,1.6,'#46555b');
      for(const wx of [bogieX-.53,bogieX+.53]){
        const axle=cylinder(g,wx,.75,0,.075,.075,1.65,'#53625e',8);axle.rotation.x=Math.PI/2;
        for(const wz of [-.8,.8]){
          const wg=new THREE.Group();wg.position.set(wx,.75,wz);g.add(wg);
          const tire=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.2,16),wheelMaterial);tire.rotation.x=Math.PI/2;wg.add(tire);tire.castShadow=true;
          const flange=cylinder(wg,0,0,wz<0?.09:-.09,.4,.4,.04,'#60706c',16,{metalness:.6,roughness:.4});flange.rotation.x=Math.PI/2;
          const hub=cylinder(wg,0,0,wz>0?.115:-.115,.16,.16,.03,'#9ba69c',12,{metalness:.4});hub.rotation.x=Math.PI/2;wheels.push(wg);
        }
      }
      for(const zz of [-1,1]){box(g,bogieX,.76,zz,1.6,.2,.12,'#51605c');for(const dx of [-.25,0,.25])box(g,bogieX+dx,.8,zz,.08,.2,.17,'#7c887d');}
    }
    for(const end of [-1,1]){box(g,end*(length/2+.12),.99,0,.38,.13,.15,'#6f7d75');box(g,end*(length/2+.41),.99,0,.25,.2,.29,'#6b7568');box(g,end*(length/2+.49),1.01,.09*end,.12,.16,.16,'#9a9f87');
      const lever=box(g,end*(length/2-.02),1.15,.94,.065,.065,.5,'#d9b456');lever.rotation.x=.2;
      // Small side steps and handrails.
      for(const z of [-1.1,1.1]){box(g,end*(length/2-.25),.82,z,.58,.06,.32,'#738780');box(g,end*(length/2-.23),.57,z,.5,.05,.3,'#738780');}
    }
    return wheels;
  }
  const engine=new THREE.Group();scene.add(engine);carGroups.push(engine);wheelGroups.push(chassis(engine,8));
  box(engine,.15,1.85,0,7.55,1.25,2.2,'#266194');box(engine,.45,2.66,0,6.4,.42,2.15,'#eceee3');box(engine,1.18,2.31,0,4.3,.5,2.22,'#f2efe3');
  box(engine,1.22,2.02,1.121,4.2,.11,.025,'#e49d49');box(engine,1.22,2.02,-1.121,4.2,.11,.025,'#e49d49');
  // Cab and nose on the left, aligned with the extraction direction.
  box(engine,-2.23,2.76,0,1.78,1.5,2.36,'#f0eee2');box(engine,-2.23,3.55,0,1.98,.14,2.52,'#426a85');
  for(const z of [-1.191,1.191]){box(engine,-2.23,3.05,z,1.39,.57,.032,'#496b7b',{metalness:.3,roughness:.27});box(engine,-2.26,3.04,z,.04,.62,.045,'#dddcd0');}
  box(engine,-3.14,3.05,0,.035,.64,1.83,'#496b7b',{metalness:.3,roughness:.27});box(engine,-3.18,3.05,0,.03,.65,.07,'#dddcd0');
  box(engine,-3.4,2.1,0,.89,.67,2.22,'#eeeeDF');box(engine,-3.86,1.58,0,.12,.39,2.15,'#df8741');
  for(const z of [-.83,.83]){box(engine,-3.928,2.33,z,.025,.19,.24,'#fff4ce',{emissive:'#efd4a1',emissiveIntensity:.2});}
  for(let x=-.65;x<3.3;x+=.19){box(engine,x,1.89,1.125,.065,.69,.045,'#244d72');box(engine,x,1.89,-1.125,.065,.69,.045,'#244d72');}
  for(const xx of [-.15,1.6]){cylinder(engine,xx,2.93,0,.49,.49,.08,'#657b7d',16);cylinder(engine,xx,2.985,0,.35,.35,.035,'#3e535b',12);}
  box(engine,.6,3.1,-.42,.2,.43,.24,'#4e656a');
  textPlane(engine,'KORAIL',1.1,2.44,1.151,2.2,.37,'#23578c',null,0,'italic bold 68px Arial');
  textPlane(engine,'KORAIL',1.1,2.44,-1.151,2.2,.37,'#23578c',null,Math.PI,'italic bold 68px Arial');
  textPlane(engine,'7501',-2.25,2.35,1.196,.95,.32,'#306383');
  for(const z of [-1.19,1.19]){for(let x=-3.6;x<=3.7;x+=1.1){box(engine,x,1.93,z,.032,1.3,.035,'#e3e2cf');}box(engine,.05,2.59,z,7.45,.035,.035,'#e2e1cf');}
  const wagonColors=['#528b99','#b56c54','#cea760'];
  for(let i=1;i<4;i++){
    const g=new THREE.Group();scene.add(g);carGroups.push(g);wheelGroups.push(chassis(g,7));
    const freight=container(0,1.22,0,wagonColors[i-1],6.46,g);
    for(const z of [-1.248,1.248]){
      textPlane(g,CAR_NAMES[i],-1.55,2.38,z,1.35,.46,'#f1efda',null,z<0?Math.PI:0);
      textPlane(g,'KORAIL',1.15,3.25,z,1.28,.29,'#f3eee0',null,z<0?Math.PI:0,'italic bold 67px Arial');
    }
    for(const x of [-3.245,3.245]){for(const z of [-.72,.72])box(g,x,2.5,z,.035,2.35,.045,'#d6c9a9');box(g,x,2.47,0,.04,2.3,.055,'#617272');}
  }
  // A visible link between vehicles changes with the actual coupling state.
  for(let i=0;i<3;i++){const g=new THREE.Group();scene.add(g);box(g,0,.99,0,.5,.15,.17,'#d8b774',{metalness:.55});couplerParts.push(g);}
  // The shunter: articulated limbs, safety helmet, reflective vest and handheld radio.
  const worker=new THREE.Group();scene.add(worker);const body=new THREE.Group();body.position.y=.96;worker.add(body);
  box(body,0,.31,0,.48,.59,.28,'#263e60');box(body,0,.35,.015,.5,.51,.31,'#ec813d');
  for(const x of [-.15,.15])box(body,x,.35,.18,.065,.53,.025,'#f7e8a0');
  box(body,0,.2,.182,.49,.085,.022,'#f2e8b4');box(body,0,.2,-.173,.49,.085,.022,'#f2e8b4');
  const head=cylinder(body,0,.91,0,.177,.16,.31,'#d3a58b',10);head.rotation.y=.2;
  cylinder(body,0,1.094,0,.19,.215,.12,'#f2f3e9',12);cylinder(body,0,1.046,.028,.254,.254,.045,'#e8ebdf',12);
  box(body,.02,.88,.163,.1,.05,.055,'#c7977c');box(body,-.074,.93,.166,.026,.026,.012,'#374348');box(body,.074,.93,.166,.026,.026,.012,'#374348');
  const limbs=[];
  for(const s of [-1,1]){
    const leg=new THREE.Group();leg.position.set(s*.14,-.02,0);body.add(leg);box(leg,0,-.4,0,.19,.8,.21,'#304a69');box(leg,0,-.77,.055,.23,.16,.34,'#394849');limbs.push(leg);
    const arm=new THREE.Group();arm.position.set(s*.33,.58,0);body.add(arm);box(arm,0,-.22,0,.18,.47,.2,'#334e71');cylinder(arm,0,-.51,.015,.075,.07,.15,'#e2bb9f',8);limbs.push(arm);
    if(s===1){box(arm,0,-.46,.115,.11,.19,.065,'#344753');box(arm,.025,-.3,.115,.015,.19,.018,'#223841');}
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.59,.66,32),new THREE.MeshBasicMaterial({color:'#477cec',side:THREE.DoubleSide,transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.13;worker.add(ring);
  const targetRing=new THREE.Group();scene.add(targetRing);
  const ringMat=new THREE.MeshBasicMaterial({color:'#477beb',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
  for(const [a,b]of [[.56,.67],[.86,.9]]){const m=new THREE.Mesh(new THREE.RingGeometry(a,b,40),ringMat);m.rotation.x=-Math.PI/2;m.position.y=.15;targetRing.add(m);}
  const markerLight=cylinder(targetRing,0,.18,0,.25,.25,.02,'#4b7cec',24,{transparent:true,opacity:.45});
  const navigationRing=new THREE.Mesh(new THREE.RingGeometry(.24,.31,24),new THREE.MeshBasicMaterial({color:'#edfaff',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));navigationRing.rotation.x=-Math.PI/2;navigationRing.visible=false;scene.add(navigationRing);
  const trackSigns=[];
  for(const [z,no]of [[-3.6,'1'],[-11.2,'2'],[-18.9,'3']]){const g=new THREE.Group();g.position.set(-25,0,z);scene.add(g);box(g,0,.92,0,.075,1.8,.075,'#657d79');box(g,0,1.8,0,.72,.64,.095,no==='1'?'#326daa':'#768e87');textPlane(g,no,0,1.81,.055,.36,.42,'#f5f7e8');trackSigns.push(g);}

  const map=$('minimap-canvas'),ctx=map.getContext('2d');
  function drawMap(){
    ctx.clearRect(0,0,400,154);const mx=x=>(x+40)/80*376+12;
    ctx.fillStyle='#f3f7f3';ctx.fillRect(0,0,400,154);ctx.fillStyle='#f5e9ba';ctx.fillRect(mx(13.8),64,mx(22.2)-mx(13.8),32);
    for(const y of [31,56,80]){ctx.strokeStyle='#b3c2bc';ctx.lineWidth=2;for(const dy of [-3,3]){ctx.beginPath();ctx.moveTo(9,y+dy);ctx.lineTo(392,y+dy);ctx.stroke();}ctx.strokeStyle='#d0d9d2';ctx.lineWidth=2;for(let x=13;x<390;x+=12){ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();}}
    for(let i=0;i<4;i++){ctx.fillStyle=i===0?'#2e5d85':wagonColors[i-1];ctx.fillRect(mx(sim.cars[i]-CAR_LENGTHS[i]/2),72,CAR_LENGTHS[i]/80*376,16);if(i<3&&sim.links[i]){ctx.strokeStyle='#496c6d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(mx(sim.cars[i]+CAR_LENGTHS[i]/2),80);ctx.lineTo(mx(sim.cars[i+1]-CAR_LENGTHS[i+1]/2),80);ctx.stroke();}}
    const px=mx(sim.player.x),py=80+sim.player.z*6;ctx.fillStyle='#245be8';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
  }
  const point=new THREE.Vector3();
  function positionLabel(id,x,y,z,offset=0){
    const element=$(id);point.set(x,y,z).project(camera);const sx=(point.x*.5+.5)*width,sy=(-point.y*.5+.5)*height+offset;
    element.style.transform=`translate(${sx}px,${sy}px) translate(-50%,-100%)`;
    element.style.visibility=point.z>1||sx<0||sx>width||sy<52||sy>height-108?'hidden':'visible';
  }
  function setView(next){view=next;zoom=1;updateViewButtons();resize();}
  function updateViewButtons(){for(const v of ['overview','follow']){const selected=view===v;$(v+'-btn').classList.toggle('selected',selected);$(v+'-btn').setAttribute('aria-pressed',String(selected));}}
  function resize(){width=viewport.clientWidth;height=viewport.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);const span=(view==='follow'?29:63)/zoom,halfW=span/2,halfH=halfW/(width/height);Object.assign(camera,{left:-halfW,right:halfW,top:halfH,bottom:-halfH});camera.updateProjectionMatrix();}
  function resetCamera(){yaw=.53;pitch=.72;zoom=1;view=viewport.clientWidth<560?'follow':'overview';updateViewButtons();resize();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);
  $('overview-btn').addEventListener('click',()=>setView('overview'));$('follow-btn').addEventListener('click',()=>setView('follow'));
  $('zoom-in').addEventListener('click',()=>{zoom=Math.min(2.5,zoom*1.2);resize();});$('zoom-out').addEventListener('click',()=>{zoom=Math.max(.6,zoom/1.2);resize();});
  $('camera-reset').addEventListener('click',resetCamera);
  $('fullscreen-btn').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('이 브라우저에서는 전체 화면을 지원하지 않습니다.');}catch{notify('전체 화면을 열 수 없습니다. 현재 화면에서 계속 플레이할 수 있습니다.');}
  });
  function activeCoupler(){return sim.mode==='free'?sim.nearestCoupler():sim.phase<2?0:2;}
  $('target-marker').addEventListener('click',()=>{const i=activeCoupler();walkTo(sim.couplerX(i),sim.player.z<0?-2.9:2.9);});
  viewport.addEventListener('pointerdown',e=>{if(e.button>0)return;viewport.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};});
  viewport.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;
    if(drag.moved){yaw-=dx*.006;pitch=Math.max(.34,Math.min(1.22,pitch+dy*.004));}
    drag.x=e.clientX;drag.y=e.clientY;
  });
  viewport.addEventListener('pointerup',e=>{
    if(drag&&drag.id===e.pointerId&&!drag.moved&&!sim.paused){const r=viewport.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);if(raycaster.ray.intersectPlane(groundPlane,hit))walkTo(hit.x,hit.z);}
    drag=null;
  });
  viewport.addEventListener('pointercancel',()=>drag=null);
  viewport.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.6,Math.min(2.5,zoom*Math.exp(-e.deltaY*.001)));resize();},{passive:false});
  sceneView={resetCamera,toggleView:()=>setView(view==='overview'?'follow':'overview'),setDestination:(x,z)=>{navigationRing.position.set(x,.17,z);navigationRing.visible=true;}};
  updateViewButtons();resize();updateUI();
  const carPrevious=[...sim.cars];
  function frame(time){
    requestAnimationFrame(frame);const dt=Math.min((time-(frameTime||time))/1000,.04);frameTime=time;
    let walking=false;
    if(!sim.paused){
      const horizontal=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
      const vertical=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
      const speedUp=keys.has('ShiftLeft')||keys.has('ShiftRight')?1.4:1;
      if(horizontal||vertical){const dx=horizontal*Math.cos(yaw)+vertical*Math.sin(yaw),dz=-horizontal*Math.sin(yaw)+vertical*Math.cos(yaw);walking=sim.movePlayer(dx,dz,dt*speedUp);}
      else if(destinationPath.length){const next=destinationPath[0],dx=next.x-sim.player.x,dz=next.z-sim.player.z;if(Math.hypot(dx,dz)<.15){destinationPath.shift();}else{walking=sim.movePlayer(dx,dz,Math.min(dt,Math.hypot(dx,dz)/2.8));if(!walking)destinationPath=[];}}
      if(hasStarted)sim.tick(dt);drainEvents();
    }
    navigationRing.visible=destinationPath.length>0;
    if(walking)walkCycle+=dt*10;
    body.position.y=.96+(walking?Math.abs(Math.sin(walkCycle))*.035:0);
    limbs[0].rotation.x=walking?Math.sin(walkCycle)*.55:limbs[0].rotation.x*.75;
    limbs[2].rotation.x=walking?-Math.sin(walkCycle)*.55:limbs[2].rotation.x*.75;
    limbs[1].rotation.x=walking?-Math.sin(walkCycle)*.4:limbs[1].rotation.x*.75;
    limbs[3].rotation.x=walking?Math.sin(walkCycle)*.4:limbs[3].rotation.x*.75;
    worker.position.set(sim.player.x,.025,sim.player.z);
    let turn=(sim.player.facing-worker.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;worker.rotation.y+=turn*Math.min(1,dt*12);
    for(let i=0;i<4;i++){carGroups[i].position.x=sim.cars[i];const delta=sim.cars[i]-carPrevious[i];for(const w of wheelGroups[i])w.rotation.z-=delta/.35;carPrevious[i]=sim.cars[i];}
    for(let i=0;i<3;i++){couplerParts[i].visible=sim.links[i];couplerParts[i].position.x=sim.couplerX(i);}
    const index=activeCoupler(),cx=sim.couplerX(index),tz=sim.player.z<0?-2.85:2.85;
    const markerVisible=sim.mode==='free'||sim.phase===0||sim.phase===2;
    targetRing.visible=markerVisible;targetRing.position.set(cx,0,tz);const pulse=1+Math.sin(time*.003)*.075;targetRing.scale.set(pulse,1,pulse);
    ringMat.color.set(sim.mode==='mission'&&sim.phase===2?'#e2a048':'#477beb');
    $('target-marker').style.display=markerVisible?'flex':'none';$('target-marker').classList.toggle('near',sim.canReach(index));$('target-marker').classList.toggle('orange',sim.mode==='mission'&&sim.phase===2);
    const separating=sim.mode==='free'?sim.links[index]:sim.phase===2;
    $('target-key').textContent=separating?'R':'E';$('target-text').textContent=separating?'분리 위치':'연결 위치';
    desiredTarget=view==='follow'?new THREE.Vector3(sim.player.x,.3,sim.player.z):new THREE.Vector3(-.5,0,1.5);
    target.lerp(desiredTarget,1-Math.exp(-dt*5));const distance=82;
    camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);camera.updateMatrixWorld();
    positionLabel('loco-label',sim.cars[0]-1,4,0,-7);positionLabel('worker-label',sim.player.x,2.9,sim.player.z,-8);positionLabel('destination-label',18,.7,-2.6,-3);positionLabel('target-marker',cx,.25,tz,23);
    destination.visible=sim.mode==='mission';$('destination-label').style.display=sim.mode==='mission'?'block':'none';
    if(time-lastUI>120){updateUI();drawMap();lastUI=time;}
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
  $('loading').classList.add('hidden');
  setTimeout(()=>notify('반갑습니다, 수송원님. ‘밀기’로 첫 작업을 시작하세요.'),600);
}

boot().catch(error=>{
  console.error('Game startup failed',error);
  const loading=$('loading');loading.classList.remove('hidden');loading.innerHTML='<svg style="width:42px;height:42px"><use href="#i-help"/></svg><b>3D 작업장을 열지 못했습니다.</b><p style="padding:0 25px;text-align:center">최신 Chrome 또는 Edge에서 하드웨어 가속을 켠 후 다시 열어주세요.</p><button id="retry-game" class="modal-primary" style="width:auto">다시 시도</button>';$('retry-game').addEventListener('click',()=>location.reload());
});

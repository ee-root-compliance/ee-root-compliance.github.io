import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { ComplianceController } from './controller.js';
import loadMujoco from './vendor/mujoco/mujoco.js';

const panelToggle = document.querySelector('#toggle-panel');
const panelBody = document.querySelector('#panel-body');
function setPanelExpanded(expanded) {
  panelBody.hidden = !expanded;
  panelToggle.setAttribute('aria-expanded', String(expanded));
  panelToggle.setAttribute('aria-label', expanded ? 'Collapse controls' : 'Expand controls');
  panelToggle.textContent = expanded ? '−' : '+';
}
setPanelExpanded(!matchMedia('(max-width: 600px)').matches);
panelToggle.addEventListener('click', () => setPanelExpanded(panelBody.hidden));

const inputs = ['x','y','z'].map(axis => document.querySelector(`#k${axis}`));
const command = { stiffness: [100,600,600], frame: 'robot-heading', rootMode: null };
function updateCommand() {
  command.stiffness = inputs.map(input => Number(input.value));
  inputs.forEach((input,i) => { document.querySelector(`#v${'xyz'[i]}`).value = input.value; });
  document.querySelectorAll('[data-preset]').forEach(button => {
    const axis = 'xyz'.indexOf(button.dataset.preset);
    const selected = axis < 0 ? command.stiffness.every(k => k === command.stiffness[0])
      : command.stiffness[axis] < 600 && command.stiffness.every((k,i) => i === axis || k === 600);
    button.setAttribute('aria-pressed',String(selected));
  });
  // The eventual controller consumes this command at its control tick.
  // Until matching policies are supplied, this only edits the requested settings.
  document.dispatchEvent(new CustomEvent('ceer2:command', {detail:{...command,stiffness:[...command.stiffness]}}));
}
inputs.forEach(input => input.addEventListener('input',updateCommand));
function preset(values) { inputs.forEach((input,i) => {input.value=values[i];}); updateCommand(); }
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click',() => {
  const axis = 'xyz'.indexOf(button.dataset.preset);
  preset(axis < 0 ? [200,200,200] : [0,1,2].map(i => i === axis ? 100 : 600));
  document.querySelector('#pull-direction').value=axis<0?'free':'xyz'[axis];
}));
document.querySelectorAll('[data-anchor]').forEach(button => button.addEventListener('click',() => preset(Array(3).fill(Number(button.dataset.anchor)))));
document.querySelector('#reset-settings').addEventListener('click',() => {preset([100,600,600]);document.querySelector('#pull-direction').value='x';});
document.querySelector('#fullscreen').addEventListener('click',async () => {
  try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.body.requestFullscreen(); }
  catch { document.querySelector('#fullscreen').textContent='Full screen unavailable'; }
});
updateCommand();

const container=document.querySelector('#scene');
const status=document.querySelector('#load-status');
let engine,model,data,renderer,controls,observer,controller;
let loaded=false,disposed=false,running=false,busy=false,resetRequested=false,forceBody=-1,force=[0,0,0],referencePosition=null,drag=null,policyError=0;
const readout=document.querySelector('.awaiting');
try {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#354f68');
  const camera=new THREE.PerspectiveCamera(38,1,0.05,70);camera.up.set(0,0,1);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(0,0,.78);controls.minDistance=1.7;controls.maxDistance=6;
  controls.maxPolarAngle=Math.PI*.49;controls.enablePan=false;
  const resetCamera=()=>{camera.position.set(2.55,-2.75,1.65);controls.target.set(0,0,.78);controls.update();};resetCamera();
  document.querySelector('#reset-view').addEventListener('click',resetCamera);
  const ambient=new THREE.HemisphereLight(0xffffff,0x536172,2.2);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(3,-2,5);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;
  key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.bias=-.0003;scene.add(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#496989';ctx.fillRect(0,0,128,128);ctx.fillStyle='#354f68';ctx.fillRect(0,0,64,64);ctx.fillRect(64,64,64,64);
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(20,20);texture.colorSpace=THREE.SRGBColorSpace;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));
  floor.receiveShadow=true;scene.add(floor);
  observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);render();});observer.observe(container);
  function render(){renderer.render(scene,camera);}
  controls.addEventListener('change',render);

  engine=await loadMujoco();
  const files=await (await fetch('./models/deploy-g1/files.json')).json();
  engine.FS.mkdir('/g1');engine.FS.mkdir('/g1/meshes');
  await Promise.all(files.map(async path=>{
    const response=await fetch(`./models/deploy-g1/${path}`);if(!response.ok)throw new Error(`Model asset missing: ${path}`);
    let bytes=new Uint8Array(await response.arrayBuffer());
    if(path.endsWith('.xml')) {
      // Legacy sensor-noise attributes were removed in recent MuJoCo releases.
      const xml=new TextDecoder().decode(bytes).replace(/\snoise="[^"]*"/g,'');
      bytes=new TextEncoder().encode(xml);
    }
    engine.FS.writeFile(`/g1/${path}`,bytes);
  }));
  model=engine.MjModel.from_xml_path('/g1/g1.xml'); data=new engine.MjData(model);
  engine.mj_resetData(model,data);
  data.qpos.set([0,0,.79,1,0,0,0]);
  const jointType=engine.mjtObj.mjOBJ_JOINT.value;
  // Reference pose from active_adaptation/assets/humanoid.py. No policy step is run.
  for(const side of ['left','right']) {
    const pose={hip_pitch:-.28,knee:.5,ankle_pitch:-.23,elbow:.87,shoulder_roll:side==='left'?.16:-.16,shoulder_pitch:.35};
    for(const [name,value] of Object.entries(pose)) {
      const joint=engine.mj_name2id(model,jointType,`${side}_${name}_joint`);
      if(joint>=0)data.qpos[model.jnt_qposadr[joint]]=value;
    }
  }
  engine.mj_forward(model,data);
  const geoms=[];
  for(let i=0;i<model.ngeom;i++) {
    if(model.geom_group[i]!==1)continue;
    const meshId=model.geom_dataid[i];if(meshId<0)continue;
    const geometry=new THREE.BufferGeometry();
    const start=model.mesh_vertadr[meshId]*3,count=model.mesh_vertnum[meshId]*3;
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(model.mesh_vert.slice(start,start+count)),3));
    const faceStart=model.mesh_faceadr[meshId]*3,faceCount=model.mesh_facenum[meshId]*3;
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(model.mesh_face.slice(faceStart,faceStart+faceCount)),1));geometry.computeVertexNormals();
    const materialId=model.geom_matid[i];const rgba=materialId>=0?model.mat_rgba.slice(materialId*4,materialId*4+4):model.geom_rgba.slice(i*4,i*4+4);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:new THREE.Color(rgba[0],rgba[1],rgba[2]),roughness:.43,metalness:.25}));
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.bodyId=model.geom_bodyid[i];mesh.userData.geomId=i;
    mesh.position.fromArray(data.geom_xpos,i*3);
    const a=data.geom_xmat.slice(i*9,i*9+9);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1));
    geoms.push(mesh);scene.add(mesh);
  }
  const bounds=new THREE.Box3();geoms.forEach(mesh=>bounds.expandByObject(mesh));floor.position.z=0;
  const origin=new THREE.Vector3(.15,-.7,floor.position.z+.012);
  for(const [axis,color] of [[new THREE.Vector3(1,0,0),0xe38581],[new THREE.Vector3(0,1,0),0x88c39b],[new THREE.Vector3(0,0,1),0x87b7f1]]) {
    scene.add(new THREE.ArrowHelper(axis,origin,.3,color,.055,.027));
  }
  for(const [i,label] of ['X','Y','Z'].entries()) {
    const c=document.createElement('canvas');c.width=c.height=64;const context=c.getContext('2d');context.font='bold 40px Arial';context.textAlign='center';context.fillStyle=['#e38581','#88c39b','#87b7f1'][i];context.fillText(label,32,45);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));sprite.scale.set(.085,.085,.085);sprite.position.copy(origin);sprite.position.setComponent(i,sprite.position.getComponent(i)+.36);scene.add(sprite);
  }
  const meta=await (await fetch('./control.json')).json();
  controller=new ComplianceController(engine,model,data,meta);
  controller.stiffness=[...command.stiffness];
  document.addEventListener('ceer2:command',event=>{controller.stiffness=[...event.detail.stiffness];});
  const wristIds=['left_wrist_yaw_link','right_wrist_yaw_link'].map(name=>engine.mj_name2id(model,engine.mjtObj.mjOBJ_BODY.value,name));
  const shoulderIds=['left_shoulder_pitch_link','right_shoulder_pitch_link'].map(name=>engine.mj_name2id(model,engine.mjtObj.mjOBJ_BODY.value,name));
  const handles=wristIds.map((id,i)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(.043,16,12),new THREE.MeshStandardMaterial({color:i===0?0xffc582:0x93d5ee,transparent:true,opacity:.85}));mesh.userData.bodyId=id;scene.add(mesh);return mesh;});
  const forceArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),.1,0xffd18c,.045,.02);forceArrow.visible=false;scene.add(forceArrow);
  function syncScene(){
    for(const mesh of geoms){const i=mesh.userData.geomId;mesh.position.fromArray(data.geom_xpos,i*3);const a=data.geom_xmat.slice(i*9,i*9+9);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1));}
    handles.forEach(mesh=>mesh.position.fromArray(data.xpos,mesh.userData.bodyId*3));
    const magnitude=Math.hypot(...force);forceArrow.visible=magnitude>.1&&forceBody>=0;
    if(forceArrow.visible){forceArrow.position.fromArray(data.xpos,forceBody*3);forceArrow.setDirection(new THREE.Vector3(...force).normalize());forceArrow.setLength(magnitude*.013,.04,.02);}
    document.querySelector('#force-value').textContent=magnitude.toFixed(1);
    const displacement=referencePosition&&forceBody>=0?Math.hypot(...Array.from(data.xpos.slice(forceBody*3,forceBody*3+3)).map((v,i)=>v-referencePosition[i]))*100:0;
    document.querySelector('#displacement-value').textContent=displacement.toFixed(1);render();
  }
  function clearForce(){if(disposed)return;force=[0,0,0];drag=null;controls.enabled=true;data.xfrc_applied.fill(0);}
  function applyForce(body,vector){
    if(body!==forceBody||!referencePosition){forceBody=body;referencePosition=Array.from(data.xpos.slice(body*3,body*3+3));}
    const magnitude=Math.hypot(...vector),gain=magnitude>30?30/magnitude:1;force=vector.map(v=>v*gain);
  }
  function resetSimulation(){
    clearForce();engine.mj_resetData(model,data);data.qpos.set([0,0,.79,1,0,0,0]);
    controller.qindices.forEach((index,i)=>{data.qpos[index]=meta.default_pos[i];});engine.mj_forward(model,data);controller.reset();referencePosition=null;forceBody=-1;syncScene();resetRequested=false;
  }
  resetSimulation();
  document.querySelector('#reset-simulation').addEventListener('click',()=>{resetRequested=true;if(!busy)resetSimulation();});
  document.querySelector('#pause-simulation').addEventListener('click',()=>{running=!running;clearForce();document.querySelector('#pause-simulation').textContent=running?'Pause':'Resume';document.querySelector('#sim-status').textContent=running?'Live simulation':'Paused';if(running&&!busy)tick();});
  async function tick(){
    if(!running||busy)return;busy=true;const began=performance.now();
    try{
      if(resetRequested)resetSimulation();
      await controller.step();
      if(disposed){busy=false;return;}
      if(running){
        for(let step=0;step<20;step++){
          data.xfrc_applied.fill(0);if(forceBody>=0)data.xfrc_applied.set(force,forceBody*6);
          controller.substep();
        }
        engine.mj_forward(model,data);syncScene();
        if(data.qpos[2]<.4||!Array.from(data.qpos).every(Number.isFinite)){running=false;clearForce();readout.innerHTML='<strong>Robot lost balance</strong><p>Reset the simulation to try again with a gentler pull.</p>';readout.hidden=false;document.querySelector('#pause-simulation').textContent='Resume';}
      }
    }catch(error){running=false;clearForce();console.error(error);status.hidden=false;status.textContent=error.message;}
    busy=false;if(running)setTimeout(tick,Math.max(0,20-(performance.now()-began)));
  }
  let startPromise;
  async function startDemo(){
    if(startPromise)return startPromise;
    startPromise=(async()=>{
      status.hidden=false;await controller.load(message=>{status.textContent=message;});
      status.textContent='Checking controller…';policyError=await controller.verify();
      status.hidden=true;readout.hidden=true;document.querySelector('#start-simulation').hidden=true;
      document.querySelector('#pause-simulation').disabled=false;document.querySelector('#reset-simulation').disabled=false;
      document.querySelectorAll('[data-probe]').forEach(b=>{b.disabled=false;});
      document.querySelector('#sim-status').textContent='Live simulation';loaded=true;running=true;tick();
    })().catch(error=>{console.error(error);status.textContent=error.message;startPromise=null;throw error;});return startPromise;
  }
  document.querySelector('#start-simulation').addEventListener('click',()=>{startDemo().catch(()=>{});});
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function setRay(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(!running||event.button!==0)return;setRay(event);
    const hits=raycaster.intersectObjects([...handles,...geoms]);const hit=hits[0];if(!hit)return;
    const body=hit.object.userData.bodyId;
    const side=shoulderIds.findIndex(id=>{let current=body;while(current>0){if(current===id)return true;current=model.body_parentid[current];}return false;});
    const wrist=side<0?undefined:wristIds[side];
    // The enlarged markers are deliberate touch targets for applying wrist forces.
    if(wrist===undefined)return;
    controls.enabled=false;renderer.domElement.setPointerCapture(event.pointerId);referencePosition=null;
    const normal=new THREE.Vector3();camera.getWorldDirection(normal);
    drag={body:wrist,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point),origin:hit.point.clone()};
    applyForce(wrist,[0,0,0]);event.stopImmediatePropagation();
  },{capture:true});
  renderer.domElement.addEventListener('pointermove',event=>{
    if(!drag||!running)return;setRay(event);const hit=new THREE.Vector3();if(!raycaster.ray.intersectPlane(drag.plane,hit))return;
    const displacement=hit.sub(drag.origin);const mode=document.querySelector('#pull-direction').value;
    let vector=displacement.toArray().map(v=>v*120);
    if(mode!=='free')vector=vector.map((v,i)=>i==='xyz'.indexOf(mode)?v:0);
    applyForce(drag.body,vector);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,clearForce);
  window.addEventListener('pointerup',clearForce);window.addEventListener('blur',clearForce);
  function pauseForLeaving(){if(!loaded)return;running=false;clearForce();document.querySelector('#pause-simulation').textContent='Resume';document.querySelector('#sim-status').textContent='Paused';}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForLeaving();});
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='ceer2:offscreen')pauseForLeaving();});
  document.querySelectorAll('[data-probe]').forEach(button=>{
    const press=()=>{if(!running)return;referencePosition=null;const axis=document.querySelector('#pull-direction').value;const vector=[0,0,0];vector[axis==='free'?0:'xyz'.indexOf(axis)]=Number(button.dataset.probe);applyForce(wristIds[0],vector);};
    button.addEventListener('pointerdown',event=>{button.setPointerCapture(event.pointerId);press();});
    button.addEventListener('pointerup',clearForce);button.addEventListener('pointercancel',clearForce);button.addEventListener('lostpointercapture',clearForce);
    button.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)press();}});
    button.addEventListener('keyup',clearForce);button.addEventListener('blur',clearForce);
  });
  status.hidden=true;syncScene();
  window.ceer2Preview=Object.freeze({start:startDemo,getState:()=>({mode:'learned-policy',controllerReady:loaded,modelLoaded:true,running,stiffness:[...controller.stiffness],qpos:Array.from(data.qpos),leftHand:Array.from(data.xpos.slice(wristIds[0]*3,wristIds[0]*3+3)),time:data.time,steps:controller.steps,policyError,force:[...force]}),
    testForce:(axis,n)=>{referencePosition=null;applyForce(wristIds[0],['x','y','z'].map(a=>a===axis?n:0));},clearForce,reset:()=>{resetRequested=true;if(!busy)resetSimulation();}});

} catch(error) {
  console.error(error);status.hidden=false;status.textContent=`Could not load the 3D preview. ${error.message}`;
}
window.addEventListener('pagehide',event=>{running=false;if(event.persisted)return;disposed=true;observer?.disconnect();controls?.dispose();renderer?.dispose();});

const panelObserver = new ResizeObserver(() => {
  window.parent.postMessage({type:'ceer2:resize',height:Math.ceil(document.querySelector('.demo').getBoundingClientRect().height)},location.origin);
});
panelObserver.observe(document.querySelector('.demo'));
document.addEventListener('pointerdown',()=>window.parent.postMessage({type:'ceer2:interaction'},location.origin));

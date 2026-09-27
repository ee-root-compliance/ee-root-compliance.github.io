import * as ort from './vendor/ort/ort.wasm.min.mjs';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('./vendor/ort/',import.meta.url).href;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const zeros=n=>Array(n).fill(0);
const push=(history,value)=>{history.unshift([...value]);history.pop();};
export class ComplianceController {
  constructor(engine,model,data,meta){
    Object.assign(this,{engine,model,data,meta});this.sessions={};this.stiffness=[100,600,600];
    this.joints=meta.joint_names.map(name=>engine.mj_name2id(model,engine.mjtObj.mjOBJ_JOINT.value,name));
    this.qindices=this.joints.map(j=>model.jnt_qposadr[j]);this.vindices=this.joints.map(j=>model.jnt_dofadr[j]);
    this.actuators=meta.joint_names.map(name=>engine.mj_name2id(model,engine.mjtObj.mjOBJ_ACTUATOR.value,name));
    this.reset();
  }
  reset(){
    this.boot=25;this.jointHistory=null;this.actionHistory=Array.from({length:3},()=>zeros(29));
    this.eeHistory=Array.from({length:3},()=>zeros(12));this.highHistory=Array.from({length:3},()=>zeros(6));
    this.lastRaw=zeros(29);this.applied=zeros(29);this.reference=[.25,.18,.15,.25,-.18,.15,0,0,0,0,0,0];
    this.targets=[...this.meta.default_pos];this.steps=0;
  }
  async load(progress){
    this.manifest=await (await fetch('./policies/manifest.json')).json();
    let i=0;for(const [name,spec] of Object.entries(this.manifest)){
      progress(`Loading controller ${++i}/${Object.keys(this.manifest).length}…`);
      this.sessions[name]=await ort.InferenceSession.create(`./policies/${spec.file}`,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    }
  }
  async infer(name,obs){
    const input=new ort.Tensor('float32',Float32Array.from(obs),[1,obs.length]);
    const result=await this.sessions[name].run({obs:input});const output=Array.from(result.action.data);
    input.dispose();Object.values(result).forEach(t=>t.dispose());return output;
  }
  async verify(){
    const golden=await (await fetch('./policies/golden.json')).json();let maxError=0;
    for(const [name,test] of Object.entries(golden)){
      const output=await this.infer(name,test.input);const error=Math.max(...output.map((v,i)=>Math.abs(v-test.output[i])));
      if(error>2e-4)throw new Error(`Policy verification failed: ${name} (${error})`);maxError=Math.max(maxError,error);
    }
    return maxError;
  }
  async step(){
    const {data,meta}=this;
    const positions=this.qindices.map(i=>data.qpos[i]);
    if(!this.jointHistory)this.jointHistory=Array.from({length:5},()=>[...positions]);
    push(this.jointHistory,positions);push(this.actionHistory,this.lastRaw);
    const [w,x,y,z]=Array.from(data.qpos.slice(3,7));
    const yaw=Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z));
    const gravity=[2*(w*y-x*z),-2*(y*z+w*x),2*(x*x+y*y)-1];
    const angular=Array.from(data.qvel.slice(3,6));
    const root=[.79,0,0,Math.cos(yaw),-Math.sin(yaw),30];
    const jointHistory=this.jointHistory.flat(),actionHistory=this.actionHistory.flat();
    const highObs=[this.boot/25,...root,...angular,...gravity,...jointHistory,...actionHistory,...this.reference,...this.eeHistory.flat(),...this.highHistory.flat()];
    if(highObs.length!==311)throw new Error(`High-level observation length ${highObs.length}`);
    const plans=this.stiffness.map((k,axis)=>{
      const anchors=[100,200,400,600];let lo=0;while(lo<2&&k>anchors[lo+1])lo++;
      const a=anchors[lo],b=anchors[lo+1];const weight=(1/k-1/b)/(1/a-1/b);
      const name=value=>value===600?'baseline_600':`${'xyz'[axis]}_${value}`;
      return [{name:name(a),weight:clamp(weight,0,1)},{name:name(b),weight:clamp(1-weight,0,1)}].filter(item=>item.weight>1e-7);
    });
    const outputs={};for(const name of new Set(plans.flat().map(p=>p.name))) outputs[name]=await this.infer(name,highObs);
    const delta=zeros(6);for(let axis=0;axis<3;axis++)for(const {name,weight} of plans[axis])for(const index of [axis,axis+3]){
      delta[index]+=weight*Math.tanh(outputs[name][index])*this.manifest[name].scale[axis];
    }
    // Compose in displacement space, matching the public analytical MoE.
    const highRaw=delta.map(d=>Math.atanh(clamp(d/.35,-.999,.999)));
    const ee=this.reference.map((v,i)=>i<6?v+delta[i]:v);
    push(this.eeHistory,ee);push(this.highHistory,highRaw);
    this.boot=Math.max(0,this.boot-1);
    const lowObs=[this.boot/25,...root,...ee,...angular,...gravity,...jointHistory,...actionHistory];
    if(lowObs.length!==257)throw new Error(`Low-level observation length ${lowObs.length}`);
    this.lastRaw=(await this.infer('low',lowObs)).map(v=>clamp(v,-10,10));
    this.applied=this.applied.map((old,i)=>old*(1-meta.action_beta)+meta.action_beta*this.lastRaw[i]*meta.action_scales[i]);
    this.targets=this.applied.map((v,i)=>meta.default_pos[i]+v);this.steps++;
    if(!this.targets.every(Number.isFinite))throw new Error('Non-finite controller output');
  }
  substep(){
    const {data,meta,model}=this;
    for(let i=0;i<this.joints.length;i++){
      const torque=(this.targets[i]-data.qpos[this.qindices[i]])*meta.stiffness[i]-data.qvel[this.vindices[i]]*meta.damping[i];
      // Physical joint actuator limits are also enforced by MuJoCo's model.
      data.ctrl[this.actuators[i]]=clamp(torque,-meta.torque_limits[i],meta.torque_limits[i]);
    }
    this.engine.mj_step(model,data);
  }
  async dispose(){for(const session of Object.values(this.sessions))await session.release();}
}

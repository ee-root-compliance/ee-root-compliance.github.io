"""Run with the ceer_deploy environment, from its repository root.
Export deployed TorchScript weights with their exact per-checkpoint normalization.
Writes ONNX and golden vectors for browser parity checks. No training or mutation of source weights.
"""
import argparse, json, pathlib, torch, numpy as np, onnxruntime as ort
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args()
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
torch.set_num_threads(1)
root=pathlib.Path('assets/models/g1')
items={'low':(root/'my_custom/policy_verystiff.pt',root/'my_custom/vecnorm_params_verystiff.pt',257)}
for name in ['baseline_600','x_400','x_200','y_400','y_200','z_400','z_200']:
 items[name]=(root/f'moe/high_policy_{name}.pt',root/f'moe/high_vecnorm_{name}.pt',311)
for axis,date in [('x','20260826'),('y','20260826'),('z','20260829')]:
 items[f'{axis}_100']=(root/f'my_custom/high_policy_100{axis}_{date}.pt',root/f'my_custom/high_vecnorm_params_100{axis}_{date}.pt',311)
class Normalized(torch.nn.Module):
 def __init__(self,model,loc,scale):
  super().__init__();self.model=model;self.register_buffer('loc',loc);self.register_buffer('scale',scale)
 def forward(self,obs):
  return self.model((obs-self.loc)/self.scale)
rng=np.random.default_rng(42);golden={};manifest={}
for name,(weight,norm,dim) in items.items():
 model=torch.jit.load(str(weight),map_location='cpu').eval()
 params=torch.load(norm,map_location='cpu',weights_only=False);params=params.get('hl_policy',params.get('policy',params))
 loc=torch.as_tensor(params['loc']).reshape(-1) if params.get('enabled',True) else torch.zeros(dim)
 scale=torch.as_tensor(params['scale']).reshape(-1).clamp_min(1e-4) if params.get('enabled',True) else torch.ones(dim)
 assert len(loc)==dim,(name,len(loc),dim)
 wrapper=Normalized(model,loc,scale).eval(); sample=torch.zeros(1,dim)
 traced=torch.jit.trace(wrapper,sample)
 dest=out/f'{name}.onnx'
 torch.onnx.export(traced,sample,str(dest),input_names=['obs'],output_names=['action'],opset_version=17,dynamo=False)
 test=(rng.normal(0,.2,(1,dim))*scale.numpy()+loc.numpy()).astype('float32')
 with torch.no_grad():expected=wrapper(torch.from_numpy(test)).numpy()
 session=ort.InferenceSession(str(dest),providers=['CPUExecutionProvider']);actual=session.run(None,{'obs':test})[0]
 error=float(np.max(np.abs(expected-actual)));assert error<2e-4,(name,error)
 golden[name]={'input':test.flatten().tolist(),'output':expected.flatten().tolist(),'onnxMaxError':error}
 manifest[name]={'file':dest.name,'inputDim':dim,'outputDim':expected.shape[-1],'source':str(weight),'scale':[.15,.15,.15]}
 if name.endswith('_100'):manifest[name]['scale']['xyz'.index(name[0])]=.35
 print(name,'OK',error,flush=True)
(out/'golden.json').write_text(json.dumps(golden));(out/'manifest.json').write_text(json.dumps(manifest,indent=2))

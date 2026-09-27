import { copyFile, mkdir } from 'node:fs/promises';
const files = [
 ...['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'].map(f=>[`node_modules/onnxruntime-web/dist/${f}`,`live-demo/vendor/ort/${f}`]),
 ['node_modules/three/build/three.module.js','live-demo/vendor/three/three.module.js'],
 ['node_modules/three/build/three.core.js','live-demo/vendor/three/three.core.js'],
 ['node_modules/three/examples/jsm/controls/OrbitControls.js','live-demo/vendor/three/OrbitControls.js'],
 ['node_modules/three/LICENSE','live-demo/vendor/three/LICENSE'],
 ['node_modules/@mujoco/mujoco/mujoco.js','live-demo/vendor/mujoco/mujoco.js'],
 ['node_modules/@mujoco/mujoco/mujoco.wasm','live-demo/vendor/mujoco/mujoco.wasm']
];
for (const [from,to] of files) {await mkdir(to.substring(0,to.lastIndexOf('/')), {recursive:true}); await copyFile(from,to);}
console.log('Local browser dependencies ready.');

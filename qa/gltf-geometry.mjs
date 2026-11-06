import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../dist/vendor/addons/loaders/GLTFLoader.js';
export async function loadGeometry(file){
  const bytes=await readFile(new URL('../dist/assets/models/'+file,import.meta.url));
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
  json.materials=[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.78}}];
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
  delete json.images;delete json.textures;delete json.samplers;
  json.extensionsUsed=[];json.extensionsRequired=[];
  const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(padded);
  const bin=bytes.subarray(20+length),out=Buffer.alloc(20+padded.length+bin.length);
  out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);
  padded.copy(out,20);bin.copy(out,20+padded.length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}

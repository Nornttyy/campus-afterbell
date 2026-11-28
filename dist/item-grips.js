import {Euler, Quaternion, Vector3} from './vendor/three.module.js';
import {dishLabels} from './hotpot-food94.js?v=campus-94';

const groceries={drink:'可乐',chips:'没事薯片',snack:'辣条',noodles:'小困熊干脆面',gum:'泡泡堂',burger:'汉堡',banana:'香蕉',lunch:'便当',chickenBucket:'炸鸡桶',layerCake:'蛋糕',wrapper:'零食包装',garlic:'大蒜（旧物品）'};
const gear={phone:'手机',pen:'中性笔',book:'语文书',answerCard:'答案卡',flash:'闪光弹',smoke:'烟雾弹',ink:'墨水瓶',bananaPeel:'香蕉皮',plunger:'马桶吸'};
const tools={chalk:'粉笔',eraser:'黑板擦',torch:'手电筒'};
const dishes=Object.fromEntries(Object.entries(dishLabels).flatMap(([dish,name])=>[['hotpotPlate-'+dish,name+'盘'],['hotpotBite-'+dish,'涮好的'+name]]));
export const GRIP_GROUPS={'零食和餐点':groceries,'学生用品':gear,'火锅食材':dishes,'老师用品':tools};
export const GRIP_ITEMS=Object.freeze({...groceries,...gear,...dishes,...tools});
export const teacherItem=id=>Object.hasOwn(tools,id);
export const gripSides=id=>['book','plunger'].includes(id)?['left','right']:['pen','eraser','chalk'].includes(id)?['right']:['left'];
export function gripKey(action,dish){
  if(action==='hotpotPlate'||action==='hotpotBite')return action+'-'+(Object.hasOwn(dishLabels,dish)?dish:'beef');
  return action==='burger'&&['layerCake','chickenBucket'].includes(dish)?dish:action;
}
export const FINGERS={Thumb:'拇指',Index:'食指',Middle:'中指',Pinky:'小指',Ring:'辅助指骨'};
const key='campus.itemGrips.v1';
const zero=()=>[0,0,0];
export const newHandGrip=()=>({position:zero(),rotation:zero(),joints:{}});
export const emptyGripSet=()=>({version:1,items:{}});
function triple(a,max){
  if(!Array.isArray(a)||a.length!==3||!a.every(n=>Number.isFinite(n)&&Math.abs(n)<=max))throw Error('握姿数值超出范围');
  return a.slice();
}
export function validateGripSet(doc){
  if(doc?.version!==1||!doc.items||typeof doc.items!=='object'||Array.isArray(doc.items))throw Error('请选择握姿编辑器导出的 JSON 文件');
  const out=emptyGripSet();
  for(const [id,sides] of Object.entries(doc.items)){
    if(!Object.hasOwn(GRIP_ITEMS,id)||!sides||typeof sides!=='object'||Array.isArray(sides))throw Error('未知物品握姿');
    const entry={};out.items[id]=entry;
    for(const [side,pose] of Object.entries(sides)){
      if(!gripSides(id).includes(side)||!pose?.joints||typeof pose.joints!=='object'||Array.isArray(pose.joints))throw Error('手部数据无效');
      const joints={};
      for(const [bone,angles] of Object.entries(pose.joints)){
        if(!/^(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(bone))throw Error('手指关节无效');
        joints[bone]=triple(angles,180);
      }
      entry[side]={position:triple(pose.position,300),rotation:triple(pose.rotation,180),joints};
    }
  }
  return out;
}
let cached=null;
export function readGrips(){
  if(!cached){try{cached=validateGripSet(JSON.parse(globalThis.localStorage?.getItem(key)));}catch{cached=emptyGripSet();}}
  return cached;
}
export const savedGrip=id=>readGrips().items[id];
export function applyGripEdits(edits){
  cached=null;
  const next=validateGripSet({...readGrips(),items:{...readGrips().items,...edits}});
  globalThis.localStorage.setItem(key,JSON.stringify(next));cached=next;
}
globalThis.addEventListener?.('storage',event=>{if(!event.key||event.key===key)cached=null;});

// Keep the prop in its authored pose. Move the palm in wrist-local axes and
// rotate each actual skin joint after the gameplay animation has been sampled.
export function createGripLayer(hand,side,lookup=savedGrip){
  const palm=hand.group,bones=new Map(),before=new Map(),p=new Vector3(),q=new Quaternion(),e=new Euler(),offset=new Vector3();
  const prefix=side==='right'?'RightHand':'LeftHand';
  palm.traverse(o=>{if(o.isBone){const i=o.name.indexOf(prefix);if(i>=0)bones.set(o.name.slice(i+prefix.length),o);}});
  let mounted=null,oldPosition=new Vector3(),oldRotation=new Quaternion(),oldScale=new Vector3(),modified=false;
  const rotate=angles=>q.setFromEuler(e.set(...angles.map(x=>x*Math.PI/180)));
  function restore(){
    if(!modified)return;
    palm.position.copy(p);palm.quaternion.copy(before.get(palm));
    for(const [o,saved] of before)o.quaternion.copy(saved);
    if(mounted){mounted.position.copy(oldPosition);mounted.quaternion.copy(oldRotation);mounted.scale.copy(oldScale);mounted=null;}
    before.clear();modified=false;
  }
  function apply(id,prop){
    const pose=lookup(id)?.[side];if(!pose)return;
    modified=true;p.copy(palm.position);before.set(palm,palm.quaternion.clone());
    if(prop?.parent===palm){mounted=prop;oldPosition.copy(prop.position);oldRotation.copy(prop.quaternion);oldScale.copy(prop.scale);prop.updateWorldMatrix(true,false);}
    palm.position.add(offset.fromArray(pose.position).multiplyScalar(.001).applyQuaternion(palm.quaternion));
    palm.quaternion.multiply(rotate(pose.rotation));
    if(mounted){
      palm.updateWorldMatrix(true,false);
      mounted.matrix.copy(palm.matrixWorld).invert().multiply(mounted.matrixWorld).decompose(mounted.position,mounted.quaternion,mounted.scale);
    }
    for(const [joint,angles] of Object.entries(pose.joints)){
      const bone=bones.get(joint);if(!bone)continue;
      before.set(bone,bone.quaternion.clone());bone.quaternion.multiply(rotate(angles));
    }
  }
  return {restore,apply,bone:name=>bones.get(name)};
}

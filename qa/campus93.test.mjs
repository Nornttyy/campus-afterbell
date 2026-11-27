import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcade,arcadeInput,arcadeSnapshot,advanceArcade} from '../dist/classroom-arcade93.js';
import {createSoloRound,SoloStudentRound} from '../dist/solo-round.js';
import {CampusRoom} from '../dist/room-simulation.js';
import {validRoundSettings} from '../dist/round-settings55.js';
import {RULE_FIELDS,TUNING_DEFAULTS,tuningForm} from '../dist/round-tuning93.js';
import {BUS, busBlocked, busRoute} from '../dist/bus-layout86.js';
import * as T from '../dist/vendor/three.module.js';
import {createExcursionRoad} from '../dist/excursion-road91.js';
import {createSeatLayout} from '../dist/classroom-layout.js';
import {RADIO_SONGS,radioSong,radioAnchor,reachesRadio} from '../dist/campus-radio93.js';

test('miner collects only the intersected ore on return and scores once per gold or gem',()=>{
 const s=createArcade('miner',24);
 assert.deepEqual(arcadeSnapshot(s),arcadeSnapshot(createArcade('miner',24)));
 for(const kind of ['rock','gold','gem']){
  const ore=s.ore.find(o=>o.kind===kind&&!o.gone);
  // Isolate the target in the hook path; leave the rest of the wave alive.
  for(const o of s.ore)if(o!==ore)o.x=37;
  ore.x=160;ore.y=74;s.angle=0;
  const start=s.score;assert.ok(arcadeInput(s,'confirm'));assert.equal(arcadeInput(s,'confirm'),false);
  assert.equal(advanceArcade(s,.15),0);assert.equal(s.phase,'cast');assert.equal(ore.gone,false);
  assert.equal(advanceArcade(s,2.5),kind==='rock'?0:1);assert.equal(ore.gone,true);
  assert.equal(s.score>start,kind!=='rock');assert.equal(advanceArcade(s,.01),0);
 }
 advanceArcade(s,65);assert.equal(s.alive,false);assert.equal(arcadeInput(s,'down'),false);
});

test('tetrominoes use a seven bag, respect the walls and credit completed lines once',()=>{
 const s=createArcade('tetris',7),types=[];
 for(let i=0;i<7;i++){types.push(s.type);arcadeInput(s,'confirm');s.rows.fill('0000000000');}
 assert.equal(new Set(types).size,7);
 while(arcadeInput(s,'left')){}assert.equal(s.x,0);assert.ok(arcadeInput(s,'up'));
 s.rows[19]='1110000111';Object.assign(s,{x:3,y:0,type:2,shape:['1111']});
 assert.equal(arcadeSnapshot(s).ghost,19);assert.ok(arcadeInput(s,'confirm'));
 assert.equal(s.lines,1);assert.equal(advanceArcade(s,.01),1);assert.equal(advanceArcade(s,.01),0);
 assert.ok(s.rows.every(row=>row==='0000000000'));s.rows[0]='1111111111';s.y=17;arcadeInput(s,'confirm');
 assert.ok(Array.isArray(arcadeSnapshot(s).next));
});

test('classroom computers credit the correct student, preserve the game on Q and expose it to the room',()=>{
 const r=createSoloRound({map:'computer',role:'student',seed:11});r.start();assert.ok(r.startComputer());
 for(const dir of ['down','down','right'])assert.ok(r.computerSelect(dir));assert.ok(r.computerConfirm());
 const p=r.player,s=p._arcades.tetris;assert.equal(r.snapshot().player.computer.app,'tetris');
 Object.assign(s,{x:3,y:0,type:2,shape:['1111']});s.rows[19]='1110000111';
 assert.ok(r.computerConfirm());r.step(.12);assert.equal(r.score,1);assert.equal(p._earnedPoints,1);
 assert.equal(r.snapshot().students.find(a=>a.id===p.id).computer.arcade.lines,1);
 assert.ok(r.computerBack());const saved=s.y;r.step(1);assert.equal(s.y,saved);assert.equal(r.score,1);assert.ok(r.computerBack());
});

test('two seconds of board writing regenerate twenty stamina; cancellation fades and ten seconds end a stroke',()=>{
 const r=createSoloRound({role:'teacher',map:'classroom',seed:12});r.start();
 Object.assign(r.player,{x:r.board.x,z:r.board.z-.35,yaw:0,pitch:0});r.teacher.stamina=0;
 assert.ok(r.setWriting(true));r.step(2);assert.ok(Math.abs(r.teacher.stamina-20)<.01);assert.ok(Math.abs(r.teacher.boardAmount-.2)<.001);
 assert.ok(r.setWriting(true));r.step(1);assert.ok(Math.abs(r.teacher.writeProgress-.3)<.001);
 r.setWriting(false);r.step(.8);assert.ok(r.teacher.boardOpacity>0&&r.teacher.boardOpacity<1);r.step(2);assert.equal(r.teacher.boardAmount,0);assert.ok(Math.abs(r.teacher.stamina-30)<.001);
 r.setWriting(true);r.step(10.1);assert.equal(r.teacher.writing,false);assert.equal(r.teacher.stamina,100);assert.ok(r.teacher.boardOpacity>.9);
});

test('twenty real host settings validate units, survive a floor change and reach the game',()=>{
 assert.equal(4+RULE_FIELDS.length,20);assert.equal(new Set(RULE_FIELDS.map(f=>f.key)).size,16);
 for(const f of RULE_FIELDS){assert.match(tuningForm('custom'),new RegExp('id="custom-'+f.key+'"'));for(const n of [f.min-1,f.max+1,'8'])assert.equal(validRoundSettings({duration:600,target:100,tuning:{[f.key]:n}}),false);}
 const r=new CampusRoom({code:'939393',seed:44});const h=r.join({name:'房主'}),g=r.join({name:'同学'});
 const settings={duration:900,target:130,chalkStamina:true,capacity:3,tuning:{chalkCost:12,foodPoints:4,labRefill:8,writingRegen:14}};
 assert.throws(()=>r.configureRound(g,settings),/房主/);assert.ok(r.configureRound(h,settings));assert.equal(r.maxPlayers,3);
 r._rebuild('computer');assert.equal(r.sim.tuning.forwardDrainMs,TUNING_DEFAULTS.forwardDrainMs);assert.equal(r.snapshot(g).settings.tuning.foodPoints,4);
 r.preference(h,{rolePreference:'teacher'});r.begin(h);for(let i=0;i<303;i++)r.tick(.1);
 assert.throws(()=>r.configureRound(h,settings),/开局/);r.sim.teacher.stamina=72;r.command(h,'throwChalk',[]);assert.equal(r.sim.teacher.stamina,60);
 const s=g.context.player;r.sim._completeAction(s,{action:'burger',progress:2});assert.equal(r.sim.score,4);
 const slot={action:'snack',progress:2};r.sim._completeAction(s,slot);assert.ok(Math.abs(slot.readyAt-r.sim.elapsed-8)<.001);
});

test('social poses are shared while standing and end when the performer walks, sits or changes stage',()=>{
 const r=new CampusRoom({code:'939392',seed:6});const h=r.join({name:'甲'}),g=r.join({name:'乙'});
 assert.ok(r.command(g,'setEmote',['wave']));assert.equal(r.snapshot(h).students.find(s=>s.id===g.studentId).emote.id,'wave');
 assert.equal(r.command(g,'setEmote',['unknown']),false);r.command(g,'setMovement',[0,1]);assert.ok(!r.snapshot(h).students.find(s=>s.id===g.studentId).emote);
 g.context.player.seated=true;assert.equal(r.command(g,'setEmote',['step']),false);g.context.player.seated=false;
 assert.ok(r.command(g,'setEmote',['swing']));r.begin(h);assert.ok(!r.snapshot(g).player.emote);
});

test('the driver can reach both decks and the ordinary classroom retains its centre aisle',()=>{
 const layout={busDeparted:true};assert.equal(busBlocked(BUS.driver.x,BUS.driver.z,.24,0,layout),false);
 assert.ok(busRoute(BUS.driver,{x:6.03,z:-12.91,busDeck:1},.24,layout).length>2);
 const seats=createSeatLayout(6,'classroom');assert.equal(seats[0].pattern,'facing-aisle');assert.equal(seats.length,28);
});

const atRadio=(actor,map)=>{
 const a=radioAnchor(map);Object.assign(actor,{x:a.x+Math.sin(a.yaw)*.82,z:a.z+Math.cos(a.yaw)*.82,seated:false,seatId:null,busDeck:0,caught:false,captivity:'free'});
};

test('the radio uses the two complete recordings; the host draws once per accepted activation on either map',()=>{
 assert.equal(RADIO_SONGS.length,2);
 for(const map of ['bus','playground'])for(const [i,roll] of [[0,0],[1,.50],[1,.999999]]){
  const r=map==='bus'?new SoloStudentRound({map,seed:7}):createSoloRound({map,seed:7});r.start();atRadio(r.player,map);
  const realRandom=r._random.bind(r);let draws=0;r._random=()=>{draws++;return roll;};
  assert.equal(r.changeRadio('unknown'),false);assert.equal(r.changeRadio(false),false);
  assert.ok(r.changeRadio(true));assert.equal(r.radio,null);r._advanceFixtures(2);assert.equal(r.radio.track,RADIO_SONGS[i].id,'legacy titles cannot pick a track');
  const station=r.snapshot().radio;
  for(const request of [true,false,null,'rain'])assert.equal(r.changeRadio(request),false);
  assert.deepEqual(r.radio,station);assert.equal(draws,1);r._random=realRandom;
  r.step(.75);assert.equal(r.score,0);r.step(.26);assert.equal(r.score,.1);
  r.pause(true);r.step(4);assert.equal(r.score,.1);r.pause(false);r.step(2.02);assert.equal(r.score,.3);
  r.score=r.target-.1;r.step(1.02);assert.equal(r.status,'won');assert.equal(r.score,r.target);
  assert.deepEqual(r.snapshot().radioAtFinish,station);assert.equal(r.snapshot().radio,undefined);
  r.reset();assert.equal(r.snapshot().radioAtFinish,undefined);
 }
 const r=createSoloRound({map:'classroom'});r.start();assert.equal(r.changeRadio(true),false);
 const a=radioAnchor('bus');assert.equal(reachesRadio('bus',{...a,busDeck:1}),false);
 assert.equal(reachesRadio('bus',{x:a.x+.8,z:a.z,busDeck:0}),false);
});

test('only a nearby teacher can silence the room; a repeated student press cannot reroll or steal score',()=>{
 for(const map of ['bus','playground']){
  const r=new CampusRoom({code:'939387',seed:19,map}),h=r.join({name:'老师'}),g=r.join({name:'甲'}),j=r.join({name:'乙'});
  r.preference(h,{rolePreference:'teacher'});r.begin(h);for(let i=0;i<31;i++)r.tick(1);
  for(const m of [h,g,j])atRadio(m.context.player,map);
  assert.equal(r.command(h,'changeRadio',[true]),false);assert.ok(r.command(g,'changeRadio',[true]));
  r.tick(2);const first=r.snapshot(h).radio;assert.ok(first);assert.deepEqual(first,r.snapshot(j).radio);
  for(const args of [[true],[false],['friends'],[null],[]])assert.equal(r.command(j,'changeRadio',args),false);
  assert.equal(r.command(g,'changeRadio',[false]),false);assert.deepEqual(r.sim.radio,first);
  r.tick(1.1);assert.equal(g.context.player._earnedPoints,.1);assert.equal(j.context.player._earnedPoints,0);
  const teacher=h.context.player;teacher.x+=10;assert.equal(r.command(h,'changeRadio',[false]),false);
  atRadio(teacher,map);teacher.captivity='stunned';assert.equal(r.command(h,'changeRadio',[false]),false);teacher.captivity='free';
  assert.ok(r.command(h,'changeRadio',[false]));assert.equal(r.snapshot(j).radio,undefined);
  const score=r.sim.score;r.tick(1.1);assert.equal(r.sim.score,score);
  assert.ok(r.command(j,'changeRadio',[true]));r.tick(2);const second=r.snapshot(g).radio;
  assert.ok(second.activation>first.activation);assert.ok(radioSong(second.track));
  r.disconnect(j);r.tick(2);assert.deepEqual(r.snapshot(h).radio,second);assert.equal(r.sim.score,score);
  r.reconnect(j);r.tick(1.02);assert.equal(j.context.player._earnedPoints,.1);
  r.leave(j);r.tick(1.02);assert.deepEqual(r.snapshot(h).radio,second);assert.equal(r.sim.score,score+.1);
  assert.ok(r.command(h,'changeRadio',[null]));r.sim._finish('lost','test');assert.equal(r.snapshot(h).radioAtFinish,undefined);
 }
});

test('both departure and arrival stations stay free of street props at section boundaries',()=>{
 const root=new T.Group(),road=createExcursionRoad(root),instance=new T.Matrix4(),world=new T.Matrix4(),bounds=new T.Box3();
 for(const seed of [4,78,125])for(const x of [0,47.7,84.3,319.8,1535.4]){
  road.update(x,seed,x);root.updateMatrixWorld(true);
  const stop=new T.Box3(new T.Vector3(x-8.79,.01,-7.99),new T.Vector3(x+15.69,3.64,12.54));
  root.traverse(mesh=>{
   if(!mesh.isInstancedMesh||['road-ground','road-asphalt'].includes(mesh.name))return;
   mesh.geometry.computeBoundingBox();
   for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);world.multiplyMatrices(mesh.matrixWorld,instance);
    bounds.copy(mesh.geometry.boundingBox).applyMatrix4(world);
    assert.ok(!stop.intersectsBox(bounds),mesh.name+' overlaps the station on seed '+seed+' at '+x);
   }
  });
 }
 road.dispose();
});

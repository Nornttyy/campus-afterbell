import test from 'node:test';
import assert from 'node:assert/strict';
import {CampusRoom} from '../dist/room-simulation.js';
import {visibleClassmates} from '../dist/player-names119.js';

test('head labels follow actual teams, lobby choices and connected members',()=>{
 const room=new CampusRoom({code:'119119',seed:119});
 const host=room.join({name:'班主任',rolePreference:'teacher'});
 const second=room.join({name:'同桌',rolePreference:'teacher'});
 const third=room.join({name:'班长'});
 const names=viewer=>[...visibleClassmates(room.snapshot(viewer)).values()].sort();
 assert.deepEqual(names(host),['同桌']);
 assert.deepEqual(names(third),[]);
 room.begin(host);
 const teacher=room.teacherMember;
 const [a,b]=[host,second,third].filter(member=>member!==teacher);
 assert.deepEqual(names(teacher),[]);
 assert.deepEqual(names(a),[b.name]);
 assert.deepEqual(names(b),[a.name]);
 b.connected=false;assert.deepEqual(names(a),[]);
 b.connected=true;assert.deepEqual(names(a),[b.name]);
 assert.equal(visibleClassmates(null).size,0);
});

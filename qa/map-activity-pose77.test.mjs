import test from 'node:test';
import assert from 'node:assert/strict';
import {activityHandTargets} from '../dist/map-activity-pose77.js';
test('retired playground handles cannot drive wrist IK',()=>{
 assert.equal(activityHandTargets({kind:'hang',id:'playground-bar-2'}),null);
});

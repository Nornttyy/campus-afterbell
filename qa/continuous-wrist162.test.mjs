import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../dist/vendor/three.module.js';
import {createRiggedPalm} from '../dist/student-assets.js';
import {loadGeometry} from './gltf-geometry.mjs';

function skins(root) {
  const result = [];
  root.traverse(mesh => { if (mesh.isSkinnedMesh) result.push(mesh); });
  return result;
}

function signature(attributes, i) {
  return ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].flatMap(name => {
    const attr = attributes[name];
    return Array.from({length: attr.itemSize}, (_, k) => attr.getComponent(i, k));
  }).join(',');
}

for (const [side, label] of [[-1, 'left'], [1, 'right']]) {
  test(label + ' wrist stays closed when bent and retains the original fingers', async () => {
    const [old, source] = await Promise.all([1, 2].map(version =>
      loadGeometry('ponytail-hand-' + label + '-v' + version + '.glb')));
    const hand = createRiggedPalm(source, side);
    const meshes = skins(hand.group);
    assert.deepEqual(meshes.map(m => m.geometry.uuid), skins(source.scene).map(m => m.geometry.uuid));
    const palm = meshes.find(m => m.geometry.hasAttribute('uv'));
    const retained = new Set();
    for (let i = 0; i < palm.geometry.attributes.position.count; i++)
      retained.add(signature(palm.geometry.attributes, i));
    const original = skins(old.scene).find(m => m.geometry.hasAttribute('uv'));
    const attrs = original.geometry.attributes;
    let checked = 0;
    for (let i = 0; i < attrs.position.count; i++) {
      let thumb = 0;
      for (let k = 0; k < 4; k++) {
        const bone = original.skeleton.bones[attrs.skinIndex.getComponent(i, k)];
        if (bone.name.includes('Thumb')) thumb += attrs.skinWeight.getComponent(i, k);
      }
      if (thumb < .99 && attrs.position.getY(i) < 0) continue;
      assert.ok(retained.has(signature(attrs, i)), 'missing source vertex ' + i);
      checked++;
    }
    assert.ok(checked > 100);
    const wrist = palm.skeleton.bones.find(b => b.name.endsWith('Hand'));
    for (const [curl, angle] of [[0, 0], [.7, .55]]) {
      hand.setCurl(curl);
      wrist.rotateX(angle);
      hand.group.updateMatrixWorld(true);
      const edges = new Map();
      for (const mesh of meshes) {
        const {index, attributes} = mesh.geometry;
        const key = i => mesh.getVertexPosition(i, new Vector3()).toArray()
          .map(v => Math.round(v * 1e6)).join(',');
        for (let t = 0; t < index.count; t += 3) {
          for (let k = 0; k < 3; k++) {
            const i = index.getX(t + k), j = index.getX(t + (k + 1) % 3);
            if (Math.min(attributes.position.getY(i), attributes.position.getY(j)) > -.0079) continue;
            const a = key(i), b = key(j);
            if (a === b) continue;
            const edge = [a, b].sort().join('/');
            edges.set(edge, (edges.get(edge) || 0) + (a < b ? 1 : -1));
          }
        }
      }
      assert.ok(edges.size > 100);
      assert.ok([...edges.values()].every(count => count === 0), 'unpaired wrist edge at bend ' + angle);
    }
  });
}

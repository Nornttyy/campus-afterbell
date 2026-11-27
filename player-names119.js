import * as T from './vendor/three.module.js';

// The lobby shows the appearance currently chosen at the locker. Once class
// starts, use the assigned role, even if several players volunteered to teach.
export function visibleClassmates(state) {
  const names = new Map();
  const room = state?.room;
  if (!state?.network || !room) return names;
  const roleOf = member => state.stage === 'gathering' ? member.rolePreference : member.role;
  const self = room.members.find(member => member.id === room.selfId);
  if (!self?.connected) return names;
  for (const peer of room.members) {
    if (peer.id !== self.id && peer.connected && roleOf(peer) === roleOf(self)
        && Number.isInteger(peer.studentId) && peer.studentId >= 0 && peer.name) {
      names.set(peer.studentId, peer.name);
    }
  }
  return names;
}

function makeLabel(name) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '500 44px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(name).width) + 16;
  canvas.height = 68;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(38,40,42,.48)';
  ctx.strokeText(name,canvas.width/2,34);
  ctx.fillStyle = '#fffdf4';
  ctx.fillText(name,canvas.width/2,34);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({map, transparent:true, depthTest:true, depthWrite:false, toneMapped:false}));
  sprite.scale.set(.195*canvas.width/canvas.height,.195,1);
  sprite.name = 'teammate-name';
  sprite.userData.playerName = name;
  return sprite;
}

export function createPlayerNames(scene) {
  const entries = new Map();
  function remove(id, entry) {
    entry.sprite.removeFromParent();
    entry.sprite.material.map.dispose();
    entry.sprite.material.dispose();
    entries.delete(id);
  }
  return {
    update(state, records) {
      if (!state?.network && !entries.size) return;
      const names = visibleClassmates(state);
      for (const [id,entry] of entries) if (names.get(id) !== entry.name) remove(id,entry);
      for (const [id,name] of names) {
        const record = records[id], actor = record?.actor;
        const head = actor?.bones?.Head || actor?.head;
        let entry = entries.get(id);
        if (!head || !record.group.visible || !actor.group.visible) {
          if (entry) entry.sprite.visible = false;
          continue;
        }
        if (!entry) {
          const sprite = makeLabel(name);
          scene.add(sprite);
          entries.set(id,entry={name,sprite});
        }
        head.getWorldPosition(entry.sprite.position);
        entry.sprite.position.y += record.previewRole === 'teacher' ? .55 : .46;
        entry.sprite.visible = true;
      }
    },
    dispose() { for (const [id,entry] of entries) remove(id,entry); }
  };
}

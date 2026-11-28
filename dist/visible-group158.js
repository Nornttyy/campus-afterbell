import {Group} from './vendor/three.module.js';

// Three updates hidden descendants during the scene-wide matrix traversal.
// Refresh the whole branch on reveal, including parent changes made while hidden.
export class VisibleGroup extends Group {
  updateMatrixWorld(force) {
    if (!this.visible) {
      this.matrixWorldNeedsUpdate = true;
      return;
    }
    super.updateMatrixWorld(force);
  }
}

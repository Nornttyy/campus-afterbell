// Production loads required models before constructing a hand rig or classroom.
// Node tests read the same shipping mesh, with image decoding disabled.
import {loadGeometry} from './gltf-geometry.mjs';
import {CLASSROOM_PROP_SOURCES,loadPropAssets} from '../dist/prop-assets.js?v=campus-83';
const result=await loadPropAssets({drink:CLASSROOM_PROP_SOURCES.drink},{
 loader:{loadAsync:url=>loadGeometry(new URL(url).pathname.split('/').pop())}
});
if(result.failed.length)throw result.failed[0].error;

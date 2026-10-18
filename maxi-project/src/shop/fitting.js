// Примерочная: фигура по меркам, вещи из любых магазинов «Макси» в одном образе, ткань по выкройке.
// Код разложен по модулям в папке fitting/ (см. docs/architecture.md); этот файл — точка входа для остального сайта.
export {classify, isWearable} from './fitting/classify.js';
export {fabricType} from './fitting/cloth-material.js';
export {setDrape, legR, makeCollider} from './fitting/collider.js';
export {drapeGarment} from './fitting/drape-old.js';
export {drapePrepare, drapeTemplate} from './fitting/drape.js';
export {CLOTH_VER} from './fitting/worker.js';
export {garmentMeshAsync} from './fitting/garment-async.js';
export {QC} from './fitting/qc.js';
export {garmentMesh} from './fitting/garment.js';
export {createFitting} from './fitting/ui.js';
export {bodyDims, torsoR, sx, sz, armX} from './fitting/body.js';
export {armJ, armRad} from './fitting/geometry.js';
export {runCloth, motionAt} from './fitting/sim.js';
export {topSpec, bottomSpec, skirtProf} from './fitting/specs.js';

// Одна вещь на фигуре (синхронно): ткань по выкройке или простая форма.
import * as THREE from 'three';
import {classify} from './classify.js';
import {LIN} from './common.js';
import {drapeGarment} from './drape-old.js';
import {drapeTemplate} from './drape.js';
import {fabricMat} from './fabric-simple.js';
import {photoGarment} from './photo-garment.js';
import {QC} from './qc.js';
import {EASE, flarePiece, frontLine, frontZ, legPieces, sleeves, torsoPiece} from './simple-garment.js';
import {fit} from './state.js';

// одна вещь на фигуре; если у вещи будет glb — здесь подменить на загруженную модель (вариант «В»)
export function garmentMesh(item, d) {
  delete QC[item.id];
  if (item.tex) { const un = fit.UNDER ? {a: fit.UNDER, b: fit.UNDERZ} : null; const g = drapeTemplate(item, d, un) || (item.drape ? drapeGarment(item, d, un) : null); return g || photoGarment(item, d); }
  const c = classify(item) || {slot: 'top', kind: 'tee'}, k = c.kind, g = new THREE.Group(), H = d.H, off = EASE[k] || 0.012;
  const fab = k === 'jeans' ? 'denim' : k === 'puffer' ? 'quilt' : (k === 'sweater' || k === 'hoodie') ? 'knit' : k === 'jacket' && /кож|косух/i.test(item.name) ? 'leather' : 'plain';
  const mat = fabricMat(item, fab), dark = new THREE.MeshStandardMaterial({color: LIN(item.color || '#888').multiplyScalar(0.55), roughness: 0.8});
  const metal = new THREE.MeshStandardMaterial({color: LIN('#c9ccd0'), roughness: 0.3, metalness: 0.9});
  if (k === 'tee') { g.add(torsoPiece(d, 0.5, 0.85, off, 0, mat)); sleeves(d, 0.38, off, mat, g); }
  else if (k === 'sweater') { g.add(torsoPiece(d, 0.49, 0.86, off, 0, mat)); sleeves(d, 1, off, mat, g, true); g.add(torsoPiece(d, 0.485, 0.505, off + 0.004, 0, dark)); }
  else if (k === 'shirt') {
    g.add(torsoPiece(d, 0.48, 0.855, off, 0, mat)); sleeves(d, 1, off, mat, g, true);
    const col = new THREE.Mesh(new THREE.TorusGeometry(d.neck + 0.012, 0.012, 8, 24), mat); col.rotation.x = Math.PI / 2; col.position.y = 0.855 * H; col.scale.set(1.1, 1, 1); g.add(col);
    frontLine(d, 0.5, 0.84, off, 0.006, dark, g, 2.2);
  }
  else if (k === 'hoodie') {
    g.add(torsoPiece(d, 0.48, 0.86, off, 0, mat)); sleeves(d, 1, off, mat, g, true);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13 * d.s, 24, 16, Math.PI * 0.15, Math.PI * 1.7, 0.2, Math.PI * 0.62), mat); hood.position.set(0, 0.86 * H, -0.06 * d.s); hood.rotation.y = Math.PI; hood.scale.set(1.05, 0.62, 0.8); g.add(hood);
    g.add(torsoPiece(d, 0.475, 0.5, off + 0.006, 0, dark));
  }
  else if (k === 'jacket' || k === 'coat' || k === 'puffer' || k === 'vest') {
    const low = k === 'coat' ? 0.3 : k === 'puffer' && /длин|пальто/i.test(item.name) ? 0.32 : 0.45;
    g.add(torsoPiece(d, low, 0.865, off, k === 'coat' ? 0.03 : 0.006, mat));
    if (k !== 'vest') sleeves(d, 1, off + 0.004, mat, g, true);
    frontLine(d, Math.max(0.47, low + 0.01), 0.85, off, 0.0045, k === 'coat' ? dark : metal, g);
    if (k === 'coat') [0.7, 0.62, 0.54, 0.46].forEach(y => { const bt = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), dark); bt.position.set(0.035, y * H, frontZ(d, y, off) + 0.01); g.add(bt); });
    const col = new THREE.Mesh(new THREE.TorusGeometry(d.neck + off * 0.9, 0.022, 8, 24), mat); col.rotation.x = Math.PI / 2; col.position.y = 0.862 * H; col.scale.set(1.15, 1, 1); g.add(col);
    if (k === 'puffer' && /капюш/i.test(item.name)) { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14 * d.s, 24, 16, Math.PI * 0.15, Math.PI * 1.7, 0.2, Math.PI * 0.6), mat); hood.position.set(0, 0.86 * H, -0.07 * d.s); hood.rotation.y = Math.PI; hood.scale.set(1.08, 0.62, 0.82); g.add(hood); }
  }
  else if (k === 'dress') {
    const hem = /макси|вечерн/i.test(item.name) ? 0.08 : /мини/i.test(item.name) ? 0.38 : 0.26;
    g.add(torsoPiece(d, 0.6, 0.84, off, 0, mat));
    g.add(flarePiece(d, 0.612, hem, off, (/трикотаж|футляр/i.test(item.name) ? 0.03 : 0.1) * d.s, mat));
    if (!/сарафан/i.test(item.name)) sleeves(d, 0.3, off, mat, g);
  }
  else if (k === 'pants' || k === 'jeans' || k === 'shorts') {
    const yLow = k === 'shorts' ? 0.33 : 0.045;
    legPieces(d, yLow, off, mat, g, k === 'pants' && /широк|клёш|палаццо/i.test(item.name) ? 0.2 : 0.02);
    g.add(torsoPiece(d, 0.465, 0.6, off, 0, mat));
    g.add(torsoPiece(d, 0.585, 0.605, off + 0.003, 0, k === 'jeans' ? mat : dark));
  }
  else if (k === 'skirt') {
    const hem = /макси|длин/i.test(item.name) ? 0.1 : /мини/i.test(item.name) ? 0.4 : 0.28;
    g.add(flarePiece(d, 0.605, hem, off, (/карандаш/i.test(item.name) ? 0.02 : 0.09) * d.s, mat));
    g.add(torsoPiece(d, 0.59, 0.612, off + 0.004, 0, dark));
  }
  else if (c.slot === 'shoes') {
    const sole = new THREE.MeshStandardMaterial({color: LIN(k === 'sneaker' ? '#f2f0ea' : '#2a2421'), roughness: 0.6});
    [-1, 1].forEach(side => {
      const x = side * d.legX, up = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat);
      up.scale.set(0.052 * d.s, k === 'shoe' ? 0.035 * d.s : 0.045 * d.s, 0.135 * d.s); up.position.set(x, 0.042 * H, 0.05 * d.s); g.add(up);
      const so = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), sole); so.scale.set(0.054 * d.s, 0.022 * d.s, 0.14 * d.s); so.position.set(x, 0.011 * d.s, 0.05 * d.s); g.add(so);
      if (k === 'boot') { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * d.s, 0.052 * d.s, 0.12 * H, 18, 1, true), mat); sh.position.set(x, 0.1 * H, 0); g.add(sh); }
    });
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

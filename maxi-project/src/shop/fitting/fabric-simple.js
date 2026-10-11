// Фактуры ткани для простых форм (вариант «Б», без фото).
import * as THREE from 'three';
import {LIN} from './common.js';

// ---------- фактуры ткани (серые, цвет даёт материал) ----------
export const TEX = {};
function fabricTex(kind) {
  if (TEX[kind]) return TEX[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 256, 256);
  const rnd = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  if (kind === 'knit') { for (let x = 0; x < 256; x += 8) { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(x, 0, 3, 256); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 4, 0, 2, 256); } }
  else if (kind === 'denim') { g.fillStyle = '#d9dde2'; g.fillRect(0, 0, 256, 256); for (let i = -256; i < 256; i += 4) { g.strokeStyle = `rgba(255,255,255,${0.12 + rnd() * 0.12})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); } }
  else if (kind === 'quilt') { for (let y = 0; y < 256; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(.25, 'rgba(255,255,255,.22)'); gr.addColorStop(.6, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.30)'); g.fillStyle = gr; g.fillRect(0, y, 256, 32); } }
  else if (kind === 'leather') { for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 1 + rnd() * 2); } }
  else { for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '0,0,0' : '255,255,255'},${rnd() * 0.07})`; g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  TEX[kind] = t; return t;
}
export function fabricMat(item, kind, rep) {
  const t = fabricTex(kind).clone(); t.needsUpdate = true; t.repeat.set(rep || 6, rep ? rep * 1.5 : kind === 'quilt' ? 11 : 8);
  const rough = kind === 'leather' ? 0.45 : kind === 'quilt' ? 0.55 : 0.85;
  return new THREE.MeshStandardMaterial({color: LIN(item.color || '#888888'), map: t, roughness: rough, metalness: 0, side: THREE.DoubleSide});
}

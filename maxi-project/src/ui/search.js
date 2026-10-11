// Поиск магазина.
import {releaseLock} from '../controls/input.js';
import {$} from '../core/helpers.js';
import {CATS} from '../mall/categories.js';
import {S} from '../mall/stores.js';
import {showTop, walkTo} from '../nav/travel.js';
import {canvas} from '../render/scene.js';
import {floorName} from './pick.js';
import {syncSettings} from './settings-panel.js';
import {app} from '../core/state.js';

/* ---------- Поиск ---------- */
export function openSearch(){$('search').hidden=false;$('q').value='';renderResults('');releaseLock();setTimeout(()=>$('q').focus(),30);}
export function closeSearch(){$('search').hidden=true;canvas.focus();}
function renderResults(q){q=q.trim().toLowerCase();const ul=$('results');ul.innerHTML='';
 const named=S.filter(s=>s.cat!=='tbd');
 const list=named.filter(s=>!q||((s.names||[s.name]).join(' ')+' '+(s.what||'')+' '+CATS[s.cat].n+' '+CATS[s.cat].k+' '+s.floor+' этаж').toLowerCase().includes(q)).sort((a,b)=>{const ai=a.name.toLowerCase().startsWith(q)?0:1,bi=b.name.toLowerCase().startsWith(q)?0:1;return ai-bi||a.name.localeCompare(b.name,'ru');});
 if(!list.length){const li=document.createElement('li');li.style.cursor='default';li.style.color='var(--muted)';li.textContent='В ТРЦ такого не нашлось';ul.appendChild(li);return;}
 list.slice(0,100).forEach(s=>{const li=document.createElement('li');li.dataset.id=s.id;const i=document.createElement('i');i.style.background=s.colHex;const bt=document.createElement('b');bt.textContent=s.name;const sm=document.createElement('small');sm.textContent=(s.what||CATS[s.cat].n)+' · '+floorName(s.floor);li.append(i,bt,sm);
  li.onclick=()=>{closeSearch();if(app.mode==='top')showTop(s);else walkTo(s);};ul.appendChild(li);});}

// по порядку, при запуске
export function init() {

$('bSearch').onclick=openSearch;$('search').addEventListener('pointerdown',e=>{if(e.target.id==='search')closeSearch();});
$('q').addEventListener('input',e=>renderResults(e.target.value));
$('bInfo').onclick=()=>{$('info').hidden=false;releaseLock();syncSettings();};$('infoOk').onclick=()=>{$('info').hidden=true;};$('infoX').onclick=()=>{$('info').hidden=true;};
}

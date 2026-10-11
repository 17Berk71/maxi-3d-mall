// Корзина и форма заказа (демо).
import {fmtPrice} from './catalog.js';
import {iconURL} from './icons.js';
import {cart} from './cart.js';
import {releaseLock, updateCross} from '../controls/input.js';
import {$} from '../core/helpers.js';
import {requestLockIfNeeded} from './panel.js';
import {el_, thumbURL} from './product.js';
import {floorName} from '../ui/pick.js';

/* ---------- Корзина и заказ ---------- */
function updateCartBadge(){const n=cart.count();$('cartN').textContent=n>99?'99+':String(n);$('cartN').hidden=!n;}
export function openCart(checkout){releaseLock();$('cartBox').hidden=false;$('orderDone').hidden=true;$('orderForm').hidden=true;$('cartMain').hidden=false;renderCart();if(checkout&&cart.count())showOrderForm();updateCross();}
export function closeCart(){$('cartBox').hidden=true;updateCross();}
function renderCart(){const ul=$('cartList');ul.innerHTML='';const its=cart.items();
 $('cartEmpty').hidden=!!its.length;$('cartFoot').hidden=!its.length;
 its.forEach(it=>{const li=el_('li');const img=el_('img');img.src=it.model?thumbURL({id:it.pid||it.key,model:it.model,color:it.color,photo:it.photo}):iconURL(it.icon,it.color);img.alt='';
  const t=el_('div','ci-t');t.append(el_('b',null,it.name),el_('small',null,it.shop+' · '+floorName(it.floor)+(it.size?' · размер '+it.size:'')));
  const q=el_('div','ci-q');const mi=el_('button','icon-s','−'),n=el_('span',null,String(it.qty)),pl=el_('button','icon-s','+');mi.setAttribute('aria-label','Меньше');pl.setAttribute('aria-label','Больше');
  mi.onclick=()=>cart.setQty(it.key,it.qty-1);pl.onclick=()=>cart.setQty(it.key,it.qty+1);q.append(mi,n,pl);
  li.append(img,t,q,el_('span','ci-p',fmtPrice(it.price*it.qty)));ul.appendChild(li);});
 $('cartSum').textContent=fmtPrice(cart.total());}
function showOrderForm(){$('cartMain').hidden=true;$('orderForm').hidden=false;$('oSum').textContent=fmtPrice(cart.total())+' · '+cart.count()+' шт.';$('oErr').textContent='';setTimeout(()=>$('oName').focus(),30);}

// по порядку, при запуске
export function init() {

cart.on(()=>{updateCartBadge();if(!$('cartBox').hidden&&$('orderForm').hidden&&$('orderDone').hidden)renderCart();});
$('bCart').onclick=()=>openCart(false);
$('cartX').onclick=closeCart;$('cartBox').addEventListener('pointerdown',e=>{if(e.target.id==='cartBox')closeCart();});
$('cartGo').onclick=showOrderForm;$('cartClear').onclick=()=>cart.clear();
$('oBack').onclick=()=>{$('orderForm').hidden=true;$('cartMain').hidden=false;renderCart();};
[...document.querySelectorAll('input[name=oWay]')].forEach(r=>r.addEventListener('change',()=>{$('oAddrRow').hidden=document.querySelector('input[name=oWay]:checked').value!=='courier';}));
$('orderForm').addEventListener('submit',e=>{e.preventDefault();const name=$('oName').value.trim(),phone=$('oPhone').value.replace(/\D/g,''),way=document.querySelector('input[name=oWay]:checked').value,addr=$('oAddr').value.trim();
 if(!name){$('oErr').textContent='Напиши, как к тебе обращаться';return;}
 if(phone.length<10){$('oErr').textContent='Проверь номер телефона: нужно 10–11 цифр';return;}
 if(way==='courier'&&addr.length<5){$('oErr').textContent='Укажи адрес доставки';return;}
 const shops=[...new Set(cart.items().map(x=>x.shop))];const num=String(Math.floor(100000+Math.random()*899999));
 $('orderNum').textContent='Заказ №'+num;
 $('orderTxt').textContent=(way==='courier'?'Доставим по адресу: '+addr+'. ':'Заберёшь в магазин'+(shops.length>1?'ах':'е')+': '+shops.join(', ')+'. ')+'Сумма '+fmtPrice(cart.total())+'.';
 cart.clear();$('orderForm').hidden=true;$('orderDone').hidden=false;});
$('orderOk').onclick=()=>{closeCart();requestLockIfNeeded();};
updateCartBadge();
}

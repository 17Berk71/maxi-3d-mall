import './fonts.js';
import './style.css';
import data from './data/maxi-data.json';
import floor2 from './data/maxi-floor2.json';
import {startApp} from './app.js';

startApp(data, floor2);

// контакт для правообладателей: VITE_CONTACT в .env (почта или ссылка на Telegram); пусто — строка скрыта
{
  const c = (import.meta.env && import.meta.env.VITE_CONTACT || '').trim();
  const p = document.getElementById('contactP'), a = document.getElementById('contactA');
  if (c && p && a) { a.textContent = c.replace(/^mailto:/, '').replace(/^https?:\/\//, ''); a.href = /^(https?:|mailto:)/.test(c) ? c : (c.includes('@') ? 'mailto:' + c : '#'); p.hidden = false; }
}

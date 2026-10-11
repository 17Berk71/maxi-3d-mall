// Окно примерочной: сцена, гардероб, образы, размеры, анимация надевания, кнопки.

import {init as init_room_wardrobe} from './room-wardrobe.js';
import {init as init_room_scene} from './room-scene.js';
import {init as init_room_outfit} from './room-outfit.js';
import {init as init_room_panel} from './room-panel.js';
import {init as init_room_body_controls} from './room-body-controls.js';
import {init as init_room_open} from './room-open.js';
import {init as init_room_packs} from './room-packs.js';
import {init as init_room_api} from './room-api.js';

export let ctx;   // параметры createFitting: читаются модулями через import
export function createFitting(_ctx) {
  ctx = _ctx;
  init_room_wardrobe();
  init_room_scene();
  init_room_outfit();
  init_room_panel();
  init_room_body_controls();
  init_room_open();
  init_room_packs();
  return init_room_api();
}

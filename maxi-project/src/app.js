// Основное приложение: галерея ТРЦ, управление, магазины изнутри.
// Сам код — в модулях по папкам (core, render, nav, mall, controls, ui, shop; карта — docs/modules.md).
// Здесь только запуск: параметры (данные карты обоих этажей) и init() модулей строго по порядку —
// порядок важен: модуль может использовать то, что подготовили модули выше.

import {init as init_core_helpers} from './core/helpers.js';
import {init as init_mall_categories} from './mall/categories.js';
import {init as init_nav_walkgrid} from './nav/walkgrid.js';
import {init as init_mall_stores} from './mall/stores.js';
import {init as init_render_scene} from './render/scene.js';
import {init as init_render_merger} from './render/merger.js';
import {init as init_render_textures} from './render/textures.js';
import {init as init_render_sign_atlases} from './render/sign-atlases.js';
import {init as init_mall_world} from './mall/world.js';
import {init as init_mall_people_parts} from './mall/people-parts.js';
import {init as init_controls_player} from './controls/player.js';
import {init as init_controls_view} from './controls/view.js';
import {init as init_controls_move} from './controls/move.js';
import {init as init_controls_input} from './controls/input.js';
import {init as init_ui_pick} from './ui/pick.js';
import {init as init_ui_card} from './ui/card.js';
import {init as init_ui_go_here} from './ui/go-here.js';
import {init as init_ui_search} from './ui/search.js';
import {init as init_ui_settings_panel} from './ui/settings-panel.js';
import {init as init_ui_calm} from './ui/calm.js';
import {init as init_mall_lifts} from './mall/lifts.js';
import {init as init_ui_minimap} from './ui/minimap.js';
import {init as init_ui_bigmap} from './ui/bigmap.js';
import {init as init_core_loop} from './core/loop.js';
import {init as init_mall_people} from './mall/people.js';
import {init as init_render_resize} from './render/resize.js';
import {init as init_shop_goods} from './shop/goods.js';
import {init as init_shop_hall} from './shop/hall.js';
import {init as init_shop_fitting_booth} from './shop/fitting-booth.js';
import {init as init_shop_hall_decor} from './shop/hall-decor.js';
import {init as init_shop_enter_exit} from './shop/enter-exit.js';
import {init as init_shop_hall_pick} from './shop/hall-pick.js';
import {init as init_shop_panel} from './shop/panel.js';
import {init as init_shop_product} from './shop/product.js';
import {init as init_shop_cart_ui} from './shop/cart-ui.js';
import {init as init_render_style_apply} from './render/style-apply.js';
import {init as init_core_debug} from './core/debug.js';
import {init as init_core_launch} from './core/launch.js';

export let D, D2;   // параметры startApp: читаются модулями через import
export function startApp(_D, _D2) {
  D = _D;
  D2 = _D2;
  init_core_helpers();
  init_mall_categories();
  init_nav_walkgrid();
  init_mall_stores();
  init_render_scene();
  init_render_merger();
  init_render_textures();
  init_render_sign_atlases();
  init_mall_world();
  init_mall_people_parts();
  init_controls_player();
  init_controls_view();
  init_controls_move();
  init_controls_input();
  init_ui_pick();
  init_ui_card();
  init_ui_go_here();
  init_ui_search();
  init_ui_settings_panel();
  init_ui_calm();
  init_mall_lifts();
  init_ui_minimap();
  init_ui_bigmap();
  init_core_loop();
  init_mall_people();
  init_render_resize();
  init_shop_goods();
  init_shop_hall();
  init_shop_fitting_booth();
  init_shop_hall_decor();
  init_shop_enter_exit();
  init_shop_hall_pick();
  init_shop_panel();
  init_shop_product();
  init_shop_cart_ui();
  init_render_style_apply();
  init_core_debug();
  init_core_launch();
}

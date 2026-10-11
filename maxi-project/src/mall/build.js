// Сборка всей галереи: пол, витрины и интерьеры, двери, второй этаж, крыша, ограждения, колонны,
// светильники, фасад, эскалаторы, островки, лифты, кадки и лавочки, посетители, колесо обозрения.

import {init as init_build_floor} from './build/floor.js';
import {init as init_build_open_islands} from './build/open-islands.js';
import {init as init_build_doors} from './build/doors.js';
import {init as init_build_floor2_slab} from './build/floor2-slab.js';
import {init as init_build_skylight} from './build/skylight.js';
import {init as init_build_railings} from './build/railings.js';
import {init as init_build_columns} from './build/columns.js';
import {init as init_build_lights} from './build/lights.js';
import {init as init_build_facade} from './build/facade.js';
import {init as init_build_escalators} from './build/escalators.js';
import {init as init_build_kiosks} from './build/kiosks.js';
import {init as init_build_lifts} from './build/lifts.js';
import {init as init_build_plants} from './build/plants.js';
import {init as init_build_people} from './build/people.js';
import {init as init_build_wheel} from './build/wheel.js';

export function build() {
  init_build_floor();
  init_build_open_islands();
  init_build_doors();
  init_build_floor2_slab();
  init_build_skylight();
  init_build_railings();
  init_build_columns();
  init_build_lights();
  init_build_facade();
  init_build_escalators();
  init_build_kiosks();
  init_build_lifts();
  init_build_plants();
  init_build_people();
  init_build_wheel();
}

import * as migration_20260912_083459_initial from './20260912_083459_initial';
import * as migration_20260915_065021_redesign_cms from './20260915_065021_redesign_cms';

export const migrations = [
  {
    up: migration_20260912_083459_initial.up,
    down: migration_20260912_083459_initial.down,
    name: '20260912_083459_initial',
  },
  {
    up: migration_20260915_065021_redesign_cms.up,
    down: migration_20260915_065021_redesign_cms.down,
    name: '20260915_065021_redesign_cms'
  },
];

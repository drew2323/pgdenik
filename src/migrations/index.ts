import * as migration_20260912_083459_initial from './20260912_083459_initial';

export const migrations = [
  {
    up: migration_20260912_083459_initial.up,
    down: migration_20260912_083459_initial.down,
    name: '20260912_083459_initial'
  },
];

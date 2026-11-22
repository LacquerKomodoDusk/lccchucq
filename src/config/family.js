// ============================================================================
//  ВНЕШНОСТЬ ПЕРСОНАЖЕЙ — единое место для настройки.
//
//  Основано на концепт-листе персонажей, присланном автором:
//  герой, жена (обычный и кошмарный облик), старший и младший сын.
//  Отдельные пункты, помеченные «УТОЧНИТЬ», стоит сверить с фотографиями.
// ============================================================================

// Главный герой: русо-каштановые объёмные волосы, густая борода и усы.
export const HERO_BASE = {
  name: 'hero',
  height: 1.8,                 // УТОЧНИТЬ: рост
  skin: '#d4a684', skinDark: '#b2876a',
  hair: '#7f5a38',
  hairStyle: 'volume',
  brow: '#5a3f28', thickBrows: true,
  eye: '#3d3a32',
  lip: '#8e5646',
  beard: '#6f4d30', beardDark: '#523822',
  shoulders: 0.42,
  top: '#2c3650', pants: '#30333a', shoes: '#5a3a24',
};

// Жена: длинные тёмные волосы, кольцо в носу (по концепту — по центру).
export const WIFE_BASE = {
  name: 'wife',
  height: 1.66,                // УТОЧНИТЬ: рост
  skin: '#dcb39a', skinDark: '#c0967e',
  hair: '#2a1c17',
  hairStyle: 'long', hairLength: 0.62,
  brow: '#2a1d18', eye: '#3b2a20',
  lip: '#a85a58', lashes: true,
  noseRing: 'septum',
  shoulders: 0.36,
  top: '#5a2a2e', pants: '#2a2a30', shoes: '#5a3a24',
};

// Наряды по воспоминаниям (меняется только одежда, не внешность).
export const OUTFITS = {
  hero: {
    trench: { buttons: '#5a4630', coat: '#b59e78', longCoat: true, coatLength: 0.55, belt: '#8e7a58', backpack: '#5a6070', top: '#2c3650' }, // автобус: бежевый тренч + серый рюкзак
    everyday: { top: '#4a4458', pants: '#30333a', topKind: 'sweater' },     // повседневная жизнь: свитер
    home: { top: '#9aa3b0', pants: '#33363e', topKind: 'tshirt' },         // дома: светлая футболка
    tired: { coat: '#3f3d33', longCoat: false, scarf: '#c8b89a', top: '#2a2a2e' }, // поздний период: куртка с воротником
    work: { top: '#4a4458', pants: '#30333a' },
    rain: { coat: '#3f3d33', longCoat: true, coatLength: 0.35, scarf: '#c8b89a', top: '#2a2a2e' },
  },
  wife: {
    busCoat: { buttons: '#5a5a5e', coat: '#1c1a1d', longCoat: true, coatLength: 0.62, belt: '#121012', hat: 'beanie', hatColor: '#b3382c' }, // чёрное пальто + красная шапка
    date: { coat: '#1c1a1d', longCoat: true, coatLength: 0.55, belt: '#121012' },
    home: { top: '#5a2a2e', pants: '#2a2a30' },
    summer: { top: '#8a5a5a', pants: '#3a3a44' },
    rain: { buttons: '#5a5a5e', coat: '#1c1a1d', longCoat: true, coatLength: 0.62, belt: '#121012', hat: 'beanie', hatColor: '#b3382c' },
  },
};

// ДЕТИ — по концепт-листу.
export const CHILDREN = [
  {
    name: 'son-older', label: 'Старший сын', height: 1.22, // около 6–8 лет
    skin: '#d8b399', skinDark: '#bf9a80', hair: '#7f5a38', hairStyle: 'volume',
    brow: '#5a3f28', eye: '#3b3a34', lip: '#a06a5c', shoulders: 0.3, headScale: 1.3,
    top: '#3a3a3a', pants: '#4a5a78', shoes: '#5a3a24',
    coat: '#c9962e', longCoat: false, backpack: '#56606e', // горчичная куртка с капюшоном, рюкзак
  },
  {
    name: 'son-younger', label: 'Младший сын', height: 1.04, // около 4–5 лет
    skin: '#dbb69c', skinDark: '#c09a80', hair: '#7f5a38', hairStyle: 'short',
    brow: '#5a3f28', eye: '#3b3a34', lip: '#a06a5c', shoulders: 0.28, headScale: 1.35,
    top: '#3a3a3a', pants: '#4a5a78', shoes: '#5a3a24',
    coat: '#4a5a78', longCoat: false, scarf: '#d8c8a8', // джинсовая куртка с меховым воротником
    hat: 'beanie', hatColor: '#2e3a55',
  },
];

export function heroSpec(outfit = 'everyday', extra = {}) {
  return { ...HERO_BASE, ...(OUTFITS.hero[outfit] || {}), ...extra };
}
export function wifeSpec(outfit = 'home', extra = {}) {
  return { ...WIFE_BASE, ...(OUTFITS.wife[outfit] || {}), ...extra };
}

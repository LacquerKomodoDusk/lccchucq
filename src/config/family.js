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
  hair: '#8a6440',
  hairStyle: 'curly', curlCount: 46, curlSize: 0.82,
  faceSet: 'hero', // лица — прямо с листа персонажей (src/assets/faces)
  brow: '#5a3f28', thickBrows: true,
  eye: '#3d3a32',
  lip: '#8e5646',
  beard: '#6f4d30', beardDark: '#523822',
  shoulders: 0.42,
  top: '#2a3552', pants: '#3a4660', jeans: true, pantsTex: 'hero_jeans', shoes: '#6a4528',
};

// Жена: длинные тёмные волосы, кольцо в носу (по концепту — по центру).
export const WIFE_BASE = {
  name: 'wife',
  height: 1.66,                // УТОЧНИТЬ: рост
  skin: '#dcb39a', skinDark: '#c0967e',
  hair: '#4a2e22',
  hairStyle: 'long', hairLength: 0.62, hairWavy: true, hairTex: 'wife_hair',
  faceSet: 'wife',
  brow: '#2a1d18', eye: '#3b2a20',
  lip: '#a85a58', lashes: true,
  noseRing: 'septum',
  shoulders: 0.36,
  top: '#5a2a2e', pants: '#2a2a30', shoes: '#5a3a24',
};

// Наряды по воспоминаниям (меняется только одежда, не внешность).
export const OUTFITS = {
  hero: {
    trench: { buttons: '#5a4630', coatTex: 'hero_coat', topTex: 'hero_shirt', pantsTex: 'hero_jeans', coatPattern: 'check', checkLine: '#8a7454', coat: '#b8a47e', longCoat: true, coatLength: 0.55, belt: '#8e7a58', backpack: '#5a6070', top: '#2c3650' }, // автобус: бежевый тренч + серый рюкзак
    everyday: { top: '#4a4458', pants: '#30333a', topKind: 'sweater' },     // повседневная жизнь: свитер
    home: { top: '#9aa3b0', pants: '#33363e', topKind: 'tshirt' },         // дома: светлая футболка
    tired: { coat: '#3f3d33', longCoat: false, scarf: '#c8b89a', top: '#2a2a2e' }, // поздний период: куртка с воротником
    work: { top: '#4a4458', pants: '#30333a' },
    rain: { coat: '#3f3d33', longCoat: true, coatLength: 0.35, scarf: '#c8b89a', top: '#2a2a2e' },
  },
  wife: {
    busCoat: { buttons: '#5a5a5e', coat: '#1c1a1d', longCoat: true, coatLength: 0.62, belt: '#121012', hat: 'beanie', hatColor: '#b3382c' }, // чёрное пальто + красная шапка
    date: { top: '#8a2e2a', topKind: 'knit', topTex: 'wife_sweater', skirtTex: 'wife_skirt', skirt: '#3e4f78', skirtLength: 0.52, pants: '#2a2a30', scarf: '#7a2420', hat: 'beanie', hatColor: '#9a2e28', hatTex: 'wife_hat' },
    home: { top: '#8a2e2a', topKind: 'knit', topTex: 'wife_sweater', skirtTex: 'wife_skirt', skirt: '#3e4f78', skirtLength: 0.52, pants: '#2a2a30' },
    // the look from the character sheet: red knitted sweater, blue skirt, red beanie & scarf
    summer: { top: '#8a2e2a', topKind: 'knit', topTex: 'wife_sweater', skirtTex: 'wife_skirt', skirt: '#3e4f78', skirtLength: 0.52, pants: '#2a2a30', scarf: '#7a2420', hat: 'beanie', hatColor: '#9a2e28', hatTex: 'wife_hat' },
    rain: { buttons: '#5a5a5e', coat: '#1c1a1d', longCoat: true, coatLength: 0.62, belt: '#121012', hat: 'beanie', hatColor: '#b3382c' },
  },
};

// ДЕТИ — по концепт-листу.
export const CHILDREN = [
  {
    name: 'son-older', label: 'Старший сын', height: 1.22, faceSet: 'kid1', // около 6–8 лет
    skin: '#dcb59a', skinDark: '#c09a80', hair: '#7a5232', hairStyle: 'curly', curlCount: 24, curlSize: 0.9, hairSeed: 5,
    brow: '#5a3f28', eye: '#3b3a34', lip: '#a06a5c', shoulders: 0.3, headScale: 1.3,
    top: '#2e3e66', topKind: 'stripes', stripe: '#7a8aa8', // синий свитер в полоску
    pants: '#3a4a6a', jeans: true, shoes: '#6a4528',
  },
  {
    name: 'son-younger', label: 'Младший сын', height: 1.04, faceSet: 'kid2', // около 4–5 лет
    skin: '#e0b89c', skinDark: '#c49c82', hair: '#9a5a32', hairStyle: 'curly', curlCount: 22, curlSize: 0.85, hairSeed: 9, // рыжеватые кудри
    brow: '#7a4a2a', eye: '#3b3a34', lip: '#a86a5c', shoulders: 0.28, headScale: 1.35,
    top: '#7a7e88', topKind: 'stripes', stripe: '#c8ccd0', // серый свитер в полоску
    pants: '#3a4660', jeans: true, shoes: '#6a4528',
  },
];

export function heroSpec(outfit = 'everyday', extra = {}) {
  return { ...HERO_BASE, ...(OUTFITS.hero[outfit] || {}), ...extra };
}
export function wifeSpec(outfit = 'home', extra = {}) {
  return { ...WIFE_BASE, ...(OUTFITS.wife[outfit] || {}), ...extra };
}

// До рождения первого ребёнка герой без бороды.
export const YOUNG = { beard: null, beardDark: null, faceSet: 'heroYoung' };

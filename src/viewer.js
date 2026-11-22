// Debug model lineup: open the game with ?viewer to inspect all characters.
import * as THREE from 'three';
import * as B from './world/build.js';
import { heroSpec, wifeSpec, CHILDREN } from './config/family.js';
import { NightmareFigure } from './engine/character.js';
import { WIFE_BASE } from './config/family.js';

export function showViewer(g, { close = false } = {}) {
  g.newScene({ bg: 0x24222e, fog: null, hemi: [0xc8c4d8, 0x3a3440, 1.2], sun: [0xffffff, 0.7, [2, 5, 6]] });
  B.plane(g, 30, 30, B.M({ color: '#2e2c38' }), 0, 0, 0);
  const list = [
    heroSpec('trench'), heroSpec('everyday'), heroSpec('home'), heroSpec('tired'),
    wifeSpec('busCoat'), wifeSpec('summer'), ...CHILDREN,
  ];
  list.forEach((s, i) => { const c = g.spawn(s, [-6 + i * 1.3, 0, 0], 0); c.state = 'idle'; });
  const f = new NightmareFigure(WIFE_BASE); f.root.position.set(-6 + list.length * 1.3 + 0.3, 0, 0); g.add(f.root); g.addActor(f);
  const params = new URLSearchParams(location.search);
  const focus = parseFloat(params.get('x') ?? 'NaN');
  if (!Number.isNaN(focus)) g.camSet([focus, 1.55, 0.75], [focus, 1.5, 0]);
  else g.camSet([0, 1.4, close ? 4 : 9], [0, 1.0, 0]);
  g.setFade(0);
}

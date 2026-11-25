// Control renders of a head GLB (spec: front.png, side.png, three_quarter.png),
// an expressions row and frames of the bus head-turn.
// usage: node tools/characters/head_previews.cjs <char> <outDir> [baseUrl]
const { chromium } = require('playwright');
const path = require('path');
const [,, char = 'hero', outDir = '.', base = 'http://localhost:4173'] = process.argv;
const EXPR = ['neutral', 'surprise', 'anxiety', 'tired', 'sad', 'joy'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto(`${base}/heads.html?char=${char}`);
  await p.waitForFunction(() => window.__viewerReady, null, { timeout: 30000 });
  await p.addStyleTag({ content: 'aside{display:none!important} #app{grid-template-columns:1fr!important} #stats{display:none}' });
  await p.evaluate(() => window.dispatchEvent(new Event('resize')));
  await p.evaluate(() => { window.__viewer.playClip('idle'); window.__viewer.mixer.setTime(0); window.__viewer.playing = false; });
  const shot = (file) => p.screenshot({ path: path.join(outDir, file) });
  for (const v of ['front', 'side', 'three_quarter']) {
    await p.evaluate((v) => window.__viewer.setView(v), v);
    await p.waitForTimeout(400);
    await shot(`${v}.png`);
  }
  await p.evaluate(() => window.__viewer.setView('three_quarter'));
  for (const e of EXPR) {
    await p.evaluate((e) => window.__setFace(e), e);
    await p.waitForTimeout(700);
    await shot(`expr_${e}.png`);
  }
  await p.evaluate(() => window.__setFace('neutral'));
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__viewer.setView('front'));
  for (let i = 0; i < 6; i++) {
    await p.evaluate((i) => {
      const acts = window.__viewer.actions;
      const a = acts.head_turn_bus || acts.glance_away || acts.look_around;
      Object.values(acts).forEach((x) => x.stop());
      a.reset().play();
      const dur = a.getClip().duration;
      window.__viewer.mixer.setTime(acts.head_turn_bus ? [0, 0.05, 0.12, 0.8, 1.9, 2.4][i] : (dur * i) / 6);
    }, i);
    await p.waitForTimeout(150);
    await shot(`turn_${i}.png`);
  }
  await b.close();
})();

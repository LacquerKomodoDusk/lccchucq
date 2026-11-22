// Renders front / side / back previews and animation contact sheets of a
// character from the browser viewer (real 3D render of the exported GLB).
// usage: node tools/characters/previews.cjs <char> <outDir> [baseUrl]
const { chromium } = require('playwright');
const path = require('path');
const [,, char = 'hero', outDir = '.', base = 'http://localhost:4173', animView = 'front', only = ''] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto(`${base}/models.html?char=${char}`);
  await p.waitForFunction(() => window.__viewerReady, null, { timeout: 30000 });
  await p.addStyleTag({ content: 'aside{display:none!important} #app{grid-template-columns:1fr!important} #stats{display:none}' });
  await p.evaluate(() => window.dispatchEvent(new Event('resize')));
  await p.evaluate(() => { window.__viewer.playClip('idle'); window.__viewer.playing = false; });
  for (const v of ['front', 'side', 'back']) {
    await p.evaluate((v) => window.__viewer.setView(v), v);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(outDir, `${char}_${v}.png`) });
  }
  // animation sheets: 6 moments of each clip, 3/4 view
  const clips = await p.evaluate(() => Object.keys(window.__viewer.actions));
  await p.evaluate((v) => window.__viewer.setView(v), animView);
  await p.evaluate(() => { const c = document.querySelector('canvas'); });
  for (const clip of clips.filter((c) => !only || only.split(',').includes(c))) {
    for (let i = 0; i < 6; i++) {
      await p.evaluate(({ clip, i }) => {
        const a = window.__viewer.actions[clip];
        Object.values(window.__viewer.actions).forEach((x) => x.stop());
        a.reset().play(); a.paused = false;
        window.__viewer.mixer.setTime((a.getClip().duration * i) / 6);
      }, { clip, i });
      await p.waitForTimeout(120);
      await p.screenshot({ path: path.join(outDir, `anim_${animView}_${clip}_${i}.png`), clip: { x: 150, y: 60, width: 600, height: 800 } });
    }
  }
  console.log('clips', clips.join(','));
  await b.close();
})();

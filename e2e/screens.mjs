/**
 * Compare two sets of screenshots (e2e/run.mjs --screens … --compare …): the
 * share of pixels that changed per screen, worked out in the browser itself
 * (no image libraries needed). Anything over the threshold is listed, so a
 * change shows up only where it was meant to.
 */
import fs from "node:fs";
import path from "node:path";

export async function compareScreens(B, before, now, { threshold = 0.005 } = {}) {
  const changed = [];
  const page = await B.player();
  console.log(`\nScreens against ${path.relative(process.cwd(), before)}`);
  for (const file of fs.readdirSync(now).filter((f) => f.endsWith(".png")).sort()) {
    const old = path.join(before, file);
    if (!fs.existsSync(old)) { console.log(`  new   ${file}`); continue; }
    const share = await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height) return 1;
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const d1 = px(x), d2 = px(y);
      let n = 0;
      for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) > 48) n++;
      return n / (d1.length / 4);
    }, [`data:image/png;base64,${fs.readFileSync(old).toString("base64")}`, `data:image/png;base64,${fs.readFileSync(path.join(now, file)).toString("base64")}`]);
    const pct = `${(share * 100).toFixed(2)}%`;
    if (share > threshold) { console.log(`  diff  ${file} (${pct})`); changed.push(`screen changed: ${file} (${pct})`); }
    else console.log(`  same  ${file}`);
  }
  await page.close2();
  return changed;
}

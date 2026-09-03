import fs from 'fs';
import path from 'path';

const clipsDir = 'design/media/clips';
const files = fs.readdirSync(clipsDir);
const webms = files.filter(f => f.startsWith('page@') && f.endsWith('.webm'));

const mapping = {
  'full_reversibility': webms[0],
  'hero_scroll_burst': webms[1],
  'manifesto_reveal': webms[2],
  'dots_hover_desktop': webms[3],
};

for (const [name, filename] of Object.entries(mapping)) {
  if (filename) {
    const src = path.join(clipsDir, filename);
    const dst = path.join(clipsDir, `${name}.webm`);
    fs.renameSync(src, dst);
    console.log(`Renamed ${filename} → ${name}.webm`);
  }
}

console.log('All clips renamed');

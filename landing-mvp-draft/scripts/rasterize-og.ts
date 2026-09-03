/**
 * Rasterizes public/og.svg → public/og.png with fonts embedded.
 *
 * System librsvg has no access to Google Fonts, so we download the TTFs
 * and inject them as base64 @font-face rules before rasterizing via sharp.
 *
 * Usage: bun run scripts/rasterize-og.ts
 */
import sharp from "sharp";

const FONT_URLS = {
  "jbmono-400":
    "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf",
  "jbmono-500":
    "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-qxjPQ.ttf",
  "grotesk-500":
    "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUsj.ttf",
  "grotesk-700":
    "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf",
};

async function getFont(name: keyof typeof FONT_URLS): Promise<ArrayBuffer> {
  try {
    return await Bun.file(`/tmp/rheo-fonts/${name}.ttf`).arrayBuffer();
  } catch {
    const res = await fetch(FONT_URLS[name]);
    if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
    return await res.arrayBuffer();
  }
}

async function main() {
  const svgOriginal = await Bun.file("public/og.svg").text();

  const [jb400, jb500, g500, g700] = await Promise.all(
    (Object.keys(FONT_URLS) as (keyof typeof FONT_URLS)[]).map(getFont)
  );

  const b64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");

  const fontCSS = `
    @font-face { font-family:'JetBrains Mono'; font-weight:400; src:url(data:font/truetype;base64,${b64(jb400)}) format('truetype'); }
    @font-face { font-family:'JetBrains Mono'; font-weight:500; src:url(data:font/truetype;base64,${b64(jb500)}) format('truetype'); }
    @font-face { font-family:'Space Grotesk'; font-weight:500; src:url(data:font/truetype;base64,${b64(g500)}) format('truetype'); }
    @font-face { font-family:'Space Grotesk'; font-weight:700; src:url(data:font/truetype;base64,${b64(g700)}) format('truetype'); }
  `;

  const withFonts = svgOriginal.replace(
    "<defs>",
    `<defs><style>${fontCSS}</style>`
  );

  await sharp(Buffer.from(withFonts))
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile("public/og.png");

  console.log("✓ public/og.png written (1200×630, fonts embedded)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

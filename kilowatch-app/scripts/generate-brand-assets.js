/**
 * Build Kilowatch branding assets:
 * - notification-icon.png  (white mark, Android notif small icon)
 * - icon.png / adaptive-icon.png / splash-icon.png / favicon.png from kilowatch_logo.png + mark
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets");
const LOGO = path.join(ASSETS, "kilowatch_logo.png");

const MARK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 28 29" fill="none">
  <g transform="translate(0,0)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M9.60022 0.365234C8.02074 0.365234 6.50601 0.999229 5.38917 2.12775L0 7.57321V10.0658C0 11.8268 0.748608 13.4111 1.94181 14.5116C0.748608 15.612 0 17.1963 0 18.9573V21.4499L5.38917 26.8954C6.50601 28.0239 8.02074 28.6579 9.60022 28.6579C11.343 28.6579 12.9109 27.9015 14 26.6958C15.0891 27.9015 16.657 28.6579 18.3998 28.6579C19.9793 28.6579 21.494 28.0239 22.6108 26.8954L28 21.4499V18.9573C28 17.1963 27.2514 15.612 26.0582 14.5116C27.2514 13.4111 28 11.8268 28 10.0658V7.57321L22.6108 2.12775C21.494 0.999229 19.9793 0.365234 18.3998 0.365234C16.657 0.365234 15.0891 1.12167 14 2.32734C12.9109 1.12167 11.343 0.365234 9.60022 0.365234ZM18.0312 14.5116C17.964 14.4497 17.8982 14.3861 17.8336 14.3209L14 10.4472L10.1664 14.3209C10.1018 14.3861 10.036 14.4497 9.96884 14.5116C10.036 14.5735 10.1018 14.637 10.1664 14.7023L14 18.576L17.8336 14.7023C17.8982 14.637 17.964 14.5735 18.0312 14.5116ZM15.5555 21.4499V22.6403C15.5555 24.2276 16.829 25.5143 18.3998 25.5143C19.1541 25.5143 19.8776 25.2115 20.4109 24.6725L24.8889 20.1478V18.9573C24.8889 17.3701 23.6155 16.0834 22.0447 16.0834C21.2904 16.0834 20.5669 16.3862 20.0335 16.9251L15.5555 21.4499ZM12.4445 21.4499L7.96649 16.9251C7.43309 16.3862 6.70967 16.0834 5.95533 16.0834C4.38451 16.0834 3.11111 17.3701 3.11111 18.9573V20.1478L7.58905 24.6725C8.12245 25.2115 8.8459 25.5143 9.60022 25.5143C11.171 25.5143 12.4445 24.2276 12.4445 22.6403V21.4499ZM12.4445 6.38282V7.57321L7.96649 12.098C7.43309 12.637 6.70967 12.9398 5.95533 12.9398C4.38451 12.9398 3.11111 11.653 3.11111 10.0658V8.87538L7.58905 4.35062C8.12245 3.81166 8.8459 3.50887 9.60022 3.50887C11.171 3.50887 12.4445 4.79558 12.4445 6.38282ZM20.0335 12.098L15.5555 7.57321V6.38282C15.5555 4.79558 16.829 3.50887 18.3998 3.50887C19.1541 3.50887 19.8776 3.81166 20.4109 4.35062L24.8889 8.87538V10.0658C24.8889 11.653 23.6155 12.9398 22.0447 12.9398C21.2904 12.9398 20.5669 12.637 20.0335 12.098Z" fill="__FILL__"/>
  </g>
</svg>`;

async function renderMark(fill, size, outPath, { pad = 0.14, bg = null } = {}) {
  const svg = MARK_SVG.replace("__FILL__", fill);
  const markSize = Math.round(size * (1 - pad * 2));
  const mark = await sharp(Buffer.from(svg))
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const base =
    bg == null
      ? {
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        }
      : {
          create: {
            width: size,
            height: size,
            channels: 4,
            background: bg,
          },
        };

  const left = Math.round((size - markSize) / 2);
  const top = Math.round((size - markSize) / 2);
  await sharp(base)
    .composite([{ input: mark, left, top }])
    .png()
    .toFile(outPath);
  console.log("wrote", path.relative(ROOT, outPath));
}

async function renderLogoOnCanvas(size, outPath, {
  bg = { r: 0, g: 0, b: 0, alpha: 1 },
  maxWidthRatio = 0.78,
} = {}) {
  const logo = sharp(LOGO).ensureAlpha();
  const meta = await logo.metadata();
  const targetW = Math.round(size * maxWidthRatio);
  const scale = targetW / meta.width;
  const targetH = Math.round(meta.height * scale);

  const resized = await logo
    .resize(targetW, targetH, { fit: "contain" })
    .png()
    .toBuffer();

  const left = Math.round((size - targetW) / 2);
  const top = Math.round((size - targetH) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outPath);
  console.log("wrote", path.relative(ROOT, outPath));
}

async function main() {
  if (!fs.existsSync(LOGO)) {
    throw new Error(`Missing ${LOGO}`);
  }

  // Save source SVG for reference
  fs.writeFileSync(
    path.join(ASSETS, "kilowatch_mark.svg"),
    MARK_SVG.replace("__FILL__", "#FE6023")
  );

  // Android notification small icon MUST be white alpha silhouette
  await renderMark("#FFFFFF", 96, path.join(ASSETS, "notification-icon.png"), {
    pad: 0.08,
    bg: null,
  });

  // Colored mark for adaptive foreground (safe padding for mask)
  await renderMark("#FE6023", 1024, path.join(ASSETS, "adaptive-icon.png"), {
    pad: 0.22,
    bg: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  // App store / launcher icon: wordmark on black
  await renderLogoOnCanvas(1024, path.join(ASSETS, "icon.png"), {
    bg: { r: 0, g: 0, b: 0, alpha: 1 },
    maxWidthRatio: 0.82,
  });

  // Splash: same branding, black background
  await renderLogoOnCanvas(1242, path.join(ASSETS, "splash-icon.png"), {
    bg: { r: 0, g: 0, b: 0, alpha: 1 },
    maxWidthRatio: 0.7,
  });

  // Favicon
  await renderMark("#FE6023", 48, path.join(ASSETS, "favicon.png"), {
    pad: 0.1,
    bg: { r: 0, g: 0, b: 0, alpha: 1 },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

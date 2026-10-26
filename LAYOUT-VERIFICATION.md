# Header, palette and width checks

- Restored the original header markup, including the grass-block logo and existing navigation/DM actions.
- Computed colors match the original palette: body text rgb(170,177,201), Vaskel title rgb(200,67,42), and primary buttons rgb(143,209,79).
- Content wrappers match viewport width at 320, 390, 768, 1024 and 1920 pixels. Edge gutters are 16–32 pixels, with no horizontal overflow. All five camp object controls stay visible.
- The header stays 67 pixels high; the desktop camp uses the remaining viewport height. Section anchors account for the sticky header.
- Opened the restored header DM dialog, dismissed it with Escape, and opened the camp chest.
- Byte-compared scene.js, audio.js, assets.js and portfolio.js with the preceding camp build: unchanged. Existing interaction/offline/graphics verification remains applicable.
- Captured desktop introduction, full-width store and mobile previews. No page exceptions.

# Vaskel — The Lantern Camp · Classic Header

Extract the whole folder and open index.html in Chrome or Edge. Viewing needs no installation, server or network connection: the camp ships as one prebuilt script, camp/scene.bundle.js, with every texture inlined.

This is an original nighttime camp and menu for Vaskel's portfolio, styled after the Minecraft Dungeons camp menu. Vaskel's supplied 64×64 skin sits on a slim-arm Minecraft model with rigid, unjointed limbs like the game's own, leaning back on a fallen oak log beside a vanilla campfire. The campfire is built from Minecraft's own block model (template_campfire.json) with its animated lit-log and fire textures, and the chest is the vanilla single-chest entity model with its hinged lid. The camp is a clearing on a wooded hilltop, terraformed like a builder's showcase and generated live in 3D: blended block palettes (dirt path, coarse dirt, moss, podzol, rooted dirt and a stone/andesite/tuff mix), custom branching oaks with root flares, layered spruces, birches, dark oaks and flowering azaleas crowding its sides, a forested valley of treetops falling away behind it into the haze, mossy boulders and fallen logs, a firewood stack and barrel, pink-petal beds, ferns, mushrooms and clumped flowers, a trail of lanterns into the woods, and Minecraft's own cloud layer drifting under the moon.

## Restored header and full-width layout

The original grass-block logo, sticky navigation (Work, Store, How to buy, Contact and DM me), navy panels, red Vaskel title, white/lavender text and green accents are restored. Content wrappers use the full viewport width with responsive 16–32 pixel edge gutters.

## Explore the camp

- Click Vaskel to wave; he turns his shoulders and head toward wherever the camera is looking. Drag him to turn him.
- Drag empty space to look around. Reset view restores the camera and character turn.
- Click the campfire for a burst of sparks and a brief stronger flame.
- Open the chest to preview the Wushu Weapons Pack and follow its link to the existing store card.
- Sound plays Minecraft's own sound effects: campfire crackles as ambience, the XP-orb ding when Vaskel waves, the fire-charge whoosh when the fire is stoked, chest open and close, and the button click when sound is switched on. It starts muted and requires a gesture. No music is included.
- Pause freezes ambient animation; direct interactions still respond. The site follows reduced-motion preferences. Rendering and audio stop after the camp leaves the viewport or the tab is hidden.

Camp guide lists the keyboard alternatives: W / Enter / Space wave, F fire, O chest, arrow keys look and R reset. All three objects also have real focusable buttons. Mouse, pointer capture and touch dragging use the same scene coordinates.

## Animation, lighting and post-processing

Vaskel idles like a hero in the Dungeons camp menu: he leans back on his hands with his legs stretched toward the fire, breathes, tilts his head, glances around every few seconds and idly rocks his heels. The vanilla campfire animates its fire and glowing logs at the game's own frame rates; Minecraft's clouds drift slowly overhead, and cubic embers, fireflies among the trees, twinkling stars and swaying grass and flowers loop while motion is enabled.

The scene is rendered with React Three Fiber. Lighting is a cool blue moonlight DirectionalLight (the key light, with soft shadows), a warm orange PointLight inside the campfire that flickers and casts shadows, and a low AmbientLight so the shadow side stays dark. A @react-three/postprocessing EffectComposer then applies N8AO ambient occlusion for deep contact shadows, DepthOfField focused on Vaskel, Bloom on the fire, embers, lanterns and moon, a blue-shadow / amber-highlight split-tone grade, a Vignette, and ACES filmic ToneMapping. The grade does the colour work instead of ColorAverage, which would pull the image toward grey and flatten the blue-versus-orange contrast. Textures use nearest-neighbour sampling, static boxes and undergrowth are instanced, and the canvas renders at a capped device pixel ratio.

camp/fallback.png is an actual render of this scene, used when WebGL 2 is unavailable.

## Editing the camp

The source lives in camp/src (React Three Fiber, plain JavaScript/JSX):

- main.jsx — boot, textures, and the HTML controls (hotspots, sound, pause, reset, keyboard, dragging)
- audio.js — the Minecraft sound cues and campfire ambience
- App.jsx — scene graph, camera framing and the frame clock
- effects.jsx — the lighting rig and the post-processing stack
- props.jsx — campfire, chest, log seat, Vaskel's rig and idle animation, embers, fireflies
- world.js — terrain and block palettes, builder trees and the forest, boulders, fallen logs, undergrowth, clouds and sky (tree and prop placement is near the middle of buildWorld)
- minecraft.js — block-model, entity-cube and skin helpers

After editing, rebuild the bundle with Node.js installed:

```
npm install
npm run build
```

`npm run watch` rebuilds on every save. The node_modules folder is only needed for building; leave it out when sharing the site. Edit portfolio.js for catalogue/contact data, camp/camp.css for the menu, and camp/src/audio.js for which Minecraft sounds play, and how loud.

The portfolio, six pack entries, prices, buying instructions, social handles, render viewer and commission draft remain available below the menu.

The project is local and has not been published. Mobile checks use browser emulation; physical-device frame rate has not been benchmarked. See VERIFICATION.md for the checks performed on the earlier version.

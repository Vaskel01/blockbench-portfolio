# Texture sources

Minecraft Java Edition 1.21.1 textures, © Mojang Studios / Microsoft, extracted from the official client archive. Included PNGs are unchanged source files. The runtime tints grayscale grass, foliage and water with the vanilla plains and default water colours; the camp layout, terrain generation, animation, sky, audio and interface are original code.

- Version manifest: https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
- Official client: https://piston-data.mojang.com/v1/objects/30c73b1c5da787909b2f73340419fdf13b9def88/client.jar
- Verified archive SHA-1: 30c73b1c5da787909b2f73340419fdf13b9def88
- Block textures (block/, from assets/minecraft/textures/block/): grass_block_top, grass_block_side, grass_block_side_overlay, dirt, coarse_dirt, dirt_path_top, rooted_dirt, podzol_top, podzol_side, moss_block, mud, packed_mud, sand, gravel, stone, andesite, tuff, cobblestone, mossy_cobblestone, mossy_stone_bricks, oak_planks, spruce_planks, oak_log, oak_log_top, stripped_oak_log, stripped_oak_log_top, spruce_log, spruce_log_top, dark_oak_log, dark_oak_log_top, birch_log, birch_log_top, oak_leaves, dark_oak_leaves, birch_leaves, spruce_leaves, azalea_leaves, flowering_azalea_leaves, vine, short_grass, fern, tall_grass_bottom, tall_grass_top, large_fern_bottom, large_fern_top, sweet_berry_bush_stage3, sugar_cane, poppy, dandelion, cornflower, azure_bluet, oxeye_daisy, pink_petals, pink_petals_stem, lily_pad, barrel_side, barrel_top, hay_block_side, hay_block_top, spruce_trapdoor, water_still, water_flow, campfire_log, campfire_log_lit, campfire_fire. (A few are extracted for future dressing and not yet used.)
- Entity texture (entity/chest/, from assets/minecraft/textures/entity/chest/): normal.
- Environment texture (environment/, from assets/minecraft/textures/environment/): clouds — the cloud layer is built from its pixels.
- Also block/red_mushroom and block/brown_mushroom.
- For the workshop render (renders/workshop-vaskel.webp): painting/pond (from assets/minecraft/textures/painting/), on the easel canvas; the easel and palette reuse the spruce and oak planks listed above. The paint buckets, brush and Vaskel's pose are original.
- Model data: the campfire geometry and UVs in camp/src/minecraft.js follow assets/minecraft/models/block/template_campfire.json; the animation timings follow the campfire_log_lit, campfire_fire, water_still and water_flow .mcmeta files. The chest uses the game's single-chest part layout (bottom, lid and lock boxes).

## Sounds

Minecraft Java Edition 1.21.1 sound effects, © Mojang Studios / Microsoft, downloaded unchanged from the official asset server (resources.download.minecraft.net) using the 1.21.1 asset index, with every file's SHA-1 checked against the index. Which file belongs to which event follows the game's own minecraft/sounds.json.

- Asset index: https://piston-meta.mojang.com/v1/packages/e61ea955de95de1f99d36616a8b46147e9f6f5d7/17.json (SHA-1 e61ea955de95de1f99d36616a8b46147e9f6f5d7)
- Included (sounds/, from minecraft/sounds/): block/campfire/crackle1–6 (block.campfire.crackle), block/chest/open (block.chest.open), block/chest/close1–3 (block.chest.close), mob/ghast/fireball4 (item.firecharge.use), random/orb (entity.experience_orb.pickup), random/click_stereo (ui.button.click), random/pop (entity.item.pickup, played when a chat line appears).

## Skin and libraries

Vaskel's 64×64 skin is the user's supplied renders/vaskel-skin.png, unchanged. All textures, sounds and the skin are inlined into camp/scene.bundle.js for offline use. The licenses of every bundled library (Three.js, React, React Three Fiber, @react-three/postprocessing with N8AO, postprocessing and their dependencies) are written to camp/scene.bundle.LICENSES.txt on each build; font licenses are retained in vendor/fonts/. This is not an official Minecraft product and is not associated with Mojang or Microsoft.

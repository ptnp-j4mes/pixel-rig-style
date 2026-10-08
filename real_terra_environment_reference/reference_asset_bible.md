# REAL TERRA | SINGLE-IMAGE 3D ENVIRONMENT DECONSTRUCTION

## Scope and evidence rules

Reference: `image(20261008-032130).png`, 1200 x 560 pixels, approximately 2.14:1 framing.

**Goal:** A modeling handoff for a stylized high-detail East-Asian / Korean-fantasy village in a 3D game engine. The reference is a single perspective render, NOT orthographic drawings. Dimensions, hidden sides, rear walls, precise materials, time of day, topology, true albedo, and physical height cannot be recovered uniquely. Every meter dimension below is an implementation starting point, not measured data. World scale is optional; all shapes and relative screen positions are the important observations.

**Confidence:** `direct-visible` = shape/material discernible in the screenshot; `partly-inferred` = region identifiable but structure or intended prop uncertain. The generated manifest deliberately separates observation from suggested construction.

### 1. Composition and camera

- Aspect ratio 1200/560 = 2.14:1. Wide elevated oblique camera, village central axis reaching back to far civic structures; both sky and roof planes visible. For reconstruction start with camera looking downward roughly 30-45 degrees relative to horizontal, vertical field of view roughly 35-50 degrees (horizontal FOV varies with aspect ratio). This is a *starting visual match*, not measured metadata.
- **Front/near**: two prominent long thatched farmhouses, a broad sandy public road, small garden, tree clusters, rail fences, clay pots, and a narrow stream.
- **Middle**: dominant long fortified stone wall, high open guard pavilion over a rounded arch, stone canal culvert left of gate, continuation of road into a dense village.
- **Far**: inner town houses with navy tile roofs, open plaza, isolated colorful canopy, numerous roof silhouettes, wooded foothills.
- **Horizon**: colossal smooth rounded gray granite-like rock formations and hilltop multi-storey pagoda at upper right. Overcast-but-bright blue sky with soft white cloud patches.
- Key read order: `two golden straw roofs -> light stone wall and blue guard pavilion -> green town canopy -> pale distant rock ridges -> far dark pagoda`.
- **Visual hierarchy:** largest objects deliberately unbalanced; gate to image center-right, water at center, bright yellow tree to left, highest pagoda at top-right. Avoid moving everything to symmetrical center.

### 2. Suggested layout for a playable 300 x 300 m prototype (OPTIONAL)

This is a fresh design suggestion, **not** a scale inferred from pixels. Use front = south / image bottom and back = north / image top for modeling convention.

- South zone y=0-95: broad path, two thatched houses, vegetable yard, stream, field patches, woodworking terrace.
- Defensive wall follows variable x across y about 100-125; central arched gate at x about 170-190. Stream passes through a separate low culvert slightly west of main gate.
- Interior town y=125-235: marketplace/civic approach with side paths and many compact timber and roof-tile buildings.
- North backdrop y=220-300 and beyond: rising hills, wooded cliffs, distant pagodas/temples; mountains can be background meshes outside walkable extents.
- Road clear width about 6-8m main and 2.5-4m side paths. Maintain gate opening at least 5m wide, 4m high for readable traversal, adjusting to chosen game camera.
- Terrain should have shallow undulations, not flat plane everywhere. Make waterbed cut through terrain and wall foundation without mesh intersection bugs.

### 3. Silhouette rules / non-negotiable identifiers

1. Wall has **two masonry scales**: top small orderly rectangular blocks, bottom huge soft-edged irregular boulders. One masonry material will fail.
2. Gatehouse has a **large masonry arch** AND a **roofed open-column pavilion** above; they are separate structures at different elevations.
3. Navy/blue ceramic roof is **curved, ribbed, upturned at corners**. It cannot be a generic flat gable with blue paint.
4. Straw roofs are **very thick**, with individually suggested straw strands, straw bundles and hanging fringes. Not yellow wood planks.
5. Rocks form **rounded vertical stacked monoliths**, not sharp triangular alpine peaks.
6. Roads are **dusty warm earth with occasional irregular stepping stones**, not continuous paved cobbles.
7. Trees have **irregular clumped crowns**, varying by age and type; foreground is detailed, backgrounds form a forest mass.
8. Water is a **tiny meandering flowing stream**, not a wide river or bright turquoise canal.
9. Sunlit highlights tend warm; roof underside, gate arch, branches and crevices are rich cool/dark AO.
10. World density comes from repeated modular structures **plus** dozens of small mismatched props, offset fences, shrubs and dirt masks.

### 4. Hero object modeling recipes

#### 4.1 Stone fortification and arched gate

**Shape:** Raise irregular boulder foundation first. Add narrow ashlar/cut-stone upper band, walkway and slightly irregular parapets. The arch is a true extruded semicircular or round-headed tunnel. At the gate tower, stone blocks radiate around the arch (voussoirs), not a decorative texture on a rectangular hole. Recess black shadow into tunnel; keep interiors passable and continuous.

**Detail stack:** base mesh silhouette -> boulder assemblies -> small masonry tile geometry/normal -> dark joint material -> chipped edges/mortar AO -> stains along foundation -> parapet guards -> square vent holes -> stone terrace slabs. Top has broad level floor for pavilion columns.

**Typical segment setup:** 4m modular wall panel; 3-5 course patterns; >6 distinct foundation boulder motifs. Make transitions between ramp and flat wall, stream culvert panel, one main gate panel, gate flanking sections. Reduce repeated UV seams with tri-planar/noise decal blending.

**Materials:** top gray beige `M01`, lower gray taupe `M02`, arch cut stone `M03`. Roughness ~0.84-0.92; dry wall should have almost no specular shine. Crevices substantially darker than stone faces. Color is not pure white.

#### 4.2 Blue ceramic tiled pavilion and houses

**Structural layers** (separate meshes): stone foundation / timber posts -> transverse lintels -> colored bracket sets -> rafters -> structural roof planes -> ribbed tile repeats -> ridge caps -> upturned corner tips. Build each roof with four curved hip planes or joined irregular roof surfaces. Approximate pitch 25-40 degrees; corners curl upward 0.25-0.75m on hero buildings. Do not fake upturned tips with texture only.

**Giwa-style tiles:** make U-shaped channel and inverted cylindrical cap/ridge pattern; alternate across rows. Tile lengths 0.3-0.5m, widths 0.2-0.38m. Near gate, enough geometry to catch directional sun highlights. For far buildings, bake roof profile into normals and keep large silhouette geometry. Use dark gray-blue, not luminous cobalt. Small teal-cream-red painted trim must stay restrained.

**Underside:** visually important from elevated oblique view. Use under-eave shadow, readable exposed beams, red-brown columns, colored bracket paintings. Guard pavilion remains open, not closed with giant walls.

#### 4.3 Thick rounded thatch roofs

**Core:** Long rectangular dark wooden buildings with a great rounded/hap-hip golden straw volume. Roof edges droop thickly past side walls; at both ends, straw radiates with fibrous lines. Build underlying roof smooth but not mathematically symmetrical. Add subtle sags at 1-3 zones and several overlapping bundle bands following the roof length.

**Construction stack:** main mesh base -> cross-surface straw direction stripes -> ~5-15 separate tuft variations along silhouette -> clump material normal -> darker deep roof seam -> sparse strays. Use geometry for the eaves where silhouette matters, normal/texture for most individual fibers. Roof top in sun may approach pale tan; lower edge should be warm deep brown. Never use glossy material.

**Facade:** aged dark brown beams, beige earthen infill, narrow windows, low foundation, little raised timber walkway, small doorstep stones. Left and central cottages share a kit but should differ in proportions, entry placement and roof sag.

#### 4.4 Rock cliffs and distant mountains

**Main silhouette:** Massive overlapping vertical rock fingers/blobs with smooth worn caps and deep crevice slots. Add wide ledges/platforms with bushes or small pines. Near rock reveals mottled broad warm-beige highlights, far rock appears blue-gray, flatter and softer due air perspective. Avoid polygon-faceted mountain pyramids and repetitious sphere stacks.

**Practical modeling:** 8-15 reusable large rock chunks as a construction kit, deformed and rotated; add rock-lobe sculpt and directional stone cavity normals; blend intersections with small boulders and vegetation. For foreground rocks, create dark contact soil ring. Hilltop pagoda on right must remain visible above skyline and rock crown.

#### 4.5 Roads, soil, grass, vegetation

Make the road first as a terrain paint / splat map, not a thin flat brown polygon on top of grass. Build large-scale tan/ochre soil variation, hard worn middle strip, loose low stones, subtle route rutting, darkened damp areas close to stream. Asymmetrically fringe with grass and weeds. Stone pieces along road are sporadic, irregularly rotated flat slabs, not a perfect paved line.

Tree meshes: 3-6 large branch forks, trunk taper, angled growth, multiple volumetric clumps 8-20, very small bright dapple highlights. Place darker broadleaf trees in left forest, lime/olive trees near gate, deep dark tiered pine trees at mid-ground, one bright yellow tree on left, and pink bloom accents by center and stream. Avoid placing every tree at same scale or orientation.

#### 4.6 Stream / water feature

Carve a narrow irregular meandering channel beginning at low wall culvert. Use blue-gray transparent flowing water with subtle Fresnel and shallow depth tint. White foam belongs only to tight bends and contact points. Shade water beneath stone arch dark and near open area lighter. The far banks are mostly dirty earth + pebbles + green roots; avoid artificial concrete canal walls.

### 5. Lighting, physically based response and grading

- **Illumination impression**: broad bright daylight, mildly golden sun, cool blue skylight, moderate soft shadow edges, enough direct light to highlight roofs and pale stones.
- **Light direction estimate**: sunlight predominantly from screen upper-left; main cast/contact shadows drift toward lower-right. This is a visual approximation from one image, not a physically solved compass bearing.
- **Starter light values**: directional sun elevation 35-55 deg, warm-neutral ~5000-6000K; size 3-6 deg for soft shadows; blue sky ambient or HDRI with lower intensity. Tune by image match rather than treating these as exact.
- **Shadow hierarchy**: darkest in hollow arches, under deep eaves, the undersides of straw borders, behind wall battlements, tree roots and rock gaps. More open ground receives softer tree canopy shadow shapes.
- **AO**: small-scale under beams, stones, fence posts; do not blanket-screen AO so strong that all stone faces become gray-black. For web games bake static contact occlusion into lightmaps/ambient masks when possible.
- **Sky**: high broad blue, soft fragmented white clouds and pale blue horizon haze.
- **Air perspective**: increase blue-gray tone, lower saturation and lower contrast by distance; background mountains must remain visible as layered masses.
- **Tone map**: neutral/filmic or AgX-like highlight compression; keep sunlit straw and ground from clipping pure white; roof remains dark blue. Screen samples are *display-referred* and cannot be assumed to be true shader albedo values.
- **Starter PBR**: stone .85-.95 rough; dry soil ~.95; straw ~.95; wood .75-.85; painted roof tile .4-.6; foliage .7-.85; moving water .08-.2. Metalness generally 0 for these nonmetal materials.

### 6. Mesh-level and texture-level detail separation

| Scale | Must be geometry | Can be texture/normal/decal | LOD behavior |
|---|---|---|---|
| 10-100m | Mountains, wall height/length, roofs, big tree canopies | Far weathering color breakup | Coarse silhouette LODs |
| 1-10m | Arch, gate columns, roof-tip curl, house frames, large boulders | Most mortar, wood grain, grass masks | Simplified repetitive shapes |
| 0.1-1m | Near slab pavers, roof ridge tiles, large straw tufts, pots, rail fence | Most roof tile depth in distant houses | Geometry merged by distance |
| 0.005-0.1m | Only silhouette straw strands/leaf edge cards | Individual fibers, pores, micro-gravel, wood scratches | Decals/mips rather than mesh |

**Important:** "every grain" is not visible as separate 3D geometry in a 1200px screenshot; use layered shapes + properly scaled tiling PBR textures + decals. This creates an equally detailed *render* while staying viable on web/mobile. Avoid micropolygons for every grain.

### 7. Suggested production sequence

1. **Blockout**: match camera/composition, wall/gate height, two prominent straw roofs, stream, main roads, mountains. Use only flat materials. No props yet.
2. **Hero silhouettes**: finish 1 masonry wall kit, true arch, blue-roof pavilion, 2 thatch roof variations, 3 rock boulder sizes and 3 tree crowns. Capture comparable camera screenshot before continuing.
3. **Tile + thatch materials**: build roof texture directions, strongly visible roof silhouette tuft and clay ridge pieces; test close and far camera.
4. **Terrain blend**: dirt/grass/stone, root-based scatter, stream cuts, road pavers.
5. **Secondary architecture**: inner Hanok-style houses, market, workshop on raised terrace, 2 pagoda/temple skyline variants.
6. **Dressing**: fences, pots, bundles, crates, banners, flowers, carts, signs, hay, scattered rocks.
7. **Lighting**: daylight directional sun, blue sky ambient, AO and depth atmospheric fog; tune contrast/color against reference.
8. **360-degree validation**: build unseen backs of houses and walls as inferred consistent architecture; verify gates and tunnels from every side; collision, navmesh, water intersection, ground contacts.
9. **Optimization**: instance tile/foliage/props, GPU instancing and 2-3 LODs, combine static batches carefully, texture atlases and distant impostors.

### 8. Pixel regions / evidence anchors

All rectangles use `[left, top, right, bottom]` image pixel coordinates. These mark *approximate visible screen locations* and should not be treated as exact object bounding boxes.

| Landmark | Screenshot rectangle px |
|---|---|
| Southwest farmhouse | `[59, 365, 314, 560]` |
| South-center farmhouse | `[609, 375, 835, 560]` |
| Main stone wall | `[0, 220, 1200, 380]` |
| Main arched gate | `[625, 187, 838, 407]` |
| Creek | `[512, 323, 615, 560]` |
| Right woodworking terrace | `[898, 252, 1150, 428]` |
| Inner village center | `[310, 120, 840, 260]` |
| Left mountains | `[26, 15, 420, 178]` |
| Central/far mountains | `[382, 12, 900, 167]` |
| Right pagoda hill | `[906, 0, 1199, 186]` |
| Main south road | `[755, 315, 1199, 560]` |
| Yellow autumn tree | `[30, 101, 154, 184]` |
| Pink garden tree | `[444, 464, 582, 560]` |
| Gate roof | `[619, 181, 829, 281]` |

### 9. Material library

Each color triplet is an **art-direction approximation** (`base` / `light` / `shadow`) derived by combining visual inspection and selected screenshot pixel samples; individual listed `reference_pixels` are sample output colors, NOT physical albedos. Material base swatches should be retuned under the final game-engine lighting.

| ID | Surface | Base | Highlight | Deep shadow | Roughness | Screenshot sample(s) |
|---|---|---|---|---|---:|---|
| M01 | Fine gray masonry / cut brick | `#918A7E` | `#C2B8A8` | `#4E514F` | 0.88 | `#8F836F`, `#97876E`, `#69655C` |
| M02 | Large irregular wall foundation stone | `#807E75` | `#B8AB95` | `#4A4B4A` | 0.92 | `#665950`, `#917D64` |
| M03 | Gate arch stone | `#A49A87` | `#CBC0AF` | `#6C6863` | 0.84 | - |
| M04 | Dark navy blue fired roof tiles | `#425066` | `#788394` | `#182338` | 0.48 | `#20283A`, `#4E5568`, `#616A79` |
| M05 | Golden dried thatch | `#BC935F` | `#E1C18A` | `#73532D` | 0.95 | `#C7A469`, `#DABC80`, `#72522C` |
| M06 | Old dark timber | `#67432F` | `#9B6B49` | `#38231D` | 0.82 | `#663B28`, `#3A2818` |
| M07 | Brown shingle / worn plank roofing | `#8E5B35` | `#C0884F` | `#4A3027` | 0.84 | - |
| M08 | White-beige lime plaster | `#D4C5A9` | `#F0E1C8` | `#988A75` | 0.92 | - |
| M09 | Compacted warm ochre dirt | `#BC9161` | `#D8AF7C` | `#8C6849` | 0.97 | `#BD9261`, `#D0A76F` |
| M10 | Grassland / short grass | `#697A46` | `#A4B66A` | `#395536` | 0.95 | - |
| M11 | Sunlit deciduous leaves | `#628347` | `#A2B76D` | `#355535` | 0.78 | - |
| M12 | Conifer needles | `#35513C` | `#697955` | `#20392E` | 0.82 | - |
| M13 | Autumn foliage | `#B3892A` | `#D8B943` | `#7A551E` | 0.80 | `#9F791C`, `#A1791D` |
| M14 | Pink blossom foliage | `#C78D95` | `#EDBFC3` | `#875666` | 0.77 | - |
| M15 | Warm-gray mountain rock | `#918A7A` | `#C3B8A1` | `#525454` | 0.93 | `#B2A68C`, `#A2937D`, `#585959` |
| M16 | Distant cool blue rock | `#68717A` | `#9CA7AC` | `#444D5A` | 0.92 | `#5B6C7E`, `#717783` |
| M17 | Stream water | `#4D6276` | `#8EA2AE` | `#2C4152` | 0.11 | `#48576A`, `#5A6577` |
| M18 | White water foam | `#DAE3E0` | `#F7F7EE` | `#A3B7B4` | 0.45 | - |
| M19 | Red pennant/banner cloth | `#A32E2B` | `#CC4A36` | `#642321` | 0.87 | - |
| M20 | Decorative eave paint | `#276D6E` | `#A8C8BA` | `#24485A` | 0.56 | - |
| M21 | Fired earthenware / clay pot | `#8F4E39` | `#C07B50` | `#4A2C27` | 0.56 | - |
| M22 | Blue sky and broken soft cloud | `#9FC9E3` | `#D4DFE5` | `#82ADC3` | 1.00 | `#A5C4D8`, `#B4CBD9` |

### 10. Modular asset register

Each entry is an individually reusable model/prefab, even when it uses shared materials and roof modules. Suggested size is in approximate meters at a chosen character scale. Priorities: `P0` mandatory for visual match, `P1` important secondary, `P2` minor dressing.


#### Fortifications (9 assets)

**S01 | Fine coursed outer city wall** — Long continuous gray stone band; courses of small flat rectangular blocks; offsets at wall joints.; Gray-beige masonry with dark mortar, sporadic chipped corners and streaks.; proposed size: module 4x1.1x3.0 (LxDxH), above base; material: M01; visibility: direct-visible; priority: P0; variants: 6.

**Modeling notes:** Modular straight, 45-degree corner, 90-degree corner and curved sections; no obvious perfect repeating texture.. Approximate screen ROI: `[0, 225, 1200, 360]`.

**S02 | Large irregular boulder foundation** — Bottom 1/3-1/2 of fortification built from big rounded polygon stones with irregular interlocking joints.; Broader light gray stones, dark crevices, dusty near ground.; proposed size: module 4x1.6x2.2; stones .35-1.3 diameter; material: M02; visibility: direct-visible; priority: P0; variants: 6.

**Modeling notes:** Use 8-15 stone silhouettes per 4m panel, varied rotation and no uniform cobblestone grid.. Approximate screen ROI: `[0, 270, 1200, 385]`.

**S03 | Upper parapet and crenels** — Flat wall-walk with raised outer protective lip and regular short block projections.; Same fine masonry; chipped raised outer edges, dirt in foot zones.; proposed size: parapet 1.0-1.3 high; walkway 2-3 wide; material: M01; visibility: direct-visible; priority: P0; variants: 4.

**Modeling notes:** Build walkable top, crenel repeat module, 2-4 variants.. Approximate screen ROI: `[100, 265, 1200, 330]`.

**S04 | Main arched gate opening** — Tall round-headed opening with visibly larger radial stones and recessed dark tunnel.; Pale keystone arch, old brown interior shadows, coarse stone sidewalls.; proposed size: opening 5-7 wide x 4-5 high (prototype estimate); material: M02, M03; visibility: direct-visible; priority: P0; variants: 1.

**Modeling notes:** Build actual tunnel walls/ceiling for 360-degree camera; radial voussoirs need geometry.. Approximate screen ROI: `[660, 282, 808, 395]`.

**S05 | Gate-top watch terrace** — Rectangular raised bastion over gate; dense small masonry and repeated tiny square openings.; Dirty gray dressed stone, recesses very dark.; proposed size: 12-17 wide x 8 deep x 3 high above gate; material: M01, M03; visibility: direct-visible; priority: P0; variants: 2.

**Modeling notes:** Corner caps, wall walk and visible floor slabs; square vent/arrow slit modules.. Approximate screen ROI: `[620, 220, 850, 315]`.

**S06 | Narrow guard openings in wall** — Tiny repeated black rectangle/square holes on gate tower facade.; Strong black AO/recess; pale beveled stone border.; proposed size: 0.18-0.30 wide; material: M01; visibility: direct-visible; priority: P2; variants: 3.

**Modeling notes:** Model at least inset dark geometry on near hero wall, decal on distant repeats.. Approximate screen ROI: `[630, 255, 830, 310]`.

**S07 | Ascending wall ramp / stepped terrace** — Wall changes elevation toward right upper ramparts, with terraces and a long walkway.; Gray stone paving and retaining faces; irregular rock foundation.; proposed size: ramp width 2.5-4; elevation tailored to slopes; material: M01, M02; visibility: direct-visible; priority: P1; variants: 2.

**Modeling notes:** Keep pathway traversable; adapt endpoints to wall segment heights.. Approximate screen ROI: `[830, 170, 1190, 275]`.

**S08 | Stone stairs and retaining plinths** — Several gray stone steps elevate an open timber workshop from surrounding dirt.; Worn step centers with darker edge dirt.; proposed size: step rise .15-.22, tread .3-.5; material: M01, M02; visibility: direct-visible; priority: P1; variants: 4.

**Modeling notes:** Use 4-7 step groups; plasterless stacked stone side walls.. Approximate screen ROI: `[920, 325, 1200, 430]`.

**S09 | Stream culvert beneath wall** — Low curved masonry opening where narrow stream emerges under defensive wall.; Deep dark wet recess at opening, waterline staining and slimy stones.; proposed size: opening 2-3 wide and 1.7-2.2 tall; material: M02, M03, M17; visibility: direct-visible; priority: P0; variants: 1.

**Modeling notes:** Water and opening must be continuous through wall, not a false dark plane.. Approximate screen ROI: `[507, 325, 585, 390]`.


#### Terrain (9 assets)

**T01 | Broad main dirt road** — Wide tan earth roadway, irregularly tapered, subtle worn center and sporadic paving pieces.; Warm ochre packed soil, fine granules, small pebbles and muted traffic ruts.; proposed size: 5-8 wide; material: M09; visibility: direct-visible; priority: P0; variants: 3.

**Modeling notes:** Spline-based path, blend edges 1-2m into grass; preserve readable navigation.. Approximate screen ROI: `[775, 330, 1200, 560]`.

**T02 | Inner village street** — Village road funnels from near center toward distant temple buildings, widening at nodes.; Sunlit beige dirt, slight wheel/foot trails, irregular blotchy dryness.; proposed size: 4-7 wide; material: M09; visibility: direct-visible; priority: P0; variants: 3.

**Modeling notes:** Spline network links houses, market and plaza.. Approximate screen ROI: `[480, 137, 690, 275]`.

**T03 | Stepping-stone street margins** — Loose individual gray slabs form intermittent bordering lines along foreground cottage paths.; Dusty flat stone, corners mostly rounded, varied spacing and rotation.; proposed size: each stone .25-.65; material: M01, M09; visibility: direct-visible; priority: P1; variants: 8.

**Modeling notes:** Place as scatter with exclusions around doorways; avoid perfect evenly spaced bricks.. Approximate screen ROI: `[260, 385, 500, 560]`.

**T04 | Bare farmyard courtyard** — Mostly open level dirt with wheel-worn patches and very sparse grass.; Broad warm pale ochre soil and random pale scuffs.; proposed size: courtyard 15-35 across; material: M09; visibility: direct-visible; priority: P0; variants: 2.

**Modeling notes:** Keep center uncluttered; use vertex paint and shallow cracks, tiny stone decals.. Approximate screen ROI: `[0, 375, 620, 560]`.

**T05 | Grass field patch** — Mottled green grass forms irregular islands near fences and house perimeters.; Cool-to-warm green variations, sparse brown soil holes and short blades.; proposed size: clusters .5-6 across; material: M10; visibility: direct-visible; priority: P0; variants: 5.

**Modeling notes:** Terrain splatmap plus instanced short tuft meshes and flower specks.. Approximate screen ROI: `[835, 320, 1200, 470]`.

**T06 | Dirt-grass transition edge** — Uneven feathered boundary from compacted road to patchy lawn.; Brown-green gradient; small pebbles and tufts invade road edge.; proposed size: transition .5-2 wide; material: M09, M10; visibility: direct-visible; priority: P0; variants: 4.

**Modeling notes:** No hard painted polygon border; randomized masks and decals.. Approximate screen ROI: `[850, 360, 1130, 510]`.

**T07 | Rocky terrain berm and woodland soil** — Shallow undulating wooded banks and soil cut around rocky outcrops.; Dirt, embedded gray stone, grass tufts, sparse moss.; proposed size: bank heights .5-4; material: M09, M10, M15; visibility: direct-visible; priority: P1; variants: 4.

**Modeling notes:** Blend cliff/rock to soft ground with pebbles and dirt skirts.. Approximate screen ROI: `[0, 155, 450, 350]`.

**T08 | Fenced small vegetable plot** — Tiny crop beds and flowering garden along foreground fence.; Dark fertile soil, green sprawling leaves and small warm orange produce.; proposed size: bed 1-4 long; material: M09, M10, M11; visibility: partly-inferred; priority: P2; variants: 4.

**Modeling notes:** Raised soil strips, individual stems and fruits; crop species approximate due small image scale.. Approximate screen ROI: `[398, 455, 550, 560]`.

**T09 | Gravel and road scuff decals** — Small stones and short irregular scrapes break flat road color.; Gray-beige tiny gravel, transparent dust overlay.; proposed size: stone .02-.25; decals .2-2; material: M09, M01; visibility: direct-visible; priority: P2; variants: 12.

**Modeling notes:** Reuse 10-20 decal/gravel silhouettes and random yaw.. Approximate screen ROI: `[635, 320, 1200, 560]`.


#### Buildings (12 assets)

**B01 | Large long thatched farmhouse** — Long rectangular timber house, enormous slightly barrel/hip-shaped thick straw roof, exposed dark wall framing and narrow deck.; Golden straw, aged brown beams, dusty low plaster panels.; proposed size: 13-17 long x 5-7 wide x 5-6 high; material: M05, M06, M08; visibility: direct-visible; priority: P0; variants: 3.

**Modeling notes:** Huge overhang .6-1.2m, roof bundle ribbing, occasional loose fraying fringe, stone stepping line.. Approximate screen ROI: `[62, 375, 318, 560]`.

**B02 | Front-right long thatched lodge** — Second long thatch structure, similar family, slanted toward view, fenced around perimeter.; Bright sunny straw top, deep shadow under eaves, brown timber panels.; proposed size: 12-16 x 5-7 x 5-6 high; material: M05, M06, M08; visibility: direct-visible; priority: P0; variants: 3.

**Modeling notes:** Must be related kit to B01, vary roof sag, porch and openings.. Approximate screen ROI: `[605, 375, 829, 560]`.

**B03 | Tiny steep-hip straw shelter** — Small hut with sharply pitched golden thatch roof directly outside wall.; Deep dark doorway, exposed straw tips, pale brown wood.; proposed size: 3-5 x 3-4 x 3-4 high; material: M05, M06; visibility: direct-visible; priority: P1; variants: 3.

**Modeling notes:** Steeper pyramid/rounded hipped silhouette; door and low sill.. Approximate screen ROI: `[423, 303, 491, 397]`.

**B04 | Rustic straw barn behind wall** — Modest timber building under simple tan roof embedded among shrubs behind wall.; Medium golden straw, brown rough frame.; proposed size: 6-10 x 4-6 x 4-5 high; material: M05, M06, M08; visibility: direct-visible; priority: P1; variants: 4.

**Modeling notes:** Alternate gable/hip variants, irregular walls.. Approximate screen ROI: `[468, 220, 593, 285]`.

**B05 | Traditional blue-roof timber house** — One or two-storey timber house with multi-sloped dark blue ceramic roof and slightly lifted roof-tip corners.; Navy blue curved tiles, dark reddish-brown posts, beige wall infill.; proposed size: 7-14 x 6-10 x 5-9 high; material: M04, M06, M08; visibility: direct-visible; priority: P0; variants: 6.

**Modeling notes:** Separate porch, pillars, shutters, base platform and eave brackets.. Approximate screen ROI: `[675, 132, 910, 225]`.

**B06 | Main open gate pavilion** — Open pavilion atop gate bastion, broad four-sided dark tiled roof and six-plus narrow red-brown columns.; Deep blue tile ribs, decorative teal eave painting, ornate corner upturns.; proposed size: 11-15 wide x 6-9 deep x 6-8 above terrace; material: M04, M06, M20; visibility: direct-visible; priority: P0; variants: 1.

**Modeling notes:** Exposed painted rafters, ridge caps, finials, multi-row tile pattern and banners at entry.. Approximate screen ROI: `[623, 191, 821, 296]`.

**B07 | Small roofed parapet pavilion** — Open air lookout pavilion on higher wall section at right center.; Dark navy hipped roof, brown wood posts, gray stone terrace.; proposed size: 7-11 x 6-8 x 5-6 high; material: M04, M06, M20; visibility: direct-visible; priority: P1; variants: 3.

**Modeling notes:** Use same roof/post/bracket construction system as B06, smaller footprint.. Approximate screen ROI: `[930, 112, 1060, 201]`.

**B08 | Raised wood workshop / terrace house** — Raised wooden structure to far right with stacked timber framing, broad brown roof and repeated raised structural ribs.; Warm rusty brown, worn overlapping roof boards, dark open bays.; proposed size: 10-17 x 6-11 x 5-8 high; material: M06, M07, M02; visibility: partly-inferred; priority: P1; variants: 3.

**Modeling notes:** Keep elevated gray stepped base, open lower gallery, wooden railings and ribbed top roof profile.. Approximate screen ROI: `[915, 265, 1139, 408]`.

**B09 | Small wooden market / storage shed** — Short low-stature covered stall near gate and workshop.; Straw-colored shade and aged timber supports.; proposed size: 4-7 x 3-5 x 3-4 high; material: M05, M06; visibility: direct-visible; priority: P1; variants: 4.

**Modeling notes:** Open sides, sacks/crates and attached rails.. Approximate screen ROI: `[830, 285, 940, 355]`.

**B10 | Interior shop-houses and balconies** — Dense mixed single and two-storey timber buildings with varied brown, tiled and straw roof outlines.; Dark timber, cream plaster, dark clay tile, dirt patina.; proposed size: 5-11 facade wide, 4-9 high; material: M04, M05, M06, M08; visibility: direct-visible; priority: P1; variants: 8.

**Modeling notes:** Assemble from 3-5 wall modules and 4 roofs, stagger facades, varied porch and awnings.. Approximate screen ROI: `[175, 135, 619, 266]`.

**B11 | Far central civic or temple buildings** — Layered civic palace-like buildings and a far axial gateway creating central skyline focus.; Cool blue roofs, muted cream-red walls, distant haze.; proposed size: hero building 15-28 wide x 10-20 high; material: M04, M06, M08, M16; visibility: partly-inferred; priority: P2; variants: 5.

**Modeling notes:** Silhouette first, detail only at near LOD; no exact structure recoverable at this resolution.. Approximate screen ROI: `[270, 87, 610, 175]`.

**B12 | Multi-tier hilltop pagoda** — Distinct tall narrow multi-tier pagoda rising from right mountain crown.; Dark blue/black upturned tile floors and dark red-brown timber.; proposed size: height ~14-25; scale estimated; material: M04, M06, M15; visibility: direct-visible; priority: P1; variants: 2.

**Modeling notes:** Each roof overhangs level below; accentuate tiered skyline and sit on uneven rock plateau.. Approximate screen ROI: `[1034, 0, 1125, 75]`.


#### Roof Modules (7 assets)

**R01 | Blue ceramic roof tile module** — Small concave or convex interlocked longitudinal tiles; parallel striped ribs descend each slope.; Light edges dusty blue gray, recesses navy black.; proposed size: tile .22-.38 wide, .3-.48 long; material: M04; visibility: direct-visible; priority: P0; variants: 6.

**Modeling notes:** Use repeated tile row geometry on near roofs, baked normals in far LODs.. Approximate screen ROI: `[634, 191, 801, 263]`.

**R02 | Blue hip roof with curled eaves** — Broad sweeping hipped roof; corners project up and out; visible decorative line beneath eave.; Shadow beneath edge nearly black; slate blue glazed tiles on upper surfaces.; proposed size: module 7-15 wide, slope ~25-40deg; material: M04, M20; visibility: direct-visible; priority: P0; variants: 4.

**Modeling notes:** Build roof as mesh surfaces or Bezier/spline lattice; roof ends must curl independently.. Approximate screen ROI: `[615, 181, 827, 267]`.

**R03 | Long rounded thatch roof module** — Thick golden folded roof, curved long crest and giant hanging straw fringe at eave.; Sunlit pale golden ridges, warm chestnut weathered grooves.; proposed size: roof thickness .2-.45; overhang .5-1; material: M05; visibility: direct-visible; priority: P0; variants: 5.

**Modeling notes:** Layer base volume + clump cards + edge hair-like clumps; distinct 2D strand strokes.. Approximate screen ROI: `[615, 380, 835, 558]`.

**R04 | Small conical / four-sided straw cap** — Tight steep roof with radial thatching and short rounded eaves.; Golden cap with dark interior underside.; proposed size: 2.5-5 wide; material: M05; visibility: direct-visible; priority: P1; variants: 3.

**Modeling notes:** Fast low-poly geometry, extra strands around edge for silhouette.. Approximate screen ROI: `[419, 302, 494, 369]`.

**R05 | Blue ridge ornament and end cap** — Long raised main ridge with dark cap tiles, curved tip-end flourishes.; Tile blue with chipped gray lighter rims.; proposed size: ridge running module .5-2; material: M04; visibility: direct-visible; priority: P1; variants: 6.

**Modeling notes:** Separate topper, finial, corner ornaments to add variety without a new roof mesh.. Approximate screen ROI: `[623, 192, 798, 239]`.

**R06 | Painted bracket / eave timber details** — Interlocking timber brackets and rafter ends colored dark red, teal and soft cream.; Dark under-eave AO plus thin accent decorative paint.; proposed size: post .22-.5 thick; bracket .25-.8; material: M06, M20; visibility: direct-visible; priority: P1; variants: 8.

**Modeling notes:** Use repeated beam prefabs with 3 paint pattern variants; bright trim stays narrow.. Approximate screen ROI: `[620, 225, 810, 280]`.

**R07 | Small cloth market canopy** — Small white/pale cream fabric canopy with colorful red fabrics around festival or stalls.; Cream cloth, red accent trim; slightly uneven taut fabric.; proposed size: 3-7 x 3-5; material: M08, M19, M06; visibility: direct-visible; priority: P2; variants: 3.

**Modeling notes:** Simple cloth folds, hanging edge, ropes and wooden posts.. Approximate screen ROI: `[609, 135, 667, 186]`.


#### Vegetation (12 assets)

**V01 | Large green deciduous tree** — Brown trunk with 3-6 main forks carrying irregular rounded overlapping leaf crowns.; Dark olive inner foliage, bright medium green flecks catching sun.; proposed size: height 7-13, crown 4-9 wide; material: M06, M11; visibility: direct-visible; priority: P0; variants: 8.

**Modeling notes:** Avoid single perfect sphere; compose 8-20 leaf clump volumes, trunk twist and exposed gaps.. Approximate screen ROI: `[0, 225, 400, 500]`.

**V02 | Medium light-green tree** — Narrower upright canopy, brighter olive green; many along wall outside gate.; Leaf color fades lighter in sun, dark green core.; proposed size: height 5-10, crown 3-6; material: M06, M11; visibility: direct-visible; priority: P0; variants: 6.

**Modeling notes:** Asymmetric lobes and crown lean; make 6 seed variations and randomized size.. Approximate screen ROI: `[520, 235, 1080, 465]`.

**V03 | Sculptural evergreen / pine** — Dark evergreen separated horizontal layered crowns with sculptural bent branch silhouettes.; Deep forest blue-green, less saturated than broadleaf.; proposed size: height 6-12; material: M06, M12; visibility: direct-visible; priority: P1; variants: 6.

**Modeling notes:** Tiered flattened foliage pads, exposed branch elbows; avoid Christmas-tree cone.. Approximate screen ROI: `[90, 115, 810, 260]`.

**V04 | Yellow autumn ornamental tree** — One highly visible yellow-gold broadleaf crown on left-upper edge of village.; Ochre foliage shifting yellow sun edges, rich rust shadows.; proposed size: height 7-11; material: M06, M13; visibility: direct-visible; priority: P1; variants: 3.

**Modeling notes:** Use V01 branching with separate autumn leaf kit; few dropped leaf decals.. Approximate screen ROI: `[25, 106, 151, 179]`.

**V05 | Pink spring blossom tree** — Distinct pale rose-pink flowering tree near foreground stream/garden.; Dense pale pink clusters over darker twig core.; proposed size: height 3-6; material: M06, M14; visibility: direct-visible; priority: P1; variants: 4.

**Modeling notes:** Clusters on irregular branches, scatter some petals near base.. Approximate screen ROI: `[435, 452, 585, 560]`.

**V06 | Small bush and hedge clusters** — Irregular mounded green shrubs along road, rocks and fences.; Dark core, olive-highlight outer leaves, mixed sizes.; proposed size: height .3-1.8; material: M11; visibility: direct-visible; priority: P0; variants: 12.

**Modeling notes:** 4-8 lobes per bush, 12 variants including clipped and wild shapes.. Approximate screen ROI: `[750, 250, 1200, 500]`.

**V07 | Ground grass blade clumps** — Tufts stick out from green turf, lightly sparse on roads.; Multiple olive / fresh-green blades plus dried tawny ends.; proposed size: height .08-.35; material: M10; visibility: direct-visible; priority: P0; variants: 10.

**Modeling notes:** Use cross cards in distant LOD and true small tapered clumps near camera.. Approximate screen ROI: `[790, 360, 1199, 558]`.

**V08 | Wild flowers and tiny light flecks** — Very small yellow/white flower heads sprinkled amid grasses, especially garden/fence margins.; Warm pale cream flower heads with green stalks.; proposed size: height .1-.5; material: M10, M14; visibility: direct-visible; priority: P2; variants: 8.

**Modeling notes:** Minimal scatter 1-4 flowers per patch, never uniform checkerboard.. Approximate screen ROI: `[280, 320, 1120, 535]`.

**V09 | Vines and creeping leafy plants** — Low broad leaves climb/stay close to garden soil, with a few trailing tendrils.; Saturated green against brown-black garden dirt.; proposed size: height .1-.9; material: M11, M09; visibility: partly-inferred; priority: P2; variants: 5.

**Modeling notes:** Asymmetric vine mesh and squash-like big leaves; cultivar not identifiable.. Approximate screen ROI: `[365, 445, 605, 560]`.

**V10 | Forest middle-distance tree mass** — Multiple compact green crowns produce canopy continuum between roofs and foothills.; Lower contrast olive-green clusters, softened by distance haze.; proposed size: height 5-13; material: M11, M12, M16; visibility: direct-visible; priority: P1; variants: 7.

**Modeling notes:** Hybrid near true meshes / distant imposter LOD for budget.. Approximate screen ROI: `[0, 100, 1200, 255]`.

**V11 | Patchy moss at stones and wet bank** — Dark green moss appears on wet stone contacts, shaded rock/ground corners.; Low rough velvety dark-green layers.; proposed size: thin decals; .03-.2 thick; material: M10, M15; visibility: direct-visible; priority: P2; variants: 6.

**Modeling notes:** Decal only near moisture; do not uniformly paint every stone.. Approximate screen ROI: `[500, 320, 630, 515]`.

**V12 | Agricultural vegetable crop clumps** — Clustered broad leaves, twining low plants and a few yellow/orange harvest objects.; Bright green leaves and tan/orange fruit accents.; proposed size: plant .25-.9 tall; material: M11, M09; visibility: partly-inferred; priority: P2; variants: 5.

**Modeling notes:** Use distinct leaf, stem, fruit instanced components; exact produce uncertain.. Approximate screen ROI: `[425, 490, 567, 560]`.


#### Geology (5 assets)

**K01 | Huge rounded stacked mountain cluster** — Tall mountain assembled from vertical broad rounded rock monoliths; a soft rocky silhouette with notched summits.; Warm gray sunlit planar lobes, deep cool crevices, vegetation on ledges.; proposed size: height 35-120+ (scene scale variable); material: M15; visibility: direct-visible; priority: P0; variants: 5.

**Modeling notes:** Create three layers: base mass, big lobes and scree stones, then trees; avoid razor-sharp triangles.. Approximate screen ROI: `[35, 0, 420, 175]`.

**K02 | Far blue-gray mountain chain** — Multiple lower and higher peaks layered behind central town.; Cool low-saturation rock blue-gray and fading haze.; proposed size: height 25-130+ scene-dependent; material: M16; visibility: direct-visible; priority: P0; variants: 5.

**Modeling notes:** Several background depth bands, each with distinct silhouette; lower detail LOD.. Approximate screen ROI: `[400, 10, 890, 165]`.

**K03 | Right cliff temple hill** — Tall boulder pile under remote pagoda with many sheer rounded vertical splits.; Rock in gray-beige sunlight, deep crevices and patchy small trees.; proposed size: height 30-85 relative village; material: M15; visibility: direct-visible; priority: P1; variants: 3.

**Modeling notes:** Reserve flat summit pad and paths/ledges for pagoda; scatter plants only on pockets.. Approximate screen ROI: `[900, 10, 1200, 188]`.

**K04 | Village boulder / rock outcrop** — Small to medium smoothly broken boulders placed by water, walls and houses.; Mottled gray/brown faces with dark inner fissures, rare moss.; proposed size: diameter .6-5; material: M15, M02; visibility: direct-visible; priority: P0; variants: 15.

**Modeling notes:** 15-plus reusable silhouettes, 30-100% buried in soil.. Approximate screen ROI: `[0, 148, 600, 380]`.

**K05 | Stream stone and pebble scatter** — Mixed small round/flat stones border stream and sit at bends.; Wet darker gray where submerged, dusty gray-beige upland.; proposed size: diameter .08-.7; material: M02, M15; visibility: direct-visible; priority: P1; variants: 12.

**Modeling notes:** Stones oriented with stream; use pebbles at water turbulence points.. Approximate screen ROI: `[520, 335, 610, 560]`.


#### Water (4 assets)

**H01 | Narrow winding stream** — Narrow continuous blue-gray channel flowing down from wall culvert toward lower screen.; Water surface moderately reflective with bright white turbulent streaks.; proposed size: width 1.4-3.5; depth .25-.8; material: M17; visibility: direct-visible; priority: P0; variants: 1.

**Modeling notes:** Carve meandering bank into terrain; use water ribbon spline and depth opacity.. Approximate screen ROI: `[522, 331, 610, 560]`.

**H02 | White turbulence at stream bends** — Thin foam filaments and broken pale streaks tracing rocks, bends and constrictions.; Near-white specular flecks, pale cool-gray foam.; proposed size: bands .05-.5 wide; material: M18; visibility: direct-visible; priority: P1; variants: 5.

**Modeling notes:** Flow map follows stream tangent; low foam density in calm portions.. Approximate screen ROI: `[536, 373, 605, 544]`.

**H03 | Stream bank wet-soil transition** — Uneven muddy slopes with rock and rough grass from dry soil into water.; Dark wet brown at waterline, greener on higher bank.; proposed size: bank width .3-1.5; material: M09, M10, M15; visibility: direct-visible; priority: P1; variants: 4.

**Modeling notes:** Gradient vertex colors; embedded pebbles; creek depth must read at top-down camera.. Approximate screen ROI: `[505, 338, 620, 560]`.

**H04 | Culvert shadowed water patch** — Dark water emerges from a shaded shallow wall tunnel.; Bluish-black water with strong lip shadow and lightening downstream.; proposed size: 2-3 wide; material: M17, M02; visibility: direct-visible; priority: P1; variants: 1.

**Modeling notes:** Use light occlusion and darker underwater bed, not absolute black.. Approximate screen ROI: `[523, 335, 569, 383]`.


#### Props (16 assets)

**P01 | Tall red vertical town pennant** — Narrow rectangular red banners hang off upright sticks; dark circular / stamped marks.; Weathered brick-red cloth with almost black emblem and slight wrinkles.; proposed size: height 2.5-5, banner .4-1 wide; material: M19, M06; visibility: direct-visible; priority: P1; variants: 5.

**Modeling notes:** 2-3 pattern variants, bend cloth asymmetrically.. Approximate screen ROI: `[0, 240, 535, 338]`.

**P02 | Simple horizontal split-rail fence** — Short wooden stakes with two low horizontal beams; encloses garden and roadside houses.; Golden brown worn wood with dark joining pegs.; proposed size: height .7-1.2, section 1.5-3; material: M06; visibility: direct-visible; priority: P0; variants: 7.

**Modeling notes:** Straight, corner, end, gate, broken variant; uneven posts.. Approximate screen ROI: `[230, 350, 950, 560]`.

**P03 | Woven low reed fence** — Thin woven reed/repeated stick fencing around thatched houses and garden.; Pale ochre bamboo-like strips, dark lashings.; proposed size: height .8-1.3; material: M05, M06; visibility: direct-visible; priority: P1; variants: 5.

**Modeling notes:** Use mesh with geometry+alpha only for far LOD, avoid alpha overdraw near camera.. Approximate screen ROI: `[290, 385, 800, 558]`.

**P04 | Clay jars and water pots** — Rounded reddish clay jars, some with wide open mouths and dark interior.; Terracotta red-brown, spots of glazed shine and grime.; proposed size: height .4-1.3; material: M21; visibility: direct-visible; priority: P1; variants: 8.

**Modeling notes:** 4 silhouette variants: fat amphora-like, squat bowl, wide jar, tall jar.. Approximate screen ROI: `[488, 340, 950, 480]`.

**P05 | Crates and lumber boxes** — Small rectangular weathered wooden crates or storage boxes next to fences and workshops.; Mid brown boards, black joints and pale chipped edges.; proposed size: 0.3-1.2 each side; material: M06; visibility: direct-visible; priority: P2; variants: 8.

**Modeling notes:** Reusable box mesh with rotated plank textures and open-top option.. Approximate screen ROI: `[440, 320, 1115, 430]`.

**P06 | Grain / straw bundle bales** — Pale straw bunches scattered near huts and workshops.; Dry golden straw with warm-brown gaps and tied cord.; proposed size: length .6-1.6; material: M05; visibility: direct-visible; priority: P1; variants: 7.

**Modeling notes:** Bales with messy silhouette and ropes, several rotations.. Approximate screen ROI: `[350, 320, 1130, 419]`.

**P07 | Wooden benches and tables** — Simple rough slat benches and narrow rectangular tables along roads and within workshops.; Aged brown wood with sunlit scraped surfaces.; proposed size: bench 1-2 long; material: M06; visibility: direct-visible; priority: P2; variants: 8.

**Modeling notes:** Low cross braces and uneven seat plank thickness.. Approximate screen ROI: `[310, 389, 1070, 411]`.

**P08 | Logs and stacked planks** — Sawed timbers, timber piles and long plank stacks near far-right workshop.; Warm raw brown wood, visible end grain.; proposed size: length .8-4; material: M06; visibility: direct-visible; priority: P1; variants: 9.

**Modeling notes:** 3 log diameters, 5 plank lengths, surface roughness and endcaps.. Approximate screen ROI: `[850, 320, 1100, 418]`.

**P09 | Small two-wheeled wooden handcart** — Simple handcarts and transport objects around village labor areas.; Medium wood wheels/handles, dusty iron-gray hubs.; proposed size: length 1.5-2.8; material: M06; visibility: partly-inferred; priority: P2; variants: 4.

**Modeling notes:** Only interpret generic cart geometry; exact vehicle partly obscured.. Approximate screen ROI: `[760, 270, 1020, 370]`.

**P10 | Wooden wayside sign** — Small dark roadside board and thin vertical support visible outside workshop zone.; Dark wooden board with cool blue-black face.; proposed size: height 1.4-2.1; material: M06, M04; visibility: direct-visible; priority: P2; variants: 4.

**Modeling notes:** 1-2 board widths and blackened calligraphy decals if legible reference available.. Approximate screen ROI: `[905, 373, 1110, 447]`.

**P11 | Standing lamp / hanging lantern pole** — Thin lantern posts with small warm orange-red hanging lights near streets and buildings.; Dark timber/iron shaft and warm orange cloth lantern accent.; proposed size: height 2.5-4; material: M06, M19; visibility: direct-visible; priority: P2; variants: 5.

**Modeling notes:** At noon no emissive bloom is necessary; lantern mostly reads as physical object.. Approximate screen ROI: `[420, 185, 1170, 440]`.

**P12 | Marketplace fabric and ribbon** — White stall shade plus compact strips of colored cloth around village plaza.; White cream, vermilion and multiple faint festive accents.; proposed size: cloth flags .3-2 tall; material: M08, M19; visibility: direct-visible; priority: P2; variants: 6.

**Modeling notes:** Two-sided cloth mesh and simple wrinkle normal.. Approximate screen ROI: `[603, 136, 709, 192]`.

**P13 | Decorative garden planter** — Small wooden or stone-bordered planted boxes with flowers and vegetable leaves.; Muted beige wood or stone edge with green growth.; proposed size: size .5-2.5; material: M06, M09, M11; visibility: direct-visible; priority: P2; variants: 5.

**Modeling notes:** Use modular border tiles and instanced plant clusters.. Approximate screen ROI: `[485, 441, 579, 556]`.

**P14 | Wooden support brace and ladder** — Visible diagonal braces under open pavilions and workshop railings; short climbing supports.; Dark timber with highlighted angular edges.; proposed size: brace .7-2.5 long; material: M06; visibility: direct-visible; priority: P1; variants: 8.

**Modeling notes:** Build corner diagonals separately; no need every joint unique.. Approximate screen ROI: `[650, 230, 1110, 388]`.

**P15 | Guard / traveler scale figures** — Small stylized humans on road at gate and right foreground, helpful for evaluating building sizes.; Tiny contrasting dark/colored outfits.; proposed size: character height 1.6-1.85 (prototype); material: M06; visibility: direct-visible; priority: P2; variants: 3.

**Modeling notes:** For environment reference only: stand-in capsules acceptable for blockout.. Approximate screen ROI: `[695, 316, 1020, 558]`.

**P16 | Loose flowers, fallen leaves and stones** — Sparse small debris localized to roads, tree roots, fences and gardens.; Tan dirt, dark greens, pale blossoms, grays.; proposed size: object .03-.3; material: M09, M10, M14; visibility: direct-visible; priority: P2; variants: 12.

**Modeling notes:** Use distance culling and scattering masks rather than manual placing every grain.. Approximate screen ROI: `[0, 290, 1200, 560]`.


#### Background (3 assets)

**D01 | Layered cloud sky** — Soft blue daytime sky with broken diffuse white cloud clusters.; Blue cyan sky top, near-white broken clouds, little saturation in distant haze.; proposed size: sky atmosphere or dome; material: M22; visibility: direct-visible; priority: P1; variants: 1.

**Modeling notes:** Use procedural sky, soft cloud layers and low contrast near horizon.. Approximate screen ROI: `[0, 0, 1199, 150]`.

**D02 | Far rooftops and miniature hamlet cluster** — Dense tiny blue roof silhouettes interspersed with trees across mid/far valley.; Desaturated blue-gray tile roofs and warm hazy walls.; proposed size: roof clusters 3-15 wide; material: M04, M16, M10; visibility: direct-visible; priority: P1; variants: 10.

**Modeling notes:** Use low LOD prefabs instanced along valley; keep varying heights.. Approximate screen ROI: `[0, 80, 1200, 235]`.

**D03 | Layered atmospheric depth treatment** — Near houses sharply defined, far valley softer, far mountains cooler and less contrasty.; Blue-grey airy haze; sky-colored shadow lift.; proposed size: near 0-40, middle 40-180, far 180+ distance bands; material: M16, M22; visibility: direct-visible; priority: P0; variants: 1.

**Modeling notes:** Distance values are prototype-specific; adjust to preserve silhouette readability.. Approximate screen ROI: `[0, 35, 1199, 220]`.


### 11. Acceptance checks for visual fidelity

- [ ] Front two thatched roofs read as coarse fibrous GOLDEN VOLUMES, rather than wooden shingles.
- [ ] Gray wall lower foundation stones are 3-8 times the visible scale of fine upper masonry blocks.
- [ ] The gate has a passable arched tunnel with its OWN open pavilion on top.
- [ ] Blue roof tiles have visible repeating ribs and turned-up eaves near camera.
- [ ] Right hilltop pagoda remains a landmark above rounded rock mass.
- [ ] Main road is warm sandy earth, with discontinuous irregular stone strips, not fully paved road.
- [ ] Trees at multiple depths vary species, hue, canopy outline and age.
- [ ] Tiny flowing creek runs under wall and bends toward bottom of screenshot.
- [ ] Foreground farmyard is not overcrowded; density increases behind wall.
- [ ] Deep under-eave shadows coexist with soft warm daylight and blue mountain distance haze.
- [ ] 360-degree inspection has no hollow backs, clipped stream, exposed terrain gaps, or camera-dependent billboards near player.

### 12. Known unknowns / requests for better references

Single image cannot establish hidden facade designs, exact building dimensions, real stone brick count, backside of ridges, accurate roof-tile profile thickness, polygon counts, seed of vegetation scatter, actual terrain heightmap, original environment light configuration, or unseen roadway network. Multiple camera viewpoints, top view, close-ups, and one known reference measurement would significantly improve accuracy.

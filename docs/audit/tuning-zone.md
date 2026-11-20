# Tuning Zone: 3D model audit and what it supports

Model: "Volkswagen Golf GTI (2025)" by geyges on Sketchfab, Free Standard licence (`golf_gti_my25_lights_on.glb`, 19 MB, 372k triangles, 52 materials, 12 animations).
Served file: `public/models/golf.glb` (8.1 MB, 524,501 triangles), rebuilt with `tools/golf-model/build.mjs`: meshopt geometry, WebP textures at 1024 px (2048 px for the engine bay), the part splits below, and the engine bay described in its own section.

## What the model really contains, and what each option changes

| Option group | Part in the model | How it was made separate |
|---|---|---|
| Body colour, finish | Material `Rojo Kings`: body, 4 doors, boot lid | Already its own material |
| Bonnet | Top of `Ext_Body#Car_Paint` | Grown from the bonnet centre; the modelled panel gaps stop it (462 triangles) |
| Mirror caps | Island in `Ext_Door_FL/FR#Car_Paint` | Separate geometry island (453 triangles each), kept inside the door group so it follows the door animation |
| Front grille | Honeycomb island in `Ext_Body#Material_Atlas` | Separate geometry island (4,227 triangles) |
| Exhaust tips | Two islands in `Ext_Body#Material_Atlas` | Separate geometry islands (684 triangles) |
| Wheel finish | `Rim_*_JEREZ_19` meshes | Already separate meshes; tinting keeps the factory texture detail |
| Brake calipers | `Ext_Brake_*Caliper*`, `Ext_Brake_FR` | Already separate meshes |
| Ride height | Groups `EXT_BODY`, `EXT_DOORS`, `EXT_TRUNK`, `INTERIOR` | Moved down; wheels and brakes stay in place |
| Window tint | Side and rear glass, outer and inner faces | Already separate meshes; the windscreen is never tinted |
| Headlight lens | `Ext_Lights#Glass_Clear` | Already separate |
| Headlight LEDs (light line and light bar) | `Ext_Lights#SteeringWheel_Grip_01_AO` | Already separate; glows in the LED colour (see "Lighting") |
| Headlight reflector modules, housing finish | `Ext_Lights#Chrome_Squares_AO` | Already separate; own clone, so the rear lamp's chrome is not affected |
| Tail light outer cover | `Ext_Taillight#Glass_Clear` | Already separate |
| Tail light inner lens | `Ext_Taillight_Body#Glass_Red`, `Ext_Trunk_Lid_Light#Glass_Red` | Already separate |
| Tail light LEDs | `#Red_Plastic_Tailights` (body and boot lid), `#Blended_Triangled_Grid` (the triangle panel, glowing in its own printed pattern) | Already separate |
| Seat upholstery | Leather materials of `Int_Seats` | Already separate; the GTI red accent stripe is kept |
| Stitching | Material `Stitching Steering Wheel Red` (seats, wheel, cup holder) | Already separate; white thread texture tinted |
| Steering wheel | `Int_SW#Leather*` | Already separate |
| Dashboard and door trim | Material `Fabric FSB9JZ` | Already separate |
| Seat belts | `Int_Seats#Seatbelts` | Already separate |
| Headliner | `Roofliner Dark`, `Pillars Dark`, `Sun Visor Black` | Already separate |
| Ambient light | Material `Ambilight US` (dashboard and front doors) | Already separate; emissive colour changed |
| Centre console | `Int#Leather_Black_Smooth`, `Int_Cupholder#Leather` | Already separate meshes |
| Door panel inserts | `Int_Door_*#Suede_Black` | Already separate (four doors) |
| Floor carpet | `Int#Carpet_Legroom` | Already separate; the texture is almost black, so colours replace it with a flat matte colour |
| Doors | Animation "Front left door" | Played by the camera when it goes to the seats and the cockpit |
| Bonnet opening | `Ext_Hood` under a new `Hood_Hinge` node at the windscreen edge | Added by the build; the page rotates the hinge to 58° for the engine views, and closes it for every other view |
| Engine bay | New node `Engine_Bay#Scan` under `EXT_BODY` (152,206 triangles) | Added by the build from a free scan, see "Engine bay" below; moves with the ride height like the body |

"Factory" always restores the material exactly as the model ships it, so "Compare with factory" shows the real original car.

## Asked for but not possible with this model

| Request | Why | What it would need |
|---|---|---|
| Other wheel designs and sizes, tyres | The file has one wheel (Jerez 19") and one tyre | Separate wheel and tyre models with the same hub position |
| Bumpers, spoilers | Moulded into the body panels; no panel gap to cut along (a spoiler cut matched only 72 triangles) | A body kit model made for this car |
| Gear selector | The Golf 8.5 uses a small stalk behind the steering wheel, not a separate part | A cockpit model with a separate selector |
| Changing single engine parts (intake, covers, strut brace) | The engine bay is one scanned surface with one texture: the engine, battery and reservoirs are not separate objects | A modelled (not scanned) Golf 8 engine bay with separate parts |
| A Golf 8 engine bay | No free, reusable Golf 8 bay exists (see "Engine bay"); the one shown is an Audi A3 8V bay on the same MQB platform | A paid or commissioned Golf 8 bay model |
| Floor mats, side skirts, badges | Not separate parts (mats do not exist; skirts are body panels; badges are printed in shared textures) | Separate parts in the model |
| Dashboard colour | The dashboard shares its material with most interior plastics | A model where the dashboard has its own material |

## Interaction architecture

- `options.js`: sections, option groups, factory setup. A section is either a list of components (open one to see only its options and its close-up) or shows its few options directly.
- `camera-stops.js`: 32 named views (7 exterior, 7 close-ups, 4 lamp inspection views, 4 engine-bay views with the bonnet open, the door view and 9 cabin views) and `cabinWaypoint`, which sends the camera in and out of the cabin through the open driver door.
- `customise.js`: one function per option group; "factory" restores the shipped material.
- `useConfiguration.js`: setup with undo and redo (60 steps); reset is an undoable step; saved in the browser.
- `TuningScene.jsx`: camera rig (damped, around the car rather than through it, in the car's frame so it can follow the car), framing beside the panel, door and bonnet, the drive, part glow on selection, 360° controls and hotspots.
- `motion.js`: frame time, critically damped spring, suspension spring, and an interruptible quintic move. Every moving part uses these.
- `drive.js`: the drive across the screen when the reading direction changes (path, steering, trip state).
- `dust.js`: the dust particles.
- `car-parts.js` `rigChassis`: the moving parts of the chassis (see "Motion").
- `SectionPanel.jsx`, `OptionGroup.jsx`, `SummaryPanel.jsx`, `PerformancePanel.jsx`: interface.

Camera paths were checked by simulating the rig at 60 frames per second between every pair of views: no frame enters the bodywork, and every move arrives.

## Motion

### Why the car shook when the door opened (fixed)

Measured frame by frame in Chrome on the GPU. Two causes added up:

1. Every page update (each section reached while scrolling, opening a component, the language) re-rendered the 3D scene. drei then rebuilt the studio's environment map and redrew the contact shadow, a depth pass of the whole 524k-triangle car plus blur, at 60–90 ms a time. These hitches fell exactly when the camera and the door started to move.
2. The scene draws on demand, so the first frame after a pause got the whole pause as its time step. Exponential damping then jumped most of the way in one frame. Together with the hitches, the camera's speed swung 70-fold from one frame to the next and once went backwards.

Fixes:
- The studio and the scene are memoised, and the contact shadow is its own memoised component under the car.
- Section panels are memoised with stable props. Their children used to be a new array each render, so every panel and its icons re-rendered on every scroll step (about 55 ms in development).
- Frame time is capped at 1/30 s.
- The door and bonnet use critically damped springs: they leave and arrive with no jump in speed, never overshoot, and are exact at any frame rate. The door still turns on the model's own hinge animation.

Result while scrolling to the interior: no frame over 50 ms (production build), a smooth camera speed curve with no reversal, and the door opening from 5.8° to 65.2° with a bell-shaped speed curve (peak 116°/s).

Two related bugs found on the way:
- The language menu called `focus()` on the always-visible header controls, and Chrome scrolled the sticky header into place, moving the page by up to 490 px. Switching language from the Interior jumped to the Details section. Fixed with `preventScroll` (`components/Preferences.jsx`, every page).
- The steps scroll a section to 84 px above its top (the site's `scroll-padding-top`), but the camera counted a section as reached only when its top met the top of the window. Each section stopped at 93 % of its view, so the bonnet stayed 1.4° open on the Summary and did not fully open on the Engine. Progress now uses the same line the browser scrolls to.

### Into the cabin through the door (fixed)

- **Jitter between the door and the cockpit:** scrolling from the seats view to the cockpit moved the camera's goal along the line into the cabin. `cabinWaypoint`'s rule for leaving the car kept sending the camera back to the point outside the door whenever it was more than 0.3 m from it. The camera went in and out every few frames: 8 reversals and turns of up to 175° in one frame on a slow wheel scroll.
- **The fix:** between those two views the camera now runs on a fixed path (`doorRail` in `camera-stops.js`), a curve through the middle of the door opening, 0.25 m clear of the B-pillar. The straight line hit the B-pillar, which is why the waypoints were there. The camera's place on that path follows the scroll on a critically damped spring, and its aim and lens follow the same place. Result: 0 reversals and at most 4° of turn per frame for slow, fast, paused and back-and-forth scrolling.
- **Phones:** the portrait step-back now fades in between 1.6 m and 2.4 m from the car instead of switching at 1.6 m, so the camera does not jump there. No resting view lies in that band, so no view changed.

### Blank picture inside the cabin (fixed)

- **What happened:** after the framing change, any view with the camera inside the car (Ambient light, the cabin views) showed only the background colour, near-black in the dark theme, and stayed that way after leaving.
- **The cause:** part of the car was behind the camera, so the framing fell back to the view's subject through `lerp(subject, NaN, 0)`, which is NaN. The NaN screen offset poisoned the projection matrix and nothing was drawn, then carried over from frame to frame.
- **The fix:** `subjectX` returns the subject directly in that case.
- **Checked:** the trip from the exterior through the door into the cabin and back had no NaN in any state and the interior drew every time, in English and Arabic, light and dark. A language switch from the cockpit kept the interior on screen, and the regression pass is 28/28.

**Open:** at 1440×900 on the test machine's Intel HD 630, scrolling through the door still has frames of 50–200 ms, on every pass. Each resting view costs only 9–15 ms of GPU time, so the cause is not found yet. A phone-sized window is smooth.

### Changing language: the car drives across

The option panel sits on the reading side of the page and the car beside it, so English to Arabic swaps their sides. The car drives there instead of jumping.

- **Path:** a lane change of 4.2 m forward and 0.6 m sideways (quintic, so no steering at either end). The rear axle follows the path, as on a real car. It drives forward from English to Arabic and reverses back. The side of the lane change is the one that carries the car towards its new place on screen from the current view.
- **Timing:** an interruptible quintic move, about 2.6 s. Position, speed and acceleration stay continuous even when the language is switched back half-way: the car brakes and reverses, with extra time to brake. Peak speed 3.1 m/s, acceleration 3.6 m/s², 1.3 m/s² sideways.
- **Wheels:** each wheel and brake disc spins by the distance its own hub really rolls, so the front and the inside wheels turn at their own speed, backwards when reversing. The front wheels steer from the path's curvature with Ackermann geometry, up to 30°; disc and caliper turn with the wheel. Calipers do not spin.
- **Suspension:** the body pitches (0.9° nose up pulling away, down braking) and rolls (0.55° out of the turn) on a lightly damped spring that settles without bouncing. The body is one group (`Body_Motion`) holding the sprung parts; ride height still moves the sprung parts inside it, so no transform has two owners.
- **Camera:**
  - From far away it follows like a tracking shot, so the car pulls ahead, turns and comes closer. Close to the car or inside it, it rides with the car and never touches it.
  - The view offset moves the car along an eased path on the screen, from its old place to the middle of its new free space, at the car's own pace. It lands without drifting back.
  - The floor and background are plain, so once the car has stopped, car, camera and dust are moved back to the origin together. The image does not change: measured at 0.4 px.
- **Framing:** the car is centred in the measured free space between the option panel and the section rail. Before, the framing mirrored a fixed 12 % offset, but the car is not symmetric from most views, so in Arabic the longer rail overlapped its nose by about 90 px. When the whole car does not fit (close-ups, cabin), the view's subject is centred instead.
- **Dust:** soft particles at the contact patches. A little comes from every rolling tyre, and more from the driven wheels (front, or all four for the Golf R) while the car pulls away. The particles are thrown back against the wheel's travel, rise a little, spread and fade over 1.3–2.2 s. There are 220 at most in one buffer, drawn in one call, with no allocation per frame. The colour follows the light or dark theme.
- **Interface:** the panel and the rail move to the other side at once, as the page direction requires, but stay hidden until the car has left, then slide in from their edge (from 1.15 s, 0.7 s). The animation restarts on every change.
- **When it does not drive:**
  - Phones: the car stays centred above the bottom sheet, so it has nowhere to go.
  - Reduced motion: the framing changes at once.
  - The 360° view: the framing is not used.
  - Before the model has loaded.

  Switching to 360° during a drive ends the drive at once.

### Tests

Headless Chrome on the Intel GPU, 60 fps, recording every drawn frame from the scene's own render hook:
- English to Arabic and back from the three-quarter view: the car's screen path is monotonic (890 px to 614 px and back).
- The same switch from the driver's seat, beside the open door, at the wheel close-up and at the engine bay:
  - In the cabin and beside the door the camera does not move at all relative to the car (0 m).
  - Elsewhere it stays at least 1.7 m from the bodywork.
- Five switches within 1.3 s: the car ends where the last language puts it, with no error.
- The drive simulated at 30, 60 and 144 fps gives the same path, timing and forces.
- A 4× slower CPU gives the same timing and end position.
- Phone (390×844), reduced motion and dark mode were also checked.
- The door opened and closed three times: 65.5° open and 5.8° closed each time.
- The regression pass covers sections, views, paint, undo and redo, compare, ride height, door, cabin views, components, Escape, bonnet, 360° outside and inside, hotspots, and reset and its undo. It passes 28/28 in English and Arabic, at 1440×900 and 390×844, with no console errors.

Not measured: a real phone GPU, and frame rates other than the test machine's 60 fps (simulated instead).

## Lighting

### What the user can change

The Lights section lists three rows: Front lighting, Rear lighting and Window tint. Each lamp row opens all of its options at once and frames its lamp.

| Lamp | Options |
|---|---|
| Front | Headlights off, daytime (DRL), low beam, high beam. LED colour by colour temperature: factory 6000 K, pure white 5500 K, warm white 4300 K, blue-white 7500 K, ice blue 9000 K. Lens clear, light smoke or dark smoke. Reflector housing chrome, black chrome or gunmetal. |
| Rear | Rear lights off, on, brake. Inner lens red, ruby or crystal clear (the LEDs stay red). Outer lens clear, smoked or dark smoke. |
| Looks | Modern LED, Ice blue, Stealth, Classic warm and Crystal set both lamps at once, as one undo step. |

The lens, the LED emitters, the reflectors and the light that leaves the lamp are separate: lens and housing are materials (`customise.js`), the glow and the light are `lighting.js`, which alone owns the emission of the LED parts.

### How the light is made

- **Emission:** the LED parts of the model glow in the LED colour. Strength is kept low enough that the colour survives tone mapping instead of burning to white, and the emitted colour is a deeper version of the swatch. The reflector modules light up behind the lens only when the beam is on. The triangle panel glows in its printed pattern, using its colour texture as its emission map.
- **Sequence:** each part follows a critically damped spring, independent of frame rate. The DRL lights first, then the main beam once the DRL is nearly on, like a real lamp's start-up. Rear lights and brake light are separate channels.
- **Floor light:** a beam pattern drawn on the floor ahead of each headlamp. Low beam has a bright band and a cut-off a few metres out, high beam reaches further, and the rear lamps leave a soft red wash behind the car.
  - I first used real spotlights, but every one of the car's 173 physical materials then evaluated them on every frame, and GPU time per frame nearly doubled (door view 14.8 to 28 ms).
  - The floor patterns cost nothing when the lights are off, and GPU time stayed at the previous figures (door view 14.4 ms, cockpit 11.1 ms).
- **Beams:** faint additive cones from the headlamps, stronger while the studio is dimmed.
- **Studio:** while the Lights section is on screen with a lamp on, the environment reflections drop to about 36 %, the ambient light to about a third, and the backdrop, floor and fog to a mid grey (near-black in dark mode). The car stays readable, and it is never black. Leaving the section or opening 360° restores it, smoothly. Only scene values change, not renderer settings.
- **Camera:** opening a lamp row moves to a low three-quarter view of that lamp. Switching the lamp on moves in on the driver-side lamp (`frontLitOn`, `rearLitOn`), and switching it off steps back. Closing the row returns to the section's view. All of it uses the existing focus views and damping: no second camera system.
- **The drive:** the lights live in the drive group, so they travel with the car when the language changes.

### Tests

- Front and rear, every option. Seven fast switches of the headlights and five LED colours in under a second settled on the last choice.
- A look is one undo step, the studio dims and restores, the headlight hotspot opens Front lighting, and the Summary shows proper labels.
- The lights travel with the car during the language drive.
- Reduced motion switches lights and studio at once.
- A setup saved with the old "LED light signature" turns into daytime lights plus rear lights for returning visitors.
- English, French and Arabic (colour temperatures written in Arabic, so they read correctly right to left), light and dark, 1440×900 and 390×844, with no console errors. The regression pass is 28/28.

### Limits

- The model has no separate fog lamps or indicators, and no separate projector lenses or individually addressable LEDs, so there is no sweeping welcome animation across single LEDs.
- Rear lamps stay red, as the law requires: only the lens tone changes.
- There is no bloom pass: the scene has no post-processing, and adding one would cost more than it shows on integrated graphics.

## Engine bay

### Source and licence

| | |
|---|---|
| Asset | "Audi TFSI engine2" by SPLEEN VISION on Sketchfab: https://sketchfab.com/3d-models/audi-tfsi-engine2-18f29cb6155e423c904bba7a98ad7f8c |
| What it is | A photogrammetry scan of a real Audi A3 8V engine bay (2.0 TFSI, MQB platform, the platform the Golf uses) |
| Licence | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): reuse and modification allowed, commercial use included, with credit |
| Credit | Shown under the 3D view on the Tuning page in English, French and Arabic, with links to the model and the licence, and saying it was changed |
| Downloaded | Free download from Sketchfab while signed in; nothing bought |

### What was changed (`tools/golf-model/bay.mjs`)

1. Simplified to 30 % of its triangles (meshopt, open edges kept so no cracks appear), 152,206 triangles left.
2. Turned to face the car's nose, scaled to 0.874 (98.5 % of the bonnet width), placed with the firewall 2 cm ahead of the bonnet's rear edge, cut to the bonnet's outline (1.2 cm inside it) and lowered so there is 4 cm between the highest part and the closed bonnet. The closed bonnet hides it completely; no part pokes through the body.
3. Audi badge on the engine cover removed: the four rings are painted over in the texture and the badge plate is flattened into the cover.
4. Texture reduced from the 16K scan to 2048 px WebP (552 KB).
5. Closing pieces added where the scan has holes: a firewall, a cowl panel and a floor under the bay, in dark matte grey.
6. Bonnet: `Ext_Hood` hinged on a new `Hood_Hinge` node at the windscreen edge, the paint made double-sided so the underside shows, and a black insulation pad added under it.

### Approximations

- It is an Audi A3 8V bay, not a Golf 8 one: the engine (EA888) and the layout are the same family, but the covers, intake and some fittings differ from a real Golf GTI.
- The firewall, cowl and floor are simple flat panels, not modelled parts.
- The hinge position and the 58° opening are chosen to look right; they are not taken from Volkswagen data.
- Scale is fitted to this car's bonnet, so the bay is about 13 % smaller than the scanned car.
- The scan is one surface: lighting on it is baked in the photos, and its parts cannot be changed or highlighted one by one.

### Candidates checked and not used

| Candidate | Why not |
|---|---|
| A free Sketchfab scan of an Audi A3 8P bay | Older platform (PQ35), not the Golf 8 one (MQB) |
| A free air-cooled VW engine | Wrong engine for a Golf |
| Paid Golf engine-bay models | Not bought, on request |
| TurboSquid | The site blocked automated browsing; not bypassed |

### Tests

- Bonnet closed and open, from the front, three-quarter, side and the four engine views, at 1440×900 and 390×844, light and dark, English, French and Arabic: no hole in the body, no part through the closed bonnet, no console error.
- The scripted test of every existing feature (19 checks: sections, views, cabin, undo/redo, compare, 360°, hotspots) passes on the new model.
- Leaving the engine views closes the bonnet; with reduced motion it opens and closes without animation.

## Showroom: six cars

The Tuning Zone shows six cars, one at a time. The Golf GTI is the default and keeps everything above. The selector above the car has previous and next arrows; the car's name opens a panel with all six (picture, make, model, body).

### The cars and their models

| Car | Model (Sketchfab) | Author, licence | Size on the floor (w × h × l, m) | Triangles | File |
|---|---|---|---|---|---|
| Volkswagen Golf GTI | Volkswagen Golf GTI (2025) | geyges, Standard | 2.095 × 1.489 × 4.291 | 518,801 | `golf.glb`, 8.1 MB |
| Audi RS 6 Avant | "Audi RS7 Sportback – Realistic Car 3D Model" | DevPoly3D, CC BY | 1.887 × 1.467 × 4.995 | 447,136 | `rs6.glb`, 4.7 MB |
| BMW M3 Competition | 2021 BMW M3 Competition (G80) | DisneyCars, CC BY | 2.082 × 1.45 × 4.793 | 380,865 | `m3.glb`, 7.8 MB |
| Volkswagen Tiguan | Volkswagen Tiguan (2025) | geyges, Standard | 2.163 × 1.677 × 4.694 | 365,088 | `tiguan.glb`, 7.8 MB |
| Mercedes-AMG C 63 Coupé | Mercedes C63 Coupe | ishaknapitupulucxr2, CC BY | 2.03 × 1.414 × 4.748 | 569,239 | `c63.glb`, 9.3 MB |
| Toyota GR Supra | Toyota Supra MK5 A90 | pryanex, CC BY | 1.903 × 1.232 × 4.379 | 428,112 | `supra.glb`, 5.1 MB |

- The Audi model is sold as an RS 7 Sportback, but its body is an RS 6 Avant (estate roof, rear doors and tailgate). It is named "RS 6 Avant" on the page, as decided.
- Every car is scaled to the real car's length, so the six keep their true sizes against each other.
- The page credits the car on the floor: title, author, licence and a link, plus a trademark line.

### What each car offers

The registry (`src/pages/tuning/vehicles.js`) says, per car, which option groups its model really supports. Every panel, hotspot, light look, summary row and camera view reads it, so no option shows that would not change the car.

| Car | Paint, finish, ride height | Calipers | Window tint | Lights | Interior | Doors and cabin |
|---|---|---|---|---|---|---|
| Golf GTI | yes | yes | yes | all | all | opens, cabin views |
| RS 6 Avant | yes | yes | no (glass shared with lamps) | front on/colour, rear on | seats | through the window |
| M3 Competition | yes | yes | yes | front on/colour, headlight lens, tail lens | none (cabin is one part) | none |
| Tiguan | yes | no (one texture with the rims) | yes | all, tail tone | all, ambient light | opens, cabin views |
| C 63 Coupé | yes | yes | no (glass shared with lamps) | front on/colour, rear on, tail lens | seats | through the window |
| GR Supra | yes | yes | yes | front on/colour, headlight lens, rear on | seats | through the window |

- Rims, mirrors, grille, bonnet, exhaust, the engine bay and performance figures stay Golf-only: on the other models those parts share materials with the body, or there is no engine.
- Each section says what its model lacks, in a short note.
- On the other cars the paint panel starts with "Factory colour", the model's own paint. The factory choice of a material group keeps that model's own material, so it is called "Factory" with a neutral grey swatch, not the Golf's "GTI red".

### Changing car

- The car on the floor drives away, and the next one drives in from behind the camera into the same place. The wheels turn with the distance travelled, the front wheels steer, the body settles on its springs and dust rises. Both paths are quintic moves, so speed never jumps. Each car follows the same path scaled to its own length.
- The director in `TuningScene.jsx` keeps one state: the car on the floor, the next car, and a phase (idle, loading, swapping).
  - A choice starts loading the next car. While it only loads, a newer choice replaces it, or cancels it when it is the car already on the floor.
  - During a swap, choices wait; when the swap ends the latest one starts.
  - Rapid clicks therefore always end on the last choice, with one car on the floor.
- The page dims the panels and shows "Next car on its way" while cars move. This follows the scene's real phase, not the last click, so it stays right after a choice is taken back.
- The arriving car waits 1.1 s after the leaving one sets off, less on a portrait screen, which loses the leaving car sooner.
- A language change during a swap ends the leaving car's language drive where the page now is; the arriving car takes the new side.
- Each car keeps its own setup and undo history, saved under its own key (the Golf keeps its old key, so earlier setups are kept).
- Camera framing is per car: every view, the cabin path, the hotspots and the lamp light are scaled from the Golf by the car's width, height and length. Cars without opening doors get a view through the driver's window instead of the cabin views.

### Loading and memory

- A car's model loads only when it is chosen. Four seconds after a car arrives, the next one in the line loads in the background, unless the visitor asked to save data.
- Before a swap starts, the waiting car's textures are uploaded and its shaders built. One draw with both cars in view, clipped to one pixel of the canvas, builds the shaders of the see-through glass pass too. Without this, the first frames of a swap stalled for 150–750 ms.
- A car that leaves releases its copy: its own materials, its two pattern textures and its contact shadow. drei's ContactShadows kept two 1024² render targets per car, so the project uses its own copy (`ContactShadow.jsx`), which also waits until the car is visible before drawing its shadow.
- Loaded models stay cached, so going back to a car is instant.

### Tests

Scripts in headless Chrome on the GPU:

- **Showroom (`showroom-test`, 69 checks):**
  - every next-arrow swap through all six cars and back;
  - the previous arrow;
  - choice from the panel, the panel's focus and Escape;
  - three rapid clicks, and next then previous at once;
  - per-car paint kept after a round trip;
  - a language change during a swap.

  Each swap checks:
  - the car arrives and is the only car in the scene;
  - it parks exactly where the last one stood;
  - the two cars stay more than 2.2 m apart;
  - the floor is never empty for more than 1.2 s;
  - both cars' wheels turn.

  It ran at 1440×900 in English and French and at 390×844 in Arabic: 69/69 each time.
- **Golf suite:** 28/28 at 1440×900 in English, and at 390×844 in Arabic, light and dark.
- **Tiguan and RS 6 checks:**
  - the Tiguan door opens and closes, and its seven cabin views stay in its cabin;
  - the RS 6 headlights switch on.
- **Language drive:** the Golf, Tiguan and Supra cross the screen with turning wheels.

Measured in the test browser:

| What | Desktop | Phone |
|---|---|---|
| Longest frame while a car moves | 30–76 ms (up to 265 ms before the warm-up) | 22–54 ms |
| Longest empty floor during a swap | 0–0.35 s | 0.2–0.7 s |
| A swap from click to parked | 6–10 s (the first load of a car included) | 6–10 s |

- Over three laps of six swaps, the renderer's geometry count stays flat. The texture count is flat over ten swaps between cars already visited.
- The production build passes.

### Limits

- The test browser's GPU is slower than a recent phone or laptop, so these frame times are an upper bound. Real devices were not measured.
- The C 63 model is the heaviest (569k triangles). Simplifying it further dented the bonnet and doors, so it was kept as built.
- Calipers on the other cars and the Tiguan's interior groups use the Golf's colour list. Their factory choice is the model's own material.

### Rebuilding the showroom models

```bash
cd tools/golf-model
node showroom.mjs rs6 /path/to/rs7/scene.gltf        # also m3, c63, supra (settings in showroom-vehicles.mjs)
node keep.mjs /path/to/tiguan.glb ../../public/models/tiguan.glb
node slim.mjs ../../public/models/m3.glb --textures 512
```

`showroom.mjs` finds the four tyres, turns the car nose to +z, scales it to the real length, splits each wheel into a turning part and a still brake part, and gives the configurable materials their common names ("Body Paint", "Brake Caliper"…).

The selector pictures (`public/showroom/<id>.webp`, 640×360) are drawn with `tools/golf-model/preview.html?car=<id>&thumb=1&dir=0.7,0.16,-0.7` on the dev server, then trimmed and saved with sharp.

## Camera and studio

### What changed

- **Opening shot (2.4 s).** The camera finds the car low and almost head-on, then arcs about 35° round to the three-quarter view while it rises and draws closer, and comes to rest. The path is a quintic ease, so it starts and ends with no jolt. It never blocks the page: a scroll, a click on a view or the 360° view ends it at once and the springs carry on from its speed. It is skipped with reduced motion, and when the page opens part-way down. Its clock uses the clamped frame time, so the frame that compiles the car's shaders does not skip the start. (`introPose`, `CameraRig` in `TuningScene.jsx`)
- **Springs instead of exponential damping.** Outside the car the camera moves on critically damped springs: its angle, height and distance around the car, its aim and its lens.
  - Exponential damping starts each move at full speed; a spring leaves at rest, gathers speed and settles with no overshoot.
  - A new goal half-way keeps the current speed, so rapid clicks never jerk.
  - Following the scroll uses ω 7.5; moving to a chosen shot uses ω 4.4, which takes about 1 s.
  - Near and inside the cabin the camera keeps its straight moves and door waypoints, so its path through the door opening is unchanged. (`moveCamera`)
- **Compositions.** The views are still scaled per car by the frame (`setFrame`), so every car fills its shots the same way.

  | View | Before | Now | Why |
  |---|---|---|---|
  | Three-quarter (hero) | 1.75 m high, 32° lens | 1.36 m, 27°, further back | Belt-line camera and longer lens: less distortion, stronger stance |
  | Front, rear | 1.15–1.25 m, 26° | 0.98–1.08 m, 24° | Lower, more imposing |
  | Side | 8.4 m away, 30°: the nose was cut by the option panel | 12.6 m, 25° | The whole profile fits beside the panel, flat like a press photo |
  | Wheel | Front three-quarter, 28° | Nearly square to the front wheel at hub height, 26° | The whole rim and the caliper behind it |
  | Summary | Rear three-quarter, high | The other front three-quarter, low | A finishing beauty shot, different from the opening one |

  The lamp, engine-bay and cabin views are unchanged; they were tuned in the lighting and cabin work.
- **Phones.** The page measures the room between the console and the option sheet (where the sheet rests once its section is reached). The camera then centres the car in that room.
  - A shot of the whole car steps back (up to 1.6×) when the room is too short for it.
  - Close-ups and cabin views centre their subject at their own size.
  - The size is worked out from the shot itself, not from the moving camera, so it settles at once with no feedback.
  - On phones up to 780 px tall the sheet takes 44% of the height instead of 50%. (`placeShot`, `measureFraming`)
- **Fog follows the camera.** The floor fades into the background a fixed way behind the car, so the far side view and portrait screens (which step back up to 2×) do not fog the car.
- **Studio light.** A thin bright strip on each side at belt height draws a horizon line along the doors and wings, the way a photo studio shows a car's curves.
  - It is baked into the environment map once, so it costs nothing per frame.
  - Tone mapping stays ACES Filmic. Neutral and AgX were compared on the same frames: both looked flatter, and the lamp glow colours are tuned for ACES.
  - There is no bloom or post-processing, and no continuous idle drift: the scene still draws only while something moves, which matters on integrated GPUs.

### Camera tests

| Test | Result |
|---|---|
| Opening shot speed per frame (desktop and phone) | Smooth bell curve: starts at 0.1 mm per frame, peaks about 6 m/s, ends at rest after 2.35 s |
| Scroll during the opening shot (`cam-interrupt`) | No jump: worst frame 1.5–1.9× its neighbours' step (limit 4×) |
| Seven rapid section clicks (`cam-interrupt`) | No jump (1.5–1.7×); comes to rest on the last section |
| Reduced motion | No opening shot; the camera does not move on load |
| Into the cabin, through the views and out (`cabin-path`, Golf at 1440 and 390, Tiguan) | 0 frames in the bodywork, 0 sharp reversals |
| Tiguan door and cabin views (`tiguan`) | 5/5 |

## Prices

### Data (`src/pages/tuning/pricing.js`, the only place that holds a price)

- Amounts are whole Algerian dinars (integers), `CURRENCY = "DZD"`.
- **`ILLUSTRATIVE = true`: these are demo prices, not dealer offers or market prices.** The page says so under every total.
- `OPTION_GRADES` gives the kind of upgrade each option is, the same on every car. For example, a paint is standard, metallic or special; a seat is leather or alcantara.
- `PRICE_LISTS[car]` gives each car's price per grade, written out for each of the six cars and only for the groups that car has. No car borrows the Golf's prices.
  - `base` is the car's own price. It is `null` on every car: this site lists real cars for sale and their dealer prices are not known.
  - Set a number there to show a car row in the breakdown and add it to the total.
- A car's own factory option is always included (0).
- The display-only groups are never priced and never in the total:
  - headlights and rear lights on or off (shown only to see the lamps);
  - engine and tuning stage (figures to compare).
- `quoteFor(setup, car)` builds the quote from the car's setup each time, never by adding step by step. So:
  - replacing a wheel finish replaces its price;
  - removing an option removes it;
  - nothing can be counted twice;
  - each car keeps its own quote, because each car keeps its own setup.
- Amounts are written like every price on the site: "130 000 DA", Arabic "130 000 دج". Signed amounts are wrapped in Unicode isolates, so "+95 000" stays in one piece in Arabic.

To use real prices, edit `PRICE_LISTS` only.

### Examples (illustrative, DA)

| Option | Golf | RS 6 | M3 | Tiguan | C 63 | Supra |
|---|---|---|---|---|---|---|
| Metallic paint | 85 000 | 140 000 | 130 000 | 110 000 | 135 000 | 120 000 |
| Coilovers (−35 mm) | 190 000 | 320 000 | 300 000 | 230 000 | 310 000 | 280 000 |
| Leather seats | 240 000 | 380 000 | not on this model | 290 000 | 360 000 | 320 000 |
| Window tint | 18 000 | not on this model | 22 000 | 26 000 | not on this model | 20 000 |

Free on every car: standard colours (pure white, deep black, silver), gloss and metallic finishes, ambient light colours, and the factory choice of every group.

### Interface

- **Console:** the car selector and a price pill share one row at the top centre, on every screen size. The pill shows "Options" over the total.
- **Changing the total:**
  - The total counts to its new value in 0.5 s, at once with reduced motion.
  - A short note under the pill (2.4 s) names what changed: "Pearl white +160 000 DA", "Included", "… removed −45 000 DA", or "4 options updated +114 000 DA" for a lighting look.
  - A car change, compare mode and an open breakdown show no note.
- **Breakdown:** opened from the pill as a dialog. It lists:
  - the car;
  - the car price if one is set;
  - the paid options, each with a remove button (back to factory, one undo step);
  - the included changes;
  - a large total and the illustrative-prices note.

  Escape and a click outside close it; focus returns to the pill.
- **Options:**
  - colour and material choices show "+X DA" under their name when they cost something;
  - each group's title line shows "<option> · +X DA" or "· Included";
  - the list rows show the price of the chosen option;
  - the five-option finish choice keeps its prices in the tooltip and the screen-reader name, because they do not fit under the labels at 360 px.
- **Summary section:** each change with its price, "Included" or "Not part of the price", then the total.
- **Screen readers:** the live announcement gives the change and the new total.

### Price tests

- Unit tests (`tools/tests/pricing.test.mjs`, 7/7) check:
  - every car's list is complete for the options it shows, with nothing for groups it lacks;
  - factory is 0;
  - replace, remove and free options;
  - each car keeps its own quote;
  - integers only;
  - a car price is added once.
- Browser tests (`price-test`, 37 checks) cover:
  - adding one and several options, replacing (bronze 95 000 replaces gloss black 60 000), a free option;
  - removing from the breakdown, a lighting look (4 options, +114 000), undo and redo;
  - the RS 6 and back, each with its own total;
  - Summary total, breakdown against `pricing.js`, currency format;
  - the note showing and going;
  - the console clear of the car, the toolbar and the car panel.

  Results: 37/37 at 1440×900 English and French, 390×844 Arabic, 390×844 English dark, and 360×740 Arabic with reduced motion.

## Request scene: asking for the car

"Request this car" sits at the end of the Summary section and of the price breakdown. It opens a full-screen night showroom (`src/pages/tuning/request/`):

- the visitor's car stands in the middle, as configured;
- an Audi (the RS 6 Avant) on the left and a Mercedes-AMG (the C 63 Coupé) on the right drive in out of the dark and park on either side;
- the request form appears in the middle.

The configurator's own 3D view is put away while it is open, so the page keeps one WebGL context. On return the setup is as it was, and the opening shot does not play again.

### The script (`choreography.js`)

| Time | Chosen car | Side cars | Camera |
|---|---|---|---|
| 0–1.5 s | Light signature at 0.55 s, low beam at 1.35 s, in the dark | Out of sight behind | Close on its headlamp, easing back |
| 1.6–5 s | Lights on | Drive in from 12 m behind along a curve, wheels turning and steering. Their lamps light at 2.0 s (Audi) and 2.3 s (Mercedes). Fog rolls off their rear tyres. | Swings out and rises: the reveal |
| 5.45–7.9 s | Main-beam flash twice at 6.7 s | Reverse into place while the nose swings in 21°: the flank shows, and their beams cross ahead of the chosen car. Fog swells where each stops. | Low tracking shot on the Audi's side, then the last approach |
| 8.6 s on | Steady | Parked in a V | Still: no movement once the composition is set |

- **The two side cars mirror each other**, the Mercedes 0.32 s behind the Audi.
- **Clearance:** neither side car ever comes nearer the middle than 1.88 m, which leaves at least 0.8 m beside the chosen car.
- **Timing:** every move is a quintic ease; the camera's pace between its shots is a monotone cubic, so it never runs back and stops without a jolt.
- **Composition:**
  - From 4.6 s the picture slides so the cars end up under the form on wide screens, and above it on phones. The page measures where the form is.
  - The form comes in at 6.2 s, while the side cars are still parking, and never covers the chosen car.
  - The final shot is fitted to the screen: all three cars on wide screens; the chosen car with the side cars' inner halves and their beams on phones.
- **Reduced motion:** the scene opens straight on the final composition, with the form.
- **When the request is sent:** the chosen car flashes its main beam twice and the side cars once.

### Light, fog, reflections (`smoke.js`, `beams.js`, `RequestScene.jsx`)

- **Headlights:**
  - The cars' own lamp parts light through the configurator's lighting code, with the same ignition.
  - Each lamp's place is read from its model's lamp parts.
  - Each lamp also gets a light shaft: an open cone shaded like light crossing moving fog, with 3D noise drifting through it, fading with distance and into the floor.
  - A flare sits on the lens, with an anamorphic streak, strongest when the lamp faces the camera.
- **Fog:**
  - Up to 260 soft puffs: a low layer drifting over the floor, trails thrown off the side cars' rear tyres while they move, and swells where they stop.
  - Each puff's shader adds the light it scatters from every one of the six beams it sits in, stronger when looking up the beam (forward scattering). So the beams show where the fog is, and the fog glows where the beams are.
  - Puffs are sorted back to front each frame, and thin out near the camera so it never flies into a white wall.
- **Floor:** a blurred planar reflection (drei `MeshReflectorMaterial`, 512 px) on a dark floor, with a soft key light from above the chosen car and each car's contact shadow.
- **Bloom** (three's `UnrealBloomPass`) on the lamps, flares and beam cores, then ACES tone mapping.
- **Quality:**
  - Phones and devices with 4 GB of memory or fewer, or 4 or fewer CPU cores, start without the reflection, with fewer puffs and at pixel ratio 1.
  - Any device steps down by itself if its frame rate drops (drei `PerformanceMonitor`).
- **Side cars:** they keep their factory finish. If the visitor's car is itself the RS 6 or the C 63, its side twin is the factory one.

### The form and the request

- **Fields:**
  - full name, phone number and wilaya are required;
  - email and message are optional;
  - the same phone rule as the inspection form;
  - the site's list of 58 wilayas.

  The form also shows the car with its options and total, folded.
- **Errors** sit under their field, and focus goes to the first one.
- **Sending:** `submitCarRequest` posts `POST /api/tuning-requests` with the car, the setup, the priced lines and the totals.
  - The server checks every field, and that the totals add up.
  - It saves the request as **pending**, never approved by itself, and notifies the admins.
- **Confirmation:** the reference (TZ-n, copyable), "Pending review", and a link to `/track?id=TZ-n`.
- **There are no customer accounts on this site.** A request belongs to its applicant through the name, phone and email they give. The reference plus the phone number lets them follow it on the Track page, as with inspection requests.
- **Admin:** the "Car requests" page (`/admin/car-requests`) shows:
  - the applicant, the car, the configuration with its prices and the total;
  - Approve or Reject, with a note for the applicant;
  - who decided and when.

  The decision then shows on the Track page.

### Measured (headless Chrome on this machine's GPU)

| | Desktop 1440×900 (full quality) | Phone 390×844 (light quality) |
|---|---|---|
| From the click to the first frame (all three cars ready) | 2.0–3.0 s | 2.1 s |
| Frame time during the script | median 16.7 ms, 95th percentile 50 ms, worst 67 ms | median 16.7 ms, 95th percentile 16.8 ms, worst 50 ms |

### Request tests

- **`tools/tests/request-choreography.test.mjs` (3 tests):**
  - the side cars never cross into the middle or come nearer than 1.88 m, and never jump in place or heading;
  - the chosen car is on screen and in front of the camera at every moment, at six screen shapes;
  - the camera never jumps and is still at the end.
  - It found a rounding bug: one frame would have drawn the Audi at NaN.
- **`tools/tests/browser/request-flow.mjs` (20 checks)** at 1440×900 English and French, and 390×844 Arabic: 20/20 each. It covers:
  - both entry points, one canvas, Escape, the setup kept;
  - the empty form's three errors and focus, bad phone and email;
  - sending: the confirmation, the stored request (pending, the car, applicant, configuration and total), tracking;
  - the admin's list and decision reaching tracking;
  - no console errors.
- **API and admin pages:** `tools/tests/car-requests-api.mjs` (31 checks) and `tools/tests/browser/car-requests-ui.mjs` (16 checks, 3 layouts).

Test requests are deleted at the end of each run.

## Repair experience (Phase 1: the customer side)

"Request a repair" (an accent pill in the Tuning Zone top bar) opens a full-screen night studio where the car is the centrepiece and a glass panel walks the customer through reporting a problem. It reuses the configurator's car-building and the request scene's studio, so it adds no new 3D infrastructure. Phase 2 (the admin quotation, scheduling and the customer's accept/decline) is not built yet; the admin can only view requests so far.

There are **no customer accounts** on this site, so a repair is identified the same way as inspections and car requests: a reference (`RP-n`) plus the phone number, followed on the Track page. "My repair requests" is the Track page.

### The scene (`src/pages/tuning/repair/RepairScene.jsx`)

- One car (the car currently shown in the Tuning Zone) on a dark reflective floor.
- **Automotive lighting:** a key light from high front, a cool blue rim from one side and a warm red rim from the other, soft exponential fog, a studio environment map, and a blurred planar floor reflection (drei `MeshReflectorMaterial`, dropped on weaker devices).
- **Camera:** a short opening move (a wide establishing shot, in towards the front, then a gentle swing to a resting three-quarter) over ~2.8 s, then free orbit/zoom with `OrbitControls`. One controller drives both, so the intro and the manual controls never fight. Reduced motion opens straight on the resting shot.
- **Clickable areas:** pins mark the engine bay, a front wheel, the bodywork and the cabin. Clicking a pin starts a problem report for that area and the camera frames it; selecting a category in the panel lights and frames its pin. This is a **reporting and location tool, not a diagnosis**. Categories whose part is not on the model (transmission, "something else") have no pin and say where instead — the graceful fallback. The pins are markers at known points, so they work on all six cars without per-model mesh work.
- **Quality:** full on desktop, reduced on phones / low-memory / low-core devices, and it steps down by itself if the frame rate drops (`PerformanceMonitor`). One WebGL context: the configurator's canvas is put away while the repair scene is open.

### The flow (`RepairExperience.jsx`, `repair-areas.js`)

Four steps in a glass panel (a bottom sheet on phones), the car staying the hero beside/above it:

1. **Vehicle** — this shown car, or a different one the customer describes (make, model, year, engine, mileage, registration, notes). The panel says plainly that the 3D car is a demonstration model, distinct from the customer's real vehicle.
2. **Problems** — a category grid (engine, transmission, brakes, suspension, electrical, air conditioning, bodywork, tyres & wheels, interior, something else), multi-select, tied to the 3D pins. Each problem: what's happening (required), a severity (minor → urgent), and on "Add more detail" the symptoms, when it started and extra notes (progressive disclosure). Up to 6 photos (jpg/png/webp, ≤5 MB).
3. **Your details** — name, phone, email (optional), best way to reach you, preferred date and time, comments.
4. **Review** — the vehicle, the problems with their severity, the photo count and the contact, then **Send repair request**. A note says no price or date is given until the garage reviews it.

Each step validates on **Continue** and shows errors in place; the dialog traps focus, Escape closes it, and changes are announced to screen readers.

### Submission and tracking

- `submitRepairRequest` posts multipart `/api/repair-requests` (a JSON `payload` + the images). The server validates every field and the allowed sets, saves the request as **submitted** (never priced, never auto-accepted), stores the images, and notifies the admins.
- Confirmation shows the reference `RP-n` (copyable), "Under review", and a link to `/track?id=RP-n`.
- The Track page accepts `RP-n` (alongside inspection numbers and `TZ-n`) and shows the vehicle, the number of problems, the status and the date. No price or appointment yet.
- **Admin (read-only in Phase 1):** `/admin/repair-requests` lists requests with a status filter and counts, and a detail view shows the customer, the vehicle, each reported problem with its severity, and the uploaded photos. A banner notes that quotation and scheduling come in Phase 2.

### Data model (`server/routes/repair-requests.js`, table `repair_requests`)

One row per request: the demo model shown, whether it is the customer's car or a different one they described, the vehicle fields, the problems (JSON: category, 3D area, description, symptoms, when it started, severity, notes), the image paths, the customer fields, language, and status (`submitted`). Phase 2 will add quotation lines, scheduling and a decision. Prices are never trusted from the client — Phase 2's quotation is computed on the server.

### Tests

- **`tools/tests/browser/repair-flow.mjs` (13 checks)** at 1440×900 English and French and 390×844 Arabic — 13/13 each: open from the 3D Zone (one canvas), fill the steps, attach a photo, submit, the confirmation with `RP-n` under review, the stored request (submitted, the right car, the problem with its area and severity, the saved photo on disk), tracking by reference + phone, back to the workshop, no console errors.
- **`tools/tests/request-choreography.test.mjs`** still covers the request scene; the repair scene's camera is covered by the flow test above.
- **Backend + admin:** `tools/tests/repair-requests-api.mjs` (28 checks) and `tools/tests/browser/repair-requests-ui.mjs` (14 checks, 1440 en + 390 ar) — every validation rule and `field`, uploads, the notification, tracking (right/wrong/short phone), the admin list and detail with photos, and that there is no decision endpoint yet.

Test requests and their uploaded images are deleted at the end of every run.

### Phase 1 limits

- The 3D area pins are markers at fixed points, not a per-mesh outline of the clicked part; "transmission" and "something else" have no pin.
- Frame-time figures on this machine are noisy when other apps load it; the scene ran at 60 fps on desktop and phone when the machine was idle.

## Repair experience (Phase 2: quotation, scheduling, decision)

Phase 2 turns the read-only admin page into full management and gives the customer a quote to accept or decline on the Track page. All money is computed and validated on the server; the client is never trusted with a total.

### Status lifecycle

`submitted → under_review → (info_required) → awaiting_customer → accepted | declined → scheduled → received → in_progress → completed`, plus `rejected` and `cancelled`. The server enforces the allowed transitions (a bad jump is refused). The customer can only act at `awaiting_customer`; asking for clarification sends it back to `info_required` so the garage can respond or re-quote.

### Admin management (`src/pages/admin/repair-requests/`, server `repair-requests.js`)

- **Review:** accept (ready to quote), reject with a reason, or request more information — each shown to the customer.
- **Quotation:** add, edit and remove line items, each `{ label, kind (diagnostic / parts / labour / service), qty, unitPrice }`. The server recomputes every `amount = qty × unitPrice`, the subtotal, the tax (`round(subtotal × taxRate / 100)`) and the total, in whole dinars, and **ignores any totals the client sends** (a test tampers with them and the server overrides). Editable until sent.
- **Scheduling:** a confirmed arrival date and time, estimated duration, expected start and completion, and instructions — kept distinct from the customer's *preferred* date.
- **Send:** snapshots the quote and schedule, moves the request to `awaiting_customer`, and records the event. Drafts are never exposed on the Track page — the quote and schedule appear only once sent.
- **After acceptance:** buttons walk the repair stages (Scheduled → Received → In progress → Completed, plus Cancel).
- **Audit:** every admin action and customer decision writes a `repair_events` row (actor admin / customer / system) and an admin activity-log entry.

### Customer side on the Track page (`TrackInspection.jsx`)

Looking up an `RP-n` reference with the phone number now shows, once the garage has sent its response:

- a **status timeline** (the eight stages, current and done marked; terminal states show a banner instead);
- the garage's message, and a reason or an info request where relevant;
- the **quotation** — line items with their kind, the subtotal, the VAT line (with its rate) and a prominent total, in DA;
- the **proposed schedule** — arrival date and time, estimated time, ready-by date, instructions;
- when it's the customer's turn (`canDecide`), **Accept the quote**, **Decline** (with an optional note), or **Ask a question** (a required note). The decision is guarded by the reference + phone, allowed only while awaiting the customer, and never auto-confirmed. Afterwards the decision is shown.

The status endpoint returns integers for all amounts; the Track page formats them with the site's DA formatter. There are no customer accounts and no email/push — the Track page is the customer's notification, consistent with the rest of the site.

### Tests

- **`tools/tests/browser/repair-phase2.mjs` (14 checks)** at 1440×900 English and 390×844 Arabic — 14/14 each: create a request, admin accept → quote (server recompute verified: 110 000 + 19% = 130 900, a tampered total ignored, `amount = qty × unitPrice`) → schedule → send; the Track page shows the quote total, schedule and timeline; the customer **accepts**; the server records it; the admin walks it to `completed`. The decline and clarification paths (clarification returns the request to `info_required`) were exercised too.
- **`tools/tests/repair2-lifecycle-api.mjs` (22 checks)** and **`tools/tests/browser/repair2-admin-ui.mjs` (8 checks, 1440 en + 390 ar)** cover the server lifecycle, transition and guard rules, and the admin management UI.

Test requests, their events, notifications and images are deleted at the end of every run.

### Phase 2 limits

- No email or push exists, so the customer learns of the quote by visiting the Track page (the same as inspections and car requests).
- The admin can re-quote while awaiting the customer only via the clarification path (which reopens the editor); a direct re-quote is allowed server-side but not surfaced in the UI.
- Prices are real admin-entered quotes in DA; the illustrative configurator prices are unrelated to them.

## Browser test suite

The headless-Chrome scripts are kept in `tools/tests/browser/`. Screenshots go to `tools/tests/browser/out/`.

They need the dev server running on port 5173 and Google Chrome installed. Run them from the app folder:

```bash
node tools/tests/browser/regress.mjs 1440x900 en          # Golf: sections, views, undo/redo, compare, 360°, hotspots (28)
node tools/tests/browser/showroom-test.mjs 390x844 ar     # six-car swaps (69)
node --import ./tools/tests/resolve-hook.mjs tools/tests/browser/price-test.mjs 1440x900 fr   # prices (37)
node tools/tests/browser/cam-interrupt.mjs 390x844        # opening shot cut short, rapid clicks (4)
node tools/tests/browser/cabin-path.mjs tiguan            # camera never in the bodywork
node tools/tests/browser/tiguan.mjs                       # Tiguan cabin and RS 6 lamps (5)
node tools/tests/browser/mem2.mjs                         # textures flat over repeated swaps
node --import ./tools/tests/resolve-hook.mjs --test tools/tests/pricing.test.mjs                # price unit tests (7)
```

Use `DARK=1` for the dark theme, `REDUCED=1` for reduced motion.

Results of this pass:
- Golf suite: 28/28 at 1440 English, 390 Arabic, and 390 Arabic dark.
- Showroom: 69/69 at 1440 English, 1440 French and 390 Arabic.
- Longest frame while a car moves: 29–80 ms on desktop and 24–66 ms on phone, against 30–76 ms and 22–54 ms before.
- Language drive: smooth.
- Memory: 192 textures over eleven swaps.
- No console errors.

## Performance figures

Factory figures (Golf 8.5, 2024, Volkswagen EU data): GTI 265 PS / 370 Nm / 5.9 s, GTI Clubsport 300 PS / 400 Nm / 5.6 s, Golf R 333 PS / 420 Nm / 4.6 s, all 250 km/h limited, 2.0 TSI EA888 evo4, 7-speed DSG.
Stage 1 and Stage 2 are shown as ranges labelled "Estimate", from what aftermarket tuners typically publish. They are not measured, and the page says so, with the warranty, fuel and road-approval warning. 0–100 km/h is not estimated for tuned cars.

## Measured

- Production build: main site bundle unchanged (84 KB gzipped). The Tuning page adds 11 KB (interface), 301 KB (three.js, React Three Fiber, drei, the scene and the drive; only on `/tuning`) and the 8.1 MB model (5.3 MB before the engine bay; the bay adds 152,206 triangles and a 552 KB texture).
- The scene renders on demand: only while the camera, doors, bonnet, the drive, dust or 360° controls move, or after an option changes; it is idle otherwise.
- Tested in headless Chrome (software WebGL): all eight sections at 1440×900 and 390×844, light and dark, English, French and Arabic (RTL), reduced motion; scripted test of the component list and detail, breadcrumb and back, focus return, every exterior and cabin view, Escape, Ctrl+Z / Ctrl+Shift+Z, toolbar undo and redo, reset and its undo, overview, summary edit and undo, compare, 360° outside and inside, hotspots. No console errors.
- Not measured: real frame rate on a graphics card (the test browser draws WebGL in software).

## Rebuilding the model

```bash
cd tools/golf-model
npm install
node build.mjs /path/to/golf_gti_my25_lights_on.glb public/models/golf.glb --bay /path/to/audi_tfsi_engine2/scene.gltf
```

Without `--bay` the build gives the car without the engine bay and without the bonnet hinge.

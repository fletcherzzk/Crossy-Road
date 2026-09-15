# Crossy Road — One more hop.

A playable Crossy Road-inspired browser game, written in plain JavaScript. An original 3D brick world uses glossy plastic materials, beveled edges, embossed studs, baseplates and rafts using the chicken's stud scale, correctly oriented windshields, rubber tires, and live shadows. The elevated camera stays directly behind the chicken.

## Play locally

Open **index.html** in a modern browser. No installation, server, internet connection, or build step is needed. Three.js is bundled locally. A browser with WebGL and graphics acceleration is required.

## Controls

- **Arrow keys / WASD:** hop forward, backward, left, or right.
- **Space / tap:** hop forward.
- **Swipe / on-screen arrows:** move on a phone or tablet.
- **P / Escape:** pause or resume.
- **Enter / Space:** restart after a run.

Cross roads without touching vehicles. Ride moving logs over water. Flashing red lights warn of an approaching train. Landings align to the stud grid on grass and rafts. On a raft, the chicken stays attached to its landing stud while the raft moves. You can travel left or right indefinitely; terrain and hazards load around you.

Keep moving forward: a visible five-second countdown ends your run at zero. The timer resets only when you set a new furthest-row record. Returning to a row already reached after moving backward does not reset it. Sideways moves, backward hops, blocked moves, and drifting on rafts do not reset it. Pausing or leaving the tab freezes the countdown. Your score is the furthest row reached, and your best is saved on this browser when local storage is available.

## Publish with GitHub Pages

1. Commit `index.html`, `style.css`, `game.js`, `brick-grid.js`, `brick-renderer.js`, `vendor/`, and `.nojekyll` to your repository.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your branch (usually `main`) and **/ (root)**, then **Save**.
5. Open the URL GitHub supplies after deployment finishes.

All asset links are relative, so repository URLs such as `https://YOUR-NAME.github.io/Crossy-Road/` work without changes. There is no npm project and no build command.

## What's included

- Endless lanes and sideways terrain streaming, with bounded memory
- Stud-aligned landings and stable raft riding
- Spinning car, truck, and train wheels driven by distance traveled
- Cars and trucks moving 15% faster, with wider, evenly spaced traffic gaps
- Drifting rafts, railway signals, and passing trains
- Hopping animation, a view from behind the chicken, depth sorting, shadows, and particle effects
- A centered rear camera, horizontal lanes, and progressively faster road traffic
- Keyboard, mouse, swipe, and touch-button controls
- Pause menu, automatic pause when leaving the tab, instant restart, and local best score
- A five-second forward-hop countdown with an urgent final-two-seconds warning
- Larger, high-contrast labels, scores, controls, and menus
- Responsive high-DPI WebGL canvas

## Files

- `index.html` — accessible game interface and menus
- `style.css` — responsive presentation
- `game.js` — procedural world, input, countdown, and gameplay
- `brick-grid.js` — shared stud spacing and standing heights
- `brick-renderer.js` — original 3D models, materials, lighting, and rendering
- `vendor/three.min.js` — bundled Three.js 0.160.1 (MIT license in `vendor/LICENSE-three.txt`)

An unofficial fan-made programming project inspired by Crossy Road. All visuals are drawn in code; no original Crossy Road assets are included. LEGO is a trademark of the LEGO Group; this project is not affiliated with or endorsed by the LEGO Group.

## Optional gameplay checks

From this folder, run: node tests/game.test.cjs
Then run: node tests/renderer.test.cjs

These checks cover the countdown, movement, pause, hazards, score persistence, and local asset paths. They use Node's built-in modules; Node is only needed to run these developer checks, never to play or publish the game.

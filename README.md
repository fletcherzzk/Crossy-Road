# Crossy Road — One more hop.

A playable Crossy Road-inspired browser game, written in plain JavaScript. An original Canvas renderer draws shaded voxel shapes through an isometric camera: chunky chickens, cars, trees, trains, and floating logs.

## Play locally

Open **index.html** in a modern browser. No installation, server, internet connection, dependencies, or build step is needed.

## Controls

- **Arrow keys / WASD:** hop forward, backward, left, or right.
- **Space / tap:** hop forward.
- **Swipe / on-screen arrows:** move on a phone or tablet.
- **P / Escape:** pause or resume.
- **M / music button:** toggle synthesized sound (off initially).
- **Enter / Space:** restart after a run.

Cross roads without touching vehicles. Ride moving logs over water. Flashing red lights warn of an approaching train. Keep moving: standing still for 12 seconds ends the run. Your score is the furthest row reached, and your best is saved on this browser when local storage is available.

## Publish with GitHub Pages

1. Commit `index.html`, `style.css`, `game.js`, and `.nojekyll` to your repository.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your branch (usually `main`) and **/ (root)**, then **Save**.
5. Open the URL GitHub supplies after deployment finishes.

All asset links are relative, so repository URLs such as `https://YOUR-NAME.github.io/Crossy-Road/` work without changes. There is no npm project and no build command.

## What's included

- Endless procedural lanes with clear central routes and regular safe banks
- Traffic, drifting logs, railway signals, and passing trains
- Hopping animation, directional chicken, depth sorting, shadows, and particle effects
- Smooth camera following and progressively faster road traffic
- Keyboard, mouse, swipe, and touch-button controls
- Pause menu, automatic pause when leaving the tab, instant restart, and local best score
- Responsive high-DPI canvas and optional Web Audio effects

## Files

- `index.html` — accessible game interface and menus
- `style.css` — responsive presentation
- `game.js` — renderer, procedural world, input, audio, and gameplay

An unofficial fan-made programming project inspired by Crossy Road. All visuals are drawn in code; no original game assets or libraries are included.

# Directional and Tunable End-Effector and Root Compliance

Project website for **Directional and Tunable End-Effector and Root Compliance for Humanoid Loco-Manipulation**, by Anonymous Authors.

This page reuses the previous CEER site's Nerfies/Bulma layout. It includes the current paper, abstract, overview figure, and system framework. Code is marked **Coming soon**. Unavailable resources are omitted.

## Preview

Run `python3 -m http.server 8080` from this directory and open `http://localhost:8080`.

No build step is required. All asset paths support GitHub Pages project hosting at `/ee_root_compliance/`.

## Update content

- Paper: `static/papers/CEER2.pdf` (copied from the provided CEER2 paper).
- Figures: `static/images/ceer2-overview.png` and `ceer2-framework.png` (paper Figures 1 and 2).
- Title, authors, abstract, and framework description: `index.html`.
- Final video: set `VIDEO_DRIVE_URL` in `static/js/index.js` to its Google Drive `/file/d/…/view` URL. The player, navigation button, and external fallback link then appear automatically. The video must be viewable by the intended audience.
- Keep the video URL empty while the final video is unavailable. The earlier raw footage folder is not used as the project video.

Original CEER assets remain in the repository for reference; this page does not display them.

## Template attribution

Adapted from the [Nerfies project page template](https://github.com/nerfies/nerfies.github.io), licensed under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Research content retains its authors' rights.

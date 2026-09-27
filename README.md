# Directional and Tunable End-Effector and Root Compliance

Project website for **Directional and Tunable End-Effector and Root Compliance for Humanoid Loco-Manipulation**, by Anonymous Authors.

This page reuses the previous CEER site's Nerfies/Bulma layout. It includes the current paper, abstract, overview figure, and system framework. Code is marked **Coming soon**. Unavailable resources are omitted.

## Preview

Run `npx --yes http-server . -a 127.0.0.1 -p 8080 -c-1` from this directory and open `http://localhost:8080`. This preview server supports HTTP byte-range requests so video seeking works before the whole file has downloaded.

No build step is required. All asset paths support GitHub Pages project hosting at `/ee_root_compliance/`.

## Update content

- Paper: `static/papers/CEER2.pdf` (copied from the provided CEER2 paper).
- Figures: `static/images/ceer2-overview.png` and `ceer2-framework.png` (paper Figures 1 and 2).
- Title, authors, abstract, and framework description: `index.html`.
- Video: `static/videos/ceer2-project.mp4`, with poster `static/images/ceer2-video-cover.jpg`. The native player appears below the abstract and matches its content width; the top Video button scrolls to it in the same page.
- arXiv: set `ARXIV_URL` in `static/js/index.js` when available.
- Live Demo: embedded from `live-demo/`; its top button anchors to `#live-demo`.

Original CEER assets remain in the repository for reference; this page does not display them.

## Template attribution

Adapted from the [Nerfies project page template](https://github.com/nerfies/nerfies.github.io), licensed under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Research content retains its authors' rights.

## Experimental results

The `#real-world` section below the Live Demo contains on-demand video comparisons:
three task rows: Battery Pulling (Kz 600/200/100), Figure-eight Writing
(Soft/Stiff/Directional), and Collaborative Box Carrying (without/with added payload).
No unverified X/Y/Z labels or standalone root-mode claims are added.

Battery clips preserve the original film's yellow displacement guides and arrows.
The battery and three-condition writing clips are cropped from the already labeled
project film, preserving its condition mapping and 1× speed; the other clips use
Drive originals in `../video-source/`. `scripts/build-real-world-videos.py` builds
the clips and posters and writes their source ranges to
`static/videos/experiments/sources.json`. Playback uses each video’s native controls; offscreen videos and hidden tabs pause playback.
The real-world layout omits explanatory paragraphs and group buttons. HDR carrying
footage is rebuilt from the originals with a −0.8-stop adjustment in linear light
before SDR tone mapping; matching posters use the same corrected frames.

The Experimental Results section reproduces Table IV as an accessible HTML table and Figure 4 as a high-resolution image extracted from the repository's paper. Both cover the 16-configuration, 100–600 N/m evaluation (960 trials per method). Numerical values match the paper; MAPE is a ratio and trend slope is ranked by distance from 1. Oracle-force LL retains the best R² marking. The original response curves and IQR bands are preserved without estimating underlying data.

## Anonymous team section

The rendered team area displays an anonymous-review notice. The original named
team HTML and styles are retained as comments in `index.html` and
`static/css/index.css` for easy restoration. These comments remain readable in
page source; remove them from a published anonymous build.

The complete original section, styles, portrait sources and photos are also
preserved in `../private-team-backup/`. To restore the named team, replace the
anonymous section with the commented original section, restore its commented
styles, and copy `../private-team-backup/portraits/` to `static/images/team/`.

## Local interactive compliance demo

The Live Demo button scrolls to the embedded browser simulation. Its editable
source and runtime assets are in `live-demo/`; see `live-demo/README.md` for
controls, policy provenance, validation, and the pending 600xyz model-version
difference. This draft remains local and has not been pushed.

## Simulation videos

Five task rows each contain two independent native video players. Each condition
has its own file, poster and native controls. Play, pause and seeking from any
player apply to its task row, including real-world rows. Shorter clips hold their
last frame while longer ones finish. Other tasks remain independent. On desktop the conditions
are side by side; on phones they stack as separate players.

Build with `python3 scripts/build-separate-simulation.py`. Wiping and insertion
use the complete editing-project originals from frame zero at native speed,
without extending the shorter condition. The other tasks use individual panels
from the labeled V5 film. Provenance, crop bounds and durations are in
`static/videos/simulation/separate/sources.json`. Earlier paired assets and build
scripts remain available but are not used by the current page.

## Layout

Abstract, Live Demo, simulation and results use the original light backgrounds,
with white areas between them. Spacing, left-aligned abstract text, condition
labels and compact anonymous-team styling are unified. System Framework appears
between the overview video and Live Demo. On phones the real-world condition
cards scroll horizontally within each task; simulation players stack vertically.

Rows pause when the entire task leaves view or the page is hidden. Individual offscreen cards do not interrupt their visible comparison partners.

// Fill these in when the public resources are available.
const ARXIV_URL = '';
const VIDEO_DRIVE_URL = '';
const LIVE_DEMO_URL = '';

function configureResourceLink(id, url) {
  const link = document.getElementById(id);
  if (!link) return;
  if (url) {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.removeAttribute('aria-disabled');
    link.classList.remove('resource-pending');
    return;
  }
  link.classList.add('resource-pending');
  link.addEventListener('click', (event) => event.preventDefault());
}

configureResourceLink('arxiv-link', ARXIV_URL);
configureResourceLink('live-demo-link', LIVE_DEMO_URL);
configureResourceLink('video-link', VIDEO_DRIVE_URL);

if (VIDEO_DRIVE_URL) {
  const videoURL = new URL(VIDEO_DRIVE_URL);
  const fileID = videoURL.hostname === 'drive.google.com'
    ? videoURL.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]
    : null;
  if (fileID) {
    const player = document.createElement('iframe');
    player.src = `https://drive.google.com/file/d/${fileID}/preview`;
    player.title = 'Directional and Tunable End-Effector and Root Compliance — Project Video';
    player.allow = 'autoplay; fullscreen';
    player.allowFullscreen = true;
    player.loading = 'lazy';
    document.getElementById('video-player').append(player);
    document.getElementById('video-external').href = VIDEO_DRIVE_URL;
    document.getElementById('video').hidden = false;
  }
}

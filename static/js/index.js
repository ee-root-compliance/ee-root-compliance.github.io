// Fill these in when the public resources are available.
const ARXIV_URL = '';

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

// Pausing keeps the current frame. Leaving the player restores its cover.
const videoPlayer = document.getElementById('video-player');
const projectVideo = videoPlayer?.querySelector('video');
const videoCover = videoPlayer?.querySelector('.video-cover');
if (projectVideo && videoCover) {
  const showCover = () => {
    videoCover.hidden = false;
    videoCover.setAttribute('aria-label', projectVideo.ended ? 'Replay video' : projectVideo.currentTime > 0 ? 'Resume video' : 'Play video');
  };
  const leavePlayer = () => {
    projectVideo.pause();
    showCover();
  };
  showCover();
  videoCover.addEventListener('click', async () => {
    try {
      await projectVideo.play();
      projectVideo.focus({ preventScroll: true });
    } catch (error) {
      // Leaving while playback loads can cancel the play request.
      if (error.name === 'AbortError') return;
      videoCover.hidden = true;
      projectVideo.focus({ preventScroll: true });
    }
  });
  projectVideo.addEventListener('playing', () => { videoCover.hidden = true; });
  projectVideo.addEventListener('ended', showCover);
  document.addEventListener('pointerdown', (event) => {
    if (!videoPlayer.contains(event.target) && !event.target.closest('#video-link')) leavePlayer();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leavePlayer();
  });
  window.addEventListener('pagehide', leavePlayer);
}

// Match the embedded demo's content height, including its stacked mobile layout.
const demoFrame = document.getElementById('compliance-demo');
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== demoFrame?.contentWindow) return;
  if (event.data?.type === 'ceer2:resize' && Number.isFinite(event.data.height)) {
    demoFrame.style.height = `${Math.max(420, Math.min(1800, event.data.height + 2))}px`;
  }
  if (event.data?.type === 'ceer2:interaction' && projectVideo) {
    projectVideo.pause();
    if (videoCover) videoCover.hidden = false;
  }
});

if (demoFrame) {
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) demoFrame.contentWindow?.postMessage({type:'ceer2:offscreen'}, location.origin);
  }).observe(demoFrame);
}

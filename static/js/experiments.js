// Independent native players share transport controls within each task row.
const experimentRows = [...document.querySelectorAll('#real-world .experiment-group, #simulation .experiment-group')];
const transports = new Map();

experimentRows.forEach(row => {
  const videos = [...row.querySelectorAll('video')];
  let playing = false;
  let leader = null;
  const expectedSeeks = new WeakMap();
  const pendingTimes = new WeakMap();
  const internalPauses = new WeakSet();

  const pauseVideo = video => {
    if (!video.paused) {
      internalPauses.add(video);
      video.pause();
    }
  };
  const pause = () => {
    playing = false;
    videos.forEach(pauseVideo);
  };
  const seekVideo = (video, time) => {
    if (!video.readyState) {
      pendingTimes.set(video, time);
      return;
    }
    const target = Math.min(time, Number.isFinite(video.duration) ? video.duration : time);
    if (Math.abs(video.currentTime - target) > 0.06) {
      expectedSeeks.set(video, target);
      video.currentTime = target;
    }
  };
  const startVideo = video => {
    // Do not restart a shorter clip while the longer comparison continues.
    if (Number.isFinite(video.duration) && video.currentTime >= video.duration - 0.04) return;
    video.play().catch(() => {
      // AbortError is normal when the user pauses while media is loading.
      if (playing && video.paused && !video.ended) pause();
    });
  };

  videos.forEach(video => {
    video.addEventListener('loadedmetadata', () => {
      if (pendingTimes.has(video)) {
        seekVideo(video, pendingTimes.get(video));
        pendingTimes.delete(video);
      }
    });
    video.addEventListener('play', () => {
      if (playing) return;
      playing = true;
      leader = video;
      videos.forEach(peer => {
        if (peer === video) return;
        seekVideo(peer, video.currentTime);
        startVideo(peer);
      });
    });
    video.addEventListener('pause', () => {
      if (internalPauses.delete(video) || video.ended) return;
      if (playing) {
        const time = video.currentTime;
        pause();
        videos.forEach(peer => seekVideo(peer, time));
      }
    });
    video.addEventListener('seeking', () => {
      const expected = expectedSeeks.get(video);
      expectedSeeks.delete(video);
      if (expected !== undefined && Math.abs(video.currentTime - expected) < 0.1) return;
      leader = video;
      videos.forEach(peer => {
        if (peer === video) return;
        seekVideo(peer, video.currentTime);
        if (playing) startVideo(peer);
      });
    });
    video.addEventListener('timeupdate', () => {
      if (!playing || leader !== video || video.seeking) return;
      videos.forEach(peer => {
        if (peer === video || !peer.readyState || peer.seeking || peer.ended) return;
        if (Math.abs(peer.currentTime - video.currentTime) > 0.08) seekVideo(peer, video.currentTime);
      });
    });
    video.addEventListener('ended', () => {
      if (videos.every(peer => peer.ended)) playing = false;
      else if (leader === video) leader = videos.find(peer => !peer.ended);
    });
    video.addEventListener('error', pause);
  });
  transports.set(row, pause);
});

// Pause only when the entire task leaves view, including horizontally scrolled
// cards on phones. Individual offscreen cards must not stop their visible peers.
const rowVisibility = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) transports.get(entry.target)();
  });
});
experimentRows.forEach(row => rowVisibility.observe(row));
const pauseExperiments = () => transports.forEach(pause => pause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseExperiments();
});
window.addEventListener('pagehide', pauseExperiments);

// Set this to the final video's Google Drive file URL when it is available.
// Keep it empty to omit both the Video button and section.
const VIDEO_DRIVE_URL = '';

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
    document.getElementById('video-link').hidden = false;
  }
}

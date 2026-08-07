(function () {
  window.SOUND_EFFECTS = {};

  window.toggleAudioPicker = function toggleAudioPicker(e) {
    if (e) e.stopPropagation();
    const picker = document.getElementById('audio-picker');
    const otherPicker = document.getElementById('emote-picker');
    if (otherPicker) otherPicker.style.display = 'none';
    if (picker) picker.style.display = 'none';
  };

  window.renderAudioPicker = function renderAudioPicker() {
    const grid = document.getElementById('audio-grid');
    if (!grid) return;
    grid.innerHTML = '';
  };

  // Preload basic sound effects. Use existing files in assets/soundclip.
  (function initSoundEffects() {
    try {
      const base = 'assets/soundclip/';
      const list = {
        mention: `${base}cancel.mp3`
      };

      Object.keys(list).forEach((key) => {
        const audio = new Audio(list[key]);
        audio.preload = 'auto';
        audio.volume = 0.8;
        audio.load();
        window.SOUND_EFFECTS[key] = audio;
      });
    } catch (e) {
      console.warn('Failed to init sound effects', e);
    }
  })();

  // Try to unlock audio on first user gesture (many browsers block autoplay otherwise).
  let _audioUnlocked = false;
  function _unlockAudioOnce() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    Object.values(window.SOUND_EFFECTS).forEach((a) => {
      try {
        // Play then immediately pause to unlock playback on some browsers.
        const p = a.play();
        if (p && p.then) {
          p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => { /* ignore */ });
        }
      } catch (err) {
        // ignore
      }
    });
    document.removeEventListener('click', _unlockAudioOnce);
  }
  document.addEventListener('click', _unlockAudioOnce, { once: true });

  window.playSoundEffect = function playSoundEffect(name = 'mention') {
    try {
      const audio = window.SOUND_EFFECTS[name];
      if (!audio) return false;
      // reset to start in case the sound was recently played
      try { audio.currentTime = 0; } catch (e) { /* ignore */ }
      const p = audio.play();
      if (p && p.catch) p.catch((err) => {
        console.warn('Audio play failed:', err);
      });
      return true;
    } catch (e) {
      console.warn('playSoundEffect error', e);
      return false;
    }
  };

  document.addEventListener('click', (e) => {
    const picker = document.getElementById('audio-picker');
    const toggleBtn = document.querySelector('.audio-toggle-btn');
    if (picker && !picker.contains(e.target) && e.target !== toggleBtn) {
      picker.style.display = 'none';
    }
  });
})();

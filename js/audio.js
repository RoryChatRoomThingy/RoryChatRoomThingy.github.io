(function () {
  // Shared global audio player to prevent memory leaks and browser lag
  const globalAudio = new Audio();
  let currentButton = null;

  window.toggleAudioPlayback = function (button, audioUrl) {
    if (!audioUrl) return;

    // Block local system paths that cause Security Errors on GitHub Pages
    if (audioUrl.startsWith('file:///')) {
      console.warn('Blocked local file path:', audioUrl);
      alert('Cannot play files directly from a local drive path for browser security reasons.');
      return;
    }

    // Toggle play/pause if clicking the currently active track
    if (currentButton === button) {
      if (globalAudio.paused) {
        globalAudio.play().then(() => setButtonState(button, true)).catch(console.warn);
      } else {
        globalAudio.pause();
        setButtonState(button, false);
      }
      return;
    }

    // Stop previous playback and reset
    window.stopAllAudio();

    // Assign new track to shared audio player
    currentButton = button;
    globalAudio.src = audioUrl;
    setButtonState(button, true);

    globalAudio.play().catch((err) => {
      console.warn('Audio playback error:', err);
      setButtonState(button, false);
      resetCurrent();
    });

    globalAudio.onended = () => {
      setButtonState(button, false);
      resetCurrent();
    };

    globalAudio.onerror = (err) => {
      console.warn('Audio stream error:', err);
      setButtonState(button, false);
      resetCurrent();
    };
  };

  window.stopAllAudio = function () {
    if (currentButton) {
      setButtonState(currentButton, false);
    }
    globalAudio.pause();
    globalAudio.removeAttribute('src'); // Free memory
    resetCurrent();
  };

  function resetCurrent() {
    currentButton = null;
  }

  function setButtonState(button, isPlaying) {
    if (!button) return;
    const playIcon = button.querySelector('.play-icon');
    const pauseIcon = button.querySelector('.pause-icon');

    if (isPlaying) {
      button.classList.add('playing');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
    } else {
      button.classList.remove('playing');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
    }
  }
})();

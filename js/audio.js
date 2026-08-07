(function () {
  let currentAudio = null;
  let currentButton = null;

  // Toggle play/pause state for audio attachments inside chat messages
  window.toggleAudioPlayback = function (button, audioUrl) {
    if (!audioUrl) return;

    // If clicking the button of the currently active audio
    if (currentAudio && currentButton === button) {
      if (currentAudio.paused) {
        currentAudio.play();
        setButtonState(button, true);
      } else {
        currentAudio.pause();
        setButtonState(button, false);
      }
      return;
    }

    // Stop any currently playing audio across the site before starting new track
    window.stopAllAudio();

    // Initialize and play new audio track
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    currentButton = button;

    setButtonState(button, true);

    audio.play().catch((err) => {
      console.warn('Audio playback error:', err);
      setButtonState(button, false);
      resetCurrent();
    });

    // Reset button icon when track finishes
    audio.onended = () => {
      setButtonState(button, false);
      resetCurrent();
    };

    audio.onerror = () => {
      setButtonState(button, false);
      resetCurrent();
    };
  };

  window.stopAllAudio = function () {
    if (currentAudio) {
      currentAudio.pause();
      if (currentButton) {
        setButtonState(currentButton, false);
      }
      resetCurrent();
    }
  };

  function resetCurrent() {
    currentAudio = null;
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

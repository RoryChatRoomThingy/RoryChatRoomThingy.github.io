(function () {
  /* ==========================================================================
     1. AUDIO FILE ATTACHMENT PLAYER
     ========================================================================== */
  const globalAudio = new Audio();
  let currentButton = null;

  window.toggleAudioPlayback = function (button, audioUrl) {
    if (!audioUrl) return;

    if (audioUrl.startsWith('file:///')) {
      alert('Cannot play files directly from a local drive path for browser security reasons.');
      return;
    }

    if (currentButton === button) {
      if (globalAudio.paused) {
        globalAudio.play().then(() => setButtonState(button, true)).catch(console.warn);
      } else {
        globalAudio.pause();
        setButtonState(button, false);
      }
      return;
    }

    window.stopAllAudio();
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

    globalAudio.onerror = () => {
      setButtonState(button, false);
      resetCurrent();
    };
  };

  window.stopAllAudio = function () {
    if (currentButton) setButtonState(currentButton, false);
    globalAudio.pause();
    globalAudio.removeAttribute('src'); 
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

  /* ==========================================================================
     2. UI SOUND EFFECTS (PINGS, ETC)
     ========================================================================== */
  const sfx = {
    // Add your sound file path here!
    ping: new Audio('assets/soundclip/ping.mp3') 
  };

  window.playSoundEffect = function(name) {
    if (sfx[name]) {
      // We clone the node so if you get pinged twice rapidly, they overlap naturally
      const sound = sfx[name].cloneNode();
      sound.volume = 0.8;
      sound.play().catch((e) => console.warn('Browser blocked autoplay sound:', e));
    }
  };
})();

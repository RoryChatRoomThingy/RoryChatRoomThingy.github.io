(function () {
  async function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'block';

    window.renderEmotePicker();
    if (window.renderAudioPicker) window.renderAudioPicker();
    await window.loadUsersList();
    await window.loadMessages();
    window.setupRealtime();
  }

  window.initApp = initApp;
})();

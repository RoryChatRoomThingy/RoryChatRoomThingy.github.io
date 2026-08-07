(function () {
  async function initApp() {
    const authScreen = document.getElementById('auth-screen');
    const chatScreen = document.getElementById('chat-screen');
    if (authScreen) authScreen.style.display = 'none';
    if (chatScreen) chatScreen.style.display = 'flex';

    if (window.renderEmotePicker) window.renderEmotePicker();
    if (window.renderAudioPicker) window.renderAudioPicker();

    // Default to main server on load so channel messages show right away
    if (window.switchToContext) {
      window.switchToContext('server');
    } else {
      if (window.loadUsersList) await window.loadUsersList();
      if (window.loadMessages) await window.loadMessages();
    }

    if (window.setupRealtime) window.setupRealtime();
  }

  window.initApp = initApp;
})();

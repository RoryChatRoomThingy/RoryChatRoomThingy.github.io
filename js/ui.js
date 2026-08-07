(function () {
  function renderEmotePicker() {
    const grid = document.getElementById('emote-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [code, path] of Object.entries(window.EMOTES || {})) {
      const item = document.createElement('div');
      item.className = 'emote-grid-item';
      item.title = code;
      item.onclick = () => window.selectEmote(code);
      item.innerHTML = `<img src="${path}" onerror="this.style.display='none'" />`;
      grid.appendChild(item);
    }
  }

  window.renderEmotePicker = renderEmotePicker;

  window.toggleEmotePicker = function toggleEmotePicker(e) {
    if (e) e.stopPropagation();
    const picker = document.getElementById('emote-picker');
    if (!picker) return;
    const isVisible = picker.style.display === 'block';
    picker.style.display = isVisible ? 'none' : 'block';
  };

  window.selectEmote = function selectEmote(code) {
    const input = document.getElementById('msg-input');
    if (!input) return;
    input.value += (input.value.length > 0 && !input.value.endsWith(' ') ? ' ' : '') + code + ' ';
    input.focus();
  };

  // What's New Popup Trigger Functions
  window.showWhatsNew = function showWhatsNew() {
    const modal = document.getElementById('whats-new-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  };

  window.closeWhatsNew = function closeWhatsNew() {
    const modal = document.getElementById('whats-new-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  document.addEventListener('click', (e) => {
    const picker = document.getElementById('emote-picker');
    const toggleBtn = document.querySelector('.emote-toggle-btn');
    if (picker && !picker.contains(e.target) && e.target !== toggleBtn) {
      picker.style.display = 'none';
    }
  });
})();

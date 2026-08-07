(function () {
  const storageKey = 'dc-theme';
  const body = document.body;
  const root = document.documentElement;

  function applyTheme(theme) {
    const normalizedTheme = theme === 'light' ? 'light' : 'dark';
    body.classList.toggle('dark-theme', normalizedTheme === 'dark');
    body.classList.toggle('light-theme', normalizedTheme === 'light');
    root.setAttribute('data-theme', normalizedTheme);

    try {
      localStorage.setItem(storageKey, normalizedTheme);
    } catch (error) {
      console.warn('Theme storage unavailable:', error);
    }
  }

  function toggleTheme() {
    const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  window.toggleTheme = toggleTheme;
  window.applyTheme = applyTheme;

  const savedTheme = localStorage.getItem(storageKey);
  const preferredTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(savedTheme || preferredTheme);
})();

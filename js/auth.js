(function () {
  // Check session on page load
  async function checkSession() {
    if (!window.supabaseClient) return;

    const { data: { session }, error } = await window.supabaseClient.auth.getSession();

    if (session && session.user) {
      window.currentUser = session.user;

      // Fetch user profile
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', window.currentUser.id)
        .single();

      window.currentProfile = profile || {
        display_name: session.user.email ? session.user.email.split('@')[0] : 'User',
        avatar_url: 'assets/icons/avatars/user1.png'
      };

      if (window.updateUserControls) window.updateUserControls();
      if (window.initApp) await window.initApp();

      // Trigger "What's New" popup modal
      if (typeof window.showWhatsNew === 'function') {
        window.showWhatsNew();
      }
    } else {
      const authScreen = document.getElementById('auth-screen');
      const chatScreen = document.getElementById('chat-screen');
      if (authScreen) authScreen.style.display = 'block';
      if (chatScreen) chatScreen.style.display = 'none';
    }
  }

  // Handle manual login
  window.handleLogin = async function handleLogin() {
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    if (!emailEl || !passEl) return;

    const email = emailEl.value;
    const password = passEl.value;
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

    if (error) return alert(error.message);

    window.currentUser = data.user;
    const { data: profile } = await window.supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .single();

    window.currentProfile = profile || {
      display_name: email.split('@')[0],
      avatar_url: 'assets/icons/avatars/user1.png'
    };

    if (window.updateUserControls) window.updateUserControls();
    if (window.initApp) await window.initApp();

    // Trigger "What's New" popup modal
    if (typeof window.showWhatsNew === 'function') {
      window.showWhatsNew();
    }
  };

  // Auth State Listener
  if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.currentUser = null;
        window.currentProfile = null;
        const authScreen = document.getElementById('auth-screen');
        const chatScreen = document.getElementById('chat-screen');
        if (authScreen) authScreen.style.display = 'block';
        if (chatScreen) chatScreen.style.display = 'none';
      }
    });
  }

  // Trigger checkSession when DOM is fully loaded
  window.addEventListener('DOMContentLoaded', () => {
    checkSession();
  });
})();

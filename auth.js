// Centralized auth-state handling. Updates the #nav-login-link on every page
// and keeps multiple tabs in sync via onAuthStateChange.
(function () {
  if (!window.sb) {
    console.error('auth.js: window.sb is not initialized');
    return;
  }

  function applyAuthState(session) {
    const link = document.getElementById('nav-login-link');
    if (!link) return;
    if (session) {
      link.textContent = 'Uitloggen';
      link.setAttribute('href', '#');
      link.onclick = async (e) => {
        e.preventDefault();
        await window.sb.auth.signOut();
        location.reload();
      };
    } else {
      link.textContent = 'Inloggen';
      link.setAttribute('href', 'login.html');
      link.onclick = null;
    }
    window.dispatchEvent(new CustomEvent('club92:auth-applied', { detail: { session } }));
  }

  window.CLUB92_applyAuthState = applyAuthState;

  // Reacts to sign-in/sign-out in the current tab and in other tabs.
  window.sb.auth.onAuthStateChange((_event, session) => applyAuthState(session));

  // When nav is injected asynchronously by nav-loader.js, re-apply state.
  window.addEventListener('club92:nav-loaded', async () => {
    const { data: { session } } = await window.sb.auth.getSession();
    applyAuthState(session);
  });
})();

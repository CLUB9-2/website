// Fetches nav.html and injects it into #nav-placeholder. Then wires the
// dropdown + mobile hamburger so they work with keyboard + touch.
(async function () {
  const placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  try {
    const res = await fetch('nav.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    // Replace the placeholder with nav's children (no extra wrapper).
    const frag = document.createDocumentFragment();
    while (wrap.firstChild) frag.appendChild(wrap.firstChild);
    placeholder.replaceWith(frag);

    wireInteractions();
    window.dispatchEvent(new CustomEvent('club92:nav-loaded'));
  } catch (e) {
    console.error('nav-loader: failed to load nav.html', e);
  }

  function wireInteractions() {
    const toolsBtn  = document.querySelector('.dropdown > .dropbtn');
    const toolsMenu = document.getElementById('tools-dropdown');
    if (toolsBtn && toolsMenu) {
      const closeDropdown = () => {
        toolsBtn.setAttribute('aria-expanded', 'false');
        toolsMenu.classList.remove('open');
      };
      toolsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = toolsBtn.getAttribute('aria-expanded') === 'true';
        toolsBtn.setAttribute('aria-expanded', String(!expanded));
        toolsMenu.classList.toggle('open', !expanded);
      });
      toolsBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) closeDropdown();
      });
    }

    const mobileToggle = document.querySelector('.site-nav__toggle');
    const navLinks     = document.getElementById('site-nav-links');
    if (mobileToggle && navLinks) {
      mobileToggle.addEventListener('click', () => {
        const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
        mobileToggle.setAttribute('aria-expanded', String(!expanded));
        mobileToggle.setAttribute(
          'aria-label',
          expanded ? 'Menu openen' : 'Menu sluiten'
        );
        navLinks.classList.toggle('open', !expanded);
      });
    }
  }
})();

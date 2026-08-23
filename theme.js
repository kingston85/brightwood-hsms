/* ==========================================================================
   Brightwood HSMS — Dark mode toggle
   The actual color overrides live in css/style.css under [data-theme="dark"].
   A tiny inline script in index.html's <head> applies the saved/preferred
   theme before first paint (no flash); this file just wires up the toggle
   button and persists the choice per-browser.
   ========================================================================== */

const Theme = {
  KEY: 'hsms_theme',

  current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  },

  apply(theme) {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(this.KEY, theme); } catch (e) { /* private browsing, etc. */ }
  },

  toggle() {
    this.apply(this.current() === 'dark' ? 'light' : 'dark');
  },
};

function wireThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.addEventListener('click', () => Theme.toggle());
}

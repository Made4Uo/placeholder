/**
 * The light and dark switch, as a string.
 *
 * Light is the default for everyone, whatever the operating system prefers.
 * Dark is only ever a choice made with the switch, pinned as data-theme on
 * <html> and remembered.
 *
 * This runs in <head> rather than with the rest of the script at the bottom of
 * the page. A remembered dark theme applied after first paint flashes white on
 * every load, which is worse than having no switch at all.
 *
 * The button ships hidden and this is what reveals it: without script it could
 * not do anything, and a control that does nothing is a question the page
 * refuses to answer.
 */

export const THEME_KEY = "theme";

export function themeScript(): string {
  return `
(() => {
  const root = document.documentElement;
  const KEY = ${JSON.stringify(THEME_KEY)};

  // Storage throws rather than returning null when site data is blocked, and
  // failing to run over a preference is not a trade worth making.
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  /** Light unless dark was chosen. */
  const current = () => (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  /** Says what a click will do, and tells the CSS which icon to show. */
  function label(btn) {
    const next = current() === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    btn.title = 'Switch to ' + next + ' theme';
    btn.setAttribute('data-current', current());
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme');
    if (!btn) return;
    label(btn);
    btn.hidden = false;

    btn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch {}
      label(btn);
    });
  });
})();
`;
}

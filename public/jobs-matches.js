// A private launch link unlocks this tab. No key in cookies, storage or requests.
(async () => {
  const keyText = new URLSearchParams(location.hash.slice(1)).get('matches');
  if (!keyText) return;
  history.replaceState(null, '', location.pathname + location.search);
  const note = document.getElementById('match-note');
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  try {
    if (!/^[\w-]{43}$/.test(keyText)) throw Error();
    const key = await crypto.subtle.importKey('raw', bytes(keyText.replace(/-/g,'+').replace(/_/g,'/')), 'AES-GCM', false, ['decrypt']);
    const response = await fetch('matches.json', {cache:'no-store'});
    if (!response.ok) throw Error();
    const box = await response.json();
    if (box.v !== 1) throw Error();
    const plaintext = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes(box.iv)}, key, bytes(box.data));
    const {checkedAt,tiers} = JSON.parse(new TextDecoder().decode(plaintext));
    if (checkedAt !== document.getElementById('scan').dataset.checked) {
      note.textContent = 'This page and its match scores are from different scans. Reopen your personal link for the latest results.';
      return;
    }
    for (const badge of document.querySelectorAll('[data-job-id]')) {
      const tier = tiers[badge.dataset.jobId];
      const label = ['Strong','Borderline','Stretch'].includes(tier) ? tier : 'Not scored yet';
      badge.dataset.tier = label;
      badge.textContent = 'Résumé match · ' + label;
    }
    // Only these two same-site folders receive the fragment, never outgoing links.
    for (const id of ['new','baseline']) document.getElementById(id).hash = 'matches=' + keyText;
    note.textContent = 'Your private résumé matches are visible in this tab. A match is a guide, not a guarantee of eligibility.';
  } catch {
    note.textContent = 'Private scores could not be unlocked. Reopen the latest link in My recommendations. The job listings are still available.';
  }
})();

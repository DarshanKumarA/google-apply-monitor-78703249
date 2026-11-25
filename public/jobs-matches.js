// Store only a non-exportable decryption key, and only after an explicit opt-in.
async function matchDevice(action, key) {
  const db = await new Promise((resolve,reject) => {
    const r = indexedDB.open('opening-notes-google-apply-monitor-78703249',1);
    r.onupgradeneeded = () => r.result.createObjectStore('access');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
  });
  try {
    return await new Promise((resolve,reject) => {
      const tx = db.transaction('access',action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('access');
      const req = action === 'get' ? store.get('matches') : action === 'save' ? store.put(key,'matches') : store.delete('matches');
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
(async () => {
  const keyText = new URLSearchParams(location.hash.slice(1)).get('matches');
  if (keyText) history.replaceState(null, '', location.pathname + location.search);
  const note = document.getElementById('match-note');
  const remember = document.getElementById('remember-matches'), forget = document.getElementById('forget-matches');
  const stored = await matchDevice('get').catch(() => null);
  if (stored) forget.hidden = false;
  forget.onclick = async () => {
    try { await matchDevice('forget'); location.reload(); }
    catch { note.textContent = 'Could not forget access. Clear site data for this browser to remove it.'; }
  };
  if (!keyText && !stored) return;
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  try {
    if (keyText && !/^[\w-]{43}$/.test(keyText)) throw Error();
    const key = keyText ? await crypto.subtle.importKey('raw', bytes(keyText.replace(/-/g,'+').replace(/_/g,'/')), 'AES-GCM', false, ['decrypt']) : stored;
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
      badge.hidden = false;
    }
    // Only these two same-site folders receive the fragment, never outgoing links.
    const folders = ['new','baseline'].map(id => document.getElementById(id));
    if (keyText) for (const tab of folders) tab.hash = 'matches=' + keyText;
    note.textContent = stored && !keyText ? 'Showing your private résumé matches on this browser.' : 'Private matches unlocked. Remember access only on a browser you own.';
    remember.hidden = !keyText;
    remember.onclick = async () => {
      try {
        await matchDevice('save',key);
        for (const tab of folders) tab.hash = '';
        remember.hidden = true; forget.hidden = false;
        note.textContent = 'Access remembered. The normal tracker link now shows your résumé matches in this browser.';
      } catch { note.textContent = 'This browser could not save access. Your private link still works for this visit.'; }
    };
  } catch {
    note.textContent = 'Private scores could not be unlocked. Reopen the latest link in My recommendations. The job listings are still available.';
  }
})();

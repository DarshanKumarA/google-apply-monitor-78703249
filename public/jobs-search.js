// Older bookmarks selected their folder with a query parameter.
if (new URLSearchParams(location.search).get('folder') === 'baseline' && !location.pathname.endsWith('/jobs-archive.html')) {
  location.replace(new URL('jobs-archive.html', location.href));
} else {
  if (location.hash === '#scan-history') {
    const history = document.getElementById('scan-history');
    history.open = true;
    history.scrollIntoView();
  }
  const scan = document.getElementById('scan');
  if (Date.now() - Date.parse(scan.dataset.checked) > 20 * 60000) scan.append(' · Update delayed');
  const search = document.getElementById('search');
  const count = document.getElementById('count');
  const empty = document.getElementById('empty');
  const cards = Array.from(document.querySelectorAll('#jobs article'));
  function filter() {
    let visible = 0;
    const query = search.value.trim().toLowerCase();
    for (const card of cards) {
      card.hidden = !card.dataset.search.toLowerCase().includes(query);
      if (!card.hidden) visible++;
    }
    count.textContent = visible + ' of ' + cards.length + ' openings ' + count.dataset.folder;
    empty.hidden = visible > 0;
    empty.textContent = query ? 'No roles match this search.' : 'No openings in this collection yet.';
  }
  search.addEventListener('input', filter);
  filter();
}

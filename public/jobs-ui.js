const byId = id => document.getElementById(id);
const stamp = new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata', year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
function localTime(value) {
  const date = Date.parse(value);
  return Number.isFinite(date) ? stamp.format(date) + ' IST' : 'Unavailable';
}
function item(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function render(data) {
  const archive = new URLSearchParams(location.search).get('folder') === 'baseline';
  const roles = archive ? data.initial : data.newOpenings;
  byId(archive ? 'baseline' : 'new').setAttribute('aria-current','page');
  const delayed = Date.now() - Date.parse(data.checkedAt) > 20 * 60_000;
  byId('scan').textContent = 'Last scan ' + localTime(data.checkedAt) + (delayed ? ' · Update delayed' : '');
  function filter() {
    const query = byId('search').value.trim().toLowerCase();
    const visible = roles.filter(j => [j.title,j.location,...(j.required || [])].join(' ').toLowerCase().includes(query));
    byId('count').textContent = visible.length + ' of ' + roles.length + ' openings' + (archive ? ' in the initial archive' : ' discovered since the initial scan');
    const cards = visible.map(j => {
      const card = document.createElement('article');
      const link = item('a','View Google posting ↗');
      link.href = j.jobUrl;
      card.append(item('h2',j.title),item('p',j.location),item('time','First found ' + localTime(j.firstDetectedAt)),
        item('p','Posted · ' + j.postingDate),item('p','Application window · ' + j.expiryDate),link);
      return card;
    });
    byId('jobs').replaceChildren(...(cards.length ? cards : [item('p',query ? 'No roles match this search.' : 'No openings in this collection yet.')]));
  }
  byId('search').addEventListener('input',filter);
  byId('history').replaceChildren(...data.checks.slice(-10).reverse().map(c => item('li',localTime(c.checkedAt)+' · '+c.result)));
  filter();
}
try { render(JSON.parse(byId('snapshot').textContent)); }
catch { byId('scan').textContent = 'The published snapshot could not be displayed. Refresh to try again.'; }

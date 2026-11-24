import fs from 'node:fs';

const stamp = new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata', year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
function localTime(value) {
  const date = Date.parse(value);
  return Number.isFinite(date) ? stamp.format(date) + ' IST' : 'Unavailable';
}
function card(job) {
  const skills = Array.isArray(job.required) ? job.required.join(' ') : '';
  const link = /^https:\/\/www\.google\.com\/about\/careers\/applications\/jobs\/results\//.test(job.jobUrl)
    ? `<a href="${escape(job.jobUrl)}">View Google posting ↗</a>` : '';
  return `<article data-search="${escape([job.title, job.location, skills].join(' '))}">
    <h2>${escape(job.title)}</h2><p>${escape(job.location)}</p>
    <time>First found ${localTime(job.firstDetectedAt)}</time>
    <p>Posted · ${escape(job.postingDate || 'Unavailable')}</p>
    <p>Application window · ${escape(job.expiryDate || 'Unavailable')}</p>${link}</article>`;
}
export function publishFolders(data, destination = 'public') {
  const template = fs.readFileSync(new URL('./templates/jobs.tpl', import.meta.url), 'utf8');
  for (const archive of [false, true]) {
    const jobs = archive ? data.initial : data.newOpenings;
    const values = {
      checked: escape(data.checkedAt), scan: localTime(data.checkedAt),
      newTab: archive ? '' : 'aria-current="page"', archiveTab: archive ? 'aria-current="page"' : '',
      label: archive ? 'in the initial archive' : 'discovered since the initial scan',
      count: jobs.length, cards: jobs.map(card).join('\n'), hidden: jobs.length ? 'hidden' : '',
      history: (data.checks ?? []).slice(-10).reverse().map(c => `<li>${localTime(c.checkedAt)} · ${escape(c.result)}</li>`).join('')
    };
    const html = template.replace(/{{(\w+)}}/g, (_, key) => {
      if (!Object.hasOwn(values, key)) throw new Error('Unknown page field ' + key);
      return values[key];
    });
    fs.writeFileSync(destination + (archive ? '/jobs-archive.html' : '/jobs.html'), html);
  }
  fs.mkdirSync(destination + '/templates', { recursive: true });
  fs.copyFileSync(new URL('./templates/jobs.html', import.meta.url), destination + '/templates/jobs.html');
}

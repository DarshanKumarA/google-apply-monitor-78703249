// Google lists degree alternatives and preferences alongside required credentials.
const doctoral = /\b(?:ph[\s.‐-]*d|d[\s.]*phil|doctorate|doctoral|doctor of philosophy|post[-\s]?doc(?:toral|torate)?|postdoctoral)\b/i;
const advanced = /\b(?:master(?:['’]?s|(?=\s+(?:degree|of\b)))|mba|m\.?\s*(?:sc|s(?!\s+(?:office|excel|word)\b)|tech|eng|ba)|postgraduate|post[- ]graduate|advanced degree)\b/i;
const lowerDegree = /\b(?:bachelor(?:['’]?s)?|undergraduate|b\.?\s*(?:sc|s|tech|eng|e)|baccalaureate)\b/i;

function degreeOK(text) {
  if (!advanced.test(text) && !doctoral.test(text)) return true;
  // Accept an explicit undergraduate route, not a guessed equivalency.
  const low = lowerDegree.exec(text);
  if (!low) return false;
  const before = text.slice(0, low.index), after = text.slice(low.index + low[0].length);
  return ((advanced.test(before) || doctoral.test(before)) && /(?:\bor\s+(?:an?\s+)?|\/\s*)$/i.test(before))
    || /^(?:\s+degree)?(?:\s+in\b[^;.]{1,100}?)?\s*(?:[,/]\s*|\bor\s+)(?:an?\s+)?(?:master|ph\.?d|doctor|m\.?s|mba|advanced)/i.test(after);
}

const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
function durations(text) {
  const normalized = text.toLowerCase().replace(/\b(?:an?)(?=\s+(?:year|month)\b)/g,'1')
    .replace(new RegExp('\\b('+words.join('|')+')\\b','g'), w => String(words.indexOf(w)))
    .replace(/\byoe\b/g,'years').replace(/\b(\d+)\s*\(\1\)/g,'$1')
    .replace(/\b(\d+)\s+years?\s+(?:and\s+)?(\d+)\s+months?\b/g,(_,y,m)=>(12*Number(y)+Number(m))+' months');
  const values = [];
  for (const m of normalized.matchAll(/\b(\d+(?:\.\d+)?)\+?(?:\s*(?:[-–—]|to)\s*\d+(?:\.\d+)?)?\s*[- ]?\s*(years?|yrs?|months?|mos?)\b/g)) {
    // A four-year degree or a two-year academic program isn't job experience.
    const tail = normalized.slice(m.index + m[0].length);
    if (/^\s*(?:long\s+)?(?:degree|(?:bachelor|master|doctoral|university|college|academic|undergraduate)|program(?:me)?\b)/.test(tail)) continue;
    const prefix = normalized.slice(0,m.index);
    if (/\b(?:up to|at most|no more than)\s*$/.test(prefix)) { values.push(0); continue; }
    values.push(Number(m[1]) * (/^y/.test(m[2]) ? 12 : 1) + (/\b(?:more than|over)\s*$/.test(prefix) ? 0.01 : 0));
  }
  return values;
}

function minimumMonths(line) {
  // When both sides specify durations, evaluate degree and experience together.
  // “2 years with BS or 1 with MS” is not a one-year undergraduate route.
  const alternatives = line.split(/\s+or\s+(?=(?:(?:an?|at least)\s+)?(?:\d|one\b|two\b|three\b|six\b|twelve\b|bachelor|master|ph\.?d|[bm]\.?s\b))/i);
  const degreeOnlyRoute = alternatives.length === 2 && alternatives.some(part => lowerDegree.test(part) && !durations(part).length)
    && /^\s*(?:\d|one\b|two\b|three\b)/i.test(alternatives[1]);
  const routes = alternatives.length > 1 && (alternatives.every(part => durations(part).length) || degreeOnlyRoute) ? alternatives : [line];
  return Math.min(...routes.map(part => degreeOK(part) ? Math.max(0,...durations(part)) : Infinity));
}

export function experienceLabel(job) {
  const minimum = Math.max(0,...(job.required ?? []).map(minimumMonths));
  if (!minimum) return (job.required ?? []).some(line => durations(line).length) ? 'Experience · No minimum years required' : 'No numeric experience minimum stated';
  return minimum === 12 ? 'Minimum experience · 1 year' : 'Minimum experience · ' + minimum + ' months';
}

export function isEligible(job) {
  const title = job.title ?? '';
  if (/\b(?:senior|sr|manager|staff|principal|director|distinguished|chief|vp|svp|evp|vice[- ]president|head of|ii|iii|iv|v|vi|vii|viii|ix|level[- ]+[2-9]|l[4-9]|(?:engineer|analyst|designer)\s+[2-9])\b/i.test(title)) return false;
  // "Lead Generation Associate" describes the work, not the person's level.
  if (/\blead\b(?![- ]generation\b)/i.test(title)) return false;
  return degreeOK(title) && !(job.required ?? []).some(line => minimumMonths(line) > 12);
}

// Google lists degree alternatives and preferences alongside required credentials.
const doctoral = /\b(?:ph[\s.‐-]*d|d[\s.]*phil|doctorate|doctoral|doctor of philosophy|post[-\s]?doc(?:toral|torate)?|postdoctoral)\b/i;
const lowerDegree = /\b(?:bachelor|master|undergraduate|[bm]\.?\s*sc|[bm]\.?\s*s)\b/i;

function degreeAlternative(text) {
  const degree = doctoral.exec(text);
  if (!degree || !lowerDegree.test(text)) return false;
  const before = text.slice(0, degree.index);
  const after = text.slice(degree.index + degree[0].length);
  return (lowerDegree.test(before) && /(?:\bor\s+(?:a\s+)?|\/\s*)$/i.test(before))
    || /^(?:\s+degree)?(?:\s+in\b[^.;]{1,120}?)?\s*(?:[,/]\s*|\bor\s+)(?:a\s+)?(?:master|bachelor|undergraduate|[bm]\.?\s*s)/i.test(after);
}

export function isEligible(job) {
  const title = job.title ?? '';
  if (/\b(?:senior|sr|manager|staff|principal|director|distinguished|chief|vp|svp|evp|vice[- ]president|head of|ii|iii|iv|v|vi|vii|viii|ix|level[- ]+[2-9]|l[4-9]|(?:engineer|analyst|designer)\s+[2-9])\b/i.test(title)) return false;
  // "Lead Generation Associate" describes the work, not the person's level.
  if (/\blead\b(?![- ]generation\b)/i.test(title)) return false;
  // Catch otherwise unlevelled titles with an unambiguous senior minimum.
  // Do not use preferred qualifications or override an explicit alternative.
  if ((job.required ?? []).some(line =>
    /^\s*(?:at least\s+|minimum (?:of )?)?(?:[5-9]|[1-9]\d+)\+?\s+years?\b/i.test(line)
    && !/\b(?:alternatively|preferred|or\s+(?:at least\s+)?(?:\d+|one|two|three|four)\s*\+?\s*years?|or equivalent (?:practical )?experience)\b/i.test(line))) return false;
  if (doctoral.test(job.title) && !degreeAlternative(job.title)) return false;
  return !(job.required ?? []).some(line => doctoral.test(line)
    && !degreeAlternative(line)
    && !/\bor equivalent (?:practical |professional |work )?experience\b/i.test(line));
}

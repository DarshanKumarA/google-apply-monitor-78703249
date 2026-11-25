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
  if (/\b(?:senior|manager|ii|iii)\b/i.test(job.title)) return false;
  if (doctoral.test(job.title) && !degreeAlternative(job.title)) return false;
  return !(job.required ?? []).some(line => doctoral.test(line)
    && !degreeAlternative(line)
    && !/\bor equivalent (?:practical |professional |work )?experience\b/i.test(line));
}

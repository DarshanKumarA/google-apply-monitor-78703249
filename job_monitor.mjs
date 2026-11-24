import fs from "node:fs";
import { publishFolders } from "./render-jobs.mjs";
import nodemailer from "nodemailer";

const careersBase = "https://www.google.com/about/careers/applications/jobs/results/";
const queries = ["software engineer", "early career", "intern", "internship", "apprenticeship", "new grad", "graduate", "fresher", "0 years", "1 year"];
const stateFile = "job-state.json";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (value = "") => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const slug = (title) => title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeId = (value) => String(value).match(/(\d+)$/)?.[1] ?? String(value);
// Junior/early-career focus: “Engineer I” remains eligible; II/III and roles
// with senior or manager in their titles are explicitly excluded.
const isEligible = (job) => !/\b(?:senior|manager|ii|iii)\b/i.test(job.title);

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile, "utf8")); }
  catch { return { initializedAt: null, knownIds: {}, baseline: [], newOpenings: [], checks: [] }; }
}
function saveState(state) { fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`); }
function publish(data) {
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/jobs.json", `${JSON.stringify(data, null, 2)}\n`);
  // A plain script works even in browsers that restrict JavaScript fetch(),
  // while jobs.json remains available for diagnostics and integrations.
  fs.writeFileSync("public/jobs-data.js", `window.GOOGLE_CAREERS_TRACKER_DATA=${JSON.stringify(data)};\n`);
  publishFolders(data);
}

function repairStoredLinks(state) {
  const repair = (job) => {
    const id = normalizeId(job.id);
    return { ...job, id, jobUrl: `${careersBase}${id}-${slug(job.title)}` };
  };
  state.baseline = (state.baseline ?? []).map(repair);
  state.newOpenings = (state.newOpenings ?? []).map(repair);
  state.knownIds = Object.fromEntries(Object.entries(state.knownIds ?? {}).map(([id, seen]) => [normalizeId(id), seen]));
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(14000), headers: { "user-agent": "Mozilla/5.0 GoogleEarlyCareerMonitor/1.0", "accept-language": "en-US,en;q=0.9" } });
      if (!response.ok) throw new Error(`Google returned HTTP ${response.status}`);
      return await response.text();
    } catch (error) { lastError = error; if (attempt < 2) await sleep(1000 * (attempt + 1)); }
  }
  throw lastError;
}

function parseResults(html) {
  const jobs = [];
  const pattern = /<li class="lLd3Je" ssk='([^']+)'>([\s\S]*?)(?=<li class="lLd3Je"|<\/ul>)/g;
  for (const match of html.matchAll(pattern)) {
    // `ssk` is a UI key like "18:124786092078441158". Only its trailing
    // numeric Google job ID belongs in a public job-results URL.
    const id = normalizeId(match[1]); const block = match[2];
    const title = decode(block.match(/<h3 class="QJPWVe">([\s\S]*?)<\/h3>/)?.[1]);
    if (!title) continue;
    const location = decode(block.match(/class="r0wTof[^>]*">([\s\S]*?)<\/span>/)?.[1]) || "Location not listed";
    const experience = /\bEarly\b/i.test(block) ? "Early career" : "See job details";
    jobs.push({ id, title, location, experience, jobUrl: `${careersBase}${id}-${slug(title)}` });
  }
  return jobs;
}

async function enrich(job, firstDetectedAt) {
  const output = { ...job, firstDetectedAt, postingDate: "Not published by Google", expiryDate: "Not listed" };
  try {
    const html = await fetchText(job.jobUrl);
    const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const text = decode(body);
    if (/\bJob not found\b/i.test(text)) return null;
    function section(name) {
      const pattern = new RegExp('<h3[^>]*>\\s*' + name + ':?\\s*</h3>\\s*<ul[^>]*>([\\s\\S]*?)</ul>', 'i');
      return [...(body.match(pattern)?.[1] || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => decode(m[1])).slice(0, 12);
    }
    output.required = section('Minimum qualifications');
    output.preferred = section('Preferred qualifications');
    output.duties = section('Responsibilities');
    if (!output.required.length) throw new Error('Unrecognized job details');
    output.verifiedAt = new Date().toISOString();
    output.source = 'Google';
    const expiry = text.match(/application window will be open until at least\s+([^\.]+)/i)?.[1];
    if (expiry) output.expiryDate = expiry.trim();
    const early = text.match(/(?:0|one|1) years? of (?:relevant )?experience/i);
    if (early && output.experience === "See job details") output.experience = "0–1 year experience mentioned";
  } catch (error) { return job.firstDetectedAt ? job : null; }
  return output;
}

async function keepLiveStoredJobs(jobs) {
  const live = [];
  for (let index = 0; index < jobs.length; index += 8) {
    const batch = await Promise.all(jobs.slice(index, index + 8).map(async (job) => {
      if (Date.now() - Date.parse(job.verifiedAt) < 12 * 3600000) return job;
      return enrich(job, job.firstDetectedAt);
    }));
    live.push(...batch.filter(Boolean));
  }
  return live;
}

async function sendNewJobsEmail(jobs) {
  const user = process.env.GMAIL_USER, password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) throw new Error("Gmail secrets are missing.");
  const lines = jobs.map((job) => `• ${job.title}\n  ${job.location}\n  Apply: ${job.jobUrl}\n  Expiry: ${job.expiryDate}`).join("\n\n");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass: password } });
  await transporter.sendMail({ from: user, to: user, subject: `${jobs.length} new Google Careers opening${jobs.length === 1 ? "" : "s"}`, text: `New Google Careers role(s) matching your early-career search:\n\n${lines}` });
}

const checkedAt = new Date().toISOString();
const state = loadState();
repairStoredLinks(state);
try {
  // Google can leave expired rows in search responses. Never show a dead Apply
  // link: revalidate saved cards before publishing them.
  state.baseline = await keepLiveStoredJobs((state.baseline ?? []).filter(isEligible));
  state.newOpenings = await keepLiveStoredJobs((state.newOpenings ?? []).filter(isEligible));
  const pages = await Promise.all(queries.map((query) => fetchText(`${careersBase}?q=${encodeURIComponent(query)}&sort_by=date`)));
  // Discover deeper results incrementally while always checking the newest page.
  const cursor = state.searchCursor ?? 0;
  for (let offset = 0; offset < 2; offset++) {
    const n = cursor + offset;
    const idx = n % queries.length;
    const total = Number(pages[idx].match(/Showing [\d,]+ to [\d,]+ of ([\d,]+) rows/i)?.[1]?.replaceAll(',', ''));
    if (total > 20) {
      const page = 2 + Math.floor(n / queries.length) % (Math.ceil(total / 20) - 1);
      pages.push(await fetchText(careersBase + '?sort_by=date&q=' + encodeURIComponent(queries[idx]) + '&page=' + page));
    }
  }
  state.searchCursor = cursor + 2;
  const candidates = new Map();
  for (const page of pages) for (const job of parseResults(page)) if (isEligible(job)) candidates.set(job.id, job);
  if (!candidates.size) throw new Error('No recognizable eligible search results. Review the search parser.');
  const discovered = [];
  for (const job of candidates.values()) {
    if (!state.knownIds[job.id]) discovered.push(job);
  }
  const enriched = [];
  for (let index = 0; index < discovered.length; index += 8) enriched.push(...(await Promise.all(discovered.slice(index, index + 8).map((job) => enrich(job, checkedAt)))).filter(Boolean));

  if (!state.initializedAt) {
    state.initializedAt = checkedAt;
    state.baseline = enriched;
  } else if (enriched.length) {
    if (process.env.PERSONALIZED !== 'yes' && state.searchCursor > 2) await sendNewJobsEmail(enriched);
    state.newOpenings = [...enriched, ...state.newOpenings].slice(0, 500);
  }
  for (const job of enriched) state.knownIds[job.id] = checkedAt;
  state.checks = [...(state.checks ?? []), { checkedAt, result: `Found ${candidates.size} matching roles; ${state.initializedAt === checkedAt ? "saved initial snapshot" : `${enriched.length} new opening(s)`}` }].slice(-100);
  saveState(state);
  publish({ checkedAt, baselineCreatedAt: state.initializedAt, initial: state.baseline, newOpenings: state.newOpenings, checks: state.checks });
  console.log(state.checks.at(-1).result);
} catch (error) {
  state.checks = [...(state.checks ?? []), { checkedAt, result: `Check failed: ${error.message}` }].slice(-100);
  saveState(state);
  publish({ checkedAt, baselineCreatedAt: state.initializedAt, initial: state.baseline, newOpenings: state.newOpenings, checks: state.checks });
  throw error;
}

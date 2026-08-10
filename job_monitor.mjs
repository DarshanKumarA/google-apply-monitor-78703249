import fs from "node:fs";
import nodemailer from "nodemailer";

const careersBase = "https://www.google.com/about/careers/applications/jobs/results/";
const queries = ["software engineer", "early career", "intern", "internship", "apprenticeship", "new grad", "graduate", "fresher", "0 years", "1 year"];
const stateFile = "job-state.json";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (value = "") => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const slug = (title) => title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile, "utf8")); }
  catch { return { initializedAt: null, knownIds: {}, baseline: [], newOpenings: [], checks: [] }; }
}
function saveState(state) { fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`); }
function publish(data) {
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/jobs.json", `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 GoogleEarlyCareerMonitor/1.0", "accept-language": "en-US,en;q=0.9" } });
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
    const id = match[1]; const block = match[2];
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
    const text = decode(await fetchText(job.jobUrl));
    const expiry = text.match(/application window will be open until at least\s+([^\.]+)/i)?.[1];
    if (expiry) output.expiryDate = expiry.trim();
    const early = text.match(/(?:0|one|1) years? of (?:relevant )?experience/i);
    if (early && output.experience === "See job details") output.experience = "0–1 year experience mentioned";
  } catch (error) { output.metadataNote = "Details temporarily unavailable; will be refreshed on the next discovery."; }
  return output;
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
try {
  const pages = await Promise.all(queries.map((query) => fetchText(`${careersBase}?q=${encodeURIComponent(query)}`)));
  const candidates = new Map();
  for (const page of pages) for (const job of parseResults(page)) candidates.set(job.id, job);
  const discovered = [];
  for (const job of candidates.values()) {
    if (!state.knownIds[job.id]) discovered.push(job);
  }
  const enriched = [];
  for (let index = 0; index < discovered.length; index += 8) enriched.push(...await Promise.all(discovered.slice(index, index + 8).map((job) => enrich(job, checkedAt))));

  if (!state.initializedAt) {
    state.initializedAt = checkedAt;
    state.baseline = enriched;
  } else if (enriched.length) {
    await sendNewJobsEmail(enriched); // Do not save them until Gmail accepts the notification.
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

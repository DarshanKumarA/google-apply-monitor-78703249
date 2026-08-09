import fs from "node:fs";
import nodemailer from "nodemailer";

const jobUrl = "https://www.google.com/about/careers/applications/jobs/results/78703249065943750-software-engineer-early-career-campus";
const title = "Software Engineer, Early Career, Campus";
const stateFile = "state.json";

function writePublicStatus(status) {
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/status.json", `${JSON.stringify(status, null, 2)}\n`);
}

function isApplyAvailable(page) {
  const elements = page.match(/<(?:a|button)\b[^>]*(?:\/>|>.*?<\/(?:a|button)\s*>)/gis) ?? [];
  return elements.some((element) => {
    const text = element.replace(/<[^>]+>/g, " ");
    if (!/\bapply\b/i.test(`${text} ${element}`)) return false;
    if (/\bdisabled\b|aria-disabled\s*=\s*["']?true/i.test(element)) return false;
    if (/^<a\b/i.test(element) && !/\bhref\s*=\s*["']?[^'"\s#]/i.test(element)) return false;
    return true;
  }) || (/"Apply"/.test(page) && /(?:role|type)["\\:= ]+"?button/i.test(page));
}

async function fetchPage() {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(jobUrl, { headers: { "user-agent": "Mozilla/5.0 GoogleApplyMonitor/1.0" } });
      if (!response.ok) throw new Error(`Google returned HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }
  throw lastError;
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile, "utf8")); }
  catch { return { available: false, failureCount: 0, history: [] }; }
}

function recordCheck(state, entry) {
  state.history = [...(state.history ?? []), entry].slice(-100);
}

function saveState(state) {
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

async function sendEmail(subject = "Apply now: Google Software Engineer", text = `The Apply button is available for ${title}.\n\nApply here:\n${jobUrl}`) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD secrets are required.");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass: password } });
  await transporter.sendMail({
    from: user,
    to: user,
    subject,
    text,
  });
}

const checkedAt = new Date().toISOString();
const state = loadState();
try {
  const available = isApplyAvailable(await fetchPage());
  let result = available ? "Apply button is available" : "Apply button is not yet available";
  state.failureCount = 0;
  if (available && !state.available) {
    await sendEmail(); // State changes only after Gmail accepts the alert.
    state.available = true;
    state.alertedAt = checkedAt;
    result = "Apply button is available — email alert sent";
  } else if (!available && state.available) {
    state.available = false;
  }
  recordCheck(state, { checkedAt, result, available });
  saveState(state);
  writePublicStatus({ checkedAt, result, available, jobUrl, history: state.history });
  if (process.env.TEST_EMAIL === "true") {
    await sendEmail("Google Apply Monitor cloud email test", "This confirms that the always-online GitHub monitor can send Gmail alerts.");
    console.log("Cloud email test sent.");
  }
  console.log(result);
} catch (error) {
  const result = `Check failed: ${error.message}`;
  state.failureCount = (state.failureCount ?? 0) + 1;
  if (state.failureCount >= 3 && (!state.lastHealthAlertAt || Date.now() - Date.parse(state.lastHealthAlertAt) >= 86_400_000)) {
    await sendEmail("Google Apply Monitor needs attention", `The cloud monitor has failed ${state.failureCount} checks in a row. Latest error: ${error.message}`);
    state.lastHealthAlertAt = checkedAt;
  }
  recordCheck(state, { checkedAt, result, available: null });
  saveState(state);
  writePublicStatus({ checkedAt, result, available: null, jobUrl, history: state.history });
  console.error(result);
}

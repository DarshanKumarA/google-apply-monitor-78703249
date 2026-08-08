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
  catch { return { available: false }; }
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
  if (available && !state.available) {
    await sendEmail(); // State changes only after Gmail accepts the alert.
    state.available = true;
    state.alertedAt = checkedAt;
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
    result = "Apply button is available — email alert sent";
  } else if (!available && state.available) {
    fs.writeFileSync(stateFile, `${JSON.stringify({ available: false }, null, 2)}\n`);
  }
  writePublicStatus({ checkedAt, result, available, jobUrl });
  if (process.env.TEST_EMAIL === "true") {
    await sendEmail("Google Apply Monitor cloud email test", "This confirms that the always-online GitHub monitor can send Gmail alerts.");
    console.log("Cloud email test sent.");
  }
  console.log(result);
} catch (error) {
  const result = `Check failed: ${error.message}`;
  writePublicStatus({ checkedAt, result, available: null, jobUrl });
  console.error(result);
  throw error;
}

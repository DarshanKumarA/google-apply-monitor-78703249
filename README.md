# Google Apply Monitor — cloud edition

This GitHub Actions monitor runs online even when your laptop is off. It checks the exact job posting every five minutes, retries temporary page errors three times, and emails you only once per new appearance of an enabled **Apply** button. If Gmail fails, the state is not changed, so the next run retries delivery.

## One-time deployment

Run these commands in PowerShell from this folder. The first opens GitHub authentication in your browser.

```powershell
gh auth login
gh repo create google-apply-monitor --private --source . --push
gh secret set GMAIL_USER --body "darshan1999.dk@gmail.com"
gh secret set GMAIL_APP_PASSWORD
```

When asked for `GMAIL_APP_PASSWORD`, paste the Gmail App Password you already created—not your regular Google password.

After the secrets are set, open your repository on GitHub, choose **Actions**, and run **Monitor Google Careers Apply button** once from the `Run workflow` button to verify it. Scheduled GitHub workflows are best-effort and typically run every five minutes; GitHub may delay them during high load.

## Local testing

```powershell
npm install
node monitor.mjs
```

For local testing, set `GMAIL_USER` and `GMAIL_APP_PASSWORD` only in your terminal environment; do not place credentials in a file.

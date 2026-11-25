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

The India openings tracker filters senior titles and doctoral requirements before ranking.
On the public site, résumé badges are locked. In the private matchroom, open
`Rankings.md` and select **Open tracker with my match statuses**. The personal link
unlocks Strong, Borderline and Stretch badges for that scan in both folders.
Treat it as a password; share the ordinary dashboard URL instead. The browser
does not save the key. Reopen the personal link after refreshing or closing the tab.
Only encrypted ID-to-tier data goes into the public Pages artifact, not résumé text.
To revoke a leaked link, replace the private room's `.match-key` with a freshly generated
32-byte base64url key (or delete it there) and run the monitor to republish.

Regression tests: `node --test test-matches.mjs` and `python -B -m unittest test_recommend`.

```powershell
npm install
node monitor.mjs
```

For local testing, set `GMAIL_USER` and `GMAIL_APP_PASSWORD` only in your terminal environment; do not place credentials in a file.

<!doctype html>
<html lang="en">
<base target="_blank">
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Opening Notes · Google Careers Tracker</title>
<link rel="stylesheet" href="jobs.css">
<header><nav><a class="wordmark" href="jobs.html"><span aria-hidden="true">◈</span> Opening Notes</a><a href="jobs.html#scan-history">India scan monitor ↗</a></nav></header>
<main>
  <section class="mast"><div><p class="eyebrow">Google Careers · India</p><h1>Early-career openings</h1><p id="scan" role="status" data-checked="{{checked}}">Last scan {{scan}}</p></div>
    <aside><p class="eyebrow">Private workspace</p><a class="primary" href="https://github.com/DarshanKumarA/google-careers-matchroom/blob/main/Rankings.md">My recommendations ↗</a>
    <a href="https://github.com/DarshanKumarA/google-careers-matchroom/upload/main">Upload résumé PDF ↗</a><small>Any filename. Your latest PDF is used.</small></aside></section>
  <div class="toolbar"><div class="tabs"><a id="new" href="jobs.html" {{newTab}}>New openings</a><a id="baseline" href="jobs-archive.html" {{archiveTab}}>Initial archive</a></div>
    <label>Search roles <input type="search" id="search" placeholder="Title, location or skill"></label></div>
  <p id="match-note" role="status">Cards show the experience minimum from the JD. For personal ratings, open “My recommendations” → “Open tracker with my match statuses”.</p>
  <button id="remember-matches" type="button" hidden>Remember on this device</button>
  <button id="forget-matches" type="button" hidden>Forget this device</button>
  <p id="count" role="status" data-folder="{{label}}">{{count}} of {{count}} openings {{label}}</p><section class="grid" id="jobs" aria-label="Job openings">{{cards}}</section><p id="empty" {{hidden}}>No openings in this collection yet.</p>
  <details id="scan-history"><summary>India scan history</summary><ol id="history">{{history}}</ol></details>
</main>
<script src="jobs-search.js" defer></script>
<script src="jobs-matches.js" defer></script>
</html>

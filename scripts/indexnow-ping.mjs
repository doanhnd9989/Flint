// Ping IndexNow (Bing/Yandex — and the index ChatGPT Search & Copilot read) so
// public URLs get crawled in hours, not days. Run after deploying content.
//   node scripts/indexnow-ping.mjs
const HOST = 'flinttask.com'
const KEY = '7498405c2415ee7044a47cb1f77de45d'
const URLS = [
  `https://${HOST}/`,
  `https://${HOST}/api-docs`,
]

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: URLS,
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})
console.log(`IndexNow → ${res.status} ${res.statusText} (${URLS.length} URLs)`)
if (!res.ok && res.status !== 202) {
  console.error(await res.text())
  process.exit(1)
}

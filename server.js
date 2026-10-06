const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.urlencoded({ extended: false }));

// Clever Cloud injects POSTGRESQL_ADDON_URI when the add-on is linked
const conn =
  process.env.POSTGRESQL_ADDON_DIRECT_URI ||
  process.env.POSTGRESQL_ADDON_URI ||
  process.env.DATABASE_URL;
const pool = new Pool({ connectionString: conn, max: 3 });

const LANGS = {
  nl: ["🇧🇪 Nederlands", "Hallo Devoxx!"],
  fr: ["🇧🇪 Français", "Salut Devoxx !"],
  de: ["🇧🇪 Deutsch", "Hallo Devoxx!"],
  en: ["🌍 English", "Hello Devoxx!"],
};
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS greetings (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    lang TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now())`);
}

app.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM greetings ORDER BY id DESC LIMIT 50");
    const cards = rows
      .map(
        (r) => `<div class="card"><b>${esc(r.name)}</b> <span class="badge">${esc(LANGS[r.lang]?.[0] || r.lang)}</span>
        <p>${esc(r.message)}</p><small>${new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</small></div>`
      )
      .join("") || "<p>No greetings yet. Be the first! 🚴</p>";
    res.send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Devoxx Belgium Wall</title>
<style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px;background:#fff8e1}
h1{margin:0 0 4px}.flag{height:8px;background:linear-gradient(90deg,#000 33%,#fdda24 33% 66%,#ef3340 66%);margin:8px 0 16px}
form{display:grid;gap:8px;margin-bottom:20px}input,select,textarea,button{font:inherit;padding:10px;border:2px solid #000;border-radius:8px}
button{background:#fdda24;font-weight:700;cursor:pointer}
.card{background:#fff;border:2px solid #000;border-radius:8px;padding:10px;margin-bottom:10px}
.badge{background:#ef3340;color:#fff;border-radius:99px;padding:2px 8px;font-size:12px}.card p{margin:6px 0}
</style></head><body>
<h1>🚴 Greetings from Devoxx Belgium</h1><div class="flag"></div>
<form method="post" action="/greet">
<input name="name" placeholder="Your name" maxlength="40" required>
<select name="lang">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select>
<textarea name="message" placeholder="Your message (try: Hallo Devoxx!)" maxlength="200" required></textarea>
<button>Post on the wall 🍟</button></form>
<h3>${rows.length} greeting(s) stored in PostgreSQL</h3>${cards}</body></html>`);
  } catch (e) {
    res.status(500).send("DB error: " + esc(e.message));
  }
});

app.post("/greet", async (req, res) => {
  const { name, lang, message } = req.body;
  if (name && message && LANGS[lang]) {
    await pool.query("INSERT INTO greetings(name,lang,message) VALUES($1,$2,$3)", [
      name.slice(0, 40), lang, message.slice(0, 200),
    ]);
  }
  res.redirect("/");
});

app.get("/health", (_, res) => res.send("ok"));

const port = process.env.PORT || 8080;
init()
  .then(() => app.listen(port, "0.0.0.0", () => console.log("Listening on " + port)))
  .catch((e) => { console.error("Startup failed:", e); process.exit(1); });

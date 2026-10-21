# The Real Local Cost

**What digital services actually cost, where you live, as a share of what people earn there.**

Netflix is $15 in one country and the price of a week of groceries in the next. This project
prices digital subscriptions in each market's own currency, then divides by what people earn
there — so the number means the same thing in Tunis, Cairo and Paris.

It is the international sibling of [WorseWatch](https://github.com/AyhemKahriDev/TheEnshittificationIndex):
same ethos (one honest number, receipts in plain sight, nothing estimated), different axis.

---

## The number

```
ECI = local monthly price ÷ monthly per-capita income × 100
```

Read it as a share. An ECI of 1.5 means the subscription costs one and a half percent of a
month of per-capita income.

| Service | Market | Price | ECI |
|---|---|---|---|
| Spotify Premium Individual | France | 12,14 € | **0.33%** |
| Spotify Premium Individual | Egypt | 79 EGP | **0.65%** |
| Spotify Premium Individual | Tunisia | 12,50 DT | **1.10%** |

The same subscription costs a Tunisian **3.3×** what it costs a French person, as a share of
what they earn. The nominal prices are close; the affordability gap is threefold. That gap is
invisible to every price-comparison site, and it is the whole point of this one.

| Service | Plan | Market | Price | ECI |
|---|---|---|---|---|
| Spotify Premium | Individual | France | 12,14 € | **0.33%** |
| Spotify Premium | Individual | Saudi Arabia | 23.99 ر.س | **0.22%** |
| Apple TV+ | Standard | France | 9,99 € | **0.27%** |
| Apple TV+ | Standard | Egypt | 49.99 ج.م | **0.41%** |
| Spotify Premium | Individual | Egypt | 79 ج.م | **0.65%** |
| Spotify Premium | Individual | Tunisia | 12.50 DT | **1.10%** |
| Spotify Premium | Individual | Morocco | 45.00 DH | **1.25%** |

Saudi Arabia prices Spotify in riyals and calls the tiers "Standard" and "Platinum". Apple TV+
is not sold standalone in Egypt at all — it comes bundled into iCloud+. The same nominal product
is a different product in a different market, and the site has to say so.

**The denominator** is World Bank indicator `NY.GNP.PCAP.CN` — GNI per capita in current local
currency, divided by twelve. Free, keyless, sixty years of history, every country.

**The numerator** is the price on the service's own page, in the market's own currency, read
by a person and written down with a date.

---

## The honesty model

The machine never writes a price. Ever.

```
fetch → hash → changed? → alert a human → human re-reads the price → human writes it down
```

- `tools/harvest.mjs` reads pricing pages and **proposes** candidate prices into
  `data/candidates.json`. It is a machine reading a page, not a source of truth.
- `data/prices.json` is the published database. Every row carries a `verified` date and a
  `receipt` URL. A row without both is a bug, and `tools/check.mjs` fails the build on it.
- `tools/watch.mjs` runs nightly. It hashes each pricing page and compares the hash with the
  last one. When a page changes it raises an alert — it does **not** update the price.
- Rows carry their own staleness. The site publishes what share of the database was checked in
  the last 30 days, because a number without a date is not a number.

The wire (`/wire`) is generated from the price history by `tools/make-changes.mjs`, so the feed
and the tables can never disagree.

---

## Everything is free

No budget, no keys, no accounts, no paid APIs, no AI tokens.

| Need | Free option | Key required |
|---|---|---|
| Hosting | GitHub Pages (public repo) | no |
| Domain | `*.eu.org` (human-reviewed, slow) → interim `*.github.io` | no |
| DNS | deSEC | no |
| CI | GitHub Actions (public repos get unlimited minutes) | no |
| Income data | World Bank API | no |
| Price history | The Wayback Machine CDX + snapshots | no |
| App-store data | iTunes Lookup API | no |
| Newsletter | Buttondown / Beehiiv / Resend free tiers | no |
| Analytics | Cloudflare Web Analytics, or GoatCounter | no |
| Fonts / icons | System stack, or Fontsource self-hosted; hand-rolled SVG | no |
| Video | The `ad-factory` you already own | no |
| Payments (optional paid tier) | Stripe — no monthly fee | no |
| Translation | You, in FR and AR | no |

**Total spend: 0.** The operating cost is about an hour a month of re-reading price pages.

---

## Run it

```sh
node tools/pull-income.mjs      # World Bank → data/income.json
node tools/harvest.mjs          # machine proposes → data/candidates.json
node tools/make-changes.mjs     # derive the wire from the history
node src/build.mjs              # → site/
node tools/check.mjs            # the integrity gate
```

Serve it:

```sh
node src/build.mjs && python3 -m http.server 8000 --directory site
```

Harvest a single service or market while filling the database in:

```sh
node tools/harvest.mjs --service=spotify --market=fr --samples=10
```

---

## Layout

```
data/
  markets.json       market registry: currency, locale, World Bank code
  services.json      service registry: pricing URL, plans, archive config
  prices.json        THE DATABASE — verified prices, history, receipts
  income.json        generated: GNI per capita series per market
  alternatives.json  local alternatives and how people here actually pay
  changes.json       generated: the wire
  snapshots.json     generated: page hashes as last seen
  alerts.json        generated: what the watcher wants a human to look at
src/
  build.mjs          the generator
  layout.mjs         the HTML shell
  lib/               i18n, formatting, ECI, charts, paths, data access
  pages/             home, service, market, pair, static
  i18n/              en.json, fr.json, ar.json
tools/
  pull-income.mjs    World Bank → data/income.json
  harvest.mjs        machine proposes; humans confirm
  watch.mjs          nightly change triage
  make-changes.mjs   derive the wire
  check.mjs          the integrity gate
public/              style.css, app.js, favicon
```

---

## Adding a service

1. Add it to `data/services.json` with a pricing URL template, its plans, and an `archive`
   block (the Wayback prefix to look under).
2. Run `node tools/harvest.mjs --service=<id>` and read `data/candidates.json`.
3. Open the source page yourself, confirm which price is which plan, and write the rows into
   `data/prices.json` with a `verified` date and a `receipt`.
4. `node tools/make-changes.mjs && node src/build.mjs && node tools/check.mjs`.

The machine proposes the numbers. You decide what they mean.

## Adding a market

1. Add it to `data/markets.json` with its currency, locales and World Bank code.
2. `node tools/pull-income.mjs` to pull the income series.
3. Same as above for prices.

---

## Deploying

Push to `main` and the `Deploy` workflow publishes `site/` to GitHub Pages. The `Nightly watch`
workflow runs the triage every night and opens an issue when a pricing page moves.

For a custom domain, point a `CNAME` at the Pages host and add the domain in the repository
settings. `*.eu.org` is free but human-reviewed — submit the request early and launch on the
`*.github.io` URL in the meantime.

---

## Roadmap

- [x] ECI metric, three markets, three locales
- [x] Automated price history from the Wayback Machine
- [x] The watcher, the wire, the data page
- [ ] More services: Netflix, Apple TV+, YouTube Premium, ChatGPT Plus, Deezer
- [ ] More markets: Saudi Arabia, Morocco, Türkiye, Argentina
- [ ] Volatility markets — Türkiye and Argentina reprice monthly with inflation
- [ ] The annual report, in three languages
- [ ] A calculator that answers "what does Netflix cost where I live?"
- [ ] Affiliate links, once a programme genuinely exists (no invented links)

---

## License

MIT for the code. The data is released under **CC0** — use it, cite it, check it.

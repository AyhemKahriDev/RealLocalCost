# The Real Local Cost

**What digital services actually cost, where you live, as a share of what people earn there.**

> **Live:** <https://ayhemkahridev.github.io/RealLocalCost/>
> code and data: <https://github.com/AyhemKahriDev/RealLocalCost>
>
> The Cloudflare Pages copy at <https://reallocalcost.pages.dev> is the nicer domain, but it
> only updates once a Cloudflare API token is added as a repo secret. Until then the
> GitHub Pages copy is the current one, so it is the canonical. The token takes thirty
> seconds:
>
> ```sh
> # Cloudflare dashboard → My Profile → API Tokens → Create Token
> #   Permissions: Account → Cloudflare Pages → Edit
> gh secret set CLOUDFLARE_API_TOKEN --repo AyhemKahriDev/RealLocalCost
> ```
>
> After that, every push deploys to both, and the canonical flips back to
> `reallocalcost.pages.dev` with one line in `site.config.json`.

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

**365 verified prices · 65 markets · 9 services · 3 languages · 852 pages**

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

### And the other half of the story

Some services do not price for your market at all. Notion charges **US$20 — the same number
everywhere**. In Nigeria that is **20.2% of a month's income**. In Argentina it is **1.6%**. The
price never changed; the country did. The site converts a global price at the World Bank's
official rate so the two can be compared, and marks every row as either *priced for this
market* or *the same price everywhere*.

**The denominator** is World Bank indicator `NY.GNP.PCAP.CN` — GNI per capita in current local
currency, divided by twelve. Free, keyless, sixty years of history, every country.

**The numerator** is the price on the service's own page, in the market's own currency, read
by a person and written down with a date.

---

## The honesty model

The machine never invents a price. But it can notice that the page it read yesterday says
something different today, and it can read that difference reliably enough to publish it.

```
fetch → read → CONFIDENT?  → publish it, with the receipt and the date
                   UNSURE  → raise an alert for a human
```

A price is **confident** when all of these hold:

1. It is quoted in **the market's own currency**. A page showing a dollar price to a Tunisian
   subscriber is not a Tunisian price. If the service quotes one global price, the machine
   converts it at the World Bank's official rate and marks the row *the same price everywhere*.
2. A **plan name** sits next to it, so we know which plan it is. Plan names are paired with
   prices by an optimal **monotonic** assignment — in a price list the names and the prices
   run in the same order, and a greedy nearest-neighbour gets that wrong.
3. It is within a plausible band of the last published price. Prices move; they do not teleport.
4. No other plan in the same market claims the same number on the same scrape.
5. It reads as the standing **monthly** price — not an introductory rate, not a bundle total,
   not a one-off payment. A page offering both "45 MAD a month" and "450 MAD for the year" is
   asking the reader to pick, and the machine picks the one the page quotes most often.

Everything else becomes an alert. `tools/auto-update.mjs` publishes the confident ones and
files the rest; the *Keep current* workflow runs it every six hours, commits what changed,
and opens an issue for the prices it could not read.

The wire (`/wire`) is generated from the price history by `tools/make-changes.mjs`, so the feed
and the tables can never disagree. `tools/check.mjs` fails the build on a row without a
`verified` date or a receipt, and checks every internal link on every page.

### What the machine had to learn to get right

- **A dollar sign is not a currency.** "4,950" is 4,95 in Tunis and 4,950 in Chicago, and the
  market decides. A bare "$" in an English page is dollars; in the Argentine storefront it is
  pesos — so the page's own language settles it.
- **"kr" is two currencies.** Kronor in Sweden, kroner in Denmark. The market knows which.
- **Promotions are not prices.** "22,50 MAD for 6 months, then 45 MAD a month" has two numbers,
  and the standing price is the second one.
- **A number next to a "$" is not always a price.** "1 of 9" inherits the dollar sign from the
  price above it unless the currency is read from the number's immediate neighbourhood.


## Everything is free

No budget, no keys, no accounts, no paid APIs, no AI tokens.

| Need | Free option | Key required |
|---|---|---|
| Hosting | GitHub Pages (public repo) | no |
| Domain | `*.eu.org` (human-reviewed, slow) → interim `*.github.io` | no |
| DNS | deSEC | no |
| CI | GitHub Actions (public repos get unlimited minutes) | no |
| Income data | World Bank API — `NY.GNP.PCAP.CN`, GNI per capita, local currency | no |
| Exchange rates | World Bank API — `PA.NUS.FCRF`, official LCU per USD | no |
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
node tools/pull-fx.mjs          # World Bank → data/fx.json
node tools/auto-update.mjs      # read every page: publish the sure ones, alert the rest
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

Two homes, one build:

| | URL | How it deploys |
|---|---|---|
| **GitHub Pages** (canonical) | `ayhemkahridev.github.io/RealLocalCost/` | automatically on every push to `main` |
| Cloudflare Pages | `reallocalcost.pages.dev` | `npm run deploy`, or CI once an API token is added |

Both are built from the same `site/` directory, so they cannot disagree.

To deploy to Cloudflare by hand:

```sh
npm run deploy
```

To make CI deploy to Cloudflare automatically, add one secret:

```sh
# Cloudflare dashboard → My Profile → API Tokens → Create Token
#   Permissions: Account → Cloudflare Pages → Edit
gh secret set CLOUDFLARE_API_TOKEN --repo AyhemKahriDev/RealLocalCost
```

The `Cloudflare` job skips itself until that secret exists, so the GitHub Pages mirror keeps
working either way.

### A real domain, for free

`reallocalcost.pages.dev` is fine forever. For `reallocalcost.eu.org` (also free, and the
same route WorseWatch uses):

1. **nic.eu.org/arf/** — sign in with the contact handle, request a domain for
   `reallocalcost`, list the deSEC name servers (`ns1.desec.io`, `ns2.desec.org`), submit.
   Human review: days to weeks.
2. When it is approved, add it as a custom domain on the Cloudflare Pages project, and point
   a `CNAME` at `reallocalcost.pages.dev` in deSEC.
3. The `CNAME` in the Pages project should be `reallocalcost.pages.dev`.

Do the EU.org request early — it is the slow part. The site works on the `pages.dev` URL
while you wait.

---

## The pages

| Page | What it is |
|---|---|
| `/` | The flagship: one subscription, every market, ranked by share of income |
| `/markets/` | Every market we price, and what a month's income is there |
| `/services/` | Every service, and how many markets it actually prices for |
| `/localises/` | **Who prices for your market, and who does not** — the verdict, service by service |
| `/cheapest/` | The cheapest way to watch, market by market |
| `/calculator/` | "What does it cost where I live?" — shareable, works without JavaScript |
| `/method/` | The formula, the sources, and the honesty model |
| `/wire/` | Every verified price move, newest first |
| `/data/` | The whole dataset, free, CC0 |

## Roadmap

- [x] ECI metric, 65 markets, three locales
- [x] The machine keeps itself current, every six hours
- [x] Global prices converted at official rates, and marked as such
- [x] 852 pages in EN / FR / AR
- [ ] More services: Netflix, YouTube Premium, ChatGPT Plus, Adobe, Discord, Canva
- [ ] The annual report, in three languages
- [ ] Affiliate links, once a programme genuinely exists (no invented links)

---

## License

MIT for the code. The data is released under **CC0** — use it, cite it, check it.

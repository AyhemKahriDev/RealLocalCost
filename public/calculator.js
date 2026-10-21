/* The calculator: "what does it cost where I live?"
   Progressive enhancement — the page is useful without this. */

(function () {
  "use strict";

  var dataEl = document.getElementById("calc-data");
  var sel = document.getElementById("calc-service");
  var out = document.getElementById("calc-out");
  var share = document.getElementById("calc-share");
  if (!dataEl || !sel || !out) return;

  var DATA = {};
  try {
    DATA = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  var rtl = document.documentElement.getAttribute("dir") === "rtl";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* The same formatting the server uses, so the numbers match. */
  var SYMBOL = {
    TND: "DT", EGP: "ج.م", EUR: "€", SAR: "ر.س", MAD: "DH", TRY: "₺",
    ARS: "$", USD: "US$", JOD: "د.ا", GBP: "£", DZD: "د.ج", SEK: "kr",
    NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč", HUF: "Ft", INR: "₹",
    PKR: "Rs", LKR: "Rs", IDR: "Rp", PHP: "₱", NGN: "₦", KES: "KSh",
    ZAR: "R", JPY: "¥", KRW: "₩", CNY: "¥", TWD: "NT$", HKD: "HK$",
    SGD: "S$", NZD: "NZ$", AUD: "A$", CAD: "CA$", VND: "₫", THB: "฿",
    ILS: "₪", UAH: "₴", RON: "lei", CHF: "CHF", MYR: "RM", BRL: "R$",
    MXN: "MX$", AED: "د.إ", QAR: "ر.ق", KWD: "د.ك", BHD: "د.ب", IQD: "ع.د",
  };
  var DECIMALS = { JOD: 3, DZD: 3 };

  function fmtPrice(v, cur) {
    if (v == null) return "—";
    var dec = DECIMALS[cur] != null ? DECIMALS[cur] : 2;
    var n = Number(v).toFixed(dec);
    var parts = n.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var num = parts.join(".");
    var sym = SYMBOL[cur];
    if (!sym) return num + " " + cur;
    if (cur === "EUR" || cur === "GBP" || cur === "PLN" || cur === "CZK" || cur === "TRY" || cur === "ILS" || cur === "UAH" || cur === "RON" || cur === "CHF" || cur === "VND" || cur === "THB" || cur === "KRW" || cur === "INR" || cur === "NGN") {
      return num + " " + sym;
    }
    if (cur === "USD" || cur === "HKD" || cur === "TWD" || cur === "SGD" || cur === "NZD" || cur === "AUD" || cur === "CAD" || cur === "BRL" || cur === "MXN") {
      return sym + num;
    }
    return num + " " + sym;
  }

  function band(v) {
    if (v == null) return "faint";
    if (v < 0.5) return "g";
    if (v < 1.5) return "t";
    if (v < 3) return "a";
    return "r";
  }

  var BAND_LABEL = { g: "Light", t: "Moderate", a: "Heavy", r: "Brutal", faint: "Unrated" };

  function render() {
    var key = sel.value;
    var d = DATA[key];
    if (!d) {
      out.innerHTML = "";
      return;
    }
    var b = band(d.eci);
    out.innerHTML =
      '<div class="calc-price"><span class="mono">' + esc(fmtPrice(d.price, d.currency)) + "</span>" +
      '<span class="calc-eci ' + b + '">' + esc(d.eci == null ? "—" : d.eci.toFixed(2)) + "%</span></div>" +
      '<div class="calc-band ' + b + '">' + esc(BAND_LABEL[b]) + "</div>" +
      '<p class="calc-note">' + esc(d.service + " · " + d.market) + "</p>";
    var url = location.pathname + "?s=" + encodeURIComponent(key);
    history.replaceState(null, "", url);
    share.innerHTML = '<a href="' + esc(url) + '">' + esc(url) + "</a>";
  }

  function preselect() {
    var q = new URLSearchParams(location.search).get("s");
    if (q && DATA[q]) sel.value = q;
  }

  preselect();
  sel.addEventListener("change", render);
  render();
})();

// Phishing Email Header Analyzer. Reads the raw headers of one email and explains, in plain English,
// who really sent it, whether the sender passed SPF, DKIM and DMARC, the route it took, and the red
// flags that suggest phishing or spoofing. Everything happens in the browser: no lookups, nothing sent,
// and the pasted headers are never saved.
"use strict";

// ---------------------------------------------------------------- engine (no page access)
const TKP = (() => {
  const MAX_CHARS = 256 * 1024;        // a full header block is rarely over 30 KB
  const MAX_HEADERS = 600;
  const SEV = ["crit", "high", "med", "low", "info"];
  const SEV_LABEL = { crit: "Critical", high: "High", med: "Medium", low: "Low", info: "Note" };
  const WEIGHT = { crit: 45, high: 25, med: 10, low: 3, info: 0 };

  // ---- parsing
  // Splits raw text into headers. Folded lines (starting with a space or tab) continue the previous
  // header; the first blank line after the headers ends them (anything after it is the body).
  function parse(raw) {
    let text = String(raw ?? "");
    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const headers = [];
    let skipped = 0, body = false;
    for (const line of lines) {
      if (/^[ \t]/.test(line) && headers.length) { headers[headers.length - 1].value += " " + line.trim(); continue; }
      if (line.trim() === "") { if (headers.length) { body = true; break; } continue; }
      const m = /^([!-9;-~]{1,80}):[ \t]?(.*)$/.exec(line);
      if (!m) { skipped++; continue; }
      if (headers.length >= MAX_HEADERS) { skipped++; continue; }
      headers.push({ name: m[1], lname: m[1].toLowerCase(), value: m[2].trim() });
    }
    return { headers, skipped, body, truncated };
  }
  const all = (h, name) => h.filter((x) => x.lname === name).map((x) => x.value);
  const first = (h, name) => { const x = h.find((y) => y.lname === name); return x ? x.value : ""; };

  // RFC 2047 encoded words, e.g. =?UTF-8?B?...?= or =?iso-8859-1?Q?...?=
  function decodeWords(s) {
    return String(s || "").replace(/(=\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=)(\s+(?==\?))?/g, (w) => {
      const m = /^=\?([^?*]+)(?:\*[^?]*)?\?([bBqQ])\?([^?]*)\?=/.exec(w.trim());
      if (!m) return w;
      let bytes;
      try {
        if (m[2].toUpperCase() === "B") {
          const bin = atob(m[3]);
          bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        } else {
          const q = m[3].replace(/_/g, " ");
          const out = [];
          for (let i = 0; i < q.length; i++) {
            if (q[i] === "=" && /^[0-9a-fA-F]{2}$/.test(q.slice(i + 1, i + 3))) { out.push(parseInt(q.slice(i + 1, i + 3), 16)); i += 2; } else out.push(q.charCodeAt(i) & 0xff);
          }
          bytes = Uint8Array.from(out);
        }
        try { return new TextDecoder(m[1].toLowerCase()).decode(bytes); } catch (e) { return new TextDecoder("utf-8").decode(bytes); }
      } catch (e) { return w; }
    });
  }

  // "Display Name" <user@domain> -> parts. Works on the first address in a list.
  function address(value) {
    const v = decodeWords(value || "").trim();
    if (!v) return null;
    let display = "", addr = "";
    const angle = /^(.*?)<\s*([^<>\s]+)\s*>/.exec(v);
    if (angle) { display = angle[1]; addr = angle[2]; } else {
      const bare = /([^\s<>(),;:"]+@[^\s<>(),;:"]+)/.exec(v);
      addr = bare ? bare[1] : v;
      const comment = /\(([^)]*)\)/.exec(v);
      if (comment) display = comment[1];
    }
    display = display.trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"').trim();
    addr = addr.replace(/^mailto:/i, "").trim().toLowerCase();
    const at = addr.lastIndexOf("@");
    const domain = at > 0 ? addr.slice(at + 1).replace(/[>.\s]+$/, "") : "";
    return { display, address: addr, domain, raw: v.slice(0, 300) };
  }

  // Registrable ("organisational") domain: mail.paypal.com -> paypal.com, a.b.co.uk -> b.co.uk.
  const TWO_PART = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "ltd.uk", "plc.uk", "com.au", "net.au", "org.au", "edu.au", "gov.au",
    "co.nz", "org.nz", "co.jp", "ne.jp", "or.jp", "com.br", "com.bd", "gov.bd", "com.sg", "gov.sg", "com.cn", "com.hk", "co.in", "gov.in",
    "co.za", "com.mx", "com.tr", "com.my", "com.ph", "com.pk", "co.kr", "gc.ca", "qc.ca", "on.ca", "bc.ca", "ab.ca", "com.ar", "co.id"]);
  function orgDomain(d) {
    const parts = String(d || "").toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
    if (parts.length <= 2) return parts.join(".");
    const last2 = parts.slice(-2).join(".");
    return TWO_PART.has(last2) ? parts.slice(-3).join(".") : last2;
  }
  const label = (d) => orgDomain(d).split(".")[0] || "";

  // ---- authentication results
  // Authentication-Results: mx.example; spf=pass smtp.mailfrom=a.com; dkim=pass header.d=a.com; dmarc=pass header.from=a.com
  function authResults(value) {
    const noComments = String(value).replace(/\([^()]*\)/g, " ");
    const clauses = noComments.split(";").map((c) => c.trim()).filter(Boolean);
    const res = { by: clauses.length && !/=/.test(clauses[0].split(/\s/)[0]) ? clauses[0].split(/\s/)[0] : "", items: [] };
    for (const c of clauses) {
      const m = /^([a-z0-9-]+)\s*=\s*([a-z]+)/i.exec(c);
      if (!m) continue;
      const props = {};
      for (const p of c.matchAll(/([a-z0-9_.-]+)\s*=\s*("[^"]*"|[^\s;]+)/gi)) props[p[1].toLowerCase()] = p[2].replace(/^"|"$/g, "");
      const policy = /\bp=([a-z]+)/i.exec(String(value).slice(String(value).toLowerCase().indexOf(m[1].toLowerCase() + "=")));
      res.items.push({ method: m[1].toLowerCase(), result: m[2].toLowerCase(), props, policy: policy ? policy[1].toLowerCase() : "" });
    }
    return res;
  }
  function auth(h) {
    // The top Authentication-Results header is the one added by the receiving server; lower ones could
    // have been written by anyone along the way, so only the first with results is trusted.
    const ar = all(h, "authentication-results").map(authResults).find((r) => r.items.length) || null;
    const arc = all(h, "arc-authentication-results").map((v) => authResults(v.replace(/^\s*i=\d+\s*;/, ""))).find((r) => r.items.length) || null;
    const src = ar || arc;
    const pick = (method) => (src ? src.items.filter((i) => i.method === method) : []);
    const out = { source: ar ? "Authentication-Results" : arc ? "ARC-Authentication-Results" : "", by: src ? src.by : "" };
    const spf = pick("spf")[0];
    out.spf = spf ? { result: spf.result, domain: (spf.props["smtp.mailfrom"] || spf.props["smtp.helo"] || "").replace(/^.*@/, "") } : null;
    if (!out.spf) {
      const rs = first(h, "received-spf");
      const m = /^\s*([a-z]+)/i.exec(rs);
      if (m) out.spf = { result: m[1].toLowerCase(), domain: ((/envelope-from=("?)([^\s;"]+)\1/i.exec(rs) || [])[2] || "").replace(/^.*@/, "") };
    }
    out.dkim = pick("dkim").map((d) => ({ result: d.result, domain: (d.props["header.d"] || d.props["header.i"] || "").replace(/^@/, "").replace(/^.*@/, "").replace(/^none$/i, ""), selector: d.props["header.s"] || "" }));
    const dm = pick("dmarc")[0];
    out.dmarc = dm ? { result: dm.result, from: dm.props["header.from"] || "", policy: dm.policy } : null;
    const ca = pick("compauth")[0];
    out.compauth = ca ? { result: ca.result, reason: ca.props.reason || "" } : null;
    // DKIM signatures present in the message (useful when no results header exists)
    out.signatures = all(h, "dkim-signature").map((v) => ({ domain: ((/\bd=([^;\s]+)/i.exec(v) || [])[1] || "").toLowerCase(), selector: (/\bs=([^;\s]+)/i.exec(v) || [])[1] || "" }));
    return out;
  }
  const dkimBest = (a) => {
    if (!a.dkim.length) return null;
    return a.dkim.find((d) => d.result === "pass") || a.dkim[0];
  };

  // ---- route
  const IPV4 = /\b((?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3})\b/;
  function privateIp(ip) {
    if (!ip) return false;
    if (ip.includes(":")) return /^(::1|fe80:|fc|fd)/i.test(ip);
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  function hop(value) {
    const v = String(value);
    const semi = v.lastIndexOf(";");
    const when = semi >= 0 ? Date.parse(v.slice(semi + 1).trim().replace(/\s*\([^)]*\)\s*$/, "")) : NaN;
    const part = (kw) => ((new RegExp("\\b" + kw + "\\s+([^\\s;()]+)", "i")).exec(v.slice(0, semi >= 0 ? semi : v.length)) || [])[1] || "";
    const fromPart = (/\bfrom\s+([\s\S]*?)(?=\s\bby\b|$)/i.exec(v) || [])[1] || "";
    const ip6 = (/\[?IPv6:([0-9a-f:.]+)\]?/i.exec(fromPart) || [])[1];
    const ip4 = (/\[(\d{1,3}(?:\.\d{1,3}){3})\]/.exec(fromPart) || IPV4.exec(fromPart) || [])[1];
    return {
      from: part("from"), by: part("by"), with: part("with"), ip: ip6 || ip4 || "",
      time: isNaN(when) ? null : when, tls: /\bwith\s+(E?SMTPS|ESMTPSA|ESMTPS|SMTPS|HTTPS|LMTPS)\b/i.test(v) || /\b(TLS|version=TLS)/i.test(v),
      raw: v.slice(0, 600),
    };
  }
  function route(h) {
    const hops = all(h, "received").map(hop).reverse();  // oldest first
    for (let i = 0; i < hops.length; i++) {
      const prev = hops[i - 1];
      hops[i].delay = prev && prev.time !== null && hops[i].time !== null ? Math.round((hops[i].time - prev.time) / 1000) : null;
    }
    return hops;
  }

  // ---- reference lists
  const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.ca", "live.com", "live.ca", "msn.com",
    "yahoo.com", "yahoo.ca", "ymail.com", "aol.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net",
    "mail.com", "zoho.com", "yandex.com", "yandex.ru", "tutanota.com", "rogers.com", "bell.net", "shaw.ca", "sympatico.ca", "videotron.ca"]);
  // Brands most often imitated in phishing, with the domains they really send from.
  const BRANDS = [
    ["Microsoft", ["microsoft.com", "office.com", "office365.com", "outlook.com", "live.com", "microsoftonline.com", "sharepoint.com", "onmicrosoft.com", "microsoft365.com"], ["microsoft", "office365", "microsoft365", "onedrive", "sharepoint", "outlook"]],
    ["PayPal", ["paypal.com", "paypal.ca"], ["paypal"]],
    ["DocuSign", ["docusign.com", "docusign.net"], ["docusign"]],
    ["Amazon", ["amazon.com", "amazon.ca", "amazonses.com", "amazon.co.uk"], ["amazon"]],
    ["Apple", ["apple.com", "icloud.com"], ["apple", "icloud"]],
    ["Google", ["google.com", "gmail.com", "googlemail.com", "youtube.com"], ["google"]],
    ["LinkedIn", ["linkedin.com"], ["linkedin"]],
    ["Canada Revenue Agency", ["canada.ca", "gc.ca", "cra-arc.gc.ca"], ["canadarevenue", "cra-arc", "craarc"]],
    ["Interac", ["interac.ca"], ["interac"]],
    ["RBC", ["rbc.com", "rbcroyalbank.com"], ["rbcroyal", "royalbank"]],
    ["TD", ["td.com", "tdbank.com", "tdcanadatrust.com"], ["tdcanada", "tdbank"]],
    ["BMO", ["bmo.com"], ["bmobank"]],
    ["Scotiabank", ["scotiabank.com"], ["scotiabank"]],
    ["CIBC", ["cibc.com"], ["cibcbank"]],
    ["Desjardins", ["desjardins.com"], ["desjardins"]],
    ["Canada Post", ["canadapost.ca", "postescanada.ca", "canadapost-postescanada.ca"], ["canadapost", "postescanada"]],
    ["Purolator", ["purolator.com"], ["purolator"]],
    ["FedEx", ["fedex.com"], ["fedex"]],
    ["DHL", ["dhl.com", "dhl.ca"], ["dhlexpress", "dhl-"]],
    ["UPS", ["ups.com"], ["upsdelivery", "ups-"]],
    ["Netflix", ["netflix.com"], ["netflix"]],
    ["Adobe", ["adobe.com"], ["adobe"]],
    ["Dropbox", ["dropbox.com", "dropboxmail.com"], ["dropbox"]],
    ["WeTransfer", ["wetransfer.com"], ["wetransfer"]],
    ["Zoom", ["zoom.us"], ["zoomus", "zoom-"]],
    ["Okta", ["okta.com"], ["okta"]],
    ["Coinbase", ["coinbase.com"], ["coinbase"]],
    ["Facebook", ["facebook.com", "facebookmail.com", "meta.com"], ["facebook"]],
    ["Instagram", ["instagram.com"], ["instagram"]],
  ].map(([name, domains, tokens]) => ({ name, domains, tokens, labels: [...new Set(domains.map(label))] }));
  const ROLE_WORDS = /\b(ceo|cfo|coo|cto|ciso|president|chair|director|vp|vice president|owner|founder|payroll|hr|human resources|finance|accounts?( payable)?|it( support| department| help ?desk)?|help ?desk|service ?desk|security( team)?|admin(istrator)?|support|billing|treasury)\b/i;
  const URGENT = /\b(urgent|immediately|action required|verify|verification|suspend(ed)?|locked|unusual (sign|activity)|password|expire[sd]?|invoice|payment|wire|transfer|gift ?cards?|bank details|overdue|refund|tax|parcel|delivery failed|confidential)\b/i;

  // ---- look-alikes
  const HOMO = [["rn", "m"], ["vv", "w"], ["0", "o"], ["1", "l"], ["3", "e"], ["5", "s"], ["4", "a"], ["7", "t"], ["8", "b"], ["$", "s"], ["@", "a"], ["!", "i"], ["|", "l"]];
  const skeleton = (s) => { let t = String(s).toLowerCase(); for (const [a, b] of HOMO) t = t.split(a).join(b); return t.replace(/i/g, "l"); };
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 9;
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const t = d[j];
        d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = t;
      }
    }
    return d[b.length];
  }
  // Is `domain` imitating `real` (a domain it is not)? Returns a reason or "".
  function imitates(domain, realOrg) {
    const d = orgDomain(domain), r = orgDomain(realOrg);
    if (!d || !r || d === r) return "";
    const dl = label(d), rl = label(r);
    if (!dl || !rl || rl.length < 3) return "";
    if (dl === rl) return `uses the same name as ${r} with a different ending (.${d.split(".").slice(1).join(".")})`;
    if (skeleton(dl) === skeleton(rl)) return `swaps look-alike characters to imitate ${r}`;
    const dist = lev(dl, rl);
    if ((rl.length >= 5 && dist === 1) || (rl.length >= 8 && dist === 2)) return `is one or two letters away from ${r}`;
    const parts = skeleton(dl).split(/[-_.]/);
    if (rl.length >= 4 && (parts.includes(skeleton(rl)) || skeleton(dl).startsWith(skeleton(rl) + "-") || skeleton(dl).endsWith("-" + skeleton(rl)))) return `adds words around the name ${rl} to look like ${r}`;
    return "";
  }
  function brandMatch(domain) {
    const d = orgDomain(domain);
    if (!d) return null;
    const sk = skeleton(d.replace(/\.[^.]+$/, ""));
    for (const b of BRANDS) {
      if (b.domains.some((x) => orgDomain(x) === d)) return null;  // the brand itself
      for (const real of b.domains) { const why = imitates(d, real); if (why) return { brand: b, why }; }
      const tok = b.tokens.find((t) => t.length >= 5 && sk.includes(skeleton(t)));
      if (tok) return { brand: b, why: `contains "${tok.replace(/-$/, "")}" but is not a ${b.name} domain` };
    }
    return null;
  }
  const isBrandDomain = (b, domain) => b.domains.some((x) => orgDomain(x) === orgDomain(domain));
  const MIXED_SCRIPT = /[Ͱ-ϿЀ-ӿ]/;

  // ---- analysis
  function analyse(raw, opt = {}) {
    const p = parse(raw);
    const h = p.headers;
    const ownDomain = orgDomain(String(opt.orgDomain || "").trim().replace(/^https?:\/\//i, "").replace(/^.*@/, "").replace(/\/.*$/, ""));
    const meta = {
      from: address(first(h, "from")), replyTo: address(first(h, "reply-to")), returnPath: address(first(h, "return-path")),
      sender: address(first(h, "sender")), to: decodeWords(first(h, "to")).slice(0, 300), subject: decodeWords(first(h, "subject")).slice(0, 400),
      date: first(h, "date"), messageId: first(h, "message-id").replace(/^<|>$/g, ""), mailer: first(h, "x-mailer") || first(h, "user-agent"),
      bulk: !!first(h, "list-unsubscribe") || /bulk|list/i.test(first(h, "precedence")),
    };
    const a = auth(h);
    const hops = route(h);
    const findings = [];
    const add = (sev, id, title, why, evidence) => findings.push({ sev, id, title, why, evidence: String(evidence ?? "").slice(0, 400) });
    const R = { parse: p, meta, auth: a, hops, findings, ownDomain };

    if (!h.length) return { ...R, empty: true, verdict: { level: "none", score: 0 } };
    if (!meta.from) add("info", "NO_FROM", "No From address found", "The pasted text has no From header. Paste the complete header block from the top.", "");
    const from = meta.from || { display: "", address: "", domain: "" };
    const fromOrg = orgDomain(from.domain);

    // Authentication
    const spf = a.spf, dmarc = a.dmarc, dk = dkimBest(a);
    if (!a.source && !spf) {
      add("info", "NO_AUTH", "No authentication results in these headers",
        "The receiving server didn't record SPF, DKIM or DMARC checks, or the headers are incomplete. The sender can't be verified from this copy.", "");
    }
    if (dmarc && /fail/.test(dmarc.result)) {
      add("high", "DMARC_FAIL", "DMARC failed: the From address could not be verified",
        `The sending domain's own rules say mail like this should not be trusted${dmarc.policy ? ` (its policy is p=${dmarc.policy})` : ""}. This is the strongest technical sign the From address is forged.`,
        `dmarc=${dmarc.result}${dmarc.from ? " header.from=" + dmarc.from : ""}`);
    } else if (dmarc && /none|temperror|permerror/.test(dmarc.result)) {
      add("low", "DMARC_NONE", "DMARC gave no answer", "The sending domain has no usable DMARC record, so nothing protects its name from being forged.", `dmarc=${dmarc.result}`);
    }
    if (spf && spf.result === "fail") add("high", "SPF_FAIL", "SPF failed: sent from a server the domain does not allow",
      "The domain publishes a list of servers allowed to send its mail. This one isn't on it.", `spf=fail${spf.domain ? " for " + spf.domain : ""}`);
    else if (spf && spf.result === "softfail") add("med", "SPF_SOFTFAIL", "SPF soft-failed",
      "The sending server is probably not authorised to send for this domain.", `spf=softfail${spf.domain ? " for " + spf.domain : ""}`);
    else if (spf && /temperror|permerror/.test(spf.result)) add("low", "SPF_ERROR", "SPF check errored", "The domain's SPF record could not be evaluated.", `spf=${spf.result}`);
    if (a.dkim.length && !a.dkim.some((d) => d.result === "pass")) add("med", "DKIM_FAIL", "DKIM signature did not verify",
      "The message's digital signature is missing or broken, so it may have been altered or sent by someone else.", a.dkim.map((d) => `dkim=${d.result}${d.domain ? " (" + d.domain + ")" : ""}`).join(", "));
    if (a.compauth && a.compauth.result === "fail") add("high", "COMPAUTH_FAIL", "Microsoft's sender check failed",
      "Microsoft 365 combined its checks and could not confirm who sent this.", `compauth=fail reason=${a.compauth.reason}`);
    if (dk && dk.result === "pass" && dk.domain && fromOrg && orgDomain(dk.domain) !== fromOrg && !(dmarc && dmarc.result === "pass")) {
      add("low", "DKIM_UNALIGNED", "Signed by a different domain than the From address",
        `The signature belongs to ${dk.domain}, not ${from.domain}. Common for mailing services, but it does not prove the From address.`, `dkim d=${dk.domain}`);
    }

    // Spam verdicts already recorded by the receiving system
    const fop = first(h, "x-forefront-antispam-report") + ";" + first(h, "x-microsoft-antispam");
    const scl = parseInt((/SCL:(-?\d+)/i.exec(fop) || /^(-?\d+)/.exec(first(h, "x-ms-exchange-organization-scl")) || [])[1], 10);
    const cat = ((/CAT:([A-Z]+)/i.exec(fop) || [])[1] || "").toUpperCase();
    if (/PHSH|HPHSH|HPHISH|SPOOF|GIMP|UIMP|DIMP/.test(cat)) add("crit", "MS_PHISH", "Microsoft classified this as phishing or impersonation",
      "Microsoft 365's filters already marked this message as phishing, spoofing or impersonation.", `CAT:${cat}`);
    else if (scl >= 5) add("high", "MS_SPAM", "Microsoft rated this as spam", `Spam confidence level ${scl} (5 or more is spam).`, `SCL:${scl}${cat ? " CAT:" + cat : ""}`);
    else if (scl === -1) add("info", "MS_BYPASS", "Spam filtering was skipped", "A rule or allow list let this message bypass filtering. Make sure that was intended.", "SCL:-1");
    if (/^\s*yes/i.test(first(h, "x-spam-flag")) || /^\s*yes/i.test(first(h, "x-spam-status"))) add("high", "SPAM_FLAG", "The mail server flagged this as spam", "", first(h, "x-spam-status") || "X-Spam-Flag: YES");

    // Identity
    if (from.domain && /(^|\.)xn--/.test(from.domain)) add("high", "PUNYCODE", "The sender's domain uses international characters",
      "Domains starting with xn-- can display letters from other alphabets that look like familiar ones.", from.domain);
    if (MIXED_SCRIPT.test(from.display) && /[a-z]/i.test(from.display)) add("high", "MIXED_SCRIPT", "The display name mixes alphabets",
      "Some letters in the name are Greek or Cyrillic look-alikes, a trick to imitate a real sender.", from.display);
    const shownAddr = /([^\s<>"]+@[^\s<>"]+)/.exec(from.display);
    if (shownAddr && shownAddr[1].toLowerCase() !== from.address) add("high", "DISPLAY_ADDR", "The display name shows a different email address",
      `The name says ${shownAddr[1]}, but the message really came from ${from.address}.`, `${from.display} <${from.address}>`);

    let brandHit = null;
    if (ownDomain && from.domain && orgDomain(from.domain) !== ownDomain) {
      const why = imitates(from.domain, ownDomain);
      if (why) add("crit", "OWN_LOOKALIKE", "The sender's domain imitates your organisation",
        `${from.domain} ${why}. Attackers register domains like this to pass as colleagues or suppliers.`, from.address);
    }
    if (from.domain && !findings.some((f) => f.id === "OWN_LOOKALIKE")) {
      brandHit = brandMatch(from.domain);
      if (brandHit) add("high", "BRAND_LOOKALIKE", `Look-alike domain imitating ${brandHit.brand.name}`,
        `${from.domain} ${brandHit.why}. The real ${brandHit.brand.name} sends from ${brandHit.brand.domains.slice(0, 3).join(", ")}.`, from.address);
    }
    if (from.display && from.domain) {
      const claimed = BRANDS.find((b) => new RegExp("\\b" + b.name.replace(/\s+/g, "\\s*") + "\\b", "i").test(from.display));
      if (claimed && !isBrandDomain(claimed, from.domain) && !(brandHit && brandHit.brand === claimed)) {
        add("high", "BRAND_NAME", `Says it is from ${claimed.name}, but isn't sent from a ${claimed.name} domain`,
          `The display name says "${from.display}", but the address is ${from.address}.`, `${from.display} <${from.address}>`);
      }
      if (FREE_MAIL.has(orgDomain(from.domain)) && ROLE_WORDS.test(from.display)) add("med", "FREE_ROLE", "A job title or department name on a free email account",
        `"${from.display}" is using ${from.domain}. Executives, finance and IT teams normally email from the company's own domain. This is the classic set-up for CEO fraud and fake IT requests.`, `${from.display} <${from.address}>`);
      if (ownDomain && FREE_MAIL.has(orgDomain(from.domain)) && !ROLE_WORDS.test(from.display)) {
        // nothing: personal messages from free accounts are normal
      }
    }
    // Reply-To and Return-Path
    if (meta.replyTo && meta.replyTo.domain && fromOrg && orgDomain(meta.replyTo.domain) !== fromOrg) {
      const free = FREE_MAIL.has(orgDomain(meta.replyTo.domain));
      add(free || !meta.bulk ? "high" : "med", "REPLY_TO", "Replies would go to a different address",
        `If you reply, it goes to ${meta.replyTo.address}${free ? ", a free email account," : ""} instead of ${from.address}. Scammers use this so the conversation reaches them, not the person they are pretending to be.`,
        `Reply-To: ${meta.replyTo.address}`);
    }
    if (meta.returnPath && meta.returnPath.domain && fromOrg && orgDomain(meta.returnPath.domain) !== fromOrg) {
      const bad = (spf && /fail/.test(spf.result)) || (dmarc && /fail/.test(dmarc.result));
      add(bad ? "med" : "info", "RETURN_PATH", "Bounces go to a different domain",
        bad ? `The bounce address (${meta.returnPath.domain}) doesn't match the From domain and authentication failed.`
          : `The bounce address (${meta.returnPath.domain}) differs from the From domain. Normal for mailing services; worth noting with other flags.`,
        `Return-Path: ${meta.returnPath.address}`);
    }

    // Content of headers
    if (meta.subject && URGENT.test(meta.subject)) add("low", "URGENT", "Urgent or money-related subject line",
      "Pressure and payment words are common in phishing. On their own they prove nothing.", meta.subject);

    // Route and time
    const external = hops.find((x) => x.ip && !privateIp(x.ip));
    const firstTime = hops.find((x) => x.time !== null);
    const lastTime = [...hops].reverse().find((x) => x.time !== null);
    const dated = Date.parse(meta.date);
    if (!isNaN(dated) && firstTime && Math.abs(firstTime.time - dated) > 24 * 3600e3) add("low", "DATE_SKEW", "The Date header is far from when the email was actually sent",
      "The date shown in the email differs from the first server's timestamp by more than a day. It may have been forged or delayed.", `Date: ${meta.date}`);
    if (!isNaN(dated) && lastTime && dated - lastTime.time > 3600e3) add("low", "DATE_FUTURE", "Dated in the future", "The Date header is later than the time the message arrived.", `Date: ${meta.date}`);
    const slow = hops.find((x) => x.delay !== null && x.delay > 3600);
    if (slow) add("info", "SLOW_HOP", "A long delay between two servers", `One step took ${Math.round(slow.delay / 60)} minutes. Usually harmless (queues, greylisting).`, slow.raw.slice(0, 160));
    const msgDomain = (/@([^>\s]+)/.exec(meta.messageId) || [])[1] || "";

    // Verdict
    findings.sort((x, y) => SEV.indexOf(x.sev) - SEV.indexOf(y.sev));
    const score = findings.reduce((s, f) => s + WEIGHT[f.sev], 0);
    const flags = findings.filter((f) => f.sev !== "info").length;
    const passed = dmarc && dmarc.result === "pass";
    let level = "good";
    if (findings.some((f) => f.sev === "crit") || score >= 45) level = "bad";
    else if (score >= 20 || findings.some((f) => f.sev === "high")) level = "wait";
    const headline = level === "bad" ? "This email shows strong signs of phishing or spoofing."
      : level === "wait" ? "This email has warning signs. Treat it with caution."
        : passed ? "The sender checks out, and no red flags were found in the headers."
          : "No strong red flags were found in the headers.";
    return {
      ...R, msgDomain, external,
      verdict: { level, score, flags, headline, passed: !!passed },
      summary: { transit: firstTime && lastTime ? Math.round((lastTime.time - firstTime.time) / 1000) : null },
    };
  }

  // ---- plain-text report, for pasting into a ticket or an email to IT
  function report(r, when) {
    const L = [];
    const f = r.meta.from;
    L.push("EMAIL HEADER ANALYSIS", `Analysed: ${when}`, "", `Verdict: ${r.verdict.headline}`, "");
    L.push(`From:        ${f ? `${f.display ? f.display + " " : ""}<${f.address}>` : "(none)"}`);
    if (r.meta.replyTo) L.push(`Reply-To:    ${r.meta.replyTo.address}`);
    if (r.meta.returnPath) L.push(`Return-Path: ${r.meta.returnPath.address}`);
    L.push(`Subject:     ${r.meta.subject || "(none)"}`, `Date:        ${r.meta.date || "(none)"}`, "");
    const a = r.auth, dk = dkimBest(a);
    L.push(`SPF:   ${a.spf ? a.spf.result + (a.spf.domain ? " (" + a.spf.domain + ")" : "") : "not recorded"}`);
    L.push(`DKIM:  ${dk ? dk.result + (dk.domain ? " (" + dk.domain + ")" : "") : "not recorded"}`);
    L.push(`DMARC: ${a.dmarc ? a.dmarc.result + (a.dmarc.policy ? " (p=" + a.dmarc.policy + ")" : "") : "not recorded"}`, "");
    L.push("RED FLAGS");
    const list = r.findings.filter((x) => x.sev !== "info");
    if (!list.length) L.push("  None found in the headers.");
    list.forEach((x) => { L.push(`  [${SEV_LABEL[x.sev]}] ${x.title}`); if (x.evidence) L.push(`      ${x.evidence}`); });
    L.push("", "ROUTE (oldest first)");
    r.hops.forEach((x, i) => L.push(`  ${i + 1}. ${x.from || "?"}${x.ip ? " [" + x.ip + "]" : ""} -> ${x.by || "?"}${x.time !== null ? "  " + new Date(x.time).toISOString() : ""}`));
    L.push("", "Generated with the free Phishing Email Header Analyzer, https://mshshuvo.com/toolkit/email-header-analyzer",
      "Header analysis cannot check links or attachments. If in doubt, report the email and don't click anything.");
    return L.join("\n");
  }

  // ---- samples (fictional organisations; documentation IP ranges; .example domains)
  function samples() {
    const now = new Date("2026-11-18T14:05:00Z");
    const t = (min) => new Date(now.getTime() + min * 60000).toUTCString().replace("GMT", "+0000");
    return {
      phish: {
        label: "Fake Microsoft alert",
        org: "northgate.example",
        text: [
          `Received: from BN8PR11MB3601.namprd11.prod.outlook.com (2603:10b6:408:8c::14) by SJ0PR11MB5040.namprd11.prod.outlook.com with HTTPS; ${t(1)}`,
          `Received: from mail.rnicrosoft-security.example (203.0.113.45) by BN8PR11MB3601.mail.protection.outlook.com (10.167.242.90) with Microsoft SMTP Server id 15.20.7633.4; ${t(0)}`,
          "Authentication-Results: spf=softfail (sender IP is 203.0.113.45) smtp.mailfrom=rnicrosoft-security.example; dkim=none (message not signed) header.d=none;dmarc=fail action=quarantine header.from=rnicrosoft-security.example;compauth=fail reason=001",
          "Received-SPF: SoftFail (protection.outlook.com: domain of transitioning rnicrosoft-security.example discourages use of 203.0.113.45 as permitted sender)",
          "X-Forefront-Antispam-Report: CIP:203.0.113.45;CTRY:;LANG:en;SCL:5;SRV:;IPV:NLI;SFV:SPM;CAT:SPM;SFS:(13230040);DIR:INB;",
          'From: "Microsoft 365 Security" <no-reply@rnicrosoft-security.example>',
          "Reply-To: m365.account.team@gmail.com",
          "Return-Path: bounce@rnicrosoft-security.example",
          "To: sam.taylor@northgate.example",
          "Subject: Action required: your mailbox will be suspended in 24 hours",
          `Date: ${t(-2)}`,
          "Message-ID: <a81f2c90.4d1e@rnicrosoft-security.example>",
          "MIME-Version: 1.0",
          "Content-Type: text/html; charset=utf-8",
        ].join("\r\n"),
      },
      ceo: {
        label: "CEO gift-card request",
        org: "northgate.example",
        text: [
          `Received: from mail-sor-f41.google.com (mail-sor-f41.google.com. [192.0.2.41]) by mx1.northgate.example (Postfix) with ESMTPS id 4Ckq2x; ${t(1)}`,
          `Received: by mail-sor-f41.google.com with SMTP id d9443c01a7336-1f2b; ${t(0)}`,
          "Authentication-Results: mx1.northgate.example; dkim=pass (2048-bit key) header.d=gmail.com header.i=@gmail.com header.s=20230601; spf=pass (mx1.northgate.example: domain of dana.whitfield.ceo@gmail.com designates 192.0.2.41 as permitted sender) smtp.mailfrom=dana.whitfield.ceo@gmail.com; dmarc=pass (p=NONE sp=QUARANTINE dis=NONE) header.from=gmail.com",
          "DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=gmail.com; s=20230601; h=to:subject:message-id:date:from:mime-version; bh=abc=; b=def=",
          'From: "Dana Whitfield, CEO" <dana.whitfield.ceo@gmail.com>',
          "Reply-To: dana.whitfield.office@outlook.com",
          "To: accounts.payable@northgate.example",
          "Subject: Quick favour - urgent and confidential",
          `Date: ${t(-1)}`,
          "Message-ID: <CAF3x9=Qm1@mail.gmail.com>",
          "MIME-Version: 1.0",
        ].join("\r\n"),
      },
      clean: {
        label: "Genuine supplier email",
        org: "northgate.example",
        text: [
          `Received: from mx2.northgate.example (10.20.0.12) by mbx01.northgate.example (10.20.0.31) with Microsoft SMTP Server (version=TLS1_2) id 15.2.1544.4; ${t(1)}`,
          `Received: from out-07.mailer.harbourline.example (out-07.mailer.harbourline.example [198.51.100.7]) by mx2.northgate.example (Postfix) with ESMTPS id 7Hq1Zt; ${t(0)}`,
          "Authentication-Results: mx2.northgate.example; spf=pass (domain of billing@harbourline.example designates 198.51.100.7 as permitted sender) smtp.mailfrom=billing@harbourline.example; dkim=pass (2048-bit key) header.d=harbourline.example header.s=hl2026; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=harbourline.example",
          "DKIM-Signature: v=1; a=rsa-sha256; d=harbourline.example; s=hl2026; h=from:to:subject:date; bh=xyz=; b=uvw=",
          'From: "Harbourline Logistics Billing" <billing@harbourline.example>',
          "Return-Path: billing@harbourline.example",
          "To: accounts.payable@northgate.example",
          "Subject: Your November statement is ready",
          `Date: ${t(-1)}`,
          "Message-ID: <20261118140400.5512@harbourline.example>",
          "MIME-Version: 1.0",
        ].join("\r\n"),
      },
    };
  }

  return { parse, decodeWords, address, orgDomain, authResults, auth, route, privateIp, imitates, brandMatch, skeleton, analyse, report, samples, SEV, SEV_LABEL, MAX_CHARS };
})();

// ---------------------------------------------------------------- page
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tk-headers")) return;
  const { $ } = TK;
  const html = TK.html;
  const db = TK.store("mshshuvo:toolkit:email-header-analyzer:v1");  // only the organisation domain is kept
  const saved = db.get() || {};
  $("ph-org").value = typeof saved.org === "string" ? saved.org.slice(0, 120) : "";
  let R = null;
  const SAMPLES = TKP.samples();
  const RES = { pass: "pass", fail: "fail", softfail: "softfail", none: "none", neutral: "neutral" };
  const tone = (r) => (!r ? "" : r === "pass" ? "ok" : /fail/.test(r) ? "bad" : "warn");
  const fmtTime = (t) => (t === null ? "time unknown" : new Date(t).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }));
  const fmtDelay = (s) => (s === null ? "" : s < 1 ? "under a second" : s < 120 ? `${s} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`);

  function kpi(name, result, detail) {
    const t = tone(result);
    const cls = t === "ok" ? "tk-kpi--calm" : t === "bad" ? "tk-kpi--alert" : "tk-kpi--watch";
    const word = !result ? "Not recorded" : result === "pass" ? "Passed" : /fail/.test(result) ? (result === "softfail" ? "Soft fail" : "Failed") : result[0].toUpperCase() + result.slice(1);
    return html`<div class="tk-kpi ${cls}"><span class="tk-kpi__lab">${name}</span><span class="tk-kpi__val">${word}</span><span class="tk-kpi__delta">${detail}</span></div>`;
  }
  function row(label, a, fromOrg, note) {
    if (!a) return html`<tr><th scope="row">${label}</th><td class="tk-muted">Not present</td><td></td></tr>`;
    const same = a.domain && fromOrg && TKP.orgDomain(a.domain) === fromOrg;
    return html`<tr><th scope="row">${label}</th><td><span class="tk-code">${a.address || a.raw}</span>${a.display ? html` <span class="tk-muted">${a.display}</span>` : ""}</td>
      <td>${label === "From" ? "" : same ? html`<span class="tk-tag tk-tag--ok">Same domain as From</span>` : html`<span class="tk-tag tk-tag--over">Different domain</span>`}${note ? html` <span class="tk-muted">${note}</span>` : ""}</td></tr>`;
  }

  function render() {
    const out = $("ph-results");
    if (!R || R.empty) {
      out.hidden = true;
      $("ph-msg").textContent = R && R.empty ? "No email headers found. Paste the full header block, starting with lines like Received:, From: and Subject:." : "";
      $("ph-msg").className = R && R.empty ? "tk-msg tk-msg--err" : "tk-msg";
      return;
    }
    out.hidden = false;
    const v = R.verdict, a = R.auth, m = R.meta, from = m.from || {};
    const fromOrg = TKP.orgDomain(from.domain);
    const notes = [];
    if (R.parse.truncated) notes.push(`Only the first ${TKP.MAX_CHARS / 1024} KB were read.`);
    if (R.parse.skipped) notes.push(`${R.parse.skipped} line${R.parse.skipped === 1 ? " wasn't a header and was" : "s weren't headers and were"} skipped.`);
    if (R.parse.body) notes.push("Text after the headers (the message body) was ignored.");
    $("ph-msg").textContent = notes.join(" ");
    $("ph-msg").className = "tk-msg";

    $("ph-verdict").className = "tk-card tk-headline tk-verdict " + (v.level === "bad" ? "tk-verdict--bad" : v.level === "wait" ? "tk-verdict--wait" : "tk-verdict--good");
    $("ph-headline").textContent = v.headline;
    $("ph-headfoot").textContent = `${v.flags} red flag${v.flags === 1 ? "" : "s"} found. ${v.level === "good"
      ? "Headers can't check links or attachments, so still be careful with anything unexpected."
      : "Don't click links, open attachments or reply. Report it to your IT or security team."}`;

    const dk = a.dkim.find((d) => d.result === "pass") || a.dkim[0];
    $("ph-kpis").innerHTML = html`${kpi("SPF", a.spf && a.spf.result, a.spf && a.spf.domain ? `for ${a.spf.domain}` : "Is the sending server allowed?")}${
      kpi("DKIM", dk && dk.result, dk && dk.domain ? `signed by ${dk.domain}` : "Is the message signed?")}${
      kpi("DMARC", a.dmarc && a.dmarc.result, a.dmarc && a.dmarc.policy ? `domain policy p=${a.dmarc.policy}` : "Does the From address check out?")}${
      html`<div class="tk-kpi ${v.flags ? (v.level === "bad" ? "tk-kpi--alert" : "tk-kpi--watch") : "tk-kpi--calm"}"><span class="tk-kpi__lab">Red flags</span><span class="tk-kpi__val tk-num">${v.flags}</span><span class="tk-kpi__delta">${R.findings.filter((f) => f.sev === "high" || f.sev === "crit").length} serious</span></div>`}`;

    const sevCls = (s) => (s === "info" ? "tk-b-none" : `tk-b-${s}`);
    $("ph-findings").innerHTML = html`${R.findings.length ? R.findings.map((f) => html`
      <div class="ph-flag"><i class="${sevCls(f.sev)} tk-t-solid" aria-hidden="true"></i>
        <div class="ph-flag__main">
          <p class="ph-flag__title"><span class="tk-risk__title">${f.title}</span> <span class="tk-pill ${sevCls(f.sev)} tk-t-pill">${TKP.SEV_LABEL[f.sev]}</span></p>
          ${f.why ? html`<p class="ph-flag__why">${f.why}</p>` : ""}
          ${f.evidence ? html`<p><span class="tk-code">${f.evidence}</span></p>` : ""}
        </div></div>`)
      : html`<p class="tk-muted">No red flags were found in the headers.</p>`}`;

    $("ph-identity").innerHTML = html`${row("From", m.from, fromOrg)}${row("Reply-To", m.replyTo, fromOrg, "where your reply goes")}${
      row("Return-Path", m.returnPath, fromOrg, "where bounces go")}${m.sender ? row("Sender", m.sender, fromOrg) : ""}
      <tr><th scope="row">Signed by</th><td>${dk && dk.domain ? html`<span class="tk-code">${dk.domain}</span>` : html`<span class="tk-muted">No verified signature</span>`}</td>
        <td>${dk && dk.domain ? (TKP.orgDomain(dk.domain) === fromOrg ? html`<span class="tk-tag tk-tag--ok">Same domain as From</span>` : html`<span class="tk-tag tk-tag--over">Different domain</span>`) : ""}</td></tr>
      <tr><th scope="row">Subject</th><td colspan="2">${m.subject || "(none)"}</td></tr>
      <tr><th scope="row">Date</th><td colspan="2">${m.date || "(none)"}</td></tr>
      ${m.mailer ? html`<tr><th scope="row">Sent with</th><td colspan="2">${m.mailer}</td></tr>` : ""}`;

    const ext = R.external;
    $("ph-route-sub").textContent = R.hops.length
      ? `${R.hops.length} step${R.hops.length === 1 ? "" : "s"}${R.summary.transit !== null ? `, ${fmtDelay(R.summary.transit)} in transit` : ""}${ext ? `. First public address: ${ext.ip}` : ""}.`
      : "No Received headers, so the route can't be shown.";
    $("ph-route").innerHTML = html`${R.hops.map((x, i) => html`
      <li><span class="ph-step tk-num">${i + 1}</span><div>
        <p><b>${x.from || "unknown"}</b>${x.ip ? html` <span class="tk-code">${x.ip}</span>` : ""}${x.ip && TKP.privateIp(x.ip) ? html` <span class="tk-tag">internal</span>` : ""} <span class="tk-muted">to</span> ${x.by || "unknown"}</p>
        <p class="tk-muted">${fmtTime(x.time)}${x.delay !== null && i > 0 ? ` · after ${fmtDelay(x.delay)}` : ""}${x.with ? ` · ${x.with}` : ""}${x.tls ? " · encrypted" : ""}</p>
      </div></li>`)}`;

    $("ph-all-count").textContent = `${R.parse.headers.length} header${R.parse.headers.length === 1 ? "" : "s"}`;
    $("ph-all").innerHTML = html`${R.parse.headers.map((x) => html`<tr><th scope="row">${x.name}</th><td>${x.value.length > 600 ? x.value.slice(0, 600) + " …" : x.value}</td></tr>`)}`;
  }

  function run() {
    const org = $("ph-org").value.trim().slice(0, 120);
    db.set({ org });
    R = TKP.analyse($("ph-raw").value, { orgDomain: org });
    render();
    if (R && !R.empty) $("ph-verdict").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  $("ph-run").addEventListener("click", run);
  $("ph-clear").addEventListener("click", () => { $("ph-raw").value = ""; R = null; render(); $("ph-raw").focus(); });
  document.querySelectorAll("[data-sample]").forEach((b) => b.addEventListener("click", () => {
    const s = SAMPLES[b.dataset.sample];
    if (!s) return;
    $("ph-raw").value = s.text;
    if (!$("ph-org").value) $("ph-org").value = s.org;
    run();
  }));
  $("ph-raw").addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); });
  $("ph-copy").addEventListener("click", async () => {
    if (!R || R.empty) return;
    const ok = await TK.copy(TKP.report(R, new Date().toLocaleString("en-CA")));
    $("ph-copy-msg").textContent = ok ? "Summary copied. Paste it into your report to IT." : "Copy isn't available here; use Download instead.";
  });
  $("ph-download").addEventListener("click", () => {
    if (!R || R.empty) return;
    TK.download(`email-header-report-${TK.iso(new Date())}.txt`, TKP.report(R, new Date().toLocaleString("en-CA")), "text/plain;charset=utf-8");
  });
  render();
});

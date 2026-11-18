// Access Review & SoD Analyzer. Matches system access exports to the staff list, then finds people who
// have left but can still sign in, accounts nobody owns, unused and privileged access, and
// segregation-of-duties conflicts across systems. Files are read in the browser and kept in memory only;
// nothing is sent anywhere. Review decisions are saved in this browser so a review can be resumed.
"use strict";

// ---------------------------------------------------------------- engine (no page access)
const TKA = (() => {
  const LIMIT = { id: 40, name: 80, email: 120, text: 120, role: 80, roles: 200, comment: 200 };
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const clip = (s, n) => String(s ?? "").trim().slice(0, n);
  const letters = (s) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const colKey = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  // CSV text -> rows keyed by normalised header ("Last Login" -> last_login). Objects have no prototype,
  // so a header such as "constructor" is just a column.
  function table(text) {
    const rows = TK.parseCSV(String(text || ""));
    if (!rows.length) return { headers: [], rows: [] };
    const headers = rows[0].map(colKey);
    return {
      headers,
      rows: rows.slice(1).map((r) => {
        const o = Object.create(null);
        headers.forEach((h, i) => { if (h && !(h in o)) o[h] = String(r[i] ?? "").trim(); });
        return o;
      }),
    };
  }

  // Column names people actually use in exports, most specific first.
  const COLS = {
    p_id: ["employee_id", "emp_id", "employee_number", "employee_no", "staff_id", "person_id", "worker_id", "id"],
    p_name: ["name", "full_name", "display_name", "employee_name"],
    p_first: ["first_name", "given_name", "firstname"],
    p_last: ["last_name", "surname", "family_name", "lastname"],
    p_email: ["email", "work_email", "email_address", "mail", "upn", "user_principal_name"],
    p_status: ["status", "employment_status", "hr_status", "worker_status", "employee_status"],
    p_term: ["termination_date", "term_date", "end_date", "leave_date", "last_day", "separation_date", "exit_date"],
    p_dept: ["department", "dept", "team", "business_unit", "division"],
    p_title: ["job_title", "title", "position"],
    p_user: ["username", "user_name", "login", "user_id"],
    a_system: ["system", "application", "app", "platform", "source", "system_name"],
    a_account: ["account", "username", "user_name", "login", "account_name", "user_id", "samaccountname", "userid"],
    a_email: ["email", "mail", "upn", "user_principal_name", "email_address"],
    a_emp: ["employee_id", "emp_id", "employee_number", "employee_no", "staff_id"],
    a_role: ["role", "roles", "group", "groups", "entitlement", "entitlements", "permission", "permissions", "profile", "access"],
    a_enabled: ["enabled", "account_status", "status", "active", "state"],
    a_last: ["last_login", "last_logon", "last_sign_in", "last_signin", "last_used", "lastlogon", "last_activity", "last_access", "last_login_date"],
    a_type: ["account_type", "type", "user_type", "identity_type"],
    a_owner: ["owner", "owner_id", "owner_email", "owned_by", "responsible"],
    a_priv: ["privileged", "is_privileged"],
    m_system: ["system", "application", "app", "platform"],
    m_role: ["role", "group", "entitlement", "profile"],
    m_function: ["function", "functions", "duty", "duties", "activity", "task"],
    m_priv: ["privileged", "is_privileged", "admin", "high_risk"],
    r_id: ["rule_id", "id", "rule"],
    r_a: ["function_a", "duty_a", "activity_a", "function_1", "conflict_a"],
    r_b: ["function_b", "duty_b", "activity_b", "function_2", "conflict_b"],
    r_risk: ["risk", "severity", "rating", "risk_rating"],
    r_process: ["process", "business_process", "area", "cycle"],
    r_what: ["what_could_go_wrong", "risk_description", "description", "why"],
  };
  const pick = (row, names) => { for (const n of names) { const v = row[n]; if (v !== undefined && v !== "") return v; } return ""; };
  const has = (headers, names) => names.some((n) => headers.includes(n));

  // Dates are read as YYYY-MM-DD (time and zone ignored). Day-first or month-first text is ambiguous, so it
  // is reported rather than guessed.
  function parseDate(v) {
    const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])/.exec(String(v || "").trim());
    if (!m) return null;
    const mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 86400000);
  const addDays = (s, n) => { const d = new Date(utc(s) + n * 86400000); return d.toISOString().slice(0, 10); };

  const TERM = /^(terminated|termed|inactive|left|leaver|withdrawn|separated|resigned|retired|former|exited|dismissed|ex[-_ ]?employee)$/;
  const LEAVE = /^(leave|on[ _-]?leave|loa|leave of absence|parental leave|sabbatical|suspended)$/;
  const ON = /^(true|yes|y|1|enabled|enable|active|on|unlocked)$/;
  const OFF = /^(false|no|n|0|disabled|disable|inactive|locked|suspended|deactivated|off|expired|deleted|blocked)$/;
  const SERVICE_TYPE = /^(service|system|application|app|shared|generic|technical|non[-_ ]?human|machine|bot|robot|api)/;
  const SERVICE_NAME = /^(svc|service|app|sys|api|bot)[-_.]/i;
  const YES = /^(true|yes|y|1|x|privileged|admin)$/;
  const flag = (v) => { const s = norm(v); return ON.test(s) ? true : OFF.test(s) ? false : null; };
  const risk = (v) => { const s = norm(v); return /^crit/.test(s) ? "crit" : /^(med|mod)/.test(s) ? "med" : /^low/.test(s) ? "low" : "high"; };

  // Short handles a person may use as an account name: email local part, first initial + surname, first+last.
  function handlesOf(p) {
    const out = new Set();
    if (p.email) out.add(letters(p.email.split("@")[0]));
    if (p.user) out.add(letters(p.user.split("@")[0]));
    const parts = p.name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0], last = parts[parts.length - 1];
      out.add(letters(first.slice(0, 1) + last));
      out.add(letters(first + last));
    }
    out.delete("");
    return out;
  }
  // Admin or alternate accounts (jdoe-adm, adm.jdoe) belong to the same person as jdoe.
  function accountHandle(acct) {
    const s = norm(acct).split("@")[0].split("\\").pop()
      .replace(/[-_.](adm|admin|adm\d|da|priv|pa|su|a)$/, "").replace(/^(adm|admin|da|priv|pa|su|a)[-_.]/, "");
    return letters(s);
  }

  function readPeople(t) {
    if (!has(t.headers, COLS.p_id) && !has(t.headers, COLS.p_email)) return { error: "The staff list needs an employee_id or email column." };
    const list = [], byKey = new Map(), byId = new Map(), byEmail = new Map(), byHandle = new Map();
    let dup = 0, badDates = 0;
    t.rows.forEach((r) => {
      const id = clip(pick(r, COLS.p_id), LIMIT.id), email = norm(pick(r, COLS.p_email)).slice(0, LIMIT.email);
      if (!id && !email) return;
      const key = id ? "id:" + norm(id) : "em:" + email;
      if (byKey.has(key)) { dup++; return; }
      const name = clip(pick(r, COLS.p_name), LIMIT.name) || clip(`${pick(r, COLS.p_first)} ${pick(r, COLS.p_last)}`, LIMIT.name);
      const termRaw = pick(r, COLS.p_term), term = parseDate(termRaw);
      if (termRaw && !term) badDates++;
      const p = {
        key, id, email, name: name || email || id, user: clip(pick(r, COLS.p_user), LIMIT.text),
        dept: clip(pick(r, COLS.p_dept), LIMIT.text), title: clip(pick(r, COLS.p_title), LIMIT.text),
        statusRaw: norm(pick(r, COLS.p_status)), term,
      };
      list.push(p); byKey.set(key, p);
      if (id) byId.set(norm(id), p);
      if (email) byEmail.set(email, p);
      handlesOf(p).forEach((h) => { if (!byHandle.has(h)) byHandle.set(h, []); byHandle.get(h).push(p); });
    });
    return { list, byKey, byId, byEmail, byHandle, dup, badDates };
  }

  // One or more system exports -> one entry per account, with every role it holds.
  function readAccess(files) {
    const map = new Map();
    let skipped = 0, badDates = 0, unknownEnabled = 0;
    for (const f of files) {
      const t = f.table;
      if (!has(t.headers, COLS.a_account) && !has(t.headers, COLS.a_email)) return { error: `${f.name} needs an account or email column.` };
      if (!has(t.headers, COLS.a_system) && !f.system) return { error: `${f.name} needs a system column.` };
      t.rows.forEach((r) => {
        const system = clip(pick(r, COLS.a_system) || f.system, 60), account = clip(pick(r, COLS.a_account) || pick(r, COLS.a_email), LIMIT.email);
        if (!system || !account) { skipped++; return; }
        const key = norm(system) + "|" + norm(account);
        let a = map.get(key);
        if (!a) {
          a = { key, system, account, email: "", emp: "", roles: new Set(), enabled: null, last: null, lastBad: false, type: "", owner: "", priv: false };
          map.set(key, a);
        }
        a.email = a.email || norm(pick(r, COLS.a_email)).slice(0, LIMIT.email);
        a.emp = a.emp || clip(pick(r, COLS.a_emp), LIMIT.id);
        a.type = a.type || norm(pick(r, COLS.a_type)).slice(0, 40);
        a.owner = a.owner || clip(pick(r, COLS.a_owner), LIMIT.email);
        a.priv = a.priv || YES.test(norm(pick(r, COLS.a_priv)));
        String(pick(r, COLS.a_role)).split(/[;|]/).map((s) => clip(s, LIMIT.role)).filter(Boolean)
          .forEach((x) => { if (a.roles.size < LIMIT.roles) a.roles.add(x); });
        const en = flag(pick(r, COLS.a_enabled));
        if (en !== null) a.enabled = a.enabled === true ? true : en;   // enabled anywhere means enabled
        const lv = pick(r, COLS.a_last);
        if (lv) { const d = parseDate(lv); if (d) { if (!a.last || d > a.last) a.last = d; } else a.lastBad = true; }
      });
    }
    const list = [...map.values()];
    list.forEach((a) => { if (a.enabled === null) { a.enabled = true; unknownEnabled++; } if (a.lastBad && !a.last) badDates++; });
    return { list, skipped, badDates, unknownEnabled };
  }

  function readRoleMap(t) {
    if (!has(t.headers, COLS.m_role)) return { error: "The role map needs a role column." };
    if (!has(t.headers, COLS.m_function)) return { error: "The role map needs a function column." };
    const map = new Map();
    t.rows.forEach((r) => {
      const role = clip(pick(r, COLS.m_role), LIMIT.role);
      if (!role) return;
      const key = (norm(pick(r, COLS.m_system)) || "*") + "|" + norm(role);
      if (!map.has(key)) map.set(key, { functions: new Map(), privileged: false });
      const e = map.get(key);
      String(pick(r, COLS.m_function)).split(/[;|]/).map((s) => clip(s, LIMIT.text)).filter(Boolean).forEach((fn) => e.functions.set(norm(fn), fn));
      e.privileged = e.privileged || YES.test(norm(pick(r, COLS.m_priv)));
    });
    return { map, size: map.size };
  }

  function readRules(t) {
    if (!has(t.headers, COLS.r_a) || !has(t.headers, COLS.r_b)) return { error: "Rules need function_a and function_b columns." };
    const list = [], seen = new Set();
    t.rows.forEach((r, i) => {
      const a = clip(pick(r, COLS.r_a), LIMIT.text), b = clip(pick(r, COLS.r_b), LIMIT.text);
      if (!a || !b || norm(a) === norm(b)) return;
      let id = clip(pick(r, COLS.r_id), LIMIT.id) || "R-" + (i + 1);
      while (seen.has(norm(id))) id += "b";
      seen.add(norm(id));
      list.push({ id, a, b, aKey: norm(a), bKey: norm(b), risk: risk(pick(r, COLS.r_risk)),
        process: clip(pick(r, COLS.r_process), 60), what: clip(pick(r, COLS.r_what), 200) });
    });
    return { list };
  }

  const SEV = { crit: 4, high: 3, med: 2, low: 1, ok: 0 };
  const SEV_LABEL = { crit: "Critical", high: "High", med: "Medium", low: "Low", ok: "No issues" };
  const CHECKS = {
    LEAVER: { label: "Left, still has access", sev: "crit", action: "Disable the account today and check what it was used for after the leaving date." },
    ORPHANED: { label: "No matching person", sev: "high", action: "Find out who uses it. If no one claims it, disable it." },
    OWNER_LEFT: { label: "Owner has left", sev: "high", action: "Assign a new owner and rotate the account's password or keys." },
    NO_OWNER: { label: "No owner", sev: "med", action: "Assign an owner who is accountable for the account." },
    DORMANT: { label: "Not used recently", sev: "med", action: "Remove it unless the person confirms they still need it." },
    NEVER_USED: { label: "Never used", sev: "med", action: "Remove it unless the person confirms they still need it." },
    ON_LEAVE: { label: "On leave", sev: "low", action: "Consider suspending access until they return." },
    PRIVILEGED: { label: "Privileged", sev: "low", action: "Confirm the person still needs administrator rights." },
    SOD: { label: "Segregation of duties", sev: "high", action: "Remove one of the two, or keep both with a compensating control such as an independent review." },
    OK: { label: "No issues", sev: "ok", action: "Confirm the access is still needed." },
  };
  const ORDER = ["LEAVER", "ORPHANED", "OWNER_LEFT", "NO_OWNER", "DORMANT", "NEVER_USED", "ON_LEAVE", "PRIVILEGED"];
  const ESCALATE = ["ORPHANED", "NO_OWNER", "DORMANT", "NEVER_USED", "ON_LEAVE"];   // with privileged access these become High
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

  // input: { people: table, access: [{ name, table, system? }], roleMap: table|null, rules: table|null }
  // opt:   { asOf: "YYYY-MM-DD", dormantDays }
  function analyse(input, opt) {
    const asOf = opt.asOf, dormant = opt.dormantDays;
    const P = readPeople(input.people);
    if (P.error) return { error: P.error };
    const A = readAccess(input.access);
    if (A.error) return { error: A.error };
    const M = input.roleMap ? readRoleMap(input.roleMap) : null;
    if (M && M.error) return { error: M.error };
    const R = input.rules ? readRules(input.rules) : { list: [] };
    if (R.error) return { error: R.error };

    let scheduled = 0;
    P.list.forEach((p) => {
      const left = p.term && p.term <= asOf, future = p.term && p.term > asOf;
      if (future) scheduled++;
      p.status = left || (TERM.test(p.statusRaw) && !future) ? "terminated" : LEAVE.test(p.statusRaw) ? "leave" : "active";
    });
    const findPerson = (v) => {
      const s = norm(v);
      if (!s) return null;
      return P.byId.get(s) || P.byEmail.get(s) || ((P.byHandle.get(accountHandle(s)) || []).length === 1 ? P.byHandle.get(accountHandle(s))[0] : null);
    };
    const unmapped = new Map();
    let nameMatches = 0, ambiguous = 0, disabled = 0;
    const findings = [], clean = [], systems = new Set();

    for (const a of A.list) {
      systems.add(a.system);
      // who is this account?
      a.service = SERVICE_TYPE.test(a.type) || SERVICE_NAME.test(a.account);
      a.person = null; a.match = "";
      if (!a.service) {
        if (a.emp && P.byId.get(norm(a.emp))) { a.person = P.byId.get(norm(a.emp)); a.match = "employee ID"; }
        else if (a.email && P.byEmail.get(a.email)) { a.person = P.byEmail.get(a.email); a.match = "email"; }
        else if (a.account.includes("@") && P.byEmail.get(norm(a.account))) { a.person = P.byEmail.get(norm(a.account)); a.match = "email"; }
        else {
          const c = P.byHandle.get(accountHandle(a.account)) || [];
          if (c.length === 1) { a.person = c[0]; a.match = "account name"; }
          else if (c.length > 1) { a.match = "ambiguous"; }
        }
      }
      // what can it do?
      a.functions = new Map();
      a.privileged = a.priv;
      for (const role of a.roles) {
        const e = M ? M.map.get(norm(a.system) + "|" + norm(role)) || M.map.get("*|" + norm(role)) : null;
        if (!e) { if (M && a.enabled) { const k = a.system + " · " + role; unmapped.set(k, (unmapped.get(k) || 0) + 1); } continue; }
        if (e.privileged) a.privileged = true;
        e.functions.forEach((label, fk) => { if (!a.functions.has(fk)) a.functions.set(fk, { label, roles: [] }); a.functions.get(fk).roles.push(role); });
      }
      if (!a.enabled) { disabled++; continue; }
      if (a.match === "account name") nameMatches++;
      if (a.match === "ambiguous") ambiguous++;

      const issues = [], notes = [];
      const p = a.person;
      if (a.service) {
        const owner = a.owner ? findPerson(a.owner) : null;
        a.ownerPerson = owner;
        if (!a.owner) issues.push("NO_OWNER");
        else if (!owner) { issues.push("NO_OWNER"); notes.push(`Owner "${a.owner}" is not on the staff list`); }
        else if (owner.status === "terminated") issues.push("OWNER_LEFT");
      } else if (!p) issues.push("ORPHANED");
      else if (p.status === "terminated") {
        issues.push("LEAVER");
        if (p.term && a.last && a.last > p.term) notes.push(`Signed in ${plural(daysBetween(p.term, a.last), "day")} after leaving`);
      } else if (p.status === "leave") issues.push("ON_LEAVE");
      if (!a.service) {
        if (!a.last && !a.lastBad) issues.push("NEVER_USED");
        else if (a.last && daysBetween(a.last, asOf) > dormant) { issues.push("DORMANT"); a.idle = daysBetween(a.last, asOf); }
      }
      if (a.privileged) issues.push("PRIVILEGED");

      const ordered = ORDER.filter((c) => issues.includes(c));
      const who = p ? p.name : a.account;
      const base = { kind: "account", key: "acct|" + a.key, system: a.system, systems: [a.system], account: a.account, person: p, a };
      if (!ordered.length) { clean.push({ ...base, check: "OK", checks: [], sev: "ok", title: `${who}: ${a.system} access`, tags: [] }); continue; }
      let sev = ordered.reduce((s, c) => (SEV[CHECKS[c].sev] > SEV[s] ? CHECKS[c].sev : s), "low");
      if (a.privileged && ordered.some((c) => ESCALATE.includes(c)) && SEV[sev] < SEV.high) sev = "high";
      const primary = ordered[0];
      const title = {
        LEAVER: () => `${who} left${p.term ? " on " + p.term : ""} but can still sign in to ${a.system}`,
        ORPHANED: () => `${a.account} in ${a.system} doesn't belong to anyone on the staff list`,
        OWNER_LEFT: () => `Service account ${a.account} in ${a.system} is owned by ${a.ownerPerson.name}, who has left`,
        NO_OWNER: () => `Service account ${a.account} in ${a.system} has no owner`,
        DORMANT: () => `${who}'s ${a.system} account hasn't been used for ${a.idle} days`,
        NEVER_USED: () => `${who}'s ${a.system} account has never been used`,
        ON_LEAVE: () => `${who} is on leave with active ${a.system} access`,
        PRIVILEGED: () => `Confirm ${who}'s administrator access to ${a.system}`,
      }[primary]();
      const tags = ordered.slice(1).map((c) => (c === "DORMANT" ? `Not used for ${a.idle} days` : CHECKS[c].label)).concat(notes);
      findings.push({ ...base, check: primary, checks: ordered, sev, title, tags, action: CHECKS[primary].action });
    }

    // Segregation of duties is checked per person across every system, then per unmatched account.
    const holders = new Map();
    for (const a of A.list) {
      if (!a.enabled || !a.functions.size) continue;
      const hk = a.person ? a.person.key : "acct:" + a.key;
      if (!holders.has(hk)) holders.set(hk, { person: a.person, label: a.person ? a.person.name : `${a.account} (${a.system})`, fns: new Map() });
      const h = holders.get(hk);
      a.functions.forEach((f, fk) => {
        if (!h.fns.has(fk)) h.fns.set(fk, { label: f.label, via: [] });
        f.roles.forEach((role) => h.fns.get(fk).via.push({ system: a.system, account: a.account, role }));
      });
    }
    const ruleUse = new Map(R.list.map((r) => [r.id, 0]));
    holders.forEach((h, hk) => {
      for (const r of R.list) {
        const fa = h.fns.get(r.aKey), fb = h.fns.get(r.bKey);
        if (!fa || !fb) continue;
        ruleUse.set(r.id, ruleUse.get(r.id) + 1);
        const sameRole = fa.via.some((x) => fb.via.some((y) => x.system === y.system && x.role === y.role));
        const sys = [...new Set(fa.via.concat(fb.via).map((v) => v.system))];
        findings.push({
          kind: "sod", key: `sod|${r.id}|${hk}`, check: "SOD", checks: ["SOD"], sev: r.risk, rule: r, person: h.person,
          system: sys.join(", "), systems: sys, account: [...new Set(fa.via.concat(fb.via).map((v) => v.account))].join(", "),
          title: `${h.label} can both ${lc(r.a)} and ${lc(r.b)}`, viaA: fa.via, viaB: fb.via, sameRole,
          tags: [r.id].concat(sys.length > 1 ? ["Across systems"] : [], sameRole ? ["One role grants both"] : []),
          action: CHECKS.SOD.action + (sameRole ? " Because one role grants both, fix the role itself." : ""),
        });
      }
    });
    const rank = (f) => ORDER.indexOf(f.check) < 0 ? 99 : ORDER.indexOf(f.check);
    findings.sort((x, y) => SEV[y.sev] - SEV[x.sev] || rank(x) - rank(y) || x.title.localeCompare(y.title));
    clean.sort((x, y) => x.system.localeCompare(y.system) || x.title.localeCompare(y.title));

    const notes = [];
    if (unmapped.size) notes.push(`${plural(unmapped.size, "role")} ${unmapped.size === 1 ? "isn't" : "aren't"} in the role map, so segregation of duties and privileged access can't be checked for ${unmapped.size === 1 ? "it" : "them"}: ${[...unmapped.keys()].slice(0, 8).join("; ")}${unmapped.size > 8 ? "; and more" : ""}.`);
    if (!M) notes.push("Add a role map to check segregation of duties and privileged access.");
    if (M && !R.list.length) notes.push("No segregation-of-duties rules are loaded.");
    if (nameMatches) notes.push(`${plural(nameMatches, "account was", "accounts were")} matched to a person by account name only. Check those matches before relying on them.`);
    if (ambiguous) notes.push(`${plural(ambiguous, "account matches", "accounts match")} more than one person by name, so ${ambiguous === 1 ? "it was" : "they were"} treated as unmatched. Add employee_id or email to the export.`);
    if (scheduled) notes.push(`${plural(scheduled, "person has a leaving date", "people have leaving dates")} after the review date; their access is treated as active.`);
    if (P.dup) notes.push(`${plural(P.dup, "duplicate staff record was", "duplicate staff records were")} ignored.`);
    if (P.badDates || A.badDates) notes.push(`${plural(P.badDates + A.badDates, "date")} couldn't be read. Use YYYY-MM-DD.`);
    if (A.unknownEnabled) notes.push(`${plural(A.unknownEnabled, "account has", "accounts have")} no enabled or status value and ${A.unknownEnabled === 1 ? "was" : "were"} treated as enabled.`);
    if (A.skipped) notes.push(`${plural(A.skipped, "access row")} without a system or account ${A.skipped === 1 ? "was" : "were"} skipped.`);

    return {
      findings, clean, accounts: A.list, people: P.list, systems: [...systems].sort(), rules: R.list, ruleUse, notes,
      stats: { accounts: A.list.length, enabled: A.list.length - disabled, disabled, people: P.list.length, roleMap: M ? M.size : 0 },
    };
  }

  // Sample files, built as CSV text relative to the review date so they import exactly like real files.
  function sampleFiles(asOf) {
    const S = TK_ACCESS_DATA.sample, ago = (n) => (n === null || n === undefined ? "" : addDays(asOf, -n));
    const people = new Map(S.people.map((p) => [p[0], p]));
    const email = (id) => { const n = people.get(id)[1].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").split(" "); return `${n[0]}.${n[n.length - 1]}@${S.domain}`; };
    const flast = (id) => { const n = people.get(id)[1].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").split(" "); return n[0][0] + n[n.length - 1]; };
    const files = {
      people: { name: "staff-list.csv", text: TK.toCSV([["employee_id", "name", "email", "department", "job_title", "status", "termination_date"]]
        .concat(S.people.map(([id, name, dept, title, status, left]) => [id, name, email(id), dept, title, status, left === null ? "" : ago(left)]))) },
      access: [],
      roleMap: { name: "role-map.csv", text: TK.toCSV([["system", "role", "function", "privileged"]].concat(S.roleMap.map((r) => [r[0], r[1], r[2], r[3] ? "yes" : "no"]))) },
      rules: { name: "sod-rules-starter.csv", text: starterRulesCSV() },
    };
    for (const [system, style, file] of S.systems) {
      const rows = S.access.filter((r) => r[0] === system).map(([, id, acct, roles, on, last, type, owner, mail]) => {
        let account = acct, em = mail || "", emp = "";
        if (id) {
          if (style === "sso") { account = flast(id); em = email(id); }
          else if (style === "erp") { account = flast(id).toUpperCase(); emp = id; }
          else if (style === "los") account = email(id);
          else if (style === "core") { account = "U" + id.slice(1); emp = id; }
          else account = flast(id);
        }
        return [system, account, em, emp, roles, on ? "Enabled" : "Disabled", ago(last), type || "User", owner || ""];
      });
      files.access.push({ name: file, text: TK.toCSV([["system", "account", "email", "employee_id", "roles", "status", "last_login", "account_type", "owner"]].concat(rows)) });
    }
    return files;
  }
  const starterRulesCSV = () => TK.toCSV([["rule_id", "function_a", "function_b", "risk", "process", "what_could_go_wrong"]].concat(TK_ACCESS_DATA.starterRules));

  return { table, analyse, sampleFiles, starterRulesCSV, parseDate, addDays, daysBetween, accountHandle, CHECKS, SEV, SEV_LABEL, COLS, LIMIT };
})();

// ---------------------------------------------------------------- page
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tk-access")) return;
  const { esc, $, dims } = TK, { CHECKS, SEV, SEV_LABEL } = TKA;
  const html = TK.html;
  const TODAY = TK.iso(new Date());
  const DECISIONS = { remove: "Remove access", keep: "Keep", mitigate: "Keep with mitigation", investigate: "Investigate" };
  const MAX_DECISIONS = 20000;

  // Files live in memory only. Settings and decisions are saved on this device.
  const db = TK.store("mshshuvo:toolkit:access-review:v1");
  const saved = db.get() || {};
  const settings = Object.assign({ org: "", reviewer: "", asOf: "", dormant: 90 }, saved.settings || {});
  let decisions = saved.decisions && typeof saved.decisions === "object" ? saved.decisions : {};
  const files = { people: null, access: [], roleMap: null, rules: null, sample: false };
  const st = { scope: "needs", check: "", sys: "", sev: "", q: "", open: null, limit: 60 };
  let R = null;
  const save = () => db.set({ settings, decisions });
  const asOf = () => settings.asOf || TODAY;
  const fp = (f) => TK.sha256(f.text);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

  function setFile(slot, name, text) {
    const f = { name: String(name).slice(0, 120), text, table: TKA.table(text) };
    if (slot === "access") files.access.push(f); else files[slot] = f;
    return f;
  }
  function loadSample() {
    const s = TKA.sampleFiles(asOf());
    files.people = null; files.access = []; files.roleMap = null; files.rules = null;
    setFile("people", s.people.name, s.people.text);
    s.access.forEach((f) => setFile("access", f.name, f.text));
    setFile("roleMap", s.roleMap.name, s.roleMap.text);
    setFile("rules", s.rules.name, s.rules.text);
    files.rules.starter = true; files.sample = true;
  }

  function analyse() {
    R = null;
    if (!files.people || !files.access.length) return;
    const out = TKA.analyse({ people: files.people.table, access: files.access, roleMap: files.roleMap && files.roleMap.table, rules: files.rules && files.rules.table },
      { asOf: asOf(), dormantDays: settings.dormant });
    if (out.error) { $("ar-msg").textContent = out.error; return; }
    R = out;
  }
  const decided = (f) => decisions[f.key] && DECISIONS[decisions[f.key].d];
  const sevClass = (s) => (s === "ok" ? "tk-b-none" : `tk-b-${s}`);
  const pill = (s) => html`<span class="tk-pill ${sevClass(s)} tk-t-pill">${SEV_LABEL[s]}</span>`;

  // ---- overview
  function renderTop() {
    const org = settings.org || (files.sample ? TK_ACCESS_DATA.sample.org : "Your organisation");
    $("ar-meta").innerHTML = html`<b>${org}</b> · review as of ${TK.fmtDate(asOf())}${files.sample ? " · sample data" : ""}`;
    if (!R) {
      $("ar-headline").textContent = files.people || files.access.length ? "Load both a staff list and at least one access export to start the review." : "Load your files in Your data, or try the sample.";
      $("ar-headfoot").textContent = "";
      return;
    }
    const F = R.findings, leaverPeople = new Set(F.filter((f) => f.check === "LEAVER").map((f) => f.person.key)).size;
    const sodPeople = new Set(F.filter((f) => f.kind === "sod").map((f) => (f.person ? f.person.key : f.key))).size;
    const parts = [];
    if (leaverPeople) parts.push(`${plural(leaverPeople, "person who has", "people who have")} left can still sign in`);
    if (sodPeople) parts.push(`${plural(sodPeople, "person holds", "people hold")} access that breaks segregation of duties`);
    const lead = F.length ? `${plural(F.length, "item needs", "items need")} a decision across ${plural(R.systems.length, "system")}.` : `No issues found in ${plural(R.stats.enabled, "active account")}.`;
    $("ar-headline").textContent = lead + (parts.length ? " " + parts.join(", and ").replace(/^./, (c) => c.toUpperCase()) + "." : "");
    const done = F.filter(decided).length;
    $("ar-headfoot").textContent = `Checked ${plural(R.stats.enabled, "active account")} for ${plural(R.stats.people, "person", "people")}. ` +
      `${done} of ${F.length} decided${settings.reviewer ? " by " + settings.reviewer : ""}. Unused means no sign-in for ${settings.dormant} days.`;
  }

  const GROUPS = {
    leaver: { checks: ["LEAVER"], label: "Left, still has access" },
    owner: { checks: ["ORPHANED", "NO_OWNER", "OWNER_LEFT"], label: "Accounts nobody owns" },
    sod: { checks: ["SOD"], label: "Segregation of duties conflicts" },
    unused: { checks: ["DORMANT", "NEVER_USED"], label: "Unused accounts" },
  };
  function renderOverview() {
    if (!R) { ["ar-kpis", "ar-bysys", "ar-byrule", "ar-urgent", "ar-notes", "ar-progress-tags"].forEach((id) => { $(id).innerHTML = html``; }); $("ar-progress-n").textContent = ""; return; }
    const F = R.findings;
    const inGroup = (g) => F.filter((f) => f.checks.some((c) => GROUPS[g].checks.includes(c)));
    const tile = (g, cls, sub) => {
      const n = inGroup(g).length;
      return html`<button type="button" class="tk-kpi tk-kpi--${n ? cls : "calm"}" data-group="${g}"><span class="tk-kpi__lab">${GROUPS[g].label}</span>
        <span class="tk-kpi__val tk-num">${n}</span><span class="tk-kpi__delta">${n ? sub(inGroup(g)) : "None found"}</span></button>`;
    };
    const people = (list) => plural(new Set(list.map((f) => (f.person ? f.person.key : f.key))).size, "person", "people");
    $("ar-kpis").innerHTML = html`${tile("leaver", "alert", (l) => `${plural(l.length, "account")}, ${people(l)}`)}${tile("owner", "alert", (l) => plural(new Set(l.map((f) => f.system)).size, "system"))}${
      tile("sod", "alert", people)}${tile("unused", "watch", (l) => `No sign-in for ${settings.dormant}+ days`)}`;

    const bySys = R.systems.map((s) => { const c = { crit: 0, high: 0, med: 0, low: 0 }; F.forEach((f) => { if (f.systems.includes(s)) c[f.sev]++; }); return [s, c]; });
    const max = Math.max(1, ...bySys.map(([, c]) => c.crit + c.high + c.med + c.low));
    $("ar-bysys").innerHTML = html`${TK.join(bySys.map(([s, c]) => {
      const total = c.crit + c.high + c.med + c.low;
      const seg = (k) => (c[k] ? html`<i class="tk-b-${k} tk-t-solid" data-w="${(c[k] / max) * 100}"></i>` : "");
      return html`<div class="tk-bar" data-tip="${s}: ${c.crit} critical, ${c.high} high, ${c.med} medium, ${c.low} low"><button type="button" class="tk-link" data-sysgo="${s}">${s}</button>
        <span class="tk-bar__track">${seg("crit")}${seg("high")}${seg("med")}${seg("low")}</span><span class="tk-num tk-muted">${total}</span></div>`;
    })) || html`<p class="tk-muted">No systems loaded.</p>`}`;

    const F_ = F.length, done = F.filter(decided);
    const pct = F_ ? Math.round((done.length / F_) * 100) : 100;
    $("ar-progress-n").textContent = F_ ? `${pct}%` : "Nothing to decide";
    $("ar-progress-bar").setAttribute("aria-label", `${done.length} of ${F_} findings decided`);
    $("ar-progress-fill").dataset.w = String(pct);
    const counts = Object.keys(DECISIONS).map((d) => [d, done.filter((f) => decisions[f.key].d === d).length]);
    $("ar-progress-tags").innerHTML = html`<span class="tk-tag">${done.length} of ${F_} decided</span>${TK.join(counts.filter(([, n]) => n).map(([d, n]) =>
      html`<span class="tk-tag ${d === "remove" ? "tk-tag--over" : ""}">${DECISIONS[d]}: ${n}</span>`))}${F_ - done.length ? html`<span class="tk-tag">Open: ${F_ - done.length}</span>` : ""}`;

    const used = R.rules.filter((r) => R.ruleUse.get(r.id)).sort((a, b) => R.ruleUse.get(b.id) - R.ruleUse.get(a.id) || a.id.localeCompare(b.id));
    const rmax = Math.max(1, ...used.map((r) => R.ruleUse.get(r.id)));
    $("ar-byrule").innerHTML = html`${TK.join(used.map((r) => html`<div class="tk-bar" data-tip="${r.what || r.a + " and " + r.b}">
      <span><b class="tk-num">${r.id}</b> ${r.a} × ${r.b}</span><span class="tk-bar__track"><i class="${r.risk === "med" || r.risk === "low" ? "tk-b-med" : "tk-b-high"} tk-t-solid" data-w="${(R.ruleUse.get(r.id) / rmax) * 100}"></i></span>
      <span class="tk-num tk-muted">${R.ruleUse.get(r.id)}</span></div>`)) || html`<p class="tk-muted">${R.rules.length ? "No conflicts found." : "No rules loaded."}</p>`}`;

    const urgent = F.filter((f) => !decided(f)).slice(0, 6);
    $("ar-urgent").innerHTML = html`${TK.join(urgent.map((f) => html`<button type="button" class="tk-urgent" data-goto="${f.key}">
      <span class="${sevClass(f.sev)} tk-t-solid"></span><span class="tk-urgent__main"><span class="tk-risk__title">${f.title}</span>
      <span class="tk-tags">${pill(f.sev)}<span>${CHECKS[f.check].label}</span><span>${f.system}</span></span></span></button>`)) || html`<p class="tk-muted">${F.length ? "Every finding has a decision." : "Nothing needs a decision."}</p>`}`;

    $("ar-notes-card").hidden = !R.notes.length;
    $("ar-notes").innerHTML = html`${TK.join(R.notes.map((n) => html`<p class="tk-issue"><span class="tk-pill tk-b-med tk-t-pill">Check</span><span>${n}</span></p>`))}`;
    dims($("view-overview"));
  }

  // ---- review list
  function rows() {
    if (!R) return [];
    let list = st.scope === "all" ? R.findings.concat(R.clean) : R.findings;
    if (st.scope === "open") list = list.filter((f) => !decided(f));
    if (st.scope === "decided") list = list.filter(decided);
    if (st.check) list = list.filter((f) => (GROUPS[st.check] ? f.checks.some((c) => GROUPS[st.check].checks.includes(c)) : f.checks.includes(st.check) || (st.check === "OK" && f.check === "OK")));
    if (st.sys) list = list.filter((f) => f.systems.includes(st.sys));
    if (st.sev) list = list.filter((f) => f.sev === st.sev);
    const q = st.q.trim().toLowerCase();
    if (q) list = list.filter((f) => [f.title, f.account, f.system, f.person && f.person.name, f.person && f.person.id, f.a && [...f.a.roles].join(" ")].join(" ").toLowerCase().includes(q));
    return list;
  }
  const viaList = (via) => TK.join(via.map((v) => html`<li>${v.system}: <span class="tk-num">${v.account}</span> as ${v.role}</li>`));
  function detail(f) {
    const d = decisions[f.key];
    const who = f.person;
    let body;
    if (f.kind === "sod") {
      body = html`<div><dt>What could go wrong</dt><dd>${f.rule.what || "One person can complete both steps alone."}</dd>
          <dt>Process</dt><dd>${f.rule.process || "Not stated"} · rule ${f.rule.id} · ${SEV_LABEL[f.rule.risk]} risk</dd></div>
        <div><dt>Can ${f.rule.a.toLowerCase()} through</dt><dd><ul class="tk-ul">${viaList(f.viaA)}</ul></dd>
          <dt>Can ${f.rule.b.toLowerCase()} through</dt><dd><ul class="tk-ul">${viaList(f.viaB)}</ul></dd></div>`;
    } else {
      const a = f.a;
      body = html`<div><dt>Account</dt><dd><span class="tk-num">${a.account}</span> in ${a.system}<br>Roles: ${[...a.roles].join(", ") || "none listed"}<br>
          ${a.service ? "Service account" : "User account"} · last sign-in ${a.last ? TK.fmtDate(a.last) : "never"}${a.privileged ? " · privileged" : ""}</dd></div>
        <div><dt>${a.service ? "Owner" : "Person"}</dt><dd>${a.service
          ? (a.ownerPerson ? html`${a.ownerPerson.name} (${a.ownerPerson.id || a.ownerPerson.email})${a.ownerPerson.status === "terminated" ? html`<br><b>Has left</b>` : ""}` : a.owner || "None recorded")
          : (who ? html`${who.name}${who.id ? html` · <span class="tk-num">${who.id}</span>` : ""}<br>${[who.title, who.dept].filter(Boolean).join(", ")}<br>
            ${who.status === "terminated" ? html`<b>Left${who.term ? " on " + TK.fmtDate(who.term) : ""}</b>` : who.status === "leave" ? "On leave" : "Active"} · matched by ${a.match}` : "Not on the staff list")}</dd></div>`;
    }
    return html`<dl class="tk-detail">${body}
      <div><dt>Suggested action</dt><dd>${f.action || CHECKS.OK.action}</dd>
        <dt>Comment</dt><dd><input class="tk-input tk-comment" id="ar-c-${f.key}" data-comment="${f.key}" maxlength="200" value="${d ? d.c || "" : ""}" aria-label="Comment" placeholder="Why, or the ticket number"></dd>
        ${d && d.d ? html`<dd class="tk-muted">${DECISIONS[d.d]}${d.by ? " by " + d.by : ""}${d.at ? " on " + TK.fmtDate(d.at) : ""}</dd>` : ""}</div></dl>`;
  }
  function decisionSelect(f) {
    const d = decisions[f.key] ? decisions[f.key].d : "";
    const opts = Object.entries(DECISIONS).filter(([k]) => k !== "mitigate" || f.kind === "sod" || f.checks.includes("PRIVILEGED"));
    return html`<select id="ar-d-${f.key}" data-decide="${f.key}" aria-label="Decision for ${f.title}">
      <option value="">Decide…</option>${TK.join(opts.map(([k, label]) => html`<option value="${k}"${k === d ? " selected" : ""}>${label}</option>`))}</select>`;
  }
  function renderReview() {
    if (!R) { $("ar-list").innerHTML = html`<p class="tk-muted">Load a staff list and an access export to see findings.</p>`; $("ar-more").textContent = ""; return; }
    $("ar-check").innerHTML = html`<option value="">Every check</option>${TK.join(Object.entries(GROUPS).map(([k, g]) => html`<option value="${k}"${k === st.check ? " selected" : ""}>${g.label}</option>`))}${
      TK.join(["ON_LEAVE", "PRIVILEGED"].map((c) => html`<option value="${c}"${c === st.check ? " selected" : ""}>${CHECKS[c].label}</option>`))}`;
    $("ar-sys").innerHTML = html`<option value="">Every system</option>${TK.join(R.systems.map((s) => html`<option value="${s}"${s === st.sys ? " selected" : ""}>${s}</option>`))}`;
    const list = rows(), show = list.slice(0, st.limit);
    $("ar-list-title").textContent = `${plural(list.length, st.scope === "all" ? "item" : "finding")}`;
    $("ar-list").innerHTML = html`${TK.join(show.map((f) => {
      const open = st.open === f.key, d = decided(f) ? decisions[f.key].d : "";
      return html`<div class="tk-find${d ? " tk-find--done" : ""}" id="ar-f-${f.key}"><span class="${sevClass(f.sev)} tk-t-solid"></span>
        <button type="button" class="tk-find__main" data-open="${f.key}" aria-expanded="${open}">
          <span class="tk-risk__title">${f.title}</span>
          <span class="tk-tags">${pill(f.sev)}<span>${CHECKS[f.check].label}</span><span>${f.system}</span>${TK.join(f.tags.map((t) => html`<span class="tk-tag">${t}</span>`))}${
            d ? html`<span class="tk-tag ${d === "remove" ? "tk-tag--over" : "tk-tag--ok"}">${DECISIONS[d]}</span>` : ""}</span></button>
        <span class="tk-find__side tk-noprint">${decisionSelect(f)}</span>${open ? detail(f) : ""}</div>`;
    })) || html`<p class="tk-muted">Nothing matches these filters.</p>`}`;
    $("ar-more").innerHTML = html`${list.length > show.length ? html`Showing ${show.length} of ${list.length}. <button type="button" class="tk-link" id="ar-showmore">Show more</button>` : ""}`;
    const cleanOpen = R.clean.filter((f) => !decided(f)).length;
    $("ar-keepclean").hidden = !cleanOpen;
    $("ar-keepclean").textContent = `Keep every account with no issues (${cleanOpen})`;
  }

  // ---- data tab
  const fileLine = (f, extra) => html`<b>${f.name}</b> · ${extra} · fingerprint <span class="tk-num">${fp(f).slice(0, 12)}…</span>`;
  function renderData() {
    $("ar-org").value = settings.org; $("ar-reviewer").value = settings.reviewer; $("ar-asof").value = asOf(); $("ar-dormant").value = String(settings.dormant);
    $("ar-st-people").innerHTML = html`${files.people ? fileLine(files.people, plural(files.people.table.rows.length, "row")) : "Not loaded"}`;
    $("ar-st-access").innerHTML = html`${TK.join(files.access.map((f, i) => html`<p class="tk-issue">${fileLine(f, plural(f.table.rows.length, "row"))}
      <button type="button" class="tk-link" data-rmaccess="${i}" aria-label="Remove ${f.name}">Remove</button></p>`)) || html`<p class="tk-msg">Not loaded</p>`}`;
    $("ar-st-map").innerHTML = html`${files.roleMap ? fileLine(files.roleMap, plural(files.roleMap.table.rows.length, "row")) : "Not loaded. Without it, segregation of duties and privileged access can't be checked."}`;
    $("ar-st-rules").innerHTML = html`${files.rules ? (files.rules.starter ? `Starter rules (${TK_ACCESS_DATA.starterRules.length})` : fileLine(files.rules, plural(files.rules.table.rows.length, "rule"))) : "None"}`;
  }

  function render() { analyse(); renderTop(); renderOverview(); renderReview(); renderData(); }

  // ---- decisions
  function decide(key, d) {
    if (!d) { delete decisions[key]; save(); return; }
    if (!DECISIONS[d]) return;
    if (!decisions[key] && Object.keys(decisions).length >= MAX_DECISIONS) { $("ar-rmsg").textContent = "Too many saved decisions on this device. Clear old ones in Your data."; return; }
    decisions[key] = { d, c: decisions[key] ? decisions[key].c || "" : "", by: settings.reviewer.slice(0, 60), at: TODAY };
    save();
  }

  // ---- exports
  const personCols = (f) => (f.person ? [f.person.id, f.person.name, f.person.dept] : ["", "", ""]);
  function findingRow(f) {
    const d = decisions[f.key] || {};
    return [SEV_LABEL[f.sev], CHECKS[f.check].label, f.system, f.account, ...personCols(f), f.title, f.tags.join("; "),
      f.kind === "sod" ? `${f.rule.id}: ${f.rule.what}` : [...f.a.roles].join("; "), DECISIONS[d.d] || "Open", d.c || "", d.by || "", d.at || ""];
  }
  $("ar-dl-findings").addEventListener("click", () => {
    if (!R) return;
    TK.download("access-review-findings.csv", TK.toCSV([["severity", "check", "system", "account", "employee_id", "person", "department", "finding", "notes", "roles_or_rule", "decision", "comment", "decided_by", "decided_on"]]
      .concat(R.findings.map(findingRow), R.clean.filter(decided).map(findingRow))));
    $("ar-rmsg").textContent = "Findings downloaded, with every decision and comment.";
  });
  $("ar-dl-remove").addEventListener("click", () => {
    if (!R) return;
    const list = R.findings.concat(R.clean).filter((f) => decided(f) && decisions[f.key].d === "remove");
    if (!list.length) { $("ar-rmsg").textContent = "Nothing is marked Remove access yet."; return; }
    const out = [];
    list.forEach((f) => {
      const d = decisions[f.key];
      if (f.kind === "sod") f.viaA.concat(f.viaB).forEach((v) => out.push([v.system, v.account, v.role, f.person ? f.person.name : "", `${f.rule.id}: remove one side of the conflict`, d.c || "", d.by || "", d.at || ""]));
      else out.push([f.system, f.account, "all", f.person ? f.person.name : "", CHECKS[f.check].label, d.c || "", d.by || "", d.at || ""]);
    });
    TK.download("access-removal-list.csv", TK.toCSV([["system", "account", "role", "person", "reason", "comment", "decided_by", "decided_on"]].concat(out)));
    $("ar-rmsg").textContent = `Removal list downloaded: ${plural(out.length, "line")}, ready to send to each system owner.`;
  });
  $("ar-dl-evidence").addEventListener("click", () => {
    if (!R) return;
    const fileInfo = (f) => (f ? { file: f.name, rows: f.table.rows.length, sha256: fp(f) } : null);
    const bySev = {}, byCheck = {};
    R.findings.forEach((f) => { bySev[SEV_LABEL[f.sev]] = (bySev[SEV_LABEL[f.sev]] || 0) + 1; byCheck[CHECKS[f.check].label] = (byCheck[CHECKS[f.check].label] || 0) + 1; });
    const record = {
      tool: "access-review", tool_name: "Access Review & SoD Analyzer", source: "https://mshshuvo.com/toolkit/access-review", version: 1,
      organisation: settings.org || (files.sample ? TK_ACCESS_DATA.sample.org : ""), reviewer: settings.reviewer, review_date: asOf(),
      generated_on: TODAY, dormant_after_days: settings.dormant,
      inputs: { staff_list: fileInfo(files.people), access_exports: files.access.map(fileInfo), role_map: fileInfo(files.roleMap),
        sod_rules: files.rules && files.rules.starter ? { file: "starter rules", rows: TK_ACCESS_DATA.starterRules.length, sha256: fp(files.rules) } : fileInfo(files.rules) },
      summary: { systems: R.systems, people: R.stats.people, accounts: R.stats.accounts, active_accounts: R.stats.enabled, findings: R.findings.length,
        decided: R.findings.filter(decided).length, by_severity: bySev, by_check: byCheck },
      not_checked: R.notes,
      findings: R.findings.concat(R.clean.filter(decided)).map((f) => {
        const d = decisions[f.key] || {};
        return { key: f.key, severity: SEV_LABEL[f.sev], check: CHECKS[f.check].label, system: f.system, account: f.account,
          employee_id: f.person ? f.person.id : "", person: f.person ? f.person.name : "", finding: f.title, notes: f.tags,
          decision: DECISIONS[d.d] || "Open", comment: d.c || "", decided_by: d.by || "", decided_on: d.at || "" };
      }),
      decisions,
    };
    TK.download("access-review-evidence.json", JSON.stringify(record, null, 2), "application/json");
    $("ar-rmsg").textContent = "Evidence record downloaded. Load it in Your data to continue this review on another device.";
  });
  $("ar-print").addEventListener("click", () => { try { window.print(); } catch (e) { /* printing blocked in this viewer */ } });
  const TEMPLATE_NAMES = { people: "staff-list-template.csv", access: "access-export-template.csv", roleMap: "role-map-template.csv", rules: "sod-rules-starter.csv" };
  function template(kind) {
    const s = TKA.sampleFiles(asOf());
    if (kind === "rules") return TKA.starterRulesCSV();
    if (kind === "access") return s.access.map((f, i) => (i ? f.text.split("\r\n").slice(1).join("\r\n") : f.text)).join("");
    return s[kind].text;
  }

  // ---- loading files
  function onFile(id, slot) {
    $(id).addEventListener("change", (e) => TK.readFile(e.target, (text, name, err) => {
      if (err) { $("ar-msg").textContent = err; return; }
      if (files.sample) { files.people = null; files.access = []; files.roleMap = null; files.rules = null; files.sample = false; useStarter(); }
      const f = setFile(slot, name, text);
      if (!f.table.rows.length) { $("ar-msg").textContent = `${f.name} has no rows under its header.`; }
      else $("ar-msg").textContent = `Loaded ${f.name}.`;
      if (slot === "access" && files.access.length > 30) { files.access.pop(); $("ar-msg").textContent = "Up to 30 access exports can be loaded at once."; }
      render();
    }));
  }
  function useStarter() { setFile("rules", "starter rules", TKA.starterRulesCSV()); files.rules.starter = true; }
  onFile("ar-f-people", "people"); onFile("ar-f-access", "access"); onFile("ar-f-map", "roleMap"); onFile("ar-f-rules", "rules");
  $("ar-f-resume").addEventListener("change", (e) => TK.readFile(e.target, (text, name, err) => {
    if (err) { $("ar-msg").textContent = err; return; }
    let rec;
    try { rec = JSON.parse(text); } catch (x) { rec = null; }
    if (!rec || rec.tool !== "access-review" || !rec.decisions || typeof rec.decisions !== "object") { $("ar-msg").textContent = "That isn't an evidence record from this tool."; return; }
    const next = {};
    let n = 0;
    for (const [k, v] of Object.entries(rec.decisions)) {
      if (n >= MAX_DECISIONS) break;
      if (!v || typeof v !== "object" || !DECISIONS[v.d]) continue;
      next[String(k).slice(0, 300)] = { d: v.d, c: String(v.c || "").slice(0, 200), by: String(v.by || "").slice(0, 60), at: TKA.parseDate(v.at) || "" };
      n++;
    }
    decisions = Object.assign(decisions, next);
    if (typeof rec.organisation === "string" && !settings.org && !/sample data/.test(rec.organisation)) settings.org = rec.organisation.slice(0, 60);
    if (typeof rec.reviewer === "string" && !settings.reviewer) settings.reviewer = rec.reviewer.slice(0, 60);
    save(); render();
    $("ar-msg").textContent = `Restored ${plural(n, "decision")} from ${String(name).slice(0, 80)}. Load the same files to see them.`;
  }));
  $("ar-sample").addEventListener("click", () => { loadSample(); render(); $("ar-msg").textContent = "Sample data loaded."; });
  $("ar-clear").addEventListener("click", () => {
    files.people = null; files.access = []; files.roleMap = null; files.sample = false; useStarter(); st.open = null; render();
    $("ar-msg").textContent = "Files removed. Your saved decisions are kept.";
  });
  $("ar-forget").addEventListener("click", () => { decisions = {}; save(); render(); $("ar-msg").textContent = "Saved decisions cleared from this device."; });
  $("ar-starter").addEventListener("click", () => { useStarter(); render(); $("ar-msg").textContent = "Starter rules in use."; });

  // ---- settings
  $("ar-org").addEventListener("input", (e) => { settings.org = e.target.value.slice(0, 60); save(); renderTop(); });
  $("ar-reviewer").addEventListener("input", (e) => { settings.reviewer = e.target.value.slice(0, 60); save(); renderTop(); });
  $("ar-asof").addEventListener("change", (e) => {
    const d = TKA.parseDate(e.target.value);
    settings.asOf = d && d !== TODAY ? d : "";
    save();
    if (files.sample) loadSample();   // the sample's dates move with the review date
    render();
  });
  $("ar-dormant").addEventListener("change", (e) => { const n = Number(e.target.value); settings.dormant = [30, 60, 90, 180, 365].includes(n) ? n : 90; save(); render(); });

  // ---- review interactions
  const go = (key) => {
    st.scope = decided({ key }) ? "needs" : st.scope; st.check = ""; st.sys = ""; st.sev = ""; st.q = ""; st.open = key;
    const list = rows(); const i = list.findIndex((f) => f.key === key); st.limit = Math.max(60, i + 1);
    $("ar-scope").value = st.scope; $("ar-sev").value = ""; $("ar-q").value = "";
    location.hash = "#review"; renderReview();
    const el = document.getElementById("ar-f-" + key);
    if (el) el.scrollIntoView({ block: "center" });
  };
  $("tk-access").addEventListener("click", (e) => {
    const t = e.target.closest("[data-open],[data-goto],[data-group],[data-sysgo],[data-rmaccess],[data-template],#ar-showmore,#ar-keepclean");
    if (!t) return;
    if (t.dataset.open) { st.open = st.open === t.dataset.open ? null : t.dataset.open; renderReview(); return; }
    if (t.dataset.goto) { go(t.dataset.goto); return; }
    if (t.dataset.group || t.dataset.sysgo) {
      st.check = t.dataset.group || ""; st.sys = t.dataset.sysgo || ""; st.sev = ""; st.q = ""; st.scope = "needs"; st.open = null; st.limit = 60;
      $("ar-scope").value = "needs"; $("ar-sev").value = ""; $("ar-q").value = "";
      location.hash = "#review"; renderReview(); return;
    }
    if (t.dataset.rmaccess) { files.access.splice(Number(t.dataset.rmaccess), 1); render(); $("ar-msg").textContent = "Export removed."; return; }
    if (t.dataset.template) { TK.download(TEMPLATE_NAMES[t.dataset.template], template(t.dataset.template)); return; }
    if (t.id === "ar-showmore") { st.limit += 100; renderReview(); return; }
    if (t.id === "ar-keepclean") {
      const list = R ? R.clean.filter((f) => !decided(f)) : [];
      if (Object.keys(decisions).length + list.length > MAX_DECISIONS) { $("ar-rmsg").textContent = "Too many accounts to save on this device."; return; }
      list.forEach((f) => { decisions[f.key] = { d: "keep", c: "No issues found", by: settings.reviewer.slice(0, 60), at: TODAY }; });
      save(); renderTop(); renderOverview(); renderReview();
      $("ar-rmsg").textContent = `${plural(list.length, "account")} with no issues marked Keep.`;
    }
  });
  $("ar-list").addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.decide) { decide(t.dataset.decide, t.value); renderTop(); renderOverview(); renderReview(); }
  });
  $("ar-list").addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.comment) return;
    const k = t.dataset.comment;
    if (!decisions[k]) decisions[k] = { d: "", c: "", by: settings.reviewer.slice(0, 60), at: TODAY };
    decisions[k].c = t.value.slice(0, 200);
    if (!decisions[k].d && !decisions[k].c) delete decisions[k];
    save();
  });
  [["ar-scope", "scope"], ["ar-check", "check"], ["ar-sys", "sys"], ["ar-sev", "sev"]].forEach(([id, k]) =>
    $(id).addEventListener("change", (e) => { st[k] = e.target.value; st.limit = 60; renderReview(); }));
  $("ar-q").addEventListener("input", (e) => { st.q = e.target.value.slice(0, 80); st.limit = 60; renderReview(); });

  TK.tips(); TK.tabs(["overview", "review", "data"]);
  useStarter(); loadSample(); render();
});

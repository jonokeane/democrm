/* Jono CRM demo: sample data.
   Every business, person, email address and phone number below is made up. Phone numbers use the
   555-01xx range set aside for fiction, and email/web addresses use the reserved .example domain.
   Dates are built relative to the day the demo is opened, so it always looks current. */
window.JCRM_SEED = function (now) {
  "use strict";
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const fmtD = d => MON[d.getMonth()] + " " + d.getDate();
  const fmtDY = d => fmtD(d) + ", " + d.getFullYear();
  const r2 = n => Math.round(n * 100) / 100;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const T = iso(today);
  const D = n => iso(add(today, n));                       // n days from today
  const W0 = add(today, -((today.getDay() + 6) % 7));      // this week's Monday
  const wkDay = (k, dow) => add(W0, k * 7 + dow);          // week offset k, dow 0 = Monday
  const invNo = fri => pad(fri.getMonth() + 1) + pad(fri.getDate()) + String(fri.getFullYear()).slice(2);
  const at = s => new Date(s + "T15:00:00").toISOString();

  // Small fixed-seed random generator, so the sample data looks the same every time.
  let seed = 20261019;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  let n = 0; const id = p => p + (++n).toString(36);

  const db = { settings: {}, clients: {}, entries: {}, invoices: {}, notes: {}, reminders: {}, projects: {}, deals: {}, expenses: {}, recurring: {}, tasks: {} };

  db.settings.main = {
    business: { name: "Jono CRM Demo Studio", address1: "123 Main Street, Suite 200", address2: "Anytown, FL 33000",
      phone: "(727) 555-0100", email: "hello@demostudio.example", website: "democrm.jonokeane.com" },
    bank: { bankName: "Main Street Community Bank", accountName: "Jono CRM Demo Studio", routing: "123456789", account: "••••••4821" },
    apps: { cashapp: "$DemoStudio", venmo: "@Demo-Studio", zelle: "hello@demostudio.example" },
    cardLink: "", terms: "Net 15", setAsideLow: 0.25, setAsideHigh: 0.30,
    email: { fromName: "Jordan Lee", fromEmail: "invoices@demostudio.example", replyTo: "hello@demostudio.example", bcc: true, bccTo: "",
      sigName: "Jordan Lee", sigTitle: "Owner | Jono CRM Demo Studio", sigPhone: "(727) 555-0100", sigEmail: "hello@demostudio.example" },
    calendar: { jordan: "jordan@demostudio.example" }
  };

  /* ---------- clients ---------- */
  const C = [
    { id: "harbor-pine", company: "Harbor & Pine Dental", prefix: "Dr.", firstName: "Maya", lastName: "Chen", title: "DDS", status: "client",
      industry: "Dental", source: "Referral", email: "maya@harborpine.example", phone: "(727) 555-0142", cell: "(727) 555-0187",
      website: "harborpine.example", address: "48 Harbor Way\nAnytown, FL 33000", rate: 85, billTo: "Harbor & Pine Dental, PLLC",
      contacts: [{ name: "Erin Brooks", role: "Office manager", email: "erin@harborpine.example", phone: "(727) 555-0143" }] },
    { id: "brightside-pt", company: "Brightside Physical Therapy", firstName: "Marcus", lastName: "Ellison", title: "DPT", status: "client",
      industry: "Healthcare", source: "Website", email: "marcus@brightsidept.example", phone: "(727) 555-0121",
      website: "brightsidept.example", address: "900 Gulf Blvd, Unit 3\nAnytown, FL 33000", rate: 75 },
    { id: "summit-ridge", company: "Summit Ridge Consulting", prefix: "Mr.", firstName: "David", lastName: "Park", title: "MBA", status: "client",
      industry: "Consulting", source: "Past relationship", email: "david@summitridge.example", phone: "(813) 555-0164",
      website: "summitridge.example", rate: 95 },
    { id: "copperleaf", company: "Copperleaf Coffee Co.", firstName: "Ana", lastName: "Torres", status: "client",
      industry: "Food & beverage", source: "Instagram", email: "ana@copperleafcoffee.example", cell: "(727) 555-0108",
      website: "copperleafcoffee.example", address: "15 Oak Street\nAnytown, FL 33000", rate: 65 },
    { id: "lumen-yoga", company: "Lumen Yoga Studio", firstName: "Priya", lastName: "Shah", status: "lead",
      industry: "Fitness", source: "Instagram", email: "priya@lumenyoga.example", cell: "(727) 555-0176", rate: 0, active: false },
    { id: "bayview-realty", company: "Bayview Realty Group", firstName: "Tom", lastName: "Gallagher", status: "lead",
      industry: "Real estate", source: "Event / networking", email: "tom@bayviewrealty.example", phone: "(727) 555-0133", rate: 0, active: false },
    { id: "crescent-law", company: "Crescent Law Partners", firstName: "Rachel", lastName: "Kim", title: "Esq.", status: "prospect",
      industry: "Legal", source: "LinkedIn", email: "rkim@crescentlaw.example", phone: "(813) 555-0150", rate: 0, active: false },
    { id: "northgate-auto", company: "Northgate Auto Detailing", firstName: "Chris", lastName: "Morales", status: "prospect",
      industry: "Automotive", source: "Cold outreach", phone: "(727) 555-0119", rate: 0, active: false },
    { id: "old-mill", company: "Old Mill Bakery", firstName: "Hannah", lastName: "Weiss", status: "past",
      industry: "Food & beverage", source: "Referral", email: "hannah@oldmillbakery.example", phone: "(727) 555-0155", rate: 60, active: false },
    { id: "quickprint", company: "QuickPrint Express", status: "dnc", industry: "Printing", source: "Cold outreach", rate: 0, active: false }
  ];
  C.forEach((c, i) => {
    const name = c.company;
    db.clients[c.id] = Object.assign({ prefix: "", firstName: "", lastName: "", title: "", email: "", email2: "", phone: "", cell: "",
      website: "", address: "", contacts: [], socials: {}, contact: "", active: true }, c,
      { name, billTo: c.billTo || name, contactName: c.firstName || "", order: i, createdAt: at(D(-200 + i * 9)) });
    delete db.clients[c.id].id;
  });
  const email = cid => db.clients[cid].email;

  /* ---------- projects ---------- */
  // stage/waitAgo are for open (not-done) components, to spread the board's "doing"/"waiting on client" columns.
  const comp = (name, due, doneAgo, stage, waitAgo) => ({ id: id("k"), name, due: due == null ? "" : D(due), done: doneAgo != null,
    doneDate: doneAgo != null ? D(-doneAgo) : null, stage: doneAgo == null ? (stage || "todo") : null, stageAt: doneAgo == null && waitAgo != null ? D(-waitAgo) : null });
  const P = (pid, o) => { db.projects[pid] = Object.assign({ createdAt: at(o.start), updatedAt: at(T), by: "jordan" }, o); };
  P("hp-site", { clientId: "harbor-pine", name: "Website redesign", status: "active", start: D(-52), due: D(16), budget: 9800,
    description: "New mobile-friendly site with online booking, service pages and refreshed photography.",
    components: [comp("Discovery & sitemap", null, 45), comp("Homepage design", null, 30), comp("Service pages", null, 12),
      comp("Online booking setup", 3, null, "doing"), comp("Content & photo upload", 9, null, "waiting", 4), comp("Launch & SEO check", 16)] });
  P("cl-labels", { clientId: "copperleaf", name: "Seasonal bag labels", status: "active", start: D(-24), due: D(6), budget: 1800,
    description: "Holiday blend labels for 12 oz and 2 lb bags, plus matching Instagram posts.",
    components: [comp("Label concepts", null, 15), comp("Final label art", -1), comp("Print-ready files", 6, null, "doing"), comp("Launch posts", 10)] });
  P("bs-social", { clientId: "brightside-pt", name: "Monthly social & email", status: "active", start: D(-105), due: "", budget: 0,
    description: "Ongoing retainer: weekly social posts, a monthly patient newsletter and a short analytics report.",
    components: [comp("Patient newsletter", null, 8), comp("Social calendar", null, 5), comp("Holiday promo graphics", 11, null, "waiting", 2), comp("Monthly report", 4, null, "doing")] });
  P("sr-deck", { clientId: "summit-ridge", name: "Pitch deck & branded PDFs", status: "hold", start: D(-60), due: D(30), budget: 3200,
    description: "Investor deck and three case-study PDFs. Paused while the client finalizes numbers.",
    components: [comp("Deck outline", null, 50), comp("Slide design", null, 28), comp("Case study PDFs", null, null, "waiting", 18), comp("Final revisions")] });
  P("om-menu", { clientId: "old-mill", name: "Menu & signage", status: "done", start: D(-175), due: D(-140), budget: 1500, doneDate: D(-140),
    description: "New counter menu, window signage and chalkboard art files.",
    components: [comp("Menu layout", null, 160), comp("Window signage", null, 150), comp("Chalkboard art files", null, 141)] });

  /* ---------- standalone tasks (the projects board) ----------
     due: days from today (D(n)) or null for no due date. ago: days since the task entered its
     current column — shown as "waiting N days" for waiting/payment, or as the completion date for done. */
  const tsk = (clientId, name, due, stage, ago) => { const stageAt = ago != null ? D(-ago) : null;
    db.tasks[id("t")] = { clientId, name, due: due == null ? "" : D(due), stage, stageAt,
      doneDate: stage === "done" ? (stageAt || T) : null, createdAt: at(D(-(ago || 1) - 4)), by: "jordan" }; };
  tsk("northgate-auto", "Quote the detailing flyer job", 4, "todo");
  tsk("", "Draft Q1 content calendar for the studio", 10, "todo");
  tsk("bayview-realty", "Write the listing-template proposal", 2, "doing", 3);
  tsk("", "Add Harbor & Pine site to the studio portfolio", 5, "doing", 2);
  tsk("crescent-law", "Waiting on their logo files & brand assets", null, "waiting", 6);
  tsk("lumen-yoga", "Waiting on the class schedule content", null, "waiting", 2);
  tsk("bayview-realty", "Send deposit invoice before starting flyers", null, "payment", 5);
  tsk("old-mill", "Confirm the mailed check cleared", null, "payment", 3);
  tsk("", "Renewed studio software subscriptions", null, "done", 2);
  tsk("", "Sent October client invoices", null, "done", 6);
  tsk("", "Organized 2026 tax documents", null, "done", 40);

  /* ---------- time entries ---------- */
  const TASKS = {
    "harbor-pine": ["Homepage wireframe", "Homepage design", "Service page layouts", "Booking widget setup", "Photo editing", "Content entry", "Mobile fixes"],
    "brightside-pt": ["Instagram posts & captions", "Patient newsletter layout", "Facebook ad graphics", "Monthly analytics report", "Blog post formatting", "Email campaign setup"],
    "summit-ridge": ["Pitch deck design", "Case study PDF", "Brand guidelines update", "Proposal template", "Slide revisions"],
    "copperleaf": ["Label concepts", "Label revisions", "Final label art", "Instagram launch posts"],
    "old-mill": ["Menu layout", "Window signage", "Chalkboard art files"]
  };
  const PLAN = [ // client, first week, last week, entries per week, hours range (half hours), project
    ["brightside-pt", -15, 0, [2, 3], [3, 7], "bs-social"],
    ["harbor-pine", -7, 0, [3, 4], [5, 8], "hp-site"],
    ["summit-ridge", -15, -3, [1, 2], [4, 6], k => k >= -8 ? "sr-deck" : null],
    ["copperleaf", -3, 0, [1, 2], [3, 6], "cl-labels"],
    ["old-mill", -25, -20, [2, 3], [3, 6], "om-menu"]
  ];
  const STARTS = ["09:00", "09:30", "10:00", "13:00", "13:30", "14:30"];
  const todayDow = (today.getDay() + 6) % 7;
  const weekly = {}; // "cid|k" -> [entry ids]
  PLAN.forEach(([cid, k1, k2, per, hr, proj]) => {
    for (let k = k1; k <= k2; k++) {
      const count = between(per[0], per[1]);
      const days = [0, 1, 2, 3, 4].filter(d => k < 0 || d <= Math.min(todayDow, 4));
      const used = [];
      for (let i = 0; i < count && days.length; i++) {
        const dow = days.splice(Math.floor(rnd() * days.length), 1)[0];
        used.push(dow);
        const start = pick(STARTS); const hrs = between(hr[0], hr[1]) / 2;
        const [h, m] = start.split(":").map(Number); const endMin = h * 60 + m + hrs * 60;
        const end = pad(Math.floor(endMin / 60)) + ":" + pad(endMin % 60);
        const date = iso(wkDay(k, dow));
        const eid = id("e");
        db.entries[eid] = { date, clientId: cid, task: pick(TASKS[cid]), projectId: typeof proj === "function" ? proj(k) : proj,
          kind: "time", start, end, hours: hrs, amount: null, invoiceId: null, createdAt: at(date) };
        (weekly[cid + "|" + k] = weekly[cid + "|" + k] || []).push(eid);
      }
    }
  });
  // one flat-fee job
  const flatDate = iso(wkDay(-9, 2));
  db.entries.flat1 = { date: flatDate, clientId: "copperleaf", task: "Logo refresh", projectId: null, kind: "flat", amount: 650, hours: null,
    start: null, end: null, invoiceId: null, createdAt: at(flatDate) };
  weekly["copperleaf|-9"] = ["flat1"];

  /* ---------- invoices (built the same way the app builds them) ---------- */
  const VIA = { "brightside-pt": "Bank transfer (ACH)", "harbor-pine": "Credit card", "summit-ridge": "Check", "copperleaf": "Zelle", "old-mill": "Check" };
  function statusFor(cid, k) {
    if (cid === "old-mill") return k === -20 ? "check" : "paid";
    if (k <= -3) return "paid";
    if (k === -2) return { "brightside-pt": "paid", "harbor-pine": "partial", "copperleaf": "sent" }[cid] || "paid";
    if (k === -1) return cid === "copperleaf" ? "draft" : "sent";
    return null;
  }
  Object.entries(weekly).forEach(([key, ids]) => {
    const [cid, ks] = key.split("|"); const k = +ks; const st = statusFor(cid, k); if (!st) return;
    const c = db.clients[cid]; const mon = wkDay(k, 0), fri = wkDay(k, 4);
    const items = ids.map(x => Object.assign({ id: x }, db.entries[x])).sort((a, b) => a.date.localeCompare(b.date));
    const byDay = {}, flats = [];
    items.forEach(e => {
      if (e.kind === "flat") { flats.push({ label: e.task, detail: fmtDY(parse(e.date)), hours: null, rate: null, amount: e.amount }); return; }
      const o = byDay[e.date] = byDay[e.date] || { hours: 0, tasks: [] }; o.hours += e.hours; if (!o.tasks.includes(e.task)) o.tasks.push(e.task);
    });
    const dayLines = Object.keys(byDay).sort().map(d => { const dd = parse(d); const h = r2(byDay[d].hours);
      return { label: DOW[dd.getDay()] + ", " + fmtD(dd), detail: byDay[d].tasks.join(" · "), hours: h, rate: c.rate, amount: r2(h * c.rate) }; });
    const lines = dayLines.concat(flats);
    const total = r2(lines.reduce((s, l) => s + l.amount, 0));
    const tasks = [...new Set(items.map(e => { const pr = e.projectId && db.projects[e.projectId]; return pr ? pr.name + ": " + e.task : e.task; }))];
    const inv = { number: invNo(fri), clientId: cid, billTo: c.billTo, periodStart: iso(mon), periodEnd: iso(fri), issued: iso(fri),
      lines, total, hours: r2(dayLines.reduce((s, l) => s + l.hours, 0)), notes: tasks.map(t => "- " + t).join("\n"),
      status: "draft", entryIds: items.map(e => e.id), createdAt: at(iso(fri)) };
    if (st !== "draft") {
      inv.sentDate = iso(fri);
      if (c.email) inv.emails = [{ date: iso(fri), at: at(iso(fri)), to: [c.email], by: "jordan" }];
    }
    if (st === "sent") inv.status = "sent";
    if (st === "partial") { inv.status = "sent"; inv.payments = [{ date: iso(add(fri, 5)), amount: r2(Math.round(total / 2)), via: VIA[cid] }]; }
    if (st === "paid") { const pd = iso(add(fri, between(4, 12))); inv.status = "paid"; inv.paidDate = pd < T ? pd : T; inv.paidVia = VIA[cid];
      inv.payments = [{ date: inv.paidDate, amount: total, via: VIA[cid] }]; }
    if (st === "check") { inv.status = "check"; inv.statusNote = "Hannah says a check is in the mail. Confirm it cleared before counting this as income."; }
    const invId = inv.number + "-" + cid;
    db.invoices[invId] = inv;
    ids.forEach(x => { db.entries[x].invoiceId = invId; });
  });

  /* ---------- notes ---------- */
  const note = (cid, ago, kind, text) => { db.notes[id("n")] = { clientId: cid, date: D(-ago), kind, text, createdAt: at(D(-ago)), by: "jordan" }; };
  note("harbor-pine", 54, "meeting", "Kickoff meeting with Dr. Chen and Erin. They want online booking, a cleaner look, and pages for each service. Approved the $9,800 quote.");
  note("harbor-pine", 31, "email", "Sent homepage design. Maya loves the new photos; asked for a softer blue.");
  note("harbor-pine", 6, "call", "Erin called about the booking widget. Their scheduling software has an embed, so no custom build needed.");
  note("brightside-pt", 110, "meeting", "Started the monthly retainer: 4 social posts a week, a monthly newsletter and a short report.");
  note("brightside-pt", 17, "call", "Marcus wants to run Facebook ads in Q1. Quoted a 3-month campaign.");
  note("summit-ridge", 62, "meeting", "Scoped the investor deck and three case-study PDFs.");
  note("summit-ridge", 20, "email", "David asked to pause the deck until their Q3 numbers are final. Project on hold.");
  note("copperleaf", 65, "text", "Ana asked for a quick logo refresh before the farmers market season.");
  note("copperleaf", 24, "meeting", "Tasting and label kickoff at the roastery. Holiday blend launches in a few weeks.");
  note("lumen-yoga", 11, "call", "Intro call with Priya. Needs a new site with class booking before their January launch.");
  note("lumen-yoga", 4, "meeting", "Walked through the proposal. She's comparing one other quote and will decide soon.");
  note("bayview-realty", 34, "note", "Met Tom at the chamber mixer. Interested in listing flyer templates and social graphics for 8 agents.");
  note("crescent-law", 13, "email", "Rachel replied to my LinkedIn message. Sent the brand identity package overview and pricing.");
  note("old-mill", 178, "meeting", "Menu and signage refresh for the new storefront.");
  note("old-mill", 120, "note", "Project wrapped. Hannah is happy; may need a catering menu next year.");
  note("quickprint", 210, "email", "Asked to be removed from outreach. Do not contact.");

  /* ---------- reminders ---------- */
  const rem = (cid, ago, time, text, done) => { db.reminders[id("r")] = { clientId: cid, date: D(-ago), time, text, done: !!done,
    doneAt: done ? at(D(-ago)) : null, createdAt: at(D(-ago - 5)), by: "jordan" }; };
  rem("brightside-pt", 1, "09:00", "Send the October analytics report to Marcus");
  rem("harbor-pine", 0, "14:00", "Review the booking setup with Erin");
  rem("lumen-yoga", -2, "11:00", "Follow up with Priya on the website quote");
  rem("summit-ridge", -5, "", "Check in with David about restarting the pitch deck");
  rem("crescent-law", -8, "10:30", "Follow up on the brand identity quote");
  rem("copperleaf", -20, "", "Ask Ana about spring label ideas");
  rem("harbor-pine", 9, "10:00", "Send homepage revisions", true);

  /* ---------- deals ---------- */
  const deal = (cid, name, value, stage, ago, closedAgo) => { db.deals[id("d")] = { clientId: cid, name, value, stage, date: D(-ago),
    closed: closedAgo != null ? D(-closedAgo) : null, createdAt: at(D(-ago)), by: "jordan" }; };
  deal("harbor-pine", "Website redesign", 9800, "won", 58, 54);
  deal("copperleaf", "Seasonal label series", 1800, "won", 27, 24);
  deal("lumen-yoga", "Website + class booking", 4800, "negotiating", 10);
  deal("crescent-law", "Brand identity package", 3500, "quoted", 13);
  deal("bayview-realty", "Listing flyer templates", 1200, "quoted", 33);
  deal("brightside-pt", "Q1 Facebook ad campaign", 2400, "quoted", 16);
  deal("old-mill", "Catering menu", 600, "lost", 118, 95);

  /* ---------- expenses ---------- */
  const exp = (ago, category, vendor, amount, extra) => { const d = D(-ago); db.expenses[id("x")] = Object.assign({ date: d, category, vendor,
    amount, miles: null, rate: null, clientId: null, createdAt: at(d), by: "jordan" }, extra || {}); };
  const mile = d => d >= "2026-07-01" ? 0.76 : 0.725;
  const trip = (ago, vendor, miles, clientId) => { const d = D(-ago); const rate = mile(d);
    exp(ago, "mileage", vendor, r2(miles * rate), { miles, rate, clientId }); };
  exp(160, "equipment", "Drawing tablet", 349.00);
  exp(120, "education", "Online UX design course", 199.00);
  exp(95, "advertising", "Instagram ads for the studio", 150.00);
  exp(70, "office", "Printer paper & ink", 42.17);
  exp(52, "meals", "Kickoff lunch with Harbor & Pine", 64.80, { clientId: "harbor-pine" });
  exp(40, "contract", "Freelance photographer", 350.00, { clientId: "harbor-pine" });
  exp(28, "equipment", "Laptop stand & keyboard", 189.00);
  exp(12, "meals", "Coffee meeting with Lumen Yoga", 18.50, { clientId: "lumen-yoga" });
  exp(9, "fees", "Card processing fees", 18.40);
  trip(54, "Harbor & Pine office for kickoff", 18.4, "harbor-pine");
  trip(31, "Harbor & Pine office for photo shoot", 24, "harbor-pine");
  trip(24, "Copperleaf roastery for label tasting", 11.2, "copperleaf");
  trip(4, "Lumen Yoga studio for proposal review", 9.6, "lumen-yoga");

  // Repeating expenses: past months already logged, so nothing new is added when the demo opens.
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const nextDue = (r, from) => { const d = parse(from); let y = d.getFullYear(), m = d.getMonth();
    if (r.freq === "yearly") y++; else { m++; if (m > 11) { m = 0; y++; } } return iso(new Date(y, m, Math.min(r.day, dim(y, m)))); };
  const REC = [
    ["adobe", "software", "Adobe Creative Cloud", 59.99, "monthly", 5, 200],
    ["workspace", "software", "Google Workspace", 14.00, "monthly", 1, 200],
    ["hosting", "software", "Website hosting", 20.00, "monthly", 12, 200],
    ["phone", "phone", "Phone & internet", 85.00, "monthly", 20, 200],
    ["canva", "software", "Canva Pro", 119.99, "yearly", 15, 250]
  ];
  REC.forEach(([rid, category, vendor, amount, freq, day, back]) => {
    const r = { category, vendor, amount, clientId: null, freq, day, active: true, createdAt: at(D(-back)), by: "jordan" };
    const b = add(today, -back);
    let d = iso(new Date(b.getFullYear(), b.getMonth(), Math.min(day, dim(b.getFullYear(), b.getMonth()))));
    if (d < iso(b)) d = nextDue(r, d);
    r.start = d; let last = d;
    for (let x = d; x <= T; x = nextDue(r, x)) {
      db.expenses["rec-" + rid + "-" + x] = { date: x, category, vendor, amount, miles: null, rate: null, clientId: null, recurringId: rid, createdAt: at(x), auto: true };
      last = x;
    }
    r.last = last;
    db.recurring[rid] = r;
  });

  return db;
};

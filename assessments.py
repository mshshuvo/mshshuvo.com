"""Readiness checks shown at /assessment/<slug>.

Each check has 8 questions answered Yes (2), Partly (1) or No (0). The score is the share of
points earned; bands map the score to a verdict and one line of advice. `ref` points to the
clause, control or category the question comes from, and `fix` is the first action to close it.

build.py writes worker/assessments.json from this file so the Worker can validate submissions
and name the gaps in the daily digest.
"""

BANDS = [  # (minimum %, css tone)
    (80, "good"),
    (50, "mid"),
    (0, "low"),
]

ASSESSMENTS = [
    {
        "slug": "iso-27001",
        "name": "ISO 27001",
        "title": "How ready are you for ISO 27001?",
        "short": "Information security management: what certification auditors check first.",
        "seo_title": "Free ISO 27001 Readiness Check",
        "meta": "A free two-minute ISO/IEC 27001 readiness check that shows your biggest gaps against what certification auditors look at first.",
        "service": "iso-27001-grc-audit",
        "verdicts": [
            ("Audit-ready", "You're in strong shape. A pre-certification internal audit would confirm it."),
            ("Building", "Solid foundations, but auditors will find gaps. Prioritise the items below."),
            ("Early stage", "Start with scope, risk assessment and leadership buy-in before anything else."),
        ],
        "questions": [
            {"q": "Have you defined the scope of your ISMS: which people, sites, systems and data it covers?",
             "ref": "Clause 4.3", "fix": "Write a one-page scope statement and get leadership to sign it off."},
            {"q": "Does top management formally own information security, with assigned roles and responsibilities?",
             "ref": "Clause 5", "fix": "Name an accountable executive and document security roles."},
            {"q": "Do you run a documented, repeatable information security risk assessment?",
             "ref": "Clause 6.1.2", "fix": "Adopt a risk method (likelihood × impact) and build a risk register."},
            {"q": "Do you have a Statement of Applicability covering the Annex A controls?",
             "ref": "Clause 6.1.3", "fix": "Map all 93 Annex A controls, justify inclusions and exclusions."},
            {"q": "Are security policies approved, published and acknowledged by staff?",
             "ref": "Annex A 5.1", "fix": "Publish a policy set and track staff acknowledgement."},
            {"q": "Is there a security awareness programme, including phishing training?",
             "ref": "Annex A 6.3", "fix": "Run onboarding training plus quarterly phishing simulations."},
            {"q": "Do you have an incident management process that has actually been tested?",
             "ref": "Annex A 5.24–5.28", "fix": "Write an incident playbook and run a tabletop exercise."},
            {"q": "Have you carried out an internal audit and a management review in the last 12 months?",
             "ref": "Clauses 9.2 & 9.3", "fix": "Schedule an independent internal audit, then a management review."},
        ],
    },
    {
        "slug": "iso-42001",
        "name": "ISO 42001 · AI governance",
        "title": "How ready is your AI governance?",
        "short": "AI management systems: policy, risk, impact and oversight of the AI you build, buy and use.",
        "seo_title": "Free ISO 42001 AI Governance Readiness Check",
        "meta": "A free two-minute ISO/IEC 42001 readiness check for AI governance: AI policy, risk and impact assessment, data, third-party AI and monitoring.",
        "service": "ai-governance-iso-42001",
        "verdicts": [
            ("Well governed", "Your AI governance is in good shape. An internal audit against ISO/IEC 42001 would confirm it."),
            ("Taking shape", "The basics exist, but regulators and auditors would find gaps. Work through the items below."),
            ("Early stage", "Start with an inventory of AI systems, an AI policy and a named accountable owner."),
        ],
        "questions": [
            {"q": "Have you defined the scope of your AI management system: which AI systems, uses and teams it covers?",
             "ref": "Clause 4.3", "fix": "Inventory the AI you build, buy and use, then write a scope statement leadership signs off."},
            {"q": "Is there an approved AI policy, with an accountable executive and defined AI roles?",
             "ref": "Clauses 5.2–5.3", "fix": "Publish an AI policy and name who approves, owns and monitors each AI system."},
            {"q": "Do you run a documented AI risk assessment covering bias, safety, privacy and security?",
             "ref": "Clause 6.1.2", "fix": "Adopt an AI risk method and record the risks of each AI system in a register."},
            {"q": "Do you assess the impact of each AI system on individuals and society before it goes live?",
             "ref": "Clause 6.1.4 · A.5", "fix": "Make an AI system impact assessment a gate before deployment."},
            {"q": "Do you have a Statement of Applicability covering the Annex A controls?",
             "ref": "Clause 6.1.3", "fix": "Map the 38 Annex A controls and justify inclusions and exclusions."},
            {"q": "Is the data used by your AI systems documented for source, quality and permitted use?",
             "ref": "Annex A.7", "fix": "Record provenance, quality checks and usage rights for training and input data."},
            {"q": "Do you control third-party AI, including vendors, APIs and generative AI tools staff use?",
             "ref": "Annex A.9–A.10", "fix": "Set acceptable-use rules for AI tools and add AI terms to supplier due diligence."},
            {"q": "Do you monitor AI systems in operation and review the AI management system through internal audit?",
             "ref": "Clauses 9.1–9.3", "fix": "Track performance and incidents per AI system, then run an internal audit and management review."},
        ],
    },
    {
        "slug": "nist-csf",
        "name": "NIST CSF 2.0",
        "title": "Where do you stand against NIST CSF 2.0?",
        "short": "A quick read across Govern, Identify, Protect, Detect, Respond and Recover.",
        "seo_title": "Free NIST Cybersecurity Framework 2.0 Self-Assessment",
        "meta": "A free two-minute self-assessment against NIST CSF 2.0, covering Govern, Identify, Protect, Detect, Respond and Recover.",
        "service": "cyber-strategy",
        "verdicts": [
            ("Managed", "Strong coverage across the framework. Focus on measuring outcomes and improving continuously."),
            ("Developing", "Good building blocks with gaps that attackers and auditors would find. Close the items below first."),
            ("Initial", "Start with Govern and Identify: clear ownership, a risk appetite and an asset inventory."),
        ],
        "questions": [
            {"q": "Is cybersecurity risk part of enterprise risk management, with a risk appetite leadership agreed?",
             "ref": "GV.RM", "fix": "Agree a risk appetite with leadership and report cyber risk alongside other business risks."},
            {"q": "Are cybersecurity roles, responsibilities and authority assigned, resourced and owned by leadership?",
             "ref": "GV.RR", "fix": "Name an accountable executive and document who decides, who does and who checks."},
            {"q": "Do you manage cybersecurity risk in your suppliers and service providers?",
             "ref": "GV.SC", "fix": "Tier suppliers by risk and add security requirements to contracts and onboarding."},
            {"q": "Do you keep an up-to-date inventory of hardware, software, data and services?",
             "ref": "ID.AM", "fix": "Build an asset inventory and give every critical asset an owner."},
            {"q": "Is multi-factor authentication enforced for email, remote access and admin accounts?",
             "ref": "PR.AA", "fix": "Enforce phishing-resistant MFA for admins first, then everyone."},
            {"q": "Are systems patched and securely configured, with backups protected and regularly restored in tests?",
             "ref": "PR.PS · PR.DS", "fix": "Set patch deadlines by severity and prove backups with a scheduled restore test."},
            {"q": "Are networks, endpoints and key services monitored so attacks are spotted quickly?",
             "ref": "DE.CM · DE.AE", "fix": "Centralise logs and alerts for critical systems and define who responds to them."},
            {"q": "Do you have response and recovery plans that were exercised in the last 12 months?",
             "ref": "RS.MA · RC.RP", "fix": "Write response and recovery playbooks and run a tabletop exercise."},
        ],
    },
    {
        "slug": "ransomware",
        "name": "Ransomware & incident readiness",
        "title": "Could you survive a ransomware attack?",
        "short": "Backups, access, detection and a tested response plan: the controls that decide the outcome.",
        "seo_title": "Free Ransomware & Incident Readiness Check",
        "meta": "A free two-minute ransomware and incident readiness check: backups, MFA, patching, detection, logging, response plans and breach notification.",
        "service": "incident-response",
        "verdicts": [
            ("Resilient", "You'd likely contain an attack and recover without paying. Keep testing it."),
            ("Exposed in places", "Some gaps could turn an incident into a crisis. Close the items below first."),
            ("High risk", "Prioritise offline backups, MFA everywhere and a tested response plan this quarter."),
        ],
        "questions": [
            {"q": "Do you keep offline or immutable backups of critical systems, and have you tested a full restore?",
             "ref": "Recovery", "fix": "Keep at least one backup copy offline or immutable and restore from it on a schedule."},
            {"q": "Is MFA enforced on email, VPN, remote desktop and every admin account?",
             "ref": "Access", "fix": "Close any remote access without MFA, starting with admin and VPN accounts."},
            {"q": "Are internet-facing systems patched within days of critical vulnerabilities being announced?",
             "ref": "Exposure", "fix": "Track internet-facing assets and patch known-exploited vulnerabilities first."},
            {"q": "Do endpoints and servers run EDR or equivalent protection that someone actually monitors?",
             "ref": "Detection", "fix": "Deploy EDR on all endpoints and servers and assign who watches the alerts."},
            {"q": "Are security logs centralised and kept long enough to investigate, ideally 90 days or more?",
             "ref": "Logging", "fix": "Send key logs to one place and keep them for at least 90 days."},
            {"q": "Do you have an incident response plan with named roles, contacts and decision authority?",
             "ref": "Response plan", "fix": "Write a short plan naming who leads, who decides and who to call, including outside help."},
            {"q": "Have you run a ransomware tabletop exercise with leadership in the last 12 months?",
             "ref": "Exercise", "fix": "Run a two-hour tabletop with leadership, including the pay or don't-pay decision."},
            {"q": "Do you know your legal, regulatory and insurance notification duties after a breach?",
             "ref": "Notification", "fix": "List deadlines and contacts for regulators, your insurer, law enforcement and customers."},
        ],
    },
]

BY_SLUG = {a["slug"]: a for a in ASSESSMENTS}


def worker_spec() -> dict:
    """What the Worker needs: valid checks, question counts and gap labels for the digest."""
    return {a["slug"]: {"name": a["name"], "refs": [q["ref"] for q in a["questions"]],
                        "fixes": [q["fix"] for q in a["questions"]]}
            for a in ASSESSMENTS}

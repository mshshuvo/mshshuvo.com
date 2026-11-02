"""All site copy lives here so you can edit text without touching templates.

Sources of facts: Ethan's Master Resume and comprehensive MASTER Resume (Claude Docs)
and his LinkedIn profile (experience, media, publications, recommendations), Oct 2026.
"""

SITE = {
    "name": "Md Sabbir Hossain",
    "title": "Cybersecurity Leader · GRC & AI Governance",
    "tagline": "Strategy, governance and resilience for regulated organisations, proven at national scale.",
    "intro": ("Cybersecurity, GRC and AI governance leader for regulated organisations, with 15+ years across "
              "financial services, critical infrastructure and government. ISO 27001 Senior Lead Auditor and "
              "ISO 42001 AI Lead Auditor. Previously a core member of the team that built Bangladesh's first "
              "government CIRT, and contributor to its national cybersecurity strategy."),
    "location": "Ottawa, Canada",
    "linkedin": "https://www.linkedin.com/in/mshshuvo/",
    # Cloudflare Turnstile site key (public). Empty = contact page shows email buttons instead.
    "turnstile_sitekey": "0x4AAAAAAFur_A35mfi5lTXU",
    "github": "https://github.com/mshshuvo/Cyber-Projects",
    "linkedin_recs": "https://www.linkedin.com/in/mshshuvo/details/recommendations/",
    "creds": ["C|CISO", "ISO 27001 Senior Lead Auditor", "ISO 42001 AI Lead Auditor", "CEH", "ACE"],
    "domains": ["Cyber strategy & policy", "Incident response & CIRT", "GRC & audit", "Offensive security",
                "Digital forensics", "AI governance", "Financial crime"],
    "profile": [
        ("Based in", "Ottawa, Canada"),
        ("Delivered", "$10M+ national cyber programmes"),
        ("Sectors", "Finance · Critical infra · Government"),
        ("Advisory", "World Bank cybersecurity roster"),
    ],
    "stats": [
        ("15+", "years in cybersecurity"),
        ("$10M+", "national programmes delivered"),
        ("23", "critical infrastructures audited"),
        ("~95%", "drop in nationwide attacks"),
    ],
}

# ---------------------------------------------------------------- projects
PROJECT_TAGS = ["Strategy & policy", "Incident response", "Audit & risk", "Offensive security",
                "Forensics", "Research", "Capacity building"]

PROJECTS = [
    {
        "slug": "national-cirt",
        "title": "Bangladesh's first government CIRT",
        "org": "BGD e-GOV CIRT · Norway Registers Development / NRD Bangladesh",
        "period": "2015 – 2020",
        "role": "Core team member; delivery lead as Managing Director",
        "tags": ["Incident response", "Strategy & policy"],
        "featured": True,
        "summary": "Built the country's national government CIRT after the 2016 Bangladesh Bank SWIFT heist.",
        "challenge": "After the SWIFT heist, Bangladesh had no national capability to detect, coordinate or respond to attacks on government and banks.",
        "work": [
            "Delivered the CIRT, its laboratory and the incident-response capability-enhancement programme (Leveraging ICT for Growth, Employment and Governance project).",
            "Designed and ran risk-assessment and incident-response processes with a 40+ analyst team across threat intelligence and incident response.",
            "Represented the CIRT in FIRST, APWG and OIC-CIRT.",
        ],
        "outcomes": ["~95% drop in nationwide cyberattacks", "Repeat attacks on banks and government blocked"],
    },
    {
        "slug": "national-strategy",
        "title": "National cybersecurity strategy & risk framework",
        "org": "Government of Bangladesh · with University of Oxford GCSCC",
        "period": "Jun 2018 – Jun 2019",
        "role": "Led development for NRD",
        "tags": ["Strategy & policy"],
        "featured": True,
        "summary": "Led Bangladesh's national cybersecurity strategy with Oxford's Global Cyber Security Capacity Centre.",
        "challenge": "The government needed a national strategy and a common way for agencies to assess and raise their security baseline.",
        "work": [
            "Led the strategy and national risk-assessment framework with the University of Oxford's Global Cyber Security Capacity Centre.",
            "Delivered a critical information infrastructure assessment, an agency self-assessment toolkit and a baseline security package.",
        ],
        "outcomes": ["National strategy and risk framework", "Covered in national press"],
    },
    {
        "slug": "tier4-audit",
        "title": "Critical infrastructure & Tier-IV data centre audit",
        "org": "Bangladesh National CERT · Digital Security Agency",
        "period": "Feb 2020 – Jul 2020",
        "role": "Chief Coordinator, Audit & Risk Assessment",
        "tags": ["Audit & risk"],
        "featured": True,
        "summary": "Led audit and risk assessment of 23 critical information infrastructures, including the national Tier-IV data centre.",
        "challenge": "National systems needed independent assurance and a remediation path, without disrupting live services.",
        "work": [
            "Applied ISO/IEC 27001 and national frameworks to evaluate controls and find gaps.",
            "Delivered remediation roadmaps to government stakeholders.",
            "Led the security and compliance workstream of the Tier-IV data centre's cloud migration.",
        ],
        "outcomes": ["23 critical infrastructures hardened", "~65% better compliance posture", "Zero downtime during audits"],
    },
    {
        "slug": "cyber-sensors",
        "title": "Early-warning cyber sensors in critical infrastructure",
        "org": "NRD Bangladesh",
        "period": "Oct 2017 – Jun 2019",
        "role": "Programme director",
        "tags": ["Incident response"],
        "summary": "Deployed national early-warning sensors across 17 critical infrastructure sites.",
        "challenge": "Attacks on critical infrastructure were detected late or not at all.",
        "work": ["Planned and deployed cyber sensors feeding the national CIRT's detection and early warning."],
        "outcomes": ["17 critical infrastructure sites covered"],
    },
    {
        "slug": "forensics-lab",
        "title": "National digital forensics lab",
        "org": "BGD e-GOV CIRT",
        "period": "2017 – 2020",
        "role": "Delivery and establishment",
        "tags": ["Forensics"],
        "summary": "Established the national digital forensics laboratory for the government CIRT.",
        "challenge": "Investigators needed in-country forensic capability for incidents and cybercrime.",
        "work": ["Delivered the digital forensics lab and the CIRT laboratory at Bangladesh Computer Council."],
        "outcomes": ["National forensic capability in place"],
    },
    {
        "slug": "bach-vapt",
        "title": "Central bank payment-system VAPT",
        "org": "Bangladesh Bank (central bank) · BACH-II",
        "period": "Apr 2019 – Sep 2019",
        "role": "Project Manager",
        "tags": ["Offensive security"],
        "summary": "Managed vulnerability assessment and penetration testing of the central bank's BACH-II clearing system.",
        "challenge": "A critical national payment system needed independent offensive testing after the SWIFT heist.",
        "work": ["Project-managed the VAPT engagement from scoping through remediation reporting."],
        "outcomes": ["Central bank clearing system tested"],
    },
    {
        "slug": "national-vapt",
        "title": "National VAPT, IT audit & risk programme",
        "org": "BGD e-GOV CIRT",
        "period": "2019 – 2020",
        "role": "Cybersecurity Risk Analyst",
        "tags": ["Offensive security", "Audit & risk"],
        "summary": "Ran national VAPT, IT audit and risk programmes that uncovered nation-state campaigns against banks.",
        "challenge": "Government and financial systems had unknown exposure to advanced attackers.",
        "work": [
            "Ran national VAPT, IT audit and risk-assessment programmes.",
            "Redesigned third-party risk management and contract review for agencies connecting to national infrastructure.",
        ],
        "outcomes": ["500+ critical vulnerabilities found", "Nation-state campaigns against banks identified"],
    },
    {
        "slug": "cyber-helpline",
        "title": "National Cyber Helpline",
        "org": "Bangladesh N-CERT",
        "period": "Jun 2020 – Dec 2020",
        "role": "Set up the service",
        "tags": ["Incident response"],
        "summary": "Set up the national helpline for citizens and organisations to report cyber incidents.",
        "challenge": "Citizens had no single place to report cybercrime and get help.",
        "work": ["Set up the helpline's process and operation during 2020."],
        "outcomes": ["National reporting channel launched"],
    },
    {
        "slug": "threat-landscape",
        "title": "Bangladesh Cyber Threat Landscape 2019",
        "org": "BGD e-GOV CIRT",
        "period": "May 2019 – Jun 2019",
        "role": "Prepared and published",
        "tags": ["Research", "Strategy & policy"],
        "summary": "Prepared and published the national cyber threat landscape report for 2019.",
        "challenge": "Policymakers needed an evidence base on the threats facing the country.",
        "work": ["Analysed national incident and threat data into a published annual report."],
        "outcomes": ["National threat report published"],
    },
    {
        "slug": "phishing-ml",
        "title": "Machine learning for phishing detection",
        "org": "University of Ottawa · IBM Center for Advanced Studies",
        "period": "Sep 2020 – Sep 2023",
        "role": "Graduate researcher, IBM CAS fellow",
        "tags": ["Research"],
        "summary": "Built ML models for phishing detection and automated tracking of cybercriminal infrastructure.",
        "challenge": "Phishing infrastructure changes faster than manual blocklists can track.",
        "work": [
            "Researched cyberattack countermeasures and prevention under an IBM CAS fellowship.",
            "Analysed phishing datasets as an APWG Research Fellow (2022 – 2024).",
        ],
        "outcomes": ["IBM CAS Fellowship", "APWG research contribution"],
    },
    {
        "slug": "training",
        "title": "National cybersecurity training programmes",
        "org": "Government of Bangladesh · University of Ottawa",
        "period": "2016 – 2023",
        "role": "Programme builder and instructor",
        "tags": ["Capacity building"],
        "summary": "Trained 100+ officials, law-enforcement and industry professionals; designed a university cyber lab.",
        "challenge": "A new national CIRT needed people who could run it.",
        "work": [
            "Built InfoSec, cyber and forensics training programmes for government officials and law enforcement.",
            "Designed a hands-on cybersecurity lab for MS, PhD and 4th-year students at the University of Ottawa.",
        ],
        "outcomes": ["100+ professionals trained", "University lab in use"],
    },
    {
        "slug": "security-intelligence",
        "title": "Security-intelligence & forensic platforms for government",
        "org": "Verint Systems · Device Technologies",
        "period": "2010 – 2015",
        "role": "Technical Manager & Local Technical Expert",
        "tags": ["Forensics"],
        "summary": "Led an 8-person team deploying cyber-intelligence, digital forensics and lawful-interception systems for government agencies.",
        "challenge": "Government agencies needed specialist platforms deployed and their staff trained to use them.",
        "work": [
            "Delivered turnkey security-intelligence and lawful-interception solutions for government clients.",
            "Trained government users on the platforms.",
        ],
        "outcomes": ["8-person delivery team led"],
    },
]

# ---------------------------------------------------------------- publications
POLICIES = [
    ("National Cybersecurity Strategy & Risk Assessment Framework", "Government of Bangladesh · with Oxford GCSCC · 2018 – 2019"),
    ("Critical information infrastructure assessment, self-assessment toolkit & baseline security package", "For government agencies · 2018 – 2019"),
    ("National CIRT and information-security policies and standards", "Bangladesh · 2015 – 2017"),
    ("National guidelines on VAPT, cloud security, Zero Trust and security audits", "BGD e-GOV CIRT · aligned with ISO/IEC 27001, NIST and PCI DSS"),
    ("Bangladesh Cyber Threat Landscape 2019", "BGD e-GOV CIRT · annual national report"),
]

ARTICLES = [
    {"title": "Critical Infrastructure and Control Systems: How to Protect?", "venue": "Computer Jagat", "date": "June 2020", "url": None},
    {"title": "APCERT Cyber Drill 2020: “Banker Doubles Down on Miner”", "venue": "Bangladesh Post", "date": "",
     "url": "https://bangladeshpost.net/posts/apcert-cyber-drill-2020-banker-doubles-down-on-miner-28577"},
    {"title": "5W & 1H of Phishing Campaign", "venue": "Bangladesh Post", "date": "",
     "url": "https://bangladeshpost.net/posts/5w-1h-of-phishing-campaign-37931"},
    {"title": "AI: An Opportunity for Labor Market or a Curse?", "venue": "Bangladesh Post", "date": "",
     "url": "https://bangladeshpost.net/posts/ai-an-opportunity-for-labor-market-or-a-curse-27907"},
    {"title": "APWG Phishing Activity Trends Report for Q3 2019 Raises Alarm", "venue": "Bangladesh Post · BGD e-GOV CIRT", "date": "",
     "url": "https://bangladeshpost.net/posts/apwg-phishing-activity-trends-reports-for-q3-19-raise-alarm-24527"},
    {"title": "Voice Authentication in the Financial Sector: Security or Risk? (Bengali)", "venue": "BGD e-GOV CIRT", "date": "",
     "url": "https://www.cirt.gov.bd/voice-auth-financial-oeg/"},
    {"title": "Data Privacy & Protection", "venue": "Medium", "date": "",
     "url": "https://medium.com/@mshshuvo/data-privacy-protection-b78cffc61962"},
]

EARLY_WRITING = [
    ("Security at its Best", "PC Today"),
    ("Simple Tricks for Keeping Your PC Healthy", "Computer Today"),
    ("Ad Hoc Wireless Network", "Undergraduate thesis, Prime University · 2010"),
    ("Design of Remote Switch System", "Computer Bichitra · 2009"),
]

PRESS = [
    ("Government and international cybersecurity firms to develop cyber security strategy",
     "The Daily Observer · on the NRD and Oxford GCSCC national strategy project"),
]

# ---------------------------------------------------------------- recommendations
# Text exactly as written on LinkedIn (visible to all members). Only those set "On" are used.
RECOMMENDATIONS = [
    {"name": "Vilius Benetis", "title": "Establishment of incident response capabilities (SOCs / CSIRTs / ISACs / MSSPs)",
     "relation": "Managed Sabbir directly", "date": "Feb 2019", "featured": True,
     "text": "Mr. Sabbir Hossain is a person one can rely for business operations and things get done, even when situations get difficult. His technical in-depth knowledge of ICT and Information Security disciplines are making him great communicator and effective business man. I am feeling honored to work with Sabbir for last few years, and hope that our cooperation last many years longer!"},
    {"name": "Rimtautas Cerniauskas", "title": "CIRT Solutions Architect, NRD Cyber Security",
     "relation": "Worked on the same team", "date": "May 2020", "featured": True,
     "text": "I have worked with Sabbir in several IT and Cyber Security international projects, financed by major international donors. In these projects Sabbir always was very professional and qualified manager, his project planing and execution skills were excellent. Sabbir predicted and supervised many at first hardly known projects execution details, his fast reaction and management skills helped a lot in many difficult and complex situations. Working with Sabbir was easy, we always understood each other from first sentence. I can recommend Sabbir as qualified and professional IT and security project manager, with attention to details and superior supervising skills."},
    {"name": "Mahidul Alam", "title": "Reported to Sabbir directly", "relation": "Direct report", "date": "Jul 2022", "featured": True,
     "text": "Mr. Sabbir is a fantastic manager. I had the pleasure of working with him on several projects for two years, and he leads by example. He always kept the team morale high, and I believe he is the best manager I've ever had because he is so approachable. His ability to work through a crisis and find new ways to meet goals was always inspiring. I am honoured to work and learn alongside such accomplished individuals."},
    {"name": "Marius Urkis", "title": "CIRT lead, CIRT/SOC architect, NRD Cyber Security",
     "relation": "Worked on the same team", "date": "Feb 2019",
     "text": "I had a pleasure working with Sabbir on CSIRT building projects in Bangladesh. During this time Sabbir was taking hard part of managing relationships with the customers, taking care on project organizational activities and logistics. I was pleased with his attitude to details, managerial and organizational skills, diplomatic abilities and proficiency in cybersec. Sabbir's input helped us a lot running our projects smoothly and efficiently."},
    {"name": "Tamim Ahmed, CISSP, CISM, CRISC, PMP", "title": "Senior Cybersecurity & IT GRC Consultant",
     "relation": "Client", "date": "Feb 2019",
     "text": "I have worked closely with Mr. Sabbir. He has a very strong grasp of IT security and excellent communication skills. With his tech skills and commitment, I am confident that he will surpass your expectations."},
    {"name": "Debashis Pal", "title": "Information Security Specialist", "relation": "Client", "date": "Feb 2019",
     "text": "Working with Sabbir Hossain is a rare opportunity to come across, a self-driven cyber security professional with teamwork spirit. He has superior capacity to solve complex problems involving a wide variety of information systems, work independently on large-scale projects, and thrive under pressure in fast-pace environments while directing multiple projects from concept to implementation. Wish him every success in his future endeavors."},
    {"name": "Sigitas Rokas", "title": "Cyber security, NATO Communications and Information Agency",
     "relation": "Managed Sabbir directly", "date": "Sep 2017",
     "text": "Sabbir is good team player. We had together intensive, challenging and sometimes stressing cyber-security related time for 18 months in Asia. Things are going easier with him!"},
    {"name": "Tanzir Ul Islam", "title": "Senior Developer", "relation": "Client", "date": "Apr 2019",
     "text": "As being a coworker with Mr. Sabbir, i have found him very passionate about his profession. He is reliable for any small to high level technical or managerial task with great proficiency. He has expertise on IT security, auditing, digital forensics with excellent managerial skills on the full team. I have been lucky to work with him to gather exceptional knowledge on different perspectives."},
    {"name": "James Edwards", "title": "FSE Europe & Africa, Global Customer Ops", "relation": "Worked together, different companies", "date": "Jan 2015",
     "text": "Having worked with Sabbir on a demanding project for a Govt agency in Dhaka, I can say without doubt, he is one of the most diligent, professional and customer focused engineers it has been my pleasure to work with. He has limitless patience under highly pressured situations. I look forward to working with him again. An asset to any team."},
    {"name": "Daniel Fryett", "title": "Sales", "relation": "Sabbir was his client", "date": "Jan 2015",
     "text": "Sabbir is a rare customer focused Engineer who understands the delicate politics of OEM, Agent, Reseller and End User relationships. It is always a pleasure to work with him."},
    {"name": "Md. Alamin Bhuiyan", "title": "Staff Software Engineer", "relation": "Studied together", "date": "Dec 2014",
     "text": "In a word Mr. Sabbir is exceptionally intelligent. He proved to be a very quick study, learning the elements of experimental design. Furthermore, his questions are always thoughtful and penetrating. He never refused me whenever I knocked him. His skill of communication is a reason of envy to many. I wish him success in his future endeavors."},
]

# ---------------------------------------------------------------- experience
EXPERIENCE = [
    {"period": "Jan 2023 – Present", "role": "Short-Term Cybersecurity Consultant (expert roster)", "org": "The World Bank",
     "summary": "On-demand advisory on cyber strategy, risk and digital governance for Bank projects and client governments.",
     "points": ["Selected onto the Bank's cybersecurity expert roster through competitive vetting.",
                "Provide document review and expert technical opinions on cybersecurity strategy, risk management and digital governance."],
     "tags": ["Cyber strategy", "Advisory"]},
    {"period": "Dec 2024 – Present", "role": "Financial Services Representative", "org": "goeasy Ltd. (easyfinancial), Ottawa",
     "summary": "Front-line AML/KYC and fraud-prevention controls in Canadian consumer lending.",
     "points": ["Apply AML/KYC and fraud-prevention controls to lending decisions in line with FINTRAC requirements.",
                "Make risk-based approval decisions and escalate suspected financial crime.",
                "Regional Employee of the Quarter, 2026."],
     "tags": ["AML/KYC", "FINTRAC", "Fraud"]},
    {"period": "Sep 2020 – Sep 2023", "role": "Graduate Researcher, IBM Center for Advanced Studies", "org": "University of Ottawa / IBM",
     "summary": "Machine learning for phishing detection; teaching and lab design.",
     "points": ["Built ML models for phishing detection and automated tracking of cybercriminal infrastructure.",
                "Taught secure system design and SEC5100 Fundamentals of Cybersecurity; designed a hands-on cyber lab.",
                "Research Fellow (Data), Anti-Phishing Working Group, 2022 – 2024."],
     "tags": ["Research", "ML", "Teaching"]},
    {"period": "Sep 2019 – Dec 2020", "role": "Cybersecurity Risk Analyst", "org": "Bangladesh e-Government CIRT · also N-CERT (2020)",
     "summary": "Core member of the team that built Bangladesh's first government CIRT.",
     "points": ["Designed and ran risk-assessment and incident-response processes that helped cut nationwide cyberattacks by about 95%.",
                "Ran national VAPT, IT audit and risk programmes that found 500+ critical vulnerabilities.",
                "As Chief Coordinator at N-CERT, led audit of 23 critical infrastructures incl. the Tier-IV data centre (~65% compliance gain).",
                "Wrote national guidelines on VAPT, cloud security, Zero Trust and audits; set up the National Cyber Helpline."],
     "tags": ["CIRT", "Audit", "Policy"]},
    {"period": "Jan 2016 – Sep 2019", "role": "Managing Director · Information Security Consultant", "org": "NRD Bangladesh Ltd. / Norway Registers Development AS",
     "summary": "Directed national-scale cybersecurity programmes for the Government of Bangladesh.",
     "points": ["Led 8 national cybersecurity projects worth $10M+, including cyber sensors at 17 critical infrastructure sites.",
                "Delivered the national CIRT, its lab and the digital forensics lab.",
                "Led the national cybersecurity strategy with Oxford's GCSCC; project-managed VAPT of Bangladesh Bank's BACH-II.",
                "Ran the subsidiary's P&L, client acquisition and contract negotiation."],
     "tags": ["Programme leadership", "Strategy", "P&L"]},
    {"period": "Aug 2010 – Nov 2015", "role": "Technical Manager · Local Technical Expert & Trainer", "org": "Device Technologies · Verint Systems",
     "summary": "Security-intelligence, forensics and lawful-interception platforms for government agencies.",
     "points": ["Led an 8-person team deploying cyber-intelligence, digital forensics and lawful-interception systems.",
                "Trained government users on Verint security-intelligence platforms."],
     "tags": ["Forensics", "Team lead"]},
]

CERTIFICATIONS = [
    ("Leadership", ["EC-Council Certified CISO (C|CISO)"]),
    ("Governance, audit & privacy", ["ISO/IEC 27001 Senior Lead Auditor (PECB)", "ISO/IEC 27701:2025 Lead Auditor",
                                     "COBIT 5 (ISACA)", "ITIL Foundation"]),
    ("AI governance", ["ISO/IEC 42001:2023 AI Lead Auditor"]),
    ("Offensive security", ["Certified Ethical Hacker (CEH)", "Lead Pen Test Professional"]),
    ("Forensics & investigation", ["AccessData Certified Examiner (ACE)", "Certified Cyber Crime Examiner (3CE)"]),
    ("Financial crime", ["Certified Online Fraud Prevention Specialist (COFPS)"]),
    ("Education & delivery", ["Certified Cybersecurity Educator Professional (CCEP)", "Google Cybersecurity",
                              "Google Project Management"]),
    ("In progress", ["CISSP (ISC2)", "CISM (ISACA)"]),
]

# ---------------------------------------------------------------- skills at a glance
# Written for non-specialist readers (HR, hiring managers). "since" is the first year of hands-on work in
# that area, taken from EXPERIENCE and PROJECTS; it is shown as a duration, never as a proficiency score.
ROLES_FIT = [
    "CISO / Head of Information Security",
    "Director, Cybersecurity & GRC",
    "GRC or IT Risk Manager",
    "Security Programme Manager",
    "AI Governance Lead",
    "Lead Auditor, ISO 27001 / 42001",
]

SKILLS = [
    {"name": "Cyber strategy & policy", "icon": "compass", "since": 2016,
     "plain": "Turning cyber risk into a plan leadership can fund, and the policies to run it.",
     "keywords": ["Security strategy", "Roadmaps", "Policy writing", "Board reporting"],
     "proof": [("National cybersecurity strategy", "/projects/national-strategy"), ("Policies & publications", "/publications")]},
    {"name": "Governance, risk & compliance (GRC)", "icon": "gauge", "since": 2016,
     "plain": "Knowing your risks, owning them, and proving it to regulators and boards.",
     "keywords": ["Risk assessment", "Risk registers", "Third-party risk", "Regulatory compliance"],
     "proof": [("23 critical infrastructures audited", "/projects/tier4-audit"), ("Risk assessment service", "/services/cyber-risk-assessment")]},
    {"name": "Audit & certification", "icon": "check", "since": 2019,
     "plain": "Getting organisations certified, and keeping them audit-ready year after year.",
     "keywords": ["ISO 27001", "ISO 27701", "Internal audit", "Controls & evidence"],
     "proof": [("ISO 27001 Senior Lead Auditor (verify)", "cert:ISO/IEC 27001 Senior Lead Auditor (PECB)"), ("National IT audit programme", "/projects/national-vapt")]},
    {"name": "AI governance & AI security", "icon": "chip", "since": 2020,
     "plain": "Using AI safely, with rules that regulators, customers and auditors accept.",
     "keywords": ["ISO 42001", "NIST AI RMF", "EU AI Act", "AI risk assessment"],
     "proof": [("ISO 42001 AI Lead Auditor (verify)", "cert:ISO/IEC 42001:2023 AI Lead Auditor"), ("ML phishing research with IBM", "/projects/phishing-ml")]},
    {"name": "Incident response & security operations", "icon": "siren", "since": 2016,
     "plain": "Spotting attacks early and handling them calmly when they happen.",
     "keywords": ["Incident response", "CIRT / SOC", "SIEM & monitoring", "Playbooks & tabletops"],
     "proof": [("Bangladesh's first government CIRT", "/projects/national-cirt"), ("Early-warning sensors, 17 sites", "/projects/cyber-sensors")]},
    {"name": "Security testing", "icon": "target", "since": 2016,
     "plain": "Finding weaknesses before attackers do, and making sure they get fixed.",
     "keywords": ["Penetration testing (VAPT)", "Vulnerability management", "Remediation tracking"],
     "proof": [("Central-bank payment system VAPT", "/projects/bach-vapt"), ("500+ critical vulnerabilities found", "/projects/national-vapt")]},
    {"name": "Digital forensics & investigations", "icon": "shield", "since": 2010,
     "plain": "Working out what happened after an incident, with evidence that holds up.",
     "keywords": ["Digital forensics", "Evidence handling", "Cybercrime investigation"],
     "proof": [("National digital forensics lab", "/projects/forensics-lab"), ("Forensic platforms for government", "/projects/security-intelligence")]},
    {"name": "Fraud, AML & KYC", "icon": "bank", "since": 2024,
     "plain": "Stopping fraud and meeting FINTRAC rules without slowing the business down.",
     "keywords": ["AML / KYC", "FINTRAC", "Fraud prevention", "Identity verification"],
     "proof": [("Fraud Prevention Specialist (verify)", "cert:Certified Online Fraud Prevention Specialist (COFPS)"), ("Article: KYC needs an upgrade", "/insights/japan-just-showed-us-why-kyc-needs-an-upgrade")]},
    {"name": "Leadership, programmes & training", "icon": "users", "since": 2010,
     "plain": "Leading teams, budgets and delivery, and training people to run what gets built.",
     "keywords": ["Programme management", "$10M+ budgets", "Stakeholder management", "Training & teaching"],
     "proof": [("What colleagues say", "/recommendations"), ("National training programmes", "/projects/training")]},
]

FRAMEWORKS = ["ISO 27001", "ISO 27701", "ISO 42001", "NIST CSF 2.0", "NIST AI RMF", "EU AI Act", "COBIT",
              "ITIL", "PCI DSS", "ITSG-33", "FINTRAC", "OSFI B-10"]

# Public verification pages, taken from the "Show credential" links on LinkedIn.
CERT_VERIFY = {
    "ISO/IEC 27001 Senior Lead Auditor (PECB)": {"url": "https://www.credly.com/badges/38faefd6-efc2-49c6-85b3-f2efc0475a9f", "via": "Credly"},
    "ISO/IEC 27701:2025 Lead Auditor": {"url": "https://www.credly.com/badges/3f3b02e5-f61d-4867-9c55-d72bdb15e599", "via": "Credly"},
    "ISO/IEC 42001:2023 AI Lead Auditor": {"url": "https://www.credly.com/badges/ce7dd57c-1bdb-40e3-957e-2473525613dd", "via": "Credly"},
    "Certified Online Fraud Prevention Specialist (COFPS)": {"url": "https://academy.hackandfix.com/cert-verify/", "via": "Hack & Fix", "id": "6144-4302-2798-3540"},
    "Certified Cybersecurity Educator Professional (CCEP)": {"url": "https://courses.redteamleaders.com/exam-completion/c50ea715fb2fa694", "via": "Red Team Leaders"},
    "Google Cybersecurity": {"url": "https://www.coursera.org/account/accomplishments/specialization/PNCE92FAQ6S4", "via": "Coursera"},
    "Google Project Management": {"url": "https://www.coursera.org/account/accomplishments/specialization/XPWGKSW8UYK3", "via": "Coursera"},
    "Exam Development Volunteer": {"url": "https://www.credly.com/badges/2386cddc-b78c-4c67-b926-cf4c54da8e11", "via": "Credly"},
}

EDUCATION = [
    ("Master's, Electrical & Computer Engineering", "University of Ottawa · 2023 · Dean's Scholarship; IBM CAS Fellowship"),
    ("Program on Cyber Security Studies (PCSS)", "George C. Marshall European Center for Security Studies, Germany"),
    ("BSc, Electronics & Telecommunications Engineering", "Prime University, Dhaka · 2010"),
]

SERVICE = [
    ("C|CISO Exam Committee Member", "EC-Council · 2023 – Present"),
    ("Exam Development Volunteer", "ISC2 · 2023 – Present"),
    ("Safe and Secure Online Volunteer", "ISC2 · 2024 – Present"),
    ("Technology Mentor", "Connected Canadians, Ottawa · 2023 – Present"),
    ("Member", "OWASP · HTCIA · NICE/DoD Cybersecurity Workforce Group"),
]

# ---------------------------------------------------------------- services
SERVICES = [{'icon': 'compass',
  'name': 'Cyber strategy & programme leadership',
  'blurb': 'National and enterprise cyber strategies, roadmaps and multi-year security programmes, from '
           'business case to delivery.',
  'outcome': 'A strategy leadership can fund, and a programme that lands.',
  'slug': 'cyber-strategy',
  'seo_title': 'Cybersecurity Strategy & Programme Leadership Consultant',
  'meta': "Cybersecurity strategy, roadmaps and programme leadership from the co-author of Bangladesh's "
          'national cybersecurity strategy. Based in Ottawa, working across Canada.',
  'intro': "Strategy work that ends in a funded programme, not a slide deck. I co-led Bangladesh's national "
           'cybersecurity strategy and risk framework with the University of Oxford GCSCC, and spent five '
           'years building the government CIRT that put it into practice.',
  'included': ['Current-state and maturity assessment against NIST CSF 2.0 or ISO/IEC 27001',
               'Cyber strategy and multi-year roadmap tied to business and regulatory priorities',
               'Business case, budget and governance structure for the programme',
               'Programme set-up: PMO, milestones, KPIs and board reporting',
               'Policy and standards framework to support the strategy'],
  'projects': ['national-strategy', 'national-cirt', 'threat-landscape'],
  'insight_tags': ['Governance & Risk', 'AI Governance']},
 {'icon': 'siren',
  'name': 'Incident response & CIRT/SOC design',
  'blurb': 'Response capability, playbooks, early warning and tabletop exercises, from someone who helped '
           'build a national CIRT.',
  'outcome': 'A team that knows what to do in the first hour.',
  'slug': 'incident-response',
  'seo_title': 'Incident Response, CIRT & SOC Design Consultant',
  'meta': 'Incident response plans, playbooks, tabletop exercises and CIRT/SOC design from someone who '
          "helped build Bangladesh's first national government CIRT.",
  'intro': "Response capability built by someone who has run one. I helped build Bangladesh's first "
           'government CIRT, deployed early-warning sensors across critical infrastructure and set up a '
           'national cyber helpline.',
  'included': ['Incident response plan, roles and escalation paths',
               'Playbooks for ransomware, phishing, data breach and insider threats',
               'Tabletop exercises for executives and technical teams',
               'CIRT/SOC operating model, tooling and SIEM use cases',
               'Post-incident reviews and lessons learned'],
  'projects': ['national-cirt', 'cyber-sensors', 'cyber-helpline', 'forensics-lab'],
  'insight_tags': ['Security Operations']},
 {'icon': 'shield',
  'name': 'GRC, audit & privacy',
  'blurb': 'ISO 27001 and 27701 readiness and internal audits, NIST CSF and ITSG-33 alignment, policy sets.',
  'outcome': 'Evidence-ready controls, and no surprises at certification.',
  'slug': 'iso-27001-grc-audit',
  'seo_title': 'ISO 27001 Lead Auditor & GRC Consultant',
  'meta': 'ISO/IEC 27001 and 27701 readiness, internal audits and GRC programmes from a PECB ISO 27001 '
          'Senior Lead Auditor. NIST CSF and ITSG-33 alignment. Ottawa, Canada.',
  'intro': 'Readiness and audit work from an ISO/IEC 27001 Senior Lead Auditor who has audited critical '
           'infrastructure and Tier-IV data centres. The aim is controls that produce evidence on their own, '
           'so certification holds no surprises.',
  'included': ['ISO/IEC 27001 and 27701 gap assessment and readiness roadmap',
               'Scope, Statement of Applicability and risk treatment plan',
               'Policy set and control design that fits how you actually work',
               'Internal audit and management review before certification',
               'Mapping to NIST CSF 2.0, ITSG-33, SOC 2 and PCI DSS'],
  'projects': ['tier4-audit', 'national-vapt', 'national-cirt'],
  'insight_tags': ['Governance & Risk']},
 {'icon': 'gauge',
  'name': 'IT, third-party & infrastructure risk',
  'blurb': 'Enterprise, vendor and critical-infrastructure risk assessments in language leadership can act '
           'on.',
  'outcome': 'A risk register and treatment plan tied to business impact.',
  'slug': 'cyber-risk-assessment',
  'seo_title': 'Cyber Risk Assessment & Third-Party Risk Consultant',
  'meta': 'Enterprise, third-party and critical-infrastructure cyber risk assessments written for '
          'leadership: risk registers and treatment plans tied to business impact.',
  'intro': 'Risk assessments that leadership can act on. I developed national critical information '
           'infrastructure assessment methods and ran IT risk programmes for government agencies.',
  'included': ['Enterprise IT and cyber risk assessment',
               'Third-party and vendor risk reviews, including OSFI B-10 style due diligence',
               'Critical infrastructure and OT risk assessment',
               'Risk register, appetite statements and treatment plans',
               'Board-level risk reporting'],
  'projects': ['tier4-audit', 'national-strategy', 'national-vapt'],
  'insight_tags': ['Governance & Risk', 'Identity & Fraud']},
 {'icon': 'target',
  'name': 'Offensive security & VAPT',
  'blurb': 'Scoping and managing penetration tests and vulnerability programmes, through to remediation.',
  'outcome': 'Real exposure found and fixed, not just reported.',
  'slug': 'penetration-testing-vapt',
  'seo_title': 'Penetration Testing & VAPT Programme Management',
  'meta': 'Scoping and managing penetration tests and vulnerability assessment programmes, from central-bank '
          'payment systems to national VAPT, through to verified remediation.',
  'intro': 'Testing that ends with exposure fixed, not just reported. I managed vulnerability assessment and '
           "penetration testing of the Bangladesh central bank's payment system and a national VAPT "
           'programme for government.',
  'included': ['Scoping and rules of engagement for penetration tests',
               'Vendor selection and test management',
               'Vulnerability management programme design',
               'Remediation tracking and retesting',
               'Executive and technical reporting'],
  'projects': ['bach-vapt', 'national-vapt'],
  'insight_tags': ['Security Operations']},
 {'icon': 'chip',
  'name': 'AI governance',
  'blurb': 'ISO 42001 AI management systems, AI risk assessment and responsible-AI policy, aligned with NIST '
           'AI RMF and the EU AI Act.',
  'outcome': 'AI use you can explain to regulators and customers.',
  'slug': 'ai-governance-iso-42001',
  'seo_title': 'AI Governance & ISO 42001 Consultant',
  'meta': 'ISO/IEC 42001 AI management systems, AI risk assessment and responsible-AI policy aligned with '
          'NIST AI RMF and the EU AI Act, from an ISO 42001 AI Lead Auditor.',
  'intro': 'AI use you can explain to regulators, customers and your board. I am an ISO/IEC 42001 AI Lead '
           'Auditor and have written on AI governance, AI-enabled attacks and AI risk.',
  'included': ['ISO/IEC 42001 gap assessment and AI management system design',
               'AI inventory, risk and impact assessment',
               'Responsible-AI policy and acceptable-use rules',
               'Alignment with NIST AI RMF and the EU AI Act',
               'Controls for AI tools in meetings, data and development'],
  'projects': ['phishing-ml'],
  'insight_tags': ['AI Governance', 'AI Security']},
 {'icon': 'bank',
  'name': 'Financial crime & fraud controls',
  'blurb': 'AML/KYC and fraud-prevention control reviews against FINTRAC expectations.',
  'outcome': 'Control gaps mapped to regulatory requirements.',
  'slug': 'aml-kyc-fraud-controls',
  'seo_title': 'AML/KYC & Fraud Controls Review',
  'meta': 'AML/KYC and fraud-prevention control reviews against FINTRAC expectations, including identity '
          'verification in an age of leaked IDs and deepfakes.',
  'intro': 'Financial-crime controls reviewed by someone who sees them through a security lens: identity '
           'verification, account takeover and fraud, mapped against FINTRAC expectations.',
  'included': ['KYC and identity verification process review',
               'Fraud and account-takeover control assessment',
               'Mapping of control gaps to FINTRAC requirements',
               'Vendor review for identity and KYC providers',
               'Staff procedures for deepfake and social-engineering fraud'],
  'projects': ['bach-vapt'],
  'insight_tags': ['Identity & Fraud']},
 {'icon': 'users',
  'name': 'Training & capacity building',
  'blurb': 'Security training for executives, technical teams and law enforcement; curriculum and lab '
           'design.',
  'outcome': 'People who can run what gets built.',
  'slug': 'cybersecurity-training',
  'seo_title': 'Cybersecurity Training & Capacity Building',
  'meta': 'Cybersecurity training for executives, technical teams and law enforcement, plus curriculum and '
          'lab design, from national programmes to university courses.',
  'intro': 'Training that leaves teams able to run what was built. I have delivered national training '
           'programmes in Bangladesh and designed a cybersecurity lab for a university course.',
  'included': ['Executive and board cyber briefings',
               'Technical training for SOC, IR and audit teams',
               'Security awareness programmes',
               'Curriculum and hands-on lab design',
               'Train-the-trainer programmes'],
  'projects': ['training', 'national-cirt'],
  'insight_tags': ['Awareness']}]

# ISO 27001 readiness check: each answer is No (0) / Partly (1) / Yes (2).

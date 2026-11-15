---
title: "From Freezers to Flight Paths: What This Autumn's Cyberattacks Tell Us About Risk"
date: 2026-11-15
tags: [Governance & Risk, Security Operations]
summary: Five weeks, five attacks and one outage, from spoiled food in European supermarkets to a nationwide US ground stop. What actually happened, what the incidents share, and eight actions mapped to ISO 27001.
cover: from-freezers-to-flight-paths-cover
cover_alt: "From freezers to flight paths. Five weeks, five attacks, one outage. Known weaknesses, legacy systems, third-party access, no clear owner."
---

Five weeks. Spoiled food in hundreds of supermarkets, millions of web servers open to takeover, a trusted backup app turned into a master key, and every flight in the United States held on the ground.

An infographic doing the rounds on LinkedIn strings these together as one escalating chain of attacks, ending with "Who / What Next?". It is a good question. But the picture gets two things wrong. These are not one campaign. And the last item on it, as far as officials can tell, was not an attack at all.

That distinction matters. If we read every incident as "hackers are getting smarter", we will buy more tools. If we read them correctly, we will see something less dramatic and more fixable: in almost every case, the weakness was known, the fix existed, and nobody clearly owned the risk.

Here is what actually happened, what the incidents share, and what I would do about it this quarter.

## The five weeks at a glance

![Timeline, October 11 to November 13, 2026. October 11 to 12: refrigeration systems at about 700 French supermarkets forced into defrost, an attack. October 21: Microsoft attributes the ConnectWise Cloud Backup compromise to Storm-0940, an attack. October 21 to 26: PHP2Shell flaws patched, then confirmed exploited within days, an attack. November 1 to 2: second wave of refrigeration attacks in at least six European countries, an attack. November 10: Microsoft patches roughly 1,090 flaws and the only one already exploited is rated Moderate, an attack. November 13: FAA halts all US departures after an air traffic control network failure, with no evidence of an attack so far.](/static/img/insights/from-freezers-to-flight-paths-timeline.webp)

## 1. France: the night the freezers turned warm

Overnight on October 11–12, someone reached the controllers that manage refrigeration in French supermarkets and told them to defrost. Temperatures in some cases climbed to 50°C. Stores opened to spoiled stock, damaged equipment and, in a few locations, fires.

The French government put the total at about 700 supermarkets. Intermarché's parent group alone reported 300 compromised stores. Coopérative U, E.Leclerc and Monoprix were also hit. The Paris prosecutor opened a criminal investigation.

No malware was needed and no data was stolen. The attackers used the controllers the way a technician would, just with the opposite intent.

Three details make this a governance story more than a hacking story:

- **The warning was recent.** Claroty's Team82 published research on August 9 describing weaknesses in the Danfoss AK-SM 800A, including an authentication bypass. Investigators have not confirmed whether that flaw was the way in. Either way, operators had two months of notice that this class of device needed attention.
- **The devices were findable.** Shodan showed more than 4,500 Danfoss refrigeration systems exposed to the internet, over 1,500 of them in France.
- **The equipment was old.** Danfoss said the affected units were older systems it had already advised customers to upgrade. CERT-FR's alert also named Copeland and Dixell controllers.

I wrote about this the morning it happened. My point then still stands: the hardest conversations in incident response are rarely about sophisticated attackers. They are about systems everyone assumed belonged to someone else. Facilities. A contractor. "The vendor handles that."

## 2. Europe: the same attack, three weeks later

On the night of November 1–2 it happened again, this time across borders. More than 100 stores were hit in Belgium, the Netherlands, Sweden, Luxembourg, Ireland and Estonia. Carrefour said 15 of its 700 Belgian stores were affected. Danfoss said the method matched the French attack.

That is the part worth sitting with. Twenty-one days passed between CERT-FR's first alert and the second wave. The technique was not new. The advice, to take these controllers off the internet, was public. And the exposure was still there.

The damage also moved beyond supermarkets. According to SOCRadar's tracking, the second wave reached food businesses in 13 countries, three UK meat suppliers, and cold rooms at a contractor for France's national blood service, where set points were pushed to 110°C. In the US, the Pentagon is investigating refrigeration failures at several military commissaries, with the cause still unconfirmed.

On attribution, be careful. The pro-Russian hacktivist groups NoName057(16) and Z-Pentest claimed responsibility on November 3. The claim came weeks after the first wave and has not been verified. Authorities have not named anyone.

The European Commission, ENISA and Europol have since jointly urged organisations to remove internet access from remotely controlled refrigeration systems. Analysts estimate around 13,000 such systems in Europe still run vulnerable software.

## 3. PHP2Shell: the web's plumbing springs a leak

While Europe was counting spoiled food, a quieter emergency was running through the web itself.

On October 21, the PHP project released emergency patches for two critical flaws in the PHP engine, CVE-2026-109618 and CVE-2026-109619, together nicknamed PHP2Shell. Both score 9.2 on CVSS v4. They let an attacker run commands on a web server with a crafted request and no login.

The timeline moved fast:

- Exploit attempts were being logged within days of the patch.
- On October 26, CISA added both flaws to its Known Exploited Vulnerabilities catalog.
- Researchers then confirmed successful attacks on honeypot servers running an ordinary PHP site.
- A third flaw, CVE-2026-115560, was disclosed with mitigation advice but no patch.

The scale is the problem. Censys counted about 6.3 million hosts associated with PHP. And many servers still run PHP 5.4 through 7.3, versions that are end-of-life and will never receive a fix.

Read that last sentence again next to the refrigeration story. Different technology, same shape: internet-facing, widely deployed, and in part too old to patch. For those servers, "apply the update" is not an available answer. The honest options are migrate, isolate, or formally accept the risk.

## 4. The Microsoft ecosystem: three stories, one real lesson

"Attacks on Microsoft" on the infographic is really three separate events. I have covered two of them in depth, so here is the short version.

**The trusted app.** In October, Microsoft attributed the ConnectWise Cloud Backup compromise to the China-aligned group Storm-0940. The attackers did not need anyone's password. The backup app already held approved access to customer tenants, and an AI agent framework did the legwork: sign-in attempts against more than 2,250 Microsoft 365 tenants, with privileged access reached in under three hours in some cases. Full analysis: [Your Vendor's App Is Your New Perimeter](/insights/your-vendors-app-is-your-new-perimeter).

**The mis-ranked patch.** November's Patch Tuesday fixed roughly 1,090 vulnerabilities, 63 of them Critical. The only one attackers were already using was an Outlook flaw rated Moderate, CVSS 6.5. Any queue sorted by severity score put the live threat at the bottom. Full analysis: [The Only Exploited Flaw This Month Was Rated Moderate](/insights/only-exploited-flaw-rated-moderate).

**The outage that was not an attack.** Two days later, Microsoft 365 went down globally. Many posts blamed the Outlook zero-day. Microsoft said it was a network change that went wrong, not a cyberattack.

The lesson across all three is about signals. We trusted an app because it was approved once. We ranked a patch by a number that does not measure exploitation. We explained an outage with the nearest scary headline. Each time, the shortcut replaced the analysis.

## 5. Air traffic control: the attack that (so far) wasn't

On Friday, November 13, the FAA ordered a nationwide ground stop, only the second since September 11, 2001. Controllers were receiving inconsistent radar and communications data. Hundreds of flights were diverted or turned back, and Saturday's cancellations passed 6,000.

The infographic files this under "attacks". The evidence so far does not.

US officials say they have found no sign of a cyberattack, while noting they cannot fully rule one out. The Transportation Secretary's account is that a router being replaced during a copper-to-fibre migration began flooding other routers in the air traffic control network. The open question is contractor error versus faulty equipment. The investigation continues, so treat this as the current picture, not the final one.

I would still keep it in this article, for two reasons.

**First, the risk is real even if this incident was not an attack.** In September, South Africa's air navigation provider, ATNS, found ransomware-linked malware inside the operational technology network supporting weather services for air traffic control. In April, a US Department of Transportation audit of the FAA's high-impact systems warned they were exposed. A 2024 GAO review had already rated 105 of the FAA's 138 air traffic control systems unsustainable.

**Second, the failure looks the same from the runway.** A legacy system, a change made by a third party, and no graceful way to fail. Whether the trigger is an attacker or a router swap, the resilience question is identical: when this system misbehaves, what happens next, and who decides?

Risk is not only about threat actors. Fragility does the same damage without one.

## What the infographic left out

Two incidents from the same weeks belong in the picture, because they hit the sector at the top of the "who's next" list: financial services.

- **Japan's identity leak.** Japan declared its first state of emergency in cyberspace after a breach exposed millions of ID images. For any organisation still relying on photo-and-selfie KYC, the raw material for impersonation is now in circulation. I covered this in [Japan Just Showed Us Why KYC Needs an Upgrade](/insights/japan-just-showed-us-why-kyc-needs-an-upgrade).
- **The Binance heist.** The FBI has flagged more than 600 crypto addresses tied to a North Korea-linked theft from Binance. As of November 5, about $3.18 billion was sitting in theft-linked addresses across 11 blockchains.

So banking is not "next". It is already on the list.

## The common thread

These incidents have different actors, different technology and different motives. What they share is on the defender's side.

| Incident | Known weakness beforehand | Legacy or unpatchable | Third party in the chain |
| --- | --- | --- | --- |
| Refrigeration, France and Europe | Research published in August; CERT-FR alert before wave two | Older controllers the vendor had advised replacing | Installed and managed by refrigeration contractors |
| PHP2Shell | Patch available October 21 | PHP 5.4–7.3 will never be fixed | Hosting providers and bundled software |
| ConnectWise / Microsoft 365 | OAuth app abuse is a well-documented technique | Standing permissions granted once, never reviewed | A backup vendor's multi-tenant app |
| Outlook zero-day | Listed as exploited on patch day | Not applicable | Not applicable |
| FAA ground stop (not an attack) | Audits in 2024 and April 2026 | Ageing network backbone | Contractor-run migration |

Four patterns come out of that table.

1. **The warning usually arrives first.** In nearly every case, a researcher, vendor or auditor had already described the weakness. The gap was between knowing and acting.
2. **Old technology is now a standing risk decision.** When a system can no longer be patched, keeping it online is a risk acceptance. It should be signed by someone with the authority to accept it.
3. **Your perimeter includes other people's work.** A contractor's controller, a vendor's app, a hosting stack. Access you granted once is access an attacker can inherit.
4. **Nobody owned it.** Refrigeration sits with facilities. Web servers sit with a hosting provider. Connected apps sit with whoever clicked "Accept". When ownership is unclear, the risk register is silent and the first report comes from the incident.

None of this is about attackers evolving. The threats in the title are evolving less than our attack surface is.

## Who or what is next?

Nobody can predict the next target. But we can rank sectors by how closely they match the pattern above: internet-reachable operational systems, old equipment, and third parties holding the keys. This is my assessment, not a forecast.

| Sector | Why it fits the pattern | What to check first |
| --- | --- | --- |
| Healthcare and pharma cold chain | Uses the same class of refrigeration controllers; a blood service contractor was already hit | Are cold rooms and lab freezers reachable from the internet? |
| Food logistics and manufacturing | Same equipment, upstream of the stores; UK meat suppliers were hit in wave two | Who patches controllers a contractor installed? |
| Commercial buildings (HVAC, access, lifts) | Building management systems share the remote-access model and the ownership gap | Is building technology in the IT asset inventory? |
| Energy and water | CERT-FR has issued hardening guidance for these operators; exposed industrial control systems have been targeted this year | Is remote access to control systems behind a VPN with MFA? |
| Transport and aviation | Legacy systems, contractor-run change, and low tolerance for downtime | Can a failed change be isolated without stopping operations? |
| Banking and financial services | Already under attack through identity and vendor access, not through OT | Which third-party apps hold standing access to the tenant? |
| Government services | Large estates of older public web applications, often on PHP | Which public sites run an end-of-life runtime? |

The order matters less than the question in the right-hand column. If you cannot answer yours within a day, that is the finding.

## What to do this quarter

None of these need a new product. Most need a decision and an owner.

| Action | What it closes | ISO/IEC 27001:2022 |
| --- | --- | --- |
| Put building and operational technology in the same asset inventory as IT, with a named owner for each | The "someone else's system" gap | A.5.9 |
| Scan your own internet-facing footprint for controllers, admin panels and end-of-life software | Exposure you did not know you had | A.8.8, A.8.9 |
| Take control interfaces off the public internet; allow remote access only through VPN with MFA | The exposure behind both refrigeration waves | A.8.20, A.8.22, A.8.5 |
| Write patching and security responsibilities into contractor and vendor agreements | "The vendor handles that" | A.5.19, A.5.20, A.5.22 |
| Review every third-party app with standing access to your cloud tenant | Inherited compromise through a vendor | A.5.19, A.5.23 |
| Prioritise patches by exploitation first, severity second | Live threats ranked at the bottom of the queue | A.8.8 |
| Record every unpatchable system as a formal risk acceptance with an expiry date | Legacy risk nobody signed for | Clauses 6.1.3 and 8.3 |
| Rehearse an incident where the impact is physical: spoiled stock, a closed site, a stopped service | Response plans that only cover data | A.5.24, A.5.30 |

If I had to pick one, it is the first. You cannot segment, patch or insure what is not on the list.

## The real answer to "who's next?"

The infographic asks who or what is next. After these five weeks, I think that is the wrong question, because it has no answer you can act on.

The useful question is narrower. What do we run that is reachable, old, or managed by someone else, and who has signed for that risk?

A month ago I wrote that resilience is sometimes about protecting dinner. Since then it has also been about protecting websites, mailboxes, blood supplies and departure boards. The systems change. The question does not: does anyone own this?

---

## Sources

**Refrigeration attacks**

- [eSecurity Planet: French supermarket refrigeration attack](https://www.esecurityplanet.com/threats/news-emea-french-supermarket-refrigeration-cyberattack-2026/)
- [CPO Magazine: Danfoss controllers and exposure figures](https://www.cpomagazine.com/?p=42448)
- [OCCRP: Hackers Turn French Supermarket Refrigerators Into Furnaces](https://www.occrp.org/en/news/hackers-turn-french-supermarket-refrigerators-into-furnaces)
- [Dark Reading: Fresh European Fridge Attacks Put Cold-Chain Security in Focus](https://darkreading.com/ics-ot-security/fresh-european-fridge-attacks-cold-chain-security)
- [SecurityWeek: Over 100 European stores hit as fridge attacks resume](https://securityweek.com/over-100-european-stores-hit-as-supermarket-fridge-attacks-resume/amp/)
- [SOCRadar: Critical infrastructure, freezers and OT](https://socradar.io/blog/critical-infrastructure-freezers-ot/)
- [Cybernews: Hacktivist claims of responsibility](https://cybernews.com/security/russian-hackers-hacked-european-refrigeration-systems/)
- [XenoSpectrum: Second wave timeline](https://xenospectrum.com/en/danfoss-freezer-cyberattack-second-wave/)

**PHP2Shell**

- [BankInfoSecurity: PHP2Shell actively exploited, CISA warns](https://www.bankinfosecurity.com/php2shell-actively-exploited-us-cybersecurity-agency-warns-a-33219)
- [BleepingComputer: PHP2Shell flaws exploited in the wild](https://www.bleepingcomputer.com/news/security/php2shell-security-flaws-now-sucessfully-exploited-in-the-wild/amp/)
- [Cybernews: 32.5 million services remain vulnerable](https://cybernews.com/security/php-exploitation-32-million-servers-vulnerable/)
- [Kaspersky: PHP2Shell two weeks after patches](https://www.kaspersky.com/blog/php2shell-two-weeks-after-patches/56647/)

**Microsoft**

- [Dark Reading: November Patch Tuesday](https://darkreading.com/vulnerabilities-threats/november-patch-tuesday-cornucopia-cves)
- [SecurityWeek: Exploited Outlook zero-day among flaws patched](https://securityweek.com/exploited-outlook-zero-day-among-1094-flaws-patched-by-microsoft)

**Air traffic control**

- [CBS News: FAA lifts nationwide ground stop](https://www.cbsnews.com/news/faa-issues-nationwide-ground-stop/)
- [NBC News: Thousands of flights cancelled after ground stop](https://www.nbcnews.com/news/us-news/faa-orders-nationwide-ground-stop-departing-flights-reasons-safety-rcna609247)
- [SecurityWeek: FAA ground stop, no signs of cyberattack](https://www.securityweek.com/faa-ground-stop-issued-due-to-extraordinary-circumstances/)
- [Dark Reading: South Africa seeks help after ATC cyberattack](https://darkreading.com/cyberattacks-data-breaches/south-africa-help-cyberattack-air-traffic-control)
- [AeroXplorer: Federal watchdog audit of FAA systems](https://aeroxplorer.com/articles/federal-watchdog-warns-americas-air-traffic-control-systems-are-wide-open-to-cyberattack)

**Other**

- [MaxwellCTI Digest, November 3–9: Binance heist figures](https://buttondown.com/WiseGuru/archive/maxwellcti-digest-weekly-november-3-9-2026/)

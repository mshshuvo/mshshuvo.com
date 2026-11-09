---
title: "Your Vendor's App Is Your New Perimeter: What the ConnectWise AI Attack Means for Canadian Organizations"
date: 2026-11-08
tags: [AI Security, Governance & Risk, AI Governance]
summary: An AI agent helped attackers try more than 2,250 Microsoft 365 tenants through a backup app their victims already trusted. What happened, why it matters in Canada, and a 7-step checklist mapped to ISO 27001 and ISO 42001.
cover: your-vendors-app-is-your-new-perimeter-cover
cover_alt: "Your vendor's app is your new perimeter. Agentic AI, trusted access, hours not days."
---

In October 2026, attackers didn't break through anyone's firewall. They logged in through a backup app their victims had already trusted, and an AI agent did most of the legwork.

The ConnectWise Cloud Backup compromise, attributed by Microsoft to the China-aligned group Storm-0940, is the clearest sign yet that the perimeter has moved. It is no longer your network edge. It is every third-party application you have granted access to your cloud tenant. And with agentic AI in the attacker's toolkit, the window between "targeted" and "compromised" is now measured in hours.

Here is what happened, why it matters for Canadian organizations, and what security and risk leaders should do this quarter.

## What happened

Storm-0940, a data-theft-focused group active since 2021, used an AI penetration-testing framework called ARTEX to run a campaign against hundreds of organizations starting in September 2026. Its biggest win came through ConnectWise Cloud Backup, a multi-tenant app that many organizations connect to Microsoft 365.

Once the attackers had the app's credentials, they didn't need anyone's password. The app already held approved access to customer tenants, so the attackers used it to reach email and files through Microsoft Graph.

| Date (2026) | Event |
| --- | --- |
| Oct 21 | Microsoft publishes its analysis attributing the compromise to Storm-0940; ConnectWise acknowledges the findings |
| Oct 17 | ConnectWise suspends the affected Cloud Backup services |
| Oct 14 | A four-day password-spraying run against 327 Microsoft 365 accounts at eight organizations ends, with no successful logins |
| September | Storm-0940 begins using ARTEX against organizations across many industries |

The numbers are what make this stand out: Storm-0940 attempted sign-ins to more than **2,250 tenants** at roughly **2,900 attempts per minute**, and in several cases reached privileged cloud access **in under three hours** from first targeting.

## Why it's different: attacks at machine speed

None of the techniques were new. Reconnaissance, password spraying and OAuth app abuse are all familiar. What changed is that an AI agent chained them together and repeated them across thousands of targets with little human direction.

The Canadian Centre for Cyber Security made the same point in its recent threat bulletin on agentic AI. Attacks are not fully autonomous yet: people still pick targets and oversee operations. But more of the work now runs on its own, and that shrinks the time defenders have to notice and react.

The Cyber Centre's bigger worry is not one group or one campaign. It is a reusable framework that lets any capable actor run operations at industrial scale. Today's AI-driven activity is noisy. The Centre expects it to become quieter, more targeted and harder to detect.

For defenders, the practical consequence is simple. If your detection, escalation and containment process assumes you have a day or two, it is already too slow.

## The governance gap: trust nobody is reviewing

The real lesson of ConnectWise is about governance, not tooling. Most organizations have dozens, sometimes hundreds, of third-party apps connected to Microsoft 365 or Google Workspace. Each one was approved once, often by an admin clicking "Accept" during setup, and then forgotten.

Those apps hold standing access. They don't trigger MFA prompts. They don't show up in user sign-in reviews. And when a vendor is compromised, every customer that granted the app access inherits the problem.

This creates three blind spots that traditional third-party risk programs tend to miss:

- **Questionnaires don't see tokens.** Vendor assessments check a supplier's policies and certifications, not the permissions its app holds inside your tenant.
- **Access outlives the need.** Permissions granted for a pilot or a one-time migration often stay in place for years.
- **Revoking the app isn't enough.** Attackers can add their own credentials to other applications, keeping access after the original connection is disabled.

In other words, your vendor inventory and your OAuth app inventory are two different lists. Most organizations only manage the first one.

## A 7-point checklist for Canadian organizations

These steps build on the Cyber Centre's recommendations. Most can start this month without new tools.

1. **Inventory every third-party app with tenant access.** Export the enterprise applications and service principals from Microsoft Entra ID (or the Google Workspace equivalent). Note who owns each one, what permissions it holds and when it was last used.
2. **Cut permissions down to what is actually needed.** Remove apps nobody uses. Downgrade broad grants such as full mailbox or file read access where a narrower scope will do. Require admin approval for any new app consent.
3. **Enforce phishing-resistant MFA for admins and remote access.** Use FIDO2 security keys or passkeys for privileged accounts. Password spraying only works when a password alone can open the door.
4. **Watch for changes to apps, not just users.** Alert on new credentials or secrets added to applications, new consent grants and unusual Graph API activity. Keep those logs long enough to investigate.
5. **Pre-authorize containment.** Decide now who can disable an app, revoke tokens or isolate a tenant at 2 a.m. without waiting for a meeting.
6. **Rehearse an incident that unfolds in hours.** Run a tabletop where a trusted vendor app is compromised on a Friday evening. Time each step from detection to containment.
7. **Protect your backups from your backup vendor.** Keep at least one tested copy that is offline or under separate credentials, so a compromised backup service can't become a path to your data.

Public sector teams have an extra reason to move: Treasury Board's new direction on cyber readiness in the frontier AI era took effect on October 1, 2026. Critical infrastructure operators should also expect tougher program requirements under the Critical Cyber Systems Protection Act, enacted through Bill C-8 in June 2026.

## Where this fits in ISO/IEC 27001

If you already run an ISO/IEC 27001:2022 management system, you don't need a new framework. The controls already exist. The gap is usually in how narrowly they get applied, with supplier controls covering contracts while nobody looks at the app's actual permissions.

| Checklist step | Annex A controls | What auditors should look for |
| --- | --- | --- |
| 1. App inventory | 5.9 Inventory of assets; 5.23 Cloud services | Third-party apps and service principals listed as assets, each with an owner |
| 2. Least privilege | 5.15 Access control; 5.18 Access rights | Periodic review of app permissions, not just user accounts |
| 3. Phishing-resistant MFA | 8.2 Privileged access; 8.5 Secure authentication | Strong authentication enforced for every admin and remote path |
| 4. App-level monitoring | 8.15 Logging; 8.16 Monitoring | Alerts on credential and consent changes to applications |
| 5. Pre-authorized containment | 5.24 Incident planning; 5.26 Incident response | Named decision-makers and authority to act without delay |
| 6. Hours-scale exercises | 5.24 Incident planning; 5.30 ICT readiness | Tabletop records with timings and lessons learned |
| 7. Independent backups | 8.13 Backup; 5.19–5.22 Supplier security | Restore tests that don't depend on the backup vendor's credentials |

The audit question to start asking: "Show me every application with access to our tenant, who approved it, and when its permissions were last reviewed." If that takes more than an afternoon to answer, you've found your first finding.

## Your own AI agents need the same scrutiny: ISO/IEC 42001

The attacker's AI is outside your control. Your own AI is not. Many organizations are now connecting copilots, AI assistants and autonomous agents to email, files and business systems, often through the same OAuth consent flow that ConnectWise used.

An AI agent with broad tenant permissions is just another third-party app, except it acts on its own and its behaviour is harder to predict. If its vendor or its credentials are compromised, an attacker inherits an assistant that already knows how to search your data.

ISO/IEC 42001:2023, the management system standard for AI, gives you a structure for governing this. Its Annex A objectives line up well with the checklist above:

| ISO/IEC 42001 Annex A objective | What it means for AI agents in your tenant |
| --- | --- |
| A.4 Resources for AI systems | Inventory every AI tool and agent, including the data sources and connectors it uses |
| A.5 Assessing impacts of AI systems | Assess what an agent could reach or do if it were misused or compromised, before you approve it |
| A.6 AI system life cycle | Define how agents are approved, monitored, logged and retired, not just how they are deployed |
| A.9 Use of AI systems | Limit each agent to its intended use, with the narrowest permissions that support it |
| A.10 Third-party and customer relationships | Set clear responsibilities with AI vendors for security, incident notice and access revocation |

The two standards work best together. ISO/IEC 27001 secures the access, and ISO/IEC 42001 makes sure someone has decided what each AI system should be allowed to do in the first place. For organizations rolling out AI agents in 2026, that pairing is quickly becoming the baseline.

## The bottom line

AI didn't create a new kind of attack in October. It made an old weakness, trusted third-party access, exploitable at a speed most response plans were never built for. The organizations that fare best won't be the ones with the most tools. They will be the ones that know exactly which apps can reach their data and can switch any of them off within minutes.

Start with the inventory. Everything else depends on it.

## Want to check where you stand?

My free readiness checks take about two minutes each and give you a score plus the first fix for every gap. No sign-up needed.

- [ISO 27001 readiness](/assessment/iso-27001) covers access control, supplier security and incident response.
- [ISO 42001 AI governance](/assessment/iso-42001) covers AI policy, risk, impact and third-party AI.
- [Ransomware and incident readiness](/assessment/ransomware) covers backups, MFA, detection and your response plan.

If you'd like a third-party app access review for your Microsoft 365 or Google Workspace tenant, [get in touch](/contact).

## Sources

- [Canadian Centre for Cyber Security: Cyber threat bulletin, agentic AI is accelerating cyber attacks](https://www.cyber.gc.ca/sites/default/files/cyber-threat-bulletin-agentic-ai-accelerating-cyber-attacks.pdf)
- [CyberScoop: Microsoft pins ConnectWise supply-chain attack to China-aligned group](https://www.cyberscoop.com/microsoft-attributes-connectwise-supply-chain-attack-china-storm-0940/)
- [Infosecurity Magazine: Chinese state actor used AI to compromise ConnectWise tenants](https://infosecurity-magazine.com/news/microsoft-chinese-ai-connectwise)
- [Dark Reading: Microsoft links Storm-0940 to ConnectWise supply chain attack](https://darkreading.com/cyberattacks-data-breaches/microsoft-storm-0940-connectwise-supply-chain-attack)
- [SC Media: Microsoft links agentic AI to ConnectWise supply chain breach](https://www.scworld.com/brief/microsoft-links-agentic-ai-to-connectwise-supply-chain-breach)
- [eeNews Europe: Microsoft links ConnectWise supply chain attack to AI agents](https://www.eenewseurope.com/en/connectwise-supply-chain-attack-ai-agents/)
- [Treasury Board of Canada: Direction on cyber security readiness in the frontier AI era](https://www.canada.ca/en/government/system/digital-government/policies-standards/spin/direction-government-canada-cyber-security-readiness-frontier-artificial-intelligence-era.html)
- [Public Safety Canada: Royal Assent of Bill C-8](https://www.publicsafety.gc.ca/cnt/ntnl-scrt/cbr-scrt/index-fr.aspx)

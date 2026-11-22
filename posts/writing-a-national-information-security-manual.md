---
title: "Writing a National Information Security Manual: Lessons from GOBISM, Ten Years On"
date: 2026-11-22
tags: [Governance & Risk]
summary: "In 2016 I prepared the Government of Bangladesh Information Security Manual (GOBISM). How it was built, the design decisions behind it, and what still holds up a decade later."
cover: writing-a-national-information-security-manual-cover
cover_alt: "Three GOBISM design decisions: benchmark widely and adopt the right fit, flexibility without loopholes, and accreditation that expires"
---

In 2016, I prepared the **Government of Bangladesh Information Security Manual (GOBISM)** for Bangladesh Computer Council (BCC), as part of the BGD e-GOV CIRT project, *Development of Information Security Policies, Standards, and National Computer Incident Response Team (CIRT) Implementation*. Version 1.5 was finalized in February 2016 and is publicly available from BGD e-GOV CIRT.

Ten years later, the technology has changed a lot. The governance problems a national manual has to solve mostly haven't. This article covers how the manual was put together, the design decisions I'd defend today, and what I'd do differently if I were writing it now.

📄 **Read the manual:** [GOBISM v1.5 (PDF), cirt.gov.bd](https://www.cirt.gov.bd/media?id=.pdf/GOBISM.pdf)

---

## The problem: one baseline for a whole government

A national information security manual has an unusual audience. It has to work for a ministry with a mature IT team and for a small agency where "IT" is one person. It has to be strict enough to mean something, but practical enough that agencies don't quietly ignore it.

GOBISM sets out the principles and controls for **unclassified government information and systems**. It applies to government departments, agencies and organizations, and private-sector organizations are encouraged to use it as well. Classified information was deliberately left out of scope, because it needs its own controls set at the appropriate level.

One more design point mattered: the manual itself is not a law. Its controls can be made binding through legislation or government direction. That kept the document focused on *what good security looks like* and left *how it's enforced* to the policy process.

---

## Decision 1: Benchmark widely, then adopt the right fit

Before writing a single control, I reviewed the national information security manuals and frameworks of the **UK, Australia, the European Union, the United States and New Zealand**.

All of them were strong, but most were written for countries with mature, well-funded programs. A framework that assumes a decade of institutional maturity doesn't transfer well to a government that is setting up its first national CIRT.

New Zealand's Information Security Manual (NZISM) was the closest match to where Bangladesh was then. Its structure was clear, it was practical, and it was written for a government of manageable scale. So GOBISM follows the NZISM framework and control structure and is aligned with **ISO/IEC 27001:2013 and ISO/IEC 27002:2013**. That alignment means auditors, vendors and future certification efforts work from a vocabulary they already know.

Supporting standards were brought in where they fit:

- **ISO/IEC 27005** for information security risk management
- **ISO 22301** for business continuity
- **ISO 31000 and ISO Guide 73** for risk terminology
- **IODEF** for structured incident reporting

**The lesson:** the best framework is the one that matches your maturity, not the most famous one. Benchmarking widely is how you find out which one that is.

---

## Decision 2: Mandatory vs. recommended, with accountability built in

Every security baseline runs into the same tension. If you make everything mandatory, agencies treat the manual as impossible and ignore it. If you make everything optional, nothing changes.

GOBISM handles this with two classes of control:

- **Mandatory controls** are essential to manage the identified risk. An agency can depart from one only if it's demonstrably not relevant, or with a **documented risk assessment and a formal dispensation** from the Accreditation Authority, **reviewed at least annually**.
- **Recommended controls** can be skipped, but the **residual risk must be formally acknowledged**.

The point is that non-compliance is allowed, but it can't be invisible. Someone with authority has to sign for the risk, and that decision comes back up for review every year.

This is the part I'd keep without changes. It's the same principle mature GRC programs rely on today: risk acceptance is a decision with an owner, not a default.

---

## Decision 3: Separate certification from accreditation, and let accreditation expire

GOBISM separates two roles that often get blurred:

- **Certification** is the technical assessment of whether a system's controls are implemented. By default, the CISO does this.
- **Accreditation** is the business decision to accept the remaining risk and let the system operate. The agency head or their delegate does this.

Systems must be accredited **before going into operation**, and **accreditation lapses after three years**.

Keeping the two apart keeps the technical opinion honest and puts the risk decision with the person accountable for the agency's mission. The expiry date makes security a recurring commitment rather than a one-time approval.

---

## Clear roles and a documentation hierarchy

A manual can't work if nobody knows who owns what. GOBISM defines responsibilities for five roles:

| Role | Core responsibility |
|---|---|
| **Agency Head** | Accountable for the agency's information security and for accreditation decisions |
| **CISO** | Leads the security program; certifies systems by default |
| **IT Security Managers (ITSM)** | Day-to-day security management; first point for incident reports |
| **System Owners** | Responsible for the security of specific systems |
| **System Users** | Follow policy and report incidents |

It also sets out a **documentation hierarchy**, so agencies know which documents they need and how those documents relate to each other:

1. **Security Policy (SecPol)**: agency-level intent and rules
2. **Security Risk Management Plan (SRMP)**: how the agency identifies and treats risk
3. **System Security Plan (SecPlan)**: controls for a specific system
4. **Site Security Plan (SitePlan)**: physical and site-level controls
5. **Standard Operating Procedures (SOPs)**: how the work actually gets done
6. **Incident Response Plan (IRP)**: what happens when things go wrong

---

## Incident handling: built for a national CIRT

Because GOBISM was written alongside the national CIRT initiative, incident handling is a core part of it. It covers:

- **mandatory reporting** of incidents to the agency's ITSM
- **escalation of significant incidents to BCC**
- **incident registers**, so patterns can be seen over time
- defined procedures for **data spills**

Supporting annexes cover an impact classification system, threat vector analysis, cause analysis, IRP creation and access-control event logging. These are practical tools that help a less experienced team apply the manual consistently.

---

## Scope: from cables to cloud

Beyond governance, the manual covers the controls that make policy real:

- physical, personnel and infrastructure security
- product security, patching, and secure decommissioning and media sanitization
- software security, including standard operating environments and application whitelisting
- email security, access control, privileged access and event logging
- cryptography (TLS, SSH, S/MIME, OpenPGP, IPsec and key management)
- network security, from firewalls and gateways to wireless and IP telephony
- working off-site, mobile devices and BYOD
- enterprise topics including **cloud computing and virtualization**, which were still emerging concerns for many governments in 2016

---

## What I'd change if I wrote it today

A decade on, I'd keep the governance model and update the threat and technology assumptions:

- **Zero trust as a design principle.** The 2016 model leans on network perimeters, gateways and firewalls. Today I'd frame access control around identity, device posture and continuous verification.
- **Cloud-first, not cloud as an annex.** Cloud and SaaS are now the default delivery model. Shared-responsibility guidance belongs in the core controls.
- **Supply chain and third-party risk.** Recent supply-chain attacks have made vendor and software assurance a central concern, not a procurement footnote.
- **Ransomware resilience.** Backup isolation, recovery testing and executive-level incident exercises deserve explicit, mandatory controls.
- **AI systems.** A modern manual needs a position on the security and governance of AI tools that agencies are already using.

---

## The takeaway

Frameworks age and technology moves on. The principles that made GOBISM work haven't changed:

1. **Fit the framework to the organization's maturity.**
2. **Allow flexibility, but make every risk acceptance visible and owned.**
3. **Separate the technical opinion from the business decision.**
4. **Treat approval as something that expires.**

These apply whether you're building a national baseline, an enterprise ISMS or a security program for a small regulated business.

---

*Sabbir Hossain is a cybersecurity and GRC professional based in Ottawa, and an ISO/IEC 27001 Senior Lead Auditor. He prepared the Government of Bangladesh Information Security Manual and has worked on national CIRT establishment, information security policy, and risk and compliance programs across the public and financial sectors. [Get in touch](/contact).*

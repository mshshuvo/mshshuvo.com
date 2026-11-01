---
title: Japan Just Showed Us Why KYC Needs an Upgrade
date: 2026-10-26
tags: [Identity & Fraud, Governance & Risk]
summary: Japan's first cyberspace state of emergency leaked millions of ID images. What that means for photo-and-selfie KYC, the stronger methods replacing it, and the policy changes that matter more.
canonical_url: https://www.linkedin.com/pulse/japan-just-showed-us-why-kyc-needs-upgrade-md-sabbir-hossain-xrkcc/
cover: japan-just-showed-us-why-kyc-needs-an-upgrade-cover
cover_alt: "Hit Japan: government declares state of emergency in cyberspace"
---

## What happened

On October 9, Japan declared its first-ever "state of emergency in cyberspace."

Ransomware attacks had hit the country one after another. A breach at IDC Frontier, a cloud provider owned by SoftBank, spread to 495 client organizations. Rail operators, retailers, and a securities firm reported customer data exposed. Reports estimate personal information tied to more than 14 million people was affected.

The breach that matters most for KYC isn't the largest one. It's Times Car, a car rental service. In late September it disclosed that data on 6.6 million members had been exposed, including **images of driver's licences and other ID documents.**

Within days, Japan's Financial Services Agency told banks that a driver's licence should **no longer be accepted as the only form of identity verification.** Banks were pointed to chip-based IDs instead.

A regulator told banks that the most common ID document in the country can't be trusted on its own anymore, because millions of pictures of it are now in criminal hands.

## Why this breaks today's KYC

Most KYC today works one of two ways.

**The app method:** the customer photographs their ID in an app, then takes a selfie or does a quick liveness check, like blinking or turning their head. The system compares the face on the ID to the selfie.

**The manual method:** the customer takes a photo of their ID and a selfie on their phone, then emails both to the institution. A staff member looks at them and approves the account.

Both assume a picture of an ID is hard to get. It isn't anymore.

When millions of ID images leak, a criminal doesn't need to forge a document. They already have a real one. Add AI tools that can produce a convincing face, voice, or video, and the selfie or liveness step gets weaker too.

The manual email method has even more problems:

- **There's no liveness check at all.** A selfie sent by email could be an old photo, an edited image, or an AI-generated face.
- **The ID images stay in inboxes.** They get forwarded, saved to shared drives, and kept for years, often with no clear deletion rule. I've seen institutions where years of customer passport scans sat in a shared inbox.
- **Email accounts get breached.** One compromised staff mailbox can expose every customer ID ever sent to it.
- **People can't reliably spot fakes.** A staff member checking dozens of images a day can't detect a well-made AI edit by eye.

In other words, the email method creates exactly the kind of ID image collection that made the Times Car breach so damaging.

Japanese officials say AI is making attacks faster and removing the language barrier that used to protect Japanese organizations. This isn't a Japan-only problem. Canadian institutions rely on both of these methods every day, and ID data leaks here too. Japan just had to face it all at once.

**KYC 1.0 asked: "Do you have the document?"**

**KYC 2.0 has to ask: "Can you prove you're the real person, right now, in a way that can't be copied?"**

## The new forms of KYC

**Chip-based document verification.** The customer taps their passport against their phone, and the app reads the chip and checks its cryptographic signature. A stolen photo can't pass this check. Canadian passports already have chips, and most modern phones can read them.

**Digital identity wallets and mobile licences.** Government-issued digital IDs on a phone, built on standards like ISO 18013-5. The EU is rolling out digital identity wallets, and several US states issue mobile driver's licences. The institution gets a signed answer from the issuer, not an image someone could have copied.

**Bank-based and reusable identity.** The customer confirms who they are by logging into an institution that already verified them. Interac's verification service works this way in Canada. One strong check gets reused.

**Prove, don't share.** Newer digital ID models let a customer prove a single fact, like "over 18" or "resident of Ontario," without handing over the whole document. Less data collected means less data to leak.

**Liveness detection built for deepfakes.** "Blink and turn your head" isn't enough anymore. Liveness tools now need to detect video injected straight into the camera feed, not just a photo held up to the lens.

**Behavioural and device signals.** How someone types, holds their phone, and moves through an app, plus device history and SIM-swap checks. Customers don't notice these, and they're hard to fake at scale.

**Perpetual KYC.** Instead of reviewing customers every one to three years, profiles update when risk changes: a new device, an address change, unusual transactions, or an identity appearing in breach data.

None of these is perfect alone. The strength comes from combining them.

## The policy changes that matter more

New tools won't help if the policy still treats a photo of an ID as proof.

**1. Treat image-only verification as low assurance.** A document photo plus selfie should be enough only for lower-risk products and limits. Higher-risk accounts need a stronger method. This is effectively what Japan's regulator just did.

**2. Define assurance levels, not just acceptable documents.** Most KYC policies list which documents are accepted. Few say how strongly each must be verified for each product or risk rating. That gap is where weak checks get through.

**3. Collect less, keep less, and end email-based ID collection.** Every stored passport scan is a future breach. The Times Car data was useful to criminals because it existed. Policy should define what ID data is kept, why, for how long, and who can access it. Where regulation allows, store the verification result, not a folder of images. If customers still email ID photos, move to a secure upload channel with automated verification, and delete the images already sitting in mailboxes.

**4. Add an identity breach response.** When a major ID dataset leaks, yours or someone else's, assume some customers' details are now in criminal hands. Flag affected identities, add verification for sensitive actions, and re-verify high-risk accounts.

**5. Hold KYC vendors to a higher standard.** Identity vendors often hold millions of ID images from many institutions. Japan showed how one provider's breach can hit hundreds of organizations. Due diligence should cover data location, retention, sub-processors, breach notice timelines, and audit rights. OSFI's Guideline B-10 already points federally regulated institutions this way.

**6. Treat account recovery as KYC.** Many fraudsters skip onboarding and take over existing accounts through password resets, SIM swaps, or a convincing help desk call. Recovery and high-risk changes, such as a new payee, address, or phone number, need the same assurance as onboarding.

**7. Give staff deepfake-aware procedures.** Call centre and branch teams need clear rules: call back on a known number, no exceptions for urgency, and a clear escalation path. Assume a voice or face can be faked.

**8. Review the KYC methods themselves regularly.** Attack methods change faster than annual policy cycles. The verification methods need their own review, not just the customers.

## The Canadian angle

FINTRAC's identification methods give institutions some flexibility, but many default to the simplest option. Regulation sets the minimum. With leaked ID images and deepfakes now common, the minimum won't be enough for higher-risk products. The institutions that move first will spend less on fraud later.

## The bottom line

KYC was built on the idea that only the real person has their documents. That idea no longer holds.

The institutions that adapt won't be the ones collecting more ID images. They'll be the ones that collect fewer, verify them better, and keep checking after day one.

Japan's regulator has already started down that road. The question is whether the rest of us wait for our own breach before following.

What's the biggest barrier to upgrading KYC in your organization: technology, regulation, or customer friction?

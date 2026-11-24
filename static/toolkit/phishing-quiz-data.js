// Question bank for the "Real or Phish?" quiz. Every organisation and domain is fictional and uses the
// reserved .example top-level domain, so no real company is imitated. The reader is "Sam Taylor" at the
// fictional Northgate Logistics (northgate.example).
//
// Body items are strings (paragraphs), {link, href} (a link whose real destination the player can reveal),
// {qr: href} (a QR code that hides a link) or {list: [...]}.
"use strict";

const PQ_BANK = [
  // ------------------------------------------------------------------ phishing
  {
    id: "it-password", kind: "phish", topic: "Fake IT password notice",
    from: "Northgate IT Service Desk", addr: "it-support@northgate-helpdesk.example",
    subject: "Your password expires today: action required",
    body: [
      "Hello user,",
      "Your Northgate network password will expire in 2 hours. To keep your current password and avoid losing access to email and Teams, confirm it below.",
      { link: "Keep my current password", href: "https://northgate-helpdesk.example/sso/keep?user=sam.taylor" },
      "IT Service Desk",
    ],
    clues: [
      ["Sender", "The address ends in northgate-helpdesk.example, not northgate.example. Anyone can register a name like that."],
      ["Greeting", "\"Hello user\": your own IT team knows your name."],
      ["Request", "\"Keep my current password\" is a trick. Real IT never asks you to confirm a password through a link."],
      ["Pressure", "A two-hour deadline is there to stop you checking."],
    ],
    lesson: "Look-alike company domains and password links are the most common phish at work.",
  },
  {
    id: "ceo-giftcards", kind: "phish", topic: "CEO gift-card request",
    from: "Dana Whitfield", addr: "dana.whitfield.ceo@gmail.com",
    subject: "Quick favour",
    body: [
      "Hi Sam, are you at your desk? I'm in back-to-back meetings and can't take calls.",
      "I need you to pick up 5 gift cards at $200 each for a client thank-you. Scratch off the backs and email me photos of the codes. I'll make sure you're reimbursed today.",
      "Please keep this between us for now, it's a surprise.",
      "Dana, sent from my phone",
    ],
    clues: [
      ["Sender", "The CEO's name, but a personal Gmail account. Executives use the company's email for company business."],
      ["Request", "Gift cards are untraceable cash. No real business pays clients this way."],
      ["Secrecy", "\"Keep this between us\" and \"can't take calls\" stop you from checking with anyone."],
    ],
    lesson: "No link and no attachment: this kind of scam beats spam filters. Check by calling the person on a number you already have.",
  },
  {
    id: "parcel-fee", kind: "phish", topic: "Courier redelivery fee",
    from: "ParcelNorth", addr: "notice@parcelnorth-redelivery.example",
    subject: "Delivery attempt failed: package on hold",
    body: [
      "We attempted to deliver your package today but no one was available. Your package is being held at our depot.",
      "To schedule redelivery, a fee of $1.99 is required. Packages not claimed within 48 hours are returned to sender.",
      { link: "Pay $1.99 and reschedule", href: "https://parcelnorth-redelivery.example/pay?ref=PN-HOLD" },
    ],
    clues: [
      ["Sender", "ParcelNorth's real domain is parcelnorth.example. This is parcelnorth-redelivery.example."],
      ["Details", "No tracking number, no shop name, no address: it fits anyone."],
      ["Request", "The tiny fee is the bait. The real goal is your card number."],
    ],
    lesson: "Small \"fees\" are how scammers collect card details. Track parcels from the courier's site or app yourself.",
  },
  {
    id: "doc-share", kind: "phish", topic: "Shared document lure",
    from: "Harbourline Logistics via DocSignal", addr: "no-reply@docsignal.example.review-portal.example",
    subject: "Harbourline has shared \"Q4 Rate Revision.pdf\" with you",
    body: [
      "You have received a secure document from Harbourline Logistics.",
      { link: "Review document", href: "https://docsignal.example.review-portal.example/view?doc=88412&login=office" },
      "This link expires in 24 hours.",
    ],
    clues: [
      ["Sender", "Read a domain from the right. The part just before the last dot here is review-portal, so the real owner is review-portal.example. docsignal is just a word at the front."],
      ["Link", "The link asks you to log in (\"login=office\"). Viewing a shared file shouldn't need your email password."],
      ["Context", "Were you expecting a rate revision? An unexpected document plus a short expiry is the classic set-up."],
    ],
    lesson: "Read web addresses from right to left. The real owner sits just before the last dot, and everything to its left can be anything.",
  },
  {
    id: "bank-verify", kind: "phish", topic: "Bank security alert",
    from: "Maple Trust Bank", addr: "alerts@mapletrust-secure.example",
    subject: "Unusual sign-in detected: your account is temporarily limited",
    body: [
      "Dear valued customer,",
      "We detected a sign-in to your online banking from a new device in another country. For your protection we have limited your account.",
      "To restore full access, verify your identity within 24 hours.",
      { link: "Verify my identity", href: "https://mapletrust-secure.example/verify/identity" },
    ],
    clues: [
      ["Sender", "mapletrust-secure.example is not Maple Trust's domain (mapletrust.example)."],
      ["Greeting", "\"Dear valued customer\": your bank knows your name."],
      ["Pressure", "Fear (a limited account) plus a deadline is meant to rush you into clicking."],
    ],
    lesson: "If your bank says something is wrong, open the banking app or call the number on your card. Never use the email's link.",
  },
  {
    id: "vendor-bank-change", kind: "phish", topic: "Supplier bank change",
    from: "Harbourline Logistics Billing", addr: "billing@harbour1ine.example",
    subject: "Updated remittance details: please action before Friday's payment run",
    attach: ["New_Banking_Details.pdf"],
    body: [
      "Hello Accounts Payable,",
      "Please note we have moved our banking to a new institution following an audit. Kindly update our remittance details in your system before Friday's payment run to avoid delays. Our new account details are attached.",
      "Payments sent to the old account will be returned.",
      "Kind regards, Harbourline Billing Team",
    ],
    clues: [
      ["Sender", "harbour1ine: the l in Harbourline is the number 1. The real domain is harbourline.example."],
      ["Request", "Changing where you send money, by email only, is the core of invoice fraud."],
      ["Pressure", "\"Before Friday's payment run\" leaves no time to check."],
    ],
    lesson: "Always confirm bank detail changes by calling the supplier on a number you already have on file, never one in the email.",
  },
  {
    id: "payroll-replyto", kind: "phish", topic: "Payroll direct-deposit update",
    from: "Northgate HR", addr: "hr@northgate.example", replyTo: "payroll.northgate@outlook.com",
    subject: "Action needed: confirm your direct deposit before the next pay date",
    body: [
      "Hi,",
      "We're moving to a new payroll provider. All employees must confirm their direct deposit details by end of day so pay isn't delayed.",
      { link: "Confirm my deposit details", href: "https://northgate-payroll-update.example/confirm" },
      "Questions? Just reply to this email.",
    ],
    clues: [
      ["Reply-To", "Replies go to an Outlook.com account, not to HR. The From line can be faked; this shows who's really waiting for your answer."],
      ["Link", "The link goes to northgate-payroll-update.example, not to Northgate's HR portal."],
      ["Request", "Pay and bank details are only changed through the HR system you already use."],
    ],
    lesson: "Even if the From address looks right, check where replies go and where links really lead.",
  },
  {
    id: "voicemail", kind: "phish", topic: "Voicemail attachment",
    from: "Voice Message", addr: "voicemail@northgate.example.msgcenter.example",
    subject: "New voicemail from +1 (613) 555-0148 (0:42)",
    attach: ["VM_Playback_0042.html"],
    body: [
      "You received a new voice message.",
      "Duration: 0:42. Open the attachment to listen.",
    ],
    clues: [
      ["Sender", "The domain is msgcenter.example. \"northgate.example\" at the front is decoration."],
      ["Attachment", "A voicemail would be an audio file. An .html attachment opens a web page, usually a fake login."],
    ],
    lesson: "Be wary of .html, .htm, .zip and .iso attachments. Real voicemail lives in your phone system or Teams.",
  },
  {
    id: "tax-refund", kind: "phish", topic: "Tax refund",
    from: "National Revenue Office", addr: "refunds@revenue-refund-claim.example",
    subject: "You have an unclaimed tax refund of $482.16",
    body: [
      "Our records show you are eligible for a refund of $482.16 from a previous tax year.",
      "Refunds not claimed within 48 hours are cancelled. Select your bank below to receive the deposit.",
      { link: "Claim my refund", href: "https://revenue-refund-claim.example/claim/select-bank" },
    ],
    clues: [
      ["Sender", "A government office wouldn't use a domain like revenue-refund-claim.example."],
      ["Request", "Tax agencies don't send refund links by email, and refunds don't expire in 48 hours."],
      ["Link", "\"Select your bank\" leads to a fake bank login page."],
    ],
    lesson: "Money you didn't expect plus a short deadline is the classic hook. Sign in to the tax agency's site yourself.",
  },
  {
    id: "qr-mfa", kind: "phish", topic: "QR code MFA reset",
    from: "Northgate Security Team", addr: "security@northgate-mfa.example",
    subject: "Multi-factor authentication must be re-registered",
    body: [
      "As part of a security upgrade, all staff must re-register multi-factor authentication this week.",
      "Scan the QR code below with your phone to complete the process.",
      { qr: "https://northgate-mfa.example/enroll?session=7f3a" },
      "Accounts not re-registered by Friday will be locked.",
    ],
    clues: [
      ["QR code", "A QR code hides the link, and your phone is outside your company's protection. Scammers use them to slip past filters."],
      ["Sender", "northgate-mfa.example is not northgate.example."],
      ["Request", "Re-registering MFA hands the attacker your second factor."],
    ],
    lesson: "Treat a QR code in an email like a link you can't read. Make MFA changes only through IT's normal process.",
  },

  // ------------------------------------------------------------------ real
  {
    id: "supplier-statement", kind: "real", topic: "Supplier statement",
    from: "Harbourline Logistics Billing", addr: "billing@harbourline.example",
    subject: "Your November statement is ready",
    body: [
      "Hi Sam,",
      "Your November statement for account NG-20417 is now available. As usual, you can view it by signing in to the Harbourline customer portal.",
      { link: "Go to the customer portal", href: "https://portal.harbourline.example/statements" },
      "No action is needed if your account is on automatic payment.",
    ],
    clues: [
      ["Sender", "billing@harbourline.example matches the supplier you deal with."],
      ["Link", "The link goes to portal.harbourline.example. portal is just a subdomain of the real domain."],
      ["Tone", "Specific account number, your name, no pressure, nothing to change."],
    ],
    lesson: "Real emails are usually specific, expected and calm. Even then, signing in through your saved bookmark is a good habit.",
  },
  {
    id: "it-maintenance", kind: "real", topic: "Planned IT maintenance",
    from: "Northgate IT Service Desk", addr: "it-servicedesk@northgate.example",
    subject: "Planned maintenance: Saturday 10 pm to 2 am",
    body: [
      "Hi all,",
      "Email and VPN will be unavailable on Saturday from 10 pm to 2 am Eastern while we apply security updates. You don't need to do anything.",
      { link: "Maintenance details on the intranet", href: "https://intranet.northgate.example/it/maintenance" },
      "Northgate IT",
    ],
    clues: [
      ["Sender", "Comes from northgate.example itself."],
      ["Request", "It asks you to do nothing: no password, no sign-in, no download."],
      ["Link", "Points to the company intranet on the real domain."],
    ],
    lesson: "Ask what the email wants you to do. Information only is low risk. A request for credentials or money needs checking.",
  },
  {
    id: "parcel-real", kind: "real", topic: "Courier tracking update",
    from: "ParcelNorth", addr: "tracking@parcelnorth.example",
    subject: "Your parcel from Bookshelf Co. is out for delivery",
    body: [
      "Hi Sam,",
      "Good news: your parcel from Bookshelf Co. (tracking PN 4471 2098 3315) is out for delivery today and should arrive by 6 pm.",
      { link: "Track your parcel", href: "https://www.parcelnorth.example/track?id=PN447120983315" },
    ],
    clues: [
      ["Sender", "parcelnorth.example is the courier's real domain."],
      ["Details", "Names the shop, gives a full tracking number and asks for no payment."],
      ["Context", "You actually ordered from Bookshelf Co."],
    ],
    lesson: "Compare with the fake courier email: real ones are specific and never ask for a fee by email.",
  },
  {
    id: "bank-statement", kind: "real", topic: "Bank e-statement",
    from: "Maple Trust Bank", addr: "notifications@mapletrust.example",
    subject: "Your e-statement is available",
    body: [
      "Hello Sam Taylor,",
      "Your October e-statement for chequing account ending 4471 is ready.",
      "For your security, we never include links in our emails. Sign in to the Maple Trust app or website to view it.",
    ],
    clues: [
      ["Sender", "mapletrust.example is the bank's real domain."],
      ["Link", "No link at all. The bank tells you to go to the app yourself."],
      ["Details", "Uses your full name and only the last 4 digits of the account."],
    ],
    lesson: "Many banks deliberately send no links. That's a good sign, and a habit worth copying.",
  },
  {
    id: "colleague-notes", kind: "real", topic: "Colleague meeting notes",
    from: "Priya Natarajan", addr: "priya.natarajan@northgate.example",
    subject: "Notes from today's Harbourline meeting",
    attach: ["Harbourline-meeting-notes-2026-11-18.docx"],
    body: [
      "Hi Sam,",
      "Thanks for joining this afternoon. Notes attached. I've put the two open actions for you on page 2 (rate comparison and the insurance certificate).",
      "Shout if I missed anything.",
      "Priya",
    ],
    clues: [
      ["Sender", "An internal colleague on northgate.example."],
      ["Context", "Refers to a meeting you were in, with specific actions."],
      ["Attachment", "A Word document you'd expect after a meeting, named with the date."],
    ],
    lesson: "Context is the strongest check. If an attachment is unexpected, even from a colleague, ask them first; their account could be compromised.",
  },
  {
    id: "password-reset-requested", kind: "real", topic: "Password reset you asked for",
    from: "CloudVault", addr: "no-reply@cloudvault.example",
    subject: "Reset your CloudVault password",
    body: [
      "Hi Sam,",
      "We received a request to reset the password for your CloudVault account. If you made this request, use the link below within 30 minutes.",
      { link: "Reset password", href: "https://account.cloudvault.example/reset?token=c41d9e" },
      "If you didn't ask for this, you can ignore this email. Your password won't change.",
    ],
    clues: [
      ["Context", "You just asked to reset it, so this was expected."],
      ["Link", "Goes to account.cloudvault.example, the service's real domain."],
      ["Tone", "Tells you to ignore it if it wasn't you. No threat or pressure."],
    ],
    lesson: "A reset email you didn't request is a warning sign. Don't click; sign in normally and check your account.",
  },
  {
    id: "benefits", kind: "real", topic: "HR benefits enrolment",
    from: "Northgate HR", addr: "hr@northgate.example",
    subject: "Benefits enrolment opens Monday",
    body: [
      "Hi everyone,",
      "Annual benefits enrolment runs from Monday, November 30 to Friday, December 11. Make your choices in the HR portal on the intranet, the same place as last year.",
      { link: "Benefits page on the intranet", href: "https://intranet.northgate.example/hr/benefits" },
      "Questions? Contact Leah in HR at extension 2210.",
    ],
    clues: [
      ["Sender", "hr@northgate.example, with no different Reply-To."],
      ["Link", "Goes to the intranet on the real domain, \"the same place as last year\"."],
      ["Contact", "Gives a named person and an internal extension to check with."],
    ],
    lesson: "Compare with the fake payroll email: same sender name, but this one sends you to systems you already know.",
  },
  {
    id: "esign-real", kind: "real", topic: "E-signature request you expected",
    from: "Jordan Lee via DocSignal", addr: "dse@docsignal.example",
    subject: "Please sign: Harbourline service agreement renewal 2027",
    body: [
      "Jordan Lee (Harbourline Logistics) sent you a document to review and sign.",
      "Message from Jordan: \"Hi Sam, here's the renewal we agreed on Tuesday's call. Same terms as discussed.\"",
      { link: "Review document", href: "https://app.docsignal.example/sign/9c2e-77ab" },
    ],
    clues: [
      ["Sender", "docsignal.example is the signing service's real domain."],
      ["Context", "Refers to a renewal you agreed on a call. You were expecting it."],
      ["Link", "app.docsignal.example is a subdomain of the real service."],
    ],
    lesson: "Compare with the fake shared document: same kind of email, but a real domain and a real conversation behind it.",
  },
];

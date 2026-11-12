import { cookies, headers } from "next/headers";

export const LOCALES = ["nl", "en"];
export const DEFAULT_LOCALE = "nl";

// Bepaalt de taal voor de publieke pagina's (landing/login/contact): een handmatig
// gekozen taal (cookie) wint altijd; anders volgen we de browsertaal (Accept-Language).
export async function getLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  if (LOCALES.includes(cookieLocale)) return cookieLocale;

  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().startsWith("nl") ? "nl" : "en";
}

const dictionaries = {
  nl: {
    nav: { home: "Home", login: "Inloggen", contact: "Contact", onderbouwing: "Werking en onderbouwing" },
    landing: {
      badge: "House of Digital · AI Transformatie Simulator",
      heroTitlePre: "Wat betekent AI voor",
      heroTitleHighlight: "het werk",
      heroTitlePost: "in uw organisatie?",
      heroText:
        "De simulator laat per functie zien hoeveel tijd AI kan vrijmaken, en of uw organisatie klaar is om die tijd ook te benutten. Een onderbouwde schatting om een besluit op te baseren, geen voorspelling.",
      cta: "Neem contact op",
      cta2: "Lees hoe het werkt",
      directNaar: "Direct naar:",
      linkDoc: "Werking en onderbouwing",
      linkPdf: "Download als pdf",
      bezig: "Wordt gemaakt…",
      klaar: "✓ Gedownload",
      fout: "Mislukt, probeer opnieuw",
      docLabel: "Document voor directies",
      docTitle: "Werking en onderbouwing",
      docText:
        "Hoe de simulator werkt, hoe hij rekent en waarop hij is gebaseerd: de Europese classificatie van competenties en het onderzoek naar wat AI met werk doet. Met de grenzen erbij.",
      docRead: "Lees het document",
      docDownload: "Download als pdf",
      linkContact: "Contact",
      linkLogin: "Inloggen voor adviseurs",
      resultsHeading: "Twee onderzoeken,",
      resultsHeadingHighlight: "één beeld",
      resultsSub: "Los van elkaar te gebruiken. Samen laten ze zien wat er kan vrijkomen en of aan de voorwaarden is voldaan om dat te bereiken.",
      card1Title: "Capaciteitsanalyse",
      card1Text:
        "Per functie en per afdeling: hoeveel tijd er kan vrijkomen als AI taken overneemt, waar die tijd naartoe kan en wat dat vraagt van uw mensen.",
      card2Title: "AI-volwassenheidsscan",
      card2Text: "Hoe ver de organisatie is met AI, op acht onderdelen en vijf niveaus. Met de zwakste schakel en een volgorde van aanpak.",
      card3Title: "Twee rapporten en een gesprek",
      card3Text: "Een capaciteitsrapport en een volwassenheidsrapport in Word en pdf. De adviseur controleert de uitkomsten en loopt ze met u door.",
      howHeading: "Hoe het werkt",
      step1Title: "Functieoverzicht en functieprofielen aanleveren",
      step1Text: "Uw functies met FTE, uren en loonkosten, plus de functieprofielen. Via een beveiligde link. Namen van medewerkers zijn niet nodig.",
      step2Title: "Vragenlijst invullen",
      step2Text: "Enkele mensen uit directie, management, IT, HR en werkvloer vullen de volwassenheidsscan in. De lijst past zich aan de antwoorden aan.",
      step3Title: "Analyse, controle en rapport",
      step3Text:
        "AI ontleedt de functies in taken, de adviseur controleert en stuurt bij. U ontvangt beide rapporten, als vertrekpunt voor het gesprek en niet als eindoordeel.",
      disclaimer:
        "Deze simulatie geeft {richting}, geen exacte voorspelling. De uitkomst is technisch potentieel: wat er kan vrijkomen als het werk rond AI opnieuw wordt ingericht.",
      disclaimerStrong: "richting",
      footerTagline: "AI Organisatie Transformatie Simulator · House of Digital",
    },
    doc: {
      label: "Voor directies en bestuurders",
      intro: "Hoe de simulator werkt, hoe hij rekent en op welke onderzoeken hij is gebaseerd. Geschreven om in een kwartier te lezen.",
      download: "Download als pdf",
      bezig: "Wordt gemaakt…",
      klaar: "✓ Gedownload",
      fout: "Mislukt, probeer opnieuw",
      contact: "Neem contact op",
      versie: "Versie",
      taal: "alleen in het Nederlands",
      inhoud: "Inhoud",
      slotKop: "Verder praten?",
      slotTekst: "Bewaar het document of neem contact op voor een toelichting.",
    },
    login: {
      subtitle: "Intern — inloggen voor bureau-accounts",
      email: "E-mailadres",
      password: "Wachtwoord",
      error: "E-mailadres of wachtwoord onjuist. Na meerdere mislukte pogingen moet je een kwartier wachten.",
      submit: "Inloggen",
      submitting: "Inloggen...",
      forgot: "Wachtwoord vergeten?",
    },
    contact: {
      title: "Neem",
      titleHighlight: "contact",
      titlePost: "op",
      text: "Vertel kort waar jullie tegenaan lopen — we nemen zo snel mogelijk contact op.",
      sentTitle: "Bericht verstuurd",
      sentText: "Bedankt — we nemen zo snel mogelijk contact met je op.",
      name: "Naam",
      email: "E-mailadres",
      organisation: "Organisatie (optioneel)",
      message: "Bericht",
      submit: "Verstuur bericht",
      submitting: "Versturen...",
      fallbackError: "Versturen mislukt.",
    },
  },
  en: {
    nav: { home: "Home", login: "Log in", contact: "Contact", onderbouwing: "How it works" },
    landing: {
      badge: "House of Digital · AI Transformation Simulator",
      heroTitlePre: "What does AI mean for",
      heroTitleHighlight: "the work",
      heroTitlePost: "in your organization?",
      heroText:
        "The simulator shows per role how much time AI can free up, and whether your organization is ready to actually use that time. A substantiated estimate to base a decision on, not a prediction.",
      cta: "Get in touch",
      cta2: "Read how it works",
      directNaar: "Go to:",
      linkDoc: "How it works and what it is based on",
      linkPdf: "Download as pdf",
      bezig: "Preparing…",
      klaar: "✓ Downloaded",
      fout: "Failed, try again",
      docLabel: "Document for boards",
      docTitle: "How it works and what it is based on",
      docText:
        "How the simulator works, how it calculates and what it is based on: the European classification of skills and the research into what AI does to work. Including the limits. In Dutch.",
      docRead: "Read the document",
      docDownload: "Download as pdf",
      linkContact: "Contact",
      linkLogin: "Log in for advisers",
      resultsHeading: "Two studies,",
      resultsHeadingHighlight: "one picture",
      resultsSub: "Each can be used on its own. Together they show what can be freed up and whether the conditions are in place to get there.",
      card1Title: "Capacity analysis",
      card1Text:
        "Per role and per department: how much time can be freed up when AI takes over tasks, where that time can go and what it asks of your people.",
      card2Title: "AI maturity scan",
      card2Text: "How far the organization has come with AI, on eight dimensions and five levels. With the weakest link and an order of approach.",
      card3Title: "Two reports and a conversation",
      card3Text: "A capacity report and a maturity report in Word and pdf. The adviser checks the outcomes and walks you through them.",
      howHeading: "How it works",
      step1Title: "Provide the role overview and role profiles",
      step1Text: "Your roles with FTE, hours and wage costs, plus the role profiles. Through a secure link. Employee names are not needed.",
      step2Title: "Fill in the questionnaire",
      step2Text: "A few people from the board, management, IT, HR and the shop floor fill in the maturity scan. The list adapts to the answers.",
      step3Title: "Analysis, review and report",
      step3Text:
        "AI breaks the roles down into tasks, the adviser checks and adjusts. You receive both reports, as a starting point for the conversation and not as a final verdict.",
      disclaimer:
        "This simulation provides {richting}, not an exact prediction. The outcome is technical potential: what can be freed up when work is redesigned around AI.",
      disclaimerStrong: "direction",
      footerTagline: "AI Organization Transformation Simulator · House of Digital",
    },
    doc: {
      label: "For boards and directors",
      intro: "How the simulator works, how it calculates and which research it is based on. Written to be read in fifteen minutes.",
      download: "Download as pdf",
      bezig: "Preparing…",
      klaar: "✓ Downloaded",
      fout: "Failed, try again",
      contact: "Get in touch",
      versie: "Version",
      taal: "in Dutch only",
      inhoud: "Contents",
      slotKop: "Want to talk it through?",
      slotTekst: "Keep the document or get in touch for an explanation.",
    },
    login: {
      subtitle: "Internal — login for agency accounts",
      email: "Email address",
      password: "Password",
      error: "Incorrect email address or password. After several failed attempts you have to wait fifteen minutes.",
      submit: "Log in",
      submitting: "Logging in...",
      forgot: "Forgot password?",
    },
    contact: {
      title: "Get in",
      titleHighlight: "touch",
      titlePost: "",
      text: "Briefly tell us what you're running into — we'll get back to you as soon as possible.",
      sentTitle: "Message sent",
      sentText: "Thanks — we'll be in touch as soon as possible.",
      name: "Name",
      email: "Email address",
      organisation: "Organization (optional)",
      message: "Message",
      submit: "Send message",
      submitting: "Sending...",
      fallbackError: "Failed to send.",
    },
  },
};

export function getDictionary(locale) {
  return dictionaries[LOCALES.includes(locale) ? locale : DEFAULT_LOCALE];
}

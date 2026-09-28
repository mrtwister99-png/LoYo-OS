import { ServiceDetail } from '../types';

export const SERVICES_DATA: ServiceDetail[] = [
  {
    id: 'fullstack',
    number: '01',
    title: 'Individuální Aplikace na Míru',
    subtitle: 'Zakázkový Full-Stack Vývoj',
    badge: 'End-to-End Architektura',
    iconName: 'Code2',
    shortDesc: 'Kompletní vývoj zakázkového softwaru od návrhu databáze přes backendové rozhraní až po intuitivní, bleskurychlý frontend.',
    fullDesc: 'Žádné generické šablony ani kompromisy v architektuře. Vyvíjím webové, cloudové i interní systémy navržené přesně pro vaše specifické procesy. Každý řádek kódu má svůj účel, klade důraz na maximální bezpečnost, škálovatelnost a čistou strukturu, kterou lze v budoucnu snadno rozšiřovat.',
    highlights: [
      'Moderní modulární architektura (React, Node.js, TypeScript)',
      'Optimalizované databáze a REST / GraphQL rozhraní',
      'Přímá integrace do vašich stávajících nástrojů a API',
      'Responzivní a bleskové uživatelské rozhraní bez prodlev'
    ],
    capabilities: [
      {
        title: 'Zakázkové interní portály & ERP',
        description: 'Systémy pro správu zakázek, skladů, klientských zón nebo operací, které zrychlí chod týmu o desítky procent.'
      },
      {
        title: 'Škálovatelné Webové Aplikace',
        description: 'Robustní SaaS platformy, portály pro zákazníky a digitální nástroje s vysokou dostupností.'
      },
      {
        title: 'Komplexní Full-Stack Integrace',
        description: 'Propojení platebních bran, bankovních API, skladových a účetních systémů (Pohoda, Fakturoid apod.).'
      },
      {
        title: 'Architektura s nulovým technickým dluhem',
        description: 'Čistý a okomentovaný kód s důrazem na dlouhodobou udržitelnost a snadnou budoucí škálovatelnost.'
      }
    ],
    deliverables: [
      'Zdrojový kód ve vašem vlastnictví bez licenčních pastí',
      'Kompletní technická dokumentace a schéma architektury',
      'Nasazení na optimalizovaný cloudový server',
      'Záruka bezproblémového chodu a technická podpora'
    ],
    idealFor: [
      'Firmy, kterým krabicová řešení nestačí a brzdí je',
      'Projekty vyžadující unikátní logiku a rychlost',
      'Podnikatelé hledající technologického partnera bez agenturní byrokracie'
    ],
    quotePrompt: 'Nakonfigurovat požadavky na aplikaci'
  },
  {
    id: 'automation',
    number: '02',
    title: 'Automatizace Procesů & Ekosystémy',
    subtitle: 'Chytrá Propojení & Zakázkové Zabezpečení',
    badge: 'Hloubkový Výzkum & Zabezpečení',
    iconName: 'Cpu',
    shortDesc: 'Od zrychlení běžných denních úkonů až po komplexní propojení celého firemního ekosystému s neomezenými možnostmi autentizace.',
    fullDesc: 'Začínám hloubkovým výzkumem aktuálního stavu vaší firmy a detailní analýzou potřeb, abychom odstranili neefektivity. Automatizovat lze cokoliv: samostatné dílčí procesy (čtení a třídění e-mailů, chytrý plánovač schůzek, automatické reporty) i robustní firemní systém. Součástí může být zakázkové přihlašování a zabezpečení přesně podle vás – přes mobil, NFC čipy/karty, e-mailové magické linky, gamifikované ověření či cokoliv dalšího.',
    highlights: [
      'Hloubkový audit stávajících procesů a datových toků firmy',
      'Inteligentní třídění & zpracování e-mailů a dokumentů',
      'Chytré plánovače a automatické synchronizace v reálném čase',
      'Zakázkové zabezpečení: Mobil, NFC, E-mail, Gamifikace & Biometrie'
    ],
    capabilities: [
      {
        title: 'Hloubkový výzkum a procesní audit',
        description: 'Detailní rozbor fungování vaší firmy, identifikace úzkých hrdel a návrh nejefektivnějších řešení na míru.'
      },
      {
        title: 'Dílčí zrychlení každodenních činností',
        description: 'Automatické čtení a kategorizace příchozích e-mailů, chytrý plánovač schůzek a úkolů, automatické generování faktur.'
      },
      {
        title: 'Komplexní propojení celého ekosystému',
        description: 'Harmonické propojení e-shopu, skladu, účetnictví, CRM a komunikačních kanálů do jednoho živého organismu.'
      },
      {
        title: 'Neomezené možnosti přihlášení a ochrany',
        description: 'Zabezpečení firemního systému na míru: ověření telefonem, NFC kartou/čipem na stole, bezpečným e-mailovým tokenem nebo třeba interaktivní mini-hrou.'
      }
    ],
    deliverables: [
      'Procesní mapa úspor a zavedených automatizací',
      'Plně funkční a otestované automatizační workflow',
      'Nastavení vybraného typu zabezpečení (NFC / mobil / custom)',
      'Zaškolení týmu a dohled nad hladkým náběhem'
    ],
    idealFor: [
      'Firmy přetížené manuální rutinou a přepisem dat',
      'Manažeři toužící po jednotném přehledu a automatickém plánování',
      'Týmy vyžadující vysokou úroveň a flexibilitu zabezpečení'
    ],
    quotePrompt: 'Nakonfigurovat automatizaci a zabezpečení'
  },
  {
    id: 'web-branding',
    number: '03',
    title: 'Prvotřídní Weby, Branding & Animace',
    subtitle: 'Reprezentativní Digitální Prezentace',
    badge: 'Prémiový Vizuální Styl',
    iconName: 'Sparkles',
    shortDesc: 'Moderní, vizuálně čisté a bleskurychlé weby s precizními plynulými animacemi a tvorbou loga na míru.',
    fullDesc: 'Váš web je první dojem, který rozhoduje o důvěře a hodnotě vaší značky. Tvořím weby s vytříbeným citem pro detail, elegantní typografii a vyváženou barevnou paletu Navy, White & Gold. Připravím pro vás reprezentativní prezentaci s plynulými animacemi, které nenarušují čitelnost, a navrhnu originální logo s vizuální identitou na míru.',
    highlights: [
      'Čistý, moderní a prémiový design bez grafického balastu',
      'Precizní a plynulé mikroanimace pro hladký uživatelský zážitek',
      'Tvorba originálního loga a vizuální identity na míru',
      'Stoprocentní optimalizace pro mobilní telefony i velké obrazovky'
    ],
    capabilities: [
      {
        title: 'Exkluzivní webové prezentace',
        description: 'Webové stránky vytvořené na míru pro maximální konverzi, důvěryhodnost a prestiž vaší firmy či osobní značky.'
      },
      {
        title: 'Plynulé animace a mikrointerakce',
        description: 'Jemné, fyzikálně přesné přechody a interaktivní prvky, které návštěvníka okamžitě vtáhnou do příběhu značky.'
      },
      {
        title: 'Logo & Vizuální identita na míru',
        description: 'Návrh unikátního logotypu, barevné palety, typografického manuálu a exportních grafických podkladů.'
      },
      {
        title: 'Blesková rychlost a SEO optimalizace',
        description: 'Extrémní důraz na rychlost načítání, čistý HTML kód a perfektní zobrazení ve všech moderních prohlížečích.'
      }
    ],
    deliverables: [
      'Kompletně responzivní web v produkční kvalitě',
      'Grafické logo ve vektorových formátech (SVG, PDF, PNG)',
      'Základní brand manuál s definicí barev a písem',
      'Nastavení analytiky a technického SEO'
    ],
    idealFor: [
      'Společnosti a experti požadující vysoce profesionální image',
      'Startupy a nové projekty potřebující logo a vstupní stránku',
      'Klienti unavení z generických WordPress šablon'
    ],
    quotePrompt: 'Nakonfigurovat web a branding'
  },
  {
    id: 'consultation',
    number: '04',
    title: 'Odborná Osobní Konzultace',
    subtitle: 'Strategie, Architektura & Posun správným směrem',
    badge: 'Osobní Setkání & Poradenství',
    iconName: 'MessageSquare',
    shortDesc: 'Máte nápad nebo myšlenku jak něco vylepšit a urychlit? Domluvte si se mnou odbornou konzultaci – klidně osobně.',
    fullDesc: 'Vše do detailu probereme, prodiskutujeme a poradíme se. Pomohu vám posoudit proveditelnost, doporučím nejvhodnější architekturu a nasměruji vás správným směrem, abyste neplýtvali časem ani financemi na slepé uličky.',
    highlights: [
      'Osobní setkání (u dobré kávy nebo ve vaší firmě) či online',
      'Cena okolo 800 Kč / hod dle složitosti případu (vysoce individuální služba)',
      'Detailní rozbor vašeho nápadu a technická oponentura',
      'Doporučení nejlepší technologie a eliminace rizik předem',
      'Jasný akční plán a odhad pracnosti i nákladů'
    ],
    capabilities: [
      {
        title: 'Posouzení nápadu & Validace konceptu',
        description: 'Máte myšlenku na novou aplikaci nebo automatizaci? Společně rozebereme úskalí, architekturu a reálnou návratnost.'
      },
      {
        title: 'Optimalizace a zrychlení stávajících procesů',
        description: 'Identifikace úzkých hrdel v chodu firmy a návrh, co má smysl automatizovat ihned a co naopak nechat.'
      },
      {
        title: 'Výběr technologií a nezávislý audit',
        description: 'Poradím vám, zda stavět na míru, jaké zvolit databáze, API či zda a jak reálně zapojit moderní AI.'
      }
    ],
    deliverables: [
      'Strukturovaný souhrn a doporučení z konzultace',
      'Návrh technické architektury nebo procesní roadmapy',
      'Rámcový rozpočet a časový harmonogram',
      'Návazná nabídka realizace (bez jakéhokoliv nátlaku)'
    ],
    idealFor: [
      'Zakladatelé s vizí, kteří potřebují zkušeného technického partnera',
      'Podnikatelé hledající úsporu času a optimalizaci procesů',
      'Každý, kdo ocení upřímnou a věcnou radu z praxe'
    ],
    quotePrompt: 'Rezervovat termín osobní konzultace'
  }
];

export const QUESTIONNAIRE_CONFIGS = {
  fullstack: {
    title: 'Dotazník: Individuální Aplikace na Míru',
    description: 'Specifikujte své požadavky na zakázkovou full-stack aplikaci. Vše vytvořím od základu přesně podle vás.',
    scopeOptions: [
      'Osobní aplikace s custom vymoženostmi přes API',
      'Interní firemní aplikace pro zaměstnance / Portál',
      'Zakázkový chat / komunikační systém v reálném čase',
      'Nový komplexní full-stack systém od nuly',
      'Aplikace s unikátní logikou (vlastní ovládání, netradiční UI prvky)'
    ],
    featureOptions: [
      'Kvalitní backend přesně podle vašich potřeb od základu',
      'Zakázkové ovládací prvky (např. custom ikony/animace místo tlačítek)',
      'Vlastní ukazatele stavu a procesů (0–100%)',
      'Chat & zprávy v reálném čase (WebSockets)',
      'Uživatelské účty a správa rolí pro zaměstnance',
      'Integrace platebních bran a externích API',
      'Exporty dat (PDF, Excel, synchronizace)',
      'Šifrované cloudové i lokální úložiště'
    ],
    budgets: [
      'Do 50 000 Kč (Základní MVP / osobní aplikace)',
      '50 000 – 120 000 Kč (Standardní zakázková aplikace)',
      '120 000 – 250 000 Kč (Komplexní systém pro zaměstnance)',
      '250 000 Kč+ (Rozsáhlá firemní platforma)',
      'Zatím nemám stanovený rozpočet'
    ],
    timelines: [
      'Co nejdříve (do 3 týdnů)',
      'Během 1 až 2 měsíců',
      'Během 3 až 4 měsíců',
      'Záleží na vzájemné domluvě a prioritách'
    ]
  },
  automation: {
    title: 'Dotazník: Automatizace Procesů & Ekosystémy',
    description: 'Uveďte, co potřebujete zefektivnit a jaké zabezpečení si představujete.',
    scopeOptions: [
      'Jednotlivé dílčí procesy (čtení/třídění e-mailů, plánovač, notifikace)',
      'Komplexní propojení celého firemního ekosystému',
      'Hloubkový výzkum stávajícího stavu firmy a procesní audit',
      'Osobní asistenční systém pro urychlení každodenní práce',
      'Zabezpečení, prostředí, záloha, lokální i cloudové úložiště'
    ],
    featureOptions: [
      'Chytré čtení a třídění příchozích e-mailů',
      'Inteligentní plánovač kalendáře a schůzek',
      'Automatické vystavování a párování faktur',
      'Obousměrné propojení CRM s účetnictvím',
      'Automatické generování přehledů a statistik',
      'Zákaznická komunikace a chatboti',
      'Sledování a synchronizace stavu skladu',
      'Automatické zálohování a privátní cloudové/lokální úložiště'
    ],
    securityOptions: [
      'Ověření přes mobilní telefon (SMS kód / Authenticator app / Push)',
      'Fyzické NFC karty nebo klíčenky / čipy',
      'Jednorázový magický odkaz do e-mailu (Passwordless)',
      'Gamifikované ověření (vlastní mini-hra / interaktivní vzor)',
      'Biometrické ověření (otisk prstu / Face ID přes WebAuthn)',
      'Kombinace více faktorů na míru (MFA)'
    ],
    budgets: [
      'Do 30 000 Kč (Automatizace dílčího procesu / audit)',
      '30 000 – 80 000 Kč (Propojení klíčových firemních nástrojů)',
      '80 000 – 180 000 Kč (Komplexní ekosystém s vlastním zabezpečením)',
      'Dle doporučení z úvodní analýzy'
    ],
    timelines: [
      'Okamžitá optimalizace (do 14 dnů)',
      'Standardní implementace (3–6 týdnů)',
      'Dlouhodobá etapová transformace'
    ]
  },
  'web-branding': {
    title: 'Dotazník: Weby, Restyling & Rebranding',
    description: 'Definujte svou vizi nového webu, restylingu či digitální NFC vizitky.',
    scopeOptions: [
      'Vytvoření nového prvotřídního & minimalistického webu',
      'Restyling & Rebranding stávajícího webu',
      'Nechám to plně na vás – návrh a ukázka podle náročnosti',
      'Digitální vizitka (přes NFC – přiložením se otevře profil/web)',
      'Tvorba loga na míru a kompletní grafický manuál'
    ],
    brandingOptions: [
      'Vytvoření nového loga na míru (vektory, barvy, typografie)',
      'Digitální NFC vizitka pro rychlé sdílení kontaktů',
      'Kompletní restyling stávající prezentace',
      'Grafické podklady pro sítě a tiskoviny'
    ],
    animationLevels: [
      'Decentní & minimalistické (čisté jemné vstupy, fokus na čtení)',
      'Střední dynamika (interaktivní karty, plynulé přechody sekcí)',
      'Exkluzivní motion zážitek (plynulý scrollytelling, interaktivní prvky)'
    ],
    budgets: [
      'Do 35 000 Kč (Kompaktní prezentace / NFC vizitka / logo)',
      '35 000 – 75 000 Kč (Kompletní web včetně restylingu a loga)',
      '75 000 – 150 000 Kč (Exkluzivní web s individuálním brandingem)',
      'Zatím zvažuji možnosti'
    ],
    timelines: [
      'Rychlé spuštění (do 2 týdnů)',
      'Standardní termín (3–4 týdny)',
      'Nespěchám, prioritou je maximální preciznost'
    ]
  },
  consultation: {
    title: 'Dotazník: Odborná Osobní Konzultace',
    description: 'Máte nápad nebo myšlenku jak něco vylepšit a urychlit? Domluvte si se mnou odbornou konzultaci klidně osobně. Cena se pohybuje okolo 800 Kč/hod dle složitosti případu (vysoce individuální služba).',
    scopeOptions: [
      'Osobní setkání (kavárna, vaše kancelář, Praha / dle domluvy)',
      'Online videohovor (Google Meet / Zoom)',
      'Posouzení nového nápadu nebo startupového projektu',
      'Audit a optimalizace stávajících firemních procesů',
      'Konzultace architektury aplikace a výběru technologií'
    ],
    consultationTopics: [
      'Zpřesnění myšlenky a návrh nejlepšího postupu',
      'Posouzení proveditelnosti a eliminace slepých uliček',
      'Kde ušetřit čas a kde se vyplatí automatizace',
      'Jak smysluplně využít AI pro reálný byznys',
      'Bezpečnost, zálohování a ochrana firemních dat',
      'Odhad nákladů a etapový harmonogram realizace'
    ],
    budgets: [
      'Úvodní 60minutová konzultace (cca 800 Kč dle složitosti)',
      '2–3 hodiny intenzivní rozbor nápadu',
      'Půldenní workshop / hloubkový procesní audit',
      'Pravidelný mentoring a technické vedení',
      'Zatím chci jen nezávazně probrat nápad'
    ],
    timelines: [
      'Co nejdříve (tento týden)',
      'Během příštích 14 dnů',
      'Podle vzájemných časových možností'
    ]
  }
};

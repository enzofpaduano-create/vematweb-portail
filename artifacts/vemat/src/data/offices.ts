import westchaseLogo from "@/assets/partners/westchase-logo.png";

export type OfficeType = "hq" | "branch" | "partner";

export type Office = {
  id: string;
  city: string;
  country: { fr: string; en: string };
  type: OfficeType;
  partnerName?: string;
  partnerUrl?: string;
  partnerLogo?: string;
  coords: [number, number];
  tagline: { fr: string; en: string };
  description: { fr: string; en: string };
};

export const offices: Office[] = [
  {
    id: "dubai",
    city: "Dubaï",
    country: { fr: "Émirats Arabes Unis", en: "United Arab Emirates" },
    type: "branch",
    coords: [55.2708, 25.2048],
    tagline: { fr: "Branche Vemat", en: "Vemat branch" },
    description: {
      fr: "Plateforme stratégique pour le sourcing international et les opérations Moyen-Orient.",
      en: "Strategic platform for international sourcing and Middle East operations.",
    },
  },
  {
    id: "casablanca",
    city: "Casablanca",
    country: { fr: "Maroc", en: "Morocco" },
    type: "hq",
    coords: [-7.5898, 33.5731],
    tagline: { fr: "Siège social", en: "Headquarters" },
    description: {
      fr: "Quartier général de Vemat Group, centre logistique et technique pour l'ensemble de nos opérations.",
      en: "Vemat Group headquarters, logistics and technical hub for all our operations.",
    },
  },
  {
    id: "lagos",
    city: "Lagos",
    country: { fr: "Nigeria", en: "Nigeria" },
    type: "branch",
    partnerName: "Westchase Oil & Gas",
    partnerUrl: "http://westchaseoil.com/index.html",
    partnerLogo: westchaseLogo,
    coords: [3.3792, 6.5244],
    tagline: { fr: "Branche Vemat", en: "Vemat branch" },
    description: {
      fr: "Notre bureau Vemat opérant sous l'enseigne Westchase Oil & Gas, dédié au golfe de Guinée et à l'industrie pétrolière nigériane.",
      en: "Our Vemat office operating under the Westchase Oil & Gas brand, dedicated to the Gulf of Guinea and Nigerian oil & gas industry.",
    },
  },
  {
    id: "port-harcourt",
    city: "Port Harcourt",
    country: { fr: "Nigeria", en: "Nigeria" },
    type: "branch",
    partnerName: "Westchase Oil & Gas",
    partnerUrl: "http://westchaseoil.com/index.html",
    partnerLogo: westchaseLogo,
    coords: [7.0498, 4.8156],
    tagline: { fr: "Branche Vemat", en: "Vemat branch" },
    description: {
      fr: "Bureau Vemat opérant sous l'enseigne Westchase Oil & Gas, au cœur du delta du Niger et de l'industrie pétrolière offshore.",
      en: "Vemat office operating under the Westchase Oil & Gas brand, at the heart of the Niger Delta and offshore oil & gas industry.",
    },
  },
  {
    id: "nouadhibou",
    city: "Nouadhibou",
    country: { fr: "Mauritanie", en: "Mauritania" },
    type: "branch",
    coords: [-17.0333, 20.9417],
    tagline: { fr: "Branche Vemat", en: "Vemat branch" },
    description: {
      fr: "Bureau Vemat dédié à l'Afrique de l'Ouest atlantique, spécialiste du minier.",
      en: "Vemat office serving Atlantic West Africa, specialised in mining.",
    },
  },
];

export const ACTIVE_COUNTRY_IDS = new Set<string>([
  "504", // Maroc
  "732", // Sahara (rattaché au Maroc)
  "788", // Tunisie
  "434", // Libye
  "478", // Mauritanie
  "686", // Sénégal
  "270", // Gambie
  "624", // Guinée-Bissau
  "324", // Guinée (Conakry)
  "466", // Mali
  "854", // Burkina Faso
  "562", // Niger
  "694", // Sierra Leone
  "430", // Liberia
  "384", // Côte d'Ivoire
  "288", // Ghana
  "768", // Togo
  "204", // Bénin
  "566", // Nigeria
  "120", // Cameroun
  "226", // Guinée Équatoriale
  "148", // Tchad
]);

export const COUNTRY_NAMES: Record<string, { fr: string; en: string }> = {
  "504": { fr: "Maroc", en: "Morocco" },
  "732": { fr: "Maroc", en: "Morocco" },
  "788": { fr: "Tunisie", en: "Tunisia" },
  "434": { fr: "Libye", en: "Libya" },
  "012": { fr: "Algérie", en: "Algeria" },
  "818": { fr: "Égypte", en: "Egypt" },
  "478": { fr: "Mauritanie", en: "Mauritania" },
  "686": { fr: "Sénégal", en: "Senegal" },
  "270": { fr: "Gambie", en: "Gambia" },
  "624": { fr: "Guinée-Bissau", en: "Guinea-Bissau" },
  "324": { fr: "Guinée", en: "Guinea" },
  "466": { fr: "Mali", en: "Mali" },
  "854": { fr: "Burkina Faso", en: "Burkina Faso" },
  "562": { fr: "Niger", en: "Niger" },
  "694": { fr: "Sierra Leone", en: "Sierra Leone" },
  "430": { fr: "Liberia", en: "Liberia" },
  "384": { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" },
  "288": { fr: "Ghana", en: "Ghana" },
  "768": { fr: "Togo", en: "Togo" },
  "204": { fr: "Bénin", en: "Benin" },
  "566": { fr: "Nigeria", en: "Nigeria" },
  "120": { fr: "Cameroun", en: "Cameroon" },
  "226": { fr: "Guinée Équatoriale", en: "Equatorial Guinea" },
  "148": { fr: "Tchad", en: "Chad" },
  "729": { fr: "Soudan", en: "Sudan" },
  "728": { fr: "Soudan du Sud", en: "South Sudan" },
  "231": { fr: "Éthiopie", en: "Ethiopia" },
  "232": { fr: "Érythrée", en: "Eritrea" },
  "262": { fr: "Djibouti", en: "Djibouti" },
  "706": { fr: "Somalie", en: "Somalia" },
  "404": { fr: "Kenya", en: "Kenya" },
  "800": { fr: "Ouganda", en: "Uganda" },
  "646": { fr: "Rwanda", en: "Rwanda" },
  "108": { fr: "Burundi", en: "Burundi" },
  "834": { fr: "Tanzanie", en: "Tanzania" },
  "180": { fr: "Rép. dém. du Congo", en: "Dem. Rep. Congo" },
  "178": { fr: "Congo", en: "Republic of Congo" },
  "266": { fr: "Gabon", en: "Gabon" },
  "140": { fr: "Centrafrique", en: "Central African Rep." },
  "024": { fr: "Angola", en: "Angola" },
  "894": { fr: "Zambie", en: "Zambia" },
  "454": { fr: "Malawi", en: "Malawi" },
  "508": { fr: "Mozambique", en: "Mozambique" },
  "716": { fr: "Zimbabwe", en: "Zimbabwe" },
  "072": { fr: "Botswana", en: "Botswana" },
  "516": { fr: "Namibie", en: "Namibia" },
  "710": { fr: "Afrique du Sud", en: "South Africa" },
  "426": { fr: "Lesotho", en: "Lesotho" },
  "748": { fr: "Eswatini", en: "Eswatini" },
  "450": { fr: "Madagascar", en: "Madagascar" },
  "682": { fr: "Arabie saoudite", en: "Saudi Arabia" },
  "784": { fr: "Émirats Arabes Unis", en: "United Arab Emirates" },
  "512": { fr: "Oman", en: "Oman" },
  "887": { fr: "Yémen", en: "Yemen" },
  "634": { fr: "Qatar", en: "Qatar" },
  "414": { fr: "Koweït", en: "Kuwait" },
  "368": { fr: "Irak", en: "Iraq" },
  "364": { fr: "Iran", en: "Iran" },
  "760": { fr: "Syrie", en: "Syria" },
  "400": { fr: "Jordanie", en: "Jordan" },
  "422": { fr: "Liban", en: "Lebanon" },
  "376": { fr: "Israël", en: "Israel" },
  "275": { fr: "Palestine", en: "Palestine" },
  "792": { fr: "Turquie", en: "Turkey" },
  "724": { fr: "Espagne", en: "Spain" },
  "620": { fr: "Portugal", en: "Portugal" },
  "250": { fr: "France", en: "France" },
  "380": { fr: "Italie", en: "Italy" },
  "300": { fr: "Grèce", en: "Greece" },
  "196": { fr: "Chypre", en: "Cyprus" },
};

export const ACTIVE_COUNTRY_COUNT = ACTIVE_COUNTRY_IDS.size;

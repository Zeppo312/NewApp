// Datenstruktur für den Geburtsplan

// 1. Allgemeine Angaben
export interface AllgemeineAngaben {
  mutterName: string;
  entbindungstermin: string;
  geburtsklinik: string;
  begleitpersonen: string;
}

// 2. Wünsche zur Geburt
export interface GeburtsWuensche {
  geburtspositionen: string[];
  schmerzmittel: string[];
  rolleBegleitperson: string;
  musikAtmosphaere: string[];
  sonstigeWuensche: string;
}

// 3. Medizinische Eingriffe & Maßnahmen
export interface MedizinischeEingriffe {
  wehenfoerderung: string;
  dammschnitt: string;
  monitoring: string;
  notkaiserschnitt: string;
  sonstigeEingriffe: string;
}

// 4. Nach der Geburt
export interface NachDerGeburt {
  bonding: boolean;
  stillen: boolean;
  plazenta: string;
  vitaminKGabe: string;
  sonstigeWuensche: string;
}

// 5. Für den Notfall / Kaiserschnitt
export interface Notfall {
  begleitpersonImOP: string;
  bondingImOP: boolean;
  fotoerlaubnis: string;
  sonstigeWuensche: string;
}

// 6. Sonstige Wünsche / Hinweise
export interface SonstigeWuensche {
  freitext: string;
}

// Gesamtstruktur des Geburtsplans
export interface GeburtsplanData {
  allgemeineAngaben: AllgemeineAngaben;
  geburtsWuensche: GeburtsWuensche;
  medizinischeEingriffe: MedizinischeEingriffe;
  nachDerGeburt: NachDerGeburt;
  notfall: Notfall;
  sonstigeWuensche: SonstigeWuensche;
}

// Standardwerte für einen neuen Geburtsplan
export const defaultGeburtsplan: GeburtsplanData = {
  allgemeineAngaben: {
    mutterName: '',
    entbindungstermin: '',
    geburtsklinik: '',
    begleitpersonen: '',
  },
  geburtsWuensche: {
    geburtspositionen: [],
    schmerzmittel: [],
    rolleBegleitperson: '',
    musikAtmosphaere: [],
    sonstigeWuensche: '',
  },
  medizinischeEingriffe: {
    wehenfoerderung: '',
    dammschnitt: '',
    monitoring: '',
    notkaiserschnitt: '',
    sonstigeEingriffe: '',
  },
  nachDerGeburt: {
    bonding: false,
    stillen: false,
    plazenta: '',
    vitaminKGabe: '',
    sonstigeWuensche: '',
  },
  notfall: {
    begleitpersonImOP: '',
    bondingImOP: false,
    fotoerlaubnis: '',
    sonstigeWuensche: '',
  },
  sonstigeWuensche: {
    freitext: '',
  },
};

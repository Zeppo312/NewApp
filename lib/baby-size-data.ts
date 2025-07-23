// Daten zur Größe und zum Gewicht des Babys in jeder Schwangerschaftswoche
export interface BabySizeData {
  week: number;
  length: string;
  weight: string;
  fruitComparison: string;
  description: string;
}

export const babySizeData: BabySizeData[] = [
  {
    week: 1,
    length: "0,1-0,2 mm",
    weight: "< 0,1 g",
    fruitComparison: "ein Mohnkorn",
    description: "In der ersten Woche findet die Befruchtung statt. Die befruchtete Eizelle beginnt sich zu teilen und wandert durch den Eileiter in die Gebärmutter."
  },
  {
    week: 2,
    length: "0,2 mm",
    weight: "< 0,1 g",
    fruitComparison: "ein Mohnkorn",
    description: "Die befruchtete Eizelle hat sich zu einer Blastozyste entwickelt und nistet sich in der Gebärmutterschleimhaut ein."
  },
  {
    week: 3,
    length: "0,4 mm",
    weight: "< 0,1 g",
    fruitComparison: "ein Sesamkorn",
    description: "Die Zellen beginnen sich zu differenzieren. Die Plazenta und die ersten Blutgefäße beginnen sich zu bilden."
  },
  {
    week: 4,
    length: "2-3 mm",
    weight: "< 0,1 g",
    fruitComparison: "ein Reiskorn",
    description: "Das Herz beginnt zu schlagen und die Grundlage für das Gehirn, die Wirbelsäule und das Nervensystem wird gelegt."
  },
  {
    week: 5,
    length: "4-5 mm",
    weight: "< 0,1 g",
    fruitComparison: "ein Reiskorn",
    description: "Die Augen, Ohren und Nase beginnen sich zu formen. Die Arme und Beine entwickeln sich als kleine Knospen."
  },
  {
    week: 6,
    length: "6-7 mm",
    weight: "0,1 g",
    fruitComparison: "eine Linse",
    description: "Das Herz schlägt nun regelmäßig. Die Finger und Zehen beginnen sich zu formen."
  },
  {
    week: 7,
    length: "1 cm",
    weight: "1 g",
    fruitComparison: "eine Himbeere",
    description: "Die Arme und Beine werden länger und die Finger und Zehen sind deutlicher zu erkennen. Die Gesichtszüge entwickeln sich weiter."
  },
  {
    week: 8,
    length: "1,6 cm",
    weight: "1 g",
    fruitComparison: "eine Weintraube",
    description: "Alle wichtigen Organe sind angelegt. Die Augen sind noch geschlossen, aber die Augenlider entwickeln sich."
  },
  {
    week: 9,
    length: "2,3 cm",
    weight: "2 g",
    fruitComparison: "eine Weintraube",
    description: "Das Baby beginnt, sich zu bewegen, obwohl du es noch nicht spüren kannst. Die Genitalien beginnen sich zu entwickeln."
  },
  {
    week: 10,
    length: "3,1 cm",
    weight: "4 g",
    fruitComparison: "eine Erdbeere",
    description: "Die Finger und Zehen sind nicht mehr durch Schwimmhäute verbunden. Die Nägel beginnen zu wachsen."
  },
  {
    week: 11,
    length: "4,1 cm",
    weight: "7 g",
    fruitComparison: "eine Feige",
    description: "Das Baby kann nun seinen Kopf beugen und die Finger öffnen und schließen. Die Geschlechtsorgane entwickeln sich weiter."
  },
  {
    week: 12,
    length: "5,4 cm",
    weight: "14 g",
    fruitComparison: "eine Limette",
    description: "Die Nieren produzieren Urin, der ins Fruchtwasser abgegeben wird. Die Reflexe beginnen sich zu entwickeln."
  },
  {
    week: 13,
    length: "7,4 cm",
    weight: "23 g",
    fruitComparison: "eine Zitrone",
    description: "Das Baby kann nun seine Finger bewegen und einen Faustschluss machen. Die Stimmbänder bilden sich."
  },
  {
    week: 14,
    length: "8,7 cm",
    weight: "43 g",
    fruitComparison: "eine Pfirsich",
    description: "Das Baby kann nun Gesichtsausdrücke machen und den Daumen lutschen. Die Lanugo-Behaarung beginnt zu wachsen."
  },
  {
    week: 15,
    length: "10,1 cm",
    weight: "70 g",
    fruitComparison: "eine Nektarine",
    description: "Die Knochen werden härter und die Muskeln stärker. Das Baby kann nun Fruchtwasser schlucken."
  },
  {
    week: 16,
    length: "11,6 cm",
    weight: "100 g",
    fruitComparison: "eine Avocado",
    description: "Die Augen können sich nun bewegen und reagieren auf Licht. Die Ohren haben ihre endgültige Position erreicht."
  },
  {
    week: 17,
    length: "13 cm",
    weight: "140 g",
    fruitComparison: "eine Birne",
    description: "Das Immunsystem beginnt sich zu entwickeln. Die Plazenta ist nun vollständig ausgebildet."
  },
  {
    week: 18,
    length: "14,2 cm",
    weight: "190 g",
    fruitComparison: "eine Süßkartoffel",
    description: "Das Baby kann nun gähnen und sich strecken. Die Fingerabdrücke sind vollständig ausgebildet."
  },
  {
    week: 19,
    length: "15,3 cm",
    weight: "240 g",
    fruitComparison: "eine Mango",
    description: "Das Vernix caseosa (eine weiße, käsige Substanz) beginnt, die Haut des Babys zu bedecken. Die Bewegungen werden stärker."
  },
  {
    week: 20,
    length: "16,4 cm",
    weight: "300 g",
    fruitComparison: "eine Banane",
    description: "Das Baby entwickelt einen regelmäßigen Schlaf-Wach-Rhythmus. Die Haare auf dem Kopf beginnen zu wachsen."
  },
  {
    week: 21,
    length: "26,7 cm",
    weight: "360 g",
    fruitComparison: "eine Karotte",
    description: "Die Augenbrauen und Wimpern sind nun sichtbar. Das Baby kann nun auf Geräusche von außen reagieren."
  },
  {
    week: 22,
    length: "27,8 cm",
    weight: "430 g",
    fruitComparison: "eine Papaya",
    description: "Die Augen sind vollständig ausgebildet, aber die Iris hat noch keine Farbe. Die Fingernägel haben die Fingerspitzen erreicht."
  },
  {
    week: 23,
    length: "28,9 cm",
    weight: "501 g",
    fruitComparison: "eine Mango",
    description: "Das Baby kann nun die Stimme der Mutter erkennen. Die Lungen beginnen, Surfactant zu produzieren."
  },
  {
    week: 24,
    length: "30 cm",
    weight: "600 g",
    fruitComparison: "ein Maiskolben",
    description: "Die Gesichtszüge sind nun deutlich zu erkennen. Das Baby kann nun blinzeln und die Augen öffnen."
  },
  {
    week: 25,
    length: "34,6 cm",
    weight: "660 g",
    fruitComparison: "ein Blumenkohl",
    description: "Das Baby reagiert nun auf Berührungen und kann Schmerz empfinden. Die Lungen entwickeln sich weiter."
  },
  {
    week: 26,
    length: "35,6 cm",
    weight: "760 g",
    fruitComparison: "eine Kokosnuss",
    description: "Die Augen öffnen sich. Das Baby kann nun Licht und Dunkelheit unterscheiden."
  },
  {
    week: 27,
    length: "36,6 cm",
    weight: "875 g",
    fruitComparison: "ein Kopfsalat",
    description: "Das Gehirn entwickelt sich rapide. Das Baby kann nun Schluckauf haben, den du als rhythmische Bewegungen spüren kannst."
  },
  {
    week: 28,
    length: "37,6 cm",
    weight: "1000 g",
    fruitComparison: "eine Aubergine",
    description: "Das Baby kann nun die Augen öffnen und schließen. Es kann auch träumen, was durch REM-Schlaf erkennbar ist."
  },
  {
    week: 29,
    length: "38,6 cm",
    weight: "1150 g",
    fruitComparison: "ein Kürbis",
    description: "Das Baby legt nun Fett an, was ihm hilft, die Körpertemperatur zu regulieren. Die Knochen sind vollständig ausgebildet, aber noch weich."
  },
  {
    week: 30,
    length: "39,9 cm",
    weight: "1300 g",
    fruitComparison: "ein Kohlkopf",
    description: "Das Baby kann nun Licht wahrnehmen und zur Lichtquelle blicken. Die Fingernägel haben die Fingerspitzen erreicht."
  },
  {
    week: 31,
    length: "41,1 cm",
    weight: "1500 g",
    fruitComparison: "ein Kokosnuss",
    description: "Das Immunsystem entwickelt sich weiter. Das Baby kann nun Geschmäcker unterscheiden."
  },
  {
    week: 32,
    length: "42,4 cm",
    weight: "1700 g",
    fruitComparison: "ein Kürbis",
    description: "Die Pupillen können sich nun verengen und erweitern. Das Baby nimmt eine Kopf-nach-unten-Position ein."
  },
  {
    week: 33,
    length: "43,7 cm",
    weight: "1900 g",
    fruitComparison: "eine Ananas",
    description: "Die Lungen sind fast vollständig entwickelt. Das Baby übt das Atmen, indem es Fruchtwasser ein- und ausatmet."
  },
  {
    week: 34,
    length: "45 cm",
    weight: "2150 g",
    fruitComparison: "eine Melone",
    description: "Das Baby hat nun Fingernägel, die bis zu den Fingerspitzen reichen. Die meisten Systeme sind vollständig entwickelt."
  },
  {
    week: 35,
    length: "46,2 cm",
    weight: "2400 g",
    fruitComparison: "eine Honigmelone",
    description: "Das Baby hat nun wenig Platz zum Bewegen und die Bewegungen können sich ändern. Die Nieren sind vollständig entwickelt."
  },
  {
    week: 36,
    length: "47,4 cm",
    weight: "2600 g",
    fruitComparison: "ein Romaine-Salat",
    description: "Das Baby hat nun wenig Lanugo-Haare und mehr Kopfhaare. Die Leber kann Abfallprodukte verarbeiten."
  },
  {
    week: 37,
    length: "48,6 cm",
    weight: "2900 g",
    fruitComparison: "ein Staudensellerie",
    description: "Das Baby gilt nun als termingerecht. Die Lungen sind bereit für die Außenwelt."
  },
  {
    week: 38,
    length: "49,8 cm",
    weight: "3100 g",
    fruitComparison: "ein Kürbis",
    description: "Das Baby legt weiterhin Fett an. Die Gehirnentwicklung setzt sich fort."
  },
  {
    week: 39,
    length: "50,7 cm",
    weight: "3300 g",
    fruitComparison: "eine Wassermelone",
    description: "Das Baby ist nun vollständig entwickelt und bereit für die Geburt. Die Nägel können über die Fingerspitzen hinausragen."
  },
  {
    week: 40,
    length: "51,2 cm",
    weight: "3400 g",
    fruitComparison: "eine Wassermelone",
    description: "Das Baby ist nun vollständig entwickelt und bereit für die Geburt. Die Plazenta liefert Antikörper, die dem Baby in den ersten Monaten nach der Geburt helfen."
  },
  {
    week: 41,
    length: "51,5 cm",
    weight: "3600 g",
    fruitComparison: "eine Wassermelone",
    description: "Das Baby ist nun vollständig entwickelt und bereit für die Geburt. Die Nägel können über die Fingerspitzen hinausragen."
  },
  {
    week: 42,
    length: "51,7 cm",
    weight: "3700 g",
    fruitComparison: "eine Wassermelone",
    description: "Das Baby ist nun vollständig entwickelt und bereit für die Geburt. Die Plazenta beginnt zu altern."
  }
];

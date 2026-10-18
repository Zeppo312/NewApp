export const BIRTH_PREP_SECTION_START_WEEK = 34;

export interface BirthPreparationMeasure {
  id: string;
  icon: string;
  title: string;
  benefit: string;
  startAt: string;
  frequency: string;
  caution: string;
}

export const birthPreparationMeasures: BirthPreparationMeasure[] = [
  {
    id: 'raspberry-leaf-tea',
    icon: '🍵',
    title: 'Himbeerblättertee',
    benefit: 'Wird in der Spätschwangerschaft oft zur sanften Vorbereitung genutzt.',
    startAt: 'Ab SSW 34-36, idealerweise nach Rücksprache mit Hebamme oder Gyn.',
    frequency: 'Langsam starten und nur in verträglicher Menge trinken.',
    caution: 'Nicht ohne Rücksprache bei Risikoschwangerschaft, Blutungen oder vorzeitigen Wehen.',
  },
  {
    id: 'walking',
    icon: '🚶',
    title: 'Spaziergänge & leichte Bewegung',
    benefit: 'Kann Wohlbefinden, Durchblutung und Beweglichkeit im Becken unterstützen.',
    startAt: 'Ab dem 3. Trimester, in den letzten Wochen besonders alltagstauglich.',
    frequency: 'Täglich kurze, angenehme Einheiten statt Überlastung.',
    caution: 'Bei Schwindel, Schmerzen, Kontraktionen oder Unwohlsein pausieren und abklären.',
  },
  {
    id: 'pelvic-circles',
    icon: '🧘',
    title: 'Beckenkreisen (z. B. auf dem Ball)',
    benefit: 'Kann Verspannungen im unteren Rücken lösen und das Becken mobil halten.',
    startAt: 'Ab SSW 34, wenn es sich stabil und angenehm anfühlt.',
    frequency: 'Mehrmals pro Woche in kurzen Sessions.',
    caution: 'Nur sicher und ohne Sturzrisiko; bei Beschwerden sofort stoppen.',
  },
  {
    id: 'perineal-massage',
    icon: '🤲',
    title: 'Damm-Massage',
    benefit: 'Kann das Gewebe auf die Geburt vorbereiten.',
    startAt: 'Häufig ab etwa SSW 34-35 empfohlen.',
    frequency: 'Regelmäßig in kurzen Einheiten, wenn es angenehm ist.',
    caution: 'Bei Infektionen, Schmerzen oder Unsicherheit vorher fachlich abklären.',
  },
  {
    id: 'breathing-relaxation',
    icon: '🌬️',
    title: 'Atem- und Entspannungsübungen',
    benefit: 'Hilft, Ruhe zu finden und kann unter Wehen besser abrufbar sein.',
    startAt: 'Jederzeit sinnvoll, in den letzten Wochen besonders hilfreich.',
    frequency: 'Täglich wenige Minuten in den Alltag einbauen.',
    caution: 'Wenn Übungen Stress auslösen: vereinfachen oder mit Anleitung durchführen.',
  },
];

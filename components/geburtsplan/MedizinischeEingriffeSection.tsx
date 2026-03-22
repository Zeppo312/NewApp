import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { MedizinischeEingriffe } from '@/types/geburtsplan';

interface MedizinischeEingriffeSectionProps {
  data: MedizinischeEingriffe;
  onChange: (data: MedizinischeEingriffe) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const MedizinischeEingriffeSection: React.FC<MedizinischeEingriffeSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  // Wehenförderung
  const wehenfoerderungOptions = [
    'Nur wenn medizinisch nötig',
    'keine künstliche Einleitung',
    'Offen für medizinische Empfehlungen'
  ];
  
  const selectWehenfoerderung = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      wehenfoerderung: option,
    });
  };

  // Dammschnitt / -massage
  const dammschnittOptions = [
    'Möglichst vermeiden',
    'akzeptabel wenn notwendig',
    'Nach ärztlicher Empfehlung'
  ];
  
  const selectDammschnitt = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      dammschnitt: option,
    });
  };

  // Monitoring
  const monitoringOptions = [
    'Mobil bleiben, CTG nur zeitweise',
    'Dauer-CTG ok',
    'Nach medizinischer Notwendigkeit'
  ];
  
  const selectMonitoring = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      monitoring: option,
    });
  };

  // Notkaiserschnitt
  const notkaiserschnittOptions = [
    'Nur als letzte Option',
    'offen dafür',
    'Nach medizinischer Notwendigkeit'
  ];
  
  const selectNotkaiserschnitt = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      notkaiserschnitt: option,
    });
  };

  return (
    <GeburtsplanSection title="3. Medizinische Eingriffe & Maßnahmen" containerStyle={containerStyle}>
      <OptionGroup label="Wehenförderung">
        {wehenfoerderungOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.wehenfoerderung === option}
            onSelect={() => selectWehenfoerderung(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Dammschnitt / -massage">
        {dammschnittOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.dammschnitt === option}
            onSelect={() => selectDammschnitt(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Monitoring">
        {monitoringOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.monitoring === option}
            onSelect={() => selectMonitoring(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Notkaiserschnitt">
        {notkaiserschnittOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.notkaiserschnitt === option}
            onSelect={() => selectNotkaiserschnitt(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label="Sonstige Eingriffe / Anmerkungen"
        value={data.sonstigeEingriffe}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeEingriffe: text });
        }}
        multiline
        numberOfLines={3}
        placeholder="Hier kannst du weitere Wünsche zu medizinischen Eingriffen eintragen..."
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

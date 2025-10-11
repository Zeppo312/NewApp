import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { GeburtsWuensche } from '@/types/geburtsplan';

interface GeburtsWuenscheSectionProps {
  data: GeburtsWuensche;
  onChange: (data: GeburtsWuensche) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const GeburtsWuenscheSection: React.FC<GeburtsWuenscheSectionProps> = ({ data, onChange, containerStyle }) => {
  // Geburtspositionen
  const geburtspositionenOptions = ['Stehend', 'Hocken', 'Vierfüßler', 'im Wasser', 'flexibel'];
  
  const toggleGeburtsposition = (option: string) => {
    const newPositionen = data.geburtspositionen.includes(option)
      ? data.geburtspositionen.filter(pos => pos !== option)
      : [...data.geburtspositionen, option];
    
    onChange({
      ...data,
      geburtspositionen: newPositionen,
    });
  };

  // Schmerzmittel
  const schmerzmittelOptions = ['Ohne Schmerzmittel', 'PDA', 'TENS', 'Lachgas', 'offen für alles'];
  
  const toggleSchmerzmittel = (option: string) => {
    const newSchmerzmittel = data.schmerzmittel.includes(option)
      ? data.schmerzmittel.filter(sm => sm !== option)
      : [...data.schmerzmittel, option];
    
    onChange({
      ...data,
      schmerzmittel: newSchmerzmittel,
    });
  };

  // Rolle der Begleitperson
  const rolleOptions = ['Aktiv unterstützen', 'eher passiv', 'jederzeit ansprechbar'];
  
  const selectRolle = (option: string) => {
    onChange({
      ...data,
      rolleBegleitperson: option,
    });
  };

  // Musik / Atmosphäre
  const atmosphaereOptions = ['Eigene Musik', 'ruhige Umgebung', 'gedimmtes Licht'];
  
  const toggleAtmosphaere = (option: string) => {
    const newAtmosphaere = data.musikAtmosphaere.includes(option)
      ? data.musikAtmosphaere.filter(atm => atm !== option)
      : [...data.musikAtmosphaere, option];
    
    onChange({
      ...data,
      musikAtmosphaere: newAtmosphaere,
    });
  };

  return (
    <GeburtsplanSection title="2. Wünsche zur Geburt" containerStyle={containerStyle}>
      <OptionGroup label="Geburtspositionen">
        {geburtspositionenOptions.map((option) => (
          <CheckboxOption
            key={option}
            label={option}
            checked={data.geburtspositionen.includes(option)}
            onToggle={() => toggleGeburtsposition(option)}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Schmerzmittel">
        {schmerzmittelOptions.map((option) => (
          <CheckboxOption
            key={option}
            label={option}
            checked={data.schmerzmittel.includes(option)}
            onToggle={() => toggleSchmerzmittel(option)}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Rolle der Begleitperson">
        {rolleOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.rolleBegleitperson === option}
            onSelect={() => selectRolle(option)}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Musik / Atmosphäre">
        {atmosphaereOptions.map((option) => (
          <CheckboxOption
            key={option}
            label={option}
            checked={data.musikAtmosphaere.includes(option)}
            onToggle={() => toggleAtmosphaere(option)}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label="Sonstige Wünsche zur Geburt"
        value={data.sonstigeWuensche}
        onChangeText={(text) => onChange({ ...data, sonstigeWuensche: text })}
        multiline
        numberOfLines={3}
        placeholder="Hier kannst du weitere Wünsche zur Geburt eintragen..."
      />
    </GeburtsplanSection>
  );
};

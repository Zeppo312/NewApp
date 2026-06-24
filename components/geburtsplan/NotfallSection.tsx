import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { Notfall } from '@/types/geburtsplan';

interface NotfallSectionProps {
  data: Notfall;
  onChange: (data: Notfall) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const NotfallSection: React.FC<NotfallSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  // Begleitperson im OP
  const begleitpersonOptions = ['Ja', 'Nein', 'wenn möglich'];
  
  const selectBegleitperson = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      begleitpersonImOP: option,
    });
  };

  // Bonding im OP
  const toggleBondingImOP = () => {
    if (readOnly) return;
    onChange({
      ...data,
      bondingImOP: !data.bondingImOP,
    });
  };

  // Fotoerlaubnis
  const fotoerlaubnisOptions = ['Ja', 'Nein', 'nur nach Absprache'];
  
  const selectFotoerlaubnis = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      fotoerlaubnis: option,
    });
  };

  return (
    <GeburtsplanSection title="5. Für den Notfall / Kaiserschnitt" containerStyle={containerStyle}>
      <OptionGroup label="Begleitperson im OP">
        {begleitpersonOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.begleitpersonImOP === option}
            onSelect={() => selectBegleitperson(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Bonding im OP">
        <CheckboxOption
          label="Möglichst früh"
          checked={data.bondingImOP}
          onToggle={toggleBondingImOP}
          disabled={readOnly}
        />
      </OptionGroup>

      <OptionGroup label="Fotoerlaubnis">
        {fotoerlaubnisOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.fotoerlaubnis === option}
            onSelect={() => selectFotoerlaubnis(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label="Sonstige Wünsche für den Notfall"
        value={data.sonstigeWuensche}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeWuensche: text });
        }}
        multiline
        numberOfLines={3}
        placeholder="Hier kannst du weitere Wünsche für den Notfall eintragen..."
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

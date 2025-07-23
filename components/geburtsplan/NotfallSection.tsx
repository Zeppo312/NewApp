import React from 'react';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { Notfall } from '@/types/geburtsplan';

interface NotfallSectionProps {
  data: Notfall;
  onChange: (data: Notfall) => void;
}

export const NotfallSection: React.FC<NotfallSectionProps> = ({ data, onChange }) => {
  // Begleitperson im OP
  const begleitpersonOptions = ['Ja', 'Nein', 'wenn möglich'];
  
  const selectBegleitperson = (option: string) => {
    onChange({
      ...data,
      begleitpersonImOP: option,
    });
  };

  // Bonding im OP
  const toggleBondingImOP = () => {
    onChange({
      ...data,
      bondingImOP: !data.bondingImOP,
    });
  };

  // Fotoerlaubnis
  const fotoerlaubnisOptions = ['Ja', 'Nein', 'nur nach Absprache'];
  
  const selectFotoerlaubnis = (option: string) => {
    onChange({
      ...data,
      fotoerlaubnis: option,
    });
  };

  return (
    <GeburtsplanSection title="5. Für den Notfall / Kaiserschnitt">
      <OptionGroup label="Begleitperson im OP">
        {begleitpersonOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.begleitpersonImOP === option}
            onSelect={() => selectBegleitperson(option)}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Bonding im OP">
        <CheckboxOption
          label="Möglichst früh"
          checked={data.bondingImOP}
          onToggle={toggleBondingImOP}
        />
      </OptionGroup>

      <OptionGroup label="Fotoerlaubnis">
        {fotoerlaubnisOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.fotoerlaubnis === option}
            onSelect={() => selectFotoerlaubnis(option)}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label="Sonstige Wünsche für den Notfall"
        value={data.sonstigeWuensche}
        onChangeText={(text) => onChange({ ...data, sonstigeWuensche: text })}
        multiline
        numberOfLines={3}
        placeholder="Hier kannst du weitere Wünsche für den Notfall eintragen..."
      />
    </GeburtsplanSection>
  );
};

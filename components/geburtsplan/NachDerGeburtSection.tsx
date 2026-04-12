import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { NachDerGeburt } from '@/types/geburtsplan';

interface NachDerGeburtSectionProps {
  data: NachDerGeburt;
  onChange: (data: NachDerGeburt) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const NachDerGeburtSection: React.FC<NachDerGeburtSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  // Bonding
  const toggleBonding = () => {
    if (readOnly) return;
    onChange({
      ...data,
      bonding: !data.bonding,
    });
  };

  // Stillen
  const toggleStillen = () => {
    if (readOnly) return;
    onChange({
      ...data,
      stillen: !data.stillen,
    });
  };

  // Plazenta
  const plazentaOptions = [
    'Natürlich gebären',
    'keine Routine-Injektion',
    'Nach medizinischer Empfehlung'
  ];
  
  const selectPlazenta = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      plazenta: option,
    });
  };

  // Vitamin-K-Gabe
  const vitaminKOptions = ['Ja', 'Nein', 'Besprechen'];
  
  const selectVitaminK = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      vitaminKGabe: option,
    });
  };

  return (
    <GeburtsplanSection title="4. Nach der Geburt" containerStyle={containerStyle}>
      <OptionGroup label="Bonding">
        <CheckboxOption
          label="Haut-zu-Haut-Kontakt direkt nach Geburt"
          checked={data.bonding}
          onToggle={toggleBonding}
          disabled={readOnly}
        />
      </OptionGroup>

      <OptionGroup label="Stillen">
        <CheckboxOption
          label="Sofortiges Stillen, Unterstützung erwünscht"
          checked={data.stillen}
          onToggle={toggleStillen}
          disabled={readOnly}
        />
      </OptionGroup>

      <OptionGroup label="Plazenta">
        {plazentaOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.plazenta === option}
            onSelect={() => selectPlazenta(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label="Vitamin-K-Gabe fürs Baby">
        {vitaminKOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.vitaminKGabe === option}
            onSelect={() => selectVitaminK(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label="Sonstige Wünsche nach der Geburt"
        value={data.sonstigeWuensche}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeWuensche: text });
        }}
        multiline
        numberOfLines={3}
        placeholder="Hier kannst du weitere Wünsche für die Zeit nach der Geburt eintragen..."
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

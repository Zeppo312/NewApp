import React from 'react';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { NachDerGeburt } from '@/types/geburtsplan';

interface NachDerGeburtSectionProps {
  data: NachDerGeburt;
  onChange: (data: NachDerGeburt) => void;
}

export const NachDerGeburtSection: React.FC<NachDerGeburtSectionProps> = ({ data, onChange }) => {
  // Bonding
  const toggleBonding = () => {
    onChange({
      ...data,
      bonding: !data.bonding,
    });
  };

  // Stillen
  const toggleStillen = () => {
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
    onChange({
      ...data,
      plazenta: option,
    });
  };

  // Vitamin-K-Gabe
  const vitaminKOptions = ['Ja', 'Nein', 'Besprechen'];
  
  const selectVitaminK = (option: string) => {
    onChange({
      ...data,
      vitaminKGabe: option,
    });
  };

  return (
    <GeburtsplanSection title="4. Nach der Geburt">
      <OptionGroup label="Bonding">
        <CheckboxOption
          label="Haut-zu-Haut-Kontakt direkt nach Geburt"
          checked={data.bonding}
          onToggle={toggleBonding}
        />
      </OptionGroup>

      <OptionGroup label="Stillen">
        <CheckboxOption
          label="Sofortiges Stillen, Unterstützung erwünscht"
          checked={data.stillen}
          onToggle={toggleStillen}
        />
      </OptionGroup>

      <OptionGroup label="Plazenta">
        {plazentaOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={data.plazenta === option}
            onSelect={() => selectPlazenta(option)}
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
          />
        ))}
      </OptionGroup>

      <TextInputField
        label="Sonstige Wünsche nach der Geburt"
        value={data.sonstigeWuensche}
        onChangeText={(text) => onChange({ ...data, sonstigeWuensche: text })}
        multiline
        numberOfLines={3}
        placeholder="Hier kannst du weitere Wünsche für die Zeit nach der Geburt eintragen..."
      />
    </GeburtsplanSection>
  );
};

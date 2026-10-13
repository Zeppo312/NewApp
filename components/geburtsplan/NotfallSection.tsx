import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { Notfall } from '@/types/geburtsplan';
import { useLocale } from '@/contexts/LocaleContext';
import { getBirthPlanOptions, localizeBirthPlanOptionValue, translateBirthPlanText } from '@/lib/birthPlanTranslations';

interface NotfallSectionProps {
  data: Notfall;
  onChange: (data: Notfall) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const NotfallSection: React.FC<NotfallSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateBirthPlanText>[1]) => translateBirthPlanText(locale, key);
  // Begleitperson im OP
  const begleitpersonOptions = getBirthPlanOptions(locale, 'yesNoIfPossible').map(({ label }) => label);
  
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
  const fotoerlaubnisOptions = getBirthPlanOptions(locale, 'yesNoByAgreement').map(({ label }) => label);
  
  const selectFotoerlaubnis = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      fotoerlaubnis: option,
    });
  };

  return (
    <GeburtsplanSection title={t('section.emergency')} containerStyle={containerStyle}>
      <OptionGroup label={t('emergency.companion')}>
        {begleitpersonOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.begleitpersonImOP) === option}
            onSelect={() => selectBegleitperson(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('emergency.bonding')}>
        <CheckboxOption
          label={t('emergency.bondingEarly')}
          checked={data.bondingImOP}
          onToggle={toggleBondingImOP}
          disabled={readOnly}
        />
      </OptionGroup>

      <OptionGroup label={t('emergency.photos')}>
        {fotoerlaubnisOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.fotoerlaubnis) === option}
            onSelect={() => selectFotoerlaubnis(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label={t('emergency.other')}
        value={data.sonstigeWuensche}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeWuensche: text });
        }}
        multiline
        numberOfLines={3}
        placeholder={t('emergency.otherPlaceholder')}
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { NachDerGeburt } from '@/types/geburtsplan';
import { useLocale } from '@/contexts/LocaleContext';
import { getBirthPlanOptions, localizeBirthPlanOptionValue, translateBirthPlanText } from '@/lib/birthPlanTranslations';

interface NachDerGeburtSectionProps {
  data: NachDerGeburt;
  onChange: (data: NachDerGeburt) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const NachDerGeburtSection: React.FC<NachDerGeburtSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateBirthPlanText>[1]) => translateBirthPlanText(locale, key);
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
  const plazentaOptions = getBirthPlanOptions(locale, 'placenta').map(({ label }) => label);
  
  const selectPlazenta = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      plazenta: option,
    });
  };

  // Vitamin-K-Gabe
  const vitaminKOptions = getBirthPlanOptions(locale, 'yesNoDiscuss').map(({ label }) => label);
  
  const selectVitaminK = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      vitaminKGabe: option,
    });
  };

  return (
    <GeburtsplanSection title={t('section.afterBirth')} containerStyle={containerStyle}>
      <OptionGroup label={t('afterBirth.bonding')}>
        <CheckboxOption
          label={t('afterBirth.skinToSkin')}
          checked={data.bonding}
          onToggle={toggleBonding}
          disabled={readOnly}
        />
      </OptionGroup>

      <OptionGroup label={t('afterBirth.breastfeeding')}>
        <CheckboxOption
          label={t('afterBirth.breastfeedingImmediate')}
          checked={data.stillen}
          onToggle={toggleStillen}
          disabled={readOnly}
        />
      </OptionGroup>

      <OptionGroup label={t('afterBirth.placenta')}>
        {plazentaOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.plazenta) === option}
            onSelect={() => selectPlazenta(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('afterBirth.vitaminK')}>
        {vitaminKOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.vitaminKGabe) === option}
            onSelect={() => selectVitaminK(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label={t('afterBirth.other')}
        value={data.sonstigeWuensche}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeWuensche: text });
        }}
        multiline
        numberOfLines={3}
        placeholder={t('afterBirth.otherPlaceholder')}
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

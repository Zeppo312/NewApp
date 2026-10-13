import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { MedizinischeEingriffe } from '@/types/geburtsplan';
import { useLocale } from '@/contexts/LocaleContext';
import { getBirthPlanOptions, localizeBirthPlanOptionValue, translateBirthPlanText } from '@/lib/birthPlanTranslations';

interface MedizinischeEingriffeSectionProps {
  data: MedizinischeEingriffe;
  onChange: (data: MedizinischeEingriffe) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const MedizinischeEingriffeSection: React.FC<MedizinischeEingriffeSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateBirthPlanText>[1]) => translateBirthPlanText(locale, key);
  // Wehenförderung
  const wehenfoerderungOptions = getBirthPlanOptions(locale, 'induction').map(({ label }) => label);
  
  const selectWehenfoerderung = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      wehenfoerderung: option,
    });
  };

  // Dammschnitt / -massage
  const dammschnittOptions = getBirthPlanOptions(locale, 'episiotomy').map(({ label }) => label);
  
  const selectDammschnitt = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      dammschnitt: option,
    });
  };

  // Monitoring
  const monitoringOptions = getBirthPlanOptions(locale, 'monitoring').map(({ label }) => label);
  
  const selectMonitoring = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      monitoring: option,
    });
  };

  // Notkaiserschnitt
  const notkaiserschnittOptions = getBirthPlanOptions(locale, 'emergencyCSection').map(({ label }) => label);
  
  const selectNotkaiserschnitt = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      notkaiserschnitt: option,
    });
  };

  return (
    <GeburtsplanSection title={t('section.interventions')} containerStyle={containerStyle}>
      <OptionGroup label={t('interventions.induction')}>
        {wehenfoerderungOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.wehenfoerderung) === option}
            onSelect={() => selectWehenfoerderung(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('interventions.episiotomy')}>
        {dammschnittOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.dammschnitt) === option}
            onSelect={() => selectDammschnitt(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('interventions.monitoring')}>
        {monitoringOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.monitoring) === option}
            onSelect={() => selectMonitoring(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('interventions.emergencyCSection')}>
        {notkaiserschnittOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.notkaiserschnitt) === option}
            onSelect={() => selectNotkaiserschnitt(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label={t('interventions.other')}
        value={data.sonstigeEingriffe}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeEingriffe: text });
        }}
        multiline
        numberOfLines={3}
        placeholder={t('interventions.otherPlaceholder')}
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

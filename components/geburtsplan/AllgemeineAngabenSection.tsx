import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { TextInputField } from './TextInputField';
import { AllgemeineAngaben } from '@/types/geburtsplan';
import { useLocale } from '@/contexts/LocaleContext';
import { translateBirthPlanText } from '@/lib/birthPlanTranslations';

interface AllgemeineAngabenSectionProps {
  data: AllgemeineAngaben;
  onChange: (data: AllgemeineAngaben) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const AllgemeineAngabenSection: React.FC<AllgemeineAngabenSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateBirthPlanText>[1]) => translateBirthPlanText(locale, key);
  const handleChange = (field: keyof AllgemeineAngaben, value: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <GeburtsplanSection title={t('section.general')} containerStyle={containerStyle}>
      <TextInputField
        label={t('general.motherName')}
        value={data.mutterName}
        onChangeText={(text) => handleChange('mutterName', text)}
        placeholder={t('general.motherNamePlaceholder')}
        readOnly={readOnly}
      />
      <TextInputField
        label={t('general.dueDate')}
        value={data.entbindungstermin}
        onChangeText={(text) => handleChange('entbindungstermin', text)}
        placeholder={t('general.dueDatePlaceholder')}
        readOnly={readOnly}
      />
      <TextInputField
        label={t('general.place')}
        value={data.geburtsklinik}
        onChangeText={(text) => handleChange('geburtsklinik', text)}
        placeholder={t('general.placePlaceholder')}
        readOnly={readOnly}
      />
      <TextInputField
        label={t('general.companions')}
        value={data.begleitpersonen}
        onChangeText={(text) => handleChange('begleitpersonen', text)}
        placeholder={t('general.companionsPlaceholder')}
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};

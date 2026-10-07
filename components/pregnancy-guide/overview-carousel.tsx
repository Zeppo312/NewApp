import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { HomeCarouselDots } from '@/components/ui/home-overview';
import { useLocale } from '@/contexts/LocaleContext';
import { translatePregnancyHomeText } from '@/lib/pregnancyHomeTranslations';
import { useOverviewColors } from './overview-card';

export default function PregnancyOverviewCarousel({ height, children }: { height: number; children: React.ReactNode }) {
  const { locale } = useLocale(); const c = useOverviewColors(); const focused = useIsFocused();
  const slides = React.Children.toArray(children); const count = slides.length;
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0); const [index, setIndex] = useState(0);
  const currentIndex = useRef(index); const [autoRotate, setAutoRotate] = useState(true);
  useEffect(() => { currentIndex.current = index; }, [index]);
  useEffect(() => { if (width) scroll.current?.scrollTo({ x: width * currentIndex.current, animated: false }); }, [width]);
  useEffect(() => {
    if (!width || !autoRotate || !focused || count < 2) return;
    const timer = setInterval(() => {
      const next = (currentIndex.current + 1) % count;
      currentIndex.current = next; setIndex(next); scroll.current?.scrollTo({ x: width * next, animated: true });
    }, 20000);
    return () => clearInterval(timer);
  }, [width, autoRotate, focused, count]);
  return <View testID="pregnancy-overview" style={styles.section} onLayout={event => {
    const next = event.nativeEvent.layout.width; if (next > 0) setWidth(next);
  }}>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} ref={scroll}
      testID="pregnancy-overview-carousel" style={{ width: '100%', height }} contentContainerStyle={{ alignItems: 'flex-start' }}
      onTouchStart={() => setAutoRotate(false)} onScrollBeginDrag={() => setAutoRotate(false)} decelerationRate="fast"
      onMomentumScrollEnd={event => {
        if (!width) return;
        const next = Math.min(count - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width)));
        currentIndex.current = next; setIndex(next);
      }} scrollEventThrottle={16}>
      {slides.map((slide, slideIndex) => <View key={slideIndex} testID={`pregnancy-overview-slide-${slideIndex}`}
        style={{ width: width || '100%', height, flexShrink: 0 }}>{slide}</View>)}
    </ScrollView>
    <HomeCarouselDots count={count} index={index} dark={c.dark}
      getLabel={dot => translatePregnancyHomeText(locale, 'overview.slide', { current: dot + 1, total: count })}
      onSelect={dot => {
        setAutoRotate(false); if (!width) return;
        currentIndex.current = dot; setIndex(dot); scroll.current?.scrollTo({ x: width * dot, animated: true });
      }} />
  </View>;
}
const styles = StyleSheet.create({
  section: { marginBottom: 16 },
});

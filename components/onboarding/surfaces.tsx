import React, { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, Easing, FadeIn, FadeInDown, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { GlassCard } from '@/components/ui/GlassCard';
import { onboardingColors as brand } from './theme';

export function OnboardingSurface({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  return <GlassCard intensity={65} tint="systemUltraThinMaterialLight" radius={24} skipAndroidBlur
    frostColor="rgba(255,255,255,0.24)" toneColor={tone}
    borderColor="rgba(255,255,255,0.82)" innerBorderColor="rgba(255,255,255,0.40)"
    highlightStrength="subtle" grainOpacity={0} shadeOpacity={0.14} glossOpacity={0.45}
    contentStyle={style}>{children}</GlassCard>;
}

export function OnboardingChoice({ children, selected = false, tone, contentStyle, ...props }: Omit<PressableProps, 'children' | 'style'> & {
  children: React.ReactNode; selected?: boolean; tone?: string; contentStyle?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return <Pressable {...props} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    accessibilityRole={props.accessibilityRole ?? 'button'} accessibilityState={{ ...props.accessibilityState, selected }}>
    <Animated.View style={{ transform: [{ scale: pressed && !reduced ? 0.97 : 1 }], transitionProperty: 'transform', transitionDuration: reduced ? 0 : 120, transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1) }}>
      <GlassCard intensity={65} tint="systemUltraThinMaterialLight" radius={24} skipAndroidBlur
        borderColor={selected ? 'rgba(142,78,198,0.62)' : 'rgba(255,255,255,0.82)'}
        innerBorderColor="rgba(255,255,255,0.40)" frostColor="rgba(255,255,255,0.20)"
        toneColor={selected ? brand.selectedGlass : tone}
        highlightStrength="subtle" grainOpacity={0} shadeOpacity={0.14} glossOpacity={0.45} contentStyle={contentStyle}>
        {children}
      </GlassCard>
    </Animated.View>
  </Pressable>;
}

/** Only the question changes; keyboard and persistent navigation stay mounted. */
export function OnboardingTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const entrance = reduced ? FadeIn.duration(120) : FadeInDown.duration(220).easing(Easing.bezier(0.23, 1, 0.32, 1));
  return <Animated.View style={{ flexGrow: 1, flexShrink: 0 }} entering={entrance.reduceMotion(ReduceMotion.System)}>{children}</Animated.View>;
}

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  visible: boolean;
  bgColor?: string;          // hex wie "#8E4EC6" oder "rgba(...)"
  emoji?: string;
  title?: string;
  subtitle?: string;
  status?: string;
  hint?: string;
  durationMs?: number;       // auto-hide
  onHide?: () => void;
};

export default function SplashOverlay({
  visible,
  bgColor = 'rgba(94,61,179,0.95)',
  emoji = '✅',
  title,
  subtitle,
  status,
  hint,
  durationMs = 3500,
  onHide,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    bump.setValue(0.9);

    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(bump, { toValue: 1.1, duration: 220, useNativeDriver: true }),
      Animated.spring(bump, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => onHide?.());
    }, durationMs);

    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]} pointerEvents="none">
      <LinearGradient colors={[bgColor, bgColor]} style={StyleSheet.absoluteFillObject as any} />
      <View style={styles.center}>
        <Animated.View style={[styles.emojiRing, { transform: [{ scale: bump }] }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </Animated.View>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {hint ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintText}>♡  {hint}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:9999, alignItems:'center', justifyContent:'center' },
  center: { width:'100%', paddingHorizontal:28, alignItems:'center' },
  emojiRing:{ width:140, height:140, borderRadius:70, borderWidth:2, borderColor:'rgba(255,255,255,0.7)', alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.08)' },
  emoji:{ fontSize:72, color:'#fff' },
  title:{ fontSize:34, fontWeight:'800', color:'#fff', textAlign:'center', marginTop:8, textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  subtitle:{ marginTop:16, fontSize:18, lineHeight:26, color:'rgba(255,255,255,0.95)', textAlign:'center' },
  status:{ marginTop:30, fontSize:16, color:'rgba(255,255,255,0.9)', textAlign:'center' },
  hintCard:{ marginTop:24, backgroundColor:'rgba(255,255,255,0.16)', borderColor:'rgba(255,255,255,0.35)', borderWidth:1, paddingHorizontal:20, paddingVertical:14, borderRadius:18 },
  hintText:{ color:'#fff', fontSize:16, textAlign:'center', fontWeight:'700' },
});


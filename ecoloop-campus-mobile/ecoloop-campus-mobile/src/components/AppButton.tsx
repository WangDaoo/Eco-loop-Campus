import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme/colors';

export function AppButton({ title, onPress, variant = 'primary', disabled = false }: { title: string; onPress: () => void; variant?: 'primary' | 'light'; disabled?: boolean }) {
  const light = variant === 'light';
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[styles.button, light && styles.light, disabled && styles.disabled]} disabled={disabled}>
      <Text style={[styles.text, light && styles.lightText, disabled && styles.disabledText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.coral, borderRadius: radius.xl, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  light: { backgroundColor: colors.white },
  disabled: { opacity: 0.5 },
  text: { color: colors.white, fontWeight: '800', fontSize: 16 },
  lightText: { color: colors.coralDark },
  disabledText: { color: colors.muted }
});

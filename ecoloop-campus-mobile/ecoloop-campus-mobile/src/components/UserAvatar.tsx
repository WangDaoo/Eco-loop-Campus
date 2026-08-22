import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Svg, Rect, Path, Circle, Ellipse } from 'react-native-svg';

export type AvatarOption = {
  key: string;
  label: string;
  background: string;
  tile: string;
  accent: string;
  face: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: 'sprout', label: 'Mầm xanh', background: '#cbf9e4', tile: '#a8f2ab', accent: '#8bc34a', face: '#2c6e6e' },
  { key: 'sunny', label: 'Nắng xanh', background: '#fff1a8', tile: '#c8f4a6', accent: '#f0b84f', face: '#2c6e6e' },
  { key: 'wave', label: 'Biển sạch', background: '#bcefff', tile: '#91e0f2', accent: '#38a3c7', face: '#256a7a' },
  { key: 'berry', label: 'Hoa campus', background: '#f7c4df', tile: '#d5f6b8', accent: '#d8669f', face: '#2c6e6e' },
];

export function resolveAvatarOption(avatarKey?: string) {
  return AVATAR_OPTIONS.find(option => option.key === avatarKey) || AVATAR_OPTIONS[0];
}

type Props = {
  avatarKey?: string;
  avatarUrl?: string;
  size?: number;
};

export function UserAvatar({ avatarKey, avatarUrl, size = 224 }: Props) {
  const option = resolveAvatarOption(avatarKey);
  const outerRadius = Math.max(24, Math.round(size * 0.18));
  const innerRadius = Math.max(20, Math.round(size * 0.14));
  const avatarFrameBleed = Math.max(4, Math.round(size * 0.07));
  const avatarInnerPadding = Math.max(4, Math.round(size * 0.055));

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: outerRadius }]}>
      <View style={[styles.bgWhite, { borderRadius: outerRadius, top: -avatarFrameBleed, left: -avatarFrameBleed, right: -avatarFrameBleed, bottom: -avatarFrameBleed }]} />
      <View style={[styles.inner, { backgroundColor: option.background, borderRadius: innerRadius, padding: avatarInnerPadding }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <Svg viewBox="0 0 100 100" width="100%" height="100%">
            <Rect x="0" y="0" width="100" height="100" fill={option.tile} />
            <Path d="M50 15 C 20 15, 10 40, 10 60 C 10 80, 25 90, 50 90 C 75 90, 90 80, 90 60 C 90 40, 80 15, 50 15 Z" fill="none" stroke={option.face} strokeWidth="4" />
            <Circle cx="15" cy="55" r="9" fill="white" stroke={option.face} strokeWidth="4" />
            <Circle cx="85" cy="55" r="9" fill="white" stroke={option.face} strokeWidth="4" />
            <Path d="M50 15 C 20 15, 10 40, 10 60 C 10 80, 25 90, 50 90 C 75 90, 90 80, 90 60 C 90 40, 80 15, 50 15 Z" fill="white" />
            <Ellipse cx="38" cy="45" rx="5" ry="3" fill={option.face} transform="rotate(20 38 45)" />
            <Ellipse cx="62" cy="45" rx="5" ry="3" fill={option.face} transform="rotate(-20 62 45)" />
            <Path d="M45 52 Q 50 56 55 52" fill="none" stroke={option.face} strokeWidth="3" strokeLinecap="round" />
            <Path d="M48 15 Q 50 5 52 15" fill="none" stroke={option.accent} strokeWidth="4" strokeLinecap="round" />
            <Path d="M70 15 C 75 10, 85 10, 80 20 C 75 25, 65 20, 70 15 Z" fill="none" stroke={option.accent} strokeWidth="3" />
            <Path d="M80 25 C 85 20, 95 20, 90 30 C 85 35, 75 30, 80 25 Z" fill="none" stroke={option.accent} strokeWidth="3" />
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bgWhite: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  inner: {
    width: '100%',
    height: '100%',
    borderWidth: 4,
    borderColor: '#2c6e6e',
    overflow: 'hidden',
    zIndex: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
});

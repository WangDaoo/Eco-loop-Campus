import React from 'react';
import { View, StyleSheet, ViewProps, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const BOTTOM_TAB_BAR_HEIGHT = 96;
export const DEFAULT_BOTTOM_CLEARANCE = BOTTOM_TAB_BAR_HEIGHT + 24;

interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  noPadding?: boolean;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomClearance?: number;
}

export function Screen({
  children,
  style,
  noPadding = false,
  scroll = false,
  contentContainerStyle,
  bottomClearance = DEFAULT_BOTTOM_CLEARANCE,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + 12;
  const bottomPadding = insets.bottom + bottomClearance;
  const content = (
    <View style={[scroll ? styles.scrollInner : styles.container, !noPadding && styles.padding, style]} {...props}>
      {children}
    </View>
  );

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding }]}>
      {scroll ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPink,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgPink,
  },
  scrollInner: {
    backgroundColor: colors.bgPink,
  },
  padding: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  scrollContent: {
    flexGrow: 1,
  }
});

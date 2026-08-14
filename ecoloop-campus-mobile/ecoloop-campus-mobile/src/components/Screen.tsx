import React from 'react';
import { View, StyleSheet, ViewProps, SafeAreaView, ScrollView } from 'react-native';
import { colors } from '../theme/colors';

interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  noPadding?: boolean;
  scroll?: boolean;
}

export function Screen({ children, style, noPadding = false, scroll = false, ...props }: ScreenProps) {
  const content = (
    <View style={[styles.container, !noPadding && styles.padding, style]} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
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
  padding: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  scrollContent: {
    paddingBottom: 220, // Room for floating bottom navigation
  }
});

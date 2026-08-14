import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/colors';
import { getSyncStatusCopy } from './syncStatusCopy';

type SyncSource = 'mock' | 'supabase';
export { getSyncStatusCopy } from './syncStatusCopy';

export function SyncStatusBadge({ syncSource, syncError }: { syncSource: SyncSource; syncError: string }) {
  // Hide demo warning banner as requested by user
  return null;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 3
  },
  success: {
    backgroundColor: colors.mint,
    borderColor: colors.leaf
  },
  neutral: {
    backgroundColor: colors.cream,
    borderColor: colors.line
  },
  warning: {
    backgroundColor: '#FFF0D5',
    borderColor: colors.gold
  },
  title: {
    color: colors.ink,
    fontWeight: '900'
  },
  detail: {
    color: colors.muted,
    fontWeight: '700',
    lineHeight: 18
  }
});

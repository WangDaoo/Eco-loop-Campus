import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/colors';
import { getSyncStatusCopy } from './syncStatusCopy';

type SyncSource = 'backend';
export { getSyncStatusCopy } from './syncStatusCopy';

export function SyncStatusBadge({ syncSource, syncError }: { syncSource: SyncSource; syncError: string }) {
  // The login screen keeps connection details quiet; operational pages surface errors in context.
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

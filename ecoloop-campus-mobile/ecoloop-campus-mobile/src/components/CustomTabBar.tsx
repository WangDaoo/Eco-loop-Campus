import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { BOTTOM_TAB_BAR_HEIGHT } from './Screen';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom;

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.navBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          let iconName: keyof typeof Ionicons.glyphMap = 'help';
          let displayLabel = String(label);

          if (route.name === 'Home') { iconName = 'home'; displayLabel = 'Trang chủ'; }
          if (route.name === 'Rewards') { iconName = 'gift'; displayLabel = 'Đổi thưởng'; }
          if (route.name === 'Scanner' || route.name === 'Submit') { iconName = 'qr-code'; displayLabel = 'Quét QR'; }
          if (route.name === 'Map') { iconName = 'map'; displayLabel = 'Bản đồ'; }
          if (route.name === 'Profile') { iconName = 'person'; displayLabel = 'Cá nhân'; }
          if (route.name === 'History') { iconName = 'time'; displayLabel = 'Lịch sử'; }
          if (route.name === 'Duty') { iconName = 'clipboard'; displayLabel = 'Ca trực'; }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? displayLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              hitSlop={8}
              style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isFocused ? colors.ecoDarkBlue : 'rgba(59, 108, 122, 0.8)'}
                />
              </View>
              <Text style={styles.navLabel}>{displayLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 0,
    backgroundColor: colors.ecoNav,
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: colors.ecoNav,
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: BOTTOM_TAB_BAR_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  navItem: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconWrapperActive: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ecoPink,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navLabel: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.78,
  }
});

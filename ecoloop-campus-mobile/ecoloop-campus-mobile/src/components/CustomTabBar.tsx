import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
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

          // Map route names to icons and labels
          let iconName: keyof typeof Ionicons.glyphMap = 'help';
          let displayLabel = String(label);

          if (route.name === 'Home') { iconName = 'home'; displayLabel = 'Trang chủ'; }
          if (route.name === 'Rewards') { iconName = 'gift'; displayLabel = 'Đổi thưởng'; }
          if (route.name === 'Scanner' || route.name === 'Submit') { iconName = 'qr-code'; displayLabel = 'Quét QR'; }
          if (route.name === 'Map') { iconName = 'map'; displayLabel = 'Bản đồ'; }
          if (route.name === 'Profile') { iconName = 'person'; displayLabel = 'Cá nhân'; }
          if (route.name === 'History') { iconName = 'time'; displayLabel = 'Lịch sử'; }
          if (route.name === 'Duty') { iconName = 'clipboard'; displayLabel = 'Ca trực'; }

          const isCenterButton = route.name === 'Scanner' || route.name === 'Submit';

          if (isCenterButton) {
            return (
              <View key={index} style={styles.centerItemWrapper}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  testID={options.tabBarTestID}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={[styles.centerButton, isFocused && styles.centerButtonActive]}
                >
                  <Ionicons name={iconName} size={36} color={colors.ecoDarkBlue} />
                </TouchableOpacity>
                <Text style={styles.centerLabel}>{displayLabel}</Text>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={index}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.navItem}
            >
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isFocused ? colors.ecoDarkBlue : 'rgba(59, 108, 122, 0.8)'}
                />
              </View>
              <Text style={styles.navLabel}>{displayLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 24,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: colors.ecoNav,
    width: '100%',
    maxWidth: 400,
    borderRadius: 40,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 16,
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
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconWrapperActive: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ecoPink,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navLabel: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  centerItemWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    paddingHorizontal: 4,
  },
  centerButton: {
    position: 'absolute',
    top: -85,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 4,
    borderColor: colors.ecoPink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  centerButtonActive: {
    backgroundColor: colors.white,
  },
  centerLabel: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 40,
  }
});

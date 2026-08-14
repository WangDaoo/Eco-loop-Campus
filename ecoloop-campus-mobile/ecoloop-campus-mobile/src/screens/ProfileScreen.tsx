import React from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import { Svg, Rect, Path, Circle, Ellipse } from 'react-native-svg';
import { useAppContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export default function ProfileScreen({ navigation }: any) {
  const { currentUser: user, signOut } = useAppContext();

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() }
    ]);
  };

  return (
    <Screen scroll style={styles.container}>
      <View style={styles.content}>

        {/* Title Bubble */}
        <View style={styles.titleBubble}>
          <Text style={styles.titleText} numberOfLines={1}>{user?.name || user?.email || 'Người dùng'}</Text>
          <View style={styles.bubbleTail} />
        </View>

        {/* Mascot Profile Image */}
        <View style={styles.mascotContainer}>
          <View style={styles.mascotBgWhite} />
          <View style={styles.mascotInner}>
            <Svg viewBox="0 0 100 100" width="100%" height="100%">
              <Rect x="0" y="0" width="100" height="100" fill="#a8f2ab" />
              {/* Outline */}
              <Path d="M50 15 C 20 15, 10 40, 10 60 C 10 80, 25 90, 50 90 C 75 90, 90 80, 90 60 C 90 40, 80 15, 50 15 Z" fill="none" stroke="#2c6e6e" strokeWidth="4" />
              {/* Ears */}
              <Circle cx="15" cy="55" r="9" fill="white" stroke="#2c6e6e" strokeWidth="4" />
              <Circle cx="85" cy="55" r="9" fill="white" stroke="#2c6e6e" strokeWidth="4" />
              {/* Body */}
              <Path d="M50 15 C 20 15, 10 40, 10 60 C 10 80, 25 90, 50 90 C 75 90, 90 80, 90 60 C 90 40, 80 15, 50 15 Z" fill="white" />
              {/* Eyes */}
              <Ellipse cx="38" cy="45" rx="5" ry="3" fill="#2c6e6e" transform="rotate(20 38 45)" />
              <Ellipse cx="62" cy="45" rx="5" ry="3" fill="#2c6e6e" transform="rotate(-20 62 45)" />
              {/* Mouth */}
              <Path d="M45 52 Q 50 56 55 52" fill="none" stroke="#2c6e6e" strokeWidth="3" strokeLinecap="round" />
              {/* Sprout */}
              <Path d="M48 15 Q 50 5 52 15" fill="none" stroke="#8bc34a" strokeWidth="4" strokeLinecap="round" />
              <Path d="M70 15 C 75 10, 85 10, 80 20 C 75 25, 65 20, 70 15 Z" fill="none" stroke="#8bc34a" strokeWidth="3" />
              <Path d="M80 25 C 85 20, 95 20, 90 30 C 85 35, 75 30, 80 25 Z" fill="none" stroke="#8bc34a" strokeWidth="3" />
            </Svg>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionList}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => navigation?.navigate('Leaderboard')}
          >
            <Text style={styles.actionButtonText}>Thứ hạng hiện tại của bạn: 12</Text>
            <Text style={styles.actionIcon}>›</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => navigation?.navigate('About')}
          >
            <Text style={styles.actionButtonText}>Giới thiệu ứng dụng</Text>
            <Text style={styles.actionIcon}>›</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}>
            <Text style={styles.actionButtonText}>Hỗ trợ</Text>
            <Text style={styles.actionIcon}>›</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </Pressable>
        </View>

        {/* Decorative cloud */}
        <View style={styles.cloudContainer} pointerEvents="none">
          <Svg viewBox="0 0 100 100" width="100%" height="100%">
            <Path d="M50 30 C 20 30, 10 50, 20 70 C 10 80, 30 90, 50 90 C 70 90, 90 80, 80 70 C 90 50, 80 30, 50 30 Z" fill="rgba(255,255,255,0.9)" />
            <Path d="M48 30 Q 50 20 52 30" fill="none" stroke="#8bc34a" strokeWidth="3" strokeLinecap="round" />
            <Ellipse cx="40" cy="55" rx="4" ry="2" fill="#2c6e6e" transform="rotate(15 40 55)" />
            <Ellipse cx="60" cy="55" rx="4" ry="2" fill="#2c6e6e" transform="rotate(-15 60 55)" />
            <Path d="M48 60 L 52 60 L 50 63 Z" fill="#2c6e6e" />
            <Path d="M25 20 Q 20 40 25 45" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
            <Circle cx="27" cy="52" r="2" fill="white" />
          </Svg>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffdcd2',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 160,
  },
  titleBubble: {
    backgroundColor: '#cbf9e4',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 40,
    borderBottomWidth: 4,
    borderBottomColor: '#a3e5c9',
    position: 'relative',
    zIndex: 2,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2c6e6e',
    flexShrink: 1,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#cbf9e4',
  },
  mascotContainer: {
    marginBottom: 48,
    position: 'relative',
    width: 224,
    height: 224,
  },
  mascotBgWhite: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    borderRadius: 40,
    top: -16,
    left: -16,
    right: -16,
    bottom: -16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  mascotInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#cbf9e4',
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#2c6e6e',
    overflow: 'hidden',
    padding: 12,
    zIndex: 10,
  },
  actionList: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  actionButton: {
    backgroundColor: '#cbf9e4',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#a3e5c9',
    minHeight: 56,
  },
  actionButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c6e6e',
  },
  actionIcon: {
    fontSize: 24,
    color: 'rgba(44, 110, 110, 0.5)',
    fontWeight: 'bold',
  },
  logoutButton: {
    marginTop: 32,
    backgroundColor: '#f39c8f',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#cc6b5c',
    minHeight: 56,
  },
  logoutButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  logoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  cloudContainer: {
    position: 'absolute',
    bottom: 80,
    right: -10,
    width: 112,
    height: 96,
    zIndex: 10,
    opacity: 0.9,
  }
});

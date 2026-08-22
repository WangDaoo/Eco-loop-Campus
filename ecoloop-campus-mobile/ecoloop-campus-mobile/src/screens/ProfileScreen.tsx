import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AVATAR_OPTIONS, UserAvatar, resolveAvatarOption } from '../components/UserAvatar';
import { getUserLeaderboardRank } from '../services/leaderboard';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function ProfileScreen({ navigation }: any) {
  const { currentUser: user, signOut, users, updateAvatar, updatePassword, isLoading } = useAppContext();
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const selectedAvatar = resolveAvatarOption(user.avatarKey);
  const currentRank = useMemo(() => getUserLeaderboardRank(users, user.id), [users, user.id]);
  const rankLabel = currentRank
    ? `Thứ hạng hiện tại của bạn: #${currentRank.rank}`
    : user.role === 'student'
      ? 'Chưa có thứ hạng Ecopoint'
      : 'Xem bảng xếp hạng sinh viên';

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() }
    ]);
  };

  const handleAvatarSelect = async (avatarKey: string) => {
    await updateAvatar(avatarKey);
    setAvatarModalVisible(false);
  };

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handlePasswordSubmit = async () => {
    const cleaned = newPassword.trim();
    if (!currentPassword.trim()) {
      Alert.alert('Cần mật khẩu hiện tại', 'Nhập mật khẩu hiện tại trước khi đổi mật khẩu.');
      return;
    }
    if (cleaned.length < 6) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu mới cần có ít nhất 6 ký tự.');
      return;
    }
    if (cleaned !== confirmPassword.trim()) {
      Alert.alert('Mật khẩu chưa khớp', 'Vui lòng nhập lại mật khẩu xác nhận.');
      return;
    }

    try {
      await updatePassword(user.email, currentPassword.trim(), cleaned);
      closePasswordModal();
      Alert.alert('Đã đổi mật khẩu', 'Bạn có thể dùng mật khẩu mới ở lần đăng nhập tiếp theo.');
    } catch (error) {
      Alert.alert('Không đổi được mật khẩu', messageOf(error));
    }
  };

  return (
    <Screen scroll style={styles.container} bottomClearance={24}>
      <View style={styles.content}>
        <Pressable
          style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarButtonPressed]}
          onPress={() => setAvatarModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Mở chọn ảnh đại diện"
        >
          <UserAvatar avatarKey={user.avatarKey} avatarUrl={user.avatarUrl} size={224} />
        </Pressable>

        <View style={styles.profileSummary}>
          <Text style={styles.summaryTitle}>{selectedAvatar.label}</Text>
          <Text style={styles.summaryMeta}>{user.group || (user.role === 'volunteer' ? 'Tình nguyện viên' : 'Sinh viên')}</Text>
          <Text style={styles.summaryPoints}>{Number(user.points || 0).toLocaleString('vi-VN')} Ecopoint</Text>
        </View>

        <View style={styles.actionList}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => navigation?.navigate('Leaderboard')}
          >
            <Text style={styles.actionButtonText}>{rankLabel}</Text>
            <Text style={styles.actionIcon}>›</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => setAvatarModalVisible(true)}
          >
            <Text style={styles.actionButtonText}>Đổi avatar hồ sơ</Text>
            <Text style={styles.actionIcon}>›</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => setPasswordModalVisible(true)}
          >
            <Text style={styles.actionButtonText}>Đổi mật khẩu</Text>
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

      </View>

      <Modal visible={avatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Chọn avatar</Text>
            <Text style={styles.modalText}>Avatar là preset nhẹ, không upload ảnh nên không làm nặng dữ liệu.</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map(option => {
                const selected = option.key === (user.avatarKey || 'sprout');
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.avatarOption, selected && styles.avatarOptionActive]}
                    onPress={() => void handleAvatarSelect(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Chọn avatar ${option.label}`}
                  >
                    <UserAvatar avatarKey={option.key} size={82} />
                    <Text style={styles.avatarOptionText}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.modalCloseButton} onPress={() => setAvatarModalVisible(false)}>
              <Text style={styles.modalCloseText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
            <Text style={styles.modalText}>Xác nhận mật khẩu hiện tại trước khi đặt mật khẩu mới.</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Mật khẩu hiện tại"
              secureTextEntry
              style={styles.passwordInput}
              placeholderTextColor="rgba(44, 110, 110, 0.56)"
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mật khẩu mới"
              secureTextEntry
              style={styles.passwordInput}
              placeholderTextColor="rgba(44, 110, 110, 0.56)"
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Xác nhận mật khẩu"
              secureTextEntry
              style={styles.passwordInput}
              placeholderTextColor="rgba(44, 110, 110, 0.56)"
            />
            <Text style={styles.passwordHint}>Mật khẩu nên có ít nhất 6 ký tự và không dùng lại mật khẩu cũ.</Text>
            <View style={styles.modalActionRow}>
              <Pressable style={styles.modalSecondaryButton} onPress={closePasswordModal}>
                <Text style={styles.modalSecondaryText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, isLoading && styles.modalSaveButtonDisabled]}
                onPress={() => void handlePasswordSubmit()}
                disabled={isLoading}
              >
                <Text style={styles.modalSaveText}>{isLoading ? 'Đang lưu...' : 'Lưu mật khẩu'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 24,
  },
  avatarButton: {
    marginBottom: 22,
  },
  avatarButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  profileSummary: {
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryTitle: {
    color: '#2c6e6e',
    fontSize: 18,
    fontWeight: '900',
  },
  summaryMeta: {
    marginTop: 4,
    color: 'rgba(44, 110, 110, 0.72)',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  summaryPoints: {
    marginTop: 6,
    color: '#2f8f5b',
    fontSize: 15,
    fontWeight: '900',
  },
  actionList: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
    position: 'relative',
    zIndex: 2,
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
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c6e6e',
  },
  actionIcon: {
    marginLeft: 12,
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
    zIndex: 3,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 54, 54, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalPanel: {
    backgroundColor: '#fff7eb',
    borderRadius: 28,
    padding: 20,
    borderWidth: 3,
    borderColor: '#f7a293',
  },
  modalTitle: {
    color: '#2c6e6e',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalText: {
    marginTop: 8,
    color: 'rgba(44, 110, 110, 0.72)',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  avatarGrid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarOption: {
    width: '47%',
    minHeight: 144,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#cbf9e4',
    borderWidth: 3,
    borderColor: 'transparent',
    padding: 10,
  },
  avatarOptionActive: {
    borderColor: '#2c6e6e',
    backgroundColor: '#e7fff3',
  },
  avatarOptionText: {
    marginTop: 12,
    color: '#2c6e6e',
    fontWeight: '900',
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#f39c8f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
  },
  passwordInput: {
    marginTop: 14,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#cbf9e4',
    paddingHorizontal: 16,
    color: '#2c6e6e',
    fontSize: 16,
    fontWeight: '800',
  },
  passwordHint: {
    marginTop: 10,
    color: 'rgba(44, 110, 110, 0.72)',
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  modalActionRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#cbf9e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: '#2c6e6e',
    fontWeight: '900',
    fontSize: 16,
  },
  modalSaveButton: {
    flex: 1.2,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#f39c8f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalSaveButtonDisabled: {
    opacity: 0.58,
  },
  modalSaveText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
  },
});

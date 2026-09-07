import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { colors, radius } from '../theme/colors';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function CompleteProfileScreen() {
  const { currentUser, faculties, completeProfile, signOut, isLoading } = useAppContext();
  const [studentCode, setStudentCode] = useState(currentUser.studentCode ?? '');
  const [facultyCode, setFacultyCode] = useState(currentUser.facultyCode ?? '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber ?? '');
  const [facultyOpen, setFacultyOpen] = useState(false);
  const selectedFaculty = faculties.find(item => item.code === facultyCode);
  const formComplete = Boolean(studentCode.trim() && facultyCode && phoneNumber.trim());

  const handleSubmit = async () => {
    if (!formComplete) return;
    try {
      await completeProfile({
        studentCode: studentCode.trim().toUpperCase(),
        facultyCode,
        phoneNumber: phoneNumber.trim(),
      });
    } catch (error) {
      Alert.alert('Không cập nhật được hồ sơ', messageOf(error));
    }
  };

  return (
    <Screen scroll bottomClearance={24}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>Eco-loop Campus</Text>
        <Text style={styles.title}>Hoàn thiện hồ sơ</Text>
        <Text style={styles.subtitle}>Bổ sung thông tin sinh viên để tiếp tục sử dụng các chức năng đóng góp rác và tình nguyện.</Text>
        <TextInput value={studentCode} onChangeText={setStudentCode} placeholder="Mã sinh viên" style={styles.input} placeholderTextColor={colors.muted} autoCapitalize="characters" />
        <View>
          <Pressable style={styles.input} onPress={() => setFacultyOpen(open => !open)} accessibilityRole="button" accessibilityLabel="Chọn khoa HYUTE">
            <Text style={selectedFaculty ? styles.inputText : styles.placeholder}>{selectedFaculty?.name ?? 'Chọn khoa HYUTE'}</Text>
          </Pressable>
          {facultyOpen ? (
            <View style={styles.facultyList}>
              {faculties.map(faculty => (
                <Pressable
                  key={faculty.code}
                  style={[styles.facultyOption, faculty.code === facultyCode && styles.facultySelected]}
                  onPress={() => {
                    setFacultyCode(faculty.code);
                    setFacultyOpen(false);
                  }}
                >
                  <Text style={styles.facultyText}>{faculty.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <TextInput value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Số điện thoại" style={styles.input} placeholderTextColor={colors.muted} keyboardType="phone-pad" />
        <AppButton title={isLoading ? 'Đang lưu...' : 'Lưu và tiếp tục'} disabled={isLoading || !formComplete} onPress={handleSubmit} />
        <Pressable onPress={() => void signOut()}><Text style={styles.logout}>Đăng xuất</Text></Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 36, backgroundColor: colors.cream, borderRadius: radius.xl, padding: 24, gap: 14 },
  kicker: { color: colors.green, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: colors.white, borderRadius: radius.md, padding: 15, fontSize: 16, color: colors.ink },
  inputText: { color: colors.ink, fontSize: 16 },
  placeholder: { color: colors.muted, fontSize: 16 },
  facultyList: { marginTop: 6, backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden' },
  facultyOption: { paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted },
  facultySelected: { backgroundColor: colors.cream },
  facultyText: { color: colors.ink, fontWeight: '700' },
  logout: { color: colors.coralDark, fontWeight: '800', textAlign: 'center', paddingTop: 8 },
});

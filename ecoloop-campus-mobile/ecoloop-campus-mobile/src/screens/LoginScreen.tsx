import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { RootStackParamList, UserRole } from '../types';
import { useAppContext } from '../context/AppContext';
import { colors, radius } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function LoginScreen({ navigation }: Props) {
  const { signIn, signInDemo, isLoading, syncError, syncSource } = useAppContext();
  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await signIn(role, email, password);
    } catch (error) {
      Alert.alert('Không đăng nhập được', messageOf(error));
    }
  };

  const handleDemo = async () => {
    try {
      await signInDemo(role);
    } catch (error) {
      Alert.alert('Không mở được chế độ xem trước', messageOf(error));
    }
  };

  return (
    <Screen scroll={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>Eco-loop Campus</Text>
          <Text style={styles.title}>Đăng nhập</Text>
          <View style={styles.roleRow}>
            <RoleButton label="Sinh viên" selected={role === 'student'} onPress={() => setRole('student')} />
            <RoleButton label="Tình nguyện viên" selected={role === 'volunteer'} onPress={() => setRole('volunteer')} />
          </View>
          <Text style={styles.subtitle}>{role === 'student' ? 'Đăng nhập bằng tài khoản Eco-loop Campus của bạn.' : 'Đăng nhập bằng tài khoản đã được phân quyền trực trạm.'}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" style={styles.input} placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Mật khẩu" secureTextEntry style={styles.input} placeholderTextColor={colors.muted} />
          <SyncStatusBadge syncSource={syncSource} syncError={syncError} />
          <AppButton title={isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'} disabled={isLoading || !email.trim() || !password.trim()} onPress={handleSubmit} />
          <Text style={styles.demoCopy}>Bạn có thể xem trước ứng dụng bằng dữ liệu lưu trên thiết bị này.</Text>
          <AppButton title="Xem trước bằng dữ liệu trên máy" variant="light" disabled={isLoading} onPress={handleDemo} />

          <Text style={styles.link} onPress={() => navigation.navigate('Register')}>Chưa có tài khoản? Đăng ký</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function RoleButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.roleButton, selected && styles.roleSelected]} onPress={onPress}>
      <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 22 },
  panel: { backgroundColor: colors.cream, borderRadius: radius.xl, padding: 24, gap: 14 },
  kicker: { color: colors.green, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginBottom: 10 },
  subtitle: { color: colors.muted, fontWeight: '700', marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleButton: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  roleSelected: { backgroundColor: colors.green },
  roleText: { color: colors.muted, fontWeight: '900' },
  roleTextSelected: { color: colors.white },
  input: { backgroundColor: colors.white, borderRadius: radius.md, padding: 15, fontSize: 16, color: colors.ink },
  demoCopy: { color: colors.muted, fontWeight: '700', textAlign: 'center', fontSize: 12 },
  link: { color: colors.coralDark, fontWeight: '800', textAlign: 'center', marginTop: 8 }
});

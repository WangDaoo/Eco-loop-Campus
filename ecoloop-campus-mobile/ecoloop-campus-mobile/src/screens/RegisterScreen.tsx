import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { RootStackParamList, UserRole } from '../types';
import { useAppContext } from '../context/AppContext';
import { colors, radius } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function RegisterScreen({ navigation }: Props) {
  const { signUp, isLoading } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    try {
      const created = await signUp(name.trim(), email.trim(), password, role);
      if ((created as any)?.requiresEmailConfirmation) {
        Alert.alert('Đã tạo tài khoản', 'Vui lòng xác nhận email hoặc đăng nhập lại khi tài khoản sẵn sàng.', [
          { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') }
        ]);
        return;
      }
      if (role === 'volunteer') {
        Alert.alert('Đã gửi yêu cầu', 'Tài khoản tình nguyện viên sẽ dùng được sau khi admin phê duyệt.', [
          { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') }
        ]);
      }
    } catch (error) {
      Alert.alert('Không tạo được tài khoản', messageOf(error));
    }
  };

  return (
    <Screen scroll={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>Eco-loop Campus</Text>
          <Text style={styles.title}>Tạo tài khoản</Text>
          <View style={styles.roleRow}>
            <RoleButton label="Sinh viên" selected={role === 'student'} onPress={() => setRole('student')} />
            <RoleButton label="Tình nguyện viên" selected={role === 'volunteer'} onPress={() => setRole('volunteer')} />
          </View>
          <Text style={styles.subtitle}>{role === 'student' ? 'Đăng ký bằng email sinh viên.' : 'Gửi yêu cầu cấp quyền trực trạm. Admin sẽ phê duyệt trước khi sử dụng.'}</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Họ và tên" style={styles.input} placeholderTextColor={colors.muted} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" style={styles.input} placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Mật khẩu" secureTextEntry style={styles.input} placeholderTextColor={colors.muted} />
          <AppButton title={isLoading ? 'Đang đăng ký...' : 'Đăng ký'} disabled={isLoading || !name.trim() || !email.trim() || !password.trim()} onPress={handleSubmit} />
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>Đã có tài khoản? Đăng nhập</Text>
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
  link: { color: colors.coralDark, fontWeight: '800', textAlign: 'center', marginTop: 8 }
});

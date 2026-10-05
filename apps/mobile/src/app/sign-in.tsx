import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/ui/feedback';
import { AppText, Button, Icon, Row, TextField } from '@/components/ui/primitives';
import { useAuth } from '@/state/auth';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignIn() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await register(name, email, password, org);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const valid = email.includes('@') && password.length >= 8 && (mode === 'signin' || name.trim().length > 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, paddingTop: insets.top + space.xxxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="analytics" size={30} color={colors.onPrimary} />
        </View>
        <View style={{ gap: space.xs }}>
          <AppText variant="display">KPI Consultant</AppText>
          <AppText muted>Strategy and KPI intelligence in your pocket — find, explain and balance KPIs, build strategy maps, and brief executives from your phone.</AppText>
        </View>

        {mode === 'register' && (
          <>
            <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
            <TextField label="Organisation (optional)" value={org} onChangeText={setOrg} textContentType="organizationName" />
          </>
        )}
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signin' ? 'password' : 'new-password'} textContentType={mode === 'signin' ? 'password' : 'newPassword'} onSubmitEditing={valid ? submit : undefined} />
        {mode === 'register' && (
          <AppText variant="caption" muted>
            At least 8 characters.
          </AppText>
        )}
        {error && <ErrorState message={error} />}
        <Button title={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} disabled={!valid} full />
        <Button title={mode === 'signin' ? 'Create an account' : 'I already have an account'} variant="ghost" onPress={() => setMode(mode === 'signin' ? 'register' : 'signin')} full />

        <View style={{ flex: 1 }} />
        <Row style={{ justifyContent: 'center' }}>
          <Button title="Explore without an account" variant="ghost" small icon="compass-outline" onPress={continueAsGuest} />
        </Row>
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          Without an account, everything stays on this device and the assistant uses the offline engine.
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

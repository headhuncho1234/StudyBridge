import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scholarship/[id]" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="profile/edit-name" />
        <Stack.Screen name="profile/edit-academic" />
        <Stack.Screen name="profile/edit-email" />
        <Stack.Screen name="community/index" />
        <Stack.Screen name="community/new" />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="assistant" />
      </Stack>
    </GestureHandlerRootView>
  );
}
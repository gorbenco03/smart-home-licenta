import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useAppStore } from './src/store';
import { connectSocket, disconnectSocket } from './src/services/socket';
import AppNavigator from './src/navigation';
import { T } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [tokenReady, setTokenReady] = useState(false);
  const loadToken = useAppStore((s) => s.loadToken);

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
  });

  // Încarcă token-ul persistent o singură dată la mount
  useEffect(() => {
    loadToken().then(() => {
      // Conectează WebSocket după ce token-ul e disponibil în store
      const token = useAppStore.getState().token;
      if (token) connectSocket();
    }).finally(() => setTokenReady(true));

    // Cleanup la unmount (ex: logout)
    return () => disconnectSocket();
  }, []); // [] = rulează o singură dată

  if (!tokenReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from './src/store';
import { connectSocket, disconnectSocket } from './src/services/socket';
import AppNavigator from './src/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [ready, setReady] = useState(false);
  const loadToken = useAppStore((s) => s.loadToken);

  // Încarcă token-ul persistent o singură dată la mount
  useEffect(() => {
    loadToken().then(() => {
      // Conectează WebSocket după ce token-ul e disponibil în store
      const token = useAppStore.getState().token;
      if (token) connectSocket();
    }).finally(() => setReady(true));

    // Cleanup la unmount (ex: logout)
    return () => disconnectSocket();
  }, []); // [] = rulează o singură dată

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#38bdf8" size="large" />
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

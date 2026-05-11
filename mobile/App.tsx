import React, { useEffect } from 'react';
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
  const token = useAppStore((s) => s.token);

  // Conectează WebSocket dacă avem token (ex: după restore din MMKV)
  useEffect(() => {
    if (token) connectSocket();
    return () => disconnectSocket();
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

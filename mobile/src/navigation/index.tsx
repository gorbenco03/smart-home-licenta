import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppStore } from '../store';
import { RootStackParamList, MainTabParamList } from '../types';
import { T } from '../theme';

import LoginScreen    from '../screens/LoginScreen';
import SetupScreen    from '../screens/SetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen  from '../screens/HistoryScreen';
import AlertsScreen   from '../screens/AlertsScreen';
import ControlScreen  from '../screens/ControlScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<MainTabParamList>();

/* ─── SVG-free icon set (text glyphs) ─── */
const TAB_ICONS: Record<string, { on: string; off: string }> = {
  Dashboard: { on: '⌂', off: '⌂' },
  History:   { on: '↗', off: '↗' },
  Alerts:    { on: '◉', off: '○' },
  Control:   { on: '⊡', off: '⊡' },
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const unreadCount = useAppStore((s) => s.unreadCount);

  return (
    <View style={tb.outer}>
      <View style={tb.pill}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = route.name;
          const icon  = TAB_ICONS[label] ?? { on: '●', off: '●' };
          const isAlerts = label === 'Alerts';
          const badge = isAlerts && unreadCount > 0 ? unreadCount : 0;

          function onPress() {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={[tb.tab, focused && tb.tabActive]}
              onPress={onPress}
              activeOpacity={0.8}
            >
              <View style={{ position: 'relative' }}>
                <Text style={[tb.icon, { color: focused ? T.accent : T.text2 }]}>
                  {focused ? icon.on : icon.off}
                </Text>
                {badge > 0 && (
                  <View style={tb.badge}>
                    <Text style={tb.badgeText}>{badge}</Text>
                  </View>
                )}
              </View>
              {focused && (
                <Text style={tb.label}>{label === 'Dashboard' ? 'Dashboard' : label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  outer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingBottom: 28, paddingHorizontal: 14,
    paddingTop: 8,
    // Fade to bg at top
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: 999,
    borderWidth: 1, borderColor: T.border,
    padding: 6,
    ...T.shadow,
  },
  tab: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 999,
  },
  tabActive: { backgroundColor: T.accentSoft },
  icon: { fontSize: 19 },
  label: { fontSize: 13, fontWeight: '600', color: T.accent, letterSpacing: -0.1 },
  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: T.danger,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: T.surface,
    paddingHorizontal: 2,
  },
  badgeText: { fontFamily: 'Courier New', fontSize: 9, fontWeight: '700', color: '#fff' },
});

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="History"   component={HistoryScreen} />
      <Tab.Screen name="Alerts"    component={AlertsScreen} />
      <Tab.Screen name="Control"   component={ControlScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token = useAppStore((s) => s.token);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Setup"
              options={{ headerShown: false, presentation: 'modal' }}
            >
              {(props) => (
                <SetupScreen onDone={() => props.navigation.goBack()} />
              )}
            </Stack.Screen>
          </Stack.Group>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppStore } from '../store';
import { RootStackParamList, MainTabParamList } from '../types';
import { T, FONT } from '../theme';

import LoginScreen     from '../screens/LoginScreen';
import SetupScreen     from '../screens/SetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen   from '../screens/HistoryScreen';
import AlertsScreen    from '../screens/AlertsScreen';
import ControlScreen   from '../screens/ControlScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<MainTabParamList>();

/* ─── Tab icon config (Ionicons) ─── */
type IonName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { on: IonName; off: IonName; label: string }> = {
  Dashboard: { on: 'home',          off: 'home-outline',          label: 'Acasă' },
  History:   { on: 'stats-chart',   off: 'stats-chart-outline',   label: 'Istoric' },
  Alerts:    { on: 'notifications', off: 'notifications-outline', label: 'Alerte' },
  Control:   { on: 'toggle',        off: 'toggle-outline',        label: 'Control' },
};

/* ─── Custom Tab Bar ──────────────────────────────────────── */
function CustomTabBar({ state, descriptors, navigation }: any) {
  const unreadCount = useAppStore((s) => s.unreadCount);
  const insets = useSafeAreaInsets();

  // Padding jos care respectă safe area (iOS home indicator etc.)
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <View style={[tb.outer, { paddingBottom: bottomPad }]}>
      {/* Blur de fundal pe întreaga bară */}
      <BlurView
        intensity={32}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {/* Strat glass deasupra blur-ului */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,10,20,0.72)' }]} />
      {/* Linie de separator sus */}
      <View style={tb.separator} />

      <View style={tb.pill}>
        {state.routes.map((route: any, index: number) => {
          const focused   = state.index === index;
          const label     = route.name;
          const icon      = TAB_ICONS[label] ?? { on: 'ellipse' as IonName, off: 'ellipse-outline' as IonName, label };
          const isAlerts  = label === 'Alerts';
          const badge     = isAlerts && unreadCount > 0 ? unreadCount : 0;

          function onPress() {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={tb.tab}
              onPress={onPress}
              activeOpacity={0.75}
              accessibilityLabel={icon.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
            >
              {/* Indicator activ sub icon */}
              {focused && (
                <View style={tb.activeIndicator} />
              )}

              <View style={tb.iconWrap}>
                <Ionicons
                  name={focused ? icon.on : icon.off}
                  size={22}
                  color={focused ? T.accent : T.text3}
                />
                {badge > 0 && (
                  <View style={tb.badge}>
                    <Text style={tb.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </View>

              <Text style={[
                tb.label,
                { color: focused ? T.accent : T.text3 },
              ]}>
                {icon.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    // nu specificăm backgroundColor — BlurView preia controlul
  },
  separator: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: T.glassBorder,
  },
  pill: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 32,
    height: 3,
    borderRadius: T.r.pill,
    backgroundColor: T.accent,
    // Glow pe indicator
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 4,
  },
  iconWrap: {
    position: 'relative',
    width: 32, height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10.5,
    fontFamily: FONT.medium,
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    top: -4, right: -6,
    minWidth: 17, height: 17,
    borderRadius: T.r.pill,
    backgroundColor: T.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: T.bg,
    paddingHorizontal: 3,
    // Glow pe badge
    shadowColor: T.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONT.bold,
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
});

/* ─── Main Tabs ───────────────────────────────────────────── */
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

/* ─── Root Navigator ──────────────────────────────────────── */
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

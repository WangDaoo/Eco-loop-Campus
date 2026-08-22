import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppContext } from './src/context/AppContext';
import { RootStackParamList, StudentTabParamList, VolunteerTabParamList } from './src/types';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import AboutScreen from './src/screens/AboutScreen';
import VolunteerDutyScreen from './src/screens/VolunteerDutyScreen';
import SubmitScreen from './src/screens/SubmitScreen';
import { CustomTabBar } from './src/components/CustomTabBar';

const Stack = createNativeStackNavigator<RootStackParamList>();
const StudentTab = createBottomTabNavigator<StudentTabParamList>();
const VolunteerTab = createBottomTabNavigator<VolunteerTabParamList>();

function StudentTabs() {
  return (
    <StudentTab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <StudentTab.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ' }} />
      <StudentTab.Screen name="Rewards" component={RewardsScreen} options={{ title: 'Đổi thưởng' }} />
      <StudentTab.Screen name="Submit" component={SubmitScreen} options={{ title: 'Quét mã' }} />
      <StudentTab.Screen name="Map" component={MapScreen} options={{ title: 'Bản đồ' }} />
      <StudentTab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Cá nhân' }} />
    </StudentTab.Navigator>
  );
}

function VolunteerTabs() {
  return (
    <VolunteerTab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <VolunteerTab.Screen name="Duty" component={VolunteerDutyScreen} options={{ title: 'Ca trực' }} />
      <VolunteerTab.Screen name="History" component={HistoryScreen} options={{ title: 'Lịch sử' }} />
      <VolunteerTab.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Quét mã' }} />
      <VolunteerTab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Cá nhân' }} />
    </VolunteerTab.Navigator>
  );
}

function MainTabs() {
  const { currentUser } = useAppContext();
  return currentUser.role === 'volunteer' || currentUser.role === 'admin' ? <VolunteerTabs /> : <StudentTabs />;
}

function RootNavigator() {
  const { isAuthenticated } = useAppContext();

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Rewards" component={RewardsScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
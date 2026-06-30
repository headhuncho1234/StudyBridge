import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { theme } from '../../lib/theme';

export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor="rgba(0, 0, 0, 0.3)"
      blurEffect="systemThinMaterialDark"
      tintColor={theme.accent}
      indicatorColor={theme.accent}
    >
      <NativeTabs.Trigger name="home">
        <Label>Home</Label>
        <Icon sf="house.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Label>Search</Label>
        <Icon sf="magnifyingglass" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="saved">
        <Label>Saved</Label>
        <Icon sf="bookmark.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="documents">
        <Label>Documents</Label>
        <Icon sf="doc.text.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf="person.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
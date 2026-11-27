import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, type} from './theme';

export interface IconProps {
  readonly name: string;
  readonly color?: string;
  readonly size?: number;
}
export function Icon({name, color = colors.blue, size = 22}: IconProps) {
  return <Text aria-hidden style={{fontFamily: 'Stitch Material Symbols', color, fontSize: size, lineHeight: size, width: size, height: size}} numberOfLines={1}>{name}</Text>;
}

export interface DotProps {readonly color: string; readonly size?: number}
export function Dot({color, size = 8}: DotProps) {
  return <View style={{backgroundColor: color, height: size, width: size, borderRadius: size / 2, flexShrink: 0}} />;
}

export interface BadgeProps {readonly count: number | null; readonly color?: string}
export function Badge({count, color = colors.blue}: BadgeProps) {
  if (!count || count < 1) return null;
  return <View style={[styles.badge, {backgroundColor: color}]}>
    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
  </View>;
}

export interface HeaderProps {readonly online: boolean; readonly connected: boolean}
export function Header({online, connected}: HeaderProps) {
  const status = !online ? 'ออฟไลน์' : connected ? 'ระบบปกติ' : 'กำลังเชื่อมต่อ';
  return <View style={styles.header}>
    <View style={styles.headerLeft}>
      <Text accessibilityRole="header" aria-level={1} style={styles.title}>ภาพรวม</Text>
      <View style={styles.connection}>
        <Dot color={online && connected ? colors.success : colors.muted} />
        <Text style={styles.secondary}>{status}</Text>
      </View>
    </View>
    <View style={styles.avatar} accessibilityLabel="บัญชีแอดมิน" accessibilityRole="image">
      <Icon name="person" size={18} color={colors.white} />
    </View>
  </View>;
}

const tabs = [
  {path: '/', name: 'ภาพรวม', icon: 'dashboard'},
  {path: '/orders', name: 'ออเดอร์', icon: 'receipt_long'},
  {path: '/chats', name: 'แชท', icon: 'chat_bubble_outline'},
  {path: '/store', name: 'จัดการร้าน', icon: 'settings'},
];
export interface TabsProps {
  readonly go: (path: string) => void;
  readonly unread: number | null;
  readonly pending: number | null;
}
export function Tabs({go, unread, pending}: TabsProps) {
  return <View accessibilityRole="tablist" accessibilityLabel="เมนูหลัก" style={styles.tabs}>
    {tabs.map(({path, name, icon}) => {
      const selected = path === '/';
      const color = selected ? colors.blue : colors.secondary;
      const count = path === '/chats' ? unread : path === '/orders' ? pending : null;
      return <Pressable key={path} accessibilityRole="tab" accessibilityState={{selected}}
        accessibilityLabel={count ? name + ' ' + count + ' รายการ' : name}
        onPress={() => go(path)} style={styles.tab}>
        <View><Icon name={icon} color={color} /><Badge count={count} /></View>
        <Text style={[type.caption, {color}]}>{name}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  header: {height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line},
  headerLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  title: {...type.nav, color: colors.text},
  connection: {backgroundColor: colors.quiet, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 4},
  secondary: {...type.caption, color: colors.secondary},
  avatar: {height: 32, width: 32, marginRight: 6, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.profile},
  tabs: {height: 56, paddingHorizontal: 8, flexDirection: 'row', borderTopWidth: 1,
    borderTopColor: colors.line, backgroundColor: colors.white},
  tab: {flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'center', gap: 2},
  badge: {position: 'absolute', top: -4, right: -6, minWidth: 17, height: 17, paddingHorizontal: 3,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center'},
  badgeText: {...type.caption, color: colors.white, fontWeight: '700', fontSize: 10},
});

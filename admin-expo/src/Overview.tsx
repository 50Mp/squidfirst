import type {ReactNode} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {Badge, Dot, Icon} from './Chrome';
import {reviewQueue, type useOverviewData} from './overview-data';
import {colors, type} from './theme';

const orderStatus: Record<string, string> = {
  awaiting_payment: 'รอชำระเงิน', payment_review: 'รอตรวจสลิป', paid: 'รอรับงาน',
  accepted: 'รับงานแล้ว', processing: 'กำลังเติม', completed: 'เติมสำเร็จ',
  issue: 'พบปัญหา', cancelled: 'ยกเลิกแล้ว', refunded: 'คืนเงินแล้ว',
};
const games: Record<string, string> = {
  'free-fire': 'Free Fire', 'mobile-legends-bang-bang': 'Mobile Legends: Bang Bang',
  'pubg-mobile': 'PUBG', rov: 'RoV', 'genshin-impact': 'Genshin Impact', roblox: 'Roblox',
};
const shortcuts = [
  {name: 'ตรวจสลิป', label: 'เปิดคิวตรวจสลิป', icon: 'receipt_long', to: reviewQueue},
  {name: 'เกมและแพ็กเกจ', label: 'เกมและแพ็กเกจ', icon: 'sports_esports', to: '/store/products'},
  {name: 'ร้านต้นทาง', label: 'ร้านต้นทาง', icon: 'compare_arrows', to: '/store/sources'},
  {name: 'แชทลูกค้า', label: 'แชทลูกค้า', icon: 'chat_bubble_outline', to: '/chats'},
];

function money(value: string | null | undefined) {
  return value == null ? '—' : '$' + value;
}
const dateTime = new Intl.DateTimeFormat('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});

interface MetricProps {readonly label: string; readonly value: string | number; readonly note?: string; readonly warning?: boolean}
function Metric({label, value, note, warning}: MetricProps) {
  return <View style={styles.metric}>
    <Text style={styles.secondary}>{label}</Text>
    <Text style={[styles.metricValue, warning && styles.warning]}>{value}</Text>
    {note && <Text style={styles.caption}>{note}</Text>}
  </View>;
}

interface GroupProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: () => void;
}
function Group({title, children, action}: GroupProps) {
  return <View style={styles.group}>
    <View style={styles.groupHeading}>
      <Text accessibilityRole="header" aria-level={2} style={styles.heading}>{title}</Text>
      {action && <Pressable accessibilityRole="button" accessibilityLabel="ดูออเดอร์ทั้งหมด" onPress={action} style={styles.all}>
        <Text style={styles.link}>ดูทั้งหมด</Text>
      </Pressable>}
    </View>
    <View style={styles.panel}>{children}</View>
  </View>;
}

export interface OverviewProps {
  readonly data: ReturnType<typeof useOverviewData>['data'];
  readonly online: boolean;
  readonly go: (path: string) => void;
  readonly retry: () => void;
}
export function Overview({data, online, go, retry}: OverviewProps) {
  const summary = data.summary.value;
  const review = data.review.value;
  const slipCount = review?.counts ? (review.counts.payment_review ?? 0) : null;
  const urgent = online && !data.review.failed && slipCount ? review?.data[0] : null;
  const unread = data.navigation.value?.unread_chat_rooms ?? null;
  const failedResources = Object.values(data).filter(resource => resource.failed);
  const hasCachedData = failedResources.some(resource => resource.value !== undefined);
  const notice = !online ? 'ออฟไลน์ ข้อมูลที่แสดงอาจยังไม่อัปเดต'
    : hasCachedData ? 'กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า กรุณาโหลดใหม่ก่อนดำเนินการ'
      : 'โหลดข้อมูลบางส่วนไม่สำเร็จ';
  const recent = data.recent.value?.data;
  const sources = data.sources.value?.data;
  function openOrder(id: string) {
    go('/orders/' + encodeURIComponent(id) + '?return_to=%2F&from=expo-overview');
  }
  return <View style={styles.content}>
    {(!online || failedResources.length > 0) && <View accessibilityRole="alert" style={styles.notice}>
      <Text style={[styles.secondary, styles.grow]}>{notice}</Text>
      {online && <Pressable accessibilityRole="button" onPress={retry} style={styles.all}><Text style={styles.link}>ลองโหลดอีกครั้ง</Text></Pressable>}
    </View>}
    <Pressable accessibilityRole="button" onPress={() => urgent ? openOrder(urgent.id) : go(reviewQueue)}
      style={({pressed}) => [styles.panel, styles.urgent, pressed && styles.pressed]}>
      <Dot color={slipCount ? colors.warning : colors.muted} size={10} />
      <Text style={[styles.body, styles.grow]}>{slipCount ? 'งานด่วน: สลิปรอตรวจ ' + slipCount + ' รายการ' : slipCount === 0 ? 'ไม่มีสลิปรอตรวจ' : 'คิวตรวจสลิป'}</Text>
      <Icon name="chevron_right" color={colors.muted} size={20} />
    </Pressable>

    <View accessibilityLabel="สถิติวันนี้" style={styles.panel}>
      <View style={styles.row}>
        <Metric label="ยอดขายวันนี้" value={money(summary?.revenue_usd)} note="จากออเดอร์ที่เติมสำเร็จ" />
        <View style={styles.verticalLine} />
        <Metric label="กำไรขั้นต้น" value={money(summary?.estimated_gross_profit_usd)}
          note={summary?.missing_cost_count ? 'ข้อมูลต้นทุนไม่ครบ' : 'ก่อนหักค่าใช้จ่ายอื่น'} />
      </View>
      <View style={styles.horizontalLine} />
      <View style={styles.row}>
        <Metric label="ออเดอร์สำเร็จ" value={summary ? summary.counts.completed ?? 0 : '—'} />
        <View style={styles.verticalLine} />
        <Metric label="สลิปรอตรวจ" value={slipCount ?? '—'} warning={Boolean(slipCount)} />
      </View>
    </View>

    <View accessibilityLabel="เมนูลัด" style={[styles.panel, styles.shortcuts]}>
      {shortcuts.map(({name, label, icon, to}) => {
        const count = to === reviewQueue ? slipCount : to === '/chats' ? unread : null;
        return <Pressable key={to} accessibilityRole="button" accessibilityLabel={label}
          accessibilityHint={count ? count + ' รายการ' : undefined}
          onPress={() => go(to)} style={({pressed}) => [styles.shortcut, pressed && styles.pressed]}>
          <View style={styles.shortcutIcon}>
            <Icon name={icon} />
            <Badge count={count} color={to === reviewQueue ? colors.warning : colors.blue} />
          </View>
          <Text style={styles.shortcutLabel}>{name}</Text>
        </Pressable>;
      })}
    </View>

    <Group title="ออเดอร์ล่าสุด" action={() => go('/orders')}>
      {recent?.map((order, index) => {
        const ref = /^SQ-\d+$/.test(order.id) ? order.id : order.id.replaceAll('-', '').slice(-10);
        const details = order.details;
        const game = details.game_id ? games[details.game_id] ?? details.game_id : '';
        const statusColor = order.status === 'completed' ? colors.success : order.status === 'payment_review' ? colors.warning
          : order.status === 'issue' ? colors.danger : order.status === 'cancelled' ? colors.muted : colors.blue;
        return <View key={order.id}>
          {index > 0 && <View style={styles.horizontalLine} />}
          <Pressable accessibilityRole="button" onPress={() => openOrder(order.id)}
            style={({pressed}) => [styles.listRow, pressed && styles.pressed]}>
            <View style={styles.grow}>
              <Text numberOfLines={1} style={styles.body}><Text style={styles.semibold}>#{ref}</Text>  {[game, details.name].filter(Boolean).join(' ')}</Text>
              <Text numberOfLines={1} style={styles.caption}>{order.username ?? 'ลูกค้า'}  •  {dateTime.format(new Date(order.created_at))}</Text>
            </View>
            <View style={styles.summary}>
              <Text style={[styles.body, styles.semibold]}>{money(details.price_usd)}</Text>
              <View style={styles.status}><Dot color={statusColor} /><Text style={styles.caption}>{orderStatus[order.status] ?? order.status}</Text></View>
            </View>
            <Icon name="chevron_right" color={colors.muted} size={20} />
          </Pressable>
        </View>;
      })}
      {!recent && !data.recent.failed && online && <ActivityIndicator style={styles.placeholder} color={colors.blue} accessibilityLabel="กำลังโหลดออเดอร์" />}
      {recent?.length === 0 && <Text style={styles.placeholder}>ยังไม่มีออเดอร์ในรายการนี้</Text>}
    </Group>

    <Group title="สถานะซัพพลายเออร์">
      {sources?.map((source, index) => <View key={source.id ?? source.source_id ?? source.name}>
        {index > 0 && <View style={styles.horizontalLine} />}
        <Pressable accessibilityRole="button" onPress={() => go('/store/sources')}
          style={({pressed}) => [styles.listRow, pressed && styles.pressed]}>
          <Dot color={source.enabled ? colors.success : colors.muted} />
          <View style={styles.grow}>
            <Text style={[styles.body, styles.semibold]}>{source.name}</Text>
            <Text style={styles.caption}>{source.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</Text>
          </View>
          {source.package_count != null && <View style={styles.summary}>
            <Text style={styles.caption}>แพ็กเกจ</Text>
            <Text style={[styles.body, styles.semibold]}>{source.package_count.toLocaleString('en-US')}</Text>
          </View>}
        </Pressable>
      </View>)}
      {!sources && !data.sources.failed && online && <ActivityIndicator style={styles.placeholder} color={colors.blue} accessibilityLabel="กำลังโหลดซัพพลายเออร์" />}
      {sources?.length === 0 && <Text style={styles.placeholder}>ยังไม่มีซัพพลายเออร์</Text>}
    </Group>
  </View>;
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 16},
  panel: {borderRadius: 16, backgroundColor: colors.white, overflow: 'hidden'},
  notice: {minHeight: 44, backgroundColor: colors.quiet, borderRadius: 12, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8},
  urgent: {minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12},
  pressed: {backgroundColor: colors.quiet},
  body: {...type.body, color: colors.text},
  secondary: {...type.body, color: colors.secondary},
  caption: {...type.caption, color: colors.secondary},
  semibold: {fontWeight: '600'},
  grow: {flex: 1, minWidth: 0},
  row: {flexDirection: 'row'},
  metric: {flex: 1, minWidth: 0, gap: 4, paddingVertical: 12, paddingHorizontal: 16},
  metricValue: {...type.metric, color: colors.text},
  warning: {color: colors.warning},
  horizontalLine: {height: 1, backgroundColor: colors.line, marginHorizontal: 16},
  verticalLine: {width: 1, backgroundColor: colors.line, marginVertical: 12},
  shortcuts: {flexDirection: 'row', padding: 8, gap: 4},
  shortcut: {flex: 1, alignItems: 'center', minWidth: 44, minHeight: 44, paddingVertical: 8, paddingHorizontal: 4, gap: 4, borderRadius: 12},
  shortcutIcon: {width: 44, height: 44, borderRadius: 12, backgroundColor: colors.quiet, alignItems: 'center', justifyContent: 'center'},
  shortcutLabel: {...type.caption, textAlign: 'center', color: colors.text},
  group: {gap: 8},
  groupHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4},
  heading: {...type.section, color: colors.text},
  all: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 4},
  link: {...type.body, color: colors.blue},
  listRow: {minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16},
  summary: {alignItems: 'flex-end', flexShrink: 0, gap: 4},
  status: {flexDirection: 'row', alignItems: 'center', gap: 4},
  placeholder: {...type.body, color: colors.secondary, padding: 16},
});

import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {Header, Tabs} from './Chrome';
import {Overview} from './Overview';
import {useOverviewData} from './overview-data';
import {colors, type} from './theme';

function go(path: string) {
  if (path !== '/') window.location.assign('/admin-app/#' + path);
}

export default function App() {
  const {data, session, online, reload, reconnect} = useOverviewData();
  const sessionMessage = session === 'expired' ? 'เซสชันหมดอายุ กรุณาปิดแล้วเปิดใหม่จาก Telegram'
    : session === 'locked' ? 'เปิดแอปนี้จาก Telegram ด้วยบัญชีเจ้าของร้าน'
      : 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
  return <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      {session === 'ready' ? <View style={styles.app}>
        <Header online={online} connected={Boolean(data.navigation.value) && !data.navigation.failed} />
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Overview data={data} online={online} go={go} retry={reload} />
        </ScrollView>
        <Tabs go={go} unread={data.navigation.value?.unread_chat_rooms ?? null}
          pending={data.navigation.value?.pending_review_orders ?? null} />
      </View> : <View style={styles.session}>
        <Text accessibilityRole="header" aria-level={1} style={styles.title}>Squid first</Text>
        {session === 'loading' ? <ActivityIndicator color={colors.blue} accessibilityLabel="กำลังตรวจสอบสิทธิ์" />
          : <Text accessibilityRole="alert" style={styles.body}>{sessionMessage}</Text>}
        {session === 'error' && <Pressable accessibilityRole="button" onPress={reconnect} style={styles.retry}>
          <Text style={styles.link}>ลองอีกครั้ง</Text>
        </Pressable>}
      </View>}
    </SafeAreaView>
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.white},
  app: {flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.canvas},
  scroll: {flex: 1},
  session: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24, backgroundColor: colors.canvas},
  title: {...type.metric, color: colors.text},
  body: {...type.body, color: colors.secondary, textAlign: 'center'},
  retry: {minHeight: 44, justifyContent: 'center'},
  link: {...type.body, color: colors.blue},
});

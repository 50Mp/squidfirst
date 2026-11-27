export const colors = {
  canvas: '#F7F9FB', white: '#FFFFFF', quiet: '#F1F5F9',
  blue: '#2563EB', profile: '#004AC6', text: '#0F172A',
  secondary: '#64748B', muted: '#94A3B8', line: '#E2E8F0',
  success: '#10B981', warning: '#F59E0B', danger: '#DC2626',
};

const fontFamily = 'Inter Variable, system-ui, Tahoma, sans-serif';
export const type = {
  nav: {fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600'},
  section: {fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600'},
  body: {fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400'},
  caption: {fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '500'},
  metric: {fontFamily, fontSize: 24, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] as TextStyle['fontVariant']},
} as const;
import type {TextStyle} from 'react-native';


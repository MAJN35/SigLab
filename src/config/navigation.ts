/**
 * Single source of truth for SigLab navigation.
 * Used by the module drawer, the top-nav shortcuts and the Overview (Dashboard) tiles.
 * Page ids map 1:1 to the `#/<page-id>` hash routes and must not change.
 */
import {
  Activity,
  AudioLines,
  BarChart3,
  BookOpen,
  Brain,
  Database,
  Dna,
  Filter,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Layers,
  Radio,
  Signal,
  Split,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PageId } from '../types';

export type Lang = 'en' | 'fa';

export type NavGroupId =
  | 'start'
  | 'fundamentals'
  | 'audio'
  | 'communications'
  | 'biomedical'
  | 'statistical-ml'
  | 'workspace';

export type NavIcon = LucideIcon;

export interface NavItem {
  id: PageId;
  /** Full, plain-language name (drawer, page tiles). */
  label: string;
  faLabel: string;
  /** Compact name for the top navigation bar. */
  shortLabel: string;
  faShortLabel: string;
  icon: NavIcon;
  group: NavGroupId;
  /** One-line explanation shown on Overview tiles. */
  description: string;
  faDescription: string;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  faLabel: string;
}

/** Groups in learning order. */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'start', label: 'Start', faLabel: 'شروع' },
  { id: 'fundamentals', label: 'Fundamentals', faLabel: 'مبانی' },
  { id: 'audio', label: 'Audio', faLabel: 'صوت' },
  { id: 'communications', label: 'Communications', faLabel: 'مخابرات' },
  { id: 'biomedical', label: 'Biomedical', faLabel: 'زیست‌پزشکی' },
  { id: 'statistical-ml', label: 'Statistical & ML', faLabel: 'آمار و یادگیری ماشین' },
  { id: 'workspace', label: 'Workspace', faLabel: 'فضای کار' },
];

/** All pages, in learning order (group order, then step order within a group). */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    faLabel: 'نمای کلی',
    shortLabel: 'Overview',
    faShortLabel: 'نمای کلی',
    icon: LayoutDashboard,
    group: 'start',
    description: 'Where to begin, the learning path and every lab in one place.',
    faDescription: 'نقطه شروع، مسیر یادگیری و همه آزمایشگاه‌ها در یک صفحه.',
  },
  {
    id: 'signal-generator',
    label: 'Signal Generator',
    faLabel: 'تولیدکننده سیگنال',
    shortLabel: 'Signals',
    faShortLabel: 'سیگنال',
    icon: Activity,
    group: 'fundamentals',
    description: 'Build waveforms from sines, squares and noise, and see how sampling works.',
    faDescription: 'ساخت شکل‌موج از سینوسی، مربعی و نویز و مشاهده نحوه نمونه‌برداری.',
  },
  {
    id: 'fft-spectrum',
    label: 'FFT & Spectrum',
    faLabel: 'طیف فوریه و FFT',
    shortLabel: 'Spectrum',
    faShortLabel: 'طیف',
    icon: BarChart3,
    group: 'fundamentals',
    description: 'Find the frequencies hidden in a signal and compare window functions.',
    faDescription: 'یافتن فرکانس‌های پنهان در سیگنال و مقایسه توابع پنجره.',
  },
  {
    id: 'filtering',
    label: 'Digital Filtering',
    faLabel: 'فیلترینگ دیجیتال',
    shortLabel: 'Filters',
    faShortLabel: 'فیلترها',
    icon: Filter,
    group: 'fundamentals',
    description: 'Design low-, high- and band-pass filters (FIR and IIR) to remove noise.',
    faDescription: 'طراحی فیلترهای پایین‌گذر، بالاگذر و میان‌گذر (FIR و IIR) برای حذف نویز.',
  },
  {
    id: 'wavelet-analysis',
    label: 'Wavelet Analysis',
    faLabel: 'تحلیل موجک',
    shortLabel: 'Wavelets',
    faShortLabel: 'موجک',
    icon: Layers,
    group: 'fundamentals',
    description: 'See how a signal changes over time and frequency at the same time.',
    faDescription: 'مشاهده تغییرات سیگنال هم‌زمان در زمان و فرکانس.',
  },
  {
    id: 'audio-lab',
    label: 'Audio & Spectrogram',
    faLabel: 'صوت و طیف‌نگار',
    shortLabel: 'Audio',
    faShortLabel: 'صوت',
    icon: AudioLines,
    group: 'audio',
    description: 'Play or record sound, add noise, measure SNR and watch the live spectrogram.',
    faDescription: 'پخش یا ضبط صدا، افزودن نویز، اندازه‌گیری SNR و مشاهده طیف‌نگار زنده.',
  },
  {
    id: 'telecommunications',
    label: 'Analog Telecom',
    faLabel: 'مخابرات آنالوگ',
    shortLabel: 'Analog',
    faShortLabel: 'آنالوگ',
    icon: Radio,
    group: 'communications',
    description: 'Send a message with AM and FM through a noisy channel and recover it.',
    faDescription: 'ارسال پیام با AM و FM از کانال نویزی و بازیابی آن.',
  },
  {
    id: 'modulation-ber',
    label: 'Digital Modulation & BER',
    faLabel: 'مدولاسیون دیجیتال و BER',
    shortLabel: 'Digital Mod',
    faShortLabel: 'مدولاسیون',
    icon: Signal,
    group: 'communications',
    description: 'Compare BPSK, QPSK and QAM constellations and their bit error rates.',
    faDescription: 'مقایسه منظومه‌های BPSK، QPSK و QAM و نرخ خطای بیت آن‌ها.',
  },
  {
    id: 'eeg-simulator',
    label: 'EEG Simulator',
    faLabel: 'شبیه‌ساز نوار مغز (EEG)',
    shortLabel: 'EEG',
    faShortLabel: 'EEG',
    icon: Waves,
    group: 'biomedical',
    description: 'Generate brain rhythms and artifacts, then clean them with filters.',
    faDescription: 'تولید ریتم‌های مغزی و آرتیفکت‌ها و پاک‌سازی آن‌ها با فیلتر.',
  },
  {
    id: 'dna-simulator',
    label: '3D DNA Simulator',
    faLabel: 'شبیه‌ساز سه‌بعدی DNA',
    shortLabel: '3D DNA',
    faShortLabel: 'DNA سه‌بعدی',
    icon: Dna,
    group: 'biomedical',
    description: 'Explore the double helix and all 47 chromosomes in an interactive 3D view.',
    faDescription: 'کاوش مارپیچ دوگانه و هر ۴۷ کروموزوم در نمای سه‌بعدی تعاملی.',
  },
  {
    id: 'pca',
    label: 'PCA',
    faLabel: 'تحلیل مؤلفه‌های اصلی (PCA)',
    shortLabel: 'PCA',
    faShortLabel: 'PCA',
    icon: GitBranch,
    group: 'statistical-ml',
    description: 'Reduce many channels to a few principal components that keep most variance.',
    faDescription: 'کاهش کانال‌های متعدد به چند مؤلفه اصلی که بیشترین واریانس را حفظ می‌کنند.',
  },
  {
    id: 'ica',
    label: 'ICA Source Separation',
    faLabel: 'جداسازی منابع مستقل (ICA)',
    shortLabel: 'ICA',
    faShortLabel: 'ICA',
    icon: Split,
    group: 'statistical-ml',
    description: 'Unmix overlapping signals back into their independent sources with FastICA.',
    faDescription: 'تفکیک سیگنال‌های درهم‌آمیخته به منابع مستقل با FastICA.',
  },
  {
    id: 'deep-learning',
    label: 'Deep Learning',
    faLabel: 'یادگیری عمیق',
    shortLabel: 'Deep Learning',
    faShortLabel: 'یادگیری عمیق',
    icon: Brain,
    group: 'statistical-ml',
    description: 'Train small neural networks in the browser to classify and denoise signals.',
    faDescription: 'آموزش شبکه‌های عصبی کوچک در مرورگر برای طبقه‌بندی و نویززدایی سیگنال.',
  },
  {
    id: 'custom-samples',
    label: 'Custom Samples',
    faLabel: 'نمونه‌های سفارشی',
    shortLabel: 'Samples',
    faShortLabel: 'نمونه‌ها',
    icon: Database,
    group: 'workspace',
    description: 'Import your own data files and reuse them across the labs.',
    faDescription: 'وارد کردن فایل‌های داده خودتان و استفاده از آن‌ها در همه آزمایشگاه‌ها.',
  },
  {
    id: 'experiments',
    label: 'Saved Experiments',
    faLabel: 'آزمایش‌های ذخیره‌شده',
    shortLabel: 'Experiments',
    faShortLabel: 'آزمایش‌ها',
    icon: FlaskConical,
    group: 'workspace',
    description: 'Save, reload and share your lab settings, or start from a ready-made preset.',
    faDescription: 'ذخیره، بارگذاری و اشتراک تنظیمات یا شروع از یک سناریوی آماده.',
  },
  {
    id: 'documentation',
    label: 'Reference & Math',
    faLabel: 'مرجع و ریاضیات',
    shortLabel: 'Reference',
    faShortLabel: 'مرجع',
    icon: BookOpen,
    group: 'workspace',
    description: 'Formulas, definitions and background theory behind every lab.',
    faDescription: 'فرمول‌ها، تعاریف و نظریه پشت هر آزمایشگاه.',
  },
];

/** Pages shown as shortcuts in the top navigation bar (desktop). */
export const TOP_NAV_IDS: PageId[] = [
  'dashboard',
  'signal-generator',
  'fft-spectrum',
  'filtering',
  'audio-lab',
  'dna-simulator',
  'documentation',
];

/** The Fundamentals sequence, used as the "Start here" learning path. */
export const LEARNING_PATH_IDS: PageId[] = [
  'signal-generator',
  'fft-spectrum',
  'filtering',
  'wavelet-analysis',
];

const NAV_BY_ID = new Map<PageId, NavItem>(NAV_ITEMS.map((item) => [item.id, item]));

export function getNavItem(id: PageId): NavItem {
  const item = NAV_BY_ID.get(id);
  if (!item) throw new Error(`Unknown page id: ${id}`);
  return item;
}

export function getNavItemsByGroup(group: NavGroupId): NavItem[] {
  return NAV_ITEMS.filter((item) => item.group === group);
}

/** Groups paired with their items, in learning order (empty groups omitted). */
export function getGroupedNav(): { group: NavGroup; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({ group, items: getNavItemsByGroup(group.id) })).filter(
    (g) => g.items.length > 0
  );
}

export const TOP_NAV_ITEMS: NavItem[] = TOP_NAV_IDS.map(getNavItem);
export const LEARNING_PATH: NavItem[] = LEARNING_PATH_IDS.map(getNavItem);

export const navLabel = (item: NavItem | NavGroup, lang: Lang): string =>
  lang === 'fa' ? item.faLabel : item.label;
export const navShortLabel = (item: NavItem, lang: Lang): string =>
  lang === 'fa' ? item.faShortLabel : item.shortLabel;
export const navDescription = (item: NavItem, lang: Lang): string =>
  lang === 'fa' ? item.faDescription : item.description;

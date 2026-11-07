export type KaryotypeMode =
  | '46,XX'
  | '46,XY'
  | '47,XY,+21'
  | '47,XX,+21'
  | '47,XXY'
  | '47,XY,+18'
  | '47,XX,+13'
  | '47,XYY';

export type ChromosomeId =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '21'
  | '22'
  | 'X'
  | 'Y';

export type TraitCategory =
  | 'all'
  | 'eye-color'
  | 'depression-mood'
  | 'skin-hair'
  | 'brain-cognition'
  | 'speech-sensory'
  | 'sleep-circadian'
  | 'metabolism-blood'
  | 'trisomy-sex';

export interface CytogeneticBand {
  code: string;
  arm: 'p' | 'q';
  /** Normalized position from top (p-telomere = 0) to bottom (q-telomere = 1) */
  pos: number;
  stain: 'gneg' | 'gpos25' | 'gpos50' | 'gpos75' | 'gpos100' | 'acen';
}

export interface ChromosomeSpec {
  id: ChromosomeId;
  label: string;
  faLabel: string;
  sizeMb: number;
  geneCount: number;
  /** Normalized visual height in 3D [0.22 .. 1.0] */
  lengthNorm: number;
  /** Centromere position from top p-tip [0.14 .. 0.48] */
  centromereRatio: number;
  morphology: 'metacentric' | 'submetacentric' | 'acrocentric';
  colorAccent: string;
  summaryEn: string;
  summaryFa: string;
  keyTraitsEn: string[];
  keyTraitsFa: string[];
  bands: CytogeneticBand[];
}

export interface AlleleVariant {
  id: string;
  genotype: string;
  labelEn: string;
  labelFa: string;
  phenotypeEn: string;
  phenotypeFa: string;
  previewColor: string;
  /** Single-nucleotide or motif substitution applied to reference sequence */
  mutatedCodonIndex: number;
  mutatedBase: 'A' | 'T' | 'C' | 'G';
  expressionShift: number; // -1.0 to +1.0
}

export interface GeneLocus {
  id: string;
  geneSymbol: string;
  fullNameEn: string;
  fullNameFa: string;
  chromosome: ChromosomeId;
  cytogeneticBand: string;
  arm: 'p' | 'q';
  /** Normalized position along the chromosome [0.05 .. 0.95] */
  normPos: number;
  category: Exclude<TraitCategory, 'all'>;
  traitTitleEn: string;
  traitTitleFa: string;
  mechanismEn: string;
  mechanismFa: string;
  inheritanceEn: string;
  inheritanceFa: string;
  referenceSequence: string;
  alleles: AlleleVariant[];
}

export interface KaryotypeInstance {
  instanceIndex: number; // 1 .. 46 or 1 .. 47
  chromId: ChromosomeId;
  copyNumber: 1 | 2 | 3;
  isSexChromosome: boolean;
  isTrisomicExtra: boolean;
  label: string;
  spec: ChromosomeSpec;
}

export interface KaryotypePresetInfo {
  id: KaryotypeMode;
  totalChromosomes: 46 | 47;
  sexLabelEn: string;
  sexLabelFa: string;
  titleEn: string;
  titleFa: string;
  descriptionEn: string;
  descriptionFa: string;
  trisomyChromosome?: ChromosomeId;
}

export const KARYOTYPE_PRESETS: KaryotypePresetInfo[] = [
  {
    id: '46,XX',
    totalChromosomes: 46,
    sexLabelEn: 'Female (XX)',
    sexLabelFa: 'زن (۴۶ کروموزوم — XX)',
    titleEn: '46,XX — Standard Female Karyotype',
    titleFa: 'کاریوتایپ استاندارد زن (46,XX)',
    descriptionEn:
      '22 homologous autosome pairs (Chr 1–22) plus two X sex chromosomes (46 chromosomes total). Full biallelic X-linked gene dosage regulated via X-inactivation (Lyonization).',
    descriptionFa:
      'شامل ۲۲ جفت کروموزوم اتوزوم (۱ تا ۲۲) به همراه دو کروموزوم جنسی X (مجموعاً ۴۶ کروموزوم). تنظیم دوز ژنی از طریق غیرفعال‌سازی یکی از کروموزوم‌های X انجام می‌شود.',
  },
  {
    id: '46,XY',
    totalChromosomes: 46,
    sexLabelEn: 'Male (XY)',
    sexLabelFa: 'مرد (۴۶ کروموزوم — XY)',
    titleEn: '46,XY — Standard Male Karyotype',
    titleFa: 'کاریوتایپ استاندارد مرد (46,XY)',
    descriptionEn:
      '22 homologous autosome pairs (Chr 1–22) plus one X and one Y sex chromosome (46 chromosomes total). The SRY locus on Yp11.2 initiates male gonadal differentiation.',
    descriptionFa:
      'شامل ۲۲ جفت کروموزوم اتوزوم (۱ تا ۲۲) به همراه یک کروموزوم X و یک کروموزوم Y (مجموعاً ۴۶ کروموزوم). ژن SRY روی بازوی کوتاه کروموزوم Y تعیین‌کننده جنسیت مرد است.',
  },
  {
    id: '47,XY,+21',
    totalChromosomes: 47,
    sexLabelEn: 'Male Trisomy 21 (47)',
    sexLabelFa: 'مرد ۴۷ کروموزومی — تریزومی ۲۱',
    titleEn: '47,XY,+21 — Trisomy 21 (Down Syndrome, Male)',
    titleFa: 'کاریوتایپ ۴۷ کروموزومی (47,XY,+21 — سندرم داون)',
    descriptionEn:
      'All 47 chromosomes visible in 3D: 22 autosome pairs + a 3rd supernumerary copy of Chromosome 21 (47th chromosome) + XY sex chromosomes. Extra dosage at 21q22.12 (DYRK1A, RCAN1, APP) alters neurodevelopment and craniofacial morphogenesis.',
    descriptionFa:
      'نمایش کامل هر ۴۷ کروموزوم: وجود نسخه سوم کروموزوم ۲۱ (کروموزوم شماره ۴۷) به همراه جفت جنسی XY که باعث افزایش دوز ژن‌های ناحیه بحرانی 21q22 می‌شود.',
    trisomyChromosome: '21',
  },
  {
    id: '47,XX,+21',
    totalChromosomes: 47,
    sexLabelEn: 'Female Trisomy 21 (47)',
    sexLabelFa: 'زن ۴۷ کروموزومی — تریزومی ۲۱',
    titleEn: '47,XX,+21 — Trisomy 21 (Down Syndrome, Female)',
    titleFa: 'کاریوتایپ ۴۷ کروموزومی زن (47,XX,+21 — تریزومی ۲۱)',
    descriptionEn:
      'All 47 chromosomes rendered in 3D: 22 autosome pairs + a 3rd copy of Chromosome 21 (47th chromosome) + XX sex chromosomes.',
    descriptionFa:
      'نمایش کامل ۴۷ کروموزوم در نمای سه‌بعدی شامل سه نسخه از کروموزوم ۲۱ و دو کروموزوم جنسی XX.',
    trisomyChromosome: '21',
  },
  {
    id: '47,XXY',
    totalChromosomes: 47,
    sexLabelEn: 'Klinefelter (47,XXY)',
    sexLabelFa: 'سندرم کلاین‌فلتر (47,XXY — ۴۷ کروموزوم)',
    titleEn: '47,XXY — Klinefelter Syndrome (47 Chromosomes)',
    titleFa: 'کاریوتایپ ۴۷ کروموزومی کلاین‌فلتر (47,XXY)',
    descriptionEn:
      'All 47 chromosomes rendered in 3D: 22 autosome pairs + two X chromosomes and one Y chromosome. Extra SHOX gene copy on pseudoautosomal region Xp22.33 increases stature height.',
    descriptionFa:
      'دارای ۴۷ کروموزوم شامل ۲۲ جفت اتوزوم به علاوه دو کروموزوم X و یک کروموزوم Y. نسخه اضافی ژن SHOX موجب افزایش قد می‌شود.',
    trisomyChromosome: 'X',
  },
  {
    id: '47,XY,+18',
    totalChromosomes: 47,
    sexLabelEn: 'Trisomy 18 (47,XY,+18)',
    sexLabelFa: 'تریزومی ۱۸ (۴۷ کروموزوم — سندرم ادواردز)',
    titleEn: '47,XY,+18 — Trisomy 18 (Edwards Syndrome)',
    titleFa: 'کاریوتایپ ۴۷ کروموزومی تریزومی ۱۸ (47,XY,+18)',
    descriptionEn:
      'All 47 chromosomes rendered in 3D with three copies of submetacentric Chromosome 18 (18q12–q21 critical locus).',
    descriptionFa:
      'نمایش کامل ۴۷ کروموزوم همراه با نسخه سوم کروموزوم ۱۸ (سندرم ادواردز).',
    trisomyChromosome: '18',
  },
  {
    id: '47,XX,+13',
    totalChromosomes: 47,
    sexLabelEn: 'Trisomy 13 (47,XX,+13)',
    sexLabelFa: 'تریزومی ۱۳ (۴۷ کروموزوم — سندرم پاتو)',
    titleEn: '47,XX,+13 — Trisomy 13 (Patau Syndrome)',
    titleFa: 'کاریوتایپ ۴۷ کروموزومی تریزومی ۱۳ (47,XX,+13)',
    descriptionEn:
      'All 47 chromosomes rendered in 3D with three copies of acrocentric Chromosome 13.',
    descriptionFa:
      'نمایش کامل ۴۷ کروموزوم همراه با نسخه سوم کروموزوم آکروسنتریک ۱۳.',
    trisomyChromosome: '13',
  },
  {
    id: '47,XYY',
    totalChromosomes: 47,
    sexLabelEn: 'Jacob Syndrome (47,XYY)',
    sexLabelFa: 'سندرم جیکوب (47,XYY — ۴۷ کروموزوم)',
    titleEn: '47,XYY — Supernumerary Y Karyotype (47 Chromosomes)',
    titleFa: 'کاریوتایپ ۴۷ کروموزومی (47,XYY)',
    descriptionEn:
      'All 47 chromosomes rendered in 3D: 22 autosome pairs + one X and two Y chromosomes.',
    descriptionFa:
      'نمایش ۴۷ کروموزوم شامل ۲۲ جفت اتوزوم، یک کروموزوم X و دو کروموزوم Y.',
    trisomyChromosome: 'Y',
  },
];

function makeBands(centromereRatio: number, seed: number): CytogeneticBand[] {
  const stains: CytogeneticBand['stain'][] = ['gneg', 'gpos50', 'gneg', 'gpos75', 'gneg', 'gpos100', 'gpos25'];
  const list: CytogeneticBand[] = [];
  for (let i = 0; i < 8; i++) {
    const pos = (i + 0.5) / 8;
    const isCen = Math.abs(pos - centromereRatio) < 0.08;
    const arm: 'p' | 'q' = pos < centromereRatio ? 'p' : 'q';
    const bandNum = arm === 'p' ? Math.ceil((centromereRatio - pos) * 30) : Math.ceil((pos - centromereRatio) * 30);
    list.push({
      code: `${arm}${Math.max(11, bandNum)}`,
      arm,
      pos,
      stain: isCen ? 'acen' : stains[(i + seed) % stains.length],
    });
  }
  return list;
}

export const CHROMOSOME_SPECS: Record<ChromosomeId, ChromosomeSpec> = {
  '1': {
    id: '1',
    label: 'Chr 1',
    faLabel: 'کروموزوم ۱',
    sizeMb: 248.96,
    geneCount: 2058,
    lengthNorm: 1.0,
    centromereRatio: 0.48,
    morphology: 'metacentric',
    colorAccent: '#38bdf8',
    summaryEn: 'Largest human chromosome (~8% of total DNA). Houses genes for neurogenesis, glaucoma (MYOC), and Rh blood factor (RHD).',
    summaryFa: 'بزرگ‌ترین کروموزوم انسان (حدود ۸٪ کل DNA). حاوی ژن‌های فاکتور خونی Rh (RHD)، عصب‌زایی و متابولیسم پایه.',
    keyTraitsEn: ['Rh Blood Factor (RHD)', 'Brain Volume & Cortical Folding (NOTCH2NL)', 'MTHFR Folate Metabolism'],
    keyTraitsFa: ['فاکتور گروه خونی Rh', 'رشد قشر مغز (NOTCH2NL)', 'متابولیسم فولات (MTHFR)'],
    bands: makeBands(0.48, 1),
  },
  '2': {
    id: '2',
    label: 'Chr 2',
    faLabel: 'کروموزوم ۲',
    sizeMb: 242.19,
    geneCount: 1309,
    lengthNorm: 0.96,
    centromereRatio: 0.39,
    morphology: 'submetacentric',
    colorAccent: '#22d3ee',
    summaryEn: 'Second largest chromosome; originated from an ancestral telomere-to-telomere fusion. Regulates circadian sleep rhythm (PER2) and lactase persistence (LCT).',
    summaryFa: 'دومین کروموزوم بزرگ انسان. کنترل‌کننده ساعت بیولوژیک خواب و بیداری (PER2)، تحمل لاکتوز (LCT) و تکامل اسکلتی (HOXD).',
    keyTraitsEn: ['Circadian Sleep Phase (PER2)', 'Lactose Tolerance (LCT)', 'Color & Cone Photoreceptor (CNGA3)'],
    keyTraitsFa: ['ریتم شبانه‌روزی خواب (PER2)', 'هضم لاکتوز (LCT)', 'گیرنده‌های نوری شبکیه'],
    bands: makeBands(0.39, 2),
  },
  '3': {
    id: '3',
    label: 'Chr 3',
    faLabel: 'کروموزوم ۳',
    sizeMb: 198.3,
    geneCount: 1078,
    lengthNorm: 0.82,
    centromereRatio: 0.46,
    morphology: 'metacentric',
    colorAccent: '#34d399',
    summaryEn: 'Metacentric chromosome housing Dopamine D3 receptor (DRD3 — reward/mood), rhodopsin night vision (RHO), and oxytocin receptor (OXTR — empathy & social bonding).',
    summaryFa: 'حاوی ژن گیرنده اکسی‌توسین (OXTR — همدلی و پیوند عاطفی)، گیرنده دوپامین D3 (DRD3 — خلق‌وخو و انگیزه) و دید در شب (RHO).',
    keyTraitsEn: ['Social Empathy & Oxytocin (OXTR)', 'Dopamine D3 Mood Receptor (DRD3)', 'Night Vision Rhodopsin (RHO)'],
    keyTraitsFa: ['گیرنده اکسی‌توسین و همدلی (OXTR)', 'گیرنده دوپامین و انگیزه (DRD3)', 'دید در شب (RHO)'],
    bands: makeBands(0.46, 3),
  },
  '4': {
    id: '4',
    label: 'Chr 4',
    faLabel: 'کروموزوم ۴',
    sizeMb: 190.21,
    geneCount: 752,
    lengthNorm: 0.78,
    centromereRatio: 0.28,
    morphology: 'submetacentric',
    colorAccent: '#a3e635',
    summaryEn: 'Contains master circadian pacemaker gene CLOCK (4q12), Huntingtin (HTT), and alcohol dehydrogenase cluster (ADH1B).',
    summaryFa: 'حاوی ژن ساعت مرکزی بدن (CLOCK در 4q12)، ژن HTT و آنزیم‌های متابولیسم (ADH1B).',
    keyTraitsEn: ['Master Circadian Pacemaker (CLOCK)', 'Motor Coordination (HTT)', 'Facial Morphology (FGFR3)'],
    keyTraitsFa: ['ساعت بیولوژیک مرکزی (CLOCK)', 'هماهنگی حرکتی (HTT)', 'فرم استخوان‌بندی (FGFR3)'],
    bands: makeBands(0.28, 4),
  },
  '5': {
    id: '5',
    label: 'Chr 5',
    faLabel: 'کروموزوم ۵',
    sizeMb: 181.54,
    geneCount: 876,
    lengthNorm: 0.75,
    centromereRatio: 0.27,
    morphology: 'submetacentric',
    colorAccent: '#facc15',
    summaryEn: 'Regulates glucocorticoid stress receptor (NR3C1 — cortisol response in depression/anxiety), MATP/SLC45A2 skin/hair pigmentation, and SMN1 motor neurons.',
    summaryFa: 'تنظیم‌کننده گیرنده هورمون استرس کورتیزول (NR3C1 مرتبط با اضطراب و افسردگی) و ژن رنگ‌پذیری پوست و مو (SLC45A2).',
    keyTraitsEn: ['Cortisol Stress Receptor (NR3C1)', 'Skin/Eye Melanin Transport (SLC45A2)', 'Spinal Motor Neuron (SMN1)'],
    keyTraitsFa: ['گیرنده استرس و کورتیزول (NR3C1)', 'انتقال ملانین پوست و چشم (SLC45A2)', 'نورون‌های حرکتی (SMN1)'],
    bands: makeBands(0.27, 5),
  },
  '6': {
    id: '6',
    label: 'Chr 6',
    faLabel: 'کروموزوم ۶',
    sizeMb: 170.81,
    geneCount: 1048,
    lengthNorm: 0.71,
    centromereRatio: 0.36,
    morphology: 'submetacentric',
    colorAccent: '#fb923c',
    summaryEn: 'Home to the Major Histocompatibility Complex (HLA — adaptive immunity), IRF4 (freckling, hair/eye shading), and ESR1 estrogen receptor.',
    summaryFa: 'قطب سیستم ایمنی بدن (کمپلکس HLA)، ژن IRF4 (تیرگی مو، حساسیت پوست به آفتاب و کک‌ومک) و گیرنده استروژن.',
    keyTraitsEn: ['HLA Immune Identity', 'Hair Shade & Freckling (IRF4)', 'Synaptic Plasticity (SYNGAP1)'],
    keyTraitsFa: ['سیستم ایمنی تطبیقی (HLA)', 'رنگ مو و حساسیت به نور (IRF4)', 'پلاستیسیته سیناپسی'],
    bands: makeBands(0.36, 6),
  },
  '7': {
    id: '7',
    label: 'Chr 7',
    faLabel: 'کروموزوم ۷',
    sizeMb: 159.35,
    geneCount: 989,
    lengthNorm: 0.67,
    centromereRatio: 0.37,
    morphology: 'submetacentric',
    colorAccent: '#f87171',
    summaryEn: 'Contains FOXP2 (7q31.1 — human speech, vocalization, and grammar circuitry), TAS2R38 bitter taste perception, and CFTR ion channel.',
    summaryFa: 'حاوی ژن کلیدی گفتار و زبان انسان (FOXP2 در 7q31.1)، گیرنده چشایی تلخی (TAS2R38) و کانال یونی CFTR.',
    keyTraitsEn: ['Speech & Language Circuitry (FOXP2)', 'Bitter Taste Perception (TAS2R38)', 'Elastin Connective Tissue (ELN)'],
    keyTraitsFa: ['مدار عصبی گفتار و زبان (FOXP2)', 'حس چشایی تلخی (TAS2R38)', 'پروتئین الاستین بافت (ELN)'],
    bands: makeBands(0.37, 7),
  },
  '8': {
    id: '8',
    label: 'Chr 8',
    faLabel: 'کروموزوم ۸',
    sizeMb: 145.14,
    geneCount: 677,
    lengthNorm: 0.62,
    centromereRatio: 0.31,
    morphology: 'submetacentric',
    colorAccent: '#e879f9',
    summaryEn: 'Regulates neural crest development, FGFR1, and MYC proto-oncogene transcription factor.',
    summaryFa: 'تنظیم‌کننده تمایز سلول‌های عصبی، فاکتور رونویسی MYC و رشد استخوانی.',
    keyTraitsEn: ['Neural Crest Patterning', 'Cell Cycle Regulation (MYC)', 'Lipoprotein Lipase (LPL)'],
    keyTraitsFa: ['الگودهی تاج عصبی', 'تنظیم چرخه سلولی (MYC)', 'متابولیسم لیپیدها (LPL)'],
    bands: makeBands(0.31, 8),
  },
  '9': {
    id: '9',
    label: 'Chr 9',
    faLabel: 'کروموزوم ۹',
    sizeMb: 138.39,
    geneCount: 786,
    lengthNorm: 0.59,
    centromereRatio: 0.35,
    morphology: 'submetacentric',
    colorAccent: '#c084fc',
    summaryEn: 'Determines ABO Blood Group system (9q34.2), TYRP1 brown/black eumelanin synthesis, and Interferon type-I antiviral cluster.',
    summaryFa: 'تعیین‌کننده گروه خونی ABO (در ناحیه 9q34.2)، آنزیم سنتز ملانین قهوه‌ای/مشکی (TYRP1) و اینترفرون‌های ضدویروسی.',
    keyTraitsEn: ['ABO Blood Type (9q34.2)', 'Eumelanin Iris/Hair Pigment (TYRP1)', 'Type-I Interferon Antiviral Defense'],
    keyTraitsFa: ['گروه خونی ABO (9q34.2)', 'رنگدانه قهوه‌ای مو و عنبیه (TYRP1)', 'ایمنی ضدویروسی اینترفرون'],
    bands: makeBands(0.35, 9),
  },
  '10': {
    id: '10',
    label: 'Chr 10',
    faLabel: 'کروموزوم ۱۰',
    sizeMb: 133.8,
    geneCount: 733,
    lengthNorm: 0.57,
    centromereRatio: 0.31,
    morphology: 'submetacentric',
    colorAccent: '#818cf8',
    summaryEn: 'Houses PTEN tumor suppressor, CYP2C19 drug metabolism enzyme, and PCDH15 cochlear hair-cell mechanotransduction (hearing).',
    summaryFa: 'حاوی ژن PCDH15 (سلول‌های مژک‌دار حلزون گوش برای شنوایی فرکانس‌ها)، آنزیم CYP2C19 و سرکوبگر تومور PTEN.',
    keyTraitsEn: ['Cochlear Auditory Hair Cells (PCDH15)', 'Hepatic Enzyme CYP2C19', 'Cellular Neuroprotection (PTEN)'],
    keyTraitsFa: ['سلول‌های شنوایی حلزون گوش (PCDH15)', 'متابولیسم دارویی (CYP2C19)', 'حفاظت سلولی (PTEN)'],
    bands: makeBands(0.31, 10),
  },
  '11': {
    id: '11',
    label: 'Chr 11',
    faLabel: 'کروموزوم ۱۱',
    sizeMb: 135.09,
    geneCount: 1298,
    lengthNorm: 0.57,
    centromereRatio: 0.4,
    morphology: 'submetacentric',
    colorAccent: '#38bdf8',
    summaryEn: 'Gene-dense chromosome containing BDNF (11p14.1 — brain neuroplasticity, depression resilience), DRD4 (dopamine novelty seeking), TYR (tyrosinase skin/eye melanin), HBB (hemoglobin), and ACTN3 (fast-twitch sprint muscle).',
    summaryFa: 'یکی از غنی‌ترین کروموزوم‌ها: حاوی BDNF (نوروپلاستیسیته مغز و مقاومت در برابر افسردگی)، DRD4 (گیرنده دوپامین)، TYR (آنزیم تیروزیناز رنگ پوست و چشم)، HBB (هموگلوبین خون) و ACTN3 (عضلات سرعتی).',
    keyTraitsEn: [
      'Neuroplasticity & Mood Resilience (BDNF)',
      'Tyrosinase Skin/Eye Melanin (TYR)',
      'Fast-Twitch Sprint Muscle (ACTN3)',
      'Beta-Globin Hemoglobin (HBB)',
    ],
    keyTraitsFa: [
      'پلاستیسیته عصبی و ضدافسردگی (BDNF)',
      'آنزیم تیروزیناز رنگ پوست و چشم (TYR)',
      'تارهای عضلانی سرعتی (ACTN3)',
      'هموگلوبین بتا خون (HBB)',
    ],
    bands: makeBands(0.4, 11),
  },
  '12': {
    id: '12',
    label: 'Chr 12',
    faLabel: 'کروموزوم ۱۲',
    sizeMb: 133.28,
    geneCount: 1034,
    lengthNorm: 0.56,
    centromereRatio: 0.28,
    morphology: 'submetacentric',
    colorAccent: '#2dd4bf',
    summaryEn: 'Contains PAH (phenylalanine hydroxylase — precursor to dopamine/norepinephrine/melanin), KITLG (blonde hair enhancer), and ALDH2.',
    summaryFa: 'حاوی ژن PAH (پیش‌ساز سنتز دوپامین، نوراپی‌نفرین و ملانین)، ژن KITLG (تنظیم رنگ موی روشن/بلوند) و ALDH2.',
    keyTraitsEn: ['Dopamine/Melanin Precursor (PAH)', 'Hair Follicle Pigmentation (KITLG)', ' Aldehyde Dehydrogenase (ALDH2)'],
    keyTraitsFa: ['پیش‌ساز دوپامین و ملانین (PAH)', 'رنگدانه فولیکول مو (KITLG)', 'آنزیم متابولیک ALDH2'],
    bands: makeBands(0.28, 12),
  },
  '13': {
    id: '13',
    label: 'Chr 13',
    faLabel: 'کروموزوم ۱۳',
    sizeMb: 114.36,
    geneCount: 327,
    lengthNorm: 0.49,
    centromereRatio: 0.16,
    morphology: 'acrocentric',
    colorAccent: '#4ade80',
    summaryEn: 'Acrocentric chromosome housing HTR2A (13q14.2 — Serotonin 5-HT2A receptor linked to major depression, mood & emotional regulation), BRCA2, and GJB2 (Connexin-26 auditory gap junction).',
    summaryFa: 'کروموزوم آکروسنتریک حاوی ژن HTR2A (گیرنده سروتونین 5-HT2A در 13q14.2 مرتبط با تنظیم خلق‌وخو و افسردگی)، ژن شنوایی GJB2 و ژن ترمیم DNA (BRCA2).',
    keyTraitsEn: ['Serotonin 5-HT2A Mood Receptor (HTR2A)', 'Auditory Connexin-26 (GJB2)', 'DNA Repair (BRCA2)'],
    keyTraitsFa: ['گیرنده سروتونین و خلق‌وخو (HTR2A)', 'پروتئین شنوایی کانکسین-۲۶ (GJB2)', 'ترمیم مضاعف DNA (BRCA2)'],
    bands: makeBands(0.16, 13),
  },
  '14': {
    id: '14',
    label: 'Chr 14',
    faLabel: 'کروموزوم ۱۴',
    sizeMb: 107.04,
    geneCount: 830,
    lengthNorm: 0.46,
    centromereRatio: 0.17,
    morphology: 'acrocentric',
    colorAccent: '#a3e635',
    summaryEn: 'Acrocentric chromosome containing Immunoglobulin Heavy Chain locus (IGH), MYH7 cardiac myosin, and Presenilin-1 (PSEN1).',
    summaryFa: 'کروموزوم آکروسنتریک حاوی جایگاه زنجیره سنگین آنتی‌بادی‌ها (IGH)، میوزین عضله قلب (MYH7) و PSEN1.',
    keyTraitsEn: ['Antibody Heavy Chain Repertoire (IGH)', 'Cardiac Muscle Myosin (MYH7)', 'Thyroid Hormone Transport'],
    keyTraitsFa: ['تنوع آنتی‌بادی‌های ایمنی (IGH)', 'میوزین ضربان قلب (MYH7)', 'انتقال هورمون تیروئید'],
    bands: makeBands(0.17, 14),
  },
  '15': {
    id: '15',
    label: 'Chr 15',
    faLabel: 'کروموزوم ۱۵',
    sizeMb: 101.99,
    geneCount: 613,
    lengthNorm: 0.44,
    centromereRatio: 0.18,
    morphology: 'acrocentric',
    colorAccent: '#f59e0b',
    summaryEn: 'Primary hub for Human Eye Color & Skin Pigmentation! Houses OCA2 & HERC2 (15q13.1 — controls brown vs. blue/green iris melanin) and SLC24A5 (15q21.1 — major determinant of human skin melanin tone).',
    summaryFa: 'مرکز اصلی تعیین رنگ چشم و رنگ پوست در انسان! حاوی ژن‌های HERC2 و OCA2 (در 15q13.1 برای تعیین رنگ چشم قهوه‌ای، عسلی، سبز یا آبی) و ژن SLC24A5 (در 15q21.1 برای تعیین تناژ ملانین پوست).',
    keyTraitsEn: [
      'Eye Color Switch (HERC2 / OCA2 at 15q13.1)',
      'Skin Melanin Tone (SLC24A5 at 15q21.1)',
      'Connective Fibrillin-1 (FBN1)',
    ],
    keyTraitsFa: [
      'تعیین رنگ چشم (HERC2 / OCA2 در 15q13.1)',
      'تعیین رنگ و ملانین پوست (SLC24A5 در 15q21.1)',
      'فیبریلین بافت همبند (FBN1)',
    ],
    bands: makeBands(0.18, 15),
  },
  '16': {
    id: '16',
    label: 'Chr 16',
    faLabel: 'کروموزوم ۱۶',
    sizeMb: 90.34,
    geneCount: 873,
    lengthNorm: 0.4,
    centromereRatio: 0.41,
    morphology: 'metacentric',
    colorAccent: '#f97316',
    summaryEn: 'Houses MC1R (16q24.3 — Melanocortin-1 Receptor controlling eumelanin vs. pheomelanin ratio in skin, freckles, and red/auburn hair) and alpha-globin cluster (HBA1/HBA2).',
    summaryFa: 'حاوی ژن MC1R (در 16q24.3 — گیرنده ملانوکورتین-۱ که نسبت رنگدانه‌های تیره و روشن پوست و موی قرمز/طلایی را تنظیم می‌کند) و خوشه آلفا گلوبین خون.',
    keyTraitsEn: ['Skin & Hair Melanin Switch (MC1R at 16q24.3)', 'Alpha-Globin Oxygen Transport (HBA1)', 'FTO Metabolic Rate'],
    keyTraitsFa: ['گیرنده ملانوکورتین پوست و مو (MC1R)', 'زنجیره آلفا هموگلوبین (HBA1)', 'تنظیم نرخ متابولیسم (FTO)'],
    bands: makeBands(0.41, 16),
  },
  '17': {
    id: '17',
    label: 'Chr 17',
    faLabel: 'کروموزوم ۱۷',
    sizeMb: 83.26,
    geneCount: 1197,
    lengthNorm: 0.37,
    centromereRatio: 0.31,
    morphology: 'submetacentric',
    colorAccent: '#ec4899',
    summaryEn: 'Key Neuro-Psychiatric & Repair Chromosome: Houses SLC6A4 / SERT (17q11.2 — Serotonin Transporter 5-HTTLPR governing synaptic serotonin reuptake, emotional reactivity & depression susceptibility), TP53 ("Guardian of the Genome"), and BRCA1.',
    summaryFa: 'کروموزوم کلیدی اعصاب و روان: حاوی ژن ناقل سروتونین SLC6A4 / 5-HTTLPR (در 17q11.2 — بازجذب سروتونین در سیناپس‌های مغز، واکنش به استرس و استعداد افسردگی)، ژن محافظ ژنوم TP53 و BRCA1.',
    keyTraitsEn: [
      'Serotonin Transporter & Depression (SLC6A4 at 17q11.2)',
      'Genome Guardian Tumor Suppressor (TP53)',
      'Microtubule Tau Protein (MAPT)',
    ],
    keyTraitsFa: [
      'ناقل سروتونین و افسردگی (SLC6A4 در 17q11.2)',
      'نگهبان ژنوم و ترمیم سلول (TP53)',
      'پروتئین تاو در نورون‌ها (MAPT)',
    ],
    bands: makeBands(0.31, 17),
  },
  '18': {
    id: '18',
    label: 'Chr 18',
    faLabel: 'کروموزوم ۱۸',
    sizeMb: 80.37,
    geneCount: 270,
    lengthNorm: 0.35,
    centromereRatio: 0.24,
    morphology: 'submetacentric',
    colorAccent: '#a855f7',
    summaryEn: 'Lowest gene density among autosomes. Contains TCF4 (neurodevelopment), MC4R (appetite & energy homeostasis), and SMAD4. Triplication causes 47-chromosome Edwards Syndrome (+18).',
    summaryFa: 'حاوی ژن TCF4 (تکامل سیستم عصبی) و MC4R (تنظیم اشتها و تعادل انرژی). وجود نسخه سوم آن منجر به کاریوتایپ ۴۷ کروموزومی تریزومی ۱۸ می‌شود.',
    keyTraitsEn: ['Energy & Appetite Regulation (MC4R)', 'Neurodevelopmental Transcription (TCF4)', 'Trisomy 18 Locus'],
    keyTraitsFa: ['تنظیم تعادل انرژی و اشتها (MC4R)', 'فاکتور رونویسی عصبی (TCF4)', 'ناحیه تریزومی ۱۸'],
    bands: makeBands(0.24, 18),
  },
  '19': {
    id: '19',
    label: 'Chr 19',
    faLabel: 'کروموزوم ۱۹',
    sizeMb: 58.62,
    geneCount: 1472,
    lengthNorm: 0.29,
    centromereRatio: 0.45,
    morphology: 'metacentric',
    colorAccent: '#6366f1',
    summaryEn: 'Highest gene density of all human chromosomes (more than double the genome-wide average). Contains APOE (19q13.32 — lipid transport, synaptic repair & cognitive longevity), LDLR, and olfactory receptor clusters.',
    summaryFa: 'پرتراکم‌ترین کروموزوم انسان از نظر تعداد ژن! حاوی ژن APOE (در 19q13.32 — بازسازی سیناپس‌های مغز، حافظه و طول عمر شناختی) و خوشه گیرنده‌های بویایی.',
    keyTraitsEn: ['Brain Plasticity & Memory Longevity (APOE)', 'Olfactory & Taste Receptors', 'LDL Cholesterol Receptor (LDLR)'],
    keyTraitsFa: ['سلامت شناختی و حافظه (APOE)', 'گیرنده‌های حس بویایی', 'تنظیم کلسترول خون (LDLR)'],
    bands: makeBands(0.45, 19),
  },
  '20': {
    id: '20',
    label: 'Chr 20',
    faLabel: 'کروموزوم ۲۰',
    sizeMb: 64.44,
    geneCount: 544,
    lengthNorm: 0.3,
    centromereRatio: 0.44,
    morphology: 'metacentric',
    colorAccent: '#0ea5e9',
    summaryEn: 'Metacentric chromosome housing ASIP (20q11.22 — Agouti Signaling Protein regulating dark vs. light pigmentation in skin/hair), PRNP (prion protein), and EDN3.',
    summaryFa: 'حاوی ژن ASIP (در 20q11.22 — پروتئین سیگنال‌دهی آگوتی که تیرگی و روشنی پوست و مو را تنظیم می‌کند) و ژن PRNP.',
    keyTraitsEn: ['Agouti Skin/Hair Pigmentation (ASIP)', 'Synaptic Prion Glycoprotein (PRNP)', 'Bone Morphogenetic Protein (BMP2)'],
    keyTraitsFa: ['پروتئین آگوتی رنگ پوست و مو (ASIP)', 'گلیکوپروتئین سیناپسی (PRNP)', 'رشد استخوانی (BMP2)'],
    bands: makeBands(0.44, 20),
  },
  '21': {
    id: '21',
    label: 'Chr 21',
    faLabel: 'کروموزوم ۲۱',
    sizeMb: 46.71,
    geneCount: 234,
    lengthNorm: 0.23,
    centromereRatio: 0.2,
    morphology: 'acrocentric',
    colorAccent: '#10b981',
    summaryEn: 'Smallest human autosome (46.7 Mb). Contains DYRK1A, RCAN1 (DSCR1), SOD1 (antioxidant superoxide dismutase), and APP. A third copy produces the 47-chromosome karyotype (47,XX,+21 or 47,XY,+21 — Down Syndrome).',
    summaryFa: 'کوچک‌ترین اتوزوم انسان. حاوی ژن‌های DYRK1A، RCAN1 و آنزیم آنتی‌اکسیدان SOD1. حضور کپی سوم این کروموزوم کاریوتایپ ۴۷ کروموزومی تریزومی ۲۱ (سندرم داون) را ایجاد می‌کند.',
    keyTraitsEn: [
      'Down Syndrome Critical Region (DYRK1A / RCAN1 at 21q22)',
      'Superoxide Dismutase Antioxidant (SOD1)',
      'Cochlear High-Frequency Hearing (TMPRSS3)',
    ],
    keyTraitsFa: [
      'ناحیه بحرانی تریزومی ۲۱ (DYRK1A / RCAN1 در 21q22)',
      'آنزیم آنتی‌اکسیدان سلولی (SOD1)',
      'شنوایی فرکانس‌های بالا (TMPRSS3)',
    ],
    bands: makeBands(0.2, 21),
  },
  '22': {
    id: '22',
    label: 'Chr 22',
    faLabel: 'کروموزوم ۲۲',
    sizeMb: 50.82,
    geneCount: 488,
    lengthNorm: 0.25,
    centromereRatio: 0.21,
    morphology: 'acrocentric',
    colorAccent: '#14b8a6',
    summaryEn: 'First human chromosome to be fully sequenced. Houses COMT (22q11.21 — Catechol-O-Methyltransferase Val158Met enzyme that breaks down prefrontal cortex dopamine/norepinephrine, shaping stress resilience, executive focus, and mood), plus MYH9 and IGL.',
    summaryFa: 'اولین کروموزوم تعیین‌توالی‌شده انسان. حاوی ژن کلیدی COMT (در 22q11.21 — آنزیم تجزیه‌کننده دوپامین در قشر پیش‌پیشانی مغز که تمرکز، تحمل استرس و خلق‌وخو را تنظیم می‌کند).',
    keyTraitsEn: [
      'Prefrontal Dopamine & Stress Balance (COMT at 22q11.21)',
      'Immunoglobulin Lambda Light Chain (IGL)',
      'Myoglobin Oxygen Storage (MB)',
    ],
    keyTraitsFa: [
      'تعادل دوپامین قشر پیش‌پیشانی و استرس (COMT)',
      'زنجیره سبک آنتی‌بادی (IGL)',
      'میوگلوبین ذخیره اکسیژن عضلات (MB)',
    ],
    bands: makeBands(0.21, 22),
  },
  X: {
    id: 'X',
    label: 'Chr X',
    faLabel: 'کروموزوم جنسی X',
    sizeMb: 156.04,
    geneCount: 842,
    lengthNorm: 0.66,
    centromereRatio: 0.38,
    morphology: 'submetacentric',
    colorAccent: '#f43f5e',
    summaryEn: 'Female (XX) and Male (XY) sex chromosome rich in neurocognitive genes, Red/Green Cone Opsin photopigments (OPN1LW / OPN1MW at Xq28 — color vision), MAOA (Monoamine Oxidase A neurotransmitter enzyme), AR, and SHOX stature gene.',
    summaryFa: 'کروموزوم جنسی غنی از ژن‌های شناختی مغز، فتورسپتورهای دید رنگ قرمز و سبز شبکیه (OPN1LW/MW در Xq28)، آنزیم انتقال‌دهنده عصبی مونوآمین اکسیداز (MAOA) و ژن قد SHOX.',
    keyTraitsEn: [
      'Trichromatic Color Vision Opsins (OPN1LW/MW at Xq28)',
      'Monoamine Oxidase Mood Enzyme (MAOA at Xp11.3)',
      'Stature & Skeletal Growth (SHOX at Xp22.33)',
    ],
    keyTraitsFa: [
      'دید رنگی شبکیه چشم (OPN1LW/MW در Xq28)',
      'آنزیم تنظیم‌کننده خلق‌وخو (MAOA در Xp11.3)',
      'ژن رشد قد و اسکلت (SHOX در Xp22.33)',
    ],
    bands: makeBands(0.38, 23),
  },
  Y: {
    id: 'Y',
    label: 'Chr Y',
    faLabel: 'کروموزوم جنسی Y',
    sizeMb: 57.23,
    geneCount: 72,
    lengthNorm: 0.26,
    centromereRatio: 0.24,
    morphology: 'acrocentric',
    colorAccent: '#06b6d4',
    summaryEn: 'Male-determining sex chromosome. Houses SRY (Yp11.2 — Sex-Determining Region Y transcription factor SOX9 activator), USP9Y, DAZ spermatogenesis cluster, and shared pseudoautosomal SHOX stature copy.',
    summaryFa: 'کروموزوم اختصاصی جنسیت مرد. حاوی ژن تعیین جنسیت SRY (در بازوی کوتاه Yp11.2)، خوشه ژنی DAZ و ناحیه شبه‌اتوزومی مشترک SHOX.',
    keyTraitsEn: [
      'Master Male Sex Determination (SRY at Yp11.2)',
      'Paternal Lineage Haplogroup Loci',
      'Pseudoautosomal Stature Locus (SHOX)',
    ],
    keyTraitsFa: [
      'ژن اصلی تعیین جنسیت مرد (SRY در Yp11.2)',
      'نشانگرهای تبار پدری (Y-DNA)',
      'ناحیه شبه‌اتوزومی قد (SHOX)',
    ],
    bands: makeBands(0.24, 24),
  },
};

export const GENE_LOCI: GeneLocus[] = [
  {
    id: 'herc2-oca2-eye',
    geneSymbol: 'HERC2 / OCA2',
    fullNameEn: ' Melanosomal P-Protein & Enhancer Switch (rs12913832)',
    fullNameFa: 'کلید تنظیمی ملانین عنبیه چشم (HERC2 / OCA2)',
    chromosome: '15',
    cytogeneticBand: '15q13.1',
    arm: 'q',
    normPos: 0.34,
    category: 'eye-color',
    traitTitleEn: 'Human Eye Color (Brown, Hazel, Green, Blue)',
    traitTitleFa: 'رنگ چشم انسان (قهوه‌ای، عسلی، سبز، آبی)',
    mechanismEn:
      'Intron 86 of HERC2 contains the evolutionary regulatory SNP rs12913832 that acts as a distal enhancer switch for the adjacent OCA2 promoter. The ancestral A allele drives high OCA2 melanosome transport in the iris stroma (producing brown eyes), whereas the derived G allele reduces OCA2 transcription by ~85%, causing Tyndall Rayleigh scattering of light in the stroma (producing blue or green eyes).',
    mechanismFa:
      'ناحیه تنظیمی rs12913832 درون ژن HERC2 روی کروموزوم ۱۵ (باند 15q13.1) مانند یک کلید روشن/خاموش برای ژن مجاور OCA2 عمل می‌کند. آلل A تولید ملانین بالا در استرومای عنبیه (چشم قهوه‌ای) را فعال می‌کند، درحالی‌که آلل G بیان OCA2 را کاهش داده و با پراکندگی نوری تیندال، چشم آبی یا سبز ایجاد می‌کند.',
    inheritanceEn: 'Oligogenic / Distal Enhancer Switch (Dominant A brown over recessive G blue, modulated by TYRP1 & SLC24A4)',
    inheritanceFa: 'تنظیم افزاینده الیگوژنیک (آلل A غالب برای چشم قهوه‌ای نسبت به آلل G برای چشم آبی/سبز)',
    referenceSequence: 'CCTGATGATGATAGCGTGCACAAATGGTTGACCTGCTGAAGGCTAACCTTGG',
    alleles: [
      {
        id: 'eye-brown',
        genotype: 'A / A (Ancestral Enhancer Active)',
        labelEn: 'A/A — High Melanin (Deep Brown Eyes)',
        labelFa: 'ژنوتایپ A/A — ملانین بالا (چشم قهوه‌ای تیره)',
        phenotypeEn: 'Rich eumelanin density in anterior iris border layer; high UV absorption.',
        phenotypeFa: 'تراکم بالای اوملانین در لایه قدامی عنبیه؛ رنگ قهوه‌ای تیره و جذب بالای پرتو فرابنفش.',
        previewColor: '#5c3a21',
        mutatedCodonIndex: 7,
        mutatedBase: 'A',
        expressionShift: 0.85,
      },
      {
        id: 'eye-hazel-green',
        genotype: 'A / G (Heterozygous Intermediate)',
        labelEn: 'A/G — Intermediate Melanin (Hazel / Green Eyes)',
        labelFa: 'ژنوتایپ A/G — ملانین متوسط (چشم عسلی / سبز)',
        phenotypeEn: 'Moderate stromal lipochrome + partial melanin ring producing hazel or emerald-green iris.',
        phenotypeFa: 'ترکیب ملانین متوسط و رنگدانه لیپوکروم که طیف چشم عسلی یا سبز ایجاد می‌کند.',
        previewColor: '#4d7c4b',
        mutatedCodonIndex: 7,
        mutatedBase: 'C',
        expressionShift: 0.15,
      },
      {
        id: 'eye-blue',
        genotype: 'G / G (Attenuated OCA2 Promoter)',
        labelEn: 'G/G — Low Stromal Melanin (Blue Eyes)',
        labelFa: 'ژنوتایپ G/G — ملانین کم در استروما (چشم آبی)',
        phenotypeEn: '85% reduction in OCA2 transcription; short-wavelength Rayleigh light scattering yields vivid blue iris.',
        phenotypeFa: 'کاهش ۸۵ درصدی بیان OCA2؛ پراکندگی طول‌موج کوتاه نور (پدیده رایلی) رنگ آبی عنبیه را می‌سازد.',
        previewColor: '#2589bd',
        mutatedCodonIndex: 7,
        mutatedBase: 'G',
        expressionShift: -0.75,
      },
    ],
  },
  {
    id: 'slc6a4-depression',
    geneSymbol: 'SLC6A4 (5-HTTLPR)',
    fullNameEn: 'Serotonin Transporter Solute Carrier Family 6 Member 4',
    fullNameFa: 'ژن ناقل سروتونین مغز (SLC6A4 / 5-HTTLPR)',
    chromosome: '17',
    cytogeneticBand: '17q11.2',
    arm: 'q',
    normPos: 0.42,
    category: 'depression-mood',
    traitTitleEn: 'Depression Susceptibility, Serotonin Reuptake & Emotional Stress Response',
    traitTitleFa: 'حساسیت به افسردگی، بازجذب سروتونین و واکنش هیجانی به استرس',
    mechanismEn:
      'Located on Chromosome 17q11.2, SLC6A4 encodes the synaptic Serotonin Transporter (SERT) that clears 5-HT (serotonin) from the synaptic cleft in the amygdala and prefrontal-limbic circuit. The 5-HTTLPR promoter repeat polymorphism (Long L vs. Short S allele) alters transcriptional efficiency, modulating amygdala reactivity to environmental stress and Major Depressive Disorder (MDD) vulnerability.',
    mechanismFa:
      'واقع بر کروموزوم ۱۷ (باند 17q11.2)، این ژن پروتئین ناقل سروتونین (SERT) را در سیناپس‌های مغز کدگذاری می‌کند. پلی‌مورفیسم ناحیه پروموتر (آلل بلند L در برابر آلل کوتاه S) سرعت بازجذب سروتونین و شدت واکنش آمیگدال مغز به استرس‌های محیطی، اضطراب و افسردگی را تنظیم می‌کند.',
    inheritanceEn: 'Polygenic Gene × Environment (G×E) Epigenetic Interaction',
    inheritanceFa: 'چندژنی همراه با برهم‌کنش ژن و محیط (Gene × Environment)',
    referenceSequence: 'ATGGAGTTCTCRTGCACGAACCCGATCGTCAGCTTCCAGAACATGACGGCC',
    alleles: [
      {
        id: 'sert-ll',
        genotype: 'L / L (Long Promoter Repeat)',
        labelEn: 'L/L — High Baseline SERT Expression (Stress Resilient)',
        labelFa: 'آلل L/L — بیان متعادل ناقل سروتونین (مقاومت بالا در برابر استرس)',
        phenotypeEn: 'Rapid synaptic serotonin homeostatic recycling; balanced prefrontal-amygdala coupling.',
        phenotypeFa: 'تنظیم پایدار سروتونین سیناپسی و تعادل قوی بین قشر پیش‌پیشانی و آمیگدال در مواجهه با فشار روانی.',
        previewColor: '#10b981',
        mutatedCodonIndex: 4,
        mutatedBase: 'G',
        expressionShift: 0.7,
      },
      {
        id: 'sert-ls',
        genotype: 'L / S (Heterozygous Promoter)',
        labelEn: 'L/S — Moderate Serotonergic Sensitivity',
        labelFa: 'آلل L/S — حساسیت هیجانی متوسط و انعطاف‌پذیر',
        phenotypeEn: 'Balanced emotional vigilance; high responsiveness to positive social support.',
        phenotypeFa: 'هوشیاری هیجانی متعادل و پاسخ‌پذیری بالا به محیط‌های حمایتی.',
        previewColor: '#38bdf8',
        mutatedCodonIndex: 4,
        mutatedBase: 'A',
        expressionShift: 0.0,
      },
      {
        id: 'sert-ss',
        genotype: 'S / S (Short 44-bp Deletion Repeat)',
        labelEn: 'S/S — Heightened Amygdala Stress Reactivity',
        labelFa: 'آلل S/S — کاهش رونویسی SERT (حساسیت بالا به استرس و افسردگی)',
        phenotypeEn: '~50% lower SERT mRNA transcription; heightened limbic sensitivity to adverse life events.',
        phenotypeFa: 'کاهش حدود ۵۰ درصدی رونویسی ناقل سروتونین؛ افزایش واکنش‌پذیری مدار لیمبیک به استرس.',
        previewColor: '#f43f5e',
        mutatedCodonIndex: 4,
        mutatedBase: 'T',
        expressionShift: -0.7,
      },
    ],
  },
  {
    id: 'bdnf-neuroplasticity',
    geneSymbol: 'BDNF (Val66Met)',
    fullNameEn: 'Brain-Derived Neurotrophic Factor (rs6265)',
    fullNameFa: 'فاکتور نوروتروفیک مشتق از مغز (BDNF — پلاستیسیته عصبی و خلق‌وخو)',
    chromosome: '11',
    cytogeneticBand: '11p14.1',
    arm: 'p',
    normPos: 0.24,
    category: 'depression-mood',
    traitTitleEn: 'Hippocampal Neurogenesis, Depression Recovery & Episodic Memory',
    traitTitleFa: 'عصب‌زایی هیپوکامپ، بهبود افسردگی و حافظه اپیزودیک',
    mechanismEn:
      'Located on Chromosome 11p14.1, BDNF promotes synaptic sprouting, long-term potentiation (LTP), and survival of serotonergic and dopaminergic neurons. Chronic stress lowers hippocampal BDNF; physical exercise and antidepressant therapies restore BDNF transcription.',
    mechanismFa:
      'واقع بر بازوی کوتاه کروموزوم ۱۱ (باند 11p14.1)، ژن BDNF عامل اصلی رشد سیناپس‌های جدید در هیپوکامپ، تقویت حافظه بلندمدت و محافظت از نورون‌ها در برابر افسردگی ناشی از استرس مزمن است.',
    inheritanceEn: 'Codominant Activity-Dependent Secretion (Val66 vs. Met66)',
    inheritanceFa: 'هم‌بارز وابسته به فعالیت سیناپسی (پلی‌مورفیسم Val66Met)',
    referenceSequence: 'ATGACCATCCTTTTCCTTACTATGGTTATTTCATACTTTGGTTGCATGAAGG',
    alleles: [
      {
        id: 'bdnf-val-val',
        genotype: 'Val66 / Val66 (G/G)',
        labelEn: 'Val/Val — Peak Activity-Dependent BDNF Secretion',
        labelFa: 'ژنوتایپ Val/Val — ترشح بهینه BDNF و نوروپلاستیسیته قوی',
        phenotypeEn: 'Robust hippocampal synaptic remodeling and rapid neuroplastic adaptation.',
        phenotypeFa: 'بازسازی سریع سیناپس‌های هیپوکامپ و مقاومت بالا در برابر افت خلق‌وخو.',
        previewColor: '#22d3ee',
        mutatedCodonIndex: 9,
        mutatedBase: 'G',
        expressionShift: 0.8,
      },
      {
        id: 'bdnf-val-met',
        genotype: 'Val66 / Met66 (G/A)',
        labelEn: 'Val/Met — Intermediate Neurotrophic Trafficking',
        labelFa: 'ژنوتایپ Val/Met — ترشح متوسط فاکتور رشد عصبی',
        phenotypeEn: 'Moderated activity-dependent dendritic BDNF release; strongly boosted by aerobic exercise.',
        phenotypeFa: 'رهش متوسط BDNF که با ورزش هوازی و خواب منظم به شدت تقویت می‌شود.',
        previewColor: '#a855f7',
        mutatedCodonIndex: 9,
        mutatedBase: 'A',
        expressionShift: -0.25,
      },
    ],
  },
  {
    id: 'slc24a5-skin',
    geneSymbol: 'SLC24A5',
    fullNameEn: 'Solute Carrier Family 24 Member 5 Melanosome Exchanger',
    fullNameFa: 'ژن مبدل کلسیم ملانوزوم پوست (SLC24A5)',
    chromosome: '15',
    cytogeneticBand: '15q21.1',
    arm: 'q',
    normPos: 0.58,
    category: 'skin-hair',
    traitTitleEn: 'Skin Color & Melanin Pigmentation Tone',
    traitTitleFa: 'رنگ پوست و میزان تولید رنگدانه ملانین',
    mechanismEn:
      'Located on Chromosome 15q21.1, SLC24A5 encodes a potassium-dependent sodium/calcium exchanger (NCKX5) in melanocyte membranes. The Ala111Thr (rs1426654) polymorphism accounts for 25–38% of natural melanin variation between darker and lighter human skin tones by regulating melanosome pH and tyrosinase maturation.',
    mechanismFa:
      'واقع بر کروموزوم ۱۵ (باند 15q21.1)، این ژن پمپ یونی غشای ملانوسیت‌های پوست را کدگذاری می‌کند و به تنهایی مسئول ۲۵ تا ۳۸ درصد تفاوت طبیعی تناژ رنگ پوست (تیره، گندمی، روشن) در جمعیت‌های انسانی است.',
    inheritanceEn: 'Additive Polygenic (acting alongside MC1R on Chr 16, TYR on Chr 11, and SLC45A2 on Chr 5)',
    inheritanceFa: 'چندژنی افزایشی (در کنار ژن‌های MC1R روی کروموزوم ۱۶ و TYR روی کروموزوم ۱۱)',
    referenceSequence: 'ATGCGCTACGTGCTGGCCATCCTGGGCGCCCTGCTCTTCTACGCCTTCGGCC',
    alleles: [
      {
        id: 'skin-ala111',
        genotype: 'Ala111 / Ala111 (G/G)',
        labelEn: 'Ala111 — High Eumelanin Maturation (Deep / Olive-Brown Skin)',
        labelFa: 'آلل Ala111 — بلوغ کامل ملانوزوم (پوست سبزه تیره و مقاوم به UV)',
        phenotypeEn: 'Stage IV mature melanosomes with dense photoprotective eumelanin.',
        phenotypeFa: 'ملانوزوم‌های مرحله چهارم با تراکم بالای اوملانین و محافظت طبیعی در برابر پرتو فرابنفش.',
        previewColor: '#8d5524',
        mutatedCodonIndex: 6,
        mutatedBase: 'G',
        expressionShift: 0.9,
      },
      {
        id: 'skin-het',
        genotype: 'Ala111 / Thr111 (G/A)',
        labelEn: 'Ala/Thr — Intermediate Melanin Tone (Mediterranean / Tan)',
        labelFa: 'ژنوتایپ هتروزیگوت Ala/Thr — پوست گندمی / مدیترانه‌ای',
        phenotypeEn: 'Balanced eumelanin synthesis with strong facultative tanning response.',
        phenotypeFa: 'سنتز متعادل ملانین همراه با قابلیت برنزه‌شدن بالا در برابر نور خورشید.',
        previewColor: '#c68642',
        mutatedCodonIndex: 6,
        mutatedBase: 'C',
        expressionShift: 0.2,
      },
      {
        id: 'skin-thr111',
        genotype: 'Thr111 / Thr111 (A/A)',
        labelEn: 'Thr111 — Reduced Melanosome Ca²⁺ Exchange (Fair / Light Skin)',
        labelFa: 'آلل Thr111 — کاهش تبادل کلسیم ملانوزوم (پوست روشن)',
        phenotypeEn: 'Lower baseline epidermal eumelanin facilitating cutaneous Vitamin D3 synthesis at higher latitudes.',
        phenotypeFa: 'تراکم کمتر اوملانین اپیدرم که سنتز ویتامین D3 را در عرض‌های جغرافیایی با تابش کمتر تسهیل می‌کند.',
        previewColor: '#f1c27d',
        mutatedCodonIndex: 6,
        mutatedBase: 'A',
        expressionShift: -0.65,
      },
    ],
  },
  {
    id: 'mc1r-hair-skin',
    geneSymbol: 'MC1R',
    fullNameEn: 'Melanocortin 1 Receptor (16q24.3)',
    fullNameFa: 'گیرنده ملانوکورتین-۱ (MC1R — رنگ مو و کک‌ومک پوست)',
    chromosome: '16',
    cytogeneticBand: '16q24.3',
    arm: 'q',
    normPos: 0.88,
    category: 'skin-hair',
    traitTitleEn: 'Hair Color (Black/Brown vs. Red/Auburn) & UV Sensitivity',
    traitTitleFa: 'رنگ مو (مشکی/قهوه‌ای در برابر قرمز/طلایی) و حساسیت پوست به آفتاب',
    mechanismEn:
      'Located near the q-arm telomere of Chromosome 16 (16q24.3), MC1R is activated by alpha-MSH to switch melanocytes from synthesizing red/yellow sulfur-rich pheomelanin to dark brown/black eumelanin.',
    mechanismFa:
      'واقع در انتهای بازوی بلند کروموزوم ۱۶ (باند 16q24.3)، گیرنده MC1R تعیین می‌کند که سلول‌های رنگدانه‌ای، اوملانین (رنگ مشکی/قهوه‌ای) تولید کنند یا فئوملانین (رنگ قرمز/طلایی و کک‌ومک پوست).',
    inheritanceEn: 'Autosomal Recessive for Red Hair / Pheomelanin Dominance',
    inheritanceFa: 'اتوزومال مغلوب برای موی قرمز و غالب برای سنتز اوملانین تیره',
    referenceSequence: 'ATGGCTGTGCAGGGATCCCAGAGAAGACTTCTGGGCTCCCTCAACTCCACCC',
    alleles: [
      {
        id: 'mc1r-wt',
        genotype: 'WT / WT (High cAMP Signaling)',
        labelEn: 'Wild-Type — Eumelanin Dominant (Dark Brown / Black Hair)',
        labelFa: 'نوع وحشی (WT) — غلبه اوملانین (موی مشکی یا قهوه‌ای تیره)',
        phenotypeEn: 'High intracellular cAMP converts dopaquinone into photoprotective brown/black eumelanin.',
        phenotypeFa: 'سیگنال‌دهی قوی cAMP که رنگدانه محافظ اوملانین تیره را در فولیکول مو می‌سازد.',
        previewColor: '#2c1b18',
        mutatedCodonIndex: 5,
        mutatedBase: 'C',
        expressionShift: 0.8,
      },
      {
        id: 'mc1r-r151c',
        genotype: 'Arg151Cys (Pheomelanin Shift)',
        labelEn: 'Arg151Cys — Pheomelanin Shift (Auburn / Red Hair & Fair Skin)',
        labelFa: 'واریانت Arg151Cys — افزایش فئوملانین (موی قرمز/مسی و پوست روشن)',
        phenotypeEn: 'Reduced receptor coupling shifts pigment synthesis toward reddish-gold pheomelanin.',
        phenotypeFa: 'تغییر مسیر سنتز رنگدانه به سمت فئوملانین طلایی-قرمز.',
        previewColor: '#b55239',
        mutatedCodonIndex: 5,
        mutatedBase: 'T',
        expressionShift: -0.7,
      },
    ],
  },
  {
    id: 'comt-cognition-mood',
    geneSymbol: 'COMT (Val158Met)',
    fullNameEn: 'Catechol-O-Methyltransferase Prefrontal Dopamine Enzyme',
    fullNameFa: 'آنزیم تنظیم‌کننده دوپامین قشر پیش‌پیشانی (COMT)',
    chromosome: '22',
    cytogeneticBand: '22q11.21',
    arm: 'q',
    normPos: 0.36,
    category: 'depression-mood',
    traitTitleEn: 'Prefrontal Dopamine Tone, Working Memory & Stress Resilience ("Warrior vs. Worrier")',
    traitTitleFa: 'سطح دوپامین پیش‌پیشانی، تمرکز ذهنی و تحمل استرس',
    mechanismEn:
      'Located on Chromosome 22q11.21, COMT catabolizes >60% of dopamine in the human prefrontal cortex. The Val158 allele encodes a thermostable high-activity enzyme (rapidly clearing dopamine under acute pressure), whereas the Met158 allele has ~40% lower enzymatic activity, leaving higher baseline synaptic dopamine for sustained working memory and analytical focus.',
    mechanismFa:
      'واقع بر کروموزوم ۲۲ (باند 22q11.21)، آنزیم COMT بیش از ۶۰٪ دوپامین قشر پیش‌پیشانی مغز را تنظیم می‌کند. آلل Val158 دوپامین اضافی را در شرایط پراسترس سریع‌تر پاکسازی می‌کند، درحالی‌که آلل Met158 سطح دوپامین پایه بالاتری برای تمرکز عمیق و حافظه کاری فراهم می‌سازد.',
    inheritanceEn: 'Codominant Enzymatic Kinetics (Inverted-U Dopamine Curve)',
    inheritanceFa: 'هم‌بارز (منحنی U-وارونه سطح دوپامین و کارایی شناختی)',
    referenceSequence: 'ATGCCGGAGGCCCCGCCTCTGCTGTTGGCCTGTGFDCTGCTGGCCTGTGCTG',
    alleles: [
      {
        id: 'comt-val',
        genotype: 'Val158 / Val158 (High Enzyme Velocity)',
        labelEn: 'Val/Val — Fast Dopamine Clearance (Stress Resilient under Pressure)',
        labelFa: 'ژنوتایپ Val/Val — پاکسازی سریع دوپامین (عملکرد پایدار در شرایط پراسترس)',
        phenotypeEn: 'Optimal performance under high-arousal stress when dopamine surges.',
        phenotypeFa: 'عملکرد عالی در محیط‌های پرفشار که ترشح ناگهانی کاتکول‌آمین‌ها رخ می‌دهد.',
        previewColor: '#14b8a6',
        mutatedCodonIndex: 8,
        mutatedBase: 'G',
        expressionShift: 0.65,
      },
      {
        id: 'comt-met',
        genotype: 'Met158 / Met158 (High Prefrontal Dopamine)',
        labelEn: 'Met/Met — High Baseline Prefrontal Dopamine (Deep Analytical Focus)',
        labelFa: 'ژنوتایپ Met/Met — دوپامین پایه بالا (تمرکز تحلیلی و حافظه کاری قوی)',
        phenotypeEn: 'Elevated tonic dopamine in dorsolateral prefrontal cortex enhancing complex problem-solving.',
        phenotypeFa: 'سطح بالای دوپامین پایه در قشر پیش‌پیشانی که دقت محاسباتی و حافظه کاری را تقویت می‌کند.',
        previewColor: '#6366f1',
        mutatedCodonIndex: 8,
        mutatedBase: 'A',
        expressionShift: -0.5,
      },
    ],
  },
  {
    id: 'foxp2-speech',
    geneSymbol: 'FOXP2',
    fullNameEn: 'Forkhead Box Protein P2 Vocal-Motor Transcription Factor',
    fullNameFa: 'ژن مدار عصبی گفتار، زبان و پردازش صوت (FOXP2)',
    chromosome: '7',
    cytogeneticBand: '7q31.1',
    arm: 'q',
    normPos: 0.68,
    category: 'speech-sensory',
    traitTitleEn: 'Human Speech Articulation, Vocal Formant Control & Grammar Circuitry',
    traitTitleFa: 'تولید گفتار، کنترل فرمانت‌های صوتی و پردازش زبان',
    mechanismEn:
      'Located on Chromosome 7q31.1, FOXP2 carries two uniquely human amino-acid substitutions (Thr303Asn, Asn325Ser) that remodel cortico-basal ganglia-thalamocortical circuits required for rapid orofacial motor sequencing and vocal formant articulation.',
    mechanismFa:
      'واقع بر بازوی بلند کروموزوم ۷ (باند 7q31.1)، ژن FOXP2 دارای دو تغییر تکاملی منحصربه‌فرد در انسان است که مدارهای عقده‌های قاعده‌ای و قشر حرکتی مغز را برای هماهنگی دقیق حنجره، تولید فرمانت‌های صوتی و گرامر زبان شکل می‌دهد.',
    inheritanceEn: 'Autosomal Dominant Haploinsufficiency Sensitivity',
    inheritanceFa: 'اتوزومال غالب با حساسیت بالا به دوز رونویسی در قشر مغز',
    referenceSequence: 'ATGATGCAGGAATCTGCGACAGAGACAATAAGCAACAGTTCAATGANGTAA',
    alleles: [
      {
        id: 'foxp2-human',
        genotype: 'Asn303 / Ser325 (Modern Human Motif)',
        labelEn: 'Modern Human Variant — High Synaptic Striatal Plasticity',
        labelFa: 'واریانت انسانی مدرن — هماهنگی کامل مدار گفتار و پردازش فرکانس‌های صوتی',
        phenotypeEn: 'Enhanced dendritic length and long-term depression (LTD) in striatal medium spiny neurons.',
        phenotypeFa: 'افزایش طول دندریت‌ها و دقت زمانی بالا در پردازش سیگنال‌های گفتار.',
        previewColor: '#f87171',
        mutatedCodonIndex: 10,
        mutatedBase: 'A',
        expressionShift: 0.9,
      },
    ],
  },
  {
    id: 'apoe-memory',
    geneSymbol: 'APOE',
    fullNameEn: 'Apolipoprotein E Astrocyte Lipid & Synaptic Transporter',
    fullNameFa: 'آپولیپوپروتئین E (APOE — بازسازی غشای سیناپس‌ها و حافظه)',
    chromosome: '19',
    cytogeneticBand: '19q13.32',
    arm: 'q',
    normPos: 0.72,
    category: 'brain-cognition',
    traitTitleEn: 'Synaptic Cholesterol Delivery, Memory Maintenance & Neuroprotection',
    traitTitleFa: 'حفظ سلامت سیناپس‌های مغز، حافظه و طول عمر عصبی',
    mechanismEn:
      'Located on gene-dense Chromosome 19q13.32, APOE transports phospholipids and cholesterol from astrocytes to neurons for myelin and dendritic spine repair.',
    mechanismFa:
      'واقع بر کروموزوم ۱۹ (باند 19q13.32)، پروتئین APOE وظیفه انتقال کلسترول و فسفولیپیدها از آستروسیت‌ها به نورون‌ها برای ترمیم غلاف میلین و سیناپس‌های حافظه را بر عهده دارد.',
    inheritanceEn: 'Codominant Tri-Allelic System (ε2, ε3, ε4)',
    inheritanceFa: 'سیستم سه آللی هم‌بارز (ε2، ε3، ε4)',
    referenceSequence: 'ATGAAGGTTCTGTGGGCTGCGTTGCTGGTCACATTCCTGGCAGGATGCCAGG',
    alleles: [
      {
        id: 'apoe-e2',
        genotype: 'ε2 / ε3 (Cys112 / Cys158)',
        labelEn: 'APOE ε2/ε3 — Neuroprotective High Clearance',
        labelFa: 'آلل ε2/ε3 — محافظت عصبی بالا و پاکسازی سریع پپتیدهای آمیلوئید',
        phenotypeEn: 'Enhanced astrocyte lipid efflux and rapid synaptic debris clearance.',
        phenotypeFa: 'انتقال کارآمد لیپیدها و حفاظت بلندمدت از شبکه سیناپسی قشر مغز.',
        previewColor: '#34d399',
        mutatedCodonIndex: 6,
        mutatedBase: 'T',
        expressionShift: 0.85,
      },
      {
        id: 'apoe-e3',
        genotype: 'ε3 / ε3 (Cys112 / Arg158 — Global Reference)',
        labelEn: 'APOE ε3/ε3 — Standard Baseline Neuro-Metabolism (~78% Pop.)',
        labelFa: 'آلل مرجع ε3/ε3 — متابولیسم عصبی استاندارد (حدود ۷۸٪ جمعیت)',
        phenotypeEn: 'Balanced phospholipid transport and blood-brain barrier integrity.',
        phenotypeFa: 'عملکرد متعادل سد خونی-مغزی و ترمیم طبیعی غشای نورون‌ها.',
        previewColor: '#38bdf8',
        mutatedCodonIndex: 6,
        mutatedBase: 'C',
        expressionShift: 0.25,
      },
    ],
  },
  {
    id: 'per2-sleep',
    geneSymbol: 'PER2 / CLOCK',
    fullNameEn: 'Period Circadian Regulator 2 (2q37.3)',
    fullNameFa: 'ژن تنظیم‌کننده ریتم شبانه‌روزی و کرونوتایپ خواب (PER2)',
    chromosome: '2',
    cytogeneticBand: '2q37.3',
    arm: 'q',
    normPos: 0.91,
    category: 'sleep-circadian',
    traitTitleEn: 'Sleep Chronotype (Morning Lark vs. Night Owl) & Melatonin Timing',
    traitTitleFa: 'الگوی خواب شبانه‌روزی (سحرخیز در برابر شب‌زنده‌دار) و ترشح ملاتونین',
    mechanismEn:
      'Located at the q-telomere of Chromosome 2 (2q37.3), PER2 forms a negative transcriptional feedback loop with CLOCK (Chr 4) and BMAL1 in the suprachiasmatic nucleus (SCN), setting the intrinsic ~24.2-hour period of human sleep-wake and EEG delta/theta oscillation cycles.',
    mechanismFa:
      'واقع در انتهای بازوی بلند کروموزوم ۲ (باند 2q37.3)، ژن PER2 در هسته سوپراکیاسماتیک هیپوتالاموس حلقه بازخورد ساعت بیولوژیک ۲۴ ساعته بدن و زمان شروع امواج دلتا و تتای خواب (EEG) را تنظیم می‌کند.',
    inheritanceEn: 'Autosomal Circadian Phase Feedback Loop',
    inheritanceFa: 'حلقه بازخورد رونویسی شبانه‌روزی اتوزومال',
    referenceSequence: 'ATGAATGGATACGCGGAFPTTCCAGCTGAGCGACCTGCTGGCCAGCATGCTG',
    alleles: [
      {
        id: 'per2-lark',
        genotype: 'Advanced Phase Variant',
        labelEn: 'Early Chronotype ("Morning Lark" — Fast PER2 Phosphorylation)',
        labelFa: 'کرونوتایپ سحرخیز — چرخه سریع‌تر فسفوریلاسیون PER2',
        phenotypeEn: 'Earlier evening melatonin onset and peak morning cognitive alertness.',
        phenotypeFa: 'ترشح زودتر ملاتونین در شب و اوج هوشیاری شناختی در ساعات اولیه صبح.',
        previewColor: '#facc15',
        mutatedCodonIndex: 7,
        mutatedBase: 'G',
        expressionShift: 0.6,
      },
      {
        id: 'per2-owl',
        genotype: 'Delayed Phase Variant',
        labelEn: 'Late Chronotype ("Night Owl" — Extended Circadian Period)',
        labelFa: 'کرونوتایپ شب‌زنده‌دار — دوره نوسان شبانه‌روزی طولانی‌تر',
        phenotypeEn: 'Delayed suprachiasmatic phase peak; high late-evening focus.',
        phenotypeFa: 'تأخیر در فاز ساعت بیولوژیک و تمرکز بالا در ساعات پایانی شب.',
        previewColor: '#818cf8',
        mutatedCodonIndex: 7,
        mutatedBase: 'A',
        expressionShift: -0.4,
      },
    ],
  },
  {
    id: 'actn3-hbb-blood',
    geneSymbol: 'ACTN3 & HBB',
    fullNameEn: 'Alpha-Actinin-3 Fast-Twitch Muscle (11q13.2) & Beta-Globin (11p15.4)',
    fullNameFa: 'ژن عضلات سرعتی (ACTN3) و هموگلوبین خون (HBB) روی کروموزوم ۱۱',
    chromosome: '11',
    cytogeneticBand: '11q13.2',
    arm: 'q',
    normPos: 0.62,
    category: 'metabolism-blood',
    traitTitleEn: 'Explosive Sprint vs. Endurance Muscle Fiber & Oxygen Transport',
    traitTitleFa: 'تارهای عضلانی سرعتی در برابر استقامتی و انتقال اکسیژن خون',
    mechanismEn:
      'Chromosome 11 houses both HBB (11p15.4 — oxygen-carrying beta-globin subunit of hemoglobin) and ACTN3 (11q13.2 — Z-disc structural protein anchored exclusively in fast-twitch Type IIx glycolytic muscle fibers). The R577X polymorphism switches muscle metabolism between explosive sprint power (RR) and aerobic endurance efficiency (XX).',
    mechanismFa:
      'کروموزوم ۱۱ میزبان دو ژن حیاتی فیزیولوژیک است: ژن HBB در بازوی کوتاه (زیرواحد بتای هموگلوبین برای اکسیژن‌رسانی) و ژن ACTN3 در بازوی بلند (پروتئین ساختاری تارهای عضلانی تند-انقباض که مرز بین توان سرعتی/انفجاری و توان استقامتی/هوازی را تعیین می‌کند).',
    inheritanceEn: 'Codominant Structural Isoform (R577X)',
    inheritanceFa: 'ایزوفرم ساختاری هم‌بارز (پلی‌مورفیسم R577X)',
    referenceSequence: 'ATymGACCATCATGGACQAGCAGCTGCTGGCCATCCTGGGCGCCCTGCTCTT',
    alleles: [
      {
        id: 'actn3-rr',
        genotype: '577R / 577R (C/C)',
        labelEn: 'RR Genotype — Full Alpha-Actinin-3 (Power & Sprint Muscle)',
        labelFa: 'ژنوتایپ RR — حضور کامل اکتینین-۳ (توان انفجاری و سرعتی بالا)',
        phenotypeEn: 'High force generation and structural stiffness in Type II fast-twitch sarcomeres.',
        phenotypeFa: 'تولید نیروی انفجاری بالا در سارکومرهای عضلانی نوع II.',
        previewColor: '#ef4444',
        mutatedCodonIndex: 5,
        mutatedBase: 'C',
        expressionShift: 0.75,
      },
      {
        id: 'actn3-xx',
        genotype: '577X / 577X (T/T)',
        labelEn: 'XX Genotype — Oxidative Shift (High Aerobic Endurance)',
        labelFa: 'ژنوتایپ XX — تغییر متابولیسم به مسیر اکسیداتیو (استقامت هوازی بالا)',
        phenotypeEn: 'Alpha-actinin-2 compensation shifts muscle fibers toward mitochondrial oxidative efficiency.',
        phenotypeFa: 'جایگزینی اکتینین-۲ که بازده میتوکندریایی و استقامت هوازی عضلات را افزایش می‌دهد.',
        previewColor: '#06b6d4',
        mutatedCodonIndex: 5,
        mutatedBase: 'T',
        expressionShift: -0.35,
      },
    ],
  },
  {
    id: 'dyrk1a-trisomy21',
    geneSymbol: 'DYRK1A / RCAN1',
    fullNameEn: 'Down Syndrome Critical Region 21q22.13 Kinase & Calcineurin Regulator',
    fullNameFa: 'ناحیه بحرانی تریزومی ۲۱ (DYRK1A / RCAN1 در 21q22)',
    chromosome: '21',
    cytogeneticBand: '21q22.13',
    arm: 'q',
    normPos: 0.74,
    category: 'trisomy-sex',
    traitTitleEn: '47-Chromosome Trisomy 21 Gene Dosage (1.5× Overexpression)',
    traitTitleFa: 'اثر دوز ژنی ۱.۵ برابری در کاریوتایپ ۴۷ کروموزومی تریزومی ۲۱',
    mechanismEn:
      'When a 47-chromosome karyotype with three copies of Chromosome 21 (47,XX,+21 or 47,XY,+21) is present, genes inside the 21q22 Down Syndrome Critical Region (DYRK1A, RCAN1/DSCR1, SOD1, APP) are expressed at 1.5× normal diploid dosage, shifting neural progenitor cell cycle timing and NFAT signaling.',
    mechanismFa:
      'در کاریوتایپ ۴۷ کروموزومی تریزومی ۲۱ (47,XX,+21 یا 47,XY,+21)، حضور نسخه سوم کروموزوم ۲۱ باعث افزایش ۱.۵ برابری بیان ژن‌های ناحیه بحرانی 21q22 (مانند کیناز DYRK1A و تنظیم‌کننده کلسی‌نورین RCAN1) در دوران تکامل عصبی می‌شود.',
    inheritanceEn: 'Chromosomal Nondisjunction (47 Chromosomes: 3 copies of Chr 21)',
    inheritanceFa: 'عدم تفکیک کروموزومی در میوز (۴۷ کروموزوم: ۳ نسخه از کروموزوم ۲۱)',
    referenceSequence: 'ATGCHTTCAGyAGGAAGATCAfGGTTGGTCACCTGCTGAAGGCTAACCTTGG',
    alleles: [
      {
        id: 'chr21-diploid',
        genotype: '2n Disomic (2 Copies of Chr 21 — 46 Chromosomes)',
        labelEn: 'Standard 2 Copies (1.0× Baseline Dosage)',
        labelFa: 'حالت دیپلوئید طبیعی (۲ نسخه از کروموزوم ۲۱ — دوز ۱.۰ برابر)',
        phenotypeEn: 'Balanced DYRK1A kinase phosphorylation and NFATc transcription.',
        phenotypeFa: 'تعادل طبیعی فعالیت آنزیم DYRK1A و مسیر سیگنال‌دهی NFAT.',
        previewColor: '#10b981',
        mutatedCodonIndex: 4,
        mutatedBase: 'C',
        expressionShift: 0.0,
      },
      {
        id: 'chr21-trisomic',
        genotype: 'Trisomic +21 (3 Copies of Chr 21 — 47 Chromosomes)',
        labelEn: 'Trisomy 21 (1.5× Gene Dosage across 21q22)',
        labelFa: 'تریزومی ۲۱ (۳ نسخه از کروموزوم ۲۱ — دوز ژنی ۱.۵ برابر در ۴۷ کروموزوم)',
        phenotypeEn: '150% transcriptional output of DYRK1A, RCAN1, and SOD1.',
        phenotypeFa: 'افزایش ۱۵۰ درصدی رونویسی ژن‌های ناحیه 21q22.',
        previewColor: '#f59e0b',
        mutatedCodonIndex: 4,
        mutatedBase: 'G',
        expressionShift: 0.95,
      },
    ],
  },
  {
    id: 'sry-opn1lw-sex',
    geneSymbol: 'SRY (Chr Y) & OPN1LW (Chr X)',
    fullNameEn: 'Sex-Determining Region Y (Yp11.2) & X-Linked Cone Opsins (Xq28)',
    fullNameFa: 'ژن تعیین جنسیت SRY (کروموزوم Y) و دید رنگی OPN1LW (کروموزوم X)',
    chromosome: 'Y',
    cytogeneticBand: 'Yp11.2 / Xq28',
    arm: 'p',
    normPos: 0.18,
    category: 'trisomy-sex',
    traitTitleEn: 'Male/Female Sex Differentiation (XX vs. XY vs. 47,XXY) & Color Vision',
    traitTitleFa: 'تمایز جنسیت زن و مرد (XX و XY و 47,XXY) و دید رنگی شبکیه',
    mechanismEn:
      'On Chromosome Yp11.2, the SRY HMG-box transcription factor binds DNA and upregulates SOX9 to initiate male testis development in 46,XY and 47,XXY karyotypes. On Chromosome Xq28, tandem OPN1LW and OPN1MW genes encode Long-Wave (Red, 560 nm) and Medium-Wave (Green, 530 nm) retinal cone photopigments.',
    mechanismFa:
      'روی بازوی کوتاه کروموزوم Y (باند Yp11.2)، پروتئین SRY به DNA متصل شده و با فعال‌سازی SOX9 مسیر تمایز جنسیت مرد را در کاریوتایپ‌های 46,XY و 47,XXY آغاز می‌کند. همچنین روی بازوی بلند کروموزوم X (باند Xq28)، ژن‌های OPN1LW و OPN1MW مخروط‌های نوری قرمز (۵۶۰ نانومتر) و سبز (۵۳۰ نانومتر) چشم را کدگذاری می‌کنند.',
    inheritanceEn: 'Y-Linked Holandric (SRY) & X-Linked (OPN1LW/MW)',
    inheritanceFa: 'وابسته به کروموزوم جنسی Y (ژن SRY) و وابسته به X (دید رنگی)',
    referenceSequence: 'ATGCAATCATATGCTTCTGCTATGTTAAGCGTATTCAACAGCGATGATTACA',
    alleles: [
      {
        id: 'sex-xy-sry',
        genotype: 'SRY Positive (46,XY / 47,XXY / 47,XYY)',
        labelEn: 'SRY HMG-Box Active — Male Gonadal Pathway + SOX9 Activation',
        labelFa: 'حضور ژن فعال SRY — فعال‌سازی مسیر SOX9 و تمایز جنسیت مرد',
        phenotypeEn: ' bends DNA helix by ~70° to initiate Sertoli cell differentiation.',
        phenotypeFa: 'خم‌کردن مارپیچ DNA به زاویه ۷۰ درجه برای فعال‌سازی آبشار ژنی SOX9.',
        previewColor: '#06b6d4',
        mutatedCodonIndex: 3,
        mutatedBase: 'G',
        expressionShift: 0.85,
      },
      {
        id: 'sex-xx-female',
        genotype: '46,XX Biallelic X (No SRY)',
        labelEn: '46,XX Female Pathway — WNT4 / RSPO1 / FOXL2 Ovarian Cascade',
        labelFa: 'کاریوتایپ 46,XX زن — فعال‌سازی مسیر WNT4 / FOXL2 و دید رنگی دوآللی قوی',
        phenotypeEn: 'Full biallelic X-linked opsin protection and WNT4/FOXL2 expression.',
        phenotypeFa: 'حفاظت دوآللی کامل در برابر اختلال دید رنگ و بیان مسیر WNT4.',
        previewColor: '#f43f5e',
        mutatedCodonIndex: 3,
        mutatedBase: 'A',
        expressionShift: 0.5,
      },
    ],
  },
];

/**
 * Build the exact list of 46 or 47 individual 3D chromosome instances for the active karyotype
 */
export function buildKaryotypeChromosomes(mode: KaryotypeMode): KaryotypeInstance[] {
  const instances: KaryotypeInstance[] = [];
  let counter = 1;

  const autosomeIds: ChromosomeId[] = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
    '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22',
  ];

  const trisomyTarget: ChromosomeId | null =
    mode === '47,XY,+21' || mode === '47,XX,+21'
      ? '21'
      : mode === '47,XY,+18'
      ? '18'
      : mode === '47,XX,+13'
      ? '13'
      : null;

  for (const cid of autosomeIds) {
    const spec = CHROMOSOME_SPECS[cid];
    // Homologous Maternal & Paternal pair
    instances.push({
      instanceIndex: counter++,
      chromId: cid,
      copyNumber: 1,
      isSexChromosome: false,
      isTrisomicExtra: false,
      label: `${cid}a`,
      spec,
    });
    instances.push({
      instanceIndex: counter++,
      chromId: cid,
      copyNumber: 2,
      isSexChromosome: false,
      isTrisomicExtra: false,
      label: `${cid}b`,
      spec,
    });

    // If this autosome has a 3rd trisomic copy (making 47 chromosomes total!)
    if (trisomyTarget === cid) {
      instances.push({
        instanceIndex: counter++,
        chromId: cid,
        copyNumber: 3,
        isSexChromosome: false,
        isTrisomicExtra: true,
        label: `${cid}c (+${cid} #47)`,
        spec,
      });
    }
  }

  // Sex chromosomes (bringing total to 46 for euploid or 47 for trisomies / XXY / XYY)
  const sexList: { cid: ChromosomeId; copy: 1 | 2 | 3; extra: boolean; suffix: string }[] =
    mode === '46,XX' || mode === '47,XX,+21' || mode === '47,XX,+13'
      ? [
          { cid: 'X', copy: 1, extra: false, suffix: 'X₁' },
          { cid: 'X', copy: 2, extra: false, suffix: 'X₂' },
        ]
      : mode === '46,XY' || mode === '47,XY,+21' || mode === '47,XY,+18'
      ? [
          { cid: 'X', copy: 1, extra: false, suffix: 'X' },
          { cid: 'Y', copy: 1, extra: false, suffix: 'Y' },
        ]
      : mode === '47,XXY'
      ? [
          { cid: 'X', copy: 1, extra: false, suffix: 'X₁' },
          { cid: 'X', copy: 2, extra: true, suffix: 'X₂ (#47)' },
          { cid: 'Y', copy: 1, extra: false, suffix: 'Y' },
        ]
      : [
          { cid: 'X', copy: 1, extra: false, suffix: 'X' },
          { cid: 'Y', copy: 1, extra: false, suffix: 'Y₁' },
          { cid: 'Y', copy: 2, extra: true, suffix: 'Y₂ (#47)' },
        ];

  for (const s of sexList) {
    instances.push({
      instanceIndex: counter++,
      chromId: s.cid,
      copyNumber: s.copy,
      isSexChromosome: true,
      isTrisomicExtra: s.extra,
      label: s.suffix,
      spec: CHROMOSOME_SPECS[s.cid],
    });
  }

  return instances;
}

/**
 * Clean DNA nucleotide sequence to pure A, T, C, G and apply selected allele variant
 */
export function buildCleanGeneSequence(locus: GeneLocus, allele: AlleleVariant): string {
  const bases: ('A' | 'T' | 'C' | 'G')[] = ['A', 'T', 'C', 'G'];
  const raw = locus.referenceSequence.toUpperCase();
  const chars: ('A' | 'T' | 'C' | 'G')[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === 'A' || ch === 'T' || ch === 'C' || ch === 'G') {
      chars.push(ch);
    } else {
      chars.push(bases[i % 4]);
    }
  }
  const mutIdx = Math.max(0, Math.min(chars.length - 1, allele.mutatedCodonIndex * 3 + 1));
  chars[mutIdx] = allele.mutatedBase;
  return chars.join('');
}

/**
 * Genomic Signal Processing (GSP):
 * Converts a DNA sequence into:
 * 1) Purine (+1: A,G) / Pyrimidine (-1: C,T) time/position series
 * 2) EIIP (Electron-Ion Interaction Potential) numerical signal
 * 3) Spectral Power Density across normalized frequencies [0 .. 0.5 cycles/bp],
 *    highlighting the universal protein-coding 3-base codon periodicity peak at f = 1/3 (0.333).
 */
export function analyzeGenomicSignal(sequence: string, expressionShift = 0): {
  positions: number[];
  purinePyrimidine: number[];
  eiipSignal: number[];
  freqAxis: number[];
  spectralPower: number[];
  gcContentPct: number;
  codonPeakRatio: number;
} {
  const N = Math.max(12, sequence.length);
  const positions: number[] = [];
  const purinePyrimidine: number[] = [];
  const eiipSignal: number[] = [];

  const EIIP_MAP: Record<string, number> = {
    A: 0.126,
    G: 0.0806,
    C: 0.134,
    T: 0.1335,
  };

  let gcCount = 0;
  for (let n = 0; n < N; n++) {
    const base = sequence[n] || 'A';
    if (base === 'G' || base === 'C') gcCount++;
    positions.push(n + 1);
    const pp = base === 'A' || base === 'G' ? 1 : -1;
    // Modulate subtle codon triplet harmonic structure so coding exons show realistic f=1/3 resonance
    const codonMod = 0.45 * (1 + 0.35 * expressionShift) * Math.cos((2 * Math.PI * n) / 3);
    purinePyrimidine.push(pp + codonMod);
    eiipSignal.push((EIIP_MAP[base] ?? 0.12) + 0.025 * Math.cos((2 * Math.PI * n) / 3));
  }

  // Compute DFT Periodogram across 64 normalized frequency points [0.01 .. 0.50 cycles/bp]
  const numFreqs = 64;
  const freqAxis: number[] = [];
  const spectralPower: number[] = [];

  const meanEiip = eiipSignal.reduce((a, b) => a + b, 0) / N;
  let maxPower = 1e-6;
  let powerSum = 0;
  let codonBandPower = 0;

  for (let k = 0; k < numFreqs; k++) {
    const f = 0.01 + (k / (numFreqs - 1)) * 0.49;
    freqAxis.push(Number(f.toFixed(3)));
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const x = eiipSignal[n] - meanEiip;
      const angle = 2 * Math.PI * f * n;
      re += x * Math.cos(angle);
      im -= x * Math.sin(angle);
    }
    const p = (re * re + im * im) / N;
    spectralPower.push(p);
    if (p > maxPower) maxPower = p;
    powerSum += p;
    if (Math.abs(f - 0.333) < 0.025 && p > codonBandPower) {
      codonBandPower = p;
    }
  }

  const normPower = spectralPower.map((p) => Number((p / maxPower).toFixed(4)));
  const avgPower = powerSum / numFreqs;

  return {
    positions,
    purinePyrimidine,
    eiipSignal,
    freqAxis,
    spectralPower: normPower,
    gcContentPct: Number(((gcCount / N) * 100).toFixed(1)),
    codonPeakRatio: Number((codonBandPower / Math.max(1e-6, avgPower)).toFixed(2)),
  };
}

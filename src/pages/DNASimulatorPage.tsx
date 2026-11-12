import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  Dna,
  Eye,
  HeartPulse,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Hand,
  Sparkles,
  Sun,
  UserCheck,
  Volume2,
} from 'lucide-react';
import { InteractivePlot } from '../components/InteractivePlot';
import { MathFormula } from '../components/MathBlock';
import {
  AlleleVariant,
  analyzeGenomicSignal,
  buildCleanGeneSequence,
  buildKaryotypeChromosomes,
  CHROMOSOME_SPECS,
  ChromosomeId,
  GENE_LOCI,
  GeneLocus,
  KARYOTYPE_PRESETS,
  KaryotypeInstance,
  KaryotypeMode,
  TraitCategory,
} from '../simulations/dna';
import { useLab } from '../store/LabContext';
import {
  createDNAScene,
  DNA_BASE_PALETTE,
  type DNA3DViewMode,
  type DNACameraPreset,
  type DNAFinishMode,
  type DNASceneController,
} from '../components/three-d/dnaScene';

const TRAIT_CATEGORIES: {
  id: TraitCategory;
  labelEn: string;
  labelFa: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'all', labelEn: 'All Loci', labelFa: 'همه ژن‌ها', icon: Dna },
  { id: 'eye-color', labelEn: 'Eye Color', labelFa: 'رنگ چشم', icon: Eye },
  { id: 'depression-mood', labelEn: 'Depression & Mood', labelFa: 'افسردگی و خلق‌وخو', icon: Brain },
  { id: 'skin-hair', labelEn: 'Skin & Hair Color', labelFa: 'رنگ پوست و مو', icon: Sun },
  { id: 'brain-cognition', labelEn: 'Memory & Brain', labelFa: 'حافظه و شناخت', icon: Sparkles },
  { id: 'speech-sensory', labelEn: 'Speech & Hearing', labelFa: 'گفتار و شنوایی', icon: Volume2 },
  { id: 'sleep-circadian', labelEn: 'Sleep & Circadian', labelFa: 'خواب و ساعت بدن', icon: Activity },
  { id: 'metabolism-blood', labelEn: 'Muscle & Blood', labelFa: 'عضلات و گروه خونی', icon: HeartPulse },
  { id: 'trisomy-sex', labelEn: '47-Chr & Sex (XX/XY)', labelFa: '۴۷ کروموزوم و جنسیت', icon: UserCheck },
];

/** Quantitative Human Genome Numeric Facts (Bilingual EN / FA) */
const HUMAN_GENOME_NUMERIC_FACTS: {
  stat: string;
  unitEn: string;
  unitFa: string;
  titleEn: string;
  titleFa: string;
  detailEn: string;
  detailFa: string;
  accent: string;
}[] = [
  {
    stat: '99.9%',
    unitEn: 'Identical Across All Humans',
    unitFa: 'تشابه ژنتیکی تمام انسان‌ها',
    titleEn: 'Human Unity & 98.8% Primate Homology',
    titleFa: 'وحدت ژنتیکی انسان و ۹۸.۸٪ همولوژی',
    detailEn:
      'Every human shares 99.9% identical DNA sequence (~98.8% shared with chimpanzees); just 0.1% (~3 million SNPs) creates all unique human traits.',
    detailFa:
      '۹۹.۹٪ توالی DNA در تمام انسان‌های جهان کاملاً یکسان است (و ~۹۸.۸٪ با شامپانزه اشتراک دارد)؛ تنها ۰.۱٪ (~۳ میلیون SNP) تفاوت‌های ظاهری را می‌سازد.',
    accent: '#38bdf8',
  },
  {
    stat: '98.5%',
    unitEn: 'Non-Coding Regulatory DNA',
    unitFa: 'DNA تنظیمی غیرکدکننده',
    titleEn: 'Only ~1.5% Codes for Proteins',
    titleFa: 'تنها ~۱.۵٪ کدکننده مستقیم پروتئین',
    detailEn:
      'Only ~1.5% of the human genome consists of protein-coding exons; the remaining 98.5% orchestrates enhancers, promoters, splicing, and 3D chromatin folding.',
    detailFa:
      'تنها حدود ۱.۵٪ ژنوم انسان مستقیماً پروتئین تولید می‌کند (اگزون‌ها) و ۹۸.۵٪ بقیه وظیفه حیاتی تنظیم بیان ژن، افزاینده‌ها و تاخوردگی کروماتین را بر عهده دارد.',
    accent: '#65a30d',
  },
  {
    stat: '3.2 Gb',
    unitEn: 'Haploid · 6.4 Billion bp Diploid',
    unitFa: 'هاپلوئید · ۶.۴ میلیارد جفت‌باز دیپلوئید',
    titleEn: 'Total Nucleotide Base-Pair Capacity',
    titleFa: 'ظرفیت کل جفت‌بازهای نوکلئوتیدی',
    detailEn:
      'A single human cell nucleus stores 6.4 billion base pairs across 46 chromosomes (~1.5 Gigabytes of pure quaternary A/T/C/G digital code).',
    detailFa:
      'هسته هر سلول سوماتیک انسان حاوی ۶.۴ میلیارد جفت‌باز در ۴۶ کروموزوم است که معادل ~۱.۵ گیگابایت کد دیجیتال چهارحرفی (A, T, C, G) است.',
    accent: '#f59e0b',
  },
  {
    stat: '2.0 m',
    unitEn: 'DNA Packed in a 6 µm Nucleus',
    unitFa: 'طول DNA در هسته ۶ میکرومتری',
    titleEn: '10,000× Chromatin Compaction Ratio',
    titleFa: 'نسبت فشرده‌سازی ۱۰٬۰۰۰ برابری کروماتین',
    detailEn:
      'Uncoiled DNA from one cell stretches ~2 meters. Across ~37 trillion cells in your body, total DNA spans ~74 billion km (~500× Earth–Sun distance).',
    detailFa:
      'اگر DNA یک سلول باز شود ۲ متر طول دارد! مجموع DNA در ~۳۷ تریلیون سلول بدن انسان به ~۷۴ میلیارد کیلومتر (۵۰۰ برابر فاصله زمین تا خورشید) می‌رسد.',
    accent: '#ec4899',
  },
  {
    stat: '20,500',
    unitEn: 'Protein-Coding Human Genes',
    unitFa: 'ژن کدکننده پروتئین در انسان',
    titleEn: 'Distributed Across 24 Chromosome Types',
    titleFa: 'توزیع‌شده در ۲۴ نوع کروموزوم انسانی',
    detailEn:
      'Chr 1 is the largest (248.9 Mb, 2,058 genes) while Chr 21 (46.7 Mb, 234 genes) and Chr Y (57.2 Mb, 72 genes) are the smallest.',
    detailFa:
      'کروموزوم ۱ بزرگ‌ترین (۲۴۸.۹ مگاباز و ۲۰۵۸ ژن) و کروموزوم ۲۱ (۲۳۴ ژن) و کروموزوم Y (۷۲ ژن) کوچک‌ترین کروموزوم‌های انسانی هستند.',
    accent: '#10b981',
  },
  {
    stat: '10.5 bp',
    unitEn: '3.4 nm Pitch · 2.0 nm Diameter',
    unitFa: 'گام ۳.۴ نانومتر · قطر ۲.۰ نانومتر',
    titleEn: 'B-DNA Double Helix Geometry',
    titleFa: 'هندسه دقیق مارپیچ دوگانه B-DNA',
    detailEn:
      'Right-handed B-DNA rotates 34.3° per base pair (0.34 nm rise/bp), forming a 22 Å wide Major Groove and a 12 Å narrow Minor Groove.',
    detailFa:
      'مارپیچ راست‌گرد B-DNA به ازای هر جفت‌باز ۳۴.۳ درجه می‌چرخد (فاصله ۰.۳۴ نانومتر) و شیار بزرگ (۲۲ آنگستروم) و شیار کوچک (۱۲ آنگستروم) را می‌سازد.',
    accent: '#a855f7',
  },
];

const BASE_COLORS: Record<string, string> = DNA_BASE_PALETTE;

const BASE_NAMES: Record<'A' | 'T' | 'G' | 'C', { en: string; fa: string; kindEn: string; kindFa: string }> = {
  A: { en: 'Adenine', fa: 'آدنین', kindEn: 'purine', kindFa: 'پورین' },
  T: { en: 'Thymine', fa: 'تیمین', kindEn: 'pyrimidine', kindFa: 'پیریمیدین' },
  G: { en: 'Guanine', fa: 'گوانین', kindEn: 'purine', kindFa: 'پورین' },
  C: { en: 'Cytosine', fa: 'سیتوزین', kindEn: 'pyrimidine', kindFa: 'پیریمیدین' },
};

const COMPLEMENT_BASE: Record<string, 'A' | 'T' | 'C' | 'G'> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/**
 * Babylon.js viewport host: owns the engine lifecycle (see components/three-d/dnaScene.ts),
 * pauses rendering while off-screen / tab hidden, and gates touch controls on phones.
 */
const BabylonDNA3DViewport: React.FC<{
  karyotypeInstances: KaryotypeInstance[];
  selectedChromId: ChromosomeId;
  activeLocus: GeneLocus;
  activeSequence: string;
  mutatedBpIndex: number;
  viewMode3D: DNA3DViewMode;
  cameraPreset: DNACameraPreset;
  finishMode: DNAFinishMode;
  autoRotateHelix: boolean;
  darkMode: boolean;
  coarsePointer: boolean;
  interactive: boolean;
  ariaLabel: string;
  onSelectChromosome: (chromId: ChromosomeId) => void;
}> = ({
  karyotypeInstances,
  selectedChromId,
  activeLocus,
  activeSequence,
  mutatedBpIndex,
  viewMode3D,
  cameraPreset,
  finishMode,
  autoRotateHelix,
  darkMode,
  coarsePointer,
  interactive,
  ariaLabel,
  onSelectChromosome,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<DNASceneController | null>(null);
  const selectRef = useRef(onSelectChromosome);
  selectRef.current = onSelectChromosome;

  const sceneState = {
    karyotypeInstances,
    selectedChromId,
    activeLocus,
    activeSequence,
    mutatedBpIndex,
    viewMode3D,
    cameraPreset,
    finishMode,
    autoRotate: autoRotateHelix,
    dark: darkMode,
  };
  const latestState = useRef(sceneState);
  latestState.current = sceneState;

  // Create / dispose engine + scene once per mount
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowEnd = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    let ctrl: DNASceneController;
    try {
      ctrl = createDNAScene(canvas, latestState.current, {
        coarsePointer,
        lowEnd,
        onSelectChromosome: (id) => selectRef.current(id),
      });
    } catch (err) {
      console.error('DNA 3D viewport failed to initialise', err);
      return;
    }
    ctrlRef.current = ctrl;

    let onScreen = true;
    const sync = () => ctrl.setRunning(onScreen && document.visibilityState !== 'hidden');
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.01 }
    );
    io.observe(container);
    document.addEventListener('visibilitychange', sync);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      ctrl.dispose();
      ctrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coarsePointer]);

  // Push React state into the scene (the controller diff-checks what changed)
  useEffect(() => {
    ctrlRef.current?.update(latestState.current);
  }, [
    karyotypeInstances,
    selectedChromId,
    activeLocus,
    activeSequence,
    mutatedBpIndex,
    viewMode3D,
    cameraPreset,
    finishMode,
    autoRotateHelix,
    darkMode,
  ]);

  useEffect(() => {
    if (coarsePointer) ctrlRef.current?.setInteractive(interactive);
  }, [coarsePointer, interactive]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className={`w-full h-full block outline-none ${
          coarsePointer && !interactive ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
      />
    </div>
  );
};

export const DNASimulatorPage: React.FC = () => {
  const { lang, darkMode } = useLab();

  // Karyotype State (46,XX Female, 46,XY Male, and 47-Chromosome Trisomies)
  const [karyotypeMode, setKaryotypeMode] = useState<KaryotypeMode>('47,XY,+21');
  const [traitFilter, setTraitFilter] = useState<TraitCategory>('all');
  const [selectedChromId, setSelectedChromId] = useState<ChromosomeId>('15');
  const [selectedLocusId, setSelectedLocusId] = useState<string>('herc2-oca2-eye');
  const [selectedAlleleIdx, setSelectedAlleleIdx] = useState<number>(0);
  const [viewMode3D, setViewMode3D] = useState<DNA3DViewMode>('dual-3d');
  const [cameraPreset, setCameraPreset] = useState<DNACameraPreset>('overview');
  const [finishMode, setFinishMode] = useState<DNAFinishMode>('cryo-studio');
  // Auto-rotation is off by default for people who ask the OS for reduced motion
  const [autoRotateHelix, setAutoRotateHelix] = useState<boolean>(() => !prefersReducedMotion());
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const [touchInteractive, setTouchInteractive] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() => {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showPresetDetails, setShowPresetDetails] = useState<boolean>(false);
  const [showNumericFacts, setShowNumericFacts] = useState<boolean>(true);
  const [showGspDrawer, setShowGspDrawer] = useState<boolean>(true);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const activePreset = useMemo(
    () => KARYOTYPE_PRESETS.find((k) => k.id === karyotypeMode) || KARYOTYPE_PRESETS[0],
    [karyotypeMode]
  );

  const karyotypeInstances = useMemo(
    () => buildKaryotypeChromosomes(karyotypeMode),
    [karyotypeMode]
  );

  const filteredLoci = useMemo(() => {
    if (traitFilter === 'all') return GENE_LOCI;
    return GENE_LOCI.filter((l) => l.category === traitFilter);
  }, [traitFilter]);

  const activeLocus: GeneLocus = useMemo(() => {
    return GENE_LOCI.find((l) => l.id === selectedLocusId) || GENE_LOCI[0];
  }, [selectedLocusId]);

  const activeAllele: AlleleVariant = useMemo(() => {
    return (
      activeLocus.alleles[Math.min(selectedAlleleIdx, activeLocus.alleles.length - 1)] ||
      activeLocus.alleles[0]
    );
  }, [activeLocus, selectedAlleleIdx]);

  const activeChromSpec = useMemo(
    () => CHROMOSOME_SPECS[selectedChromId] || CHROMOSOME_SPECS['15'],
    [selectedChromId]
  );

  const activeSequence = useMemo(
    () => buildCleanGeneSequence(activeLocus, activeAllele),
    [activeLocus, activeAllele]
  );

  const gspAnalysis = useMemo(
    () => analyzeGenomicSignal(activeSequence, activeAllele.expressionShift),
    [activeSequence, activeAllele.expressionShift]
  );

  // Sonify the active DNA base-pair sequence using pentatonic biophysical frequencies
  const playDNASequenceAudio = useCallback(() => {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const baseFreqMap: Record<string, number> = {
      A: 440.0, // A4
      T: 523.25, // C5
      C: 587.33, // D5
      G: 659.25, // E5
    };

    const notes = activeSequence.slice(0, 18).split('');
    const stepSec = 0.11;
    notes.forEach((base, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 3 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreqMap[base] || 440, ctx.currentTime + i * stepSec);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * stepSec);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * stepSec + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (i + 0.9) * stepSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * stepSec);
      osc.stop(ctx.currentTime + (i + 1) * stepSec);
    });
  }, [activeSequence]);

  const selectedChromInstances = useMemo(
    () => karyotypeInstances.filter((inst) => inst.chromId === selectedChromId),
    [karyotypeInstances, selectedChromId]
  );

  const mutatedBpIndex = Math.max(
    0,
    Math.min(27, activeAllele.mutatedCodonIndex * 3 + 1)
  );

  const isFa = lang === 'fa';
  const viewModeName: Record<DNA3DViewMode, { en: string; fa: string }> = {
    'dual-3d': { en: 'karyotype and DNA double helix side by side', fa: 'کاریوتایپ و مارپیچ دوگانه DNA در کنار هم' },
    'chrom-closeup': { en: `close-up of chromosome ${selectedChromId} with the DNA double helix`, fa: `نمای نزدیک کروموزوم ${selectedChromId} همراه با مارپیچ دوگانه DNA` },
    'karyotype-3d': { en: `all ${karyotypeInstances.length} chromosomes arranged as a karyogram`, fa: `همه ${karyotypeInstances.length} کروموزوم به صورت کاریوگرام` },
    'helix-3d': { en: 'B-DNA double helix', fa: 'مارپیچ دوگانه B-DNA' },
  };
  const mutBase = (activeSequence[mutatedBpIndex] || 'A').toUpperCase();
  const mutComp = COMPLEMENT_BASE[mutBase] || 'T';
  const canvasAriaLabel = isFa
    ? `صحنه سه‌بعدی: ${viewModeName[viewMode3D].fa}؛ کاریوتایپ ${karyotypeMode} با ${karyotypeInstances.length} کروموزوم؛ کروموزوم ${selectedChromId} انتخاب شده؛ ژن ${activeLocus.geneSymbol} در ${activeLocus.cytogeneticBand}؛ جهش SNP در جفت‌باز ${mutatedBpIndex + 1} (${mutBase}-${mutComp}).`
    : `3D scene: ${viewModeName[viewMode3D].en}; karyotype ${karyotypeMode} with ${karyotypeInstances.length} chromosomes; chromosome ${selectedChromId} selected; gene ${activeLocus.geneSymbol} at ${activeLocus.cytogeneticBand}; SNP at base pair ${mutatedBpIndex + 1} (${mutBase}-${mutComp}).`;

  const stageBackground = darkMode
    ? 'radial-gradient(120% 90% at 50% 30%, #17223b 0%, #0b1221 55%, #060a14 100%)'
    : 'radial-gradient(120% 90% at 50% 30%, #ffffff 0%, #eef2f8 55%, #dbe3ee 100%)';
  const hudSurface =
    'bg-white/85 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-700/70 backdrop-blur-md shadow-sm';

  return (
    <div className="flex flex-col gap-5">
      {/* Compact Unified Top Toolbar: Karyotype Switcher, Trait Filter & Audio Sonification */}
      <div className="neu-card p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-sky-600 dark:text-sky-400">
              <span>
                {lang === 'fa'
                  ? 'آزمایشگاه ژنومیک و کاریوتایپ سه‌بعدی انسان'
                  : '3D Human Karyotype & Genomic Signal Processing Lab'}
              </span>
              <span>·</span>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 font-bold tabular-nums">
                {activePreset.totalChromosomes} {lang === 'fa' ? 'کروموزوم' : 'Chromosomes'}
              </span>
              <span>·</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                {lang === 'fa' ? '۹۹.۹٪ تشابه DNA انسان‌ها' : '99.9% Shared Human DNA'}
              </span>
            </div>
            <h1 className="text-xl font-bold">
              {lang === 'fa' ? activePreset.titleFa : activePreset.titleEn}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNumericFacts((v) => !v)}
              aria-pressed={showNumericFacts}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                showNumericFacts ? 'btn-tool-pill' : 'neu-btn'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>
                {lang === 'fa' ? 'حقایق عددی DNA انسان (۹۹.۹٪)' : 'DNA Numeric Facts (99.9%)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowPresetDetails((v) => !v)}
              aria-expanded={showPresetDetails}
              className="neu-btn px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {showPresetDetails ? (
                <ChevronUp className="w-3.5 h-3.5 text-sky-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-sky-500" />
              )}
              <span>
                {lang === 'fa' ? 'توضیحات کاریوتایپ' : 'Karyotype Notes'}
              </span>
            </button>

            <button
              type="button"
              onClick={playDNASequenceAudio}
              className="btn-primary-pill px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'شنیدن ملودی کدون DNA' : 'Sonify DNA Codons'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Karyotype Clinical Overview Drawer */}
        {showPresetDetails && (
          <div className="neu-inset p-3.5 rounded-xl text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {lang === 'fa' ? activePreset.descriptionFa : activePreset.descriptionEn}
          </div>
        )}

        {/* Quantitative Human Genome Numeric Facts Grid (99.9% Identity, 98.5% Non-Coding, 3.2B bp, 2.0m Length) */}
        {showNumericFacts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-300/30 dark:border-slate-800/60">
            {HUMAN_GENOME_NUMERIC_FACTS.map((fact, idx) => (
              <div
                key={idx}
                className="neu-inset p-3.5 rounded-xl flex flex-col justify-between gap-1.5 border border-slate-300/40 dark:border-slate-800/80"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight tabular-nums"
                    style={{ color: fact.accent }}
                  >
                    {fact.stat}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 text-end">
                    {lang === 'fa' ? fact.unitFa : fact.unitEn}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {lang === 'fa' ? fact.titleFa : fact.titleEn}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'fa' ? fact.detailFa : fact.detailEn}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Karyotype Mode Switcher — Clean Rectangular Tiles with Full Labels */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-300/30 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500">
            <span>
              {lang === 'fa'
                ? 'کاریوتایپ انسان (زن ۴۶، مرد ۴۶، یا تریزومی‌های ۴۷ کروموزومی):'
                : 'Human Karyotype Preset (Female 46,XX · Male 46,XY · 47-Chromosome Trisomies):'}
            </span>
            <span className="font-bold text-sky-500 tabular-nums">
              {lang === 'fa'
                ? `صحنه سه‌بعدی: ${karyotypeInstances.length} کروموزوم`
                : `Active 3D Stage: ${karyotypeInstances.length} Chromosomes`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {KARYOTYPE_PRESETS.map((preset) => {
              const isActive = karyotypeMode === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setKaryotypeMode(preset.id);
                    if (preset.trisomyChromosome) {
                      setSelectedChromId(preset.trisomyChromosome);
                      if (preset.trisomyChromosome === '21') {
                        setSelectedLocusId('dyrk1a-trisomy21');
                        setSelectedAlleleIdx(1);
                      }
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-mono text-start transition-all cursor-pointer flex flex-col justify-between gap-0.5 ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm border border-sky-400'
                      : 'neu-tile text-slate-700 dark:text-slate-200 hover:border-sky-400/50'
                  }`}
                >
                  <div className="font-bold whitespace-nowrap">{preset.id}</div>
                  <div
                    className={`text-[10px] leading-tight ${
                      isActive ? 'text-slate-900 font-semibold' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {lang === 'fa' ? preset.sexLabelFa : preset.sexLabelEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Trait / Phenotype Category Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {TRAIT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = traitFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setTraitFilter(cat.id);
                  if (cat.id !== 'all') {
                    const firstMatch = GENE_LOCI.find((l) => l.category === cat.id);
                    if (firstMatch) {
                      setSelectedLocusId(firstMatch.id);
                      setSelectedChromId(firstMatch.chromosome);
                      setSelectedAlleleIdx(0);
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'fa' ? cat.labelFa : cat.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Viewport Stage (Unobstructed Center + Top Camera Bar + Collapsible Bottom Dock) */}
      <div
        className={`relative rounded-2xl overflow-hidden border border-slate-300/60 dark:border-slate-800/80 ${
          isFullscreen
            ? 'fixed inset-3 z-50 h-auto'
            : coarsePointer
            ? 'h-[60vh] max-h-[440px] min-h-[320px]'
            : 'h-[540px] sm:h-[620px]'
        }`}
        style={{ background: stageBackground }}
      >
        {/* Unified Non-Overlapping Top HUD Bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 ${hudSurface}`}>
            <span className="text-sky-700 dark:text-sky-400 font-bold">{karyotypeMode}</span>
            <span>·</span>
            <span>
              {karyotypeInstances.length} {lang === 'fa' ? 'کروموزوم سه‌بعدی' : '3D Chromosomes'}
            </span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              Chr {activeLocus.cytogeneticBand} ({activeLocus.geneSymbol})
            </span>
            <span className="hidden md:inline text-slate-500 dark:text-slate-300">
              — {lang === 'fa' ? activeLocus.traitTitleFa : activeLocus.traitTitleEn}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Interactive 3D Camera Preset Switcher */}
            <div
              role="group"
              aria-label={isFa ? 'زاویه دوربین' : 'Camera preset'}
              className={`hidden sm:flex items-center gap-1 rounded-xl p-1 font-mono text-[11px] ${hudSurface}`}
            >
              {(
                [
                  { id: 'overview', en: 'Overview', fa: 'نمای کلی' },
                  { id: 'karyotype', en: 'Karyotype', fa: 'کاریوتایپ' },
                  { id: 'helix-macro', en: 'Helix Macro', fa: 'نمای نزدیک DNA' },
                  { id: 'groove-top', en: 'Groove Top', fa: 'از بالا' },
                ] as { id: DNACameraPreset; en: string; fa: string }[]
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setCameraPreset(cam.id)}
                  aria-pressed={cameraPreset === cam.id}
                  className={`min-h-6 px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
                    cameraPreset === cam.id
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {lang === 'fa' ? cam.fa : cam.en}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              aria-pressed={isFullscreen}
              className={`min-h-6 px-2.5 py-1.5 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 hover:border-sky-400 flex items-center gap-1 cursor-pointer ${hudSurface}`}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>
                {isFullscreen
                  ? lang === 'fa'
                    ? 'خروج'
                    : 'Exit'
                  : lang === 'fa'
                  ? 'تمام‌صفحه'
                  : 'Fullscreen'}
              </span>
            </button>
          </div>
        </div>

        {/* Babylon.js Confocal Fluorescence 3D Karyotype & B-DNA Molecular Stage */}
        <BabylonDNA3DViewport
          karyotypeInstances={karyotypeInstances}
          selectedChromId={selectedChromId}
          activeLocus={activeLocus}
          activeSequence={activeSequence}
          mutatedBpIndex={mutatedBpIndex}
          viewMode3D={viewMode3D}
          cameraPreset={cameraPreset}
          finishMode={finishMode}
          autoRotateHelix={autoRotateHelix}
          darkMode={darkMode}
          coarsePointer={coarsePointer}
          interactive={!coarsePointer || touchInteractive}
          ariaLabel={canvasAriaLabel}
          onSelectChromosome={(cid) => {
            setSelectedChromId(cid);
            const loci = GENE_LOCI.filter((l) => l.chromosome === cid);
            if (loci.length > 0) {
              setSelectedLocusId(loci[0].id);
              setSelectedAlleleIdx(0);
            }
          }}
        />

        {/* Phones: page scroll stays free until the user explicitly taps into the 3D view */}
        {coarsePointer && !touchInteractive && (
          <button
            type="button"
            onClick={() => setTouchInteractive(true)}
            className="absolute inset-0 z-[5] flex items-center justify-center bg-transparent cursor-pointer"
            aria-label={isFa ? 'برای تعامل با صحنه سه‌بعدی ضربه بزنید' : 'Tap to interact with the 3D scene'}
          >
            <span className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-slate-800 dark:text-slate-100 ${hudSurface}`}>
              <Hand className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              {isFa ? 'برای تعامل ضربه بزنید' : 'Tap to interact'}
            </span>
          </button>
        )}
        {coarsePointer && touchInteractive && (
          <button
            type="button"
            onClick={() => setTouchInteractive(false)}
            className={`absolute top-14 end-3 z-10 min-h-8 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer ${hudSurface}`}
          >
            {isFa ? 'پایان تعامل' : 'Done'}
          </button>
        )}

        {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(1020px,96vw)] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            aria-expanded={!dockCollapsed}
            className="min-h-6 px-3 py-1 rounded-t-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-b-0 border-slate-200/90 dark:border-slate-700/70 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {dockCollapsed
                ? lang === 'fa'
                  ? 'نمایش پنل کنترل سه‌بعدی'
                  : 'Show 3D Controls'
                : lang === 'fa'
                ? 'پنهان‌کردن پنل کنترل'
                : 'Hide Controls'}
            </span>
          </button>

          {!dockCollapsed && (
            <div className={`w-full px-3.5 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono text-slate-700 dark:text-slate-200 ${hudSurface}`}>
              {/* 3D View Mode Switcher */}
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    {
                      id: 'dual-3d',
                      en: '46/47 Karyotype + Helix',
                      fa: 'کاریوتایپ + مارپیچ DNA',
                    },
                    {
                      id: 'chrom-closeup',
                      en: `Chr ${selectedChromId} Close-Up + DNA`,
                      fa: `نمای نزدیک کروموزوم ${selectedChromId}`,
                    },
                    {
                      id: 'karyotype-3d',
                      en: `All ${karyotypeInstances.length} Chromosomes`,
                      fa: `همه ${karyotypeInstances.length} کروموزوم`,
                    },
                    {
                      id: 'helix-3d',
                      en: '3D Atomic B-DNA Helix',
                      fa: 'مارپیچ اتمی B-DNA',
                    },
                  ] as { id: DNA3DViewMode; en: string; fa: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode3D(m.id)}
                    aria-pressed={viewMode3D === m.id}
                    className={`min-h-6 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer whitespace-nowrap ${
                      viewMode3D === m.id
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {lang === 'fa' ? m.fa : m.en}
                  </button>
                ))}
              </div>

              {/* Base Pair Legend — letter + colour + name (never colour alone) */}
              <ul
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
                aria-label={isFa ? 'راهنمای رنگ بازها' : 'Base colour legend'}
              >
                {(['A', 'T', 'G', 'C'] as const).map((b) => (
                  <li key={b} className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: BASE_COLORS[b] }}
                      aria-hidden="true"
                    >
                      {b}
                    </span>
                    <span>
                      {isFa ? BASE_NAMES[b].fa : BASE_NAMES[b].en}
                      <span className="hidden lg:inline text-slate-500 dark:text-slate-400">
                        {' '}({isFa ? BASE_NAMES[b].kindFa : BASE_NAMES[b].kindEn})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {/* Molecular Finish Switcher + Helix Spin Toggle */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div
                  role="group"
                  aria-label={isFa ? 'جنس مواد' : 'Material finish'}
                  className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5"
                >
                  {(
                    [
                      { id: 'cryo-studio', en: 'Cryo-EM', fa: 'کرایو-EM' },
                      { id: 'cpk-metallic', en: 'CPK Gloss', fa: 'براق اتمی' },
                      { id: 'bioluminescent', en: 'Bio-Glow', fa: 'بیولومینسانس' },
                    ] as { id: DNAFinishMode; en: string; fa: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFinishMode(f.id)}
                      aria-pressed={finishMode === f.id}
                      className={`min-h-6 px-2 py-0.5 rounded-md text-[11px] cursor-pointer transition-colors ${
                        finishMode === f.id
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {lang === 'fa' ? f.fa : f.en}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAutoRotateHelix((r) => !r)}
                  aria-pressed={autoRotateHelix}
                  aria-label={
                    autoRotateHelix
                      ? isFa
                        ? 'توقف چرخش خودکار مارپیچ'
                        : 'Pause helix auto-rotation'
                      : isFa
                      ? 'پخش چرخش خودکار مارپیچ'
                      : 'Play helix auto-rotation'
                  }
                  className="min-h-6 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] hover:border-sky-400 flex items-center gap-1.5 cursor-pointer"
                >
                  {autoRotateHelix ? (
                    <Pause className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  )}
                  <span aria-hidden="true">{isFa ? 'چرخش' : 'Spin'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Chromosome Selector (1–22, X, Y) & Clean Rectangular Gene / Allele Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 5 Cols: Chromosome Explorer (All 24 Types + Active Chromosome Details + Trait Loci) */}
        <div className="lg:col-span-5 neu-card p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {lang === 'fa'
                  ? '۱. انتخاب کروموزوم انسانی (۱ تا ۲۲، X و Y)'
                  : '1. Select Human Chromosome (Chr 1–22, X, Y)'}
              </h2>
              <span className="text-xs font-mono text-sky-500 font-semibold tabular-nums">
                {activeChromSpec.sizeMb} Mb · {activeChromSpec.geneCount} Genes
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {(Object.keys(CHROMOSOME_SPECS) as ChromosomeId[]).map((cid) => {
                const isSelected = selectedChromId === cid;
                const isTrisomic = activePreset.trisomyChromosome === cid;
                const hasMappedLocus = GENE_LOCI.some((l) => l.chromosome === cid);
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      setSelectedChromId(cid);
                      const locusOnCid = GENE_LOCI.find((l) => l.chromosome === cid);
                      if (locusOnCid) {
                        setSelectedLocusId(locusOnCid.id);
                        setSelectedAlleleIdx(0);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono transition-all cursor-pointer flex flex-col items-center ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 font-bold shadow-sm border border-sky-400'
                        : isTrisomic
                        ? 'bg-amber-500/20 border border-amber-500 text-amber-500 font-bold'
                        : 'neu-tile text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{cid}</span>
                    <span className="text-[10px] opacity-80">
                      {isTrisomic ? '3× (#47)' : hasMappedLocus ? '★' : '2n'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Chromosome Biophysical Card */}
            <div className="neu-inset p-4 rounded-xl flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-bold text-sky-600 dark:text-sky-400">
                  {lang === 'fa' ? activeChromSpec.faLabel : activeChromSpec.label} (
                  {activeChromSpec.morphology})
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  p/q: {(activeChromSpec.centromereRatio * 100).toFixed(0)}% /{' '}
                  {((1 - activeChromSpec.centromereRatio) * 100).toFixed(0)}%
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'fa' ? activeChromSpec.summaryFa : activeChromSpec.summaryEn}
              </p>

              <div className="pt-2 border-t border-slate-300/30 dark:border-slate-800/60 flex flex-col gap-1.5">
                <span className="text-[11px] font-mono text-slate-500">
                  {lang === 'fa'
                    ? 'ویژگی‌ها و صفات مرتبط با این کروموزوم:'
                    : 'Key Traits & Functions on this Chromosome:'}
                </span>
                <div className="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                  {(lang === 'fa' ? activeChromSpec.keyTraitsFa : activeChromSpec.keyTraitsEn).map(
                    (tr, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-sky-500 font-mono shrink-0">0{i + 1}.</span>
                        <span className="leading-snug">{tr}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* List of Mapped Gene Loci — Clean Rectangular Cards with Full Labels */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-slate-500">
              {lang === 'fa'
                ? 'جایگاه‌های ژنی (Loci) و صفات فنوتیپی:'
                : 'Mapped Trait Loci (Click to Inspect in 3D):'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {filteredLoci.map((locus) => {
                const active = locus.id === activeLocus.id;
                return (
                  <button
                    key={locus.id}
                    type="button"
                    onClick={() => {
                      setSelectedLocusId(locus.id);
                      setSelectedChromId(locus.chromosome);
                      setSelectedAlleleIdx(0);
                    }}
                    className={`p-3 rounded-xl text-start transition-all cursor-pointer flex flex-col gap-1 ${
                      active
                        ? 'bg-sky-500/15 border border-sky-500 text-slate-900 dark:text-white shadow-xs'
                        : 'neu-tile text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs font-mono">
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {locus.geneSymbol}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                        Chr {locus.cytogeneticBand}
                      </span>
                    </div>
                    <div className="text-xs font-medium leading-snug">
                      {lang === 'fa' ? locus.traitTitleFa : locus.traitTitleEn}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Redesigned Clean Rectangular Gene & Allele Inspector */}
        <div className="lg:col-span-7 neu-card p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-4">
            {/* Top Locus Header + Full Untruncated Active Phenotype Banner */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/25 text-xs font-mono text-sky-600 dark:text-sky-400">
                  <span>{lang === 'fa' ? 'جایگاه سیتوژنتیک:' : 'Cytogenetic Locus:'}</span>
                  <strong>Chr {activeLocus.cytogeneticBand}</strong>
                  <span>·</span>
                  <span className="font-bold">{activeLocus.geneSymbol}</span>
                </div>

                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {lang === 'fa' ? 'الگوی وراثت:' : 'Inheritance:'}{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'fa' ? activeLocus.inheritanceFa : activeLocus.inheritanceEn}
                  </span>
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                {lang === 'fa' ? activeLocus.traitTitleFa : activeLocus.traitTitleEn}
              </h2>

              {/* Full-Width Rectangular Active Phenotype & Genotype Readout Bar (Zero Truncation) */}
              <div className="neu-inset p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 border border-sky-500/25">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-8 h-8 rounded-lg border border-white/40 shadow-xs shrink-0"
                    style={{ backgroundColor: activeAllele.previewColor }}
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-sky-500 font-semibold">
                        {lang === 'fa' ? 'فنوتیپ و آلل فعال' : 'Active Phenotype & Genotype'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300 text-xs font-mono font-bold">
                        {activeAllele.genotype}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                      {lang === 'fa' ? activeAllele.labelFa : activeAllele.labelEn}
                    </div>
                  </div>
                </div>
              </div>

              {/* Molecular & Physiological Mechanism Box */}
              <div className="p-3.5 rounded-xl bg-slate-500/5 dark:bg-slate-900/45 border border-slate-300/40 dark:border-slate-800/70">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'fa' ? activeLocus.mechanismFa : activeLocus.mechanismEn}
                </p>
              </div>
            </div>

            {/* Step 2: Clean Rectangular Allele / Genotype Switcher Cards (Full Untruncated Text) */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-300/30 dark:border-slate-800/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {lang === 'fa'
                    ? '۲. انتخاب واریانت آلل / ژنوتایپ (مشاهده اثر مستقیم روی فنوتیپ و توالی DNA)'
                    : '2. Switch Allele Variant (Simulate Phenotype & Base-Pair Mutation)'}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {activeLocus.alleles.length}{' '}
                  {lang === 'fa' ? 'واریانت' : 'Variants'}
                </span>
              </div>

              <div
                className={`grid grid-cols-1 ${
                  activeLocus.alleles.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
                } gap-3`}
              >
                {activeLocus.alleles.map((al, idx) => {
                  const isSel = idx === selectedAlleleIdx;
                  return (
                    <button
                      key={al.id}
                      type="button"
                      onClick={() => setSelectedAlleleIdx(idx)}
                      className={`p-3.5 rounded-xl text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSel
                          ? 'bg-sky-500/15 border-2 border-sky-500 shadow-sm'
                          : 'neu-tile opacity-90 hover:opacity-100'
                      }`}
                    >
                      <div className="flex flex-col gap-1.5">
                        {/* Top Status & Full Genotype Name */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-4 h-4 rounded-md shrink-0 border border-white/40"
                              style={{ backgroundColor: al.previewColor }}
                            />
                            <span className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400 leading-snug break-words">
                              {al.genotype}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                              isSel
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {isSel
                              ? lang === 'fa'
                                ? 'فعال'
                                : 'ACTIVE'
                              : lang === 'fa'
                              ? 'انتخاب'
                              : 'SELECT'}
                          </span>
                        </div>

                        {/* Full Phenotype Label */}
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {lang === 'fa' ? al.labelFa : al.labelEn}
                        </div>
                      </div>

                      {/* Detailed Phenotype Mechanism */}
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1.5 border-t border-slate-300/25 dark:border-slate-800/60">
                        {lang === 'fa' ? al.phenotypeFa : al.phenotypeEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Nucleotide Base-Pair Ladder (5' -> 3' Sense & 3' -> 5' Complement) */}
          <div className="neu-inset p-4 rounded-xl flex flex-col gap-2.5" dir="ltr">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                  5&apos;→3&apos; Coding Exon Motif
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/50 text-emerald-700 dark:text-emerald-400 font-bold">
                  SNP at bp #{mutatedBpIndex + 1}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-500 font-bold tabular-nums">
                  GC Content: {gspAnalysis.gcContentPct}%
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-bold tabular-nums">
                  Codon Peak SNR: {gspAnalysis.codonPeakRatio}×
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5">
              {activeSequence
                .slice(0, 28)
                .split('')
                .map((b, i) => {
                  const comp = COMPLEMENT_BASE[b] || 'T';
                  const isMut = i === mutatedBpIndex;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center min-w-[32px] px-2 py-1.5 rounded-lg font-mono text-xs shrink-0 transition-transform ${
                        isMut
                          ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-sm'
                          : 'bg-slate-900/75 border border-slate-800'
                      }`}
                    >
                      <span
                        className={`text-[10px] tabular-nums ${
                          isMut ? 'text-emerald-400 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="font-bold text-xs mt-0.5" style={{ color: BASE_COLORS[b] }}>
                        {b}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-none my-0.5">
                        {b === 'G' || b === 'C' ? '║' : '│'}
                      </span>
                      <span className="font-bold text-xs" style={{ color: BASE_COLORS[comp] }}>
                        {comp}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Detail Drawer: 2D Genomic Signal Processing (GSP) & Spectral Periodicity */}
      <div className="neu-card p-4 sm:p-5 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setShowGspDrawer((v) => !v)}
          className="w-full flex flex-wrap items-center justify-between gap-2 text-start cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-sky-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {lang === 'fa'
                  ? `تحلیل دوبعدی پردازش سیگنال ژنومیک (GSP) و طیف کدون — ${activeLocus.geneSymbol}`
                  : `2D Genomic Signal Processing (GSP) & Codon Spectral Analysis — ${activeLocus.geneSymbol}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'fa'
                  ? 'نگاشت عددی پورین/پیریمیدین، طیف توان DFT در فرکانس f = 1/3 و فرمولاسیون ریاضی'
                  : 'Purine/Pyrimidine numerical series, DFT codon resonance (f = 1/3 cycles/bp), and mathematical formulation'}
              </p>
            </div>
          </div>

          <span className="neu-btn px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5">
            {showGspDrawer ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-sky-500" />
                <span>{lang === 'fa' ? 'بستن نمودارهای دوبعدی' : 'Hide 2D Charts'}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-sky-500" />
                <span>{lang === 'fa' ? 'نمایش نمودارهای دوبعدی و فرمول' : 'Show 2D Charts & Math'}</span>
              </>
            )}
          </span>
        </button>

        {showGspDrawer && (
          <div className="flex flex-col gap-5 pt-3 border-t border-slate-300/30 dark:border-slate-800/60">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <InteractivePlot
                title={
                  lang === 'fa'
                    ? `سیگنال عددی ژنومیک (Purine/Pyrimidine & EIIP) — ${activeLocus.geneSymbol}`
                    : `Genomic Numerical Indicator Signal — ${activeLocus.geneSymbol}`
                }
                subtitle={
                  lang === 'fa'
                    ? 'نگاشت بازهای پورین (A,G = +1) و پیریمیدین (C,T = -1) روی محور موقعیت نوکلئوتید'
                    : 'Purine (+1: A,G) vs. Pyrimidine (-1: C,T) indicator series across nucleotide base-pair index n'
                }
                xData={gspAnalysis.positions}
                xLabel={lang === 'fa' ? 'موقعیت باز نوکلئوتیدی (bp)' : 'Base-Pair Index (n)'}
                yLabel="u[n]"
                series={[
                  {
                    id: 'purine-pyrimidine',
                    label: lang === 'fa' ? 'سیگنال پورین/پیریمیدین' : 'Purine-Pyrimidine u[n]',
                    data: gspAnalysis.purinePyrimidine,
                    color: '#38bdf8',
                  },
                ]}
                height={240}
              />

              <InteractivePlot
                title={
                  lang === 'fa'
                    ? 'طیف توان ژنومیک (DFT) و پیک تناوب ۳ تایی کدون (f = 1/3)'
                    : 'Genomic Power Spectrum (DFT) & 3-Base Codon Periodicity (f = 0.333)'
                }
                subtitle={
                  lang === 'fa'
                    ? 'اگزون‌های کدکننده پروتئین در فرکانس f = 1/3 cycles/bp دارای رزونانس طیفی هستند'
                    : 'Protein-coding exons exhibit a prominent spectral resonance at normalized frequency f = 1/3 cycles/bp'
                }
                xData={gspAnalysis.freqAxis}
                xLabel={
                  lang === 'fa'
                    ? 'فرکانس نرمال‌شده (cycles/bp)'
                    : 'Normalized Frequency (cycles/bp)'
                }
                yLabel="|X(f)|²"
                series={[
                  {
                    id: 'eiip-power',
                    label: lang === 'fa' ? 'چگالی طیف توان EIIP' : 'EIIP Spectral Power',
                    data: gspAnalysis.spectralPower,
                    color: '#10b981',
                  },
                ]}
                height={240}
              />
            </div>

            <div className="neu-inset p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'fa'
                  ? 'در پردازش سیگنال ژنومیک (GSP)، رشته‌های نوکلئوتیدی چهارحرفی S[n] ∈ {A, T, C, G} از طریق پتانسیل برهم‌کنش الکترون-یون (EIIP) یا شاخص‌های باینری ووس به سیگنال‌های گسسته تبدیل می‌شوند. تبدیل فوریه گسسته (DFT) این سیگنال در نواحی اگزون کدکننده پروتئین به دلیل ساختار کدون‌های ۳ نوکلئوتیدی، یک پیک مشخص در فرکانس f = 1/3 ایجاد می‌کند.'
                  : 'In Genomic Signal Processing (GSP), symbolic nucleotide sequences S[n] ∈ {A, T, C, G} are mapped into numerical sequences x[n] using Electron-Ion Interaction Potentials (EIIP) or Voss indicator vectors. Evaluating the Discrete Fourier Transform (DFT) reveals the universal period-3 peak at k = N/3 (f = 0.333 cycles/bp) characteristic of protein-coding exons.'}
              </p>
              <div
                dir="ltr"
                className="py-3 px-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 overflow-x-auto"
              >
                <MathFormula
                  tex="P_{\text{GSP}}(k) = \left| \sum_{n=0}^{N-1} x_{\text{EIIP}}[n] \, e^{-j \frac{2\pi k n}{N}} \right|^2, \quad f_{\text{codon}} = \frac{1}{3}\,\text{bp}^{-1}"
                  block={true}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  FresnelParameters,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  PointLight,
  PointerEventTypes,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
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
  RotateCcw,
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
  ChromosomeSpec,
  GENE_LOCI,
  GeneLocus,
  KARYOTYPE_PRESETS,
  KaryotypeInstance,
  KaryotypeMode,
  TraitCategory,
} from '../simulations/dna';
import { useLab } from '../store/LabContext';

type DNA3DViewMode = 'dual-3d' | 'chrom-closeup' | 'karyotype-3d' | 'helix-3d';
type DNACameraPreset = 'overview' | 'karyotype' | 'helix-macro' | 'groove-top';
type DNAFinishMode = 'cryo-studio' | 'cpk-metallic' | 'bioluminescent';

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
    accent: '#7FD141',
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

const BASE_COLORS: Record<string, string> = {
  A: '#38bdf8', // Adenine (Purine) - Sky Blue
  T: '#f59e0b', // Thymine (Pyrimidine) - Amber Gold
  G: '#10b981', // Guanine (Purine) - Emerald Green
  C: '#f43f5e', // Cytosine (Pyrimidine) - Rose Crimson
};

const COMPLEMENT_BASE: Record<string, 'A' | 'T' | 'C' | 'G'> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
};

const BASE_COLOR3: Record<string, Color3> = {
  A: new Color3(0.22, 0.74, 0.97), // Adenine (Purine) - Sky Blue
  T: new Color3(0.96, 0.62, 0.04), // Thymine (Pyrimidine) - Amber Gold
  G: new Color3(0.06, 0.73, 0.51), // Guanine (Purine) - Emerald Green
  C: new Color3(0.96, 0.25, 0.37), // Cytosine (Pyrimidine) - Rose Crimson
};

/**
 * Helper to draw a high-contrast Confocal Giemsa G-Band DynamicTexture in Babylon.js
 */
function createChromatinGBandDynamicTexture(
  name: string,
  spec: ChromosomeSpec,
  isSelected: boolean,
  isTrisomic: boolean,
  isSexChrom: boolean,
  scene: Scene
): DynamicTexture {
  const dt = new DynamicTexture(name, { width: 128, height: 512 }, scene, true);
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;

  const baseBg = isTrisomic
    ? '#fbbf24'
    : isSexChrom
    ? '#f472b6'
    : isSelected
    ? '#38bdf8'
    : '#60a5fa';
  ctx.fillStyle = baseBg;
  ctx.fillRect(0, 0, 128, 512);

  spec.bands.forEach((b) => {
    const yCenter = b.pos * 512;
    const bandHeight = 30;
    const grad = ctx.createLinearGradient(0, yCenter - bandHeight, 0, yCenter + bandHeight);
    let darkCol = '#0f172a';
    if (isTrisomic) {
      darkCol = b.stain === 'gpos100' ? '#451a03' : b.stain === 'gpos75' ? '#78350f' : '#92400e';
    } else if (isSexChrom) {
      darkCol = b.stain === 'gpos100' ? '#500724' : b.stain === 'gpos75' ? '#831843' : '#9d174d';
    } else {
      if (b.stain === 'gpos100') darkCol = '#051024';
      else if (b.stain === 'gpos75') darkCol = '#0a1f42';
      else if (b.stain === 'gpos50') darkCol = '#143366';
      else if (b.stain === 'gpos25') darkCol = '#1d478a';
      else darkCol = baseBg;
    }

    grad.addColorStop(0, baseBg);
    grad.addColorStop(0.28, darkCol);
    grad.addColorStop(0.72, darkCol);
    grad.addColorStop(1, baseBg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, yCenter - bandHeight, 128, bandHeight * 2);
  });

  // Helical chromatin micro-striations
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.25)';
  ctx.lineWidth = 1.5;
  for (let y = 4; y < 512; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(42, y - 2.5, 86, y + 2.5, 128, y);
    ctx.stroke();
  }

  dt.update();
  return dt;
}

/**
 * Helper to create a crisp 3D Billboard Badge in Babylon.js
 */
function createDNABillboardBadge(
  name: string,
  text: string,
  borderColorHex: string,
  bgColorCss: string,
  textColorHex: string,
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  width = 0.92,
  height = 0.21
): { mesh: Mesh; dt: DynamicTexture } {
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene);
  plane.parent = parent;
  plane.position.copyFrom(position);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const dt = new DynamicTexture(`${name}_dt`, { width: 340, height: 72 }, scene, false);
  dt.hasAlpha = true;
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 340, 72);
  ctx.fillStyle = bgColorCss;
  ctx.strokeStyle = borderColorHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(6, 8, 328, 56, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColorHex;
  ctx.font = 'bold 23px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 170, 37);
  dt.update();

  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseTexture = dt;
  mat.emissiveTexture = dt;
  mat.opacityTexture = dt;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  plane.material = mat;

  return { mesh: plane, dt };
}

function updateDNABillboardBadgeText(
  dt: DynamicTexture,
  text: string,
  borderColorHex: string,
  bgColorCss = 'rgba(6, 11, 24, 0.94)',
  textColorHex = '#7FD141'
) {
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 340, 72);
  ctx.fillStyle = bgColorCss;
  ctx.strokeStyle = borderColorHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(6, 8, 328, 56, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColorHex;
  ctx.font = 'bold 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 170, 37);
  dt.update();
}

/**
 * Babylon.js 3D Karyotype & B-DNA Confocal Fluorescence Viewport
 * Uses Native GlowLayer, Fresnel Rim-Lighting Shaders, Smooth Sister Chromatid Capsules,
 * and Continuous CreateTube B-DNA Helical Ribbons.
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
  onSelectChromosome: (chromId: ChromosomeId) => void;
  onSelectLocus: (locus: GeneLocus) => void;
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
  onSelectChromosome,
  onSelectLocus,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    karyotypeInstances,
    selectedChromId,
    activeLocus,
    activeSequence,
    mutatedBpIndex,
    viewMode3D,
    cameraPreset,
    finishMode,
    autoRotateHelix,
    onSelectChromosome,
    onSelectLocus,
  });

  useEffect(() => {
    stateRef.current = {
      karyotypeInstances,
      selectedChromId,
      activeLocus,
      activeSequence,
      mutatedBpIndex,
      viewMode3D,
      cameraPreset,
      finishMode,
      autoRotateHelix,
      onSelectChromosome,
      onSelectLocus,
    };
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
    onSelectChromosome,
    onSelectLocus,
  ]);

  const camAnimRef = useRef({
    active: false,
    alpha: -Math.PI / 2,
    beta: Math.PI / 2.08,
    radius: 12.2,
    target: new Vector3(0, 0.1, 0),
  });

  useEffect(() => {
    const anim = camAnimRef.current;
    anim.active = true;
    if (cameraPreset === 'karyotype') {
      const tx = viewMode3D === 'dual-3d' ? -2.4 : 0;
      anim.alpha = -Math.PI / 2;
      anim.beta = Math.PI / 2.06;
      anim.radius = 10.6;
      anim.target.set(tx, 0.1, 0);
    } else if (cameraPreset === 'helix-macro') {
      const hx =
        viewMode3D === 'dual-3d' ? 5.25 : viewMode3D === 'chrom-closeup' ? 3.1 : 0;
      anim.alpha = -Math.PI / 2.15;
      anim.beta = Math.PI / 2.1;
      anim.radius = 5.6;
      anim.target.set(hx, 0.15, 0.2);
    } else if (cameraPreset === 'groove-top') {
      const hx =
        viewMode3D === 'dual-3d' ? 5.25 : viewMode3D === 'chrom-closeup' ? 3.1 : 0;
      anim.alpha = -Math.PI / 2;
      anim.beta = 0.22;
      anim.radius = 8.4;
      anim.target.set(hx, 0, 0.2);
    } else {
      anim.alpha = -Math.PI / 2;
      anim.beta = Math.PI / 2.08;
      anim.radius = 12.2;
      anim.target.set(0, 0.1, 0);
    }
  }, [cameraPreset, viewMode3D]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
        powerPreference: 'high-performance',
      },
      true
    );

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.015, 0.03, 0.068, 1.0);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.015, 0.03, 0.068);
    scene.fogDensity = 0.014;

    // ACES Filmic Tone Mapping
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.08;
    scene.imageProcessingConfiguration.contrast = 1.22;

    // Native Babylon.js Multi-Pass GlowLayer (Confocal Fluorescence & Bioluminescent Halo)
    const glowLayer = new GlowLayer('dnaGlowLayer', scene, {
      mainTextureSamples: 4,
      blurKernelSize: 48,
    });
    glowLayer.intensity = 0.68;

    const camera = new ArcRotateCamera(
      'dnaCam',
      -Math.PI / 2,
      Math.PI / 2.08,
      12.2,
      new Vector3(0, 0.1, 0),
      scene
    );
    camera.attachControl(canvas, true);
    camera.inertia = 0.86;
    camera.wheelPrecision = 24;
    camera.lowerRadiusLimit = 3.2;
    camera.upperRadiusLimit = 24;
    camera.upperBetaLimit = Math.PI * 0.86;

    // Studio Lighting
    const hemi = new HemisphericLight('dnaHemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.78;
    hemi.diffuse = new Color3(0.88, 0.96, 1.0);
    hemi.groundColor = new Color3(0.05, 0.1, 0.22);

    const keyLight = new PointLight('dnaKey', new Vector3(8, 12, -10), scene);
    keyLight.intensity = 1.3;
    keyLight.diffuse = new Color3(0.22, 0.74, 0.97);

    const helixLight = new PointLight('dnaHelixLight', new Vector3(5.5, 3, -5), scene);
    helixLight.intensity = 1.15;
    helixLight.diffuse = new Color3(0.5, 0.82, 0.25);

    // =========================================================================
    // 0. DARK-FIELD CONFOCAL STAGE FLOOR DISC
    // =========================================================================
    const floorDisc = MeshBuilder.CreateDisc(
      'dnaFloorDisc',
      { radius: 15.0, tessellation: 96 },
      scene
    );
    floorDisc.rotation.x = Math.PI / 2;
    floorDisc.position.y = -4.35;
    floorDisc.isPickable = false;

    const floorDT = new DynamicTexture('dnaFloorDT', { width: 1024, height: 1024 }, scene, true);
    const fCtx = floorDT.getContext() as unknown as CanvasRenderingContext2D;
    fCtx.fillStyle = '#040812';
    fCtx.fillRect(0, 0, 1024, 1024);
    fCtx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    fCtx.lineWidth = 1.5;
    for (let i = 0; i <= 1024; i += 64) {
      fCtx.beginPath();
      fCtx.moveTo(i, 0);
      fCtx.lineTo(i, 1024);
      fCtx.stroke();
      fCtx.beginPath();
      fCtx.moveTo(0, i);
      fCtx.lineTo(1024, i);
      fCtx.stroke();
    }
    [180, 340, 490].forEach((r, idx) => {
      fCtx.beginPath();
      fCtx.arc(512, 512, r, 0, Math.PI * 2);
      fCtx.strokeStyle =
        idx % 2 === 0 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(127, 209, 65, 0.22)';
      fCtx.lineWidth = 2;
      fCtx.stroke();
    });
    floorDT.update();

    const floorMat = new StandardMaterial('dnaFloorMat', scene);
    floorMat.diffuseTexture = floorDT;
    floorMat.emissiveTexture = floorDT;
    floorMat.emissiveColor = new Color3(0.28, 0.32, 0.38);
    floorMat.specularColor = new Color3(0.05, 0.08, 0.14);
    floorMat.backFaceCulling = false;
    floorDisc.material = floorMat;

    // =========================================================================
    // 1. BUILD ALL 46 OR 47 CONFOCAL FLUORESCENCE CHROMOSOME NODES
    // =========================================================================
    const karyotypeRoot = new TransformNode('karyotypeRoot', scene);
    const groupOrder: ChromosomeId[] = [
      '1', '2', '3', '4', '5', '6', '7', '8',
      '9', '10', '11', '12', '13', '14', '15', '16',
      '17', '18', '19', '20', '21', '22', 'X', 'Y',
    ];

    interface ChromNodeEntry {
      inst: KaryotypeInstance;
      root: TransformNode;
      armMat: StandardMaterial;
      fresnel: FresnelParameters;
      haloDisc: Mesh;
      locusCollar: Mesh;
      locusBadge: Mesh;
      locusBadgeDT: DynamicTexture;
      totalH: number;
      gridCol: number;
      gridRow: number;
    }

    const chromEntries: ChromNodeEntry[] = [];

    stateRef.current.karyotypeInstances.forEach((inst) => {
      const { spec, isTrisomicExtra, isSexChromosome } = inst;
      const grpIdx = groupOrder.indexOf(inst.chromId);
      const col = grpIdx % 8;
      const row = Math.floor(grpIdx / 8);

      const cRoot = new TransformNode(`chrom_${inst.instanceIndex}`, scene);
      cRoot.parent = karyotypeRoot;

      const totalH = 0.72 + spec.lengthNorm * 1.9;
      const cenRatio = spec.centromereRatio;
      const pArmLen = Math.max(0.16, totalH * cenRatio - 0.04);
      const qArmLen = Math.max(0.24, totalH * (1 - cenRatio) - 0.04);
      const cenY = totalH / 2 - totalH * cenRatio;
      const armRadius = 0.082;
      const xSpread = 0.098;

      const gBandDT = createChromatinGBandDynamicTexture(
        `gBand_${inst.instanceIndex}`,
        spec,
        inst.chromId === stateRef.current.selectedChromId,
        isTrisomicExtra,
        isSexChromosome,
        scene
      );

      // Confocal Fluorescence Rim-Lit Chromatid Material
      const armMat = new StandardMaterial(`chromMat_${inst.instanceIndex}`, scene);
      armMat.diffuseTexture = gBandDT;
      armMat.emissiveTexture = gBandDT;
      armMat.specularColor = new Color3(0.6, 0.8, 1.0);
      armMat.specularPower = 48;

      const fresnel = new FresnelParameters();
      fresnel.bias = 0.14;
      fresnel.power = 2.0;
      fresnel.leftColor = isTrisomicExtra
        ? new Color3(1.0, 0.78, 0.18)
        : isSexChromosome
        ? new Color3(0.96, 0.38, 0.72)
        : new Color3(0.22, 0.78, 0.98);
      fresnel.rightColor = new Color3(0.04, 0.1, 0.22);
      armMat.emissiveFresnelParameters = fresnel;

      // Left & Right Sister Chromatids (Smooth p-arm and q-arm capsules meeting in an organic X-shape)
      [-1, 1].forEach((side) => {
        const pArm = MeshBuilder.CreateCapsule(
          `pArm_${inst.instanceIndex}_${side}`,
          {
            radius: armRadius,
            height: Math.max(armRadius * 2.1, pArmLen + armRadius * 0.6),
            tessellation: 22,
            subdivisions: 4,
            capSubdivisions: 8,
          },
          scene
        );
        pArm.parent = cRoot;
        pArm.position.set(side * xSpread, cenY + pArmLen * 0.5 + 0.02, 0);
        pArm.rotation.z = -side * 0.085;
        pArm.material = armMat;
        pArm.metadata = { chromId: inst.chromId };

        const qArm = MeshBuilder.CreateCapsule(
          `qArm_${inst.instanceIndex}_${side}`,
          {
            radius: armRadius,
            height: Math.max(armRadius * 2.1, qArmLen + armRadius * 0.6),
            tessellation: 22,
            subdivisions: 4,
            capSubdivisions: 8,
          },
          scene
        );
        qArm.parent = cRoot;
        qArm.position.set(side * xSpread, cenY - qArmLen * 0.5 - 0.02, 0);
        qArm.rotation.z = side * 0.075;
        qArm.material = armMat;
        qArm.metadata = { chromId: inst.chromId };
      });

      // Glowing Centromere Primary Constriction Core
      const cenSphere = MeshBuilder.CreateSphere(
        `cen_${inst.instanceIndex}`,
        { diameterX: 0.23, diameterY: 0.13, diameterZ: 0.17, segments: 16 },
        scene
      );
      cenSphere.parent = cRoot;
      cenSphere.position.set(0, cenY, 0);
      cenSphere.metadata = { chromId: inst.chromId };
      const cenMat = new StandardMaterial(`cenMat_${inst.instanceIndex}`, scene);
      cenMat.diffuseColor = isTrisomicExtra
        ? new Color3(1.0, 0.88, 0.45)
        : new Color3(0.85, 0.96, 1.0);
      cenMat.emissiveColor = isTrisomicExtra
        ? new Color3(0.95, 0.6, 0.08)
        : new Color3(0.18, 0.68, 0.95);
      cenSphere.material = cenMat;

      // Selection / Trisomy Pedestal Halo Ring
      const haloDisc = MeshBuilder.CreateTorus(
        `halo_${inst.instanceIndex}`,
        { diameter: 0.54, thickness: 0.035, tessellation: 36 },
        scene
      );
      haloDisc.parent = cRoot;
      haloDisc.position.set(0, -totalH / 2 - 0.14, 0);
      haloDisc.isPickable = false;
      const haloMat = new StandardMaterial(`haloMat_${inst.instanceIndex}`, scene);
      haloMat.diffuseColor = isTrisomicExtra
        ? new Color3(0.96, 0.62, 0.04)
        : new Color3(0.22, 0.74, 0.97);
      haloMat.emissiveColor = isTrisomicExtra
        ? new Color3(0.96, 0.62, 0.04)
        : new Color3(0.22, 0.74, 0.97);
      haloDisc.material = haloMat;

      // Active Gene Locus Collar & Callout Badge (Shown when this chromosome holds the active locus)
      const locusCollar = MeshBuilder.CreateTorus(
        `locusCollar_${inst.instanceIndex}`,
        { diameter: 0.38, thickness: 0.036, tessellation: 32 },
        scene
      );
      locusCollar.parent = cRoot;
      locusCollar.scaling.set(1.2, 1, 0.85);
      locusCollar.isPickable = false;
      const locusMat = new StandardMaterial(`locusMat_${inst.instanceIndex}`, scene);
      locusMat.diffuseColor = new Color3(0.5, 0.82, 0.25);
      locusMat.emissiveColor = new Color3(0.5, 0.88, 0.25);
      locusCollar.material = locusMat;

      const { mesh: locusBadge, dt: locusBadgeDT } = createDNABillboardBadge(
        `locusBadge_${inst.instanceIndex}`,
        '',
        '#7FD141',
        'rgba(6, 11, 24, 0.94)',
        '#7FD141',
        scene,
        cRoot,
        new Vector3(0, 0, -0.25),
        1.24,
        0.26
      );

      // Chromosome Label Badge below each chromosome
      createDNABillboardBadge(
        `chrLbl_${inst.instanceIndex}`,
        `#${inst.instanceIndex} ${inst.label}`,
        isTrisomicExtra
          ? '#f59e0b'
          : isSexChromosome
          ? '#ec4899'
          : '#0ea5e9',
        isTrisomicExtra
          ? 'rgba(120, 53, 15, 0.94)'
          : 'rgba(6, 11, 24, 0.9)',
        isTrisomicExtra ? '#fde68a' : '#f8fafc',
        scene,
        cRoot,
        new Vector3(0, -totalH / 2 - 0.32, 0),
        0.88,
        0.2
      );

      chromEntries.push({
        inst,
        root: cRoot,
        armMat,
        fresnel,
        haloDisc,
        locusCollar,
        locusBadge,
        locusBadgeDT,
        totalH,
        gridCol: col,
        gridRow: row,
      });
    });

    // =========================================================================
    // 2. CONTINUOUS BABYLON.JS B-DNA DOUBLE HELIX + BASE-PAIR RUNGS + SNP RING
    // =========================================================================
    const dnaRoot = new TransformNode('dnaRoot', scene);
    const NUM_BP = 28;
    const HELIX_RADIUS = 1.08;
    const RISE_PER_BP = 0.27;
    const TWIST_PER_BP = (34.3 * Math.PI) / 180;
    const MINOR_GROOVE_OFFSET = (138 * Math.PI) / 180;
    const TOTAL_HELIX_H = NUM_BP * RISE_PER_BP;

    // Smooth interpolated helical paths (160 points) for the two antiparallel sugar-phosphate ribbons
    const curvePts1: Vector3[] = [];
    const curvePts2: Vector3[] = [];
    const INTERP_STEPS = 160;
    for (let s = 0; s <= INTERP_STEPS; s++) {
      const bpFloat = (s / INTERP_STEPS) * (NUM_BP - 1);
      const y = bpFloat * RISE_PER_BP - TOTAL_HELIX_H / 2;
      const a1 = bpFloat * TWIST_PER_BP;
      const a2 = a1 + MINOR_GROOVE_OFFSET;
      curvePts1.push(new Vector3(Math.cos(a1) * HELIX_RADIUS, y, Math.sin(a1) * HELIX_RADIUS));
      curvePts2.push(new Vector3(Math.cos(a2) * HELIX_RADIUS, y, Math.sin(a2) * HELIX_RADIUS));
    }

    const strand1Tube = MeshBuilder.CreateTube(
      'dnaStrand1',
      { path: curvePts1, radius: 0.084, tessellation: 22, cap: Mesh.CAP_ALL },
      scene
    );
    strand1Tube.parent = dnaRoot;
    strand1Tube.isPickable = false;
    const strand1Mat = new StandardMaterial('strand1Mat', scene);
    strand1Mat.diffuseColor = new Color3(0.22, 0.74, 0.97);
    strand1Mat.emissiveColor = new Color3(0.08, 0.45, 0.78);
    strand1Mat.specularColor = new Color3(0.9, 0.96, 1.0);
    strand1Mat.specularPower = 64;
    const s1Fresnel = new FresnelParameters();
    s1Fresnel.bias = 0.15;
    s1Fresnel.power = 2.0;
    s1Fresnel.leftColor = new Color3(0.55, 0.92, 1.0);
    s1Fresnel.rightColor = new Color3(0.05, 0.28, 0.55);
    strand1Mat.emissiveFresnelParameters = s1Fresnel;
    strand1Tube.material = strand1Mat;

    const strand2Tube = MeshBuilder.CreateTube(
      'dnaStrand2',
      { path: curvePts2, radius: 0.084, tessellation: 22, cap: Mesh.CAP_ALL },
      scene
    );
    strand2Tube.parent = dnaRoot;
    strand2Tube.isPickable = false;
    const strand2Mat = new StandardMaterial('strand2Mat', scene);
    strand2Mat.diffuseColor = new Color3(0.51, 0.55, 0.97);
    strand2Mat.emissiveColor = new Color3(0.28, 0.25, 0.75);
    strand2Mat.specularColor = new Color3(0.9, 0.9, 1.0);
    strand2Mat.specularPower = 64;
    const s2Fresnel = new FresnelParameters();
    s2Fresnel.bias = 0.15;
    s2Fresnel.power = 2.0;
    s2Fresnel.leftColor = new Color3(0.78, 0.82, 1.0);
    s2Fresnel.rightColor = new Color3(0.18, 0.15, 0.48);
    strand2Mat.emissiveFresnelParameters = s2Fresnel;
    strand2Tube.material = strand2Mat;

    // 28 Base-Pair Rungs (A=T, G≡C) & Hydrogen-Bond Core Sleeves
    interface BpRungEntry {
      half1Mat: StandardMaterial;
      half2Mat: StandardMaterial;
      node1Mat: StandardMaterial;
      node2Mat: StandardMaterial;
      hBondSleeve: Mesh;
      hBondMat: StandardMaterial;
      y: number;
    }

    const bpEntries: BpRungEntry[] = [];
    const upAxis = new Vector3(0, 1, 0);

    for (let idx = 0; idx < NUM_BP; idx++) {
      const y = idx * RISE_PER_BP - TOTAL_HELIX_H / 2;
      const a1 = idx * TWIST_PER_BP;
      const a2 = a1 + MINOR_GROOVE_OFFSET;

      const p1 = new Vector3(Math.cos(a1) * HELIX_RADIUS, y, Math.sin(a1) * HELIX_RADIUS);
      const p2 = new Vector3(Math.cos(a2) * HELIX_RADIUS, y, Math.sin(a2) * HELIX_RADIUS);
      const mid = Vector3.Lerp(p1, p2, 0.5);
      const mid1 = Vector3.Lerp(p1, mid, 0.5);
      const mid2 = Vector3.Lerp(p2, mid, 0.5);

      const dir = p2.subtract(p1);
      const totalSpan = dir.length();
      const unitDir = dir.normalize();
      const rungQuat = new Quaternion();
      Quaternion.FromUnitVectorsToRef(upAxis, unitDir, rungQuat);

      // Phosphodiester Backbone Nodes
      const node1 = MeshBuilder.CreateSphere(
        `bpNode1_${idx}`,
        { diameter: 0.19, segments: 14 },
        scene
      );
      node1.parent = dnaRoot;
      node1.position.copyFrom(p1);
      node1.isPickable = false;
      const node1Mat = new StandardMaterial(`bpNode1Mat_${idx}`, scene);
      node1.material = node1Mat;

      const node2 = MeshBuilder.CreateSphere(
        `bpNode2_${idx}`,
        { diameter: 0.19, segments: 14 },
        scene
      );
      node2.parent = dnaRoot;
      node2.position.copyFrom(p2);
      node2.isPickable = false;
      const node2Mat = new StandardMaterial(`bpNode2Mat_${idx}`, scene);
      node2.material = node2Mat;

      // Primary & Complementary Base Rung Cylinders
      const half1 = MeshBuilder.CreateCylinder(
        `bpHalf1_${idx}`,
        { height: totalSpan * 0.46, diameter: 0.08, tessellation: 14 },
        scene
      );
      half1.parent = dnaRoot;
      half1.position.copyFrom(mid1);
      half1.rotationQuaternion = rungQuat.clone();
      half1.isPickable = false;
      const half1Mat = new StandardMaterial(`bpHalf1Mat_${idx}`, scene);
      half1.material = half1Mat;

      const half2 = MeshBuilder.CreateCylinder(
        `bpHalf2_${idx}`,
        { height: totalSpan * 0.46, diameter: 0.08, tessellation: 14 },
        scene
      );
      half2.parent = dnaRoot;
      half2.position.copyFrom(mid2);
      half2.rotationQuaternion = rungQuat.clone();
      half2.isPickable = false;
      const half2Mat = new StandardMaterial(`bpHalf2Mat_${idx}`, scene);
      half2.material = half2Mat;

      // Central Glowing Hydrogen-Bond Connector Sleeve
      const hBondSleeve = MeshBuilder.CreateCylinder(
        `bpHBond_${idx}`,
        { height: 0.16, diameter: 0.1, tessellation: 14 },
        scene
      );
      hBondSleeve.parent = dnaRoot;
      hBondSleeve.position.copyFrom(mid);
      hBondSleeve.rotationQuaternion = rungQuat.clone();
      hBondSleeve.isPickable = false;
      const hBondMat = new StandardMaterial(`bpHBondMat_${idx}`, scene);
      hBondSleeve.material = hBondMat;

      bpEntries.push({
        half1Mat,
        half2Mat,
        node1Mat,
        node2Mat,
        hBondSleeve,
        hBondMat,
        y,
      });
    }

    // Active SNP / Variant Orbital Scanner Ring & Callout Badge on the Helix
    const snpRing = MeshBuilder.CreateTorus(
      'snpScannerRing',
      { diameter: HELIX_RADIUS * 2.48, thickness: 0.048, tessellation: 64 },
      scene
    );
    snpRing.parent = dnaRoot;
    snpRing.isPickable = false;
    const snpRingMat = new StandardMaterial('snpRingMat', scene);
    snpRingMat.diffuseColor = new Color3(0.5, 0.88, 0.25);
    snpRingMat.emissiveColor = new Color3(0.5, 0.92, 0.25);
    snpRing.material = snpRingMat;

    const { mesh: snpBadgeMesh, dt: snpBadgeDT } = createDNABillboardBadge(
      'snpCalloutBadge',
      '',
      '#7FD141',
      'rgba(6, 11, 24, 0.94)',
      '#7FD141',
      scene,
      dnaRoot,
      new Vector3(0, 0, -HELIX_RADIUS * 1.28),
      1.82,
      0.34
    );

    // =========================================================================
    // POINTER CLICK RAYCASTING FOR CHROMOSOME SELECTION
    // =========================================================================
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) =>
          Boolean(m.metadata && m.metadata.chromId)
        );
        if (pick?.hit && pick.pickedMesh?.metadata?.chromId) {
          const cid = pick.pickedMesh.metadata.chromId as ChromosomeId;
          stateRef.current.onSelectChromosome(cid);
          const loci = GENE_LOCI.filter((l) => l.chromosome === cid);
          if (loci.length > 0) {
            stateRef.current.onSelectLocus(loci[0]);
          }
        }
      }
    });

    // =========================================================================
    // 60 FPS BABYLON RENDER & STATE SYNCHRONIZATION LOOP
    // =========================================================================
    let elapsed = 0;
    let lastSeqKey = '';

    scene.registerBeforeRender(() => {
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
      elapsed += dt;
      const st = stateRef.current;

      // 1. Smooth Camera Preset Interpolation
      const camAnim = camAnimRef.current;
      if (camAnim.active) {
        const damp = 1 - Math.exp(-6.5 * dt);
        camera.alpha += (camAnim.alpha - camera.alpha) * damp;
        camera.beta += (camAnim.beta - camera.beta) * damp;
        camera.radius += (camAnim.radius - camera.radius) * damp;
        Vector3.LerpToRef(camera.target, camAnim.target, damp, camera.target);
        if (
          Math.abs(camera.alpha - camAnim.alpha) < 0.01 &&
          Math.abs(camera.beta - camAnim.beta) < 0.01 &&
          Math.abs(camera.radius - camAnim.radius) < 0.05
        ) {
          camAnim.active = false;
        }
      }

      // 2. Update Chromosome Layout, Selection Glow & Active Gene Locus Marker
      const showAllKaryotype =
        st.viewMode3D === 'dual-3d' || st.viewMode3D === 'karyotype-3d';
      const showCloseupChrom = st.viewMode3D === 'chrom-closeup';
      const showHelix =
        st.viewMode3D === 'dual-3d' ||
        st.viewMode3D === 'chrom-closeup' ||
        st.viewMode3D === 'helix-3d';

      karyotypeRoot.setEnabled(showAllKaryotype || showCloseupChrom);
      dnaRoot.setEnabled(showHelix);

      const xOffsetStage = st.viewMode3D === 'dual-3d' ? -2.75 : 0;
      const selectedCopies = chromEntries.filter(
        (e) => e.inst.chromId === st.selectedChromId
      );

      chromEntries.forEach((entry) => {
        const isSelChrom = entry.inst.chromId === st.selectedChromId;
        const isTri = entry.inst.isTrisomicExtra;
        const isSex = entry.inst.isSexChromosome;

        if (showCloseupChrom) {
          entry.root.setEnabled(isSelChrom);
          if (isSelChrom) {
            const idxInSel = selectedCopies.indexOf(entry);
            const count = selectedCopies.length;
            const xPos = -2.6 + (idxInSel - (count - 1) / 2) * 1.38;
            entry.root.position.set(
              xPos,
              0.2 + Math.sin(elapsed * 2.0 + entry.inst.instanceIndex) * 0.04,
              0
            );
            entry.root.scaling.setAll(1.82);
            entry.root.rotation.y = Math.sin(elapsed * 1.35 + entry.inst.instanceIndex) * 0.32;
          }
        } else {
          entry.root.setEnabled(true);
          const baseX = xOffsetStage + (entry.gridCol - 3.5) * 1.44;
          const baseY = (1 - entry.gridRow) * 2.58;
          const copyShift = (entry.inst.copyNumber - 1.5) * 0.36;
          const hoverBob =
            isSelChrom || isTri
              ? Math.sin(elapsed * 2.0 + entry.inst.instanceIndex * 0.5) * 0.045
              : 0;

          entry.root.position.set(baseX + copyShift, baseY + hoverBob, 0);
          entry.root.scaling.setAll(1.0);
          entry.root.rotation.y =
            isSelChrom || isTri
              ? Math.sin(elapsed * 1.35 + entry.inst.instanceIndex * 0.4) * 0.32
              : 0;
        }

        // Update Fresnel Rim Glow & Halo visibility
        entry.haloDisc.setEnabled(isSelChrom || isTri);
        if (isTri) {
          entry.fresnel.leftColor.set(1.0, 0.78, 0.18);
          entry.armMat.emissiveColor.set(0.45, 0.32, 0.08);
        } else if (isSelChrom) {
          entry.fresnel.leftColor.set(0.5, 0.92, 0.25);
          entry.armMat.emissiveColor.set(0.22, 0.48, 0.65);
        } else if (isSex) {
          entry.fresnel.leftColor.set(0.96, 0.38, 0.72);
          entry.armMat.emissiveColor.set(0.32, 0.14, 0.26);
        } else {
          entry.fresnel.leftColor.set(0.22, 0.76, 0.98);
          entry.armMat.emissiveColor.set(0.14, 0.26, 0.42);
        }

        // Active Gene Locus Collar on Selected Chromosome
        const hasActiveLocus =
          isSelChrom && st.activeLocus.chromosome === entry.inst.chromId;
        entry.locusCollar.setEnabled(hasActiveLocus);
        entry.locusBadge.setEnabled(hasActiveLocus && entry.inst.copyNumber === 1);
        if (hasActiveLocus) {
          const locusY = entry.totalH / 2 - st.activeLocus.normPos * entry.totalH;
          entry.locusCollar.position.y = locusY;
          entry.locusBadge.position.y = locusY + 0.26;
        }
      });

      // 3. Update B-DNA Double Helix Position, Rotation & Nucleotide Base-Pair Colors
      if (showHelix) {
        if (st.viewMode3D === 'dual-3d') {
          dnaRoot.position.set(5.3, 0.2, 0.35);
          dnaRoot.scaling.setAll(0.96);
        } else if (st.viewMode3D === 'chrom-closeup') {
          dnaRoot.position.set(3.1, 0.2, 0.2);
          dnaRoot.scaling.setAll(0.96);
        } else {
          dnaRoot.position.set(0, 0.2, 0);
          dnaRoot.scaling.setAll(1.24);
        }

        if (st.autoRotateHelix) {
          dnaRoot.rotation.y += dt * 0.52;
        }

        const seqKey = `${st.activeSequence}-${st.mutatedBpIndex}-${st.activeLocus.geneSymbol}-${st.finishMode}`;
        if (seqKey !== lastSeqKey) {
          lastSeqKey = seqKey;
          const bases = st.activeSequence.slice(0, NUM_BP).split('');

          chromEntries.forEach((entry) => {
            if (
              entry.inst.chromId === st.selectedChromId &&
              entry.inst.copyNumber === 1
            ) {
              updateDNABillboardBadgeText(
                entry.locusBadgeDT,
                `${st.activeLocus.geneSymbol} (${st.activeLocus.cytogeneticBand})`,
                '#7FD141'
              );
            }
          });

          for (let idx = 0; idx < NUM_BP; idx++) {
            const base = bases[idx] || 'A';
            const comp = COMPLEMENT_BASE[base] || 'T';
            const c1 = BASE_COLOR3[base] || BASE_COLOR3.A;
            const c2 = BASE_COLOR3[comp] || BASE_COLOR3.T;
            const isMut = idx === st.mutatedBpIndex;
            const isGC = base === 'G' || base === 'C';
            const bp = bpEntries[idx];

            bp.half1Mat.diffuseColor.copyFrom(c1);
            bp.half1Mat.emissiveColor.copyFrom(c1.scale(isMut ? 0.9 : 0.48));

            bp.half2Mat.diffuseColor.copyFrom(c2);
            bp.half2Mat.emissiveColor.copyFrom(c2.scale(isMut ? 0.9 : 0.48));

            bp.node1Mat.diffuseColor = isMut
              ? new Color3(0.5, 0.92, 0.25)
              : new Color3(0.45, 0.82, 0.98);
            bp.node1Mat.emissiveColor = isMut
              ? new Color3(0.45, 0.88, 0.22)
              : new Color3(0.12, 0.48, 0.78);

            bp.node2Mat.diffuseColor = isMut
              ? new Color3(0.5, 0.92, 0.25)
              : new Color3(0.75, 0.78, 0.98);
            bp.node2Mat.emissiveColor = isMut
              ? new Color3(0.45, 0.88, 0.22)
              : new Color3(0.28, 0.25, 0.72);

            bp.hBondMat.diffuseColor = new Color3(0.98, 0.99, 1.0);
            bp.hBondMat.emissiveColor = isMut
              ? new Color3(0.5, 0.92, 0.25)
              : new Color3(0.22, 0.74, 0.97);

            if (isMut) {
              snpRing.position.y = bp.y;
              snpBadgeMesh.position.y = bp.y + 0.34;
              updateDNABillboardBadgeText(
                snpBadgeDT,
                `SNP bp #${idx + 1}: ${base}${isGC ? '≡' : '='}${comp} (${st.activeLocus.geneSymbol})`,
                '#7FD141'
              );
            }
          }
        }
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, [karyotypeInstances]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block outline-none cursor-grab active:cursor-grabbing"
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
  const [autoRotateHelix, setAutoRotateHelix] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showPresetDetails, setShowPresetDetails] = useState<boolean>(false);
  const [showNumericFacts, setShowNumericFacts] = useState<boolean>(true);
  const [showGspDrawer, setShowGspDrawer] = useState<boolean>(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const controlsRef = useRef<any>(null);

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

  // Compute 3D Grid Positions for all 46 or 47 Chromosomes
  const karyotypePositions = useMemo(() => {
    const groupOrder: ChromosomeId[] = [
      '1', '2', '3', '4', '5', '6', '7', '8',
      '9', '10', '11', '12', '13', '14', '15', '16',
      '17', '18', '19', '20', '21', '22', 'X', 'Y',
    ];

    const xOffsetStage = viewMode3D === 'dual-3d' ? -2.75 : 0;
    const positionsMap = new Map<number, [number, number, number]>();

    karyotypeInstances.forEach((inst) => {
      const grpIdx = groupOrder.indexOf(inst.chromId);
      const col = grpIdx % 8;
      const row = Math.floor(grpIdx / 8);

      const baseX = xOffsetStage + (col - 3.5) * 1.44;
      const baseY = (1 - row) * 2.58;
      const copyShift = (inst.copyNumber - 1.5) * 0.36;
      positionsMap.set(inst.instanceIndex, [baseX + copyShift, baseY, 0]);
    });

    return positionsMap;
  }, [karyotypeInstances, viewMode3D]);

  const selectedChromInstances = useMemo(
    () => karyotypeInstances.filter((inst) => inst.chromId === selectedChromId),
    [karyotypeInstances, selectedChromId]
  );

  const mutatedBpIndex = Math.max(
    0,
    Math.min(27, activeAllele.mutatedCodonIndex * 3 + 1)
  );

  const stageBgColor =
    finishMode === 'cpk-metallic'
      ? '#080705'
      : finishMode === 'bioluminescent'
      ? '#030b12'
      : darkMode
      ? '#040812'
      : '#070d1c';

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
              <span className="px-2 py-0.5 rounded-md bg-[#7FD141]/15 border border-[#7FD141]/30 text-[#7FD141] font-bold tabular-nums">
                {lang === 'fa' ? '۹۹.۹٪ تشابه DNA انسان‌ها' : '99.9% Shared Human DNA'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              {lang === 'fa' ? activePreset.titleFa : activePreset.titleEn}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNumericFacts((v) => !v)}
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
        className={`relative rounded-2xl overflow-hidden border border-slate-300/50 dark:border-slate-800/80 bg-[#040812] ${
          isFullscreen ? 'fixed inset-3 z-50 h-auto' : 'h-[540px] sm:h-[620px]'
        }`}
      >
        {/* Unified Non-Overlapping Top HUD Bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-200 shadow-lg">
            <span className="text-sky-400 font-bold">{karyotypeMode}</span>
            <span>·</span>
            <span>
              {karyotypeInstances.length} {lang === 'fa' ? 'کروموزوم سه‌بعدی' : '3D Chromosomes'}
            </span>
            <span>·</span>
            <span className="text-[#7FD141] font-bold">
              Chr {activeLocus.cytogeneticBand} ({activeLocus.geneSymbol})
            </span>
            <span className="hidden md:inline text-slate-300">
              — {lang === 'fa' ? activeLocus.traitTitleFa : activeLocus.traitTitleEn}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Interactive 3D Camera Preset Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-xl p-1 shadow-lg font-mono text-[11px]">
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
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
                    cameraPreset === cam.id
                      ? 'bg-[#7FD141] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {lang === 'fa' ? cam.fa : cam.en}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-200 hover:border-sky-400 flex items-center gap-1 cursor-pointer shadow-lg"
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
          onSelectChromosome={(cid) => setSelectedChromId(cid)}
          onSelectLocus={(loc) => {
            setSelectedLocusId(loc.id);
            setSelectedAlleleIdx(0);
          }}
        />

        {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(1020px,96vw)] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="px-3 py-1 rounded-t-lg bg-slate-900/95 border border-b-0 border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
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
            <div className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/94 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono text-slate-200">
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer whitespace-nowrap ${
                      viewMode3D === m.id
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === 'fa' ? m.fa : m.en}
                  </button>
                ))}
              </div>

              {/* Base Pair Color Legend */}
              <div className="hidden xl:flex items-center gap-2.5 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#38bdf8] inline-block" /> A (Purine)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b] inline-block" /> T (Pyrimidine)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block" /> G (Purine)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#f43f5e] inline-block" /> C (Pyrimidine)
                </span>
              </div>

              {/* Molecular Finish Switcher + Helix Spin Toggle */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
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
                      className={`px-2 py-0.5 rounded-md text-[10px] cursor-pointer transition-colors ${
                        finishMode === f.id
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {lang === 'fa' ? f.fa : f.en}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAutoRotateHelix((r) => !r)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] hover:border-sky-400 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 text-sky-400" />
                  <span>
                    {autoRotateHelix
                      ? lang === 'fa'
                        ? 'چرخش: فعال'
                        : 'Spin: On'
                      : lang === 'fa'
                      ? 'چرخش: متوقف'
                      : 'Spin: Off'}
                  </span>
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
                    <span className="text-[9px] opacity-80">
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
                                ? 'bg-[#7FD141]/20 text-[#7FD141] border border-[#7FD141]/40'
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
                <span className="px-2 py-0.5 rounded-md bg-[#7FD141]/20 border border-[#7FD141]/50 text-[#7FD141] font-bold">
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
                          ? 'bg-[#7FD141]/20 border-2 border-[#7FD141] shadow-sm'
                          : 'bg-slate-900/75 border border-slate-800'
                      }`}
                    >
                      <span
                        className={`text-[9px] tabular-nums ${
                          isMut ? 'text-[#7FD141] font-bold' : 'text-slate-400'
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

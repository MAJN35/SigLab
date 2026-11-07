import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
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

// Cache for procedural Giemsa G-band chromatin textures per chromosome ID
const _chromTextureCache = new Map<string, THREE.CanvasTexture>();

function getChromatinGBandTexture(
  spec: ChromosomeSpec,
  isSelected: boolean,
  isTrisomic: boolean
): THREE.CanvasTexture {
  const key = `${spec.id}-${isSelected ? 'sel' : 'norm'}-${isTrisomic ? 'tri' : ' dip'}`;
  const cached = _chromTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base euchromatin tone
    const baseBg = isTrisomic ? '#fef3c7' : isSelected ? '#e0f2fe' : '#cbd5e1';
    ctx.fillStyle = baseBg;
    ctx.fillRect(0, 0, 128, 512);

    // Draw Cytogenetic Giemsa G-Bands along vertical axis
    spec.bands.forEach((b) => {
      const yCenter = b.pos * 512;
      const bandHeight = 34;
      const grad = ctx.createLinearGradient(0, yCenter - bandHeight, 0, yCenter + bandHeight);
      let darkCol = '#334155';
      if (b.stain === 'gpos100') darkCol = '#0f172a';
      else if (b.stain === 'gpos75') darkCol = '#1e293b';
      else if (b.stain === 'gpos50') darkCol = '#475569';
      else if (b.stain === 'gpos25') darkCol = '#94a3b8';
      else darkCol = baseBg;

      grad.addColorStop(0, baseBg);
      grad.addColorStop(0.3, darkCol);
      grad.addColorStop(0.7, darkCol);
      grad.addColorStop(1, baseBg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, yCenter - bandHeight, 128, bandHeight * 2);
    });

    // Add fine 30nm solenoidal chromatin coil micro-striations for cryo-EM realism
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = 2;
    for (let y = 4; y < 512; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(42, y - 3, 86, y + 3, 128, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  _chromTextureCache.set(key, tex);
  return tex;
}

/** High-DPI 3D Billboard Sprite for Chromosome & SNP Labels (Zero React DOM Portals!) */
function createBadgeSpriteTexture(
  text: string,
  borderColor: string,
  bgColor = 'rgba(8, 13, 26, 0.92)',
  textColor = '#f8fafc'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 320, 72);
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 8, 308, 56, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 160, 37);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const SpriteBadge3D: React.FC<{
  text: string;
  position: [number, number, number];
  borderColor?: string;
  bgColor?: string;
  textColor?: string;
  scale?: [number, number, number];
}> = ({
  text,
  position,
  borderColor = '#38bdf8',
  bgColor = 'rgba(8, 13, 26, 0.92)',
  textColor = '#f8fafc',
  scale = [1.05, 0.24, 1],
}) => {
  const tex = useMemo(
    () => createBadgeSpriteTexture(text, borderColor, bgColor, textColor),
    [text, borderColor, bgColor, textColor]
  );
  useEffect(() => {
    return () => tex.dispose();
  }, [tex]);
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
};

/**
 * Realistic 3D Metaphase Chromosome Model:
 * - Organic curved X-shaped sister chromatids (TubeGeometry splines pinching at the centromere)
 * - Giemsa G-band & coiled chromatin surface texture with physical clearcoat sheen
 * - Primary constriction kinetochore complex + glowing telomere caps + acrocentric satellites
 * - Glowing Trait Gene Locus Beacons
 */
const Chromosome3DModel: React.FC<{
  instance: KaryotypeInstance;
  position: [number, number, number];
  scale?: number;
  isSelectedChromosome: boolean;
  activeLociOnChrom: GeneLocus[];
  selectedLocusId: string;
  onSelectChromosome: (chromId: ChromosomeId) => void;
  onSelectLocus: (locus: GeneLocus) => void;
}> = ({
  instance,
  position,
  scale = 1,
  isSelectedChromosome,
  activeLociOnChrom,
  selectedLocusId,
  onSelectChromosome,
  onSelectLocus,
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const timeRef = useRef(instance.instanceIndex * 0.45);
  const { spec, isTrisomicExtra, isSexChromosome } = instance;

  const totalH = 0.72 + spec.lengthNorm * 1.98;
  const cenY = totalH / 2 - totalH * spec.centromereRatio;
  const radius = 0.088;

  // Build organic curved Left & Right Sister Chromatid TubeGeometries that pinch at cenY
  const { leftChromatidGeo, rightChromatidGeo, leftTelomeres, rightTelomeres } = useMemo(() => {
    const buildSisterCurve = (side: -1 | 1) => {
      const topY = totalH / 2;
      const botY = -totalH / 2;
      const pMidY = (topY + cenY) * 0.5;
      const qMidY = (cenY + botY) * 0.5;

      const pts = [
        new THREE.Vector3(side * 0.135, topY, side * 0.015),
        new THREE.Vector3(side * 0.105, pMidY, -side * 0.012),
        new THREE.Vector3(side * 0.042, cenY, 0), // Pinch inward at centromere constriction!
        new THREE.Vector3(side * 0.115, qMidY, side * 0.015),
        new THREE.Vector3(side * 0.145, botY, -side * 0.012),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 36, radius, 16, false);
      return {
        geo,
        tips: {
          top: [side * 0.135, topY, side * 0.015] as [number, number, number],
          bot: [side * 0.145, botY, -side * 0.012] as [number, number, number],
        },
      };
    };

    const left = buildSisterCurve(-1);
    const right = buildSisterCurve(1);
    return {
      leftChromatidGeo: left.geo,
      rightChromatidGeo: right.geo,
      leftTelomeres: left.tips,
      rightTelomeres: right.tips,
    };
  }, [totalH, cenY, radius]);

  useEffect(() => {
    return () => {
      leftChromatidGeo.dispose();
      rightChromatidGeo.dispose();
    };
  }, [leftChromatidGeo, rightChromatidGeo]);

  const gBandTex = useMemo(
    () => getChromatinGBandTexture(spec, isSelectedChromosome, isTrisomicExtra),
    [spec, isSelectedChromosome, isTrisomicExtra]
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    if (isSelectedChromosome || isTrisomicExtra) {
      groupRef.current.rotation.y = Math.sin(t * 1.35) * 0.32;
      groupRef.current.position.y = position[1] + Math.sin(t * 2.0) * 0.045;
    } else {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.08);
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        position[1],
        0.08
      );
    }
  });

  const tintColor = isTrisomicExtra
    ? '#fbbf24'
    : isSelectedChromosome
    ? '#7dd3fc'
    : isSexChromosome
    ? '#f472b6'
    : '#e2e8f0';

  const emissiveColor = isTrisomicExtra
    ? '#f59e0b'
    : isSelectedChromosome
    ? spec.colorAccent
    : isSexChromosome
    ? '#ec4899'
    : '#1e293b';

  const emissiveIntensity = isTrisomicExtra
    ? 0.35
    : isSelectedChromosome
    ? 0.28
    : 0.06;

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelectChromosome(instance.chromId);
        if (activeLociOnChrom.length > 0) {
          onSelectLocus(activeLociOnChrom[0]);
        }
      }}
    >
      {/* Selection / Trisomy Pedestal Halo */}
      {(isSelectedChromosome || isTrisomicExtra) && (
        <mesh position={[0, -totalH / 2 - 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.33, 36]} />
          <meshBasicMaterial
            color={isTrisomicExtra ? '#f59e0b' : '#38bdf8'}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Left & Right Organic Curved Sister Chromatids with Giemsa G-Banding */}
      <mesh geometry={leftChromatidGeo}>
        <meshPhysicalMaterial
          map={gBandTex}
          color={tintColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.28}
          metalness={0.14}
          clearcoat={0.68}
          clearcoatRoughness={0.2}
        />
      </mesh>
      <mesh geometry={rightChromatidGeo}>
        <meshPhysicalMaterial
          map={gBandTex}
          color={tintColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.28}
          metalness={0.14}
          clearcoat={0.68}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* 4 Telomere Protective TTAGGG Caps (p-arm tips and q-arm tips) */}
      {[leftTelomeres.top, leftTelomeres.bot, rightTelomeres.top, rightTelomeres.bot].map(
        (tipPos, idx) => (
          <mesh key={idx} position={tipPos}>
            <sphereGeometry args={[radius * 0.96, 16, 16]} />
            <meshPhysicalMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={0.65}
              roughness={0.15}
              metalness={0.3}
              clearcoat={1}
            />
          </mesh>
        )
      )}

      {/* Acrocentric Satellite Stalks (for Chr 13, 14, 15, 21, 22) */}
      {spec.morphology === 'acrocentric' && (
        <group position={[0, totalH / 2 + 0.1, 0]}>
          <mesh position={[-0.13, 0, 0]}>
            <sphereGeometry args={[0.048, 12, 12]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.13, 0, 0]}>
            <sphereGeometry args={[0.048, 12, 12]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}

      {/* Central Kinetochore / Centromere Primary Constriction Ring */}
      <group position={[0, cenY, 0]}>
        <mesh>
          <sphereGeometry args={[0.105, 20, 20]} />
          <meshPhysicalMaterial
            color={isTrisomicExtra ? '#f59e0b' : '#f8fafc'}
            emissive={isTrisomicExtra ? '#f59e0b' : '#38bdf8'}
            emissiveIntensity={0.55}
            roughness={0.15}
            metalness={0.75}
            clearcoat={1}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.022, 12, 28]} />
          <meshStandardMaterial
            color={isTrisomicExtra ? '#f59e0b' : '#38bdf8'}
            emissive={isTrisomicExtra ? '#f59e0b' : '#38bdf8'}
            emissiveIntensity={0.7}
          />
        </mesh>
      </group>

      {/* Glowing Trait Gene Locus Beacons on this Chromosome */}
      {activeLociOnChrom.map((locus) => {
        const locusY = totalH / 2 - locus.normPos * totalH;
        const isCurrentLocus = locus.id === selectedLocusId;
        return (
          <group
            key={locus.id}
            position={[0, locusY, 0.08]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectChromosome(instance.chromId);
              onSelectLocus(locus);
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[isCurrentLocus ? 0.25 : 0.19, 0.026, 14, 32]} />
              <meshStandardMaterial
                color={isCurrentLocus ? '#7FD141' : '#38bdf8'}
                emissive={isCurrentLocus ? '#7FD141' : '#38bdf8'}
                emissiveIntensity={isCurrentLocus ? 1.25 : 0.65}
              />
            </mesh>
            {isCurrentLocus && isSelectedChromosome && instance.copyNumber === 1 && (
              <SpriteBadge3D
                text={`${locus.geneSymbol} (${locus.cytogeneticBand})`}
                position={[0, 0.24, 0.22]}
                borderColor="#7FD141"
                textColor="#7FD141"
                scale={[1.28, 0.28, 1]}
              />
            )}
          </group>
        );
      })}

      {/* Crisp 3D Chromosome Label Sprite below each chromosome */}
      <SpriteBadge3D
        text={`#${instance.instanceIndex} ${instance.label}`}
        position={[0, -totalH / 2 - 0.34, 0]}
        borderColor={
          isTrisomicExtra
            ? '#f59e0b'
            : isSelectedChromosome
            ? '#38bdf8'
            : isSexChromosome
            ? '#ec4899'
            : '#334155'
        }
        bgColor={
          isTrisomicExtra
            ? 'rgba(120, 53, 15, 0.92)'
            : isSelectedChromosome
            ? 'rgba(3, 105, 161, 0.92)'
            : 'rgba(8, 13, 26, 0.88)'
        }
        textColor={isTrisomicExtra ? '#fde68a' : '#f8fafc'}
        scale={[0.92, 0.21, 1]}
      />
    </group>
  );
};

/**
 * Photorealistic 3D Molecular B-DNA Double Helix:
 * - Continuous Helical Sugar-Phosphate Backbone Ribbons (TubeGeometry along CatmullRomCurve3)
 * - True B-DNA Asymmetric Major Groove (22 Å) & Minor Groove (12 Å) via 138° glycosidic strand offset
 * - Deoxyribose Sugar & Phosphate Group Molecular Clusters
 * - Purine (Double-Ring A/G) vs Pyrimidine (Single-Ring T/C) Base Plates
 * - Explicit Hydrogen Bond Bridges (2 H-bonds for A=T, 3 H-bonds for G≡C)
 */
const DNADoubleHelix3D: React.FC<{
  sequence: string;
  mutatedIndex: number;
  geneSymbol: string;
  position: [number, number, number];
  scale?: number;
  autoRotate?: boolean;
}> = ({ sequence, mutatedIndex, geneSymbol, position, scale = 1, autoRotate = true }) => {
  const helixGroupRef = useRef<THREE.Group | null>(null);
  const bases = useMemo(() => sequence.slice(0, 28).split(''), [sequence]);

  useFrame((_, delta) => {
    if (helixGroupRef.current && autoRotate) {
      helixGroupRef.current.rotation.y += delta * 0.52;
    }
  });

  const radius = 1.08;
  const risePerBp = 0.27;
  const twistPerBp = (34.3 * Math.PI) / 180; // 10.5 base pairs per helical turn (real B-DNA)
  const minorGrooveOffset = (138 * Math.PI) / 180; // 138° creates true Major Groove (222°) & Minor Groove (138°)!
  const totalHeight = bases.length * risePerBp;

  // Build smooth continuous 3D Sugar-Phosphate Backbone Tubes for Strand 1 (5'->3') and Strand 2 (3'->5')
  const { strand1TubeGeo, strand2TubeGeo, strand1OuterGeo, strand2OuterGeo } = useMemo(() => {
    const pts1: THREE.Vector3[] = [];
    const pts2: THREE.Vector3[] = [];
    const pts1Outer: THREE.Vector3[] = [];
    const pts2Outer: THREE.Vector3[] = [];

    for (let i = 0; i < bases.length; i++) {
      const y = i * risePerBp - totalHeight / 2;
      const a1 = i * twistPerBp;
      const a2 = a1 + minorGrooveOffset;

      pts1.push(new THREE.Vector3(Math.cos(a1) * radius, y, Math.sin(a1) * radius));
      pts2.push(new THREE.Vector3(Math.cos(a2) * radius, y, Math.sin(a2) * radius));

      pts1Outer.push(
        new THREE.Vector3(Math.cos(a1 - 0.14) * (radius + 0.08), y, Math.sin(a1 - 0.14) * (radius + 0.08))
      );
      pts2Outer.push(
        new THREE.Vector3(Math.cos(a2 + 0.14) * (radius + 0.08), y, Math.sin(a2 + 0.14) * (radius + 0.08))
      );
    }

    const curve1 = new THREE.CatmullRomCurve3(pts1);
    const curve2 = new THREE.CatmullRomCurve3(pts2);
    const curve1Out = new THREE.CatmullRomCurve3(pts1Outer);
    const curve2Out = new THREE.CatmullRomCurve3(pts2Outer);

    return {
      strand1TubeGeo: new THREE.TubeGeometry(curve1, 140, 0.072, 16, false),
      strand2TubeGeo: new THREE.TubeGeometry(curve2, 140, 0.072, 16, false),
      strand1OuterGeo: new THREE.TubeGeometry(curve1Out, 120, 0.032, 12, false),
      strand2OuterGeo: new THREE.TubeGeometry(curve2Out, 120, 0.032, 12, false),
    };
  }, [bases.length, risePerBp, totalHeight, twistPerBp, minorGrooveOffset, radius]);

  useEffect(() => {
    return () => {
      strand1TubeGeo.dispose();
      strand2TubeGeo.dispose();
      strand1OuterGeo.dispose();
      strand2OuterGeo.dispose();
    };
  }, [strand1TubeGeo, strand2TubeGeo, strand1OuterGeo, strand2OuterGeo]);

  return (
    <group position={position} scale={scale} ref={helixGroupRef}>
      {/* Continuous 5' -> 3' Sugar-Phosphate Backbone Tube + Ribbon Accent */}
      <mesh geometry={strand1TubeGeo}>
        <meshPhysicalMaterial
          color="#0ea5e9"
          emissive="#0369a1"
          emissiveIntensity={0.32}
          roughness={0.14}
          metalness={0.35}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh geometry={strand1OuterGeo}>
        <meshPhysicalMaterial
          color="#7dd3fc"
          emissive="#38bdf8"
          emissiveIntensity={0.45}
          roughness={0.1}
          metalness={0.5}
          clearcoat={1}
        />
      </mesh>

      {/* Continuous 3' -> 5' Antiparallel Sugar-Phosphate Backbone Tube + Ribbon Accent */}
      <mesh geometry={strand2TubeGeo}>
        <meshPhysicalMaterial
          color="#818cf8"
          emissive="#4338ca"
          emissiveIntensity={0.28}
          roughness={0.16}
          metalness={0.38}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh geometry={strand2OuterGeo}>
        <meshPhysicalMaterial
          color="#c7d2fe"
          emissive="#6366f1"
          emissiveIntensity={0.35}
          roughness={0.12}
          metalness={0.5}
          clearcoat={1}
        />
      </mesh>

      {/* Individual Nucleotide Base Pairs, Pentose Sugars, and Hydrogen Bonds */}
      {bases.map((base, idx) => {
        const y = idx * risePerBp - totalHeight / 2;
        const a1 = idx * twistPerBp;
        const a2 = a1 + minorGrooveOffset;

        const p1 = new THREE.Vector3(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
        const p2 = new THREE.Vector3(Math.cos(a2) * radius, 0, Math.sin(a2) * radius);

        const compBase = COMPLEMENT_BASE[base] || 'T';
        const color1 = BASE_COLORS[base] || '#38bdf8';
        const color2 = BASE_COLORS[compBase] || '#f59e0b';
        const isMutatedSite = idx === mutatedIndex;

        // Purines (A, G) are 2-ring structures (longer); Pyrimidines (T, C) are 1-ring structures
        const isPurine1 = base === 'A' || base === 'G';
        const frac1 = isPurine1 ? 0.56 : 0.44;
        const isGC = base === 'G' || base === 'C'; // G≡C has 3 H-bonds; A=T has 2 H-bonds

        const hBondCenter = new THREE.Vector3().lerpVectors(p1, p2, frac1);
        const dir1To2 = new THREE.Vector3().subVectors(p2, p1);
        const totalSpan = dir1To2.length();
        const unitDir = dir1To2.clone().normalize();
        const upVec = new THREE.Vector3(0, 1, 0);
        const rungQuat = new THREE.Quaternion().setFromUnitVectors(upVec, unitDir);

        const mid1 = new THREE.Vector3().lerpVectors(p1, hBondCenter, 0.46);
        const mid2 = new THREE.Vector3().lerpVectors(p2, hBondCenter, 0.46);
        const len1 = totalSpan * frac1 * 0.86;
        const len2 = totalSpan * (1 - frac1) * 0.86;

        return (
          <group key={idx} position={[0, y, 0]}>
            {/* Strand 1 Phosphate Group (PO4-) & Deoxyribose Sugar Ring */}
            <mesh position={[p1.x, 0, p1.z]}>
              <sphereGeometry args={[isMutatedSite ? 0.145 : 0.105, 16, 16]} />
              <meshPhysicalMaterial
                color={isMutatedSite ? '#7FD141' : '#38bdf8'}
                emissive={isMutatedSite ? '#7FD141' : '#0284c7'}
                emissiveIntensity={isMutatedSite ? 0.95 : 0.3}
                roughness={0.14}
                metalness={0.45}
                clearcoat={1}
              />
            </mesh>
            <mesh position={[p1.x * 0.84, 0, p1.z * 0.84]} rotation={[Math.PI / 2, 0, -a1]}>
              <cylinderGeometry args={[0.065, 0.065, 0.032, 5]} />
              <meshStandardMaterial color="#e0f2fe" roughness={0.25} metalness={0.3} />
            </mesh>

            {/* Strand 2 Phosphate Group & Deoxyribose Pentose Ring */}
            <mesh position={[p2.x, 0, p2.z]}>
              <sphereGeometry args={[isMutatedSite ? 0.145 : 0.105, 16, 16]} />
              <meshPhysicalMaterial
                color={isMutatedSite ? '#f59e0b' : '#a5b4fc'}
                emissive={isMutatedSite ? '#f59e0b' : '#4f46e5'}
                emissiveIntensity={isMutatedSite ? 0.85 : 0.25}
                roughness={0.16}
                metalness={0.45}
                clearcoat={1}
              />
            </mesh>
            <mesh position={[p2.x * 0.84, 0, p2.z * 0.84]} rotation={[Math.PI / 2, 0, -a2]}>
              <cylinderGeometry args={[0.065, 0.065, 0.032, 5]} />
              <meshStandardMaterial color="#e0e7ff" roughness={0.25} metalness={0.3} />
            </mesh>

            {/* Base 1 Aromatic Molecular Plate / Rung */}
            <mesh position={mid1} quaternion={rungQuat}>
              <cylinderGeometry
                args={[
                  isMutatedSite ? 0.064 : 0.046,
                  isMutatedSite ? 0.064 : 0.046,
                  len1,
                  6,
                ]}
              />
              <meshPhysicalMaterial
                color={color1}
                emissive={color1}
                emissiveIntensity={isMutatedSite ? 0.85 : 0.35}
                roughness={0.2}
                metalness={0.25}
                clearcoat={0.8}
              />
            </mesh>

            {/* Base 2 Complementary Aromatic Molecular Plate / Rung */}
            <mesh position={mid2} quaternion={rungQuat}>
              <cylinderGeometry
                args={[
                  isMutatedSite ? 0.064 : 0.046,
                  isMutatedSite ? 0.064 : 0.046,
                  len2,
                  6,
                ]}
              />
              <meshPhysicalMaterial
                color={color2}
                emissive={color2}
                emissiveIntensity={isMutatedSite ? 0.85 : 0.35}
                roughness={0.2}
                metalness={0.25}
                clearcoat={0.8}
              />
            </mesh>

            {/* Hydrogen Bonds at Center (2 H-bonds for A=T, 3 H-bonds for G≡C) */}
            {(isGC ? [-0.042, 0, 0.042] : [-0.026, 0.026]).map((yOff, hbIdx) => (
              <mesh key={hbIdx} position={[hBondCenter.x, yOff, hBondCenter.z]}>
                <sphereGeometry args={[isMutatedSite ? 0.042 : 0.028, 10, 10]} />
                <meshBasicMaterial color={isMutatedSite ? '#ffffff' : '#e2e8f0'} />
              </mesh>
            ))}

            {/* Highlight Orbital Ring & 3D Sprite Callout on Active SNP / Variant Site */}
            {isMutatedSite && (
              <>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[radius * 1.24, 0.024, 14, 48]} />
                  <meshStandardMaterial
                    color="#7FD141"
                    emissive="#7FD141"
                    emissiveIntensity={1.2}
                  />
                </mesh>
                <SpriteBadge3D
                  text={`SNP bp #${idx + 1}: ${base}${isGC ? '≡' : '='}${compBase} (${geneSymbol})`}
                  position={[0, 0.36, radius * 1.25]}
                  borderColor="#7FD141"
                  textColor="#7FD141"
                  scale={[1.85, 0.36, 1]}
                />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
};

/**
 * 3D Uncoiling Chromatin Fiber Bridge connecting the Selected Chromosome to the B-DNA Double Helix
 */
const ChromatinUncoilingBridge3D: React.FC<{
  fromPos: [number, number, number];
  toPos: [number, number, number];
}> = ({ fromPos, toPos }) => {
  const geo = useMemo(() => {
    const start = new THREE.Vector3(...fromPos);
    const end = new THREE.Vector3(...toPos);
    const pts: THREE.Vector3[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const basePt = new THREE.Vector3().lerpVectors(start, end, u);
      const coilAmp = Math.sin(u * Math.PI) * 0.28;
      basePt.y += Math.sin(u * Math.PI * 10) * coilAmp;
      basePt.z += Math.cos(u * Math.PI * 10) * coilAmp + Math.sin(u * Math.PI) * 0.6;
      pts.push(basePt);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 96, 0.022, 10, false);
  }, [fromPos, toPos]);

  useEffect(() => {
    return () => geo.dispose();
  }, [geo]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color="#38bdf8"
        emissive="#7FD141"
        emissiveIntensity={0.65}
        transparent
        opacity={0.75}
      />
    </mesh>
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
  const [autoRotateHelix, setAutoRotateHelix] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showPresetDetails, setShowPresetDetails] = useState<boolean>(false);
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

  // Selected Chromosome Instances for Close-Up 3D Inspector Mode
  const selectedChromInstances = useMemo(
    () => karyotypeInstances.filter((inst) => inst.chromId === selectedChromId),
    [karyotypeInstances, selectedChromId]
  );

  // Selected chromosome 3D origin for uncoiling bridge
  const selectedChromBridgeOrigin = useMemo((): [number, number, number] => {
    if (viewMode3D === 'chrom-closeup') {
      return [-1.8, 0.2, 0];
    }
    const firstInst = selectedChromInstances[0];
    if (!firstInst) return [-2.5, 0, 0];
    return karyotypePositions.get(firstInst.instanceIndex) || [-2.5, 0, 0];
  }, [karyotypePositions, selectedChromInstances, viewMode3D]);

  const mutatedBpIndex = Math.max(
    0,
    Math.min(27, activeAllele.mutatedCodonIndex * 3 + 1)
  );

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
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              {lang === 'fa' ? activePreset.titleFa : activePreset.titleEn}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                {lang === 'fa' ? 'توضیحات علمی کاریوتایپ' : 'Karyotype Notes'}
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

      {/* Main 3D Viewport Stage (Unobstructed Center + Collapsible Bottom Dock) */}
      <div
        className={`relative rounded-2xl overflow-hidden border border-slate-300/50 dark:border-slate-800/80 bg-[#040812] ${
          isFullscreen ? 'fixed inset-3 z-50 h-auto' : 'h-[520px] sm:h-[600px]'
        }`}
      >
        {/* Unified Non-Overlapping Top HUD Bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/88 border border-slate-800 text-xs font-mono text-slate-200 shadow-lg">
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

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="pointer-events-auto px-2.5 py-1.5 rounded-xl bg-slate-950/88 border border-slate-800 text-xs font-mono text-slate-200 hover:border-sky-400 flex items-center gap-1 cursor-pointer shadow-lg"
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

        {/* Three.js Canvas */}
        <Canvas
          camera={{ position: [0, 0.3, 11.4], fov: 43 }}
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={[darkMode ? '#040812' : '#070d1c']} />
          <fog attach="fog" args={[darkMode ? '#040812' : '#070d1c', 15, 30]} />

          {/* Multi-Point Scientific Cryo-EM & Molecular Studio Lighting */}
          <ambientLight intensity={0.75} />
          <hemisphereLight args={['#38bdf8', '#091326', 0.7]} />
          <directionalLight position={[9, 13, 10]} intensity={1.6} color="#ffffff" />
          <directionalLight position={[-9, -5, 8]} intensity={0.75} color="#22d3ee" />
          <pointLight position={[4.5, 2, 4]} intensity={1.1} color="#7FD141" distance={18} />

          {/* Native Three.js Reference Floor Grid */}
          <gridHelper args={[26, 26, '#0284c7', '#162238']} position={[0, -4.35, 0]} />

          {/* 1) All 46 or 47 Chromosomes in 3D Karyotype Grid */}
          {(viewMode3D === 'karyotype-3d' || viewMode3D === 'dual-3d') &&
            karyotypeInstances.map((inst) => {
              const pos = karyotypePositions.get(inst.instanceIndex) || [0, 0, 0];
              const lociOnChrom = GENE_LOCI.filter((l) => l.chromosome === inst.chromId);
              return (
                <Chromosome3DModel
                  key={`${inst.chromId}-${inst.copyNumber}-${inst.instanceIndex}`}
                  instance={inst}
                  position={pos}
                  isSelectedChromosome={selectedChromId === inst.chromId}
                  activeLociOnChrom={lociOnChrom}
                  selectedLocusId={selectedLocusId}
                  onSelectChromosome={(cid) => setSelectedChromId(cid)}
                  onSelectLocus={(loc) => {
                    setSelectedLocusId(loc.id);
                    setSelectedAlleleIdx(0);
                  }}
                />
              );
            })}

          {/* 2) Close-Up 3D Chromosome Homologous Pair / Trisomic Triplet Inspector */}
          {viewMode3D === 'chrom-closeup' &&
            selectedChromInstances.map((inst, idx) => {
              const count = selectedChromInstances.length;
              const xPos = -2.6 + (idx - (count - 1) / 2) * 1.35;
              const lociOnChrom = GENE_LOCI.filter((l) => l.chromosome === inst.chromId);
              return (
                <Chromosome3DModel
                  key={`closeup-${inst.chromId}-${inst.copyNumber}`}
                  instance={inst}
                  position={[xPos, 0.2, 0]}
                  scale={1.85}
                  isSelectedChromosome={true}
                  activeLociOnChrom={lociOnChrom}
                  selectedLocusId={selectedLocusId}
                  onSelectChromosome={(cid) => setSelectedChromId(cid)}
                  onSelectLocus={(loc) => {
                    setSelectedLocusId(loc.id);
                    setSelectedAlleleIdx(0);
                  }}
                />
              );
            })}

          {/* 3) Uncoiling Chromatin Fiber Bridge from Selected Chromosome to B-DNA Helix */}
          {(viewMode3D === 'dual-3d' || viewMode3D === 'chrom-closeup') && (
            <ChromatinUncoilingBridge3D
              fromPos={selectedChromBridgeOrigin}
              toPos={viewMode3D === 'dual-3d' ? [5.15, 0.1, 0.2] : [2.8, 0.1, 0.2]}
            />
          )}

          {/* 4) Photorealistic 3D B-DNA Double Helix with Continuous Backbones & Major/Minor Grooves */}
          {(viewMode3D === 'helix-3d' ||
            viewMode3D === 'dual-3d' ||
            viewMode3D === 'chrom-closeup') && (
            <DNADoubleHelix3D
              sequence={activeSequence}
              mutatedIndex={mutatedBpIndex}
              geneSymbol={activeLocus.geneSymbol}
              position={
                viewMode3D === 'dual-3d'
                  ? [5.35, 0.2, 0.35]
                  : viewMode3D === 'chrom-closeup'
                  ? [3.1, 0.2, 0.2]
                  : [0, 0.2, 0]
              }
              scale={viewMode3D === 'helix-3d' ? 1.24 : 0.96}
              autoRotate={autoRotateHelix}
            />
          )}

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={3.2}
            maxDistance={21}
            maxPolarAngle={Math.PI * 0.85}
          />
        </Canvas>

        {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(980px,95vw)] flex flex-col items-center">
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
            <div className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/92 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono text-slate-200">
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
                      en: '3D B-DNA Double Helix',
                      fa: 'مارپیچ دوگانه B-DNA',
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
              <div className="flex items-center gap-3 text-[11px]">
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

              {/* Helix Spin Toggle */}
              <button
                type="button"
                onClick={() => setAutoRotateHelix((r) => !r)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] hover:border-sky-400 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-sky-400" />
                <span>
                  {autoRotateHelix
                    ? lang === 'fa'
                      ? 'چرخش مارپیچ: فعال'
                      : 'Helix Spin: On'
                    : lang === 'fa'
                    ? 'چرخش مارپیچ: متوقف'
                    : 'Helix Spin: Paused'}
                </span>
              </button>
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

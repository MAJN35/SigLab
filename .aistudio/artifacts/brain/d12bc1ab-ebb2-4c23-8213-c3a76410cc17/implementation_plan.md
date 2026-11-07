# UI Simplification & Scientific Inspector Redesign Plan

## Overview
We will redesign the **Gene & Allele Inspector** section in the 3D DNA & 47 Chromosomes Lab (`DNASimulatorPage.tsx`) and streamline the overall website UI (`index.css`, `App.tsx`, `AudioSpectrogramPage.tsx`, `DashboardPage.tsx`) so that every interactive card, control bar, and visualization is clean, scannable, and effortless to use—while keeping **100% of the scientific details, allele variants, nucleotide sequences, and DSP controls**.

---

## 1. Visual Direction & Domain Exemplars
- **Aesthetic Direction**: High-craft scientific lab interface inspired by **BioRender / Mol\* 3D Viewer** and **Linear / Desmos**—clean rectangular glass cards (`border-radius: 14px–16px`), crisp 1px structural borders, tabular monospace readouts (`JetBrains Mono`), and zero distorted circular/oval containers on multi-line content.
- **Root Cause Fix for the "Weirdo" Section**:
  - Currently in `src/index.css`, `.neu-btn` forces `border-radius: 999px` (a pill/circle border). When applied to multi-line cards like the **Allele Variant** cards, **Trait Locus** cards, and **Chromosome Grid** buttons, it warps them into awkward ovals and clips the text inside.
  - Furthermore, `truncate` and `.split(' ')[0]` cut off genotype titles (e.g., showing only `"Advanced"` instead of `"Advanced Phase Variant"` and `"Delayed Phase Vari..."`).

---

## 2. Key UI & UX Improvements

### A. Fix Distorted Oval Cards & Truncated Labels Globally (`src/index.css`)
- Introduce a dedicated `.neu-tile` / rectangular interactive surface rule (`border-radius: 14px`) and update multi-line interactive cards across all pages so `border-radius: 999px` is reserved strictly for single-line pills or icon buttons.
- Ensure all genotype names, phenotype badges, and trait titles wrap cleanly with full untruncated labels.

### B. Clean Rectangular Gene & Allele Inspector (`src/pages/DNASimulatorPage.tsx`)
- **Header & Active Phenotype Banner**:
  - Display the full **Cytogenetic Locus** (`Chr 2q37.3 · PER2 / CLOCK`), full **Trait Title**, and **Inheritance Pattern** in a structured header.
  - Replace the cramped `"Advanced"` badge with a full-width or well-proportioned rectangular **Active Phenotype & Genotype Badge** showing the color swatch, complete genotype name, and active phenotype summary without truncation.
- **Clean Rectangular Allele Variant Cards**:
  - Present the 2–3 allele variants in clean rectangular cards (`rounded-xl`) with a clear top status row (color swatch + full genotype label + `Active` / `Select` indicator), bold phenotype title, and concise mechanism description.
- **Readable 5'→3' Coding Exon Base-Pair Sequence Strip**:
  - Replace the narrow cramped vertical pills with a clean, well-spaced horizontal base-pair ladder showing base index, 5'→3' sense strand, hydrogen-bond indicator (`║` for G≡C triple bond, `│` for A=T double bond), 3'→5' complement strand, and a clear highlight badge on the mutated SNP locus (`bp #23`), plus GC Content and Codon Peak SNR badges.
- **Collapsible Scientific Details & Math Drawer**:
  - Keep the 2D Genomic Signal Processing (GSP) plots and mathematical formulation accessible via a clean collapsible section so the 3D Karyotype & B-DNA Helix stage and Gene/Allele Inspector remain uncluttered.

### C. Compact Top Control Toolbar & Collapsible Detail Drawers Across the Website (`src/pages/DNASimulatorPage.tsx`, `src/pages/AudioSpectrogramPage.tsx`, `src/App.tsx`)
- **DNA Lab Top Toolbar**:
  - Consolidate the karyotype preset selector (`46,XX`, `46,XY`, `47,XY +21`, `47,XXY`, `47,XXX`), category filter (`All`, `Appearance`, `Sensory`, `Neuro & Sleep`, `Metabolism & Blood`), and 3D view mode switcher into a single compact toolbar directly above the 3D stage.
- **Audio & Spectrogram Lab Streamlining**:
  - Group the primary source selector (Tone Generator, Upload Audio, Live Microphone), waveform picker, and Play/Stop transport into a single clean top toolbar right above the 3D/2D visual stage.
  - Place secondary synthesis tools (Multi-Click Pinned Signal Synthesizer, Frequency Range Player, and SNR / Voice Clarity Engine) into clean, clearly labeled collapsible drawers so the 3D Waterfall & 2D Spectrogram stage stays front-and-center.

---

## 3. Verification Plan
- Compile and lint the TypeScript codebase (`compile_applet` + `lint_applet`) with zero errors.
- Verify both English (`LTR`) and Persian (`RTL`) layouts, light and dark themes, and responsive behavior across desktop and mobile viewports.

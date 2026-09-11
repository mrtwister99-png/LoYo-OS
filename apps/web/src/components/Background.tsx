import React from 'react';

type Props = {
  colors?: string[];
  bgColor?: string;
  opacity?: number;
  biosMode?: boolean;
}

/**
 * LOYO OS - BACKGROUND
 * - biosMode = false = čistá černá #000000 (teď)
 * - biosMode = true = TRUE BIOS modrá #1000a1 (po kliku na L)
 * 
 * Původní Matrix smazán, ponecháno jen černá / modrá
 * Soubor můžeš mít jako Background.tsx nebo MatrixBackground.tsx - oba fungují
 */

export default function Background({ biosMode = false }: Props) {
  if (biosMode) {
    // TRUE BIOS BARVY - jako na screenshotu co jsi poslal
    return (
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          width: '100vw', 
          height: '100vh', 
          backgroundColor: '#1000a1',
          overflow: 'hidden', 
          pointerEvents: 'none',
          zIndex: -1
        }} 
      />
    );
  }
  
  // NORMAL MODE - #cccccc aby seděl s header/bottom
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', backgroundColor: '#cccccc', overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }} />
  );
}

// Pro zpětnou kompatibilitu - když někde importuješ MatrixBackground
export function MatrixBackground({ biosMode = false }: Props) {
  return <Background biosMode={biosMode} />;
}

export function BackgroundBlack() {
  return <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', backgroundColor: '#000000', overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }} />;
}

export function BackgroundBios() {
  return <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', backgroundColor: '#1000a1', overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }} />;
}

// BIOS barvy export - pro použití všude
export const BIOS_COLORS = {
  blue: '#1000a1',
  gray: '#7a7a7a',
  grayLight: '#a0a0a0',
  grayLighter: '#c0c0c0',
  red: '#ae1710',
  yellow: '#ffff00',
  yellowInfo: '#c3ff00',
  white: '#ffffff',
  black: '#000000',
} as const

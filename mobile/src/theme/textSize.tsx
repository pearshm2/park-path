/**
 * The in-app text size: Default, Large or Larger, chosen in Settings.
 *
 * This sits on top of the phone's own text-size setting, which React
 * Native already applies to every Text; it is for people who want bigger
 * text in ParkPath without changing their whole phone. It's a device
 * preference, not an account one, so it's stored once per device.
 *
 * Every text component reads `useTextScale()` and multiplies its font
 * size (and line height and tracking) by it. BodyText and Heading do it
 * for most of the app; components that style their own Text use
 * `scaleType` on their text style.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TextStyle } from 'react-native';

import { getItem, setItem } from '../lib/storage';

export type TextSize = 'default' | 'large' | 'larger';

export const TEXT_SIZES: { value: TextSize; label: string; scale: number }[] = [
  { value: 'default', label: 'Default', scale: 1 },
  { value: 'large', label: 'Large', scale: 1.15 },
  { value: 'larger', label: 'Larger', scale: 1.3 },
];

const KEY = 'parkpath.textSize';

type TextSizeValue = {
  size: TextSize;
  scale: number;
  setSize: (size: TextSize) => void;
};

const TextSizeContext = createContext<TextSizeValue>({
  size: 'default',
  scale: 1,
  setSize: () => {},
});

function scaleOf(size: TextSize): number {
  return TEXT_SIZES.find((option) => option.value === size)?.scale ?? 1;
}

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [size, setSizeState] = useState<TextSize>('default');

  useEffect(() => {
    getItem(KEY).then((stored) => {
      if (TEXT_SIZES.some((option) => option.value === stored)) {
        setSizeState(stored as TextSize);
      }
    });
  }, []);

  const setSize = useCallback((next: TextSize) => {
    setSizeState(next);
    setItem(KEY, next);
  }, []);

  const value = useMemo(() => ({ size, scale: scaleOf(size), setSize }), [size, setSize]);
  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

export function useTextSize(): TextSizeValue {
  return useContext(TextSizeContext);
}

/** The multiplier for font sizes: 1, 1.15 or 1.3. */
export function useTextScale(): number {
  return useContext(TextSizeContext).scale;
}

/**
 * The size-related parts of a text style, multiplied by `scale`. Put it
 * after the original style: `style={[styles.label, scaleType(styles.label, scale)]}`.
 */
export function scaleType(style: TextStyle, scale: number): TextStyle | undefined {
  if (scale === 1) return undefined;
  return {
    ...(style.fontSize !== undefined && { fontSize: style.fontSize * scale }),
    ...(typeof style.lineHeight === 'number' && { lineHeight: style.lineHeight * scale }),
    ...(style.letterSpacing !== undefined && { letterSpacing: style.letterSpacing * scale }),
  };
}

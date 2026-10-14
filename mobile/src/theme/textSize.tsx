/**
 * The in-app text size: Small, Medium or Large, chosen in Settings. Large
 * is the default (it reads best across the app); Small and Medium are
 * there for anyone who wants more on screen.
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

// The stored values predate the labels: 'default' was the smallest size
// before Large became the default. They're kept so saved choices still work.
export const TEXT_SIZES: { value: TextSize; label: string; scale: number }[] = [
  { value: 'default', label: 'Small', scale: 1 },
  { value: 'large', label: 'Medium', scale: 1.15 },
  { value: 'larger', label: 'Large', scale: 1.3 },
];

/** What's used until someone picks a size. */
const DEFAULT_SIZE: TextSize = 'larger';

const KEY = 'parkpath.textSize';

type TextSizeValue = {
  size: TextSize;
  scale: number;
  setSize: (size: TextSize) => void;
};

const TextSizeContext = createContext<TextSizeValue>({
  size: DEFAULT_SIZE,
  scale: 1.3,
  setSize: () => {},
});

function scaleOf(size: TextSize): number {
  return TEXT_SIZES.find((option) => option.value === size)?.scale ?? 1;
}

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [size, setSizeState] = useState<TextSize>(DEFAULT_SIZE);

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

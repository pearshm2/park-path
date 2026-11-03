/**
 * How far a bottom sheet in a full-screen Modal must rise to clear the
 * keyboard on Android. Android used to shrink the window for the keyboard,
 * but with the app drawn edge to edge (behind the status bar) a Modal's
 * window often isn't shrunk, and the keyboard covers the sheet. This
 * measures instead: the keyboard's top edge on screen against the bottom
 * of the Modal's full-screen view, so it's right whether or not the
 * window shrank (then the overlap is about 0).
 *
 * Put `onLayout` on the Modal's full-screen view and pad its bottom by
 * `lift`. iOS keeps using KeyboardAvoidingView, so `lift` is 0 there.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform, type LayoutChangeEvent } from 'react-native';

export function useKeyboardLift(): { lift: number; onLayout: (event: LayoutChangeEvent) => void } {
  const [height, setHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardTop(event.endCoordinates.screenY),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const lift = keyboardTop === null || height === 0 ? 0 : Math.max(0, height - keyboardTop);
  return { lift, onLayout: (event) => setHeight(event.nativeEvent.layout.height) };
}

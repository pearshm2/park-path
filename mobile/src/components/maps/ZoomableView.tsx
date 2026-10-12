/**
 * Pinch to zoom, drag to pan, double-tap to zoom in (or back out) — for a
 * park's brochure map, which is bigger than the screen can show at once.
 *
 * The content is laid out at its own, larger size (contentWidth x
 * contentHeight) and starts scaled down to fit the frame. Zooming in only
 * ever scales it back up towards its real size, so the map stays sharp
 * instead of turning into stretched pixels.
 *
 * Runs on the UI thread (Reanimated), so it stays smooth on a large image.
 * A one-finger drag only pans once zoomed in; at the fitted size it's left
 * alone so the page around the map can still scroll.
 *
 * `focus` zooms to a spot in the content (a visitor center's label): set it
 * and the view glides there, with some of the map around it in view.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** How far a double tap zooms in, from the fitted size. */
const DOUBLE_TAP_ZOOM = 2.5;

export function ZoomableView({
  width,
  height,
  contentWidth,
  contentHeight,
  maxZoom,
  focus,
  children,
}: {
  /** The frame on screen. */
  width: number;
  height: number;
  /** The content's own size, which it is drawn at. */
  contentWidth: number;
  contentHeight: number;
  /** Most zoom from the fitted size; defaults to the content's real size. */
  maxZoom?: number;
  /** A box in content pixels to zoom to; changing it moves the view again. */
  focus?: { x: number; y: number; width: number; height: number } | null;
  children: ReactNode;
}) {
  // Scale that fits the content in the frame, and the most it can grow to.
  const fit = Math.min(width / contentWidth, height / contentHeight);
  const max = fit * (maxZoom ?? Math.max(1, 1 / fit));

  const scale = useSharedValue(fit);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: fit, tx: 0, ty: 0 });

  // Keep the content over the frame: it can move by at most half of
  // however much bigger than the frame it currently is.
  const clamp = (value: number, s: number, content: number, frame: number) => {
    'worklet';
    const limit = Math.max(0, (content * s - frame) / 2);
    return Math.min(limit, Math.max(-limit, value));
  };

  // Zoom so the point under (focalX, focalY) stays put. Offsets are from
  // the frame's centre, which is where the content is centred and scaled.
  const zoomAround = (
    next: number,
    focalX: number,
    focalY: number,
    from: { scale: number; tx: number; ty: number },
  ) => {
    'worklet';
    const s = Math.min(max, Math.max(fit, next));
    const fx = focalX - width / 2;
    const fy = focalY - height / 2;
    const k = s / from.scale;
    return {
      s,
      x: clamp(fx - (fx - from.tx) * k, s, contentWidth, width),
      y: clamp(fy - (fy - from.ty) * k, s, contentHeight, height),
    };
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { scale: scale.value, tx: tx.value, ty: ty.value };
    })
    .onUpdate((event) => {
      const next = zoomAround(start.value.scale * event.scale, event.focalX, event.focalY, start.value);
      scale.value = next.s;
      tx.value = next.x;
      ty.value = next.y;
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesMove((_event, manager) => {
      // Only claim the drag when zoomed in; otherwise the page scrolls.
      if (scale.value > fit * 1.01) manager.activate();
      else manager.fail();
    })
    .onStart(() => {
      start.value = { scale: scale.value, tx: tx.value, ty: ty.value };
    })
    .onUpdate((event) => {
      tx.value = clamp(start.value.tx + event.translationX, scale.value, contentWidth, width);
      ty.value = clamp(start.value.ty + event.translationY, scale.value, contentHeight, height);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > fit * 1.01) {
        scale.value = withTiming(fit);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        return;
      }
      const from = { scale: scale.value, tx: tx.value, ty: ty.value };
      const next = zoomAround(fit * DOUBLE_TAP_ZOOM, event.x, event.y, from);
      scale.value = withTiming(next.s);
      tx.value = withTiming(next.x);
      ty.value = withTiming(next.y);
    });

  // Zoom to the focus box: close enough to read it, with its surroundings
  // in view (about twice its width across the frame), centred.
  useEffect(() => {
    if (!focus) return;
    const s = Math.min(
      max,
      Math.max(fit * 2, Math.min(width / (focus.width * 2.2), height / (focus.height * 8))),
    );
    const dx = focus.x + focus.width / 2 - contentWidth / 2;
    const dy = focus.y + focus.height / 2 - contentHeight / 2;
    scale.value = withTiming(s, { duration: 450 });
    tx.value = withTiming(clamp(-dx * s, s, contentWidth, width), { duration: 450 });
    ty.value = withTiming(clamp(-dy * s, s, contentHeight, height), { duration: 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values and helpers are stable
  }, [focus, width, height, contentWidth, contentHeight, fit, max]);

  const transform = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      {/* The detector sits on this fixed frame, so gesture coordinates are
          the frame's, not the moving content's. */}
      <View style={[styles.frame, { width, height }]} collapsable={false}>
        <Animated.View
          style={[
            styles.content,
            {
              width: contentWidth,
              height: contentHeight,
              left: (width - contentWidth) / 2,
              top: (height - contentHeight) / 2,
            },
            transform,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
  },
});

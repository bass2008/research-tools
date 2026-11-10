import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/** A short, native fade for a newly presented result; honours the system motion setting. */
export function Entrance({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      if (enabled) { animation?.stop(); opacity.setValue(1); }
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (!active || enabled) return;
      opacity.setValue(0);
      animation = Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true, isInteraction: false });
      animation.start();
    }).catch(() => { /* A missing accessibility response never hides the content. */ });
    return () => { active = false; animation?.stop(); reduce.remove(); };
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

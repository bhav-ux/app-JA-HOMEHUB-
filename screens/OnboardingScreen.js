import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ONBOARDING_KEY = '@ja_homehub_onboarding_complete';

export async function markOnboardingComplete() {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch { /* ignore */ }
}

const { width: SW, height: SH } = Dimensions.get('window');

// Cap content width for tablets / wide web views
const CONTENT_WIDTH = Math.min(SW, 520);

const SLIDES = [
  {
    key: 'welcome',
    bg:     '#08101F',
    accent: '#7B96FF',
    icon:   'home',
    title:  'Welcome to\nHomeHub',
    body: "One place for your family's events, chats, albums, and plans.",
  },
  {
    key: 'connected',
    bg:     '#021525',
    accent: '#38BDF8',
    icon:   'chatbubbles',
    title:  'Stay Connected',
    body:   'Keep everyone in sync with family chats, groups, and real-time updates.',
  },
  {
    key: 'plan',
    bg:     '#021A0E',
    accent: '#34D399',
    icon:   'calendar',
    title:  'Plan Together',
    body:   'Manage events, reminders, and family schedules in one shared space.',
  },
  {
    key: 'memories',
    bg:     '#1A0F01',
    accent: '#FBBF24',
    icon:   'images',
    title:  'Share Memories',
    body:   "Create albums and keep your family's most precious moments organized.",
  },
  {
    key: 'setup',
    bg:     '#08101F',
    accent: '#7B96FF',
    icon:   'people',
    title:  "Let's Set Up\nYour Family",
    body:   'Create a new family group or join an existing one to get started.',
  },
];

const TOTAL = SLIDES.length;

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex]   = useState(0);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const slide  = SLIDES[index];
  const isLast = index === TOTAL - 1;

  // Crossfade + spring-in between slides
  const goTo = useCallback((nextIndex) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.93,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIndex(nextIndex);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 110,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, scaleAnim]);

  const handleNext = useCallback(() => {
    if (index < TOTAL - 1) goTo(index + 1);
  }, [index, goTo]);

  // Skip always goes to the final setup slide
  const handleSkip = useCallback(() => goTo(TOTAL - 1), [goTo]);

  const complete = useCallback(async (dest) => {
    await markOnboardingComplete();
    const root = navigation.getParent?.() || navigation;
    root.replace(dest);
  }, [navigation]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: slide.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* Onboarding always uses a dark backdrop, so force light status bar icons */}
      <StatusBar style="light" />

      {/* ── Skip button (hidden on final slide) ── */}
      {!isLast && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 12 }]}
          onPress={handleSkip}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* ── Illustration area ── */}
      <Animated.View
        style={[
          styles.illustration,
          { backgroundColor: slide.bg, opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
        pointerEvents="none"
      >
        {/* Ambient color blobs */}
        <View style={[styles.blob, styles.blobTR, { backgroundColor: slide.accent }]} />
        <View style={[styles.blob, styles.blobBL, { backgroundColor: slide.accent }]} />

        {/* Concentric rings */}
        <View style={[styles.ring, styles.ringOuter,  { borderColor: `${slide.accent}14` }]} />
        <View style={[styles.ring, styles.ringMiddle, { borderColor: `${slide.accent}28` }]} />
        <View style={[styles.ring, styles.ringInner,  { borderColor: `${slide.accent}50` }]} />

        {/* Icon card */}
        <View style={[styles.iconCard, { backgroundColor: `${slide.accent}16` }]}>
          <Ionicons name={slide.icon} size={70} color={slide.accent} />
        </View>

        {/* Floating accent dots */}
        <View style={[styles.floatDot, styles.dot1, { backgroundColor: slide.accent }]} />
        <View style={[styles.floatDot, styles.dot2, { backgroundColor: slide.accent }]} />
        <View style={[styles.floatDot, styles.dot3, { backgroundColor: slide.accent }]} />
      </Animated.View>

      {/* ── Bottom sheet card ── */}
      <Animated.View
        style={[styles.card, { opacity: fadeAnim }]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.cardInner,
            { paddingBottom: Math.max(insets.bottom, 24) + (Platform.OS === 'web' ? 8 : 0) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Slide counter label */}
          <Text style={[styles.slideLabel, { color: slide.accent }]}>
            {index + 1} of {TOTAL}
          </Text>

          {/* Title */}
          <Text style={styles.title}>{slide.title}</Text>

          {/* Subtitle */}
          <Text style={styles.body}>{slide.body}</Text>

          {/* Pagination dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => !isLast && goTo(i)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <View
                  style={[
                    styles.dot,
                    i === index
                      ? [styles.dotActive, { backgroundColor: slide.accent }]
                      : styles.dotInactive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* CTAs */}
          {isLast ? (
            <View style={styles.finalBtns}>
              {/* Create Family */}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: slide.accent }]}
                onPress={() => complete('Signup')}
                activeOpacity={0.83}
              >
                <View style={styles.btnContent}>
                  <View style={[styles.btnIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </View>
                  <View style={styles.btnTextGroup}>
                    <Text style={styles.primaryBtnLabel}>Create Family</Text>
                    <Text style={styles.primaryBtnSub}>Start a new family group</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                </View>
              </TouchableOpacity>

              {/* Join Family */}
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: slide.accent }]}
                onPress={() => complete('Login')}
                activeOpacity={0.83}
              >
                <View style={styles.btnContent}>
                  <View style={[styles.btnIconBox, { backgroundColor: `${slide.accent}18` }]}>
                    <Ionicons name="enter-outline" size={18} color={slide.accent} />
                  </View>
                  <View style={styles.btnTextGroup}>
                    <Text style={[styles.secondaryBtnLabel, { color: slide.accent }]}>Join Family</Text>
                    <Text style={styles.secondaryBtnSub}>Use an existing invite code</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={`${slide.accent}70`} />
                </View>
              </TouchableOpacity>

              <Text style={styles.finalNote}>
                You can also sign in if you already have an account.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: slide.accent }]}
              onPress={handleNext}
              activeOpacity={0.83}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RING_OUTER  = 288;
const RING_MIDDLE = 216;
const RING_INNER  = 152;
const ICON_CARD   = 120;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── Skip ──
  skipBtn: {
    position: 'absolute',
    right: 22,
    zIndex: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // ── Illustration area ──
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Ambient blobs
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.07,
  },
  blobTR: {
    width: SW * 0.75,
    height: SW * 0.75,
    top: -(SW * 0.18),
    right: -(SW * 0.18),
  },
  blobBL: {
    width: SW * 0.55,
    height: SW * 0.55,
    bottom: -(SW * 0.12),
    left: -(SW * 0.12),
  },

  // Concentric rings
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
  },
  ringOuter:  { width: RING_OUTER,  height: RING_OUTER  },
  ringMiddle: { width: RING_MIDDLE, height: RING_MIDDLE },
  ringInner:  { width: RING_INNER,  height: RING_INNER  },

  // Icon card
  iconCard: {
    width: ICON_CARD,
    height: ICON_CARD,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating dots
  floatDot: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.35,
  },
  dot1: { width: 8, height: 8, top: '22%', left: '18%' },
  dot2: { width: 5, height: 5, top: '35%', right: '16%' },
  dot3: { width: 10, height: 10, bottom: '26%', right: '22%' },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // Prevent card from being too tall on large screens
    maxHeight: SH * 0.55,
  },
  cardInner: {
    paddingHorizontal: 28,
    paddingTop: 28,
  },

  slideLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    opacity: 0.7,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
    lineHeight: 37,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 23,
    marginBottom: 22,
  },

  // ── Pagination dots ──
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 22,
  },
  dot: { borderRadius: 9999 },
  dotActive:   { width: 24, height: 7 },
  dotInactive: { width: 7,  height: 7, backgroundColor: '#E2E8F0' },

  // ── Continue button ──
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 54,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Final slide buttons ──
  finalBtns: {
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1.5,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnTextGroup: {
    flex: 1,
  },
  primaryBtnLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  primaryBtnSub: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 1,
  },
  secondaryBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryBtnSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1,
  },
  finalNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
});

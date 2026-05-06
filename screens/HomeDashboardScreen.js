import { useEffect, useRef } from 'react';
import { Alert, Animated, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import AnimatedCard from '../src/components/AnimatedCard';

export default function HomeDashboardScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const cards = [
    { key: 'Events', title: 'Events', description: 'See upcoming family plans', icon: 'list-outline' },
    { key: 'Calendar', title: 'Calendar', description: 'View family schedule', icon: 'calendar-outline' },
    { key: 'Chat', title: 'Chat', description: 'Stay in touch with family', icon: 'chatbubbles-outline' },
    { key: 'Albums', title: 'Albums', description: 'Share memories together', icon: 'images-outline' },
  ];

  const handleNavigate = (target) => {
    if (target === 'Albums' && !familyId) {
      Alert.alert('Family not set', 'Join or create a family to view albums.');
      return;
    }
    navigation.navigate(target, target === 'Albums' ? { familyId } : undefined);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Welcome Home</Text>
        <Text style={styles.subtitle}>Quick access to your family spaces</Text>
        <View style={styles.grid}>
          {cards.map((card) => (
            <AnimatedCard
              key={card.key}
              style={styles.card}
              onPress={() => handleNavigate(card.key)}
              accessibilityLabel={`Navigate to ${card.title}`}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
                <Ionicons name={card.icon} size={28} color={theme.primary} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </AnimatedCard>
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      backgroundColor: theme.background,
    },
    title: {
      ...typography.title,
      color: theme.text,
    },
    subtitle: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      fontSize: typography.body.fontSize + 1,
      color: theme.secondaryText,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    card: {
      width: '48%',
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    cardTitle: {
      ...typography.heading,
      color: theme.text,
    },
    cardDesc: {
      marginTop: spacing.sm,
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
    },
  })
);

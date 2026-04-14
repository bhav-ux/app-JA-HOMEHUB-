import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

const cards = [
  {
    key: 'Events',
    title: 'Events',
    description: 'See upcoming family plans',
    icon: 'list-outline',
    color: colors.primary,
  },
  {
    key: 'Calendar',
    title: 'Calendar',
    description: 'View family schedule',
    icon: 'calendar-outline',
    color: colors.primary,
  },
  {
    key: 'Chat',
    title: 'Chat',
    description: 'Stay in touch with family',
    icon: 'chatbubbles-outline',
    color: colors.primary,
  },
  {
    key: 'Albums',
    title: 'Albums',
    description: 'Share memories together',
    icon: 'images-outline',
    color: colors.primary,
  },
];

export default function HomeDashboardScreen({ navigation, route, familyId: familyIdProp }) {
  const familyId = familyIdProp ?? route?.params?.familyId;

  const handleNavigate = (target) => {
    const destination = target === 'Albums' ? 'Albums' : target;
    if (destination === 'Albums' && !familyId) {
      Alert.alert('Family not set', 'Join or create a family to view albums.');
      return;
    }
    navigation.navigate(destination, destination === 'Albums' ? { familyId } : undefined);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome Home</Text>
        <Text style={styles.subtitle}>Quick access to your family spaces</Text>
        <View style={styles.grid}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.key}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => handleNavigate(card.key)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${card.color}15` }]}>
                <Ionicons name={card.icon} size={28} color={card.color} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    color: colors.textPrimary,
  },
  cardDesc: {
    marginTop: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
});

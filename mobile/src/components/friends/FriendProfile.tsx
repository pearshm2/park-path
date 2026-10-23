/**
 * A friend's passport, opened from the Friends row or a post in the feed:
 * how many national parks they've stamped, their wax seals, the regions
 * they've completed, and the achievements they've earned. All from
 * GET /passport/{id}, so it counts only the trips they shared with friends.
 */

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { displayName, handle, type Person } from '../../api/friends';
import { fetchFriendPassport } from '../../api/passport';
import { useAuth } from '../../auth/AuthContext';
import type { Site } from '../../data/parks';
import { colors, radius, shadow, space } from '../../theme';
import { monthLabel } from '../../trips/TripsContext';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { WaxSeal } from '../passport/WaxSeal';
import { ProgressBar } from '../ProgressBar';
import { BodyText, Heading } from '../Typography';

export function FriendProfile({
  person,
  since,
  sites,
  onRemove,
  onClose,
}: {
  person: Person;
  /** When you became friends, e.g. "Oct 2026". */
  since: string | null;
  sites: Map<string, Site>;
  /** Unfriend (asks first); not offered without it. */
  onRemove?: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const passport = useQuery({
    queryKey: ['passport', person.id],
    queryFn: () => fetchFriendPassport(token!, person.id),
    enabled: !!token,
  });
  const data = passport.data;
  const stamps = (data?.stamps ?? [])
    .filter((s) => s.earned)
    .sort((a, b) => (b.last_visited_on ?? '').localeCompare(a.last_visited_on ?? ''));
  const regions = (data?.regions ?? []).filter((r) => r.complete);
  const earned = (data?.achievements ?? []).filter((a) => a.earned);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space[2], paddingBottom: insets.bottom + space[6] }]}>
          <View style={styles.top}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[800]} strokeWidth={2.6} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          <View style={styles.who}>
            <Avatar person={person} size={72} ring />
            <Heading size={26} style={styles.name}>
              {displayName(person)}
            </Heading>
            <BodyText size={13.5} weight="semibold" color={colors.accentRamp[700]}>
              {[handle(person), since ? `friends since ${since}` : null].filter(Boolean).join(' · ')}
            </BodyText>
          </View>

          {passport.isPending ? (
            <BodyText size={13} color={colors.neutral[600]} style={styles.centered}>
              Opening their passport…
            </BodyText>
          ) : passport.isError || !data ? (
            <BodyText size={13} color={colors.accentRamp[800]} style={styles.centered}>
              Couldn&apos;t load their passport. Check your connection and try again.
            </BodyText>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.statRow}>
                  <Heading size={34}>{String(data.parks_visited)}</Heading>
                  <BodyText size={13} weight="semibold" color={colors.neutral[700]} style={styles.statText}>
                    {`of ${data.parks_total} national parks stamped`}
                  </BodyText>
                </View>
                <ProgressBar progress={data.parks_total ? data.parks_visited / data.parks_total : 0} />
              </View>

              <Section title="Stamps" meta={`${stamps.length}`}>
                {stamps.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seals}>
                    {stamps.map((s) => (
                      <WaxSeal
                        key={s.park_code}
                        code={s.park_code}
                        group={sites.get(s.park_code)?.group ?? null}
                        name={sites.get(s.park_code)?.name ?? s.name}
                        date={s.first_visited_on ? monthLabel(s.first_visited_on).toUpperCase() : ''}
                        size={112}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <BodyText size={13} color={colors.neutral[600]}>
                    No national parks shared with friends yet.
                  </BodyText>
                )}
              </Section>

              {regions.length > 0 ? (
                <Section title="Regions complete" meta={`${regions.length} of ${data.regions.length}`}>
                  <View style={styles.chips}>
                    {regions.map((r) => (
                      <View key={r.id} style={styles.chip}>
                        <BodyText size={12} weight="bold" color={colors.accent2Ramp[800]}>
                          {`✓ ${r.label}`}
                        </BodyText>
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}

              <Section title="Achievements" meta={`${earned.length} of ${data.achievements.length} earned`}>
                {earned.length > 0 ? (
                  <View style={styles.list}>
                    {earned.map((a) => (
                      <View key={a.id} style={styles.achievement}>
                        <View style={styles.badge}>
                          <Svg width={16} height={16} viewBox="0 0 24 24">
                            <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill={colors.accentRamp[600]} />
                          </Svg>
                        </View>
                        <View style={styles.grow}>
                          <BodyText size={14} weight="bold">
                            {a.title}
                          </BodyText>
                          <BodyText size={12} color={colors.neutral[600]}>
                            {a.description}
                          </BodyText>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <BodyText size={13} color={colors.neutral[600]}>
                    None earned yet.
                  </BodyText>
                )}
              </Section>
            </>
          )}

          {onRemove ? (
            <Button label="Remove friend" variant="ghost" onPress={onRemove} style={styles.remove} />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.kicker}>
          {title.toUpperCase()}
        </BodyText>
        <BodyText size={12} weight="bold" color={colors.accentRamp[700]}>
          {meta}
        </BodyText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space[4],
    gap: space[4],
  },
  top: {
    alignItems: 'flex-end',
  },
  close: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  who: {
    alignItems: 'center',
    gap: space[1],
  },
  centered: {
    textAlign: 'center',
  },
  // Full width and without the heading's tightened spacing, which Android
  // measures short and clips.
  name: {
    alignSelf: 'stretch',
    textAlign: 'center',
    letterSpacing: 0,
  },
  card: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  statText: {
    flex: 1,
  },
  section: {
    gap: space[2],
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kicker: {
    letterSpacing: 1,
  },
  seals: {
    gap: space[2],
    paddingVertical: space[1],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.accent2Ramp[100],
  },
  list: {
    gap: space[2],
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  badge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accentRamp[100],
  },
  grow: {
    flex: 1,
  },
  remove: {
    alignSelf: 'center',
    marginTop: space[2],
  },
});

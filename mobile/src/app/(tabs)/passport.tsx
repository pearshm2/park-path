import { ComingSoon } from '../../components/ComingSoon';

export default function PassportScreen() {
  return (
    <ComingSoon
      kicker="Week 3"
      title="Passport"
      description="A stamp for each of the 63 named parks, grouped by region, with achievements alongside. Tapping a stamp reopens the trip that earned it."
      blockedOn="Depends on Trips, since a stamp is earned by logging a visit."
    />
  );
}

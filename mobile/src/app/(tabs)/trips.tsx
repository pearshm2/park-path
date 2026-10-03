import { ComingSoon } from '../../components/ComingSoon';

export default function TripsScreen() {
  return (
    <ComingSoon
      kicker="Week 3"
      title="Trips"
      description="A journal of where you have been: photos, notes, who you were with, and the park each entry belongs to. Entries feed back into your recommendations, which is the memory-logging half of the project."
      blockedOn="Needs a /trips endpoint and media upload before it can be built for real."
    />
  );
}

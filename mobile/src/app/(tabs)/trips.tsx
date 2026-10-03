import { ComingSoon } from '../../components/ComingSoon';

export default function TripsScreen() {
  return (
    <ComingSoon
      kicker="Week 6"
      title="Trips"
      description="A journal of where you have been: photos, notes, who you were with, and the park each entry belongs to. Entries feed back into your recommendations, which is the memory-logging half of the project."
      blockedOn="Waiting on the trips backend and S3 upload flow (Sebastian, week 5)."
    />
  );
}

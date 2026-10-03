import { ComingSoon } from '../../components/ComingSoon';

export default function FriendsScreen() {
  return (
    <ComingSoon
      kicker="Week 6"
      title="Friends"
      description="The people you follow, what they have logged recently, and reactions and comments on their entries. Friends' visits are also one of the collaborative-filtering signals behind your feed."
      blockedOn="Waiting on the friendships backend — requests, accept, visibility rules (Sebastian, week 3)."
    />
  );
}

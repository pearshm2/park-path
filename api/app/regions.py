"""
The ten passport regions: which states fall in each. Mirrors
mobile/src/data/regions.ts (the map's regions), keyed by postal code
because that's what `sites.states` holds ("TN,NC"). A site belongs to the
region of the first state it lists, as on the map. Territories have none.
"""

REGIONS: list[tuple[str, str, list[str]]] = [
    ("pnw", "Pacific Northwest", ["WA", "OR", "ID"]),
    ("california", "California & Sierra", ["CA", "NV"]),
    ("southwest", "Southwest desert", ["AZ", "NM", "UT"]),
    ("rockies", "Rocky Mountains", ["MT", "WY", "CO"]),
    ("plains", "Great Plains", ["ND", "SD", "NE", "KS", "OK", "TX"]),
    ("midwest", "Great Lakes & Midwest", ["MN", "WI", "MI", "IA", "IL", "IN", "OH", "MO"]),
    ("northeast", "Northeast", ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"]),
    ("appalachia", "Appalachia & Mid-Atlantic", ["WV", "VA", "KY", "TN", "NC", "MD", "DE", "DC"]),
    ("gulf", "Gulf & Deep South", ["AR", "LA", "MS", "AL", "GA", "FL", "SC"]),
    ("akhi", "Alaska & Hawaii", ["AK", "HI"]),
]

REGION_LABELS: dict[str, str] = {region_id: label for region_id, label, _ in REGIONS}
_STATE_REGION: dict[str, str] = {
    state: region_id for region_id, _, states in REGIONS for state in states
}


def region_for_states(states: str | None) -> str | None:
    """Region id for a site's `states` ("WY,MT,ID" counts as Wyoming), or None."""
    if not states:
        return None
    first = states.replace("/", ",").split(",")[0].strip().upper()
    return _STATE_REGION.get(first)

"""
Seeds the demo accounts on the ParkPath API: Halie's account and trips,
and three made-up friends with trips, friendships and comments. See
docs/demo-accounts.md for who's who. Run from park-path/api with the
virtual environment active:

    python seed_demo.py HALIE-PASSWORD [MEDIA-FOLDER]

HALIE-PASSWORD is pears.hm2@gmail.com's password (ask Halie); her account
is created with it if it doesn't exist yet. MEDIA-FOLDER holds the photos
and videos for her trips, named as in HALIE_TRIPS below; without it her
trips are skipped. Photos are re-saved without their location and camera
data before upload; strip videos first (see docs/demo-accounts.md).

Safe to run again: accounts, friendships, trips and comments that already
exist are left alone. Set PARKPATH_API to seed another server, such as a
local one (http://localhost:8000).
"""

import base64
import io
import os
import sys
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont, ImageOps

API = os.environ.get("PARKPATH_API", "https://parkpath-api.onrender.com")
FRIEND_PASSWORD = "password123"

HALIE = dict(
    email="pears.hm2@gmail.com", username="pears.hm2", first_name="Pears", last_name="Hm"
)
FRIENDS = {
    "maya": dict(
        email="maya.torres.demo@example.com",
        username="mayatorres",
        first_name="Maya",
        last_name="Torres",
        color=(196, 98, 45),
    ),
    "jordan": dict(
        email="jordan.lee.demo@example.com",
        username="jordanlee",
        first_name="Jordan",
        last_name="Lee",
        color=(31, 92, 74),
    ),
    "sam": dict(
        email="sam.okafor.demo@example.com",
        username="samokafor",
        first_name="Sam",
        last_name="Okafor",
        color=(42, 62, 110),
    ),
}

# Halie's trips, from her own photos: the files in MEDIA-FOLDER, in order,
# with their captions. Videos carry their length in ms.
HALIE_TRIPS = [
    dict(
        park_code="jotr",
        visited_on="2024-08-10",
        rating=5,
        title="101° in the desert",
        notes="Started at the Joshua Tree visitor center, then drove through to the Oasis of "
        "Mara in Twentynine Palms. It was 101° by early afternoon, so we stuck to short "
        "walks: the cactus garden, barrel cactus and the big fan palms at the oasis.",
        trails=["Oasis of Mara"],
        media=[
            ("IMG_4414.jpg", "The Joshua Tree visitor center"),
            ("IMG_4419.jpg", "Cactus garden out front"),
            ("IMG_4402.jpg", "Cholla in bloom"),
            ("IMG_4432.jpg", "Barrel cactus"),
            ("IMG_4439.jpg", "Fan palm against the mountains"),
            ("IMG_4461.jpg", "Oasis of Mara"),
            ("IMG_4465.mp4", "Driving past the Joshua trees", 42112),
            ("IMG_4463.png", "For the record: 101°"),
        ],
    ),
    dict(
        park_code="cong",
        visited_on="2026-01-02",
        rating=3,
        title="Cypress knees and still water",
        notes="Winter walk through the old-growth floodplain. The cypress knees were "
        "everywhere, and the water was so still it mirrored the whole forest.",
        trails=["Boardwalk Loop"],
        media=[
            ("IMG_0344.jpg", "Us by the water"),
            ("IMG_0264.jpg", "Found a stump"),
            ("IMG_0281.jpg", "On the fallen tree"),
            ("IMG_0307.jpg", "Cypress knees everywhere"),
            ("IMG_0316.jpg", "Hiding among the knees"),
            ("IMG_0322.jpg", "Up close with a cypress knee"),
            ("IMG_0365.jpg", "Still water"),
            ("IMG_0297.mp4", "On the trail", 12105),
        ],
    ),
    dict(
        park_code="guco",
        visited_on="2026-10-24",
        rating=3,
        title="Revolutionary War, in fall colors",
        notes="The museum's uniforms and artifacts, including cannonballs found on the "
        "battlefield, then the tour road under the fall leaves past the monuments and "
        "General Greene's statue.",
        trails=["Battlefield Tour Road", "Greene Monument"],
        media=[
            ("IMG_3100.jpg", "Guilford Courthouse National Military Park"),
            ("IMG_3110.jpg", "Uniforms in the museum"),
            ("IMG_3117.jpg", "Cannonballs found on the battlefield"),
            ("IMG_3124.jpg", "The tour road in fall"),
            ("IMG_3130.jpg", "Looking up at the monument"),
            ("IMG_3141.jpg", "The obelisk"),
            ("IMG_3167.jpg", "General Greene's monument"),
            ("IMG_3157.jpg", "Chicken of the woods on the way out"),
        ],
    ),
]

# The friends' trips (no photos): park, date, rating, title, notes, trails,
# and which friends were along.
FRIEND_TRIPS = {
    "maya": [
        ("arch", "2024-04-12", 5, "Delicate Arch at sunset",
         "Worth every switchback. Stayed until the arch went orange.",
         ["Delicate Arch Trail"], []),
        ("cany", "2024-04-14", 4, "Mesa Arch sunrise",
         "Alarm at 5am, no regrets. The canyon glows under the arch.",
         ["Mesa Arch Trail"], []),
        ("care", "2024-04-16", 4, "Orchards and petroglyphs",
         "Fresh pie in Fruita, then Hickman Bridge.", ["Hickman Bridge Trail"], []),
        ("brca", "2024-05-20", 5, "Down among the hoodoos",
         "Navajo Loop into Wall Street. Nothing else looks like this.",
         ["Navajo Loop", "Queen's Garden"], ["jordan"]),
        ("zion", "2024-05-22", 4, "Wading the Narrows",
         "Rented the canyoneering shoes, walked upriver for hours.",
         ["The Narrows", "Riverside Walk"], ["jordan"]),
        ("grca", "2025-03-15", 5, "Ooh Aah Point, actually",
         "South Kaibab is steep, but the name doesn't lie.", ["South Kaibab Trail"], []),
        ("pefo", "2025-03-17", 3, "Rainbow logs",
         "Blue Mesa was the highlight. Short, easy and so colorful.", ["Blue Mesa Trail"], []),
        ("sagu", "2025-11-08", 4, "Cactus forest",
         "Saguaros everywhere at golden hour.", ["Valley View Overlook"], []),
        ("whsa", "2025-11-10", 5, "Sledding the dunes",
         "Bought a saucer at the visitor center. Best $20 ever.",
         ["Dune Life Nature Trail"], []),
        ("cave", "2025-11-11", 4, "The Big Room",
         "Walked in through the natural entrance. Huge and silent.",
         ["Natural Entrance", "Big Room"], []),
        ("romo", "2026-07-04", 4, "Alpine lakes on the Fourth",
         "Emerald Lake before the crowds, elk on the drive out.", ["Emerald Lake Trail"], []),
        ("grte", "2026-10-18", 5, "Gold aspens at Jenny Lake",
         "Last Southwest-to-Rockies trip of the year. Hidden Falls in full fall color.",
         ["Jenny Lake Loop", "Hidden Falls"], ["jordan"]),
    ],
    "jordan": [
        ("bisc", "2025-02-08", 4, "Boat day on the bay",
         "Ninety-five percent water. Took the boat out to Boca Chita Key.",
         ["Boca Chita Key"], []),
        ("grsm", "2025-06-14", 5, "Alum Cave in the fog",
         "Clouds rolling through the whole hike. Moody and perfect.",
         ["Alum Cave Trail"], ["maya"]),
        ("shen", "2025-09-20", 4, "Skyline Drive weekend",
         "Dark Hollow Falls and a lot of overlooks.", ["Dark Hollow Falls"], []),
        ("neri", "2026-04-11", 4, "The gorge from Long Point",
         "Saw the bridge from the best angle there is.", ["Long Point Trail"], []),
        ("maca", "2026-08-02", 4, "Underground for an afternoon",
         "The Historic Tour. Cool and quiet when it's 90° outside.", ["Historic Tour"], []),
        ("blri", "2026-10-12", 5, "Leaf peeping on the Parkway",
         "Linn Cove Viaduct at peak color. Sam drove, I took photos.",
         ["Linn Cove Viaduct"], ["sam"]),
    ],
    "sam": [
        ("acad", "2025-08-23", 5, "Sunrise on Cadillac",
         "First park I ever stamped. First light in the country.",
         ["Cadillac Summit", "Jordan Pond Path"], []),
        ("cuva", "2026-05-30", 4, "Brandywine Falls",
         "An easy one close to home. Towpath bike ride after.", ["Brandywine Falls"], []),
        ("indu", "2026-10-21", 4, "The 3 Dune Challenge",
         "Legs are done, but Lake Michigan from the top is worth it.",
         ["3 Dune Challenge"], []),
    ],
}

# Comments: who, on whose trip (by park), and what they said.
COMMENTS = [
    ("maya", "halie", "jotr", "101°?! Worth it for those palms though."),
    ("jordan", "halie", "cong", "Those cypress knees are unreal. Adding Congaree to my list."),
    ("sam", "halie", "guco", "Didn't know they had cannonballs from the actual battle. "
     "Going soon!"),
    ("jordan", "maya", "grte", "Still thinking about those aspens."),
]

CONTENT_TYPES = {".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4"}

client = httpx.Client(base_url=API, timeout=120)


def call(method: str, path: str, token: str | None = None, body=None) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.request(method, path, headers=headers, json=body)


def account(person: dict, password: str) -> tuple[str, int]:
    """Logs in, signing up first if there's no such account. Returns (token, id)."""
    login = call("POST", "/auth/login", body={"email": person["email"], "password": password})
    if login.status_code == 200:
        token = login.json()["access_token"]
    else:
        fields = {k: person[k] for k in ("email", "username", "first_name", "last_name")}
        signup = call("POST", "/auth/signup", body={**fields, "password": password})
        signup.raise_for_status()
        token = signup.json()["access_token"]
        print("created", person["username"])
    return token, call("GET", "/auth/me", token).json()["id"]


def initials_avatar(person: dict) -> str:
    """A coloured square with their initials (the app crops it round), base64 PNG."""
    image = Image.new("RGB", (256, 256), person["color"])
    try:
        font = ImageFont.truetype("arialbd.ttf", 104)
    except OSError:
        font = ImageFont.load_default(104)
    initials = person["first_name"][0] + person["last_name"][0]
    ImageDraw.Draw(image).text((128, 128), initials, fill="white", font=font, anchor="mm")
    out = io.BytesIO()
    image.save(out, "PNG")
    return base64.b64encode(out.getvalue()).decode()


def without_metadata(path: Path) -> bytes:
    """A photo re-saved upright and without EXIF (location, camera); videos as they are."""
    if path.suffix == ".mp4":
        return path.read_bytes()
    image = ImageOps.exif_transpose(Image.open(path))
    out = io.BytesIO()
    if path.suffix == ".png":
        image.save(out, "PNG")
    else:
        image.convert("RGB").save(out, "JPEG", quality=90)
    return out.getvalue()


def upload(token: str, path: Path) -> str:
    """Uploads one file the way the app does; returns its storage key."""
    data = without_metadata(path)
    content_type = CONTENT_TYPES[path.suffix]
    form = call(
        "POST",
        "/trips/photos/upload-url",
        token,
        {"content_type": content_type, "size_bytes": len(data)},
    )
    form.raise_for_status()
    form = form.json()
    sent = httpx.post(
        form["upload_url"],
        data=form["fields"],
        files={"file": ("upload", data, content_type)},
        timeout=300,
    )
    sent.raise_for_status()
    return form["key"]


def befriend(tokens: dict, a: str, b: str, usernames: dict) -> None:
    """a asks b, b accepts; nothing if they're friends already."""
    friends = call("GET", "/friends", tokens[a]).json()
    if any(f["user"]["username"] == usernames[b] for f in friends):
        return
    request = call("POST", "/friends/requests", tokens[a], {"username": usernames[b]})
    if request.status_code == 409:  # a request between them is already waiting
        print("friend request already pending:", a, "and", b)
        return
    request.raise_for_status()
    call("POST", f"/friends/requests/{request.json()['id']}/accept", tokens[b]).raise_for_status()
    print("friends:", a, "and", b)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    halie_password = sys.argv[1]
    media = Path(sys.argv[2]) if len(sys.argv) > 2 else None

    tokens, ids = {}, {}
    tokens["halie"], ids["halie"] = account(HALIE, halie_password)
    for key, person in FRIENDS.items():
        tokens[key], ids[key] = account(person, FRIEND_PASSWORD)
        if not call("GET", "/auth/me", tokens[key]).json().get("avatar_url"):
            call(
                "PUT",
                "/auth/me/avatar",
                tokens[key],
                {"content_type": "image/png", "data": initials_avatar(person)},
            ).raise_for_status()

    usernames = {"halie": HALIE["username"]} | {k: p["username"] for k, p in FRIENDS.items()}
    for friend in FRIENDS:
        befriend(tokens, "halie", friend, usernames)
    for a, b in [("maya", "jordan"), ("maya", "sam"), ("jordan", "sam")]:
        befriend(tokens, a, b, usernames)

    def existing(who: str) -> dict:
        return {
            (t["park_code"], t["visited_on"]): t["id"]
            for t in call("GET", "/trips", tokens[who]).json()
        }

    if media:
        have = existing("halie")
        for trip in HALIE_TRIPS:
            if (trip["park_code"], trip["visited_on"]) in have:
                continue
            photos = [
                {
                    "key": upload(tokens["halie"], media / item[0]),
                    "caption": item[1],
                    "duration_ms": item[2] if len(item) > 2 else None,
                }
                for item in trip["media"]
            ]
            fields = {k: v for k, v in trip.items() if k != "media"}
            body = {**fields, "photos": photos, "visibility": "friends"}
            call("POST", "/trips", tokens["halie"], body).raise_for_status()
            print("trip: halie", trip["park_code"])

    for who, trips in FRIEND_TRIPS.items():
        have = existing(who)
        for park, day, rating, title, notes, trails, along in trips:
            if (park, day) in have:
                continue
            body = dict(
                park_code=park,
                visited_on=day,
                rating=rating,
                title=title,
                notes=notes,
                trails=trails,
                visibility="friends",
                companion_ids=[ids[c] for c in along],
            )
            call("POST", "/trips", tokens[who], body).raise_for_status()
            print("trip:", who, park)

    for who, owner, park, text in COMMENTS:
        trip_id = next(
            (tid for (code, _), tid in existing(owner).items() if code == park), None
        )
        if trip_id is None:
            continue
        path = f"/trips/{trip_id}/comments"
        if any(c["body"] == text for c in call("GET", path, tokens[who]).json()):
            continue
        call("POST", path, tokens[who], {"body": text}).raise_for_status()
        print("comment:", who, "on", owner, park)

    print("done:", API)


if __name__ == "__main__":
    main()

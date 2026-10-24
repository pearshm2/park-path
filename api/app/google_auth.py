"""
Checking a Google sign-in: the phone signs in with Google and sends us
the ID token Google gave it; this checks the token really came from
Google, was made for ParkPath (one of our OAuth client ids), hasn't
expired, and reads who it's for.

The client ids come from Google Cloud (APIs & Services -> Credentials)
and go in GOOGLE_CLIENT_IDS, comma-separated: the web client id (Android
tokens are issued for it) and the iOS client id. Empty means Google
sign-in is off and POST /auth/google answers 503.
"""

from dataclasses import dataclass

from app.config import settings


class GoogleNotConfigured(Exception):
    """No client ids are set, so no token can be accepted."""


class InvalidGoogleToken(Exception):
    """Not a genuine, current Google token for ParkPath."""


@dataclass(frozen=True)
class GoogleIdentity:
    # Google's id for the account; stays the same if they change email.
    subject: str
    email: str
    email_verified: bool
    first_name: str
    last_name: str


def verify_google_id_token(token: str) -> GoogleIdentity:
    client_ids = settings.google_client_id_list
    if not client_ids:
        raise GoogleNotConfigured()

    # Imported here so the API (and its tests) run without the package
    # until Google sign-in is actually used.
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        # Checks the signature against Google's published keys, the
        # issuer and the expiry. Audience is checked below against all of
        # our client ids, since the library takes only one.
        claims = id_token.verify_oauth2_token(token, google_requests.Request(), audience=None)
    except ValueError as error:
        raise InvalidGoogleToken(str(error)) from error

    if claims.get("aud") not in client_ids:
        raise InvalidGoogleToken("Token wasn't issued for ParkPath")
    if not claims.get("email") or not claims.get("sub"):
        raise InvalidGoogleToken("Token has no email")

    return GoogleIdentity(
        subject=str(claims["sub"]),
        email=claims["email"],
        email_verified=bool(claims.get("email_verified")),
        first_name=(claims.get("given_name") or "").strip(),
        last_name=(claims.get("family_name") or "").strip(),
    )

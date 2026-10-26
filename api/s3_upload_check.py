"""
One-off check: does a real upload to the photo bucket work?

Logs in to the ParkPath API, asks for an upload form exactly as the app
does, then sends a tiny test file straight to S3 with it, and prints what
S3 says. Run from park-path/api with the virtual environment active:

    python s3_upload_check.py YOUR-EMAIL YOUR-PASSWORD

Nothing here is saved anywhere; the test file is 1 KB of zeros.
"""

import sys

import httpx

API = "https://parkpath-api.onrender.com"

email, password = sys.argv[1], sys.argv[2]
with httpx.Client(timeout=90) as client:
    login = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    print("1. Log in:", login.status_code)
    login.raise_for_status()
    token = login.json()["access_token"]

    data = b"\0" * 1024
    form = client.post(
        f"{API}/trips/photos/upload-url",
        headers={"Authorization": f"Bearer {token}"},
        json={"content_type": "image/jpeg", "size_bytes": len(data)},
    )
    print("2. Upload form:", form.status_code)
    form.raise_for_status()
    upload = form.json()
    print("   Upload goes to:", upload["upload_url"])

    # The fields first, then the file, as S3 requires. No redirects
    # followed, so we see exactly what S3 answers.
    s3 = client.post(
        upload["upload_url"],
        data=upload["fields"],
        files={"file": ("check.jpg", data, "image/jpeg")},
        follow_redirects=False,
    )
    print("3. S3 answered:", s3.status_code)
    if s3.status_code >= 300:
        print(s3.text[:800])
    else:
        print("   Uploaded as:", upload["key"])

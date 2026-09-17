"""
OAuth 2.0 Authorization Script for SheAlert Audio Collector
===========================================================
This script allows you to authorize your personal Google Drive (e.g. mahadjokhio08@gmail.com)
so that recordings upload using your personal 15 GB quota instead of the Service Account's 0-byte quota.

Instructions:
1. Go to Google Cloud Console (https://console.cloud.google.com/) for project "shealert-audio-collector".
2. Go to "APIs & Services" > "Credentials".
3. Click "Create Credentials" > "OAuth client ID".
   - Application type: Desktop app (or Web application)
   - Name: SheAlert Collector
4. Download the JSON file or copy the Client ID and Client Secret.
5. Run:
   python scripts/setup_google_drive_oauth.py --client-secrets-file <path-to-downloaded-json>
   OR
   python scripts/setup_google_drive_oauth.py --client-id <ID> --client-secret <SECRET>
6. A browser will open asking you to sign in with mahadjokhio08@gmail.com and grant Drive permission.
7. The script saves 'google_token.json' in your project root, and the backend automatically uses it!
"""

import argparse
import json
import sys
import webbrowser
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]


def main():
    parser = argparse.ArgumentParser(description="Generate Google Drive OAuth 2.0 user credentials")
    parser.add_argument("--client-secrets-file", help="Path to client_secret.json from Google Cloud Console")
    parser.add_argument("--client-id", help="OAuth Client ID")
    parser.add_argument("--client-secret", help="OAuth Client Secret")
    parser.add_argument("--output", default="google_token.json", help="Output token path (default: google_token.json)")
    args = parser.parse_args()

    if args.client_secrets_file:
        flow = InstalledAppFlow.from_client_secrets_file(args.client_secrets_file, scopes=SCOPES)
    elif args.client_id and args.client_secret:
        client_config = {
            "installed": {
                "client_id": args.client_id,
                "client_secret": args.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        }
        flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)
    else:
        print("Error: Please provide either --client-secrets-file OR both --client-id and --client-secret.")
        print("Example: python scripts/setup_google_drive_oauth.py --client-secrets-file client_secret.json")
        sys.exit(1)

    # Use console flow: generate URL manually so the user can paste it
    flow.redirect_uri = "urn:ietf:wg:oauth:2.0:oob"
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    print("\n" + "=" * 70)
    print("  STEP 1: Open this URL in your browser:")
    print("=" * 70)
    print(auth_url)
    print("=" * 70)
    print()
    print("  Sign in with mahadjokhio08@gmail.com")
    print("  If Google warns 'App not verified', click Advanced -> Go to SheAlert Collector")
    print("  After granting permission, Google will show you a CODE.")
    print()

    # Try to open the browser too, just in case it works
    try:
        webbrowser.open(auth_url)
        print("  (We also tried to open your browser automatically.)")
    except Exception:
        pass

    print()
    code = input("  STEP 2: Paste the code here and press Enter: ").strip()

    flow.fetch_token(code=code)
    credentials = flow.credentials

    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else SCOPES,
    }

    output_path = Path(args.output).resolve()
    output_path.write_text(json.dumps(token_data, indent=2), encoding="utf-8")
    print(f"\n✅ Successfully saved credentials to: {output_path}")
    print("🚀 The backend will now automatically upload using your Google account quota!")


if __name__ == "__main__":
    main()

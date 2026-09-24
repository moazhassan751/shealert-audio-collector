"""
OAuth 2.0 Authorization Script for SheAlert Audio Collector
===========================================================
This script authorizes your personal Google Drive (e.g. mahadjokhio08@gmail.com)
so that recordings upload using your personal 15 GB quota instead of the Service Account's 0-byte quota.

Instructions:
1. Make sure your OAuth consent screen is published (or your email is added under Test Users) in Google Cloud Console.
2. Run:
   python scripts/setup_google_drive_oauth.py
3. A browser window will automatically open asking you to sign in with your Google account and grant Drive permissions.
4. Once you approve, the token is saved to google_token.json and synced to .env!
"""

import argparse
import glob
import json
import re
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]


def update_env_file(token_json_str: str) -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return
    content = env_path.read_text(encoding="utf-8")
    escaped_json = token_json_str.strip().replace("\n", " ")
    if "GOOGLE_OAUTH_TOKEN_JSON=" in content:
        content = re.sub(r'GOOGLE_OAUTH_TOKEN_JSON=.*', f'GOOGLE_OAUTH_TOKEN_JSON={escaped_json}', content)
    else:
        content += f"\nGOOGLE_OAUTH_TOKEN_JSON={escaped_json}\n"
    env_path.write_text(content, encoding="utf-8")
    print("  -> Updated GOOGLE_OAUTH_TOKEN_JSON in .env")


def main():
    parser = argparse.ArgumentParser(description="Generate Google Drive OAuth 2.0 user credentials")
    parser.add_argument("--client-secrets-file", help="Path to client_secret.json from Google Cloud Console")
    parser.add_argument("--client-id", help="OAuth Client ID")
    parser.add_argument("--client-secret", help="OAuth Client Secret")
    parser.add_argument("--output", default="google_token.json", help="Output token path (default: google_token.json)")
    args = parser.parse_args()

    client_secrets_file = args.client_secrets_file
    if not client_secrets_file and not (args.client_id and args.client_secret):
        # Auto-detect client_secret file in current directory
        candidates = glob.glob("client_secret*.json")
        if candidates:
            client_secrets_file = candidates[0]
            print(f"Auto-detected client secrets file: {client_secrets_file}")

    if client_secrets_file and Path(client_secrets_file).exists():
        flow = InstalledAppFlow.from_client_secrets_file(client_secrets_file, scopes=SCOPES)
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
        print("Error: Could not find client_secret.json file or --client-id/--client-secret.")
        print("Example: python scripts/setup_google_drive_oauth.py --client-secrets-file client_secret.json")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("  LAUNCHING GOOGLE OAUTH AUTHORIZATION IN BROWSER...")
    print("=" * 70)
    print("  Sign in with your Google account (e.g. mahadjokhio08@gmail.com).")
    print("  If Google warns 'Google hasn't verified this app':")
    print("    1. Click 'Advanced'")
    print("    2. Click 'Go to SheAlert Collector (unsafe)'")
    print("    3. Click 'Continue' / 'Allow' to grant Google Drive access.")
    print("=" * 70 + "\n")

    try:
        credentials = flow.run_local_server(
            port=0,
            prompt="consent",
            access_type="offline",
        )
    except Exception as e:
        print(f"Local server authorization failed: {e}")
        print("Falling back to console authorization...")
        flow.redirect_uri = "http://localhost"
        auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
        print("Open this URL in your browser:\n", auth_url)
        code = input("Paste the authorization code or redirect URL here: ").strip()
        if "code=" in code:
            code = code.split("code=")[1].split("&")[0]
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

    token_json = json.dumps(token_data, indent=2)
    output_path = Path(args.output).resolve()
    output_path.write_text(token_json, encoding="utf-8")
    print(f"\n Successfully saved fresh OAuth credentials to: {output_path}")

    update_env_file(token_json)
    print(" The backend can now upload recordings to Google Drive!")
    print("\n IMPORTANT NOTE ABOUT 7-DAY EXPIRATION:")
    print("  If your project's OAuth Consent Screen in Google Cloud Console is in 'Testing' status,")
    print("  Google expires refresh tokens every 7 days.")
    print("  To make the token permanent:")
    print("  1. Go to https://console.cloud.google.com/apis/credentials/consent")
    print("  2. Click 'PUBLISH APP' under Publishing status.")
    print("  3. Your token will then never expire after 7 days!\n")


if __name__ == "__main__":
    main()

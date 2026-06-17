"""
Sube un archivo (dado como base64 en un .b64) al bucket documentos-importacion.
Uso: python scripts/upload_b64.py <archivo.b64> <path-en-storage>
"""
import base64
import sys
import urllib.error
import urllib.request
from pathlib import Path

BUCKET = "documentos-importacion"


def load_env(path=".env.local"):
    env = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def main():
    b64file, storage_path = sys.argv[1], sys.argv[2]
    env = load_env()
    url = env["VITE_SUPABASE_URL"].rstrip("/")
    key = env["VITE_SUPABASE_ANON_KEY"]
    data = base64.b64decode(Path(b64file).read_text().strip())
    req = urllib.request.Request(
        f"{url}/storage/v1/object/{BUCKET}/{storage_path}",
        data=data,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
    )
    try:
        urllib.request.urlopen(req)
        print(f"OK -> {storage_path} ({len(data)} bytes)")
    except urllib.error.HTTPError as e:
        print(f"ERROR {e.code}: {e.read().decode()[:200]}")


if __name__ == "__main__":
    main()

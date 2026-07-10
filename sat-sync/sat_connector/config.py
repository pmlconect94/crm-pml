from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Config:
    rfc: str
    cert_path: Path
    key_path: Path
    password: str
    data_dir: Path
    supabase_url: str
    supabase_service_key: str
    empresa_id: str


def load_config() -> Config:
    rfc = os.environ.get("SAT_RFC", "").strip().upper()
    cert_path = Path(os.environ.get("SAT_EFIRMA_CERT_PATH", "credentials/efirma.cer"))
    key_path = Path(os.environ.get("SAT_EFIRMA_KEY_PATH", "credentials/efirma.key"))
    password = os.environ.get("SAT_EFIRMA_PASSWORD", "")
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    empresa_id = os.environ.get("EMPRESA_ID", "pml").strip()

    if not cert_path.is_absolute():
        cert_path = BASE_DIR / cert_path
    if not key_path.is_absolute():
        key_path = BASE_DIR / key_path

    missing = []
    if not rfc:
        missing.append("SAT_RFC")
    if not password:
        missing.append("SAT_EFIRMA_PASSWORD")
    if not cert_path.exists():
        missing.append(f"archivo de certificado ({cert_path})")
    if not key_path.exists():
        missing.append(f"archivo de llave privada ({key_path})")
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not supabase_service_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")

    if missing:
        raise RuntimeError(
            "Faltan datos de configuración: " + "; ".join(missing) + ". "
            "En local: copia .env.example a .env. En GitHub Actions: revisa los secrets del repo."
        )

    return Config(
        rfc=rfc,
        cert_path=cert_path,
        key_path=key_path,
        password=password,
        data_dir=BASE_DIR / "data",
        supabase_url=supabase_url,
        supabase_service_key=supabase_service_key,
        empresa_id=empresa_id,
    )

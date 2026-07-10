from __future__ import annotations

from satcfdi.models import Signer
from satcfdi.pacs.sat import SAT

from .config import Config


def build_sat_service(config: Config) -> SAT:
    signer = Signer.load(
        certificate=config.cert_path.read_bytes(),
        key=config.key_path.read_bytes(),
        password=config.password,
    )

    if signer.rfc.upper() != config.rfc.upper():
        raise RuntimeError(
            f"El RFC de la e.firma ({signer.rfc}) no coincide con SAT_RFC en .env ({config.rfc})."
        )

    return SAT(signer=signer)

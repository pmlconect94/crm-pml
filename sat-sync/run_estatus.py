"""Punto de entrada del verificador de estatus (cancelaciones + EFOS), usado por
.github/workflows/sat-sync.yml. Gemelo de run_sync.py: correr como script (no
`-m`) hace que Python agregue esta carpeta a sys.path, asi el paquete
`sat_connector` se importa sin depender del directorio de trabajo exacto.

A diferencia de run_sync.py, este NO necesita e.firma: usa el servicio publico
del SAT (el del QR). Solo requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
(+ EMPRESA_ID para saber de que empresa revisar las facturas).

Uso: python run_estatus.py [--max N] [--dias-reverificar N] [--workers N]
"""
import sys

from sat_connector.cli import main

if __name__ == "__main__":
    sys.argv = [sys.argv[0], "estatus", *sys.argv[1:]]
    main()

"""Punto de entrada usado por el workflow de GitHub Actions
(.github/workflows/sat-sync.yml). Correr como script (no `-m`) hace que Python
agregue automaticamente esta carpeta a sys.path, así el paquete `sat_connector`
se importa sin depender del directorio de trabajo exacto.

Uso: python run_sync.py [--dias N] [--tipo emitidas|recibidas|ambas]
"""
import sys

from sat_connector.cli import main

if __name__ == "__main__":
    sys.argv = [sys.argv[0], "sincronizar", *sys.argv[1:]]
    main()

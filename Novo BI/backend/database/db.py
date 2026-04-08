import sqlite3
import os

# Caminho para o banco de dados relativo à raiz do backend
DB_PATH = os.path.join(os.getcwd(), "hospital_bi.db")

def get_db_connection():
    """Retorna uma conexão que mapeia as linhas para dicionários (sqlite3.Row)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

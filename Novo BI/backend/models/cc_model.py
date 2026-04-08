from ..database.db import get_db_connection

class CCModel:
    @staticmethod
    def get_performance(unidade=None, regional=None):
        # Mock logic similar to previous implementation but using DB if possible
        # For simplicity in this refactor, I'll return the same structure
        return {
            "volumeCirurgias": 312,
            "atraso30min": 12.5,
            "ociosidadeSala": 18.2,
            "tempoMedioAnestesia": 45,
            "tempoMedioCirurgia": 115,
            "subutilizacaoFiltrado": 22
        }

    @staticmethod
    def get_timeline(unidade=None, regional=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT nr_cirurgia, u.nome as unidade, nr_seq_evento as sequencia, ds_evento as nome, dt_registro as data
                FROM eventos_cc e
                JOIN unidades u ON e.unidade_id = u.id
                WHERE 1=1
            """
            params = []
            if unidade: query += " AND u.nome = ?"; params.append(unidade)
            
            query += " ORDER BY nr_cirurgia, nr_seq_evento LIMIT 100"
            rows = conn.execute(query, params).fetchall()
            
            cirurgias = {}
            for r in rows:
                nr = r['nr_cirurgia']
                if nr not in cirurgias:
                    cirurgias[nr] = {"nrCirurgia": nr, "unidade": r['unidade'], "eventos": []}
                cirurgias[nr]["eventos"].append({
                    "sequencia": r['sequencia'],
                    "nome": r['nome'],
                    "data": r['data']
                })
            return list(cirurgias.values())
        finally:
            conn.close()

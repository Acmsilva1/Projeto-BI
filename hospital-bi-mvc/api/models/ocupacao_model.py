from ..database.db import get_db_connection

class OcupacaoModel:
    @staticmethod
    def get_por_setor(unidade=None, regional=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT setor, SUM(total_leitos) as total, SUM(leitos_ocupados) as ocupados
                FROM ocupacao o
                JOIN unidades u ON o.unidade_id = u.id
                WHERE data = (SELECT MAX(data) FROM ocupacao)
            """
            params = []
            if unidade: query += " AND u.nome = ?"; params.append(unidade)
            if regional: query += " AND u.regional = ?"; params.append(regional)
            
            query += " GROUP BY setor"
            rows = conn.execute(query, params).fetchall()
            
            res = []
            for r in rows:
                res.append({
                    "nome": r['setor'],
                    "total": r['total'],
                    "ocupados": r['ocupados'],
                    "percentual": round((r['ocupados'] / r['total']) * 100, 1) if r['total'] > 0 else 0
                })
            return {"setores": res}
        finally:
            conn.close()

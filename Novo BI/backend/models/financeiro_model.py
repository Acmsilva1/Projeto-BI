from ..database.db import get_db_connection

class FinanceiroModel:
    @staticmethod
    def get_resumo(unidade=None, regional=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT mes, SUM(receita) as receita, SUM(despesa) as despesa, AVG(meta) as meta, AVG(glosas_percent) as glosasPercent
                FROM financeiro f
                JOIN unidades u ON f.unidade_id = u.id
                WHERE 1=1
            """
            params = []
            if unidade: query += " AND u.nome = ?"; params.append(unidade)
            if regional: query += " AND u.regional = ?"; params.append(regional)
            
            query += " GROUP BY mes ORDER BY mes"
            rows = conn.execute(query, params).fetchall()
            
            meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            return {
                "labels": [meses[r['mes']-1] for r in rows],
                "receitas": [r['receita'] for r in rows],
                "despesas": [r['despesa'] for r in rows],
                "meta": rows[0]['meta'] if rows else 0,
                "glosasPercent": [r['glosasPercent'] for r in rows]
            }
        finally:
            conn.close()

    @staticmethod
    def get_por_convenio(unidade=None, regional=None):
        # Mocking convenio distribution
        return {
            "labels": ['SUS', 'Unimed', 'Bradesco', 'Amil', 'Outros'],
            "valores": [2100000, 980000, 720000, 560000, 480000],
            "cores": ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
        }

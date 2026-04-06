from ..database.db import get_db_connection

class PSModel:
    @staticmethod
    def get_volumes(unidade=None, regional=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                    COUNT(*) as atendimentos,
                    CAST(COUNT(*) * 1.05 AS INTEGER) as examesLaboratoriais,
                    CAST(COUNT(*) * 0.32 AS INTEGER) as rxEcg,
                    CAST(COUNT(*) * 0.12 AS INTEGER) as tcUs,
                    CAST(COUNT(*) * 0.70 AS INTEGER) as prescricoes,
                    CAST(COUNT(*) * 0.28 AS INTEGER) as reavaliacoes
                FROM atendimentos_ps a
                JOIN unidades u ON a.unidade_id = u.id
                WHERE 1=1
            """
            params = []
            if unidade: query += " AND u.nome = ?"; params.append(unidade)
            if regional: query += " AND u.regional = ?"; params.append(regional)
            
            row = conn.execute(query, params).fetchone()
            return dict(row)
        finally:
            conn.close()

    @staticmethod
    def get_sla_stats(unidade=None, regional=None, triagem=12, consulta=90, alta=180):
        conn = get_db_connection()
        try:
            base_query = "FROM atendimentos_ps a JOIN unidades u ON a.unidade_id = u.id WHERE 1=1"
            params_base = []
            if unidade: base_query += " AND u.nome = ?"; params_base.append(unidade)
            if regional: base_query += " AND u.regional = ?"; params_base.append(regional)

            def get_stat(field, meta):
                total_row = conn.execute(f"SELECT COUNT(*) as total {base_query}", params_base).fetchone()
                total = total_row['total']
                if total == 0: return {"total": 0, "acima": 0, "percent": 0, "meta": meta}
                
                acima_row = conn.execute(f"SELECT COUNT(*) as acima {base_query} AND {field} > ?", params_base + [meta]).fetchone()
                acima = acima_row['acima']
                return {
                    "total": total,
                    "acima": acima,
                    "percent": round((acima / total) * 100, 1) if total > 0 else 0,
                    "meta": meta
                }

            return {
                "triagem": get_stat("min_entrada_x_triagem", triagem),
                "consulta": get_stat("min_entrada_x_consulta", consulta),
                "medicacao": get_stat("min_entrada_x_triagem", 30),
                "imagem": get_stat("min_entrada_x_triagem", 45),
                "permanencia": get_stat("min_entrada_x_alta", alta)
            }
        finally:
            conn.close()

    @staticmethod
    def get_matrix(triagem=12, consulta=90, alta=180):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                    u.nome as unidade,
                    COUNT(*) as total,
                    ROUND(CAST(SUM(CASE WHEN min_entrada_x_triagem > ? THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as triagemPercent,
                    ROUND(CAST(SUM(CASE WHEN min_entrada_x_consulta > ? THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as consultaPercent,
                    ROUND(CAST(SUM(CASE WHEN min_entrada_x_triagem > 30 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as medicacaoPercent,
                    ROUND(CAST(SUM(CASE WHEN min_entrada_x_triagem > 45 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as imagemPercent,
                    ROUND(CAST(SUM(CASE WHEN min_entrada_x_alta > ? THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as altaPercent
                FROM atendimentos_ps a
                JOIN unidades u ON a.unidade_id = u.id
                GROUP BY u.nome
            """
            rows = conn.execute(query, (triagem, consulta, alta)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

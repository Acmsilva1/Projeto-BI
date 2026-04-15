"""Constantes espelhadas de node_legado/api/live_service.js."""

DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

SLA_KEYS = ["triagem", "consulta", "medicacao", "reavaliacao", "rx_ecg", "tc_us", "permanencia"]

METAS_POR_VOLUMES_INDICADORES = [
    {"key": "conversao", "name": "Conversão", "isReverso": True, "isP": True},
    {"key": "pacs_medicados", "name": "Pacs medicados", "isReverso": True, "isP": True},
    {"key": "medicacoes_por_paciente", "name": "Medicações por paciente", "isReverso": True, "isP": False},
    {"key": "pacs_exames_lab", "name": "Pacs c/ exames laboratoriais", "isReverso": True, "isP": True},
    {"key": "lab_por_paciente", "name": "Laboratório por paciente", "isReverso": True, "isP": False},
    {"key": "pacs_exames_tc", "name": "Pacs c/ exames de TC", "isReverso": True, "isP": True},
    {"key": "tcs_por_paciente", "name": "TCs por paciente", "isReverso": True, "isP": False},
    {"key": "triagem_acima_meta", "name": "Triagem acima da meta", "isReverso": True, "isP": True},
    {"key": "consulta_acima_meta", "name": "Consulta acima da meta", "isReverso": True, "isP": True},
    {"key": "medicacao_acima_meta", "name": "Medicação acima da meta", "isReverso": True, "isP": True},
    {"key": "reavaliacao_acima_meta", "name": "Reavaliação acima da meta", "isReverso": True, "isP": True},
    {"key": "permanencia_acima_meta", "name": "Permanência acima da meta", "isReverso": True, "isP": True},
    {"key": "desfecho_medico", "name": "Desfecho do médico do atend.", "isReverso": False, "isP": True},
]

DEMO_UNIDADES_PS = [
    {"codigo": "001", "unidadeId": "001", "unidadeNome": "PS HOSPITAL VITÓRIA", "regional": "ES"},
    {"codigo": "003", "unidadeId": "003", "unidadeNome": "PS VILA VELHA", "regional": "ES"},
    {"codigo": "013", "unidadeId": "013", "unidadeNome": "PS SIG", "regional": "DF"},
    {"codigo": "025", "unidadeId": "025", "unidadeNome": "PS BARRA DA TIJUCA", "regional": "RJ"},
    {"codigo": "026", "unidadeId": "026", "unidadeNome": "PS BOTAFOGO", "regional": "RJ"},
    {"codigo": "031", "unidadeId": "031", "unidadeNome": "PS GUTIERREZ", "regional": "MG"},
    {"codigo": "033", "unidadeId": "033", "unidadeNome": "PS PAMPULHA", "regional": "MG"},
    {"codigo": "039", "unidadeId": "039", "unidadeNome": "PS TAGUATINGA", "regional": "DF"},
    {"codigo": "045", "unidadeId": "045", "unidadeNome": "PS CAMPO GRANDE", "regional": "RJ"},
]

METRICAS_POR_UNIDADE_COLUNAS = [
    {"key": "atendimentos", "label": "Atendimentos", "kind": "int"},
    {"key": "altas", "label": "Altas", "kind": "int"},
    {"key": "obitos", "label": "Óbitos", "kind": "int"},
    {"key": "pct_evasao", "label": "% Evasão", "kind": "pct", "pctSense": "low_good", "pctGreenAt": 8, "pctRedAt": 22},
    {
        "key": "pct_desfecho_sobre_altas",
        "label": "% desfecho médico (s/ altas)",
        "kind": "pct",
        "pctSense": "high_good",
        "pctGreenAt": 82,
        "pctRedAt": 58,
    },
    {
        "key": "pct_desfecho_medico",
        "label": "% desfecho do médico do atend.",
        "kind": "pct",
        "pctSense": "high_good",
        "pctGreenAt": 82,
        "pctRedAt": 58,
    },
    {"key": "saidas", "label": "Saídas", "kind": "int"},
    {"key": "internacoes", "label": "Internações", "kind": "int"},
    {"key": "pct_conversao", "label": "% Conversão", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 12, "pctRedAt": 4},
    {"key": "pct_reavaliacao", "label": "% Reavaliação", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 22, "pctRedAt": 8},
    {
        "key": "pct_pacientes_medicados",
        "label": "% pacientes medicados",
        "kind": "pct",
        "pctSense": "high_good",
        "pctGreenAt": 88,
        "pctRedAt": 68,
    },
    {"key": "media_medicacoes_por_pac", "label": "Média medicações por pac", "kind": "decimal"},
    {
        "key": "pct_medicacoes_rapidas",
        "label": "% medicações rápidas",
        "kind": "pct",
        "pctSense": "high_good",
        "pctGreenAt": 72,
        "pctRedAt": 42,
    },
    {"key": "pct_pacientes_lab", "label": "% pacientes com laboratório", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 55, "pctRedAt": 28},
    {"key": "media_lab_por_pac", "label": "Média laborat./pac", "kind": "decimal"},
    {"key": "pct_pacientes_rx", "label": "% pacientes com RX", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 48, "pctRedAt": 22},
    {"key": "pct_pacientes_ecg", "label": "% pacientes com ECG", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 32, "pctRedAt": 14},
    {"key": "pct_pacientes_tc", "label": "% pacientes com TC", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 22, "pctRedAt": 8},
    {"key": "media_tcs_por_pac", "label": "Média TCs/pac", "kind": "decimal"},
    {"key": "pct_pacientes_us", "label": "% pacientes com US", "kind": "pct", "pctSense": "high_good", "pctGreenAt": 28, "pctRedAt": 10},
]

GERENCIA_TOTAIS_PS_DEF = [
    {"key": "atendimentos", "label": "Atendimentos"},
    {"key": "altas", "label": "Altas"},
    {"key": "obitos", "label": "Óbitos"},
    {"key": "evasoes", "label": "Evasões"},
    {"key": "desfecho", "label": "Desfecho"},
    {"key": "desfecho_medico", "label": "Desfecho médico do atend."},
    {"key": "saidas", "label": "Saídas"},
    {"key": "internacoes", "label": "Internações"},
    {"key": "conversoes", "label": "Conversões"},
    {"key": "reavaliacoes", "label": "Reavaliações"},
    {"key": "pacientes_medicados", "label": "Pacientes medicados"},
    {"key": "medicacoes", "label": "Medicações"},
    {"key": "medicacoes_rapidas", "label": "Medicações rápidas"},
    {"key": "pacientes_lab", "label": "Pacientes c/ laboratório"},
    {"key": "exames_lab", "label": "Exames laboratório"},
    {"key": "pacientes_rx", "label": "Pacientes c/ RX"},
    {"key": "pacientes_ecg", "label": "Pacientes c/ ECG"},
    {"key": "pacientes_tc", "label": "Pacientes c/ TC"},
    {"key": "tcs", "label": "TCs"},
    {"key": "pacientes_us", "label": "Pacientes c/ US"},
]

TEMPO_MEDIO_ETAPAS_COLS = [
    {"key": "totem_triagem", "label": "Totem → Triagem", "icons": ["Ticket", "Megaphone"], "columnBg": None, "slaMaxMinutos": None},
    {"key": "totem_consulta", "label": "Totem → Consulta", "icons": ["Ticket", "Stethoscope"], "columnBg": None, "slaMaxMinutos": None},
    {"key": "presc_medicacao", "label": "Prescrição → Medicação", "icons": ["ClipboardList", "Pill"], "columnBg": None, "slaMaxMinutos": None},
    {
        "key": "presc_rx_ecg",
        "label": "Prescrição → Revisão (Execução)",
        "icons": ["ClipboardList", "ScanLine"],
        "columnBg": None,
        "slaMaxMinutos": None,
    },
    {
        "key": "presc_tc_us",
        "label": "Prescrição → TC/US (Laudo)",
        "icons": ["ClipboardList", "Scan"],
        "columnBg": "blue",
        "slaMaxMinutos": None,
    },
    {
        "key": "pedido_reavaliacao",
        "label": "Pedido → Reavaliação",
        "icons": ["PencilLine", "RefreshCw"],
        "columnBg": "green",
        "slaMaxMinutos": None,
    },
    {"key": "permanencia_total", "label": "Permanência total", "icons": ["Building2", "Clock"], "columnBg": None, "slaMaxMinutos": None},
]

METAS_ACOMP_MES_LABELS = []
_short = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
_y, _m = 2025, 4
for _i in range(12):
    METAS_ACOMP_MES_LABELS.append(f"{_short[_m - 1]}/{str(_y % 100).zfill(2)}")
    _m += 1
    if _m > 12:
        _m = 1
        _y += 1

METAS_ACOMP_CORES_UNIDADE = [
    "#92400e",
    "#2563eb",
    "#ea580c",
    "#15803d",
    "#7c3aed",
    "#db2777",
    "#0e7490",
    "#a16207",
    "#475569",
    "#b45309",
]

METAS_ACOMP_POR_KEY = {
    "conversao": {"meta": 6},
    "pacs_medicados": {"meta": 12},
    "medicacoes_por_paciente": {"meta": 2.4},
    "pacs_exames_lab": {"meta": 18},
    "lab_por_paciente": {"meta": 1.8},
    "pacs_exames_tc": {"meta": 14},
    "tcs_por_paciente": {"meta": 1.2},
    "triagem_acima_meta": {"meta": 10},
    "consulta_acima_meta": {"meta": 12},
    "medicacao_acima_meta": {"meta": 11},
    "reavaliacao_acima_meta": {"meta": 9},
    "permanencia_acima_meta": {"meta": 15},
    "desfecho_medico": {"meta": 82},
}

GERENCIA_FACT_DATE_COLUMNS = {
    "tbl_tempos_entrada_consulta_saida": ["DATA", "DT_ENTRADA"],
    "tbl_tempos_medicacao": ["DATA", "DT_PRESCRICAO"],
    "tbl_tempos_laboratorio": ["DATA", "DT_SOLICITACAO", "DT_EXAME", "DT_ENTRADA"],
    "tbl_tempos_rx_e_ecg": ["DATA", "DT_SOLICITACAO", "DT_EXAME"],
    "tbl_tempos_tc_e_us": ["DATA", "DT_EXAME", "DT_REALIZADO", "DT_LIBERACAO"],
    "tbl_tempos_reavaliacao": ["DATA", "DT_SOLIC_REAVALIACAO"],
    "tbl_altas_ps": ["DT_ALTA", "DT_ENTRADA"],
    "tbl_intern_conversoes": ["DT_ENTRADA", "DT_ALTA"],
    "tbl_vias_medicamentos": ["DATA", "DT_LIBERACAO"],
}

PBI_VIAS_EXCLUDE_CD_MATERIAL = frozenset({84278, 84288, 84153, 84271})

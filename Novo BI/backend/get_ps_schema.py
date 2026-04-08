import sqlite3

conn = sqlite3.connect('hospital_bi.db')
c = conn.cursor()

def show_schema(view_name):
    print(f"--- Schema for {view_name} ---")
    c.execute(f"SELECT sql FROM sqlite_master WHERE type='view' AND name='{view_name}';")
    row = c.fetchone()
    if row:
        print(row[0])
    else:
        print("Not found")

views = ['vw_realtime_ps_volumes', 'vw_realtime_ps_slas', 'vw_realtime_ps_kpis', 'vw_realtime_ps_matrix']
for v in views:
    show_schema(v)

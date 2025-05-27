from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import pyodbc
from dotenv import load_dotenv
import os

load_dotenv()
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

# --- Replace with your actual credentials ---
SERVICENOW_URL = os.getenv("SERVICENOW_URL")
SERVICENOW_USERNAME = os.getenv("SERVICENOW_USERNAME")
SERVICENOW_PASSWORD = os.getenv("SERVICENOW_PASSWORD")
SERVICENOW_HEADERS = {
    "Accept": "application/json",
}
SQL_CONN_STR = (
    "DRIVER={SQL Server};"
    f"SERVER={os.getenv('SQL_SERVER')};"
    f"DATABASE={os.getenv('SQL_DATABASE')};"
    f"ID={os.getenv('SQL_ID')};"
    f"Password={os.getenv('SQL_PASSWORD')};"
)

@app.route('/api/asset', methods=['POST'])
def get_asset():
    data = request.json
    search_type = data.get('type')  # 'asset_tag' or 'serial_number'
    search_value = data.get('value', '').replace(" ", "")

    # Column mapping
    columns = [
        ("asset_tag", "asset_code"),
        ("serial_number", "EQPT_SL_NO"),
        ("assigned_to_employee_number", "psno"),
        ("install_status", "status_tag"),
        ("cost_center", "current_job_no"),
        ("model_category", "TYPE"),
        ("updated_on", "updated_on")
    ]

    # --- ServiceNow fetch ---
    serv_col = [c[0] for c in columns]
    serv_key = serv_col[0] if search_type == 'asset_tag' else serv_col[1]
    params = {serv_key: search_value, 'sysparm_fields': ','.join(serv_col)}
    try:
        resp = requests.get(SERVICENOW_URL, headers=SERVICENOW_HEADERS, auth=(SERVICENOW_USERNAME, SERVICENOW_PASSWORD), params=params)
        serv_data = {}
        if resp.status_code == 200:
            result = resp.json().get('result', [])
            if result:
                for c in serv_col:
                    value = result[0].get(c, "")
                    if isinstance(value, dict) and 'display_value' in value:
                        value = value['display_value']
                    serv_data[c] = value if value is not None else ""
            else:
                serv_data = {c: "" for c in serv_col}
        else:
            serv_data = {c: "" for c in serv_col}
    except Exception as e:
        serv_data = {c: "" for c in serv_col}

    # --- SQL fetch ---
    sql_col = [c[1] for c in columns]
    sql_key = sql_col[0] if search_type == 'asset_tag' else sql_col[1]
    sql_data = {}
    try:
        conn = pyodbc.connect(SQL_CONN_STR)
        cursor = conn.cursor()
        query = f"SELECT {', '.join(sql_col)} FROM office_master WHERE {sql_key} = ?"
        cursor.execute(query, search_value)
        row = cursor.fetchone()
        if row:
            sql_data = {c: v if v is not None else "" for c, v in zip(sql_col, row)}
        else:
            sql_data = {c: "" for c in sql_col}
        cursor.close()
        conn.close()
    except Exception as e:
        sql_data = {c: "" for c in sql_col}

    # Map SQL and ServiceNow data to frontend columns
    response = {
        "columns": [
            "Asset tag", "Serial Number", "Employee Number",
            "State", "Cost Center", "Make & Model", "Updated On"
        ],
        "rows": [
            {
                "source": "SQL",
                "data": [
                    sql_data.get("asset_code", ""),
                    sql_data.get("EQPT_SL_NO", ""),
                    sql_data.get("psno", ""),
                    sql_data.get("status_tag", ""),
                    sql_data.get("current_job_no", ""),
                    sql_data.get("TYPE", ""),
                    sql_data.get("updated_on", "")
                ]
            },
            {
                "source": "ServiceNow",
                "data": [
                    serv_data.get("asset_tag", ""),
                    serv_data.get("serial_number", ""),
                    serv_data.get("assigned_to_employee_number", ""),
                    serv_data.get("install_status", ""),
                    serv_data.get("cost_center", ""),
                    serv_data.get("model_category", ""),
                    serv_data.get("updated_on", "")
                ]
            }
        ]
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)

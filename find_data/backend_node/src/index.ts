import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import sql from 'mssql';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER as string,
  database: process.env.SQL_DATABASE,
  options: { encrypt: true, trustServerCertificate: true }
};

app.post('/api/asset', async (req, res) => {
  const { type, value } = req.body;
  const searchValue = value.replace(/\s/g, '');

  // 1. Fetch from SQL
  let sqlData: any = {};
  try {
    await sql.connect(sqlConfig);
    const columns = [
      "asset_code", "EQPT_SL_NO", "psno", "status_tag", "current_job_no", "TYPE", "updated_on"
    ];
    const searchKey = type === 'asset_tag' ? "asset_code" : "EQPT_SL_NO";
    const query = `SELECT ${columns.join(',')} FROM office_master WHERE ${searchKey} = @searchValue`;
    const request = new sql.Request();
    const result = await request
        .input('searchValue', sql.VarChar, searchValue)
        .query(query);
    if (result.recordset.length) {
      sqlData = result.recordset[0];
    }
  } catch (err) {
    sqlData = {};
  }

  // 2. Fetch from ServiceNow
  let servData: any = {};
  try {
    const servCol = [
      'asset_tag', 'serial_number', 'assigned_to_employee_number',
      'install_status', 'cost_center', 'model_category', 'updated_on'
    ];
    const servKey = type === 'asset_tag' ? 'asset_tag' : 'serial_number';
    const params = {
      [servKey]: searchValue,
      sysparm_fields: servCol.join(',')
    };
    const response = await axios.get(process.env.SERVICENOW_URL as string, {
      params,
      auth: {
        username: process.env.SERVICENOW_USERNAME as string,
        password: process.env.SERVICENOW_PASSWORD as string
      },
      headers: { 'Accept': 'application/json' }
    });
    if (response.data.result && response.data.result.length) {
      servData = response.data.result[0];
    }
  } catch (err) {
    servData = {};
  }

  // 3. Format response
  res.json({
    columns: [
      "Asset tag", "Serial Number", "Employee Number",
      "State", "Cost Center", "Make & Model", "Updated On"
    ],
    rows: [
      {
        source: "SQL",
        data: [
          sqlData.asset_code || "",
          sqlData.EQPT_SL_NO || "",
          sqlData.psno || "",
          sqlData.status_tag || "",
          sqlData.current_job_no || "",
          sqlData.TYPE || "",
          sqlData.updated_on || ""
        ]
      },
      {
        source: "ServiceNow",
        data: [
          servData.asset_tag || "",
          servData.serial_number || "",
          servData.assigned_to_employee_number || "",
          servData.install_status || "",
          servData.cost_center || "",
          servData.model_category || "",
          servData.updated_on || ""
        ]
      }
    ]
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

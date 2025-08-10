const fs = require("fs");
const path = require("path");
exports.handler = async () => {
  try {
    const p = path.join(__dirname, "data", "branches.json");
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return { statusCode: 200, body: JSON.stringify({ ok:true, branches:data }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};
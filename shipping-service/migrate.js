require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./common/db');

async function run(){
  try{
    const sql = fs.readFileSync(path.join(__dirname,'db','shipments.sql'),'utf8');
    await db.query(sql);
    console.log('Shipping DB migration applied.');
    process.exit(0);
  }catch(err){
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();

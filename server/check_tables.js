const db = require('./src/config/db');
(async ()=>{
  try{
    const [rows] = await db.query("SHOW TABLES LIKE 'project_stages'");
    console.log('project_stages exists:', rows.length>0);
    const [rows2] = await db.query("SHOW TABLES LIKE 'stage_activities'");
    console.log('stage_activities exists:', rows2.length>0);
  }catch(err){
    console.error('DB error:', err.message);
  }finally{ process.exit(0); }
})();

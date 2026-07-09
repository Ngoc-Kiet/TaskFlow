require('dotenv').config();
const connectDB = require('../config/db');
const Project = require('../models/Project');

const migrate = async () => {
  await connectDB();
  const projects = await Project.find({});
  console.log(`Found ${projects.length} projects to migrate.`);

  for (const project of projects) {
    const hasBacklog = project.columns.some(c => c.id === 'backlog');
    if (!hasBacklog) {
      // Add backlog as first column and update orders
      const updatedColumns = [
        { id: 'backlog', title: 'Backlog', color: '#a855f7', order: 0 },
        ...project.columns.map((c, index) => ({
          id: c.id,
          title: c.title,
          color: c.color,
          order: index + 1
        }))
      ];
      project.columns = updatedColumns;
      await project.save();
      console.log(`Migrated project: ${project.name}`);
    } else {
      console.log(`Project already has backlog: ${project.name}`);
    }
  }
  console.log('Migration completed successfully.');
  process.exit(0);
};

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

require('dotenv').config();
const connectDB = require('../config/db');
const Project = require('../models/Project');

const migrate = async () => {
  await connectDB();
  const projects = await Project.find({});
  console.log(`Found ${projects.length} projects to migrate.`);

  for (const project of projects) {
    const cols = project.columns.map(c => c.toObject ? c.toObject() : c);
    
    // Check backlog
    const hasBacklog = cols.some(c => c.id === 'backlog');
    if (!hasBacklog) {
      cols.unshift({ id: 'backlog', title: 'Backlog', color: '#a855f7', order: 0 });
    }

    // Check review
    const hasReview = cols.some(c => c.id === 'review');
    if (!hasReview) {
      const inprogIndex = cols.findIndex(c => c.id === 'inprogress');
      if (inprogIndex !== -1) {
        cols.splice(inprogIndex + 1, 0, { id: 'review', title: 'Review', color: '#f59e0b', order: 0 });
      } else {
        const doneIndex = cols.findIndex(c => c.id === 'done');
        if (doneIndex !== -1) {
          cols.splice(doneIndex, 0, { id: 'review', title: 'Review', color: '#f59e0b', order: 0 });
        } else {
          cols.push({ id: 'review', title: 'Review', color: '#f59e0b', order: 0 });
        }
      }
    }

    // Re-assign order values 0, 1, 2, ...
    const updatedColumns = cols.map((c, idx) => ({
      id: c.id,
      title: c.title,
      color: c.color,
      order: idx
    }));

    project.columns = updatedColumns;
    await project.save();
    console.log(`Migrated columns for project: ${project.name}`);
  }
  console.log('Migration completed successfully.');
  process.exit(0);
};

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

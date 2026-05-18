const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://minhngoc2106:t7qN9a3x6k3RFT3O@cluster0.zox70.mongodb.net/taskflow?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    const tasks = await mongoose.connection.collection('tasks').find({}).toArray();
    for(let t of tasks) {
      if(t.status === 'Medium') console.log('Found Task with status Medium:', t.title, t._id);
    }
    process.exit(0);
  });

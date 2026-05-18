const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createProject, getProjects, getProject,
  updateProject, deleteProject,
  addMember, removeMember, getProjectStats
} = require('../controllers/projectController');
const { getTasks, createTask, reorderTasks } = require('../controllers/taskController');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('admin'), createProject);

router.route('/:id')
  .get(getProject)
  .put(authorize('admin'), updateProject)
  .delete(authorize('admin'), deleteProject);

router.get('/:id/stats', getProjectStats);
router.post('/:id/members', authorize('admin'), addMember);
router.delete('/:id/members/:userId', authorize('admin'), removeMember);

// Tasks under project
router.route('/:projectId/tasks')
  .get(getTasks)
  .post(createTask);

router.put('/:projectId/tasks/reorder', reorderTasks);

module.exports = router;

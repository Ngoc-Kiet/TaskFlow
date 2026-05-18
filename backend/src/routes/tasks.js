const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getTask, updateTask, deleteTask, addComment, deleteComment } = require('../controllers/taskController');

router.use(protect);

router.route('/:id')
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

module.exports = router;

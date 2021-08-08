const { Sequelize, DataTypes} = require('sequelize');
const express = require("express");

const router = express.Router();

const sequelize = new Sequelize({
  host: 'localhost',
  database: 'docker_todo',
  username: 'root',
  password: '123456',
  dialect: 'mariadb',
});

const Todo = sequelize.define('Todo', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING }
}, {});

sequelize.sync({ force: true }).then(() => {
  console.log('已同步');
});

router.get('/', async (req, res) => {
  const todoList = await Todo.findAll();
  res.json({ todoList });
})

router.post('/', async (req, res, next) => {
  const { title, status } = req.body;

  const newTodo = await Todo.create({
    title,
    status: status || 'todo',
  });

  res.json({ todo: newTodo })
});

module.exports = router;

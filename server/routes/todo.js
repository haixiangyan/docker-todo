const { Sequelize, DataTypes} = require('sequelize');
const express = require("express");

const router = express.Router();

// 连接数据库
const sequelize = new Sequelize({
  host: process.env.NODE_ENV === 'docker' ? 'docker-todo-mariadb' : "127.0.0.1" ,
  database: 'docker_todo',
  username: 'root',
  password: '123456',
  dialect: 'mariadb',
});

// 定义 todo model
const Todo = sequelize.define('Todo', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING }
}, {});

// 同步数据库结构
sequelize.sync({ force: true }).then(() => {
  console.log('已同步');
});

router.get('/', async (req, res) => {
  // 获取 todo list
  const todoList = await Todo.findAll();
  res.json({ todoList });
})

router.post('/', async (req, res) => {
  const { title, status } = req.body;

  // 创建一个 todo
  const newTodo = await Todo.create({
    title,
    status: status || 'todo',
  });

  res.json({ todo: newTodo })
});

module.exports = router;

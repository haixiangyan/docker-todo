const express = require('express');
const Redis = require("ioredis");

const router = express.Router();

// 连接 redis
const redis = new Redis({
  port: 6379,
  host: process.env.NODE_ENV === 'docker' ? 'docker-todo-redis' : "127.0.0.1" ,
});

router.get('/', async (req, res) => {
  const count = Number(await redis.get('myCount')) || 0;

  res.json({ myCount: count })
});

router.post('/', async (req, res) => {
  const count = Number(await redis.get('myCount'));
  await redis.set('myCount', count + 1);
  res.json({ myCount: count + 1 })
})

module.exports = router;

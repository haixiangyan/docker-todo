## 前言

相信很多人都很头疼 Docker 的部署，我自己也是。

最近发现一个很有意思的现象：一个人想学某样技术的时候，当学会了之后，但是这时出现了一个问题需要学习另一门技术时，无论这个人前面学得多么刻苦，用功，到这一步有 99% 的概率都会放弃。我愿称这种现象为 **“学习窗口”**。

写一个网站、学会 Vue.js 是很多人的“学习窗口”，只要离开了这个“学习窗口”，他们就不想学了：我都学这么多了，草，怎么最后还要学部署啊。

所以，这篇文章就跟大家分享一下关于 Docker 部署的那些事。

## 需求

按照国际惯例，先从一个非常简单的需求入手，这个需求只完成几件事：

* 显示待办事项列表 + 添加一个待办事项
* 记录网站的访问量

上面就是一个经典到不能再经典的 Todo List 应用。

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea7766e4af914ebb9c0fccf5ea8cd1f7~tplv-k3u1fbpfcp-watermark.image)

分析一下需求：待办事项列表需要用到 **数据库** 完成，记录网站访问量则要用到高速读取的 **缓存** 来完成。

## 技术选型

目前我前端技术栈是 React.js，所以前端用 **React.js**。

由于 Express 有自己的脚手架，所以，后端采用 **Express**。

数据库方面，因为我自己用的是 M1 的 Mac，所以 **mysql** 镜像无法拉取，暂时用 **mariadb** 来代替。

缓存大家都很熟悉了，直接用 **redis** 搞定。

## 前端实现

关于前端的实现非常简单，发请求使用 **axios**。

```tsx
interface Todo {
  id: number;
  title: string;
  status: 'todo' | 'done';
}

const http = axios.create({
  baseURL: 'http://localhost:4200',
})

const App = () => {
  const [newTodoTitle, setNewTodoTitle] = useState<string>('');
  const [count, setCount] = useState(0);
  const [todoList, setTodoList] = useState<Todo[]>([]);

  // 添加 todo
  const addTodo = async () => {
    await http.post('/todo', {
      title: newTodoTitle,
      status: 'todo',
    })
    await fetchTodoList();
  }

  // 获取访问量，并添加一个访问量
  const fetchCount = async () => {
    await http.post('/count');
    const { data } = await http.get('/count');
    setCount(data.myCount);
  }

  // 获取 todo 列表
  const fetchTodoList = async () => {
    const { data } = await http.get('/todo');
    setTodoList(data.todoList);
  }

  useEffect(() => {
    fetchCount().then();
    fetchTodoList().then();
  }, []);

  return (
    <div className="App">
      <header>网站访问量：{count}</header>

      <ul>
        {todoList.map(todo => (
          <li key={todo.id}>{todo.title} - {todo.status}</li>
        ))}
      </ul>

      <div>
        <input value={newTodoTitle} onChange={e => setNewTodoTitle(e.target.value)} type="text"/>
        <button onClick={addTodo}>提交</button>
      </div>
    </div>
  );
}
```

## 后端实现

后端稍微麻烦了一点，要解决的问题有：

* 跨域
* 数据库连接
* Redis 连接

先在 `main.ts` 里配置好路由：

```js
var cors = require('cors')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/count');
var todosRouter = require('./routes/todo');

var app = express();

// 解决跨域
app.use(cors());

// 业务路由
app.use('/', indexRouter);
app.use('/count', usersRouter);
app.use('/todo', todosRouter);

...

module.exports = app;
```

访问量路由需要用到 redis 来实现高速读写：

```js
const express = require('express');
const Redis = require("ioredis");

const router = express.Router();

// 连接 redis
const redis = new Redis({
  port: 6379,
  host: "127.0.0.1",
});

router.get('/', async (req, res, next) => {
  const count = Number(await redis.get('myCount')) || 0;

  res.json({ myCount: count })
});

router.post('/', async (req, res) => {
  const count = Number(await redis.get('myCount'));
  await redis.set('myCount', count + 1);
  res.json({ myCount: count + 1 })
})

module.exports = router;
```

todo 路由里使用 [sequelize]() 这个库来实现数据库连接和初始化：

```js
const { Sequelize, DataTypes} = require('sequelize');
const express = require("express");

const router = express.Router();

// 连接数据库
const sequelize = new Sequelize({
  host: 'localhost',
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

router.post('/', async (req, res, next) => {
  const { title, status } = req.body;

  // 创建一个 todo
  const newTodo = await Todo.create({
    title,
    status: status || 'todo',
  });

  res.json({ todo: newTodo })
});

module.exports = router;
```

## 本地运行

本来使用以下命令就可以跑本地应用了：

```sh
# 前端
cd client && npm run start

# 后端
cd server && npm run start
```

然而，我们本地并没有 mariadb 和 redis，这就有点难受了。

## 启动容器

如果是在以前，我一般会在 Mac 上用下面的命令安装一个 mariadb 和 redis：

```sh
brew install mariadb

brew install redis
```

然后在 **自己电脑** 里一通配置（username, password...），最后才能在本地跑项目，非常麻烦。而且一旦配置错了，草，又要重装。。。

而 Docker 其中一个作用就是将上面 mariadb 和 redis 都打成不同 image（镜像），使用 DockerHub 统一管理，使用 Docker 就可以快速配置一个服务。

以前只能一个电脑装一个 MySQL，现在我能同时跑 8 个 MySQL 容器（不同端口），想删谁删谁，想装谁装谁。遇事不决，先把容器重启，重启不行，再用镜像构建一个容器，构建不行，再拉一个 latest 的镜像，再构建一次，非常的带劲。

废话不多说，先来把 redis 启动：

```sh
docker run --name docker-todo-redis -p 6379:6379 -d redis
```

然后再把 mariadb 启动：

```sh
docker run -p 127.0.0.1:3306:3306  --name docker-todo-mariadb -e MARIADB_ROOT_PASSWORD=123456 MARIADB_DATABASE=docker_todo -d mariadb
```

解释一下参数 `-p` 是端口映射:`本机:容器`，`-e` 指定环境变量，`-d` 表示后台运行。

再次运行：

```sh
# 前端
cd client && npm run start

# 后端
cd server && npm run start
```

可以在 [http://localhost:3000](http://localhost:3000) 看到页面：

![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b597be17e893472d93aa59da6a0695ef~tplv-k3u1fbpfcp-watermark.image)

貌似一切都很 OK 的样子~

## docker-compose

试想一下，如果现在给你一个机器，请问你要怎么部署？你要先跑上面两条 docker 命令，再跑下面两条 npm 的命令，麻烦。

能不能一键拉起 mariadb, redis 2 个容器呢？这就是 `docker-compose.yml` 的由来。创建一个 `dev-docker-compose.yml` 文件：

```yml
version: '3'
services:
  mariadb:
    image: mariadb
    container_name: 'docker-todo-mariadb'
    environment:
      MARIADB_ROOT_PASSWORD: '123456'
      MARIADB_DATABASE: 'docker_todo'
    ports:
      - '3306:3306'
    restart: always
  redis:
    image: redis
    container_name: 'docker-todo-redis'
    ports:
      - '6379:6379'
    restart: always
```

这个 `yml` 文件描述的内容其实就等同于上面两条 docker 命令。好处有两个：

* 不用写一串长长长长长长长长长长长长长长得让人受不了的命令
* 把部署命令记到小本本 `docker-compose.yml` 文件里。问：怎么部署？答：自己看 `docker-compose.yml`
* 一键拉起相关服务

以后，一键跑本地服务的时候就可以一键启动 mariadb 和 redis 了：

```sh
docker-compose -f dev-docker-compose.yml up -d
```

## Dockerfile

不过，在生产环境时每次都要跑 npm 这两条命令还是很烦，能不能把这两行也整全到 docker-compose 里呢？

> 注意：生产环境应该要用 npm run build 构建应用，然后再跑构建出来的 JS 才是正常开发流程，这里为了简化流程，就以 npm run start 来做例子说明。

既然 docker-compose 是通过 image 创建容器的，那么我们的 React App 和 Express App 也打成两个 image，然后用 docker-compose 分别创建容器不就 OK 了么？

构建容器说白了就是我们常说的 “CICD 或者构建流水线”，只不过这个 “流水线” 关键的只有一条 `npm run start`。描述 “流水线” 的叫 `Dockerfile` （注意这里不是驼峰写法）。

> 注意：正常的镜像构建和启动应该是整个项目 CICD 其中的一环，这里只是打个比方。项目的 CICD 除了跑命令，构建应用，还会有代码检查、脱敏检查、发布消息推送等步骤，是更为繁杂的一套流程。

先把 React 的 `Dockerfile` 整了：

```docker
# 使用 node 镜像
FROM node

# 准备工作目录
RUN mkdir -p /app/client
WORKDIR /app/client

# 复制 package.json
COPY package*.json /app/client/

# 安装目录
RUN npm install

# 复制文件
COPY . /app/client/

# 开启 Dev
CMD ["npm", "run", "start"]
```

非常的简单，需要注意的是容器也可以看成一个电脑里的电脑，所以把自己电脑的文件复制到 “容器电脑” 里是非常必要的一步。

Express App 的 `Dockerfile` 和上面的几乎一毛一样：

```docker
# 使用 node 镜像
FROM node

# 初始化工作目录
RUN mkdir -p /app/server
WORKDIR /app/server

# 复制 package.json
COPY package*.json /app/server/

# 安装依赖
RUN npm install

# 复制文件
COPY . /app/server/

# 开启 Dev
CMD ["npm", "run", "start"]
```

那么现在再来改造一个 `prod-docker-compose.yml` 文件：

```yml
version: '3'
services:
  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: 'docker-todo-client'
    # 暴露端口
    expose:
      - 3000
    # 暴露端口
    ports:
      - '3000:3000'
    depends_on:
      - server
    restart: always
  server:
    # 构建目录
    build:
      context: ./server
      dockerfile: Dockerfile
    # 容器名
    container_name: 'docker-todo-server'
    # 暴露端口
    expose:
      - 4200
    # 端口映射
    ports:
      - '4200:4200'
    restart: always
    depends_on:
      - mariadb
      - redis
  mariadb:
    image: mariadb
    container_name: 'docker-todo-mariadb'
    environment:
      MARIADB_ROOT_PASSWORD: '123456'
      MARIADB_DATABASE: 'docker_todo'
    ports:
      - '3306:3306'
    restart: always
  redis:
    image: redis
    container_name: 'docker-todo-redis'
    ports:
      - '6379:6379'
    restart: always
```
上面的配置应该都不难理解，不过，还是有一些细节需要注意：
* 端口都要暴露出来，也要做映射，不然本地也访问不了 3000 和  4200 端口
* depends_on 的作用是等 maraidb 和 redis 两个容器起来了再启动当前容器

然后运行下面命令，一键启动：

```sh
docker-compose -f prod-docker-compose.yml up -d --build
```

后面 `--build` 是指每次跑时都构建一次镜像。

然而，Boom：

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5fa9710dab034a199994989892a03eb7~tplv-k3u1fbpfcp-watermark.image)

```
ConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:3306
...
```

怎么连不上了？

## 解决连不上的问题

连不上的原因是我们这里用了 `localhost` 和 `127.0.0.1`。

**虽然每个容器都在我们主机 `127.0.0.1` 网络里，但是容器之间是需要通过对方的 IP 地址来交流和访问的，[按照官网的介绍](https://docs.docker.com/compose/networking/) 通过 Container Name 就可得知对方容器的 IP。**


![](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7c44032cd039483b97cc8b78a5d85d10~tplv-k3u1fbpfcp-watermark.image)

**因此，Express App 里的 host 不能写 127.0.0.1，而要填 docker-todo-redis 和 docker-todo-mariadb。下面用环境变量 NODE_ENV 来区分是否以 Docker 启动 App。**

修改 mariadb 的连接：

```js
// 连接数据库
const sequelize = new Sequelize({
  host: process.env.NODE_ENV === 'docker' ? 'docker-todo-mariadb' : "127.0.0.1" ,
  database: 'docker_todo',
  username: 'root',
  password: '123456',
  dialect: 'mariadb',
});
```

再修改 redis 的连接：

```js
const redis = new Redis({
  port: 6379,
  host: process.env.NODE_ENV === 'docker' ? 'docker-todo-redis' : "127.0.0.1" ,
});
```

然后在 `/server/Dockerfile` 里添加 `NODE_ENV=docker`：

```docker
# 使用 node 镜像
FROM node

# 初始化工作目录
RUN mkdir -p /app/server
WORKDIR /app/server

# 复制 package.json
COPY package*.json /app/server/

ENV NODE_ENV=docker

# 安装依赖
RUN npm install

# 复制文件
COPY . /app/server/

# 开启 Dev
CMD ["npm", "run", "start"]
```

现在继续运行我们的 “一键启动” 命令，就能启动我们的生产环境了：

```sh
docker-compose -f prod-docker-compose.yml up -d --build
```

## 总结

一句话总结，Dockerfile 是用于构建 Docker 镜像的，跟我们平常接触的 CICD 或者流水线有点类似。而 docker-compose 的作用则是 “一键拉起” N 个容器。

上面整个例子放在 [Github 这里了](https://github.com/Haixiang6123/docker-todo)，可以 Clone 下来自己捣鼓玩玩。

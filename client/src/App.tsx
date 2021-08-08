import React, {useEffect, useState} from 'react';
import axios from "axios";

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

  const addTodo = async () => {
    await http.post('/todo', {
      title: newTodoTitle,
      status: 'todo',
    })
    await fetchTodoList();
  }

  const fetchCount = async () => {
    await http.post('/count');
    const { data } = await http.get('/count');
    setCount(data.myCount);
  }

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
      <header>
        网站访问量：{count}
      </header>

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

export default App;

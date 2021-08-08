import React, {useEffect, useState} from 'react';
import axios from "axios";

interface Todo {
  id: number;
  title: string;
  status: 'todo' | 'done';
}

const baseURL = 'http://localhost:4200';

const App = () => {
  const [count, setCount] = useState(0);
  const [todoList, setTodoList] = useState<Todo[]>([]);

  const fetchCount = async () => {
    await axios.post('/count', {}, { baseURL });
    const { data } = await axios.get('/count', { baseURL });
    setCount(data.myCount);
  }

  useEffect(() => {
    fetchCount().then();
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
    </div>
  );
}

export default App;

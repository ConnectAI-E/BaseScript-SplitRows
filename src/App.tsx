import './App.css';
import { useEffect } from 'react';
import { bitable, UIBuilder } from "@base-open/web-api";
import callback from './runUIBuilder';

export default function App() {
  useEffect(() => {
    UIBuilder.getInstance('#container', { bitable, callback });
  }, []);
  return (
    <div id='container'></div>
  );
}
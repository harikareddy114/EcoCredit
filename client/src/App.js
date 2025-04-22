import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import HomePage from "./Pages/Home";

function App() {
  return (
    <div className="App">
      <HomePage />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;

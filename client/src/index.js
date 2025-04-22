import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import EmployeeDashboard from './Pages/EmployeeDashboard';
import AdminDashboard from './Pages/AdminDashboard';
import LoginPage from './Pages/Login';
import RegisterPage from './Pages/Register';
import EmployerDashboard from './Pages/EmployerDashboard';
import reportWebVitals from './reportWebVitals';

// Protected route component
const ProtectedRoute = ({ children, allowedRole }) => {
  const userString = localStorage.getItem('user');
  
  if (!userString) {
    // No user logged in, redirect to login
    return <Navigate to="/login" replace />;
  }
  
  const user = JSON.parse(userString);
  
  // If allowedRole is specified, verify user has that role
  if (allowedRole && user.role !== allowedRole) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') {
      return <Navigate to="/admin-dashboard" replace />;
    } else if (user.role === 'employer') {
      return <Navigate to="/employer-dashboard" replace />;
    } else if (user.role === 'employee') {
      return <Navigate to="/employee-dashboard" replace />;
    }
    // If unknown role, redirect to login
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// AuthRedirect - Redirects logged-in users to their appropriate dashboard
const AuthRedirect = () => {
  const userString = localStorage.getItem('user');
  
  if (!userString) {
    return <App />;
  }
  
  const user = JSON.parse(userString);
  
  if (user.role === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  } else if (user.role === 'employer') {
    return <Navigate to="/employer-dashboard" replace />;
  } else if (user.role === 'employee') {
    return <Navigate to="/employee-dashboard" replace />;
  }
  
  return <App />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route 
          path="/employee-dashboard" 
          element={
            <ProtectedRoute allowedRole="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/employer-dashboard" 
          element={
            <ProtectedRoute allowedRole="employer">
              <EmployerDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

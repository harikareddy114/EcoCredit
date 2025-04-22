import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const RegisterPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roleFromQuery = queryParams.get("role");
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:9000";

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: roleFromQuery || "employee",
    employerId: "",
    companyName: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [employerList, setEmployerList] = useState([]);

  // Fetch employers from the server when role is employee
  useEffect(() => {
    if (formData.role === "employee") {
      const fetchEmployers = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/auth/employers/public`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setEmployerList(data);
        } catch (error) {
          console.error("Error fetching employers:", error);
          setError("Failed to fetch employers. Please try again later.");
        }
      };

      fetchEmployers();
    }
  }, [formData.role, API_BASE]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Registration successful! Please wait for approval.");
        setFormData({
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: roleFromQuery || "employee",
          employerId: "",
          companyName: "",
        });
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (error) {
      setError("Network error. Please try again later.");
      console.error("Error during registration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex align-items-center py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card shadow-lg">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <h2 className="h3 fw-bold mb-2">Create a new account</h2>
                  <p className="text-muted">
                    Or{" "}
                    <Link to="/login" className="link-purple">
                      sign in to your existing account
                    </Link>
                  </p>
                </div>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="alert alert-success" role="alert">
                    {success}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="username" className="form-label">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      required
                      value={formData.username}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Choose a username"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Enter your email"
                    />
                  </div>

                  {formData.role === "employer" && (
                    <div className="mb-3">
                      <label htmlFor="companyName" className="form-label">
                        Company Name
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        required
                        value={formData.companyName}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="Enter your company name"
                      />
                    </div>
                  )}

                  {formData.role === "employee" && (
                    <div className="mb-3">
                      <label htmlFor="employerId" className="form-label">
                        Select Employer
                      </label>
                      <select
                        id="employerId"
                        name="employerId"
                        required
                        value={formData.employerId}
                        onChange={handleChange}
                        className="form-select"
                      >
                        <option value="">Select your employer</option>
                        {employerList.map((employer) => (
                          <option key={employer._id} value={employer._id}>
                            {employer.companyName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Create a password"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Confirm your password"
                    />
                  </div>

                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="btn btn-purple btn-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Signing up...
                        </>
                      ) : (
                        "Sign up"
                      )}
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <Link to="/" className="text-purple text-decoration-none">
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

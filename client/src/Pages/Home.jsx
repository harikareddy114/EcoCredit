import React from "react";
import { Link } from "react-router-dom";
import "../styles/custom.css";

const HomePage = () => {
  return (
    <div className="min-vh-100 bg-light">
      <div className="container py-5">
        <div className="text-center mb-5">
          <h1 className="display-4 text-purple fw-bold mb-3">
            Carbon Credit Tracker
          </h1>
          <p className="lead text-muted mb-5">
            Track, manage, and trade carbon credits in a sustainable ecosystem
          </p>

          <div className="card shadow-lg mb-5">
            <div className="card-body p-5">
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="text-start">
                    <h2 className="h3 text-dark mb-3">For Employees</h2>
                    <p className="text-muted mb-4">
                      Log your eco-friendly commutes, earn carbon credits, and
                      make a positive impact on the environment.
                    </p>
                    <Link
                      to="/register?role=employee"
                      className="btn btn-purple btn-lg"
                    >
                      Register as Employee
                    </Link>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="text-start">
                    <h2 className="h3 text-dark mb-3">For Employers</h2>
                    <p className="text-muted mb-4">
                      Manage your organization's carbon footprint, incentivize
                      sustainable commuting, and trade carbon credits.
                    </p>
                    <Link
                      to="/register?role=employer"
                      className="btn btn-purple btn-lg"
                    >
                      Register as Employer
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow mb-5">
            <div className="card-body p-4">
              <h2 className="h3 text-dark mb-3">Already have an account?</h2>
              <Link to="/login" className="btn btn-dark btn-lg">
                Login to Dashboard
              </Link>
            </div>
          </div>

          <div className="row g-4 mt-5">
            <div className="col-md-4">
              <div className="card h-100 shadow">
                <div className="card-body p-4 text-center">
                  <div className="rounded-circle bg-purple-light p-3 d-inline-flex mb-3">
                    <i className="bi bi-check-circle text-white fs-4"></i>
                  </div>
                  <h3 className="h4 mb-3">Track Your Impact</h3>
                  <p className="text-muted">
                    Monitor your commute-related carbon savings in real-time
                    with detailed analytics.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card h-100 shadow">
                <div className="card-body p-4 text-center">
                  <div className="rounded-circle bg-purple-light p-3 d-inline-flex mb-3">
                    <i className="bi bi-coin text-white fs-4"></i>
                  </div>
                  <h3 className="h4 mb-3">Earn Credits</h3>
                  <p className="text-muted">
                    Accumulate carbon credits by choosing eco-friendly
                    transportation methods.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card h-100 shadow">
                <div className="card-body p-4 text-center">
                  <div className="rounded-circle bg-purple-light p-3 d-inline-flex mb-3">
                    <i className="bi bi-arrow-left-right text-white fs-4"></i>
                  </div>
                  <h3 className="h4 mb-3">Trade & Exchange</h3>
                  <p className="text-muted">
                    Participate in a carbon credit marketplace with other
                    organizations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-dark text-light py-4 mt-5">
        <div className="container text-center">
          <p className="mb-0">
            &copy; {new Date().getFullYear()} Carbon Credit Tracker. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

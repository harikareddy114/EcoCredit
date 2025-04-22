import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [commutes, setCommutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [employerData, setEmployerData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    totalCommutes: 0,
    totalDistance: 0,
    totalCarbonSaved: 0,
    monthlyCarbonSaved: 0,
  });
  const [newCommute, setNewCommute] = useState({
    date: new Date().toISOString().split("T")[0],
    method: "bike",
    startLocation: "",
    endLocation: "",
    distanceKm: "",
  });
  const [showCreditHistory, setShowCreditHistory] = useState(false);
  const [creditHistory, setCreditHistory] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:9000";

  const CARBON_FACTORS = {
    bike: 0.08,
    walk: 0,
    carpool: 0.04,
    public_transport: 0.02,
    electric_vehicle: 0.05,
    car: 0.1,
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const userString = localStorage.getItem("user");

      console.log("Stored token:", token);
      console.log("Stored user data:", userString);

      if (!token || !userString) {
        console.log("Missing token or user data");
        navigate("/login");
        return;
      }

      const user = JSON.parse(userString);
      console.log("Parsed user data:", user);

      if (user.role !== "employee") {
        console.log("User is not an employee, redirecting");
        navigate(
          user.role === "admin" ? "/admin-dashboard" : "/employer-dashboard"
        );
        return;
      }

      // Fetch user data
      console.log("Fetching user data for ID:", user.id);
      const userResponse = await fetch(
        `${API_BASE}/api/auth/users/${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("User response status:", userResponse.status);
      if (!userResponse.ok) {
        const errorData = await userResponse.json().catch(() => ({}));
        console.error("User response error:", errorData);
        throw new Error(
          `Failed to fetch user data: ${errorData.message || userResponse.statusText
          }`
        );
      }

      const userData = await userResponse.json();
      console.log("Fetched user data:", userData);
      setUserData(userData);

      // Fetch employer data
      if (userData.employerId) {
        const employerResponse = await fetch(
          `${API_BASE}/api/auth/users/${userData.employerId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (employerResponse.ok) {
          const employerData = await employerResponse.json();
          setEmployerData(employerData);
        }
      }

      // Fetch commutes
      const commutesResponse = await fetch(
        `${API_BASE}/api/commutes?employeeId=${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (commutesResponse.ok) {
        const commutesData = await commutesResponse.json();
        setCommutes(commutesData);
      }

      // Fetch stats
      const statsResponse = await fetch(
        `${API_BASE}/api/stats/employee/${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Error in fetchData:", err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCommute((prev) => ({ ...prev, [name]: value }));
  };

  const calculateCarbonSaved = (method, distance) => {
    const baseEmission = CARBON_FACTORS.car * distance; // Base car emission
    const actualEmission = CARBON_FACTORS[method] * distance;
    return Number((baseEmission - actualEmission).toFixed(2)); // Round to 2 decimal places
  };

  const calculateCredits = (carbonSaved) => {
    return carbonSaved > 0 ? Number(carbonSaved.toFixed(2)) : 0; // Ensure credits are rounded to 1 decimal place
  };

  const handleAddCommute = async () => {
    try {
      const token = localStorage.getItem("token");
      const userString = localStorage.getItem("user");
      const user = JSON.parse(userString);

      const carbonSaved = calculateCarbonSaved(
        newCommute.method,
        parseFloat(newCommute.distanceKm)
      );

      const response = await fetch(`${API_BASE}/api/commutes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newCommute,
          employeeId: user.id,
          carbonSaved: carbonSaved,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setNewCommute({
          date: new Date().toISOString().split("T")[0],
          method: "bike",
          startLocation: "",
          endLocation: "",
          distanceKm: "",
        });
        fetchData(); // Refresh data
      } else {
        throw new Error("Failed to add commute");
      }
    } catch (err) {
      console.error("Error adding commute:", err);
      setError(err.message);
    }
  };

  const transportCounts = commutes.reduce((acc, curr) => {
    acc[curr.method] = (acc[curr.method] || 0) + 1;
    return acc;
  }, {});

  const totalCommutes = commutes.length;
  const totalCarbonSaved = commutes.reduce(
    (acc, curr) => acc + (curr.carbonSaved || 0),
    0
  );

  const handleViewCreditHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const userString = localStorage.getItem("user");
      const user = JSON.parse(userString);

      let url = `${API_BASE}/api/commutes/employee/${user.id}/history`;
      if (selectedDateRange.startDate && selectedDateRange.endDate) {
        url += `?startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const historyData = await response.json();
        setCreditHistory(historyData);
        setShowCreditHistory(true);
      } else {
        throw new Error("Failed to fetch credit history");
      }
    } catch (err) {
      console.error("Error fetching credit history:", err);
      setError(err.message);
    }
  };

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-dark bg-purple shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-bold">Carbon Credit Tracker</span>
          <div className="d-flex align-items-center">
            <span className="text-white me-3">
              Welcome, {userData?.username || "User"}
            </span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {isLoading && !commutes.length ? (
        <div className="min-vh-100 bg-light d-flex justify-content-center align-items-center">
          <div className="spinner-border text-purple" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : error ? (
        <div className="min-vh-100 bg-light d-flex justify-content-center align-items-center">
          <div className="alert alert-danger">
            {error}. Please <Link to="/login">login again</Link>.
          </div>
        </div>
      ) : (
        <div className="container py-5">
          <div className="row g-4 mb-5">
            <div className="col-md-4">
              <div className="card shadow h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-purple p-3 text-white me-3">
                      <i className="bi bi-coin fs-4"></i>
                    </div>
                    <div>
                      <h6 className="text-muted mb-2">Your Carbon Credits</h6>
                      <h2 className="display-6 fw-bold text-purple mb-0">
                        {userData?.carbonCredits.toFixed(2) || 0}
                      </h2>
                      <p className="text-muted small mt-2">
                        Earned through sustainable commuting
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-8">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h5 className="card-title mb-4">Quick Actions</h5>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <button
                        className="btn btn-purple w-100"
                        onClick={() => setShowModal(true)}
                      >
                        <i className="bi bi-plus-circle me-2"></i>
                        Log New Commute
                      </button>
                    </div>
                    <div className="col-sm-6">
                      <button
                        className="btn btn-purple w-100"
                        onClick={() => setShowCreditHistory(true)}
                      >
                        <i className="bi bi-clock-history me-2"></i>
                        View Credit History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger mb-4">
              {error}
              <button
                type="button"
                className="btn-close float-end"
                onClick={() => setError("")}
              />
            </div>
          )}

          <div className="card shadow mb-5">
            <div className="card-header bg-white py-3">
              <h5 className="card-title mb-0">Recent Commutes</h5>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Route</th>
                    <th>Distance</th>
                    <th>Carbon Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {commutes.length > 0 ? (
                    commutes.map((commute) => (
                      <tr key={commute._id || commute.id}>
                        <td>{formatDate(commute.date)}</td>
                        <td>
                          <span
                            className={`badge ${commute.method === "bike"
                                ? "bg-primary"
                                : commute.method === "walk"
                                  ? "bg-success"
                                  : "bg-purple"
                              }`}
                          >
                            {commute.method.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          {commute.startLocation} to {commute.endLocation}
                        </td>
                        <td>{commute.distanceKm} km</td>
                        <td className="fw-bold text-success">
                          {commute.carbonSaved.toFixed(2)} kg CO₂
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-muted">
                        No commutes logged yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {commutes.length > 5 && (
              <div className="card-footer bg-white text-end">
                <Link
                  to="/commutes"
                  className="text-purple text-decoration-none"
                >
                  View all commutes <i className="bi bi-arrow-right"></i>
                </Link>
              </div>
            )}
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h5 className="card-title mb-4">Environmental Impact</h5>
                  <div className="text-center">
                    <p className="text-muted mb-3">
                      Your sustainable commuting has prevented:
                    </p>
                    <h2 className="display-5 text-purple fw-bold mb-2">
                      {totalCarbonSaved > 0 ? `${totalCarbonSaved.toFixed(2)} kg` : "0 kg"}
                    </h2>
                    <p className="text-muted mb-4">of CO₂ emissions</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h5 className="card-title mb-4">Transportation Breakdown</h5>
                  <div className="d-flex flex-column gap-3">
                    {totalCommutes > 0 ? (
                      Object.keys(transportCounts).map((method) => {
                        const percentage = (
                          (transportCounts[method] / totalCommutes) *
                          100
                        ).toFixed(1);
                        return (
                          <div key={method}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="text-capitalize">
                                {method.replace("_", " ")}
                              </span>
                              <span className="text-muted small">
                                {transportCounts[method]} trips ({percentage}%)
                              </span>
                            </div>
                            <div
                              className="progress"
                              style={{ height: "10px" }}
                            >
                              <div
                                className="progress-bar bg-purple"
                                style={{ width: `${percentage}%` }}
                                role="progressbar"
                                aria-valuenow={percentage}
                                aria-valuemin="0"
                                aria-valuemax="100"
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted text-center py-3">
                        No transportation data available yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Commute Modal */}
      <div
        className={`modal fade ${showModal ? "show d-block" : ""}`}
        tabIndex="-1"
        style={{ backgroundColor: showModal ? "rgba(0,0,0,0.5)" : "" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Log New Commute</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
                disabled={isLoading}
              ></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label htmlFor="date" className="form-label">
                    Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    id="date"
                    name="date"
                    value={newCommute.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="method" className="form-label">
                    Transportation Method
                  </label>
                  <select
                    className="form-select"
                    id="method"
                    name="method"
                    value={newCommute.method}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="bike">Bike</option>
                    <option value="car">Car</option>
                    <option value="walk">Walking</option>
                    <option value="carpool">Carpool</option>
                    <option value="public_transport">Public Transport</option>
                    <option value="electric_vehicle">Electric Vehicle</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="startLocation" className="form-label">
                    Start Location
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="startLocation"
                    name="startLocation"
                    value={newCommute.startLocation}
                    onChange={handleInputChange}
                    placeholder="e.g. Home"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="endLocation" className="form-label">
                    End Location
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="endLocation"
                    name="endLocation"
                    value={newCommute.endLocation}
                    onChange={handleInputChange}
                    placeholder="e.g. Office"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="distanceKm" className="form-label">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="distanceKm"
                    name="distanceKm"
                    value={newCommute.distanceKm}
                    onChange={handleInputChange}
                    min="0.1"
                    step="0.1"
                    required
                  />
                </div>
                {newCommute.distanceKm && newCommute.method && (
                  <div className="alert alert-info">
                    <div>
                      Estimated carbon saved:{" "}
                      {calculateCarbonSaved(
                        newCommute.method,
                        parseFloat(newCommute.distanceKm)
                      ).toFixed(2)}{" "}
                      kg CO₂
                    </div>
                    <div>
                      Credits to earn:{" "}
                      {calculateCredits(
                        calculateCarbonSaved(
                          newCommute.method,
                          parseFloat(newCommute.distanceKm)
                        )
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-purple text-white"
                onClick={handleAddCommute}
                disabled={
                  !newCommute.date ||
                  !newCommute.method ||
                  !newCommute.startLocation ||
                  !newCommute.endLocation ||
                  !newCommute.distanceKm ||
                  isLoading
                }
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : (
                  "Save Commute"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Credit History Modal */}
      {showCreditHistory && (
        <>
          <div className="modal-backdrop show"></div>
          <div className="modal show" style={{ display: "block" }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Credit History</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowCreditHistory(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Date Range</label>
                    <div className="d-flex gap-2">
                      <input
                        type="date"
                        className="form-control"
                        value={selectedDateRange.startDate}
                        onChange={(e) =>
                          setSelectedDateRange({
                            ...selectedDateRange,
                            startDate: e.target.value,
                          })
                        }
                      />
                      <input
                        type="date"
                        className="form-control"
                        value={selectedDateRange.endDate}
                        onChange={(e) =>
                          setSelectedDateRange({
                            ...selectedDateRange,
                            endDate: e.target.value,
                          })
                        }
                      />
                      <button
                        className="btn btn-purple"
                        onClick={handleViewCreditHistory}
                      >
                        Filter
                      </button>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Distance (km)</th>
                          <th>Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditHistory.length > 0 ? (
                          creditHistory.map((entry, index) => (
                            <tr key={index}>
                              <td>{formatDate(entry.date)}</td>
                              <td>
                                <span
                                  className={`badge ${entry.method === "bike"
                                      ? "bg-primary"
                                      : entry.method === "walk"
                                        ? "bg-success"
                                        : "bg-purple"
                                    }`}
                                >
                                  {entry.method}
                                </span>
                              </td>
                              <td>{entry.distance.toFixed(2)}</td>
                              <td className="fw-bold text-purple">
                                {(entry.credits / 10).toFixed(2)}
                              </td>
                              <td>
                                <span
                                  className={`badge ${entry.status === "approved"
                                      ? "bg-success"
                                      : entry.status === "rejected"
                                        ? "bg-danger"
                                        : "bg-warning"
                                    }`}
                                ></span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="5"
                              className="text-center py-4 text-muted"
                            >
                              No credit history available for the selected
                              period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeDashboard;

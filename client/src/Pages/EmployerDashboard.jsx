import React, { useState, useEffect } from "react";
import {useNavigate } from "react-router-dom";
import "../styles/custom.css";
import { toast } from "react-toastify";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import emailjs from '@emailjs/browser';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const sendEmail = (toEmail, title, message,name="Admin",time=new Date.now().toLocaleString()) => {
  emailjs.send(
    'service_bhnkwwo',     // From EmailJS dashboard
    'template_gkdij8p',    // From EmailJS dashboard
    {
      to_email: toEmail,
      title: title,
      message: message,
      name: name,
      time: time,
    },
    'snCTw93qpRp7PMycC'      // From EmailJS dashboard
  )
  .then((res) => console.log('Email sent!'))
  .catch((err) => console.error('Error:', err));
};

const EmployerDashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [approvedEmployees, setApprovedEmployees] = useState([]);
  const [pendingEmployees, setPendingEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalCarbonCredits: 0,
    totalTransactions: 0,
    monthlyCarbonCredits: 0,
  });
  const [actionInProgress, setActionInProgress] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeleteConfirmModal, setDeleteConfirmModal] = useState({
    show: false,
    employeeId: null,
    employeeName: "",
  });
  const [showSetTradeModal, setShowSetTradeModal] = useState(false);
  const [showViewTradeModal, setShowViewTradeModal] = useState(false);
  const [tradeCredits, setTradeCredits] = useState("");
  const [availableTrades, setAvailableTrades] = useState([]);
  const [tradingHistory, setTradingHistory] = useState({
    totalCredits: 0,
    tradeHistory: [],
  });

  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:9000";

  // Fetch data when component mounts or refreshKey changes
  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user"));

        if (!token || !user) {
          navigate("/login");
          return;
        }

        if (user.role !== "employer") {
          navigate("/");
          return;
        }

        // Fetch employer data
        const employerResponse = await fetch(
          `${API_BASE}/api/auth/users/${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!employerResponse.ok) {
          throw new Error("Failed to fetch employer data");
        }

        const employerData = await employerResponse.json();
        setUserData(employerData);

        // Fetch employees
        const employeesResponse = await fetch(
          `${API_BASE}/api/auth/employer/${user.id}/employees`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!employeesResponse.ok) {
          throw new Error("Failed to fetch employees");
        }

        const employeesData = await employeesResponse.json();
        setApprovedEmployees(employeesData.approved || []);
        setPendingEmployees(employeesData.pending || []);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error.message);
        toast.error("Failed to fetch dashboard data");
        setIsLoading(false);
      }
    };

    fetchEmployeeData();
  }, [navigate, refreshKey, API_BASE]);

  // Add new useEffect for fetching trading history
  useEffect(() => {
    const fetchTradingHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user"));

        if (!token || !user) return;

        const response = await fetch(
          `${API_BASE}/api/trading/company-history/${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to fetch trading history"
          );
        }

        const data = await response.json();
        console.log("Trading history data:", data); // Debug log
        setTradingHistory(data);
      } catch (error) {
        console.error("Error fetching trading history:", error);
        toast.error(error.message || "Failed to fetch trading history");
      }
    };

    fetchTradingHistory();
  }, [API_BASE, refreshKey]); // Add refreshKey to update after trades

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleApproveEmployee = async (employeeId) => {
    try {
      setActionInProgress(true);
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));

      // Optimistically update UI
      setPendingEmployees((current) =>
        current.filter((emp) => emp._id !== employeeId)
      );

      const response = await fetch(
        `${API_BASE}/api/auth/approve-employee/${employeeId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ approvedBy: user.id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to approve employee");
      }

      // Update approved employees list
      if (data.employee) {
        setApprovedEmployees((current) => [...current, data.employee]);
      }

      toast.success("Employee approved successfully");

      const employee = pendingEmployees.find(emp => emp._id === employeeId);
      sendEmail(
        employee.email,
        "Approval Notification",
        `Hi\n\nYour employee registration has been approved. You can now login and use the system.\n\nRegards,\n${userData.companyName}`,
        userData.companyName,
        new Date().toLocaleString()
      );

      // Trigger a refresh
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error approving employee:", error);
      toast.error(error.message || "Failed to approve employee");
      // Revert optimistic update by triggering refresh
      setRefreshKey((prev) => prev + 1);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectEmployee = async (employeeId) => {
    try {
      setActionInProgress(true);
      const token = localStorage.getItem("token");

      // Optimistically update UI
      setPendingEmployees((current) =>
        current.filter((emp) => emp._id !== employeeId)
      );

      const response = await fetch(
        `${API_BASE}/api/auth/reject-employee/${employeeId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reject employee");
      }

      toast.success("Employee rejected successfully");

      const employee = pendingEmployees.find(emp => emp._id === employeeId);
      sendEmail(
        employee.email,
        "Rejection Notification",
        `Hi\n\nYour employee registration has been Rejected.`,
        userData.companyName,
        new Date().toLocaleString()
      );
      // Trigger a refresh
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error rejecting employee:", error);
      toast.error(error.message || "Failed to reject employee");
      // Revert optimistic update by triggering refresh
      setRefreshKey((prev) => prev + 1);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    try {
      setActionInProgress(true);
      const token = localStorage.getItem("token");

      // Delete the employee from the User model
      const response = await fetch(`${API_BASE}/api/auth/users/${employeeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete employee");
      }

      // Update the approved employees list
      setApprovedEmployees((current) =>
        current.filter((emp) => emp._id !== employeeId)
      );

      // Update total team credits after deletion
      const updatedTotalTeamCredits = (approvedEmployees || [])
        .filter((emp) => emp._id !== employeeId)
        .reduce(
          (total, emp) => total + (emp.carbonCredits || 0),
          userData?.carbonCredits || 0
        );

      setStats((prev) => ({
        ...prev,
        totalCarbonCredits: updatedTotalTeamCredits,
      }));

      toast.success("Employee deleted successfully");

      // Refresh the data
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error(error.message || "Failed to delete employee");
    } finally {
      setActionInProgress(false);
      setDeleteConfirmModal({
        show: false,
        employeeId: null,
        employeeName: null,
      });
    }
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/auth/users/${userData._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }

      const data = await response.json();
      setUserData(data);

      // Update stats with new user data
      setStats((prev) => ({
        ...prev,
        totalCarbonCredits: data.carbonCredits || 0,
      }));
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to refresh user data");
    }
  };

  const handleSetTrade = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // Validate credits
      const credits = parseFloat(tradeCredits);
      if (isNaN(credits) || credits <= 0) {
        throw new Error("Please enter a valid credit amount");
      }

      // Check if credits exceed team total
      if (credits > totalTeamCredits) {
        throw new Error(
          `Insufficient team credits. You have ${totalTeamCredits} credits available.`
        );
      }

      const response = await fetch(`${API_BASE}/api/trading/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credits: credits,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.availableCredits !== undefined) {
          throw new Error(
            `Insufficient team credits. You have ${data.availableCredits} credits available (${data.employerCredits} from employer, ${data.employeeCredits} from employees), but requested ${data.requestedCredits}`
          );
        }
        throw new Error(data.message || "Failed to create trade");
      }

      toast.success("Trade created successfully");
      setShowSetTradeModal(false);
      setTradeCredits("");

      // Update team credits in the UI
      if (data.updatedTeamCredits) {
        setStats((prev) => ({
          ...prev,
          totalCarbonCredits: data.updatedTeamCredits.total,
        }));
      }

      // Refresh available trades and user data
      await Promise.all([fetchAvailableTrades(), fetchUserData()]);
    } catch (error) {
      console.error("Error creating trade:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptTrade = async (tradeId) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/api/trading/accept/${tradeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to accept trade");
      }
      toast.success("Trade accepted successfully");

      // Refresh available trades and user data
      await Promise.all([fetchAvailableTrades(), fetchUserData()]);
    } catch (error) {
      console.error("Error accepting trade:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableTrades = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/trading/available`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to fetch available trades"
        );
      }

      const data = await response.json();
      setAvailableTrades(data);
    } catch (error) {
      console.error("Error fetching available trades:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this effect to refresh trades when the view modal is opened
  useEffect(() => {
    if (showViewTradeModal) {
      fetchAvailableTrades();
    }
  }, [showViewTradeModal]);

  // Calculate total team credits
  const totalTeamCredits = (approvedEmployees || [])
    .reduce(
      (total, emp) => total + (emp.carbonCredits || 0),
      userData?.carbonCredits || 0
    )
    .toFixed(2);

  // Prepare chart data
  const chartData = {
    labels: ["Total Credits", "Trade In", "Trade Out"],
    datasets: [
      {
        label: "Carbon Credits",
        data: [
          tradingHistory.totalCredits || 0,
          tradingHistory.tradeHistory
            ?.filter((trade) => {
              console.log("Trade:", trade);
              return trade.type === "in" && trade.status === "accepted";
            })
            .reduce((sum, trade) => {
              console.log("Adding IN trade amount:", trade.amount);
              return sum + trade.amount;
            }, 0) || 0,
          tradingHistory.tradeHistory
            ?.filter((trade) => {
              console.log("Trade:", trade);
              return (
                trade.type === "out" &&
                (trade.status === "accepted" || trade.status === "available")
              );
            })
            .reduce((sum, trade) => {
              console.log("Adding OUT trade amount:", trade.amount);
              return sum + trade.amount;
            }, 0) || 0,
        ],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",
          "rgba(54, 162, 235, 0.6)",
          "rgba(255, 99, 132, 0.6)",
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 99, 132, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Company Carbon Credits Overview",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Credits",
        },
      },
    },
  };

  if (isLoading) {
    return (
      <div className="min-vh-100 bg-light d-flex justify-content-center align-items-center">
        <div className="spinner-border text-purple" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-vh-100 bg-light">
        <nav className="navbar navbar-expand-lg navbar-dark bg-purple shadow-sm">
          <div className="container">
            <span className="navbar-brand fw-bold">Carbon Credit Tracker</span>
            <div className="d-flex align-items-center">
              <span className="text-white me-3">
                Welcome, {userData.username}
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

        {error && (
          <div className="container mt-3">
            <div className="alert alert-danger">{error}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-dark bg-purple shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-bold">Carbon Credit Tracker</span>
          <div className="d-flex align-items-center">
            <span className="text-white me-3">
              Welcome, {userData.username}
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

      {error && (
        <div className="container mt-3">
          <div className="alert alert-danger">{error}</div>
        </div>
      )}

      <div className="container py-5">
        {/* Company Information Card */}
        <div className="card mb-4 shadow-sm border-0">
          <div className="card-body">
            <h4 className="mb-4 fw-bold border-bottom pb-2">Company Information</h4>

            <dl className="row mb-0">
              <dt className="col-sm-4 text-muted">Company Name</dt>
              <dd className="col-sm-8 text-purple fs-5">{userData.companyName || "N/A"}</dd>

              <dt className="col-sm-4 text-muted mt-3">Email</dt>
              <dd className="col-sm-8 text-purple fs-5 mt-3">{userData.email || "N/A"}</dd>
            </dl>
          </div>
        </div>


        {/* Admin-styled Pending Employee Approvals */}
        <div className="card shadow mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="card-title mb-0">Pending Employee Approvals</h5>
          </div>
          <div className="card-body">
            {pendingEmployees?.length === 0 ? (
              <p className="text-center mb-0">No pending employee approvals</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEmployees.map((employee) => (
                      <tr key={employee._id}>
                        <td>{employee.username || "N/A"}</td>
                        <td>{employee.email || "N/A"}</td>
                        <td>
                          {employee.createdAt
                            ? new Date(employee.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                            : "N/A"}
                        </td>
                        <td>
                          <button
                            onClick={() => handleApproveEmployee(employee._id)}
                            disabled={actionInProgress}
                            className="btn btn-sm btn-success me-2"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectEmployee(employee._id)}
                            disabled={actionInProgress}
                            className="btn btn-sm btn-danger"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Statistics */}
        <div className="row g-4 mb-5">
          <div className="col-md-6">
            <div className="card shadow h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple-light p-3 text-white me-3">
                    <i className="bi bi-person-badge fs-4"></i>
                  </div>
                  <div>
                    <h6 className="text-muted mb-2">Total Employees</h6>
                    <h2 className="display-6 fw-bold text-purple mb-0">
                      {approvedEmployees?.length || 0}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card shadow h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple-light p-3 text-white me-3">
                    <i className="bi bi-coin fs-4"></i>
                  </div>
                  <div>
                    <h6 className="text-muted mb-2">Total Team Credits</h6>
                    <h2 className="display-6 fw-bold text-purple mb-0">
                      {totalTeamCredits}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Management */}
        <div className="row g-4 mb-5">
          <div className="col-12-lg-8">
            <div className="card shadow">
              <div className="card-header bg-white py-3">
                <h5 className="card-title mb-0">Employee Management</h5>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Username</th>
                      <th>Carbon Credits</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedEmployees.map((employee) => (
                      <tr key={employee._id}>
                        <td>{employee.username || "N/A"}</td>
                        <td>
                          <span className="fw-medium">
                            {employee.carbonCredits.toFixed(2) || 0}
                          </span>
                          <span className="text-muted ms-1">credits</span>
                        </td>
                        <td>
                          {employee.createdAt
                            ? new Date(employee.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                            : "N/A"}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-purple me-2"
                            onClick={() =>
                              setDeleteConfirmModal({
                                show: true,
                                employeeId: employee._id,
                                employeeName: employee.username,
                              })
                            }
                            disabled={actionInProgress}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Card */}
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0">Company Trading</h5>
          </div>
          <div className="card-body">
            <div className="d-flex gap-3">
              <button
                className="btn btn-purple"
                onClick={() => setShowSetTradeModal(true)}
                disabled={isLoading}
              >
                Set Trading
              </button>
              <button
                className="btn btn-purple"
                onClick={() => {
                  setShowViewTradeModal(true);
                  fetchAvailableTrades();
                }}
                disabled={isLoading}
              >
                View Trading
              </button>
            </div>
          </div>
        </div>

        {/* Add Trading History Graph */}
        <div className="card shadow mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="card-title mb-0">Carbon Credits Overview</h5>
          </div>
          <div className="card-body">
            <div style={{ height: "400px" }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal.show && (
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirm Delete</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() =>
                      setDeleteConfirmModal({
                        show: false,
                        employeeId: null,
                        employeeName: null,
                      })
                    }
                  ></button>
                </div>
                <div className="modal-body">
                  <p>
                    Are you sure you want to delete employee{" "}
                    <strong>{showDeleteConfirmModal.employeeName}</strong>? This
                    action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setDeleteConfirmModal({
                        show: false,
                        employeeId: null,
                        employeeName: null,
                      })
                    }
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() =>
                      handleDeleteEmployee(showDeleteConfirmModal.employeeId)
                    }
                    disabled={actionInProgress}
                  >
                    {actionInProgress ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Set Trading Modal */}
        {showSetTradeModal && (
          <div className="modal show" style={{ display: "block" }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Set Trading Offer</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowSetTradeModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Credit Amount</label>
                    <input
                      type="number"
                      className="form-control"
                      value={tradeCredits}
                      onChange={(e) => setTradeCredits(e.target.value)}
                      placeholder="Enter credit amount"
                    />
                    {tradeCredits > totalTeamCredits && (
                      <div className="text-danger mt-2">
                        Entered credits exceed available team credits ({totalTeamCredits}).
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSetTradeModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-purple"
                    onClick={handleSetTrade}
                    disabled={isLoading || !tradeCredits || tradeCredits > totalTeamCredits}
                  >
                    {isLoading ? "Setting..." : "Set Trading"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Trading Modal */}
        {showViewTradeModal && (
          <div className="modal show" style={{ display: "block" }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Available Trades</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowViewTradeModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {isLoading ? (
                    <div className="text-center">
                      <div className="spinner-border text-purple" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableTrades.map((trade) => (
                            <tr key={trade._id}>
                              <td>{trade.companyName}</td>
                              <td>{trade.amount} credits</td>
                              <td>
                                {new Date(trade.createdAt).toLocaleDateString()}
                              </td>
                              <td>
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleAcceptTrade(trade._id)}
                                  disabled={isLoading}
                                >
                                  Accept
                                </button>
                              </td>
                            </tr>
                          ))}
                          {availableTrades.length === 0 && (
                            <tr>
                              <td colSpan="4" className="text-center">
                                No available trades
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowViewTradeModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployerDashboard;

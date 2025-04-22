import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Pie, Bar, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement } from "chart.js";
import emailjs from '@emailjs/browser';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement);

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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    employers: 0,
    employees: 0,
    totalCredits: 0,
    totalTransactions: 0,
  });
  const [pendingEmployers, setPendingEmployers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employers, setEmployers] = useState([]);
  const [tradings, setTradings] = useState([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [chartData, setChartData] = useState({
    userDistribution: null,
    tradingTrends: null,
    creditDistribution: null,
    tradingStatusDistribution: null,
    topEmployers: null,
  });

  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:9000";

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));

      if (!token || !user) {
        navigate("/login");
        return;
      }

      if (user.role !== "admin") {
        navigate("/");
        return;
      }

      // Fetch employers
      const employersResponse = await fetch(
        `${API_BASE}/api/auth/employers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!employersResponse.ok) {
        throw new Error("Failed to fetch employers");
      }

      const employersData = await employersResponse.json();
      setEmployers(employersData);

      // Fetch pending employers
      const pendingEmployersResponse = await fetch(
        `${API_BASE}/api/auth/users/pending/employers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (pendingEmployersResponse.ok) {
        const pendingEmployersData = await pendingEmployersResponse.json();
        setPendingEmployers(pendingEmployersData);
      } else {
        console.error("Failed to fetch pending employers");
      }

      // Fetch trades
      const tradesResponse = await fetch(`${API_BASE}/api/trading/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json();
        setTradings(tradesData);

        // Update stats with trades count
        const statsResponse = await fetch(`${API_BASE}/api/stats/system`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            ...statsData,
            totalTransactions: tradesData.length,
          });
          prepareChartData(statsData, tradesData);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
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

  const handleApproveEmployer = async (pendingId) => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));
      const employer = pendingEmployers.find(emp => emp._id === pendingId);

      console.log("Approving employer with ID:", pendingId);
      console.log("User ID:", user.id);
      console.log("Request URL:", `${API_BASE}/api/auth/approve/${pendingId}`);
      console.log("Request method: POST");

      const response = await fetch(
        `${API_BASE}/api/auth/approve/${pendingId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approvedBy: user.id }),
        }
      );

      console.log("Response status:", response.status);

      if (response.ok) {
        // Refresh pending employers
        const pendingEmployersResponse = await fetch(
          `${API_BASE}/api/auth/users/pending/employers`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        sendEmail(
          employer.email,
          "Approval Notification",
          `Hi\n\nYour employer registration has been approved. You can now login and use the system.\n\nRegards,\nAdmin`,
          "Admin",
          new Date().toLocaleString()
        );

        if (pendingEmployersResponse.ok) {
          const pendingEmployersData = await pendingEmployersResponse.json();
          setPendingEmployers(pendingEmployersData);
        } else {
          console.error("Failed to fetch pending employers");
        }

        // Refresh all users
        fetchData();
        toast.success("Employer approved successfully");
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(errorData.message || "Failed to approve employer");
      }
    } catch (err) {
      console.error("Error approving employer:", err);
      setError(err.message);
      toast.error(err.message);
    }
  };

  const handleRejectEmployer = async (pendingId) => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));
      const employer = pendingEmployers.find(emp => emp._id === pendingId);

      const response = await fetch(`${API_BASE}/api/auth/reject/${pendingId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rejectedBy: user.id }),
      });

      if (response.ok) {
        // Refresh pending employers
        const pendingEmployersResponse = await fetch(
          `${API_BASE}/api/auth/users/pending/employers`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        sendEmail(
          employer.email,
          "Rejection Notification",
          `Hi\n\nWe regret to inform you that your employer registration has been rejected.\n\nRegards,\nAdmin`,
          "Admin",
          new Date().toLocaleString()
        );

        if (pendingEmployersResponse.ok) {
          const pendingEmployersData = await pendingEmployersResponse.json();
          setPendingEmployers(pendingEmployersData);
        } else {
          console.error("Failed to fetch pending employers");
        }

        toast.success("Employer rejected successfully");
      } else {
        throw new Error("Failed to reject employer");
      }
    } catch (err) {
      console.error("Error rejecting employer:", err);
      setError(err.message);
      toast.error(err.message);
    }
  };
  const handleDeleteEmployer = async (employerId) => {
    try {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this employer and all associated employees?"
      );

      if (!confirmDelete) {
        return;
      }

      const token = localStorage.getItem("token");

      // First delete all employees of this employer
      const deleteEmployeesResponse = await fetch(
        `${API_BASE}/api/auth/employer/${employerId}/employees`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!deleteEmployeesResponse.ok) {
        const errorData = await deleteEmployeesResponse.json();
        throw new Error(
          errorData.message || "Failed to delete employer's employees"
        );
      }

      // Then delete the employer from User model
      const deleteEmployerResponse = await fetch(
        `${API_BASE}/api/auth/users/${employerId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!deleteEmployerResponse.ok) {
        const errorData = await deleteEmployerResponse.json();
        throw new Error(errorData.message || "Failed to delete employer");
      }

      // Update the employers list
      setEmployers(employers.filter((emp) => emp._id !== employerId));

      // Update stats
      setStats((prev) => ({
        ...prev,
        employers: prev.employers - 1,
        totalUsers: prev.totalUsers - 1, // This will be updated properly on next fetch
      }));

      toast.success("Employer and associated employees deleted successfully");

      // Refresh the data
      fetchData();
    } catch (error) {
      console.error("Error deleting employer:", error);
      toast.error(error.message);
    }
  };

  const fetchTrades = async () => {
    try {
      setIsLoadingTrades(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/trading/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch trades");
      }

      const data = await response.json();
      setTradings(data);

      // Update stats with new trades count
      setStats((prev) => ({
        ...prev,
        totalTransactions: data.length,
      }));
    } catch (error) {
      console.error("Error fetching trades:", error);
      toast.error("Failed to fetch trades");
    } finally {
      setIsLoadingTrades(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  // ----------
  // Prepare chart data
  const prepareChartData = (statsData, tradesData) => {
    // User distribution pie chart
    const userDistributionData = {
      labels: ["Employers", "Employees"],
      datasets: [
        {
          data: [statsData.employers, statsData.employees],
          backgroundColor: [
            "rgba(54, 162, 235, 0.6)",
            "rgba(75, 192, 192, 0.6)",
          ],
          borderColor: ["rgba(54, 162, 235, 1)", "rgba(75, 192, 192, 1)"],
          borderWidth: 1,
        },
      ],
    };

    // Trading trends line chart
    // Group trades by month
    const tradesByMonth = {};
    tradesData.forEach((trade) => {
      const date = new Date(trade.createdAt);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      if (!tradesByMonth[monthYear]) {
        tradesByMonth[monthYear] = 0;
      }
      tradesByMonth[monthYear]++;
    });

    const sortedMonths = Object.keys(tradesByMonth).sort((a, b) => {
      const [monthA, yearA] = a.split("/");
      const [monthB, yearB] = b.split("/");
      return new Date(yearA, monthA - 1) - new Date(yearB, yearB - 1);
    });

    const tradingTrendsData = {
      labels: sortedMonths,
      datasets: [
        {
          label: "Number of Trades",
          data: sortedMonths.map((month) => tradesByMonth[month]),
          fill: false,
          borderColor: "rgba(75, 192, 192, 1)",
          tension: 0.1,
        },
      ],
    };

    // Credit distribution bar chart - Modified to show more meaningful data
    // Calculate total credits traded by status
    const creditsByStatus = {
      available: 0,
      accepted: 0,
    };

    tradesData.forEach((trade) => {
      if (creditsByStatus.hasOwnProperty(trade.status)) {
        creditsByStatus[trade.status] += trade.amount || 0;
      }
    });

    const creditDistributionData = {
      labels: ["Available Credits", "Accepted Credits"],
      datasets: [
        {
          label: "Credit Distribution by Status",
          data: [creditsByStatus.available, creditsByStatus.accepted],
          backgroundColor: [
            "rgba(75, 192, 192, 0.6)",
            "rgba(54, 162, 235, 0.6)",
          ],
          borderColor: ["rgba(75, 192, 192, 1)", "rgba(54, 162, 235, 1)"],
          borderWidth: 1,
        },
      ],
    };

    // Trading status distribution
    const statusCounts = {
      available: 0,
      accepted: 0,
    };

    tradesData.forEach((trade) => {
      if (statusCounts.hasOwnProperty(trade.status)) {
        statusCounts[trade.status]++;
      }
    });

    const tradingStatusDistributionData = {
      labels: ["Available", "Accepted"],
      datasets: [
        {
          data: [statusCounts.available, statusCounts.accepted],
          backgroundColor: [
            "rgba(75, 192, 192, 0.6)",
            "rgba(54, 162, 235, 0.6)",
          ],
          borderColor: ["rgba(75, 192, 192, 1)", "rgba(54, 162, 235, 1)"],
          borderWidth: 1,
        },
      ],
    };

    // Top employers by credit amount
    const employerCredits = {};
    tradesData.forEach((trade) => {
      if (trade.companyName) {
        if (!employerCredits[trade.companyName]) {
          employerCredits[trade.companyName] = 0;
        }
        employerCredits[trade.companyName] += trade.amount || 0;
      }
    });

    // Sort employers by credit amount and get top 5
    const sortedEmployers = Object.entries(employerCredits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topEmployersData = {
      labels: sortedEmployers.map(([name]) => name),
      datasets: [
        {
          label: "Credit Amount",
          data: sortedEmployers.map(([, amount]) => amount),
          backgroundColor: "rgba(153, 102, 255, 0.6)",
          borderColor: "rgba(153, 102, 255, 1)",
          borderWidth: 1,
        },
      ],
    };

    setChartData({
      userDistribution: userDistributionData,
      tradingTrends: tradingTrendsData,
      creditDistribution: creditDistributionData,
      tradingStatusDistribution: tradingStatusDistributionData,
      topEmployers: topEmployersData,
    });
  };
  // -----------------

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-expand-lg bg-purple shadow-sm">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand text-white">
            Admin Dashboard
          </Link>
          <div className="d-flex align-items-center">
            {/* Add the logout button here */}
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">System Overview</h1>
        </div>

        {/* Pending Employer Approvals section */}
        <div className="card shadow mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="card-title mb-0">Pending Employer Approvals</h5>
          </div>
          <div className="card-body">
            {pendingEmployers && pendingEmployers.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Company Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEmployers.map((employer) => (
                      <tr key={employer._id}>
                        <td>{employer.companyName}</td>
                        <td>{employer.username}</td>
                        <td>{employer.email}</td>
                        <td>
                          {new Date(employer.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-success me-2"
                            onClick={() => handleApproveEmployer(employer._id)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRejectEmployer(employer._id)}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center mb-0">No pending employer approvals</p>
            )}
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6 col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple p-3 text-white me-3">
                    <i className="bi bi-people-fill fs-4"></i>
                  </div>
                  <div>
                    <h6 className="card-subtitle mb-1 text-muted">
                      Total Users
                    </h6>
                    {/* Display total users only when stats.totalUsers is greater than 0 */}
                    <h2 className="card-title mb-0">
                      {stats.totalUsers > 0 ? (stats.totalUsers - 1).toLocaleString() : 0}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple p-3 text-white me-3">
                    <i className="bi bi-building fs-4"></i>
                  </div>
                  <div>
                    <h6 className="card-subtitle mb-1 text-muted">Employers</h6>
                    <h2 className="card-title mb-0">{stats.employers}</h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple p-3 text-white me-3">
                    <i className="bi bi-person-badge fs-4"></i>
                  </div>
                  <div>
                    <h6 className="card-subtitle mb-1 text-muted">Employees</h6>
                    <h2 className="card-title mb-0">{stats.employees}</h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple p-3 text-white me-3">
                    <i className="bi bi-coin fs-4"></i>
                  </div>
                  <div>
                    <h6 className="card-subtitle mb-1 text-muted">
                      Total Carbon Credits
                    </h6>
                    <h2 className="card-title mb-0">
                      ${stats.totalCredits.toLocaleString()}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-purple p-3 text-white me-3">
                    <i className="bi bi-arrow-left-right fs-4"></i>
                  </div>
                  <div>
                    <h6 className="card-subtitle mb-1 text-muted">
                      Total Tradings
                    </h6>
                    <h2 className="card-title mb-0">
                      {stats.totalTransactions.toLocaleString()}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0">Employer Companies</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employers.map((employer) => (
                    <tr key={employer._id}>
                      <td>{employer.companyName}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteEmployer(employer._id)}
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
        <br />



        {/* Charts Section */}
        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0">User Distribution</h5>
              </div>
              <div className="card-body">
                {chartData.userDistribution ? (
                  <div className="chart-container" style={{ height: "300px" }}>
                    <Pie
                      data={chartData.userDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: "bottom",
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="spinner-border text-purple" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0">Credit Distribution</h5>
              </div>
              <div className="card-body">
                {chartData.creditDistribution ? (
                  <div className="chart-container" style={{ height: "300px" }}>
                    <Bar
                      data={chartData.creditDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="spinner-border text-purple" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0">Trading Status Distribution</h5>
              </div>
              <div className="card-body">
                {chartData.tradingStatusDistribution ? (
                  <div className="chart-container" style={{ height: "300px" }}>
                    <Pie
                      data={chartData.tradingStatusDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: "bottom",
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="spinner-border text-purple" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0">Trading Trends</h5>
              </div>
              <div className="card-body">
                {chartData.tradingTrends ? (
                  <div className="chart-container" style={{ height: "300px" }}>
                    <Line
                      data={chartData.tradingTrends}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: "top",
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              precision: 0,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="spinner-border text-purple" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0">Top Employers by Credit Amount</h5>
              </div>
              <div className="card-body">
                {chartData.topEmployers ? (
                  <div className="chart-container" style={{ height: "300px" }}>
                    <Bar
                      data={chartData.topEmployers}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: "y",
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                        scales: {
                          x: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: "Credit Amount",
                            },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="spinner-border text-purple" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <br />
        {/* Trading Card */}
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0">Trading History</h5>
          </div>
          <div className="card-body">
            {isLoadingTrades ? (
              <div className="text-center">
                <div className="spinner-border text-purple" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : tradings.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Company Name</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Acceptor</th>
                      <th>Created At</th>
                      <th>Accepted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradings.map((trade) => (
                      <tr key={trade._id}>
                        <td>{trade.companyName}</td>
                        <td>{trade.amount} credits</td>
                        <td>
                          <span
                            className={`badge ${trade.status === "available"
                              ? "bg-success"
                              : trade.status === "accepted"
                                ? "bg-primary"
                                : "bg-danger"
                              }`}
                          >
                            {trade.status}
                          </span>
                        </td>
                        <td>
                          {trade.acceptorId ? trade.acceptorId.companyName : "N/A"}
                        </td>
                        <td>
                          {trade.createdAt
                            ? new Date(trade.createdAt).toLocaleDateString(
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
                          {trade.acceptedAt
                            ? new Date(trade.acceptedAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center mb-0">No trading history available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

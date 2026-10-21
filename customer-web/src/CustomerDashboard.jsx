import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./CustomerDashboard.css";

export default function CustomerDashboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("book");
  const [bookings, setBookings] = useState([]);
  const [bookingsLoadError, setBookingsLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [travelTime, setTravelTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      setLoading(false);
    }

    loadUser();
  }, []);

  async function loadBookings() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) return;

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("customer_id", authData.user.id)
      .order("id", { ascending: false });

    if (error) {
      setBookingsLoadError(true);
      setMessage(`Bookings load failed: ${error.message}`);
      return;
    }

    setBookingsLoadError(false);
    setBookings(data ?? []);
  }

  useEffect(() => {
    if (user) loadBookings();
  }, [user]);

  async function handleBooking(event) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        throw new Error("Please login again.");
      }

      const { error } = await supabase.from("bookings").insert({
        customer_id: authData.user.id,
        pickup_location: pickup.trim(),
        drop_location: drop.trim(),
        travel_date: travelDate,
        travel_time: travelTime,
        status: "Pending",
      });

      if (error) throw error;

      setMessage("Taxi booking request submitted!");
      setPickup("");
      setDrop("");
      setTravelDate("");
      setTravelTime("");
      setActiveTab("bookings");
      await loadBookings();
    } catch (error) {
      setMessage(error.message || "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.reload();
  }

  if (loading) return <p>Loading dashboard...</p>;

  if (!user) {
    return <p>Please login to access your dashboard.</p>;
  }

  const customerName = user.user_metadata?.full_name || "Customer";

  const customerPhone = user.user_metadata?.phone || "Not added";

  return (
    <div className="customer-dashboard">
      <aside className="dashboard-sidebar">
        <h2>Hosur City</h2>
        <p className="sidebar-subtitle">Best Taxi</p>

        <button onClick={() => setActiveTab("book")}>Book a Taxi</button>

        <button onClick={() => setActiveTab("bookings")}>My Bookings</button>

        <button onClick={() => setActiveTab("profile")}>My Profile</button>

        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p>Customer Dashboard</p>
            <h1>Welcome, {customerName}!</h1>
          </div>
          <span className="customer-avatar">
            {customerName.charAt(0).toUpperCase()}
          </span>
        </header>

        {message && (
          <p className="dashboard-message" role="status">
            {message}
          </p>
        )}

        {activeTab === "book" && (
          <section className="dashboard-card">
            <h2>Book Your Taxi</h2>
            <p>Enter your trip details below.</p>

            <form className="booking-form" onSubmit={handleBooking}>
              <label htmlFor="pickup">Pickup Location</label>
              <input
                id="pickup"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Enter pickup location"
                required
              />

              <label htmlFor="drop">Drop Location</label>
              <input
                id="drop"
                value={drop}
                onChange={(e) => setDrop(e.target.value)}
                placeholder="Enter destination"
                required
              />

              <label htmlFor="travel-date">Travel Date</label>
              <input
                id="travel-date"
                type="date"
                min={new Date().toLocaleDateString("en-CA")}
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                required
              />

              <label htmlFor="travel-time">Travel Time</label>
              <input
                id="travel-time"
                type="time"
                value={travelTime}
                onChange={(e) => setTravelTime(e.target.value)}
                required
              />

              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Request a Taxi"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "bookings" && (
          <section className="dashboard-card">
            <h2>My Bookings</h2>

            <button onClick={loadBookings}>Refresh Bookings</button>

            {bookingsLoadError ? null : bookings.length === 0 ? (
              <p>No bookings found yet.</p>
            ) : (
              <div className="booking-list">
                {bookings.map((booking) => (
                  <article className="booking-item" key={booking.id}>
                    <h3>
                      {booking.pickup_location} → {booking.drop_location}
                    </h3>
                    <p>Date: {booking.travel_date}</p>
                    <p>Time: {booking.travel_time}</p>
                    <p>
                      Status: <strong>{booking.status}</strong>
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "profile" && (
          <section className="dashboard-card">
            <h2>My Profile</h2>

            <div className="profile-row">
              <span>Full Name</span>
              <strong>{customerName}</strong>
            </div>

            <div className="profile-row">
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>

            <div className="profile-row">
              <span>Phone Number</span>
              <strong>{customerPhone}</strong>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

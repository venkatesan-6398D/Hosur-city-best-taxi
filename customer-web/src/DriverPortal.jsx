import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./DriverPortal.css";

export default function DriverPortal() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const robotsMeta = document.createElement("meta");
    robotsMeta.name = "robots";
    robotsMeta.content = "noindex, nofollow";
    document.head.appendChild(robotsMeta);

    async function checkDriverSession() {
      const { data, error } = await supabase.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") {
        setMessage(error.message);
      } else if (data.user?.app_metadata?.role === "driver") {
        setUser(data.user);
        await loadBookings();
      }
      setCheckingAuth(false);
    }

    checkDriverSession();
    return () => robotsMeta.remove();
  }, []);

  async function loadBookings() {
    const { data, error } = await supabase.functions.invoke("booking-otp", {
      body: { action: "list_bookings" },
    });

    if (error) {
      setMessage(`Bookings load failed: ${error.message}`);
      return;
    }

    setBookings(data.bookings || []);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.user?.app_metadata?.role !== "driver") {
        await supabase.auth.signOut();
        throw new Error("Indha account driver account illa.");
      }
      setUser(data.user);
      await loadBookings();
    } catch (error) {
      setMessage(error.message || "Driver login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkContacted(bookingId) {
    setMessage("");
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("booking-otp", {
        body: { action: "mark_contacted", bookingId },
      });
      if (error) throw error;
      setMessage("Customer contact status update aachu.");
      await loadBookings();
    } catch (error) {
      setMessage(`Booking update failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkCompleted(bookingId) {
    const confirmed = window.confirm(
      "Confirm that the passenger has been dropped off and complete this trip?",
    );
    if (!confirmed) return;

    setMessage("");
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("booking-otp", {
        body: { action: "mark_completed", bookingId },
      });
      if (error) throw error;
      setMessage("Trip completed nu update panniyachu.");
      await loadBookings();
    } catch (error) {
      setMessage(`Trip completion update failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelBooking(bookingId) {
    const confirmed = window.confirm(
      "Cancel this booking? The cancelled record will remain in the admin history.",
    );
    if (!confirmed) return;

    setMessage("");
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("booking-otp", {
        body: { action: "driver_cancel_booking", bookingId },
      });
      if (error) throw error;
      setMessage("Booking cancelled; record kept in booking history.");
      await loadBookings();
    } catch (error) {
      setMessage(`Booking cancellation failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setUser(null);
    setBookings([]);
  }

  if (checkingAuth) {
    return <main className="driver-portal">Driver access check pannudhu...</main>;
  }

  if (!user) {
    return (
      <main className="driver-portal">
        <section className="driver-card">
          <h1>Driver Login</h1>
          <p>Customer booking details paakka driver account-la login pannunga.</p>
          <form className="driver-login-form" onSubmit={handleLogin}>
            <label htmlFor="driver-email">Email</label>
            <input
              id="driver-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
            <label htmlFor="driver-password">Password</label>
            <input
              id="driver-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Please wait..." : "Login"}
            </button>
          </form>
          {message && <p className="driver-message" role="alert">{message}</p>}
          <a href="/">Back to taxi website</a>
        </section>
      </main>
    );
  }

  return (
    <main className="driver-portal">
      <header className="driver-header">
        <div>
          <p>Hosur City Best Taxi</p>
          <h1>Customer bookings</h1>
        </div>
        <div className="driver-header-actions">
          <button
            type="button"
            onClick={() => {
              setMessage("");
              loadBookings();
            }}
            disabled={busy}
          >
            Refresh
          </button>
          <button type="button" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      {message && <p className="driver-message" role="status">{message}</p>}
      {bookings.length === 0 ? (
        <section className="driver-card">
          <p>Bookings edhuvum illa.</p>
        </section>
      ) : (
        <div className="driver-booking-list">
          {bookings.map((booking) => {
            const origin =
              booking.pickup_latitude != null &&
              booking.pickup_longitude != null
                ? `${booking.pickup_latitude},${booking.pickup_longitude}`
                : booking.pickup_location;
            const destination =
              booking.drop_latitude != null && booking.drop_longitude != null
                ? `${booking.drop_latitude},${booking.drop_longitude}`
                : booking.drop_location;
            const directions = new URL(
              "https://www.google.com/maps/dir/",
            );
            directions.search = new URLSearchParams({
              api: "1",
              origin,
              destination,
              travelmode: "driving",
            }).toString();

            return (
              <article className="driver-card" key={booking.id}>
                <h2>Booking #{booking.id}</h2>
                <p>Customer: {booking.customer_name}</p>
                <p>Phone: {booking.customer_phone}</p>
                <p>Pickup: {booking.pickup_location}</p>
                <p>Drop: {booking.drop_location}</p>
                <p>Date/time: {booking.travel_date} {booking.travel_time}</p>
                <p>Status: <strong>{booking.status}</strong></p>
                <p>
                  <a href={`tel:${booking.customer_phone}`}>
                    Call customer: {booking.customer_phone}
                  </a>
                </p>
                <p>
                  <a
                    href={`https://wa.me/${booking.customer_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp customer
                  </a>
                </p>
                {!["Cancelled", "Completed"].includes(booking.status) && (
                  <div className="driver-booking-actions">
                    {booking.status === "Pending confirmation" && (
                      <button
                        type="button"
                        onClick={() => handleMarkContacted(booking.id)}
                        disabled={busy}
                      >
                        Mark customer contacted
                      </button>
                    )}
                    <a
                      className="driver-directions"
                      href={directions.toString()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Show route to drop in Google Maps
                    </a>
                    {booking.status === "Customer confirmed" && (
                      <button
                        type="button"
                        className="driver-complete-button"
                        onClick={() => handleMarkCompleted(booking.id)}
                        disabled={busy}
                      >
                        Mark trip completed
                      </button>
                    )}
                    <button
                      type="button"
                      className="driver-cancel-button"
                      onClick={() => handleCancelBooking(booking.id)}
                      disabled={busy}
                    >
                      Cancel booking
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

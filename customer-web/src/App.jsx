import { useState, useEffect, useRef } from "react";
import "./App.css";
import { supabase } from "./supabase";
import DriverPortal from "./DriverPortal";

function getDefaultPickupSchedule() {
  const pickupDate = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return {
    date: `${pickupDate.getFullYear()}-${pad(pickupDate.getMonth() + 1)}-${pad(pickupDate.getDate())}`,
    time: `${pad(pickupDate.getHours())}:${pad(pickupDate.getMinutes())}`,
  };
}

const vehicles = [
  {
    name: "Tata Indica",
    bookingName: "Tata Indica (5 Seater)",
    image: "/cars/tata-indica.jpeg",
    seats: 5,
    tag: "Popular",
    description: "Comfortable City Ride",
    bags: 2,
  },
  {
    name: "Tata Vista",
    bookingName: "Tata Vista (5 Seater)",
    image: "/cars/tata%20vista.jpeg",
    seats: 5,
    tag: "Comfort",
    description: "Spacious Hatchback",
    bags: 2,
  },
  {
    name: "Maruti Swift",
    bookingName: "Maruti Swift (5 Seater)",
    image: "/cars/swift-dzire.jpeg",
    seats: 5,
    tag: "City Ride",
    description: "Easy City Travel",
    bags: 2,
  },
  {
    name: "Maruti Dzire",
    bookingName: "Maruti Dzire (5 Seater)",
    image: "/cars/dzire.png",
    seats: 5,
    tag: "Family",
    description: "Comfortable Sedan",
    bags: 3,
    containImage: true,
  },
  {
    name: "Toyota Etios",
    bookingName: "Toyota Etios (5 Seater)",
    image: "/cars/toyota-etios.jpeg",
    seats: 5,
    tag: "Premium",
    description: "Executive Sedan",
    bags: 2,
  },
  {
    name: "Toyota Innova",
    bookingName: "Toyota Innova (7 Seater)",
    image: "/cars/innova.png",
    seats: 7,
    tag: "Group Travel",
    description: "Room for the Whole Family",
    bags: 4,
    containImage: true,
  },
  {
    name: "Maruti Ertiga",
    bookingName: "Maruti Ertiga (7 Seater)",
    image: "/cars/ertiga.webp",
    seats: 7,
    tag: "7 Seater",
    description: "Comfortable Family MUV",
    bags: 4,
    containImage: true,
  },
];

const fareServices = [
  {
    name: "Hosur Local",
    detail: "Up to 3 km · Extra km ₹20",
    extraKm: "Extra km ₹20",
    fares: ["₹150", "₹150", "₹150", "₹150", "—", "—"],
  },
  {
    name: "100 km Package",
    fares: ["₹1,600", "₹1,800", "₹1,800", "₹2,000", "₹3,300", "₹3,500"],
  },
  {
    name: "Airport Pickup / Drop",
    fares: ["₹2,000", "₹2,200", "₹2,200", "₹2,400", "₹4,500", "₹4,700"],
  },
  {
    name: "Trip / Tour (per km)",
    fares: ["₹10", "₹11", "₹11", "₹12", "₹18", "₹20"],
  },
  {
    name: "Majestic Drop",
    fares: ["₹1,500", "₹1,700", "₹1,700", "₹2,000", "₹3,000", "₹3,200"],
  },
];

let googlePlacesLoader;

function loadGooglePlaces() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("Add a Google Places API key to enable location suggestions."),
    );
  }

  if (globalThis.google?.maps?.places?.Autocomplete) {
    return Promise.resolve(globalThis.google);
  }

  if (!googlePlacesLoader) {
    googlePlacesLoader = new Promise((resolve, reject) => {
      const existingScript = document.querySelector("#google-maps-places");
      const script = existingScript || document.createElement("script");
      const onLoad = () => {
        if (globalThis.google?.maps?.places?.Autocomplete) {
          resolve(globalThis.google);
        } else {
          googlePlacesLoader = undefined;
          reject(
            new Error(
              "Google Places could not load. Check that the Maps JavaScript API and Places API are enabled and billing is set up.",
            ),
          );
        }
      };
      const onError = () => {
        googlePlacesLoader = undefined;
        reject(new Error("Google Maps could not load. Check your API key."));
      };

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (!existingScript) {
        script.id = "google-maps-places";
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&v=weekly`;
        document.head.appendChild(script);
      } else if (globalThis.google?.maps?.places?.Autocomplete) {
        onLoad();
      }
    });
  }

  return googlePlacesLoader;
}

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthMessage("");
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              full_name: authName.trim(),
              phone: authPhone.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setLoggedIn(true);
          setAuthOpen(false);
          setAuthMessage("Account created successfully!");
        } else {
          setAuthMessage(
            "Account created! Please confirm your email, then login.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw error;

        setLoggedIn(true);
        setAuthOpen(false);
        setAuthMessage("Login successful!");
      }
    } catch (error) {
      setAuthMessage(error.message || "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setAuthMessage("");
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setAuthMessage(error.message || "Unable to log out.");
    } finally {
      setAuthLoading(false);
    }
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const [pickupMapUrl, setPickupMapUrl] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [pickupCoordinates, setPickupCoordinates] = useState(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [activeBooking, setActiveBooking] = useState(() => {
    try {
      const savedBooking = window.sessionStorage.getItem("hosurTaxiBooking");
      return savedBooking ? JSON.parse(savedBooking) : null;
    } catch (error) {
      console.error("Unable to read this tab's booking details:", error);
      return null;
    }
  });
  const [bookingPanelOpen, setBookingPanelOpen] = useState(false);
  const [bookingDetailsLoading, setBookingDetailsLoading] = useState(false);
  const [bookingCanceling, setBookingCanceling] = useState(false);
  const [bookingConfirming, setBookingConfirming] = useState(false);
  const [bookingPanelMessage, setBookingPanelMessage] = useState("");
  const rideBooked = Boolean(
    activeBooking && !["Cancelled", "Completed"].includes(activeBooking.status),
  );
  const pickupInputRef = useRef(null);
  const dropInputRef = useRef(null);
  const scheduleTouchedRef = useRef({ date: false, time: false });
  const [dropCoordinates, setDropCoordinates] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    pickup: "",
    drop: "",
    ...getDefaultPickupSchedule(),
    car: vehicles[0].bookingName,
    tripType: "Local Taxi",
    rentalHours: "",
  });

  useEffect(() => {
    const updatePickupSchedule = () => {
      const schedule = getDefaultPickupSchedule();
      setFormData((current) => {
        const next = { ...current };
        if (!scheduleTouchedRef.current.date) next.date = schedule.date;
        if (!scheduleTouchedRef.current.time) next.time = schedule.time;
        return next.date === current.date && next.time === current.time
          ? current
          : next;
      });
    };

    updatePickupSchedule();
    const intervalId = window.setInterval(updatePickupSchedule, 15_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/driver") return undefined;

    let active = true;
    let autocompleteInstances = [];

    loadGooglePlaces()
      .then((google) => {
        if (!active) return;

        const pickupAutocomplete = new google.maps.places.Autocomplete(
          pickupInputRef.current,
          {
            fields: ["formatted_address", "geometry", "name"],
            componentRestrictions: { country: "in" },
          },
        );
        const dropAutocomplete = new google.maps.places.Autocomplete(
          dropInputRef.current,
          {
            fields: ["formatted_address", "geometry", "name"],
            componentRestrictions: { country: "in" },
          },
        );
        autocompleteInstances = [pickupAutocomplete, dropAutocomplete];

        pickupAutocomplete.addListener("place_changed", () => {
          const place = pickupAutocomplete.getPlace();
          const location = place.geometry?.location;
          if (!location) {
            return;
          }

          const label = place.formatted_address || place.name || "";
          const latitude = location.lat();
          const longitude = location.lng();
          setFormData((current) => ({ ...current, pickup: label }));
          setPickupCoordinates({ latitude, longitude });
          setPickupMapUrl(
            `https://www.google.com/maps?q=${latitude},${longitude}`,
          );
        });

        dropAutocomplete.addListener("place_changed", () => {
          const place = dropAutocomplete.getPlace();
          const location = place.geometry?.location;
          if (!location) {
            return;
          }

          const label = place.formatted_address || place.name || "";
          setDropCoordinates({
            latitude: location.lat(),
            longitude: location.lng(),
          });
          setFormData((current) => ({ ...current, drop: label }));
        });
      })
      .catch((error) => {
        if (active)
          console.error("Google Places initialization failed:", error);
      });

    return () => {
      active = false;
      autocompleteInstances.forEach((instance) =>
        window.google?.maps?.event.clearInstanceListeners(instance),
      );
    };
  }, []);

  const handleChange = (e) => {
    if (e.target.name === "date" || e.target.name === "time") {
      scheduleTouchedRef.current[e.target.name] = true;
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    if (e.target.name === "pickup") {
      setPickupMapUrl("");
      setPickupCoordinates(null);
      setLocationError("");
    }
    if (e.target.name === "drop") {
      setDropCoordinates(null);
    }
  };

  const handleUseCurrentLocation = () => {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("This browser does not support location services.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const mapUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
        setPickupMapUrl(mapUrl);
        setPickupCoordinates({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setFormData((current) => ({ ...current, pickup: "Current location" }));
        setLocationLoading(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow access in your browser settings and try again."
            : error.code === error.TIMEOUT
              ? "Getting your location timed out. Please try again."
              : "Could not get your current location. Turn on location services and try again.",
        );
        setLocationLoading(false);
      },
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 },
    );
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingSubmitting(true);
    setBookingMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("booking-otp", {
        body: {
          action: "create_booking",
          customerName: formData.name.trim(),
          customerPhone: formData.phone.trim(),
          pickupLocation: pickupMapUrl || formData.pickup.trim(),
          pickupLabel: formData.pickup.trim(),
          pickupLatitude: pickupCoordinates?.latitude ?? null,
          pickupLongitude: pickupCoordinates?.longitude ?? null,
          dropLocation: formData.drop.trim(),
          dropLatitude: dropCoordinates?.latitude ?? null,
          dropLongitude: dropCoordinates?.longitude ?? null,
          travelDate: formData.date,
          travelTime: formData.time,
          car: formData.car,
          tripType: formData.tripType,
          rentalHours:
            formData.tripType === "Hourly Rental"
              ? Number(formData.rentalHours)
              : null,
        },
      });

      if (error) {
        let detail = error.message;
        if (error.context instanceof Response) {
          const responseBody = await error.context
            .clone()
            .json()
            .catch(() => null);
          detail = responseBody?.message || responseBody?.error || detail;
        }
        if (error.name === "FunctionsFetchError") {
          throw new Error(
            "Could not reach the Supabase function. Deploy the `booking-otp` function to your project and check your Supabase URL.",
          );
        }
        throw new Error(detail);
      }

      setBookingMessage(
        data?.smsSent
          ? "Booking saved. A confirmation SMS has been sent to your phone. Our driver will call to confirm your trip."
          : "Booking saved, but we could not send a confirmation SMS. Please contact us; our driver will call to confirm your trip.",
      );
      const savedBooking = {
        id: data.bookingId,
        customerName: formData.name.trim(),
        customerPhone: formData.phone.trim(),
        pickup: formData.pickup.trim(),
        drop: formData.drop.trim(),
        date: formData.date,
        time: formData.time,
        car: formData.car,
        tripType: formData.tripType,
        rentalHours: formData.rentalHours,
        status: "Pending confirmation",
      };
      try {
        window.sessionStorage.setItem(
          "hosurTaxiBooking",
          JSON.stringify(savedBooking),
        );
      } catch (error) {
        console.error("Unable to save this tab's booking details:", error);
      }
      setActiveBooking(savedBooking);
      setBookingPanelOpen(true);
      setBookingPanelMessage("");
      scheduleTouchedRef.current = { date: false, time: false };
      setFormData((current) => ({
        ...current,
        name: "",
        phone: "",
        pickup: "",
        drop: "",
        ...getDefaultPickupSchedule(),
        car: vehicles[0].bookingName,
        tripType: "Local Taxi",
        rentalHours: "",
      }));
      setPickupMapUrl("");
      setPickupCoordinates(null);
      setDropCoordinates(null);
    } catch (error) {
      setBookingMessage(`Booking failed: ${error.message}`);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!activeBooking) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this taxi booking?",
    );
    if (!confirmed) return;

    setBookingCanceling(true);
    setBookingPanelMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("booking-otp", {
        body: {
          action: "cancel_booking",
          bookingId: activeBooking.id,
          customerPhone: activeBooking.customerPhone,
        },
      });

      if (error) {
        let detail = error.message;
        if (error.context instanceof Response) {
          const responseBody = await error.context
            .clone()
            .json()
            .catch(() => null);
          detail = responseBody?.message || responseBody?.error || detail;
        }
        throw new Error(detail);
      }
      if (!data?.cancelled) {
        throw new Error("The booking could not be cancelled.");
      }

      const cancelledBooking = { ...activeBooking, status: "Cancelled" };
      setActiveBooking(cancelledBooking);
      try {
        window.sessionStorage.setItem(
          "hosurTaxiBooking",
          JSON.stringify(cancelledBooking),
        );
      } catch (storageError) {
        console.error(
          "Unable to save the cancelled booking status:",
          storageError,
        );
      }
      setBookingPanelMessage("Your booking has been cancelled.");
    } catch (error) {
      setBookingPanelMessage(`Cancellation failed: ${error.message}`);
    } finally {
      setBookingCanceling(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!activeBooking) return;

    setBookingConfirming(true);
    setBookingPanelMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("booking-otp", {
        body: {
          action: "confirm_booking",
          bookingId: activeBooking.id,
          customerPhone: activeBooking.customerPhone,
        },
      });

      if (error) {
        let detail = error.message;
        if (error.context instanceof Response) {
          const responseBody = await error.context
            .clone()
            .json()
            .catch(() => null);
          detail = responseBody?.message || responseBody?.error || detail;
        }
        throw new Error(detail);
      }
      if (!data?.confirmed) {
        throw new Error("The booking could not be confirmed.");
      }

      const confirmedBooking = {
        ...activeBooking,
        status: "Customer confirmed",
      };
      setActiveBooking(confirmedBooking);
      try {
        window.sessionStorage.setItem(
          "hosurTaxiBooking",
          JSON.stringify(confirmedBooking),
        );
      } catch (storageError) {
        console.error(
          "Unable to save the confirmed booking status:",
          storageError,
        );
      }
      setBookingPanelOpen(false);
    } catch (error) {
      setBookingPanelMessage(`Confirmation failed: ${error.message}`);
    } finally {
      setBookingConfirming(false);
    }
  };

  const handleBookingStatusClick = async () => {
    const openingPanel = !bookingPanelOpen;
    setBookingPanelOpen(openingPanel);
    setBookingPanelMessage("");
    if (!openingPanel || !activeBooking) return;

    setBookingDetailsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-otp", {
        body: {
          action: "get_booking",
          bookingId: activeBooking.id,
          customerPhone: activeBooking.customerPhone,
        },
      });
      if (error) {
        let detail = error.message;
        if (error.context instanceof Response) {
          const responseBody = await error.context
            .clone()
            .json()
            .catch(() => null);
          detail = responseBody?.message || responseBody?.error || detail;
        }
        throw new Error(detail);
      }
      if (!data?.booking) {
        throw new Error("Booking details could not be loaded.");
      }

      const refreshedBooking = {
        ...activeBooking,
        status: data.booking.status,
      };
      setActiveBooking(refreshedBooking);
      try {
        window.sessionStorage.setItem(
          "hosurTaxiBooking",
          JSON.stringify(refreshedBooking),
        );
      } catch (storageError) {
        console.error("Unable to refresh saved booking status:", storageError);
      }
    } catch (error) {
      setBookingPanelMessage(`Booking status refresh failed: ${error.message}`);
    } finally {
      setBookingDetailsLoading(false);
    }
  };

  if (window.location.pathname === "/driver") {
    return <DriverPortal />;
  }

  return (
    <div className="app">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-container">
          <a href="#home" className="logo">
            <img
              src="/hosur-city-best-taxi-sticker.png"
              alt="Hosur City Best Taxi"
            />
          </a>

          <button
            className={`booking-status${rideBooked ? " is-booked" : ""}`}
            type="button"
            aria-expanded={bookingPanelOpen}
            aria-controls="booking-details"
            aria-label="Open booking status and trip details"
            onClick={handleBookingStatusClick}
          >
            <span className="booking-status-label">BOOKING STATUS</span>
          </button>

          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            ☰
          </button>

          <nav className={menuOpen ? "nav-links active" : "nav-links"}>
            <a href="#home" onClick={() => setMenuOpen(false)}>
              Home
            </a>
            <a href="#services" onClick={() => setMenuOpen(false)}>
              Services
            </a>
            <a href="#fleet" onClick={() => setMenuOpen(false)}>
              Our Cars
            </a>
            <a href="#about" onClick={() => setMenuOpen(false)}>
              About
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>
              Contact
            </a>

            <a
              href="#booking"
              className="nav-book-btn"
              onClick={() => setMenuOpen(false)}
            >
              Book Ride
            </a>
            {!loggedIn ? (
              <button
                type="button"
                className="nav-auth-btn"
                aria-expanded={authOpen}
                aria-controls="customer-login"
                onClick={() => {
                  setAuthOpen((open) => !open);
                  setMenuOpen(false);
                }}
              >
                {authOpen ? "Close" : "Login"}
              </button>
            ) : (
              <div className="nav-auth-controls">
                <button
                  type="button"
                  className="nav-auth-btn"
                  onClick={handleLogout}
                  disabled={authLoading}
                >
                  {authLoading ? "Please wait..." : "Log out"}
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>
      {bookingPanelOpen && (
        <section className="booking-popover" id="booking-details">
          <div className="booking-popover-header">
            <div>
              <span className="booking-status-label">YOUR TRIP</span>
              <h2>Booking details</h2>
            </div>
            <button
              type="button"
              className="booking-popover-close"
              aria-label="Close booking details"
              onClick={() => setBookingPanelOpen(false)}
            >
              ×
            </button>
          </div>
          {bookingDetailsLoading && (
            <p className="booking-empty">Loading latest booking status...</p>
          )}
          {activeBooking ? (
            <>
              <dl className="booking-detail-list">
                <div>
                  <dt>Booking ID</dt>
                  <dd>{activeBooking.id}</dd>
                </div>
                <div>
                  <dt>Name</dt>
                  <dd>{activeBooking.customerName}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{activeBooking.status}</dd>
                </div>
                <div>
                  <dt>Pickup</dt>
                  <dd>{activeBooking.pickup}</dd>
                </div>
                <div>
                  <dt>Destination</dt>
                  <dd>{activeBooking.drop}</dd>
                </div>
                <div>
                  <dt>Date & time</dt>
                  <dd>
                    {activeBooking.date} at {activeBooking.time}
                  </dd>
                </div>
                <div>
                  <dt>Trip type</dt>
                  <dd>
                    {activeBooking.tripType || "Local Taxi"}
                    {activeBooking.tripType === "Hourly Rental" &&
                      activeBooking.rentalHours &&
                      ` · ${activeBooking.rentalHours} hours`}
                  </dd>
                </div>
                <div>
                  <dt>Car</dt>
                  <dd>{activeBooking.car}</dd>
                </div>
              </dl>
              {rideBooked && (
                <div className="booking-actions">
                  {activeBooking.status === "Pending confirmation" && (
                    <button
                      type="button"
                      className="booking-confirm-button"
                      onClick={handleConfirmBooking}
                      disabled={bookingConfirming || bookingCanceling}
                    >
                      {bookingConfirming ? "Confirming..." : "Confirm booking"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="booking-cancel-button"
                    onClick={handleCancelBooking}
                    disabled={bookingCanceling || bookingConfirming}
                  >
                    {bookingCanceling ? "Cancelling..." : "Cancel booking"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="booking-empty">
              No booking details yet. Book a ride to see it here.
            </p>
          )}
          {bookingPanelMessage && (
            <p className="booking-panel-message" role="status">
              {bookingPanelMessage}
            </p>
          )}
        </section>
      )}
      {!loggedIn && authOpen && (
        <section className="auth-section" id="customer-login">
          <div
            className="auth-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-auth-title"
          >
            <button
              className="auth-close"
              type="button"
              aria-label="Close login form"
              onClick={() => setAuthOpen(false)}
            >
              ×
            </button>
            <h2 id="customer-auth-title">
              {authMode === "login" ? "Customer Login" : "Create Account"}
            </h2>

            <p>Login to manage your taxi bookings.</p>

            <form onSubmit={handleAuth}>
              {authMode === "signup" && (
                <>
                  <label htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />

                  <label htmlFor="auth-phone">Phone Number</label>
                  <input
                    id="auth-phone"
                    type="tel"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    autoComplete="tel"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    required
                  />
                </>
              )}

              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Login"
                    : "Create Account"}
              </button>
            </form>

            {authMessage && <p role="status">{authMessage}</p>}

            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthMessage("");
              }}
            >
              {authMode === "login"
                ? "New customer? Create an account"
                : "Already registered? Login"}
            </button>
          </div>
        </section>
      )}

      <main>
        <section className="price-hero" id="home">
          <div className="price-container">
            <div className="price-heading">
              <span className="section-label">HOSUR CITY BEST TAXI</span>
              <h1>
                Clear fares.
                <span> Better journeys.</span>
              </h1>
              <p>Choose your ride and see our starting prices at a glance.</p>
            </div>

            <div
              className="fare-table-wrap"
              role="region"
              aria-label="Taxi fares by vehicle and air conditioning"
              tabIndex="0"
            >
              <table className="fare-table">
                <thead>
                  <tr>
                    <th rowSpan="2" scope="col">
                      Service
                    </th>
                    <th colSpan="2" scope="colgroup">
                      Tata Indica / Tata Vista
                    </th>
                    <th colSpan="2" scope="colgroup">
                      Swift / Dzire / Toyota Etios
                    </th>
                    <th colSpan="2" scope="colgroup">
                      Innova / Ertiga
                    </th>
                  </tr>
                  <tr>
                    <th scope="col">Non-AC</th>
                    <th scope="col">AC</th>
                    <th scope="col">Non-AC</th>
                    <th scope="col">AC</th>
                    <th scope="col">Non-AC</th>
                    <th scope="col">AC</th>
                  </tr>
                </thead>
                <tbody>
                  {fareServices.map((service) => (
                    <tr key={service.name}>
                      <th scope="row">
                        <strong>{service.name}</strong>
                        {service.detail && <small>{service.detail}</small>}
                      </th>
                      {service.fares.map((fare, index) => (
                        <td
                          className={fare === "—" ? "fare-unavailable" : ""}
                          key={`${service.name}-${index}`}
                        >
                          {fare}
                          {service.extraKm && fare !== "—" && (
                            <small className="fare-extra-km">
                              {service.extraKm}
                            </small>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="price-footer">
              <p>
                Clear fares for every vehicle group, with AC and Non-AC rates
                shown separately.
              </p>
              <a href="#booking" className="primary-btn">
                Book Your Taxi →
              </a>
            </div>
          </div>
        </section>

        {/* QUICK BOOKING */}
        <section className="quick-book">
          <div className="quick-book-container">
            <div>
              <span className="small-label">READY TO RIDE?</span>
              <h2>Book your taxi in minutes.</h2>
            </div>

            <a href="#booking" className="primary-btn">
              Book Now →
            </a>
          </div>
        </section>

        {/* SERVICES */}
        <section className="section" id="services">
          <div className="section-heading">
            <span className="section-label">OUR SERVICES</span>

            <h2>
              Travel your way.
              <br />
              <span>We've got you covered.</span>
            </h2>

            <p>
              From quick city rides to long-distance journeys, choose the
              service that fits your travel needs.
            </p>
          </div>

          <div className="service-grid">
            <div className="service-card">
              <div className="service-number">01</div>
              <img
                className="service-photo"
                src="/cars/section-2-1.jpg"
                alt="Travel map illustration for local taxi rides"
              />

              <h3>Local Taxi</h3>

              <p>
                Comfortable and reliable rides around Hosur and nearby
                locations.
              </p>

              <a href="#booking">Book Local Ride →</a>
            </div>

            <div className="service-card featured-service">
              <div className="service-number">02</div>
              <img
                className="service-photo"
                src="/cars/section-2-2.jpg"
                alt="Airport taxi transfer illustration"
              />

              <h3>Airport Taxi</h3>

              <p>Hassle-free airport transfers with on-time pickup and drop.</p>

              <a href="#booking">Book Airport Ride →</a>
            </div>

            <div className="service-card">
              <div className="service-number">03</div>
              <img
                className="service-photo"
                src="/cars/section-2-3.jpg"
                alt="Taxi illustration for outstation trips"
              />

              <h3>Outstation Taxi</h3>

              <p>
                Long-distance journeys with comfortable cars and professional
                drivers.
              </p>

              <a href="#booking">Book Outstation →</a>
            </div>
          </div>
        </section>

        {/* FLEET */}
        <section className="section fleet-section" id="fleet">
          <div className="section-heading fleet-heading">
            <div>
              <span className="section-label">OUR FLEET</span>

              <h2>
                Choose your
                <span> perfect ride.</span>
              </h2>
            </div>

            <p>
              Clean, comfortable and well-maintained vehicles for every type of
              journey.
            </p>
          </div>

          <div className="fleet-grid">
            {vehicles.map((vehicle) => (
              <article className="car-card" key={vehicle.bookingName}>
                <div
                  className={
                    vehicle.containImage
                      ? "car-image car-image--contain"
                      : "car-image"
                  }
                >
                  <img src={vehicle.image} alt={vehicle.name} />
                  <span className="car-tag">{vehicle.tag}</span>
                </div>

                <div className="car-info">
                  <div className="car-title">
                    <div>
                      <h3>{vehicle.name}</h3>
                      <span>{vehicle.description}</span>
                    </div>
                    <strong>{vehicle.seats} SEATER</strong>
                  </div>

                  <div className="car-features">
                    <span>👤 {vehicle.seats - 1} Passengers</span>
                    <span>🧳 {vehicle.bags} Bags</span>
                    <span>❄️ AC / Non-AC</span>
                  </div>

                  <a
                    href="#booking"
                    className="car-book-btn"
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        car: vehicle.bookingName,
                      }))
                    }
                  >
                    Select {vehicle.name} →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* WHY US */}
        <section className="why-section">
          <div className="why-container">
            <div className="why-content">
              <span className="section-label">WHY CHOOSE US</span>

              <h2>
                More than a taxi.
                <br />
                <span>A better journey.</span>
              </h2>

              <p>
                We believe every journey should be safe, comfortable and
                stress-free. That's why we focus on dependable service from
                pickup to destination.
              </p>

              <div className="why-list">
                <div>
                  <span>✓</span>
                  <div>
                    <strong>Professional Drivers</strong>
                    <p>Experienced and customer-friendly drivers.</p>
                  </div>
                </div>

                <div>
                  <span>✓</span>
                  <div>
                    <strong>Clean & Comfortable Cars</strong>
                    <p>Well-maintained vehicles for every ride.</p>
                  </div>
                </div>

                <div>
                  <span>✓</span>
                  <div>
                    <strong>Reliable Service</strong>
                    <p>On-time pickup and dependable support.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="why-card">
              <img
                className="why-card-image"
                src="/cars/section%203.jpeg"
                alt="Taxi ready for a comfortable Hosur journey"
              />
              <div className="map-pattern"></div>

              <div className="location-pin">📍</div>

              <div className="why-card-text">
                <span>YOUR JOURNEY</span>
                <strong>STARTS HERE</strong>
              </div>
            </div>
          </div>
        </section>

        {/* BOOKING */}
        <section className="booking-section" id="booking">
          <div className="booking-container">
            <div className="booking-intro">
              <span className="section-label">BOOK YOUR RIDE</span>

              <h2>
                Where are you
                <span> going?</span>
              </h2>

              <p>Enter your trip details and we'll help you get moving.</p>

              <div className="booking-benefits">
                <span>✓ Quick booking</span>
                <span>✓ SMS confirmation</span>
                <span>✓ 24/7 support</span>
              </div>
            </div>

            <form className="booking-form" onSubmit={handleBooking}>
              <div
                className="booking-trip-types"
                role="group"
                aria-label="Choose a trip type"
              >
                {[
                  { name: "Local Taxi", icon: "🚕" },
                  { name: "Outstation", icon: "🧳" },
                  { name: "Hourly Rental", icon: "🕒" },
                  { name: "Airport", icon: "✈️" },
                ].map((trip) => (
                  <button
                    key={trip.name}
                    type="button"
                    aria-pressed={formData.tripType === trip.name}
                    className={
                      formData.tripType === trip.name
                        ? "booking-trip-type active"
                        : "booking-trip-type"
                    }
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        tripType: trip.name,
                      }))
                    }
                  >
                    <span aria-hidden="true">{trip.icon}</span>
                    {trip.name}
                  </button>
                ))}
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label>Full Name</label>

                  <input
                    type="text"
                    name="name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Phone Number</label>

                  <input
                    type="tel"
                    name="phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>
                  {formData.tripType === "Airport"
                    ? "Pickup Location / Airport"
                    : "Pickup Location"}
                </label>

                <button
                  type="button"
                  className="current-location-button"
                  onClick={handleUseCurrentLocation}
                  disabled={locationLoading}
                >
                  {locationLoading
                    ? "Getting location..."
                    : "Use my current location"}
                </button>
                <input
                  type="text"
                  name="pickup"
                  ref={pickupInputRef}
                  placeholder={
                    formData.tripType === "Airport"
                      ? "Enter your location or airport"
                      : "Where should we pick you up?"
                  }
                  value={formData.pickup}
                  onChange={handleChange}
                  required
                />
                {locationError && (
                  <small className="location-error" role="alert">
                    {locationError}
                  </small>
                )}
                {pickupMapUrl && (
                  <div className="location-share-links">
                    <a href={pickupMapUrl} target="_blank" rel="noreferrer">
                      Open location in Google Maps
                    </a>
                    <a
                      href={`https://wa.me/918438001838?text=${encodeURIComponent(
                        `Hi, my taxi pickup location is: ${pickupMapUrl}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Share location via WhatsApp
                    </a>
                  </div>
                )}
              </div>

              <div className="input-group">
                <label>
                  {formData.tripType === "Airport"
                    ? "Drop Location / Airport"
                    : formData.tripType === "Hourly Rental"
                      ? "Planned Destination"
                      : "Drop Location"}
                </label>

                <input
                  type="text"
                  name="drop"
                  ref={dropInputRef}
                  placeholder={
                    formData.tripType === "Airport"
                      ? "Enter your destination or airport"
                      : formData.tripType === "Hourly Rental"
                        ? "Where would you like to travel?"
                        : "Where are you going?"
                  }
                  value={formData.drop}
                  onChange={handleChange}
                  required
                />
              </div>
              {formData.tripType === "Hourly Rental" && (
                <div className="input-group">
                  <label htmlFor="rental-hours">Rental Duration (hours)</label>
                  <input
                    id="rental-hours"
                    type="number"
                    name="rentalHours"
                    min="1"
                    max="24"
                    step="1"
                    placeholder="Enter hours (1–24)"
                    value={formData.rentalHours}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}
              <div className="form-row">
                <div className="input-group">
                  <label>Travel Date</label>

                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Pickup Time</label>

                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Select Car</label>

                <select name="car" value={formData.car} onChange={handleChange}>
                  {vehicles.map((vehicle) => (
                    <option
                      key={vehicle.bookingName}
                      value={vehicle.bookingName}
                    >
                      {vehicle.bookingName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="booking-submit"
                disabled={bookingSubmitting}
              >
                {bookingSubmitting
                  ? "Booking your ride..."
                  : "🚕 Book ride — driver will call to confirm"}
              </button>

              <small className="form-note">
                We will send a booking confirmation by SMS. Our driver will call
                to confirm your trip.
              </small>
              {bookingMessage && (
                <p className="booking-result" role="status">
                  {bookingMessage}
                </p>
              )}
            </form>
          </div>
        </section>

        {/* ABOUT */}
        <section className="section about-section" id="about">
          <div className="about-grid">
            <div className="about-visual">
              <img
                className="about-image"
                src="/cars/tata-indica.jpeg"
                alt="Hosur City Best Taxi car on a local street"
              />
              <div className="about-big-number">
                24
                <span>/7</span>
              </div>

              <p>Ready to serve you</p>
            </div>

            <div className="about-content">
              <span className="section-label">ABOUT US</span>

              <h2>
                Your trusted travel
                <span> partner in Hosur.</span>
              </h2>

              <p>
                Hosur City Best Taxi is focused on providing dependable taxi
                services for local trips, airport transfers and outstation
                journeys.
              </p>

              <p>
                Our goal is simple — make every journey comfortable, safe and
                convenient for our customers.
              </p>

              <a href="#booking" className="primary-btn">
                Start Your Journey →
              </a>
            </div>
          </div>
        </section>
        {/* CTA */}
        <section className="cta-section">
          <div className="cta-content">
            <span>YOUR NEXT JOURNEY IS ONE CLICK AWAY</span>

            <h2>Ready to ride?</h2>

            <p>Book your taxi today and travel with confidence.</p>

            <a href="#booking" className="primary-btn">
              🚕 Book Your Taxi
            </a>
          </div>
        </section>

        {/* CONTACT */}
        <section className="contact-section" id="contact">
          <div className="contact-container">
            <div>
              <span className="section-label">CONTACT US</span>

              <h2>
                Need a ride?
                <span> Talk to us.</span>
              </h2>

              <p>We're here to help with your next journey.</p>
            </div>

            <div className="contact-items">
              <a href="tel:+918438001838">
                <span>📞</span>
                <div>
                  <small>CALL US</small>
                  <strong>+91 8438001838</strong>
                </div>
              </a>

              <a
                href="https://wa.me/918438001838"
                target="_blank"
                rel="noreferrer"
              >
                <span>💬</span>
                <div>
                  <small>WHATSAPP</small>
                  <strong>Chat with us</strong>
                </div>
              </a>
            </div>
          </div>
        </section>
        {/* FLOATING CONTACT BUTTONS */}
        <div className="floating-contact">
          <a
            href="tel:+918438001838"
            className="float-call"
            aria-label="Call Hosur City Best Taxi"
          >
            📞
          </a>

          <a
            href="https://wa.me/918438001838"
            target="_blank"
            rel="noreferrer"
            className="float-whatsapp"
            aria-label="WhatsApp Hosur City Best Taxi"
          >
            💬
          </a>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <a href="#home" className="logo">
              <span>HOSUR CITY</span>
              <strong>BEST TAXI</strong>
            </a>

            <p>
              Reliable rides. Comfortable journeys. Your trusted taxi partner.
            </p>
          </div>

          <div className="footer-links">
            <div>
              <h4>Quick Links</h4>
              <a href="#home">Home</a>
              <a href="#services">Services</a>
              <a href="#fleet">Our Cars</a>
              <a href="#booking">Book Ride</a>
            </div>

            <div>
              <h4>Services</h4>
              <a href="#booking">Local Taxi</a>
              <a href="#booking">Airport Taxi</a>
              <a href="#booking">Outstation Taxi</a>
            </div>

            <div className="footer-social">
              <h4>Follow Us</h4>
              <a
                href="https://www.instagram.com/hosurcitybesttaxi/"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit Instagram"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
                </svg>
                Instagram
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61595438735855"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit Facebook"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8h3.4Z"
                  />
                </svg>
                Facebook
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © 2026 Hosur City Best Taxi. All rights reserved. Developed by
            PIXLUME.
          </span>

          <span>Made for better journeys.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

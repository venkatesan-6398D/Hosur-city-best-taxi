import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unexpected error.";

const getPickupAt = (dateValue: string, timeValue: string) => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const localTimeAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const calendarDate = new Date(localTimeAsUtc);
  if (
    calendarDate.getUTCFullYear() !== Number(year) ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return new Date(localTimeAsUtc - 330 * 60 * 1000);
};

const sha256 = async (value: string, pepper: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${pepper}:${value}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  throw new Error("Valid phone number with country code required.");
};

const sendBookingConfirmationSms = async ({
  bookingId,
  car,
  customerName,
  customerPhone,
  dropLocation,
  pickupLabel,
  pickupLocation,
  rentalHours,
  tripType,
  travelDate,
  travelTime,
}: {
  bookingId: number;
  car: string;
  customerName: string;
  customerPhone: string;
  dropLocation: string;
  pickupLabel: string;
  pickupLocation: string;
  rentalHours: number | null;
  tripType: string;
  travelDate: string;
  travelTime: string;
}): Promise<"sent" | "not_configured" | "failed"> => {
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const templateId = Deno.env.get("MSG91_CONFIRMATION_TEMPLATE_ID");
  if (!authKey || !templateId) {
    console.error("MSG91 booking SMS is not configured.");
    return "not_configured";
  }

  const rentalDetail =
    rentalHours === null ? "" : ` for ${rentalHours} hour(s)`;
  const tripDetails = `${tripType}${rentalDetail} - ${car}: ${pickupLabel || pickupLocation} to ${dropLocation} on ${travelDate} at ${travelTime}`;

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [
          {
            mobiles: customerPhone.replace(/^\+/, ""),
            VAR1: customerName,
            VAR2: String(bookingId),
            VAR3: tripDetails,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = await response.text();
    let responseBody: Record<string, unknown>;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      console.error("MSG91 returned an invalid response.", response.status);
      return "failed";
    }

    if (!response.ok || responseBody.type === "error") {
      console.error("MSG91 booking SMS request failed.", response.status);
      return "failed";
    }

    return "sent";
  } catch (error) {
    console.error("MSG91 booking SMS request failed.", errorMessage(error));
    return "failed";
  }
};

const requireDriver = async (request: Request) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new Error("Driver login required.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase auth is not configured.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || data.user?.app_metadata?.role !== "driver") {
    throw new Error("Driver access required.");
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase function is not configured." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (payload.action === "create_booking") {
      const customerName =
        typeof payload.customerName === "string" ? payload.customerName.trim() : "";
      const pickupLocation =
        typeof payload.pickupLocation === "string"
          ? payload.pickupLocation.trim()
          : "";
      const dropLocation =
        typeof payload.dropLocation === "string"
          ? payload.dropLocation.trim()
          : "";
      const travelDate =
        typeof payload.travelDate === "string" ? payload.travelDate : "";
      const travelTime =
        typeof payload.travelTime === "string" ? payload.travelTime : "";
      const car = typeof payload.car === "string" ? payload.car : "";
      const allowedTripTypes = [
        "Local Taxi",
        "Outstation",
        "Hourly Rental",
        "Airport",
      ];
      if (
        payload.tripType !== undefined &&
        (typeof payload.tripType !== "string" ||
          !allowedTripTypes.includes(payload.tripType))
      ) {
        return jsonResponse({ error: "Choose a valid trip type." }, 400);
      }
      const tripType =
        typeof payload.tripType === "string" &&
        allowedTripTypes.includes(payload.tripType)
          ? payload.tripType
          : "Local Taxi";
      const rentalHours =
        typeof payload.rentalHours === "number" &&
        Number.isInteger(payload.rentalHours)
          ? payload.rentalHours
          : null;
      const pickupAt = getPickupAt(travelDate, travelTime);

      if (
        !customerName ||
        !pickupLocation ||
        !dropLocation ||
        !pickupAt ||
        !car ||
        typeof payload.customerPhone !== "string"
      ) {
        return jsonResponse({ error: "Complete all booking details." }, 400);
      }
      if (
        (tripType === "Hourly Rental" &&
          (rentalHours === null || rentalHours < 1 || rentalHours > 24)) ||
        (tripType !== "Hourly Rental" && rentalHours !== null)
      ) {
        return jsonResponse(
          { error: "Choose a valid rental duration for hourly rentals." },
          400,
        );
      }
      if (pickupAt.getTime() <= Date.now()) {
        return jsonResponse(
          { error: "Pickup date and time must be in the future." },
          400,
        );
      }

      let customerPhone: string;
      try {
        customerPhone = normalizePhone(payload.customerPhone);
      } catch (error) {
        return jsonResponse({ error: errorMessage(error) }, 400);
      }

      const forwardedFor = request.headers.get("x-forwarded-for");
      const clientIp =
        request.headers.get("cf-connecting-ip") ||
        forwardedFor?.split(",")[0]?.trim() ||
        "unknown";
      const rateKeys = [
        { key: `phone:${await sha256(customerPhone, serviceRoleKey)}`, maximum: 3 },
        { key: `ip:${await sha256(clientIp, serviceRoleKey)}`, maximum: 10 },
      ];
      for (const rateLimit of rateKeys) {
        const { data: allowed, error: rateError } = await admin.rpc(
          "consume_booking_otp_rate_limit",
          {
            p_rate_key: rateLimit.key,
            p_max_requests: rateLimit.maximum,
            p_window_seconds: 3600,
          },
        );
        if (rateError) {
          console.error("Booking rate limit check failed", rateError.message);
          return jsonResponse(
            { error: "Booking service is temporarily unavailable." },
            503,
          );
        }
        if (!allowed) {
          return jsonResponse(
            { error: "Too many booking requests. Try again later." },
            429,
          );
        }
      }

      const { data: booking, error: insertError } = await admin
        .from("bookings")
        .insert({
          customer_name: customerName,
          customer_phone: customerPhone,
          pickup_location: pickupLocation,
          pickup_latitude:
            typeof payload.pickupLatitude === "number"
              ? payload.pickupLatitude
              : null,
          pickup_longitude:
            typeof payload.pickupLongitude === "number"
              ? payload.pickupLongitude
              : null,
          drop_location: dropLocation,
          drop_latitude:
            typeof payload.dropLatitude === "number" ? payload.dropLatitude : null,
          drop_longitude:
            typeof payload.dropLongitude === "number"
              ? payload.dropLongitude
              : null,
          travel_date: travelDate,
          travel_time: travelTime,
          car,
          trip_type: tripType,
          rental_hours: rentalHours,
          status: "Pending confirmation",
          pickup_at: pickupAt.toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Booking insert failed", insertError.message);
        return jsonResponse({ error: "Booking could not be saved." }, 500);
      }

      const smsStatus = await sendBookingConfirmationSms({
        bookingId: booking.id,
        car,
        customerName,
        customerPhone,
        dropLocation,
        pickupLabel:
          typeof payload.pickupLabel === "string" ? payload.pickupLabel.trim() : "",
        pickupLocation,
        rentalHours,
        tripType,
        travelDate,
        travelTime,
      });

      return jsonResponse(
        {
          bookingId: booking.id,
          smsSent: smsStatus === "sent",
          smsStatus,
          message:
            smsStatus === "sent"
              ? "Booking saved and confirmation SMS sent."
              : "Booking saved, but the confirmation SMS could not be sent.",
        },
        201,
      );
    }

    if (
      payload.action === "get_booking" ||
      payload.action === "confirm_booking" ||
      payload.action === "cancel_booking"
    ) {
      const bookingId = payload.bookingId;
      if (
        (typeof bookingId !== "number" && typeof bookingId !== "string") ||
        !/^\d+$/.test(String(bookingId)) ||
        typeof payload.customerPhone !== "string"
      ) {
        return jsonResponse({ error: "Valid booking details required." }, 400);
      }

      let customerPhone: string;
      try {
        customerPhone = normalizePhone(payload.customerPhone);
      } catch {
        return jsonResponse({ error: "Valid booking details required." }, 400);
      }

      if (payload.action === "get_booking") {
        const { data: booking, error } = await admin
          .from("bookings")
          .select("id, customer_phone, status")
          .eq("id", bookingId)
          .maybeSingle();
        if (error) {
          console.error("Booking status lookup failed", error.message);
          return jsonResponse({ error: "Booking status could not be loaded." }, 500);
        }
        if (!booking || booking.customer_phone !== customerPhone) {
          return jsonResponse({ error: "Booking not found." }, 404);
        }
        return jsonResponse({
          booking: { id: booking.id, status: booking.status },
        });
      }

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .select("id, customer_phone, status")
        .eq("id", bookingId)
        .maybeSingle();
      if (bookingError) {
        console.error("Booking status update lookup failed", bookingError.message);
        return jsonResponse({ error: "Booking status could not be updated." }, 500);
      }
      if (!booking || booking.customer_phone !== customerPhone) {
        return jsonResponse({ error: "Booking not found." }, 404);
      }

      const isConfirming = payload.action === "confirm_booking";
      const nextStatus = isConfirming ? "Customer confirmed" : "Cancelled";
      const eligibleStatuses = isConfirming
        ? ["Pending confirmation", "Driver contacted"]
        : ["Pending confirmation", "Driver contacted", "Customer confirmed"];

      const { data: updatedBooking, error: updateError } = await admin
        .from("bookings")
        .update({ status: nextStatus })
        .eq("id", bookingId)
        .eq("customer_phone", customerPhone)
        .in("status", eligibleStatuses)
        .select("id")
        .maybeSingle();
      if (updateError) {
        console.error("Booking status update failed", updateError.message);
        return jsonResponse(
          { error: `Booking could not be ${isConfirming ? "confirmed" : "cancelled"}.` },
          500,
        );
      }
      if (!updatedBooking) {
        return jsonResponse(
          {
            error: `This booking is already updated or can no longer be ${isConfirming ? "confirmed" : "cancelled"}.`,
          },
          409,
        );
      }
      return jsonResponse(
        isConfirming ? { confirmed: true } : { cancelled: true },
      );
    }

    if (
      payload.action === "list_bookings" ||
      payload.action === "mark_contacted" ||
      payload.action === "mark_completed" ||
      payload.action === "driver_cancel_booking"
    ) {
      try {
        await requireDriver(request);
      } catch (error) {
        return jsonResponse({ error: errorMessage(error) }, 403);
      }
    }

    if (payload.action === "list_bookings") {
      const { data, error } = await admin
        .from("bookings")
        .select(
          "id, customer_name, customer_phone, pickup_location, pickup_latitude, pickup_longitude, drop_location, drop_latitude, drop_longitude, travel_date, travel_time, car, status",
        )
        .order("id", { ascending: false });
      if (error) {
        console.error("Driver booking list failed", error.message);
        return jsonResponse({ error: "Bookings could not be loaded." }, 500);
      }
      return jsonResponse({ bookings: data });
    }

    if (payload.action === "mark_contacted") {
      const bookingId = payload.bookingId;
      if (
        (typeof bookingId !== "number" && typeof bookingId !== "string") ||
        !/^\d+$/.test(String(bookingId))
      ) {
        return jsonResponse({ error: "Valid booking ID required." }, 400);
      }

      const { data: booking, error } = await admin
        .from("bookings")
        .update({ status: "Driver contacted" })
        .eq("id", bookingId)
        .eq("status", "Pending confirmation")
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("Booking contact status update failed", error.message);
        return jsonResponse({ error: "Booking status could not be updated." }, 500);
      }
      if (!booking) {
        return jsonResponse(
          { error: "Booking is already updated or no longer available." },
          409,
        );
      }
      return jsonResponse({ updated: true });
    }

    if (payload.action === "mark_completed") {
      const bookingId = payload.bookingId;
      if (
        (typeof bookingId !== "number" && typeof bookingId !== "string") ||
        !/^\d+$/.test(String(bookingId))
      ) {
        return jsonResponse({ error: "Valid booking ID required." }, 400);
      }

      const { data: booking, error } = await admin
        .from("bookings")
        .update({ status: "Completed" })
        .eq("id", bookingId)
        .eq("status", "Customer confirmed")
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("Booking completion update failed", error.message);
        return jsonResponse({ error: "Booking could not be completed." }, 500);
      }
      if (!booking) {
        return jsonResponse(
          { error: "Booking is already updated or no longer active." },
          409,
        );
      }
      return jsonResponse({ completed: true });
    }

    if (payload.action === "driver_cancel_booking") {
      const bookingId = payload.bookingId;
      if (
        (typeof bookingId !== "number" && typeof bookingId !== "string") ||
        !/^\d+$/.test(String(bookingId))
      ) {
        return jsonResponse({ error: "Valid booking ID required." }, 400);
      }

      const { data: booking, error } = await admin
        .from("bookings")
        .update({ status: "Cancelled" })
        .eq("id", bookingId)
        .in("status", [
          "Pending confirmation",
          "Driver contacted",
          "Customer confirmed",
        ])
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("Driver booking cancellation failed", error.message);
        return jsonResponse({ error: "Booking could not be cancelled." }, 500);
      }
      if (!booking) {
        return jsonResponse(
          { error: "Booking is already updated or no longer active." },
          409,
        );
      }
      return jsonResponse({ cancelled: true });
    }

    return jsonResponse({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Booking service failed", error);
    return jsonResponse(
      { error: `Booking service failed: ${errorMessage(error)}` },
      500,
    );
  }
});

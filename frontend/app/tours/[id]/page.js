
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "../../components/BookingForm";
import AuthGuard from "../../components/AuthGuard";

export default async function TourDetails({ params }) {
  const { id } = await params;

  const response = await fetch(
    "http://127.0.0.1:5000/api/tours",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to load tours");
  }

  const tours = await response.json();

  const tour = tours.find(
    (item) => item.id === Number(id)
  );

  if (!tour) {
    notFound();
  }

  return (
    <main style={{
      padding: "40px",
      fontFamily: "Arial"
    }}>
      <Link href="/" className="back-btn">
        ← Back to Home
      </Link>

      <h1>{tour.name}</h1>

      <Image
        src={`/images/${tour.location.toLowerCase()}.jpg`}
        alt={tour.name}
        width={600}
        height={400}
        style={{
          width: "100%",
          maxWidth: "600px",
          height: "auto",
          borderRadius: "12px"
        }}
      />

      <h2>Tour Information</h2>

      <p>Destination: {tour.location}</p>

      <div
  style={{
    backgroundColor: "#f0fdf4",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "20px"
  }}
>
  <h3>
    Base Package Fee: Rs.{" "}
    {Number(tour.price).toLocaleString("en-LK")}
  </h3>

  <p>
    This is the base package fee only.
    Transportation charges are calculated separately
    based on pickup location, travel distance,
    driver location and trip type.
  </p>

  <p>
    Optional translator charges are not included.
    Your final price will be displayed before payment.
  </p>
</div>

      <a href="#booking">Book Now</a>

      <div id="booking" style={{ marginTop: "25px" }}>
        <AuthGuard role="customer">
          <BookingForm tourId={tour.id} />
        </AuthGuard>
      </div>
    </main>
  );
}

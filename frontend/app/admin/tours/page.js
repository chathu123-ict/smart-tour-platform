
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = "http://127.0.0.1:5000";

const emptyForm = {
  name: "",
  location: "",
  price: ""
};

export default function AdminManageTours() {
  const router = useRouter();

  const [tours, setTours] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTours() {
    const response = await fetch(
      `${API}/api/admin/tours`,
      {
        credentials: "include",
        cache: "no-store"
      }
    );

    if (response.status === 401) {
      router.replace("/login");
      throw new Error("Please login first");
    }

    if (response.status === 403) {
      throw new Error("Admin access required");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to load tours"
      );
    }

    setTours(data);
  }

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        await loadTours();
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    start();

    return () => {
      active = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editTour(tour) {
    setEditingId(tour.id);

    setForm({
      name: tour.name,
      location: tour.location,
      price: String(tour.price)
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function saveTour(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const isEditing = editingId !== null;

    const url = isEditing
      ? `${API}/api/admin/tours/${editingId}`
      : `${API}/api/admin/tours`;

    try {
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim(),
          price: form.price
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save tour"
        );
      }

      await loadTours();

      resetForm();

      setMessage(
        isEditing
          ? "Tour updated successfully!"
          : "New tour added successfully!"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTour(tour) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${tour.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(tour.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API}/api/admin/tours/${tour.id}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete tour"
        );
      }

      await loadTours();

      if (editingId === tour.id) {
        resetForm();
      }

      setMessage("Tour deleted successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    marginTop: "7px",
    marginBottom: "18px",
    boxSizing: "border-box"
  };

  const buttonStyle = {
    padding: "10px 18px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  };

  return (
    <main
      style={{
        maxWidth: "1050px",
        margin: "30px auto",
        padding: "20px",
        fontFamily: "Arial"
      }}
    >
      <Link
  href="/admin"
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "#166534",
    color: "white",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "14px",
    marginBottom: "20px"
  }}
>
  ← Back to Admin Dashboard
</Link>

      <h1>Manage Tour Packages</h1>

      <p>
        Add new tours, update details and manage prices.
      </p>

      {message && (
        <p role="status" style={{ color: "green" }}>
          {message}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}

      {!loading && (
        <div
          style={{
            backgroundColor: "#f9fafb",
            border: "1px solid #ddd",
            padding: "25px",
            borderRadius: "12px",
            marginTop: "25px"
          }}
        >
          <h2>
            {editingId !== null
              ? "Edit Tour"
              : "Add New Tour"}
          </h2>

          <form onSubmit={saveTour}>
            <label htmlFor="tourName">
              <strong>Tour Name</strong>
            </label>

            <input
              id="tourName"
              name="name"
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={handleChange}
              placeholder="Example: Nuwara Eliya Tour"
              style={inputStyle}
            />

            <label htmlFor="tourLocation">
              <strong>Location</strong>
            </label>

            <input
              id="tourLocation"
              name="location"
              type="text"
              required
              maxLength={100}
              value={form.location}
              onChange={handleChange}
              placeholder="Example: Nuwara Eliya"
              style={inputStyle}
            />

            <label htmlFor="tourPrice">
              <strong>Tour Price (LKR)</strong>
            </label>

            <input
              id="tourPrice"
              name="price"
              type="number"
              required
              min="0.01"
              max="99999999.99"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              style={inputStyle}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...buttonStyle,
                  backgroundColor: "#166534",
                  color: "white"
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update Tour"
                  : "Add Tour"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetForm}
                  style={{
                    ...buttonStyle,
                    backgroundColor: "#e5e7eb"
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <h2 style={{ marginTop: "35px" }}>
        Existing Tours ({tours.length})
      </h2>

      {loading && <p>Loading tours...</p>}

      {!loading && tours.length === 0 && (
        <p>No tours found.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "18px"
        }}
      >
        {tours.map((tour) => (
          <div
            key={tour.id}
            style={{
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "20px"
            }}
          >
            <h3>{tour.name}</h3>

            <p>
              <strong>Tour ID:</strong> {tour.id}
            </p>

            <p>
              <strong>Location:</strong> {tour.location}
            </p>

            <p
              style={{
                color: "#166534",
                fontSize: "20px",
                fontWeight: "bold"
              }}
            >
              LKR{" "}
              {Number(tour.price).toLocaleString("en-LK")}
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px"
              }}
            >
              <button
                type="button"
                onClick={() => editTour(tour)}
                style={{
                  ...buttonStyle,
                  backgroundColor: "#2563eb",
                  color: "white"
                }}
              >
                Edit
              </button>

              <button
                type="button"
                disabled={deletingId === tour.id}
                onClick={() => deleteTour(tour)}
                style={{
                  ...buttonStyle,
                  backgroundColor: "#dc2626",
                  color: "white"
                }}
              >
                {deletingId === tour.id
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

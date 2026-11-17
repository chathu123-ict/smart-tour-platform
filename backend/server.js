
const express = require("express");
const cors = require("cors");
const sql = require("msnodesqlv8");
const connectionString = require("./db");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = 5000;


// 1. MIDDLEWARE


app.use(cors({
  origin: "http://127.0.0.1:3000",
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  }
}));


// 2. AUTHENTICATION HELPERS


function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      message: "Please login first"
    });
  }

  next();
}

function requireRole(role) {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: "Please login first"
      });
    }

    if (String(user.role).toLowerCase() !== role) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    next();
  };
}

function getDriverId(req) {
  const id = Number(req.session?.user?.driverId);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}


// 3. HOME


app.get("/", (req, res) => {
  res.send("Smart Tour Backend is Running!");
});


// 4. GET ALL TOURS


app.get("/api/tours", (req, res) => {
  sql.query(
    connectionString,
    "SELECT * FROM Tours",
    (error, rows) => {
      if (error) {
        console.error("Tours Error:", error);

        return res.status(500).json({
          message: "Failed to load tours"
        });
      }

      res.json(rows);
    }
  );
});


// 5. REGISTER CUSTOMER



app.post("/api/register", async (req, res) => {
  const {
    name,
    email,
    password,
    role = "Customer",
    vehicle,
    location
  } = req.body;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      message: "Invalid registration details"
    });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || cleanName.length > 100) {
    return res.status(400).json({
      message: "Invalid name"
    });
  }

  if (
    cleanEmail.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    return res.status(400).json({
      message: "Invalid email address"
    });
  }

  if (
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Password must be at least 8 characters and at most 72 bytes"
    });
  }

  if (role !== "Customer" && role !== "Driver") {
    return res.status(400).json({
      message: "Invalid account role"
    });
  }

  if (
    role === "Driver" &&
    (
      typeof vehicle !== "string" ||
      typeof location !== "string" ||
      !vehicle.trim() ||
      !location.trim() ||
      vehicle.trim().length > 100 ||
      location.trim().length > 100
    )
  ) {
    return res.status(400).json({
      message: "Valid vehicle and location are required"
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @name NVARCHAR(100) = ?;
      DECLARE @email NVARCHAR(150) = ?;
      DECLARE @passwordHash NVARCHAR(255) = ?;
      DECLARE @role NVARCHAR(20) = ?;
      DECLARE @vehicle NVARCHAR(100) = ?;
      DECLARE @location NVARCHAR(100) = ?;

      DECLARE @driverId INT = NULL;
      DECLARE @newUserId INT;
      DECLARE @resultCode INT = 201;
      DECLARE @message NVARCHAR(200) = N'';

      BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
          SELECT 1
          FROM Users WITH (UPDLOCK, HOLDLOCK)
          WHERE email = @email
        )
        BEGIN
          SET @resultCode = 409;
          SET @message = N'Email already registered';
        END
        ELSE
        BEGIN
          IF @role = 'Driver'
          BEGIN
            INSERT INTO Drivers
              (name, vehicle, location, available)
            VALUES
              (@name, @vehicle, @location, 1);

            SET @driverId = CONVERT(INT, SCOPE_IDENTITY());
          END

          INSERT INTO Users
            (name, email, passwordHash, role, driverId)
          VALUES
            (@name, @email, @passwordHash, @role, @driverId);

          SET @newUserId = CONVERT(INT, SCOPE_IDENTITY());

          SET @message = N'Registration successful!';
        END

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRANSACTION;

        THROW;
      END CATCH;

      SELECT
        @resultCode AS resultCode,
        @message AS message,
        @newUserId AS id,
        @name AS name,
        @email AS email,
        @role AS role,
        @driverId AS driverId;
    `;

    sql.query(
      connectionString,
      query,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        role,
        role === "Driver" ? vehicle.trim() : "",
        role === "Driver" ? location.trim() : ""
      ],
      (error, rows) => {
        if (error) {
          console.error("Registration Error:", error);

          if (
            /2627|2601|duplicate|UNIQUE/i.test(
              error.message || ""
            )
          ) {
            return res.status(409).json({
              message: "Email already registered"
            });
          }

          return res.status(500).json({
            message: "Registration failed"
          });
        }

        const result = rows[0];

        if (result.resultCode !== 201) {
          return res.status(result.resultCode).json({
            message: result.message
          });
        }

        res.status(201).json({
          message: result.message,
          user: {
            id: result.id,
            name: result.name,
            email: result.email,
            role: result.role,
            driverId: result.driverId
          }
        });
      }
    );

  } catch (error) {
    console.error("Registration Error:", error);

    res.status(500).json({
      message: "Registration failed"
    });
  }
});



// 6. LOGIN

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  const query = `
    SELECT
      id,
      name,
      email,
      passwordHash,
      role,
      driverId
    FROM Users
    WHERE email = ?
  `;

  sql.query(
    connectionString,
    query,
    [cleanEmail],
    async (error, rows) => {
      if (error) {
        console.error("Login Database Error:", error);

        return res.status(500).json({
          message: "Login failed"
        });
      }

      if (rows.length === 0) {
        return res.status(401).json({
          message: "Invalid email or password"
        });
      }

      const user = rows[0];

      try {
        const validPassword = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!validPassword) {
          return res.status(401).json({
            message: "Invalid email or password"
          });
        }

        req.session.regenerate((sessionError) => {
          if (sessionError) {
            return res.status(500).json({
              message: "Failed to create session"
            });
          }

          req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            driverId: user.driverId ?? null
          };

          req.session.save((saveError) => {
            if (saveError) {
              return res.status(500).json({
                message: "Failed to save session"
              });
            }

            res.json({
              message: "Login successful!",
              user: req.session.user
            });
          });
        });

      } catch (error) {
        console.error("Login Error:", error);

        res.status(500).json({
          message: "Login failed"
        });
      }
    }
  );
});


// 7. CHECK SESSION


app.get("/api/me", requireLogin, (req, res) => {
  res.json({
    message: "Session active",
    user: req.session.user
  });
});


// 8. LOGOUT



app.post("/api/logout", (req, res) => {

  function finishLogout() {
    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/"
    });

    return res.status(200).json({
      message: "Logged out successfully"
    });
  }

  // Already logged out
  if (!req.session?.user) {
    return finishLogout();
  }

  // Destroy active session
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout Error:", error);

      return res.status(500).json({
        message: "Failed to destroy session"
      });
    }

    return finishLogout();
  });
});




// 9. CREATE BOOKING


app.post(
  "/api/bookings",
  requireRole("customer"),
  (req, res) => {
    const { tourId, travelDate, people } = req.body;

    const user = req.session.user;
    const tourIdNumber = Number(tourId);
    const peopleCount = Number(people);

    if (
      !Number.isInteger(tourIdNumber) ||
      tourIdNumber < 1 ||
      !Number.isInteger(peopleCount) ||
      peopleCount < 1 ||
      typeof travelDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(travelDate) ||
      !Number.isFinite(Date.parse(travelDate))
    ) {
      return res.status(400).json({
        message: "Invalid booking details"
      });
    }

    const tourQuery = `
      SELECT id, name
      FROM Tours
      WHERE id = ?
    `;

    sql.query(
      connectionString,
      tourQuery,
      [tourIdNumber],
      (tourError, tourRows) => {
        if (tourError) {
          console.error("Tour Error:", tourError);

          return res.status(500).json({
            message: "Database error"
          });
        }

        if (tourRows.length === 0) {
          return res.status(404).json({
            message: "Tour not found"
          });
        }

        const tour = tourRows[0];

        const insertQuery = `
          INSERT INTO Bookings
            (tourId, name, email, travelDate, people, status)
          OUTPUT INSERTED.id
          VALUES (?, ?, ?, ?, ?, 'Pending')
        `;

        sql.query(
          connectionString,
          insertQuery,
          [
            tour.id,
            user.name,
            user.email,
            travelDate,
            peopleCount
          ],
          (error, rows) => {
            if (error) {
              console.error("Booking Error:", error);

              return res.status(500).json({
                message: "Failed to save booking"
              });
            }

            res.status(201).json({
              message: "Booking saved successfully!",
              booking: {
                id: rows[0].id,
                tourId: tour.id,
                tourName: tour.name,
                name: user.name,
                email: user.email,
                travelDate,
                people: peopleCount,
                status: "Pending"
              }
            });
          }
        );
      }
    );
  }
);


// 10. CUSTOMER BOOKINGS


app.get(
  "/api/bookings",
  requireRole("customer"),
  (req, res) => {
    const query = `
      SELECT
        b.id,
        b.tourId,
        t.name AS tourName,
        b.name,
        b.email,
        CONVERT(VARCHAR(10), b.travelDate, 23) AS travelDate,
        b.people,
        b.status
      FROM Bookings b
      INNER JOIN Tours t
        ON b.tourId = t.id
      WHERE LOWER(b.email) = ?
      ORDER BY b.id DESC
    `;

    sql.query(
      connectionString,
      query,
      [req.session.user.email.trim().toLowerCase()],
      (error, rows) => {
        if (error) {
          console.error("Bookings Error:", error);

          return res.status(500).json({
            message: "Failed to load bookings"
          });
        }

        res.json(rows);
      }
    );
  }
);


// 11. GET DRIVERS




app.get("/api/drivers", (req, res) => {
  const { travelDate } = req.query;

  if (
    travelDate &&
    (
      typeof travelDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(travelDate) ||
      !Number.isFinite(Date.parse(travelDate))
    )
  ) {
    return res.status(400).json({
      message: "Invalid travel date"
    });
  }

  const query = `
    SELECT
      d.id,
      d.name,
      d.vehicle,
      d.location,
      d.available,
      CASE
        WHEN ? IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM DriverRequests dr
            INNER JOIN Bookings b
              ON dr.bookingId = b.id
            WHERE dr.driverId = d.id
              AND dr.status = 'Accepted'
              AND b.travelDate = TRY_CONVERT(DATE, ?)
          )
        THEN CAST(0 AS BIT)
        ELSE d.available
      END AS availableForDate
    FROM Drivers d
    ORDER BY d.id
  `;

  sql.query(
    connectionString,
    query,
    [travelDate || null, travelDate || null],
    (error, rows) => {
      if (error) {
        console.error("Drivers Error:", error);

        return res.status(500).json({
          message: "Failed to load drivers"
        });
      }

      res.json(
        rows.map((driver) => ({
          ...driver,
          available: Boolean(driver.available),
          availableForDate: Boolean(driver.availableForDate)
        }))
      );
    }
  );
});




// 12. CREATE DRIVER REQUEST




app.post(
  "/api/driver-requests",
  requireRole("customer"),
  (req, res) => {
    const { bookingId, driverId } = req.body;

    const bookingIdNumber = Number(bookingId);
    const driverIdNumber = Number(driverId);

    if (
      !Number.isInteger(bookingIdNumber) ||
      bookingIdNumber < 1 ||
      !Number.isInteger(driverIdNumber) ||
      driverIdNumber < 1
    ) {
      return res.status(400).json({
        message: "Invalid booking or driver ID"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @bookingId INT = ?;
      DECLARE @driverId INT = ?;
      DECLARE @email NVARCHAR(150) = ?;

      DECLARE @resultCode INT = 201;
      DECLARE @message NVARCHAR(200) = N'';
      DECLARE @requestId INT;
      DECLARE @driverName NVARCHAR(200);
      DECLARE @tourName NVARCHAR(200);
      DECLARE @available BIT;
      DECLARE @bookingStatus NVARCHAR(30);
      DECLARE @travelDate DATE;

      BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
          @bookingStatus = b.status,
          @travelDate = b.travelDate,
          @tourName = t.name
        FROM Bookings b WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN Tours t ON b.tourId = t.id
        WHERE b.id = @bookingId
          AND LOWER(b.email) = @email;

        IF @bookingStatus IS NULL
        BEGIN
          SET @resultCode = 404;
          SET @message = N'Booking not found';
        END
        ELSE IF @bookingStatus = 'Confirmed'
        BEGIN
          SET @resultCode = 409;
          SET @message = N'Booking already confirmed';
        END
        ELSE
        BEGIN
          SELECT
            @driverName = name,
            @available = available
          FROM Drivers
          WHERE id = @driverId;

          IF @driverName IS NULL
          BEGIN
            SET @resultCode = 404;
            SET @message = N'Driver not found';
          END
          ELSE IF ISNULL(@available, 0) = 0
          BEGIN
            SET @resultCode = 409;
            SET @message = N'Driver is inactive or unavailable';
          END
          ELSE IF EXISTS (
            SELECT 1
            FROM DriverRequests dr
            INNER JOIN Bookings b
              ON dr.bookingId = b.id
            WHERE dr.driverId = @driverId
              AND dr.status = 'Accepted'
              AND b.travelDate = @travelDate
          )
          BEGIN
            SET @resultCode = 409;
            SET @message = N'Driver already booked for this date';
          END
          ELSE IF EXISTS (
            SELECT 1
            FROM DriverRequests
            WHERE bookingId = @bookingId
              AND status IN ('Pending', 'Accepted')
          )
          BEGIN
            SET @resultCode = 409;
            SET @message =
              N'This booking already has an active driver request';
          END
          ELSE
          BEGIN
            INSERT INTO DriverRequests
              (bookingId, driverId, status)
            VALUES (@bookingId, @driverId, 'Pending');

            SET @requestId = SCOPE_IDENTITY();
            SET @message = N'Driver request sent successfully!';
          END
        END

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRANSACTION;

        THROW;
      END CATCH;

      SELECT
        @resultCode AS resultCode,
        @message AS message,
        @requestId AS id,
        @bookingId AS bookingId,
        @driverId AS driverId,
        @driverName AS driverName,
        @tourName AS tourName,
        'Pending' AS status;
    `;

    sql.query(
      connectionString,
      query,
      [
        bookingIdNumber,
        driverIdNumber,
        req.session.user.email.trim().toLowerCase()
      ],
      (error, rows) => {
        if (error) {
          console.error("Driver Request Error:", error);

          return res.status(500).json({
            message: "Failed to create driver request"
          });
        }

        const result = rows[0];

        if (result.resultCode !== 201) {
          return res.status(result.resultCode).json({
            message: result.message
          });
        }

        res.status(201).json({
          message: result.message,
          request: {
            id: result.id,
            bookingId: result.bookingId,
            driverId: result.driverId,
            driverName: result.driverName,
            tourName: result.tourName,
            status: "Pending"
          }
        });
      }
    );
  }
);



// 13. GET DRIVER REQUESTS


app.get(
  "/api/driver-requests",
  requireLogin,
  (req, res) => {
    const user = req.session.user;
    const role = String(user.role).toLowerCase();

    if (role !== "customer" && role !== "driver") {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    let condition;
    let values;

    if (role === "customer") {
      condition = "LOWER(b.email) = ?";
      values = [user.email.trim().toLowerCase()];
    } else {
      const driverId = getDriverId(req);

      if (!driverId) {
        return res.status(403).json({
          message: "Driver profile not linked"
        });
      }

      condition = "dr.driverId = ?";
      values = [driverId];
    }

    

const query = `
  SELECT
    dr.id,
    dr.bookingId,
    dr.driverId,
    d.name AS driverName,
    t.name AS tourName,
    b.name AS customerName,
    CONVERT(VARCHAR(10), b.travelDate, 23) AS travelDate,
    b.people AS people,
    dr.status
  FROM DriverRequests dr
  INNER JOIN Bookings b
    ON dr.bookingId = b.id
  INNER JOIN Tours t
    ON b.tourId = t.id
  INNER JOIN Drivers d
    ON dr.driverId = d.id
  WHERE ${condition}
  ORDER BY dr.id DESC
`;



    sql.query(
      connectionString,
      query,
      values,
      (error, rows) => {
        if (error) {
          console.error("Requests Error:", error);

          return res.status(500).json({
            message: "Failed to load driver requests"
          });
        }

        res.json(rows);
      }
    );
  }
);


// 14. ACCEPT / REJECT DRIVER REQUEST




app.patch(
  "/api/driver-requests/:id",
  requireRole("driver"),
  (req, res) => {
    const requestId = Number(req.params.id);
    const { status } = req.body;
    const driverId = getDriverId(req);

    if (!driverId) {
      return res.status(403).json({
        message: "Driver profile not linked"
      });
    }

    if (!Number.isInteger(requestId) || requestId < 1) {
      return res.status(400).json({
        message: "Invalid request ID"
      });
    }

    if (status !== "Accepted" && status !== "Rejected") {
      return res.status(400).json({
        message: "Invalid status"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @requestId INT = ?;
      DECLARE @newStatus NVARCHAR(20) = ?;
      DECLARE @sessionDriverId INT = ?;

      DECLARE @resultCode INT = 200;
      DECLARE @message NVARCHAR(200) = N'';

      DECLARE @currentStatus NVARCHAR(20);
      DECLARE @bookingId INT;
      DECLARE @driverId INT;
      DECLARE @driverAvailable BIT;
      DECLARE @travelDate DATE;
      DECLARE @bookingStatus NVARCHAR(30);

      BEGIN TRY
        BEGIN TRANSACTION;

        -- Serialize acceptance attempts for this driver
        SELECT @driverAvailable = available
        FROM Drivers WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @sessionDriverId;

        SELECT
          @currentStatus = status,
          @bookingId = bookingId,
          @driverId = driverId
        FROM DriverRequests WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @requestId
          AND driverId = @sessionDriverId;

        IF @bookingId IS NULL
        BEGIN
          SET @resultCode = 404;
          SET @message = N'Driver request not found';
        END
        ELSE IF @currentStatus <> 'Pending'
        BEGIN
          SET @resultCode = 400;
          SET @message = N'Request already processed';
        END
        ELSE IF @newStatus = 'Rejected'
        BEGIN
          UPDATE DriverRequests
          SET status = 'Rejected'
          WHERE id = @requestId;

          SET @message =
            N'Driver request rejected successfully!';
        END
        ELSE
        BEGIN
          SELECT
            @travelDate = travelDate,
            @bookingStatus = status
          FROM Bookings WITH (UPDLOCK, HOLDLOCK)
          WHERE id = @bookingId;

          IF @travelDate IS NULL
          BEGIN
            SET @resultCode = 404;
            SET @message = N'Booking not found';
          END
          ELSE IF @bookingStatus <> 'Pending'
          BEGIN
            SET @resultCode = 409;
            SET @message = N'Booking is no longer pending';
          END
          ELSE IF ISNULL(@driverAvailable, 0) = 0
          BEGIN
            SET @resultCode = 409;
            SET @message = N'Driver is inactive or unavailable';
          END
          ELSE IF EXISTS (
            SELECT 1
            FROM DriverRequests
            WHERE bookingId = @bookingId
              AND id <> @requestId
              AND status = 'Accepted'
          )
          BEGIN
            SET @resultCode = 409;
            SET @message =
              N'Another driver already accepted this booking';
          END
          ELSE IF EXISTS (
            SELECT 1
            FROM DriverRequests dr
            INNER JOIN Bookings b
              ON dr.bookingId = b.id
            WHERE dr.driverId = @driverId
              AND dr.status = 'Accepted'
              AND b.travelDate = @travelDate
              AND dr.id <> @requestId
          )
          BEGIN
            SET @resultCode = 409;
            SET @message =
              N'Driver already booked for this date';
          END
          ELSE
          BEGIN
            UPDATE DriverRequests
            SET status = 'Accepted'
            WHERE id = @requestId;

            UPDATE Bookings
            SET status = 'Confirmed'
            WHERE id = @bookingId;

            -- Do not set Drivers.available = 0 here.
            -- Availability is checked per travel date.

            SET @message =
              N'Driver request accepted successfully!';
          END
        END

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRANSACTION;

        THROW;
      END CATCH;

      SELECT
        @resultCode AS resultCode,
        @message AS message,
        dr.id,
        dr.bookingId,
        dr.driverId,
        d.name AS driverName,
        t.name AS tourName,
        dr.status
      FROM (SELECT 1 AS dummy) x
      LEFT JOIN DriverRequests dr
        ON dr.id = @requestId
      LEFT JOIN Drivers d
        ON dr.driverId = d.id
      LEFT JOIN Bookings b
        ON dr.bookingId = b.id
      LEFT JOIN Tours t
        ON b.tourId = t.id;
    `;

    sql.query(
      connectionString,
      query,
      [requestId, status, driverId],
      (error, rows) => {
        if (error) {
          console.error("Update Request Error:", error);

          return res.status(500).json({
            message: "Failed to update driver request"
          });
        }

        const result = rows[0];

        if (!result) {
          return res.status(500).json({
            message: "No result returned"
          });
        }

        if (result.resultCode !== 200) {
          return res.status(result.resultCode).json({
            message: result.message
          });
        }

        res.json({
          message: result.message,
          request: {
            id: result.id,
            bookingId: result.bookingId,
            driverId: result.driverId,
            driverName: result.driverName,
            tourName: result.tourName,
            status: result.status
          }
        });
      }
    );
  }
);





app.get("/api/driver-profile", (req, res) => {
  const user = req.session?.user;

  if (!user) {
    return res.status(401).json({
      message: "Please login first"
    });
  }

  if (String(user.role).toLowerCase() !== "driver") {
    return res.status(403).json({
      message: "Only drivers can access this profile"
    });
  }

  const driverId = Number(user.driverId);

  if (!Number.isInteger(driverId) || driverId < 1) {
    return res.status(404).json({
      message: "Driver profile not linked"
    });
  }

  const query = `
    SELECT
      id,
      name,
      vehicle,
      location,
      available
    FROM Drivers
    WHERE id = ?
  `;

  sql.query(
    connectionString,
    query,
    [driverId],
    (error, rows) => {
      if (error) {
        console.error("Driver Profile Error:", error);

        return res.status(500).json({
          message: "Failed to load driver profile"
        });
      }

      if (rows.length === 0) {
        return res.status(404).json({
          message: "Driver profile not found"
        });
      }

      res.json({
        ...rows[0],
        available: Boolean(rows[0].available)
      });
    }
  );
});



// 15. START BACKEND SERVER


app.listen(PORT, () => {
  console.log(
    `Smart Tour Backend running on http://127.0.0.1:${PORT}`
  );
});

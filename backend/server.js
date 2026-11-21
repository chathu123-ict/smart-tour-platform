
const express = require("express");
const cors = require("cors");
const sql = require("msnodesqlv8");
const connectionString = require("./db");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = 5000;


const DRIVER_REQUEST_TIMEOUT_MINUTES = 10;


function expirePendingDriverRequests() {
  const query = `
    UPDATE DriverRequests
    SET status = 'Expired'
    WHERE status = 'Pending'
      AND createdAt <= DATEADD(
        MINUTE,
        -${DRIVER_REQUEST_TIMEOUT_MINUTES},
        SYSDATETIME()
      );
  `;

  sql.query(connectionString, query, (error) => {
    if (error) {
      console.error("Driver Timeout Error:", error);
      return;
    }

    // Check for automatic fallback after expiry update
    assignFallbackDriverRequest();
  });
}



function assignFallbackDriverRequest() {
  const query = `
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @bookingId INT = NULL;
    DECLARE @driverId INT = NULL;
    DECLARE @travelDate DATE;
    DECLARE @requestId INT = NULL;

    BEGIN TRY
      BEGIN TRANSACTION;

      -- Find a booking that needs automatic fallback
      SELECT TOP (1)
        @bookingId = b.id,
        @travelDate = b.travelDate
      FROM Bookings b WITH (UPDLOCK, HOLDLOCK)
      WHERE b.status = 'Pending'

        -- Customer must give permission
        AND b.autoFallbackEnabled = 1

        -- Previous driver rejected or expired
        AND EXISTS (
          SELECT 1
          FROM DriverRequests dr
          WHERE dr.bookingId = b.id
            AND dr.status IN ('Rejected', 'Expired')
        )

        -- No active request for this booking
        AND NOT EXISTS (
          SELECT 1
          FROM DriverRequests dr
          WHERE dr.bookingId = b.id
            AND dr.status IN ('Pending', 'Accepted')
        )

        -- At least one eligible driver must exist
        AND EXISTS (
          SELECT 1
          FROM Drivers d
          WHERE d.available = 1

            -- Do not request the same driver again
            AND NOT EXISTS (
              SELECT 1
              FROM DriverRequests dr
              WHERE dr.bookingId = b.id
                AND dr.driverId = d.id
            )

            -- Driver must be free on travel date
            AND NOT EXISTS (
              SELECT 1
              FROM DriverRequests dr
              INNER JOIN Bookings otherBooking
                ON dr.bookingId = otherBooking.id
              WHERE dr.driverId = d.id
                AND dr.status = 'Accepted'
                AND otherBooking.travelDate = b.travelDate
            )
        )
      ORDER BY b.id ASC;

      IF @bookingId IS NOT NULL
      BEGIN

        -- Select an eligible fallback driver
        SELECT TOP (1)
          @driverId = d.id
        FROM Drivers d WITH (UPDLOCK, HOLDLOCK)
        WHERE d.available = 1

          -- Avoid previously requested drivers
          AND NOT EXISTS (
            SELECT 1
            FROM DriverRequests dr
            WHERE dr.bookingId = @bookingId
              AND dr.driverId = d.id
          )

          -- Avoid drivers booked on the same date
          AND NOT EXISTS (
            SELECT 1
            FROM DriverRequests dr
            INNER JOIN Bookings otherBooking
              ON dr.bookingId = otherBooking.id
            WHERE dr.driverId = d.id
              AND dr.status = 'Accepted'
              AND otherBooking.travelDate = @travelDate
          )
        ORDER BY d.id ASC;

        IF @driverId IS NOT NULL
        BEGIN

          -- Automatically send the new request
          INSERT INTO DriverRequests
            (bookingId, driverId, status)
          VALUES
            (@bookingId, @driverId, 'Pending');

          SET @requestId = SCOPE_IDENTITY();

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
      @bookingId AS bookingId,
      @driverId AS driverId,
      @requestId AS requestId;
  `;

  sql.query(connectionString, query, (error, rows) => {
    if (error) {
      console.error("Automatic Fallback Error:", error);
      return;
    }

    const result = rows?.[0];

    if (result?.requestId) {
      console.log(
        `Automatic fallback request created: Booking ${result.bookingId}, Driver ${result.driverId}`
      );
    }
  });
}



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



 // 5. REGISTER CUSTOMER / DRIVER / TRANSLATOR

app.post("/api/register", async (req, res) => {
  const {
    name,
    email,
    password,
    role = "Customer",
    vehicle,
    location,
    languages,
    feePerDay
  } = req.body || {};

  // Basic validation
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

  const roles = {
    customer: "Customer",
    driver: "Driver",
    translator: "Translator"
  };

  const selectedRole =
    typeof role === "string"
      ? roles[role.trim().toLowerCase()]
      : null;

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

  if (!selectedRole) {
    return res.status(400).json({
      message: "Invalid account role"
    });
  }

  // Driver validation
  let cleanVehicle = "";
  let cleanLocation = "";

  if (selectedRole === "Driver") {
    if (
      typeof vehicle !== "string" ||
      typeof location !== "string"
    ) {
      return res.status(400).json({
        message: "Vehicle and location are required"
      });
    }

    cleanVehicle = vehicle.trim();
    cleanLocation = location.trim();

    if (
      !cleanVehicle ||
      !cleanLocation ||
      cleanVehicle.length > 100 ||
      cleanLocation.length > 100
    ) {
      return res.status(400).json({
        message: "Invalid vehicle or location"
      });
    }
  }

  // Translator validation
  let cleanLanguages = "";
  let translatorFee = 0;

  if (selectedRole === "Translator") {
    if (typeof languages !== "string") {
      return res.status(400).json({
        message: "Languages are required"
      });
    }

    cleanLanguages = languages.trim();

    if (
      !cleanLanguages ||
      cleanLanguages.length > 300
    ) {
      return res.status(400).json({
        message: "Invalid languages"
      });
    }

    const feeText = String(feePerDay ?? "").trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(feeText)) {
      return res.status(400).json({
        message: "Invalid daily fee"
      });
    }

    translatorFee = Number(feeText);

    if (
      !Number.isFinite(translatorFee) ||
      translatorFee > 99999999.99
    ) {
      return res.status(400).json({
        message: "Invalid daily fee"
      });
    }
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
      DECLARE @languages NVARCHAR(300) = ?;
      DECLARE @feePerDay DECIMAL(10,2) = ?;

      DECLARE @driverId INT = NULL;
      DECLARE @translatorId INT = NULL;
      DECLARE @newUserId INT = NULL;
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

          -- Create driver profile
          IF @role = 'Driver'
          BEGIN
            INSERT INTO Drivers
              (name, vehicle, location, available)
            VALUES
              (@name, @vehicle, @location, 1);

            SET @driverId =
              CONVERT(INT, SCOPE_IDENTITY());
          END

          -- Create translator profile
          IF @role = 'Translator'
          BEGIN
            INSERT INTO Translators
              (name, languages, feePerDay, available)
            VALUES
              (@name, @languages, @feePerDay, 1);

            SET @translatorId =
              CONVERT(INT, SCOPE_IDENTITY());
          END

          -- Create login account
          INSERT INTO Users
            (
              name,
              email,
              passwordHash,
              role,
              driverId,
              translatorId
            )
          VALUES
            (
              @name,
              @email,
              @passwordHash,
              @role,
              @driverId,
              @translatorId
            );

          SET @newUserId =
            CONVERT(INT, SCOPE_IDENTITY());

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
        @driverId AS driverId,
        @translatorId AS translatorId;
    `;

    sql.query(
      connectionString,
      query,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        selectedRole,
        cleanVehicle,
        cleanLocation,
        cleanLanguages,
        translatorFee
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

        const result = rows?.[0];

        if (!result) {
          return res.status(500).json({
            message: "No registration result returned"
          });
        }

        if (result.resultCode !== 201) {
          return res.status(result.resultCode).json({
            message: result.message
          });
        }

        return res.status(201).json({
          message: result.message,
          user: {
            id: result.id,
            name: result.name,
            email: result.email,
            role: result.role,
            driverId: result.driverId,
            translatorId: result.translatorId
          }
        });
      }
    );
  } catch (error) {
    console.error("Registration Error:", error);

    return res.status(500).json({
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
      driverId,
      translatorId
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
  driverId: user.driverId ?? null,
  translatorId: user.translatorId ?? null
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


// 11.1 GET DRIVERS




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



 // 11.2 GET ALL TRANSLATORS

app.get("/api/translators", (req, res) => {
  const { language, travelDate } = req.query;

  // Validate language
  if (
    language !== undefined &&
    (typeof language !== "string" ||
      !language.trim() ||
      language.length > 100)
  ) {
    return res.status(400).json({
      message: "Invalid language"
    });
  }

  // Validate travel date
  if (travelDate !== undefined) {
    if (
      typeof travelDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(travelDate) ||
      !Number.isFinite(Date.parse(travelDate)) ||
      new Date(travelDate).toISOString().slice(0, 10) !== travelDate
    ) {
      return res.status(400).json({
        message: "Invalid travel date"
      });
    }
  }

  const query = `
    SELECT
      t.id,
      t.name,
      t.languages,
      t.feePerDay,
      t.available,

      CASE
        WHEN ? IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM TranslatorRequests tr
            INNER JOIN Bookings b
              ON tr.bookingId = b.id
            WHERE tr.translatorId = t.id
              AND tr.status = 'Accepted'
              AND b.status <> 'Cancelled'
              AND b.travelDate = TRY_CONVERT(DATE, ?)
          )
        THEN CAST(0 AS BIT)
        ELSE t.available
      END AS availableForDate

    FROM Translators t
    ORDER BY t.id
  `;

  sql.query(
    connectionString,
    query,
    [travelDate || null, travelDate || null],
    (error, rows) => {
      if (error) {
        console.error("Translators Error:", error);

        return res.status(500).json({
          message: "Failed to load translators"
        });
      }

      let translators = rows.map((translator) => ({
        ...translator,
        available: Boolean(translator.available),
        availableForDate: Boolean(translator.availableForDate)
      }));

      // Filter by selected language
      if (language) {
        const selectedLanguage = language.trim().toLowerCase();

        translators = translators.filter((translator) => {
          const supportedLanguages = String(
            translator.languages || ""
          )
            .split(",")
            .map((item) => item.trim().toLowerCase());

          return supportedLanguages.includes(selectedLanguage);
        });
      }

      res.json(translators);
    }
  );
});





// 12.1 CREATE DRIVER REQUEST






app.post(
  "/api/driver-requests",
  requireRole("customer"),
  (req, res) => {
    const {
      bookingId,
      driverId,
      autoFallbackEnabled = false
    } = req.body;

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

    // Validate customer's permission
    if (typeof autoFallbackEnabled !== "boolean") {
      return res.status(400).json({
        message: "Invalid automatic fallback permission"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @bookingId INT = ?;
      DECLARE @driverId INT = ?;
      DECLARE @email NVARCHAR(150) = ?;
      DECLARE @autoFallbackEnabled BIT = ?;

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
        INNER JOIN Tours t
          ON b.tourId = t.id
        WHERE b.id = @bookingId
          AND LOWER(b.email) = @email;

        IF @bookingStatus IS NULL
        BEGIN
          SET @resultCode = 404;
          SET @message = N'Booking not found';
        END
        ELSE IF @bookingStatus <> 'Pending'
        BEGIN
          SET @resultCode = 409;
          SET @message = N'Booking is not pending';
        END
        ELSE
        BEGIN

          -- Expire old pending requests
          UPDATE DriverRequests
          SET status = 'Expired'
          WHERE bookingId = @bookingId
            AND status = 'Pending'
            AND createdAt <= DATEADD(
              MINUTE, -10, SYSDATETIME()
            );

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
            SET @message =
              N'Driver is inactive or unavailable';
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
            SET @message =
              N'Driver already booked for this date';
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

            -- Create new driver request
            INSERT INTO DriverRequests
              (bookingId, driverId, status)
            VALUES
              (@bookingId, @driverId, 'Pending');

            SET @requestId = SCOPE_IDENTITY();

            -- Save customer's automatic fallback permission
            UPDATE Bookings
            SET autoFallbackEnabled = @autoFallbackEnabled
            WHERE id = @bookingId;

            SET @message =
              N'Driver request sent successfully!';

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
        'Pending' AS status,
        @autoFallbackEnabled AS autoFallbackEnabled;
    `;

    sql.query(
      connectionString,
      query,
      [
        bookingIdNumber,
        driverIdNumber,
        req.session.user.email.trim().toLowerCase(),
        autoFallbackEnabled
      ],
      (error, rows) => {
        if (error) {
          console.error("Driver Request Error:", error);

          return res.status(500).json({
            message: "Failed to create driver request"
          });
        }

        const result = rows[0];

        if (!result) {
          return res.status(500).json({
            message: "No result returned"
          });
        }

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
            status: "Pending",
            autoFallbackEnabled:
              Boolean(result.autoFallbackEnabled)
          }
        });
      }
    );
  }
);





 // 12.2 CREATE TRANSLATOR REQUEST

app.post(
  "/api/translator-requests",
  requireRole("customer"),
  (req, res) => {
    const {
  bookingId,
  translatorId,
  autoFallbackEnabled = false
} = req.body || {};

if (typeof autoFallbackEnabled !== "boolean") {
  return res.status(400).json({
    message: "Invalid automatic fallback choice"
  });
}

    const bookingIdNumber = Number(bookingId);
    const translatorIdNumber = Number(translatorId);

    if (
      !Number.isSafeInteger(bookingIdNumber) ||
      bookingIdNumber < 1 ||
      !Number.isSafeInteger(translatorIdNumber) ||
      translatorIdNumber < 1
    ) {
      return res.status(400).json({
        message: "Invalid booking or translator ID"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @bookingId INT = ?;
      DECLARE @translatorId INT = ?;
      DECLARE @email NVARCHAR(150) = ?;
      DECLARE @autoFallback BIT = ?;

      DECLARE @resultCode INT = 201;
      DECLARE @message NVARCHAR(200) = N'';
      DECLARE @requestId INT = NULL;

      DECLARE @translatorName NVARCHAR(100);
      DECLARE @languages NVARCHAR(300);
      DECLARE @feePerDay DECIMAL(10,2);
      DECLARE @available BIT;

      DECLARE @bookingStatus NVARCHAR(30);
      DECLARE @travelDate DATE;
      DECLARE @tourName NVARCHAR(200);

      BEGIN TRY
        BEGIN TRANSACTION;

        -- Verify customer owns the booking
        SELECT
          @bookingStatus = b.status,
          @travelDate = b.travelDate,
          @tourName = t.name
        FROM Bookings b WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN Tours t
          ON b.tourId = t.id
        WHERE b.id = @bookingId
          AND LOWER(b.email) = @email;

        IF @bookingStatus IS NULL
        BEGIN
          SET @resultCode = 404;
          SET @message = N'Booking not found';
        END
        ELSE IF @bookingStatus NOT IN ('Pending', 'Confirmed')
        BEGIN
          SET @resultCode = 409;
          SET @message = N'Booking is not active';
        END
        ELSE
        BEGIN

          -- Expire requests older than 10 minutes
          UPDATE TranslatorRequests
          SET
            status = 'Expired',
            respondedAt = SYSDATETIME()
          WHERE bookingId = @bookingId
            AND status = 'Pending'
            AND createdAt <= DATEADD(
              MINUTE, -10, SYSDATETIME()
            );

          -- Get translator details and lock profile
          SELECT
            @translatorName = name,
            @languages = languages,
            @feePerDay = feePerDay,
            @available = available
          FROM Translators WITH (UPDLOCK, HOLDLOCK)
          WHERE id = @translatorId;

          IF @translatorName IS NULL
          BEGIN
            SET @resultCode = 404;
            SET @message = N'Translator not found';
          END
          ELSE IF ISNULL(@available, 0) = 0
          BEGIN
            SET @resultCode = 409;
            SET @message = N'Translator is unavailable';
          END
          ELSE IF EXISTS (
            SELECT 1
            FROM TranslatorRequests tr
            INNER JOIN Bookings b
              ON tr.bookingId = b.id
            WHERE tr.translatorId = @translatorId
              AND tr.status = 'Accepted'
              AND b.status <> 'Cancelled'
              AND b.travelDate = @travelDate
          )
          BEGIN
            SET @resultCode = 409;
            SET @message =
              N'Translator already booked for this date';
          END
          ELSE IF EXISTS (
            SELECT 1
            FROM TranslatorRequests
            WHERE bookingId = @bookingId
              AND status IN ('Pending', 'Accepted')
          )
          BEGIN
            SET @resultCode = 409;
            SET @message =
              N'Booking already has an active translator request';
          END
          ELSE
          BEGIN

            -- Create translator request
            INSERT INTO TranslatorRequests
  (bookingId, translatorId, status, autoFallbackEnabled)
VALUES
  (@bookingId, @translatorId, 'Pending', @autoFallback);

            SET @requestId =
              CONVERT(INT, SCOPE_IDENTITY());

            SET @message =
              N'Translator request sent successfully!';

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
        @translatorId AS translatorId,
        @translatorName AS translatorName,
        @languages AS languages,
        @feePerDay AS feePerDay,
        @tourName AS tourName;
    `;

    sql.query(
      connectionString,
      query,
      [
        bookingIdNumber,
        translatorIdNumber,
        req.session.user.email.trim().toLowerCase(),
        autoFallbackEnabled ? 1 : 0
      ],
      (error, rows) => {
        if (error) {
          console.error("Translator Request Error:", error);

          return res.status(500).json({
            message: "Failed to create translator request"
          });
        }

        const result = rows?.[0];

        if (!result) {
          return res.status(500).json({
            message: "No result returned"
          });
        }

        if (result.resultCode !== 201) {
          return res.status(result.resultCode).json({
            message: result.message
          });
        }

        return res.status(201).json({
          message: result.message,
          request: {
            id: result.id,
            bookingId: result.bookingId,
            translatorId: result.translatorId,
            translatorName: result.translatorName,
            languages: result.languages,
            feePerDay: result.feePerDay,
            tourName: result.tourName,
            status: "Pending"
          }
        });
      }
    );
  }
);





 // 12.3 GET TRANSLATOR BOOKING REQUESTS

app.get(
  "/api/translator-requests",
  requireRole("translator"),
  (req, res) => {
    const translatorId = Number(
      req.session.user.translatorId
    );

    if (
      !Number.isInteger(translatorId) ||
      translatorId < 1
    ) {
      return res.status(403).json({
        message: "Translator profile not found"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @translatorId INT = ?;

      BEGIN TRY
        BEGIN TRANSACTION;

        -- Cancel pending requests for cancelled bookings
        UPDATE tr
        SET
          tr.status = 'Cancelled',
          tr.respondedAt = SYSDATETIME()
        FROM TranslatorRequests tr
        INNER JOIN Bookings b
          ON tr.bookingId = b.id
        WHERE tr.translatorId = @translatorId
          AND tr.status = 'Pending'
          AND b.status = 'Cancelled';

        -- Expire pending requests after 10 minutes
        UPDATE TranslatorRequests
        SET
          status = 'Expired',
          respondedAt = SYSDATETIME()
        WHERE translatorId = @translatorId
          AND status = 'Pending'
          AND createdAt <= DATEADD(
            MINUTE, -10, SYSDATETIME()
          );

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRANSACTION;

        THROW;
      END CATCH;

      SELECT
        tr.id,
        tr.bookingId,
        tr.translatorId,
        tr.status,
        tr.createdAt,
        tr.respondedAt,



CASE
  WHEN tr.status = 'Pending' THEN
    CASE
      WHEN DATEDIFF(
        SECOND,
        SYSDATETIME(),
        DATEADD(MINUTE, 10, tr.createdAt)
      ) > 0
      THEN DATEDIFF(
        SECOND,
        SYSDATETIME(),
        DATEADD(MINUTE, 10, tr.createdAt)
      )
      ELSE 0
    END
  ELSE 0
END AS remainingSeconds,




        b.name AS customerName,
        b.travelDate,
        b.people,
        b.status AS bookingStatus,

        t.name AS tourName,

        translator.name AS translatorName,
        translator.languages,
        translator.feePerDay

      FROM TranslatorRequests tr

      INNER JOIN Bookings b
        ON tr.bookingId = b.id

      INNER JOIN Tours t
        ON b.tourId = t.id

      INNER JOIN Translators translator
        ON tr.translatorId = translator.id

      WHERE tr.translatorId = @translatorId

      ORDER BY tr.createdAt DESC, tr.id DESC;
    `;

    sql.query(
      connectionString,
      query,
      [translatorId],
      (error, rows) => {
        if (error) {
          console.error(
            "Get Translator Requests Error:",
            error
          );

          return res.status(500).json({
            message: "Failed to load translator requests"
          });
        }

        res.json({
          message: "Translator requests loaded",
          requests: rows || []
        });
      }
    );
  }
);



 // 12.4 TRANSLATOR ACCEPT / REJECT REQUEST

app.patch(
  "/api/translator-requests/:id",
  requireRole("translator"),
  (req, res) => {
    const requestId = Number(req.params.id);
    const translatorId = Number(
      req.session.user.translatorId
    );

    const status =
      typeof req.body?.status === "string"
        ? req.body.status.trim().toLowerCase()
        : "";

    if (
      !Number.isSafeInteger(requestId) ||
      requestId < 1 ||
      !Number.isSafeInteger(translatorId) ||
      translatorId < 1
    ) {
      return res.status(400).json({
        message: "Invalid request or translator ID"
      });
    }

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be Accepted or Rejected"
      });
    }

    const newStatus =
      status === "accepted" ? "Accepted" : "Rejected";

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @requestId INT = ?;
      DECLARE @translatorId INT = ?;
      DECLARE @newStatus NVARCHAR(20) = ?;

      DECLARE @resultCode INT = 200;
      DECLARE @message NVARCHAR(200) = N'';

      DECLARE @bookingId INT;
      DECLARE @currentStatus NVARCHAR(20);
      DECLARE @createdAt DATETIME2;

      DECLARE @bookingStatus NVARCHAR(30);
      DECLARE @travelDate DATE;
      DECLARE @available BIT;

      BEGIN TRY
        BEGIN TRANSACTION;

        -- Lock translator to prevent simultaneous acceptance
        SELECT @available = available
        FROM Translators WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @translatorId;

        IF @available IS NULL
        BEGIN
          SET @resultCode = 403;
          SET @message = N'Translator profile not found';
        END
        ELSE
        BEGIN

          -- Find request belonging to logged-in translator
          SELECT
            @bookingId = bookingId,
            @currentStatus = status,
            @createdAt = createdAt
          FROM TranslatorRequests WITH (UPDLOCK, HOLDLOCK)
          WHERE id = @requestId
            AND translatorId = @translatorId;

          IF @bookingId IS NULL
          BEGIN
            SET @resultCode = 404;
            SET @message = N'Request not found';
          END
          ELSE
          BEGIN

            SELECT
              @bookingStatus = status,
              @travelDate = travelDate
            FROM Bookings WITH (UPDLOCK, HOLDLOCK)
            WHERE id = @bookingId;

            IF @bookingStatus = 'Cancelled'
               AND @currentStatus = 'Pending'
            BEGIN
              UPDATE TranslatorRequests
              SET
                status = 'Cancelled',
                respondedAt = SYSDATETIME()
              WHERE id = @requestId;

              SET @currentStatus = 'Cancelled';
              SET @resultCode = 409;
              SET @message = N'Booking was cancelled';
            END
            ELSE IF @currentStatus <> 'Pending'
            BEGIN
              SET @resultCode = 409;
              SET @message = N'Request is not pending';
            END
            ELSE IF @createdAt <= DATEADD(
              MINUTE, -10, SYSDATETIME()
            )
            BEGIN
              UPDATE TranslatorRequests
              SET
                status = 'Expired',
                respondedAt = SYSDATETIME()
              WHERE id = @requestId;

              SET @currentStatus = 'Expired';
              SET @resultCode = 409;
              SET @message = N'Request has expired';
            END
            ELSE IF @bookingStatus NOT IN (
              'Pending', 'Confirmed'
            )
            BEGIN
              SET @resultCode = 409;
              SET @message = N'Booking is not active';
            END
            ELSE IF @newStatus = 'Accepted'
              AND @available = 0
            BEGIN
              SET @resultCode = 409;
              SET @message = N'Translator is unavailable';
            END
            ELSE IF @newStatus = 'Accepted'
              AND EXISTS (
                SELECT 1
                FROM TranslatorRequests tr
                INNER JOIN Bookings b
                  ON tr.bookingId = b.id
                WHERE tr.translatorId = @translatorId
                  AND tr.id <> @requestId
                  AND tr.status = 'Accepted'
                  AND b.status <> 'Cancelled'
                  AND b.travelDate = @travelDate
              )
            BEGIN
              SET @resultCode = 409;
              SET @message =
                N'Already booked for this date';
            END
            ELSE
            BEGIN

              UPDATE TranslatorRequests
              SET
                status = @newStatus,
                respondedAt = SYSDATETIME()
              WHERE id = @requestId
                AND status = 'Pending';

              SET @currentStatus = @newStatus;

              IF @newStatus = 'Accepted'
                SET @message =
                  N'Translator request accepted successfully!';
              ELSE
                SET @message =
                  N'Translator request rejected successfully!';

            END
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
        @translatorId AS translatorId,
        @currentStatus AS status;
    `;

    sql.query(
      connectionString,
      query,
      [requestId, translatorId, newStatus],
      (error, rows) => {
        if (error) {
          console.error(
            "Translator Response Error:",
            error
          );

          return res.status(500).json({
            message: "Failed to update translator request"
          });
        }

        const result = rows?.[0];

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

        return res.json({
          message: result.message,
          request: {
            id: result.id,
            bookingId: result.bookingId,
            translatorId: result.translatorId,
            status: result.status
          }
        });
      }
    );
  }
);



 // 12.5 CUSTOMER - VIEW TRANSLATOR REQUEST STATUS

app.get(
  "/api/customer/translator-requests",
  requireRole("customer"),
  (req, res) => {
    const email = String(
      req.session.user.email || ""
    ).trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Customer email not found"
      });
    }

    const query = `
      SET NOCOUNT ON;

      DECLARE @email NVARCHAR(255) = ?;

      -- Cancel requests if booking is cancelled
      UPDATE tr
      SET
        tr.status = 'Cancelled',
        tr.respondedAt = SYSDATETIME()
      FROM TranslatorRequests tr
      INNER JOIN Bookings b
        ON tr.bookingId = b.id
      WHERE LOWER(b.email) = @email
        AND b.status = 'Cancelled'
        AND tr.status IN ('Pending', 'Accepted');

      -- Expire requests after 10 minutes
      UPDATE tr
      SET
        tr.status = 'Expired',
        tr.respondedAt = SYSDATETIME()
      FROM TranslatorRequests tr
      INNER JOIN Bookings b
        ON tr.bookingId = b.id
      WHERE LOWER(b.email) = @email
        AND tr.status = 'Pending'
        AND tr.createdAt <= DATEADD(
          MINUTE, -10, SYSDATETIME()
        );

      -- Get customer translator requests
      SELECT
        tr.id,
        tr.bookingId,
        tr.translatorId,
        tr.status,
        tr.createdAt,
        tr.respondedAt,

        t.name AS tourName,

        translator.name AS translatorName,
        translator.languages,
        translator.feePerDay,

        b.travelDate,
        b.status AS bookingStatus,

        CASE
          WHEN tr.status = 'Pending' THEN
            CASE
              WHEN DATEDIFF(
                SECOND,
                SYSDATETIME(),
                DATEADD(MINUTE, 10, tr.createdAt)
              ) > 0
              THEN DATEDIFF(
                SECOND,
                SYSDATETIME(),
                DATEADD(MINUTE, 10, tr.createdAt)
              )
              ELSE 0
            END
          ELSE 0
        END AS remainingSeconds

      FROM TranslatorRequests tr

      INNER JOIN Bookings b
        ON tr.bookingId = b.id

      INNER JOIN Tours t
        ON b.tourId = t.id

      INNER JOIN Translators translator
        ON tr.translatorId = translator.id

      WHERE LOWER(b.email) = @email

      ORDER BY tr.id DESC;
    `;

    sql.query(
      connectionString,
      query,
      [email],
      (error, rows) => {
        if (error) {
          console.error(
            "Customer Translator Requests Error:",
            error
          );

          return res.status(500).json({
            message:
              "Failed to load translator requests"
          });
        }

        res.json({
          message: "Translator requests loaded",
          requests: rows || []
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
dr.status,
CONVERT(VARCHAR(33), dr.createdAt, 126) AS createdAt,
CASE
  WHEN DATEADD(MINUTE, 10, dr.createdAt) <= SYSDATETIME()
    THEN 0
  ELSE DATEDIFF(
    SECOND,
    SYSDATETIME(),
    DATEADD(MINUTE, 10, dr.createdAt)
  )
END AS remainingSeconds

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



-- Expire this request if 10 minutes have passed
UPDATE DriverRequests
SET status = 'Expired'
WHERE id = @requestId
  AND driverId = @sessionDriverId
  AND status = 'Pending'
  AND createdAt <= DATEADD(
    MINUTE, -10, SYSDATETIME()
  );


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
        
ELSE IF @currentStatus = 'Expired'
BEGIN
    SET @resultCode = 409;
    SET @message = N'Driver request has expired';
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



 // UPDATE DRIVER PROFILE
app.patch("/api/driver-profile", requireRole("driver"), (req, res) => {
  const user = req.session.user;
  const driverId = Number(user.driverId);
  const userId = Number(user.id);

  if (
    !Number.isSafeInteger(driverId) ||
    driverId < 1 ||
    !Number.isSafeInteger(userId) ||
    userId < 1
  ) {
    return res.status(404).json({
      message: "Driver profile not linked"
    });
  }

  const { name, vehicle, location, available } = req.body || {};

  if (
    typeof name !== "string" ||
    typeof vehicle !== "string" ||
    typeof location !== "string" ||
    typeof available !== "boolean"
  ) {
    return res.status(400).json({
      message: "Invalid profile details"
    });
  }

  const cleanName = name.trim();
  const cleanVehicle = vehicle.trim();
  const cleanLocation = location.trim();

  if (
    !cleanName ||
    !cleanVehicle ||
    !cleanLocation ||
    cleanName.length > 100 ||
    cleanVehicle.length > 100 ||
    cleanLocation.length > 100
  ) {
    return res.status(400).json({
      message: "Please enter valid profile details (maximum 100 characters each)"
    });
  }

  const query = `
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @driverId INT = ?;
    DECLARE @userId INT = ?;
    DECLARE @name NVARCHAR(100) = ?;
    DECLARE @vehicle NVARCHAR(100) = ?;
    DECLARE @location NVARCHAR(100) = ?;
    DECLARE @available BIT = ?;

    BEGIN TRY
      BEGIN TRANSACTION;

      IF NOT EXISTS (
        SELECT 1
        FROM Drivers WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @driverId
      )
      BEGIN
        THROW 50001, 'Driver profile not found', 1;
      END;

      UPDATE Drivers
      SET
        name = @name,
        vehicle = @vehicle,
        location = @location,
        available = @available
      WHERE id = @driverId;

      -- Keep the login account name synchronized
      UPDATE Users
      SET name = @name
      WHERE id = @userId
        AND driverId = @driverId;

      IF @@ROWCOUNT <> 1
      BEGIN
        THROW 50002, 'Linked user account not found', 1;
      END;

      COMMIT TRANSACTION;

      SELECT
        id,
        name,
        vehicle,
        location,
        available
      FROM Drivers
      WHERE id = @driverId;

    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

      THROW;
    END CATCH;
  `;

  sql.query(
    connectionString,
    query,
    [
      driverId,
      userId,
      cleanName,
      cleanVehicle,
      cleanLocation,
      available ? 1 : 0
    ],
    (error, rows) => {
      if (error) {
        console.error("Update Driver Profile Error:", error);

        return res.status(500).json({
          message: "Failed to update driver profile"
        });
      }

      const driver = rows?.[0];

      if (!driver) {
        return res.status(500).json({
          message: "Updated profile could not be loaded"
        });
      }

      // Update the current login session
      req.session.user.name = driver.name;

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session Save Error:", saveError);

          return res.status(500).json({
            message: "Profile saved, but session refresh failed. Please log in again."
          });
        }

        return res.json({
          message: "Driver profile updated successfully",
          driver: {
            ...driver,
            available: Boolean(driver.available)
          }
        });
      });
    }
  );
});





// 15.1 CANCEL CUSTOMER BOOKING

app.patch(
  "/api/bookings/:id/cancel",
  requireRole("customer"),
  (req, res) => {
    const bookingId = Number(req.params.id);
    const email = req.session.user.email.trim().toLowerCase();

    if (!Number.isInteger(bookingId) || bookingId < 1) {
      return res.status(400).json({
        message: "Invalid booking ID"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @bookingId INT = ?;
      DECLARE @email NVARCHAR(150) = ?;

      DECLARE @currentStatus NVARCHAR(30);
      DECLARE @resultCode INT = 200;
      DECLARE @message NVARCHAR(200) = N'';

      BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @currentStatus = status
        FROM Bookings WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @bookingId
          AND LOWER(email) = @email;

        IF @currentStatus IS NULL
        BEGIN
          SET @resultCode = 404;
          SET @message = N'Booking not found';
        END
        ELSE IF @currentStatus = 'Cancelled'
        BEGIN
          SET @resultCode = 409;
          SET @message = N'Booking already cancelled';
        END
        ELSE IF @currentStatus NOT IN ('Pending', 'Confirmed')
        BEGIN
          SET @resultCode = 409;
          SET @message = N'This booking cannot be cancelled';
        END
        ELSE
        BEGIN
          UPDATE Bookings
          SET status = 'Cancelled'
          WHERE id = @bookingId;

          UPDATE DriverRequests
          SET status = 'Cancelled'
          WHERE bookingId = @bookingId
            AND status IN ('Pending', 'Accepted');

          SET @message = N'Booking cancelled successfully!';
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
        @bookingId AS bookingId,
        CASE
          WHEN @resultCode = 200 THEN 'Cancelled'
          ELSE @currentStatus
        END AS status;
    `;

    sql.query(
      connectionString,
      query,
      [bookingId, email],
      (error, rows) => {
        if (error) {
          console.error("Cancellation Error:", error);

          return res.status(500).json({
            message: "Failed to cancel booking"
          });
        }

        const result = rows[0];

        if (result.resultCode !== 200) {
          return res.status(result.resultCode).json({
            message: result.message
          });
        }

        res.json({
          message: result.message,
          booking: {
            id: result.bookingId,
            status: result.status
          }
        });
      }
    );
  }
);


//15.2 translator profile management


 // GET TRANSLATOR PROFILE
 

app.get(
  "/api/translator-profile",
  requireRole("translator"),
  (req, res) => {
    const translatorId = Number(
      req.session.user.translatorId
    );

    if (
      !Number.isSafeInteger(translatorId) ||
      translatorId < 1
    ) {
      return res.status(404).json({
        message: "Translator profile not linked"
      });
    }

    const query = `
      SELECT
        id,
        name,
        languages,
        feePerDay,
        available
      FROM Translators
      WHERE id = ?
    `;

    sql.query(
      connectionString,
      query,
      [translatorId],
      (error, rows) => {
        if (error) {
          console.error("Translator Profile Error:", error);

          return res.status(500).json({
            message: "Failed to load translator profile"
          });
        }

        if (!rows || rows.length === 0) {
          return res.status(404).json({
            message: "Translator profile not found"
          });
        }

        res.json({
          ...rows[0],
          available: Boolean(rows[0].available)
        });
      }
    );
  }
);



// UPDATE TRANSLATOR PROFILE


app.patch(
  "/api/translator-profile",
  requireRole("translator"),
  (req, res) => {
    const translatorId = Number(
      req.session.user.translatorId
    );

    const userId = Number(req.session.user.id);

    if (
      !Number.isSafeInteger(translatorId) ||
      translatorId < 1 ||
      !Number.isSafeInteger(userId) ||
      userId < 1
    ) {
      return res.status(404).json({
        message: "Translator profile not linked"
      });
    }

    const {
      name,
      languages,
      feePerDay,
      available
    } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof languages !== "string" ||
      typeof available !== "boolean"
    ) {
      return res.status(400).json({
        message: "Invalid profile details"
      });
    }

    const cleanName = name.trim();
    const cleanLanguages = languages.trim();
    const feeText = String(feePerDay ?? "").trim();

    if (
      !cleanName ||
      cleanName.length > 100 ||
      !cleanLanguages ||
      cleanLanguages.length > 300
    ) {
      return res.status(400).json({
        message: "Invalid name or languages"
      });
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(feeText)) {
      return res.status(400).json({
        message: "Enter a valid daily fee"
      });
    }

    const cleanFee = Number(feeText);

    if (
      !Number.isFinite(cleanFee) ||
      cleanFee > 99999999.99
    ) {
      return res.status(400).json({
        message: "Invalid daily fee"
      });
    }

    const query = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @translatorId INT = ?;
      DECLARE @userId INT = ?;
      DECLARE @name NVARCHAR(100) = ?;
      DECLARE @languages NVARCHAR(300) = ?;
      DECLARE @fee DECIMAL(10,2) = ?;
      DECLARE @available BIT = ?;

      BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (
          SELECT 1
          FROM Translators WITH (UPDLOCK, HOLDLOCK)
          WHERE id = @translatorId
        )
        BEGIN
          THROW 50001, 'Translator profile not found', 1;
        END;

        UPDATE Translators
        SET
          name = @name,
          languages = @languages,
          feePerDay = @fee,
          available = @available
        WHERE id = @translatorId;

        -- Keep account name synchronized
        UPDATE Users
        SET name = @name
        WHERE id = @userId
          AND translatorId = @translatorId;

        IF @@ROWCOUNT <> 1
        BEGIN
          THROW 50002, 'Linked user account not found', 1;
        END;

        COMMIT TRANSACTION;

        SELECT
          id,
          name,
          languages,
          feePerDay,
          available
        FROM Translators
        WHERE id = @translatorId;

      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRANSACTION;

        THROW;
      END CATCH;
    `;

    sql.query(
      connectionString,
      query,
      [
        translatorId,
        userId,
        cleanName,
        cleanLanguages,
        cleanFee,
        available ? 1 : 0
      ],
      (error, rows) => {
        if (error) {
          console.error(
            "Update Translator Profile Error:",
            error
          );

          return res.status(500).json({
            message: "Failed to update translator profile"
          });
        }

        const translator = rows?.[0];

        if (!translator) {
          return res.status(500).json({
            message: "Updated profile could not be loaded"
          });
        }

        req.session.user.name = translator.name;

        req.session.save((saveError) => {
          if (saveError) {
            console.error(
              "Session Save Error:",
              saveError
            );

            return res.status(500).json({
              message:
                "Profile saved, but session refresh failed. Please log in again."
            });
          }

          return res.json({
            message: "Translator profile updated successfully",
            translator: {
              ...translator,
              available: Boolean(translator.available)
            }
          });
        });
      }
    );
  }
);





// 16. START BACKEND SERVER


app.listen(PORT, () => {
  console.log(
    `Smart Tour Backend running on http://127.0.0.1:${PORT}`
  );
});



// 17. EXPIRED REQUESTS CHECK ARE CHECKD EVERY 30 SECCOND WHILE RUNNING 
expirePendingDriverRequests();

setInterval(() => {
  expirePendingDriverRequests();
}, 30 * 1000);




 
 // 18. AUTOMATIC TRANSLATOR EXPIRY + FALLBACK

let translatorFallbackJobRunning = false;

async function processTranslatorFallbacks() {
  if (translatorFallbackJobRunning) return;

  translatorFallbackJobRunning = true;

  const query = `
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
      BEGIN TRANSACTION;

      DECLARE @lockResult INT;

      EXEC @lockResult = sys.sp_getapplock
        @Resource = 'TranslatorFallbackJob',
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 10000;

      IF @lockResult < 0
        THROW 50001, 'Fallback job lock unavailable', 1;

      -- Cancel requests belonging to cancelled bookings
      UPDATE tr
      SET
        tr.status = 'Cancelled',
        tr.respondedAt = SYSDATETIME()
      FROM TranslatorRequests tr
      INNER JOIN Bookings b
        ON b.id = tr.bookingId
      WHERE b.status = 'Cancelled'
        AND tr.status IN ('Pending', 'Accepted');

      -- Expire requests older than 10 minutes
      UPDATE TranslatorRequests
      SET
        status = 'Expired',
        respondedAt = SYSDATETIME()
      WHERE status = 'Pending'
        AND createdAt <= DATEADD(
          MINUTE, -10, SYSDATETIME()
        );

      -- Find the latest request for each booking
      ;WITH LatestRequests AS (
        SELECT
          tr.id,
          tr.bookingId,
          tr.status,
          tr.autoFallbackEnabled,
          ROW_NUMBER() OVER (
            PARTITION BY tr.bookingId
            ORDER BY tr.createdAt DESC, tr.id DESC
          ) AS rn
        FROM TranslatorRequests tr
      ),

      EligibleBookings AS (
        SELECT
          latest.bookingId,
          b.travelDate
        FROM LatestRequests latest
        INNER JOIN Bookings b WITH (UPDLOCK, HOLDLOCK)
          ON b.id = latest.bookingId
        WHERE latest.rn = 1
          AND latest.status IN ('Rejected', 'Expired')
          AND latest.autoFallbackEnabled = 1
          AND b.status IN ('Pending', 'Confirmed')

          -- Do not create a request if one is active
          AND NOT EXISTS (
            SELECT 1
            FROM TranslatorRequests existing
            WHERE existing.bookingId = latest.bookingId
              AND existing.status IN ('Pending', 'Accepted')
          )
      ),

      NextTranslators AS (
        SELECT
          eligible.bookingId,
          nextTranslator.id AS translatorId
        FROM EligibleBookings eligible

        CROSS APPLY (
          SELECT TOP (1)
            t.id
          FROM Translators t WITH (UPDLOCK, HOLDLOCK)
          WHERE t.available = 1

            -- Do not request the same translator again
            AND NOT EXISTS (
              SELECT 1
              FROM TranslatorRequests previous
              WHERE previous.bookingId = eligible.bookingId
                AND previous.translatorId = t.id
            )

            -- Avoid translators already requested
            -- or accepted for the same date
            AND NOT EXISTS (
              SELECT 1
              FROM TranslatorRequests busy
              INNER JOIN Bookings busyBooking
                ON busyBooking.id = busy.bookingId
              WHERE busy.translatorId = t.id
                AND busy.status IN ('Pending', 'Accepted')
                AND busyBooking.status <> 'Cancelled'
                AND busyBooking.travelDate = eligible.travelDate
            )

          ORDER BY t.id
        ) nextTranslator
      )

      -- Create a new request with a fresh 10-minute timer
      INSERT INTO TranslatorRequests (
        bookingId,
        translatorId,
        status,
        autoFallbackEnabled
      )
      SELECT
        bookingId,
        translatorId,
        'Pending',
        1
      FROM NextTranslators;

      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

      THROW;
    END CATCH;
  `;

  try {
    await new Promise((resolve, reject) => {
      sql.query(
        connectionString,
        query,
        [],
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  } catch (error) {
    console.error("Translator Fallback Error:", error);
  } finally {
    translatorFallbackJobRunning = false;
  }
}

// Run once when the backend starts
processTranslatorFallbacks();

// Check every 15 seconds
const translatorFallbackTimer = setInterval(
  processTranslatorFallbacks,
  15000
);

translatorFallbackTimer.unref?.();



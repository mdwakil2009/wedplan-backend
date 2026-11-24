import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import Stripe from "stripe";
import {
  verifyToken,
  verifyVendor,
  verifyAdmin,
} from "./middlewares/verifyToken.js";
const app = express();
const PORT = process.env.PORT || 5000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// CORS middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    // Verify Stripe Signature
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      console.error("Webhook Signature Error:", error.message);
      return res.status(400).send("Invalid signature");
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        if (session.payment_status !== "paid" || session.mode !== "payment") {
          return res.json({ received: true });
        }

        const userId = session.metadata?.userId;

        // Validate User ID and Session Owner
        if (
          !userId ||
          !ObjectId.isValid(userId) ||
          session.client_reference_id !== userId
        ) {
          return res.status(400).send("Invalid user information");
        }

        // Verify Stripe Price
        const items = await stripe.checkout.sessions.listLineItems(session.id);

        if (
          items.data.length !== 1 ||
          items.data[0].price?.id !== process.env.STRIPE_PRICE_ID ||
          items.data[0].quantity !== 1
        ) {
          return res.status(400).send("Invalid payment details");
        }

        // Activate Premium
        const userResult = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              subscriptionPlan: "premium",
              premiumActivatedAt: new Date(),
            },
          },
        );

        if (userResult.matchedCount === 0) {
          return res.status(404).send("User not found");
        }

        // Save Transaction (Prevent Duplicate)
        await transactionsCollection.updateOne(
          { stripeSessionId: session.id },
          {
            $setOnInsert: {
              vendorId: userId,
              plan: "premium",
              amount: (session.amount_total || 0) / 100,
              currency: session.currency,
              stripeSessionId: session.id,
              paymentIntentId: session.payment_intent,
              status: "paid",
              createdAt: new Date(session.created * 1000),
            },
          },
          { upsert: true },
        );

        console.log("Premium Activated:", userId);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook Processing Error:", error);
      res.status(500).send("Webhook processing failed");
    }
  },
);

// Keep JSON middleware after Webhook
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const db = connectedClient.db("WedPlan");

const servicesCollection = db.collection("services");
const bookingsCollection = db.collection("bookings");
const usersCollection = db.collection("user");
const transactionsCollection = db.collection("transactions");
// Prevent duplicate Stripe transactions
await transactionsCollection.createIndex(
  { stripeSessionId: 1 },
  { unique: true },
);

app.get("/", (req, res) => {
  res.json({ message: "WedPlan server is running 🎉" });
});
// Add Service API

app.post(
  "/services",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      const vendorId = req.user.id;

      const vendor = await usersCollection.findOne({
        _id: new ObjectId(vendorId),
      });

      if (!vendor) {
        return res.status(404).send({
          message: "Vendor not found",
        });
      }

      if (vendor.subscriptionPlan !== "premium") {
        const count = await servicesCollection.countDocuments({
          vendorId,
          isActive: true,
          status: "approved",
        });

        if (count >= 3) {
          return res.status(403).send({
            success: false,
            limitReached: true,
            message: "Free plan limit reached! Upgrade to Premium.",
          });
        }
      }

      const { serviceName, category, price, location, description, images } =
        req.body;

      // Validate service data
      if (
        typeof serviceName !== "string" ||
        !serviceName.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        typeof price !== "number" ||
        price <= 0 ||
        typeof location !== "string" ||
        !location.trim() ||
        typeof description !== "string" ||
        !description.trim() ||
        !Array.isArray(images) ||
        images.length === 0 ||
        !images.every((image) => typeof image === "string")
      ) {
        return res.status(400).send({
          success: false,
          message: "Invalid service data",
        });
      }

      // Create secure service data
      const serviceData = {
        serviceName: serviceName.trim(),
        category: category.trim(),
        price,
        location: location.trim(),
        description: description.trim(),
        images,
        vendorId,
        status: "pending",
        isActive: false,
        createdAt: new Date().toISOString(),
      };

      const result = await servicesCollection.insertOne(serviceData);

      res.send({
        success: true,
        message: "Service added successfully!",
        insertedId: result.insertedId,
      });
    } catch (error) {
      console.error("Add Service Error:", error);

      res.status(500).send({
        message: "Failed to add service",
      });
    }
  },
);

// Public - Get Approved & Active Services
app.get("/services", async (req, res) => {
  try {
    const services = await servicesCollection
      .find({
        status: "approved",
        isActive: true,
      })
      .toArray();

    res.send(services);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch services",
    });
  }
});

// Get services by authenticated vendor
app.get(
  "/my-services",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      const vendorId = req.user.id;

      const result = await servicesCollection.find({ vendorId }).toArray();

      res.send(result);
    } catch (error) {
      console.error("Get My Services Error:", error);

      res.status(500).send({
        message: "Failed to get your services",
      });
    }
  },
);

// Update Service

app.patch(
  "/services/:id",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      const { id } = req.params;
      const vendorId = req.user.id;

      // Validate MongoDB ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid service ID",
        });
      }

      const { serviceName, category, price, location, description, images } =
        req.body;

      // Validate required fields
      if (
        typeof serviceName !== "string" ||
        !serviceName.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        typeof location !== "string" ||
        !location.trim() ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof price !== "number" ||
        price <= 0 ||
        !Array.isArray(images) ||
        images.length === 0 ||
        !images.every((image) => typeof image === "string")
      ) {
        return res.status(400).send({
          success: false,
          message: "Invalid service data",
        });
      }

      // Update only allowed fields
      const result = await servicesCollection.updateOne(
        {
          _id: new ObjectId(id),
          vendorId: vendorId,
        },
        {
          $set: {
            serviceName: serviceName.trim(),
            category: category.trim(),
            price,
            location: location.trim(),
            description: description.trim(),
            images,
            status: "pending",
            isActive: false,
          },
        },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({
          success: false,
          message: "Service not found or you are not the owner",
        });
      }

      res.send({
        success: true,
        message: "Service updated successfully",
      });
    } catch (error) {
      console.error("Update Service Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to update service",
      });
    }
  },
);

// Delete Service
app.delete(
  "/services/:id",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      const id = req.params.id;
      const vendorId = req.user.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid service ID",
        });
      }

      const result = await servicesCollection.deleteOne({
        _id: new ObjectId(id),
        vendorId: vendorId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).send({
          success: false,
          message: "Service not found or you are not the owner",
        });
      }

      res.send({
        success: true,
        message: "Service deleted successfully!",
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error("Delete Service Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to delete service",
      });
    }
  },
);
// Get Single Approved & Active Service
app.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid service ID",
      });
    }

    const service = await servicesCollection.findOne({
      _id: new ObjectId(id),
      status: "approved",
      isActive: true,
    });

    if (!service) {
      return res.status(404).send({
        success: false,
        message: "Service not found or unavailable",
      });
    }

    res.send(service);
  } catch (error) {
    console.error("Get Single Service Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch service",
    });
  }
});

// Create Booking API - Secure
app.post("/bookings", verifyToken(usersCollection), async (req, res) => {
  try {
    // Only customers can create bookings
    if (req.user.role !== "customer") {
      return res.status(403).send({
        success: false,
        message: "Only customers can book services.",
      });
    }

    const { serviceId, eventDate, eventLocation, message } = req.body;

    // Validate required fields
    if (
      !serviceId ||
      !eventDate ||
      typeof eventLocation !== "string" ||
      !eventLocation.trim()
    ) {
      return res.status(400).send({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    // Validate Service ID
    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid service ID.",
      });
    }

    // Get service from database
    const service = await servicesCollection.findOne({
      _id: new ObjectId(serviceId),
    });

    // Check service availability
    if (!service || !service.isActive || service.status !== "approved") {
      return res.status(404).send({
        success: false,
        message: "Service is not available.",
      });
    }

    // Check duplicate booking
    const existingBooking = await bookingsCollection.findOne({
      customerId: req.user.id,
      serviceId: service._id.toString(),
      eventDate,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingBooking) {
      return res.status(409).send({
        success: false,
        message: "You have already booked this service for this date.",
      });
    }

    // Create secure booking data
    const bookingData = {
      serviceId: service._id.toString(),
      customerId: req.user.id,
      vendorId: service.vendorId,
      eventDate,
      eventLocation: eventLocation.trim(),
      message: typeof message === "string" ? message.trim() : "",
      status: "pending",
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(bookingData);

    res.send({
      success: true,
      message: "Booking successful!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Booking Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to create booking.",
    });
  }
});

// Get Vendor Bookings - Secure
app.get(
  "/vendor-bookings",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    const vendorId = req.user.id;

    const bookings = await bookingsCollection.find({ vendorId }).toArray();

    res.send(bookings);
  },
);
// Get Vendor Bookings With Service - Secure
app.get(
  "/vendor-bookings-with-service",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    const vendorId = req.user.id;

    const bookings = await bookingsCollection.find({ vendorId }).toArray();

    const bookingsWithService = await Promise.all(
      bookings.map(async (booking) => {
        const service = await servicesCollection.findOne({
          _id: new ObjectId(booking.serviceId),
        });

        return {
          ...booking,
          service,
        };
      }),
    );

    res.send(bookingsWithService);
  },
);

// Update Booking Status - Secure
app.patch(
  "/bookings/:id",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    // Check valid Booking ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    // Check allowed status
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking status.",
      });
    }

    // Update only the vendor's own pending booking
    const result = await bookingsCollection.updateOne(
      {
        _id: new ObjectId(id),
        vendorId: req.user.id,
        status: "pending",
      },
      {
        $set: {
          status: status,
        },
      },
    );

    // Check whether the booking was updated
    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found or you are not authorized to update it.",
      });
    }

    res.send({
      success: true,
      message: "Booking status updated successfully!",
    });
  },
);

// Get User Info

app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate User ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          name: 1,
          image: 1,
        },
      },
    );

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    res.send({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get User Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch user",
    });
  }
});

// Customer Bookings API - Secure
app.get(
  "/customer-bookings",
  verifyToken(usersCollection),
  async (req, res) => {
    // Only customers can access customer bookings
    if (req.user.role !== "customer") {
      return res.status(403).send({
        success: false,
        message: "Only customers can access their bookings.",
      });
    }
    const customerId = req.user.id;

    const bookings = await bookingsCollection.find({ customerId }).toArray();

    const bookingsWithDetails = await Promise.all(
      bookings.map(async (booking) => {
        const service = await servicesCollection.findOne({
          _id: new ObjectId(booking.serviceId),
        });

        const vendor = await usersCollection.findOne(
          { _id: new ObjectId(booking.vendorId) },
          {
            projection: {
              name: 1,
              email: 1,
              image: 1,
            },
          },
        );

        return {
          ...booking,
          service,
          vendor,
        };
      }),
    );

    res.send(bookingsWithDetails);
  },
);

// Admin Overview API
app.get(
  "/admin-overview",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const totalUsers = await usersCollection.countDocuments();

      const totalVendors = await usersCollection.countDocuments({
        role: "vendor",
      });

      const totalCustomers = await usersCollection.countDocuments({
        role: "customer",
      });

      const totalServices = await servicesCollection.countDocuments();

      const pendingServices = await servicesCollection.countDocuments({
        status: "pending",
      });

      const totalTransactions = await transactionsCollection.countDocuments();

      res.send({
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        totalTransactions,
      });
    } catch (error) {
      res.status(500).send({
        message: "Failed to fetch admin overview",
      });
    }
  },
);

// Admin Manage Users API
app.get(
  "/admin-users",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const users = await usersCollection
        .find({})
        .project({
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          createdAt: 1,
          isBlocked: 1,
        })
        .toArray();

      res.send(users);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch users" });
    }
  },
);

// Block / Unblock User

app.patch(
  "/admin-users/:id",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isBlocked } = req.body;

      // Validate User ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid user ID",
        });
      }

      // Validate isBlocked
      if (typeof isBlocked !== "boolean") {
        return res.status(400).send({
          success: false,
          message: "Invalid blocked status",
        });
      }

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({
          success: false,
          message: "User not found",
        });
      }

      res.send({
        success: true,
        message: "User status updated successfully",
      });
    } catch (error) {
      console.error("Block User Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to update user",
      });
    }
  },
);

// Admin - Get All Services
app.get(
  "/admin-services",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const services = await servicesCollection.find({}).toArray();

      res.status(200).send(services);
    } catch (error) {
      console.error("Admin services error:", error);
      res.status(500).send({
        message: "Failed to fetch admin services",
      });
    }
  },
);
// Admin - Update Service Status

app.patch(
  "/admin-services/:id/status",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate Service ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid service ID",
        });
      }

      // Validate Status
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).send({
          success: false,
          message: "Invalid status",
        });
      }

      const updateData = { status };

      // Rejected service automatically inactive
      if (status === "rejected") {
        updateData.isActive = false;
      }

      // Update Service
      const result = await servicesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({
          success: false,
          message: "Service not found",
        });
      }

      res.send({
        success: true,
        message: "Service status updated successfully",
      });
    } catch (error) {
      console.error("Update Service Status Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to update service status",
      });
    }
  },
);

// Admin - Update Service Active Status

app.patch(
  "/admin-services/:id/active",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Validate Service ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid service ID",
        });
      }

      // Validate Active Status
      if (typeof isActive !== "boolean") {
        return res.status(400).send({
          success: false,
          message: "Invalid active status",
        });
      }

      const result = await servicesCollection.updateOne(
        {
          _id: new ObjectId(id),
          status: "approved",
        },
        {
          $set: { isActive },
        },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({
          success: false,
          message: "Approved service not found",
        });
      }

      res.send({
        success: true,
        message: "Service availability updated successfully",
      });
    } catch (error) {
      console.error("Update Service Active Status Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to update service availability",
      });
    }
  },
);

// Create Stripe Checkout Session - Secure
app.post(
  "/create-checkout-session",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      const userId = req.user.id;
      if (!ObjectId.isValid(userId)) {
        return res.status(400).send({
          success: false,
          message: "Invalid user ID.",
        });
      }

      const user = await usersCollection.findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        return res.status(404).send({
          success: false,
          message: "User not found.",
        });
      }

      if (user.subscriptionPlan === "premium") {
        return res.status(400).send({
          success: false,
          message: "You are already a Premium user.",
        });
      }
      if (!process.env.STRIPE_PRICE_ID) {
        return res.status(500).send({
          success: false,
          message: "Stripe Price ID is not configured.",
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],

        customer_email: user.email,

        client_reference_id: userId,

        metadata: {
          userId: userId,
        },

        success_url: `${process.env.CLIENT_URL}/dashboard/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url: `${process.env.CLIENT_URL}/dashboard/vendor/subscription/cancel`,
      });

      res.send({
        success: true,
        url: session.url,
      });
    } catch (error) {
      console.error("Stripe Checkout Error:", error.message);

      res.status(500).send({
        success: false,
        message: "Unable to create checkout session.",
      });
    }
  },
);

//verify payment

app.post(
  "/verify-payment",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      console.log("VERIFY PAYMENT API CALLED");

      const { sessionId } = req.body;
      const userId = req.user.id;

      if (!sessionId) {
        return res.status(400).send({ message: "Session ID required" });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (
        session.status !== "complete" ||
        session.payment_status !== "paid" ||
        session.mode !== "payment" ||
        session.metadata?.userId !== userId ||
        session.client_reference_id !== userId
      ) {
        return res.status(400).send({ message: "Invalid payment" });
      }

      const items = await stripe.checkout.sessions.listLineItems(sessionId);

      if (
        items.data.length !== 1 ||
        items.data[0].price?.id !== process.env.STRIPE_PRICE_ID ||
        items.data[0].quantity !== 1
      ) {
        return res.status(400).send({ message: "Invalid payment details" });
      }

      // Payment verified successfully
      // Premium activation is handled by Stripe webhook

      res.send({
        success: true,
        paymentVerified: true,
        premiumActivated: false,
        message: "Payment verified. Premium activation is being processed.",
      });
    } catch (error) {
      console.error("Payment Error:", error);
      res.status(500).send({
        success: false,
        message: "Verification failed",
      });
    }
  },
);

app.get(
  "/admin-transactions",
  verifyToken(usersCollection),
  verifyAdmin,
  async (req, res) => {
    try {
      const transactions = await transactionsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      const result = await Promise.all(
        transactions.map(async (item) => {
          const vendor = await usersCollection.findOne(
            { _id: new ObjectId(item.vendorId) },
            { projection: { name: 1, email: 1 } },
          );

          return { ...item, vendor };
        }),
      );

      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch transactions" });
    }
  },
);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
// Get logged-in vendor subscription status
app.get(
  "/my-subscription",
  verifyToken(usersCollection),
  verifyVendor,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await usersCollection.findOne(
        { _id: new ObjectId(userId) },
        {
          projection: {
            subscriptionPlan: 1,
            premiumActivatedAt: 1,
          },
        },
      );

      if (!user) {
        return res.status(404).send({
          success: false,
          message: "User not found",
        });
      }

      res.send({
        success: true,
        subscriptionPlan: user.subscriptionPlan || "free",
        isPremium: user.subscriptionPlan === "premium",
        premiumActivatedAt: user.premiumActivatedAt || null,
      });
    } catch (error) {
      console.error("Subscription Status Error:", error);

      res.status(500).send({
        success: false,
        message: "Failed to get subscription status",
      });
    }
  },
);

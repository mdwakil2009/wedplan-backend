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
app.use(cors());

// Stripe Webhook
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("Webhook request received!");

    const signature = req.headers["stripe-signature"];

    let event;

    // Verify Stripe signature
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
      // Handle successful payment
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        console.log("Checkout Session:", session.id);

        if (session.payment_status !== "paid") {
          return res.json({ received: true });
        }

        const userId = session.metadata?.userId;
        console.log("Session Metadata:", session.metadata);

        if (!userId || !ObjectId.isValid(userId)) {
          console.log("Invalid User ID:", userId);

          return res.status(400).send("Invalid user ID");
        }

        // Activate Premium
        const userResult = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              subscriptionPlan: "premium",
            },
          },
        );

        if (userResult.matchedCount === 0) {
          return res.status(404).send("Vendor not found");
        }

        // Save transaction
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

        console.log("Premium activated:", userId);
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("Webhook Processing Error:", error);

      return res.status(500).send("Webhook processing failed");
    }
  },
);

// JSON middleware MUST be after webhook
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
        });

        if (count >= 3) {
          return res.status(403).send({
            success: false,
            limitReached: true,
            message: "Free plan limit reached! Upgrade to Premium.",
          });
        }
      }
      const { vendorId: clientVendorId, ...serviceInfo } = req.body;

      const serviceData = {
        ...serviceInfo,
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
      const id = req.params.id;
      const vendorId = req.user.id;
      const updatedService = req.body;

      const result = await servicesCollection.updateOne(
        {
          _id: new ObjectId(id),
          vendorId: vendorId,
        },
        {
          $set: {
            serviceName: updatedService.serviceName,
            category: updatedService.category,
            price: updatedService.price,
            location: updatedService.location,
            description: updatedService.description,
            images: updatedService.images,
          },
        },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({
          message: "Service not found or you are not the owner",
        });
      }

      res.send(result);
    } catch (error) {
      console.error("Update Service Error:", error);

      res.status(500).send({
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
// Get Single Service by ID
app.get("/services/:id", async (req, res) => {
  const id = req.params.id;
  const service = await servicesCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!service) {
    return res.status(404).send({
      message: "Service not found",
    });
  }

  res.send(service);
});
// Create Booking API
app.post("/bookings", async (req, res) => {
  const bookingData = req.body;

  const result = await bookingsCollection.insertOne({
    ...bookingData,
    status: "pending",
    createdAt: new Date(),
  });

  res.send({
    success: true,
    message: "Booking successful!",
    insertedId: result.insertedId,
  });
});
//vendor-bookings
app.get("/vendor-bookings", async (req, res) => {
  const vendorId = req.query.vendorId;

  const bookings = await bookingsCollection
    .find({ vendorId: vendorId })
    .toArray();

  res.send(bookings);
});
app.get("/vendor-bookings-with-service", async (req, res) => {
  const vendorId = req.query.vendorId;

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
});
// Update Booking Status
app.patch("/bookings/:id", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: status,
      },
    },
  );

  res.send({
    success: true,
    message: "Booking status updated successfully!",
    result,
  });
});
// Get User Info
app.get("/users/:id", async (req, res) => {
  try {
    const user = await usersCollection.findOne(
      { _id: new ObjectId(req.params.id) },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
        },
      },
    );

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch user",
    });
  }
});
//Customer Bookings API
app.get("/customer-bookings", async (req, res) => {
  const customerId = req.query.customerId;

  const bookings = await bookingsCollection
    .find({ customerId: customerId })
    .toArray();

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
});

// Admin Overview API
app.get("/admin-overview", async (req, res) => {
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
});

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
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isBlocked: req.body.isBlocked } },
      );

      res.send({ success: result.modifiedCount > 0 });
    } catch (error) {
      res.status(500).send({ message: "Failed to update user" });
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
      const { status } = req.body;

      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).send({
          message: "Invalid status",
        });
      }

      const updateData = { status };

      // Rejected service automatically inactive হবে
      if (status === "rejected") {
        updateData.isActive = false;
      }

      const result = await servicesCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData },
      );

      if (!result.matchedCount) {
        return res.status(404).send({
          message: "Service not found",
        });
      }

      res.send({
        success: true,
        message: "Service status updated successfully",
      });
    } catch (error) {
      res.status(500).send({
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
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).send({
          message: "Invalid active status",
        });
      }

      const result = await servicesCollection.updateOne(
        {
          _id: new ObjectId(req.params.id),
          status: "approved",
        },
        {
          $set: { isActive },
        },
      );

      if (!result.matchedCount) {
        return res.status(404).send({
          message: "Approved service not found",
        });
      }

      res.send({
        success: true,
        message: "Service availability updated successfully",
      });
    } catch (error) {
      res.status(500).send({
        message: "Failed to update service availability",
      });
    }
  },
);

// Create Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
  try {
    // Check Stripe Price ID
    console.log("Stripe Price ID:", process.env.STRIPE_PRICE_ID);

    const { userId, email } = req.body;

    // Check required information
    if (!userId || !email) {
      return res.status(400).send({
        message: "User ID and email are required",
      });
    }

    // Find user
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    // Check existing Premium subscription
    if (user.subscriptionPlan === "premium") {
      return res.status(400).send({
        message: "You are already a Premium user",
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],

      customer_email: email,

      metadata: {
        userId: userId,
      },

      success_url: `${process.env.CLIENT_URL}/dashboard/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${process.env.CLIENT_URL}/dashboard/vendor/subscription/cancel`,
    });

    // Send Checkout URL
    res.send({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Checkout Error:", error.message);

    res.status(500).send({
      message: error.message,
    });
  }
});
//verify payment
app.post("/verify-payment", async (req, res) => {
  const { sessionId } = req.body;

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return res.send({ message: "Payment not completed" });
  }

  await usersCollection.updateOne(
    { _id: new ObjectId(session.metadata.userId) },
    { $set: { subscriptionPlan: "premium" } },
  );

  res.send({ success: true, message: "Premium activated" });
});
//transactions apis

app.get(
  "/admin-overview",
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

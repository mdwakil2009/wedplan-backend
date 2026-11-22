import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
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
app.post("/services", async (req, res) => {
  const serviceData = req.body;
  const result = await servicesCollection.insertOne(serviceData);

  res.send({
    success: true,
    message: "Service added successfully!",
    insertedId: result.insertedId,
  });
});
app.get("/services", async (req, res) => {
  const services = await servicesCollection.find().toArray();

  res.send(services);
});
// Get services by user email
app.get("/my-services", async (req, res) => {
  const email = req.query.email;
  const result = await servicesCollection.find({ userEmail: email }).toArray();

  res.send(result);
});

// Update Service
app.patch("/services/:id", async (req, res) => {
  const id = req.params.id;
  const updatedService = req.body;

  const result = await servicesCollection.updateOne(
    { _id: new ObjectId(id) },
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

  res.send(result);
});
// Delete Service
app.delete("/services/:id", async (req, res) => {
  const id = req.params.id;
  const result = await servicesCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send({
    success: true,
    message: "Service deleted successfully!",
    deletedCount: result.deletedCount,
  });
});
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
//user info
app.get("/users/:id", async (req, res) => {
  const user = await usersCollection.findOne(
    { _id: new ObjectId(req.params.id) },
    {
      projection: {
        name: 1,
        email: 1,
        image: 1,
      },
    },
  );

  res.send(user);
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
app.get("/admin-users", async (req, res) => {
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
});

// Block / Unblock User
app.patch("/admin-users/:id", async (req, res) => {
  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isBlocked: req.body.isBlocked } }
    );

    res.send({ success: result.modifiedCount > 0 });
  } catch (error) {
    res.status(500).send({ message: "Failed to update user" });
  }
});
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

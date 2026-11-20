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
  })
app.get("/services", async(req, res) => {
  const services = await servicesCollection.find().toArray()

  res.send(services);
});
// Get services by user email
app.get("/my-services", async (req, res) => {
  const email = req.query.email;
  const result = await servicesCollection.find({ userEmail:email }).toArray();

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
    }
  );

  res.send(result);
});
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

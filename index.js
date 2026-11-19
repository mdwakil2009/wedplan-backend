import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
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
  try {
    const serviceData = req.body;
    const result = await servicesCollection.insertOne(serviceData);

    res.send({
      success: true,
      message: "Service added successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Failed to add service",
    });
  }
});
app.get("/services", async(req, res) => {
  const services = await servicesCollection.find().toArray()

  res.send(services);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

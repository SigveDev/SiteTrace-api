require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { Client, Databases, ID, Query } = require("node-appwrite");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Initialize Appwrite Client
const client = new Client();
const databases = new Databases(client);

client
  .setEndpoint(process.env.ENDPOINT || "https://cloud.appwrite.io/v1") // Your Appwrite Endpoint
  .setProject(process.env.PROJECT_ID || "") // Your project ID
  .setKey(process.env.API_KEY || ""); // Your secret API key

// Endpoint to receive analytics data
app.post("/analytics", async (req, res) => {
  const {
    url,
    referrer,
    userAgent,
    timestamp,
    sessionId,
    visitDuration,
    browser,
    device,
    interactions,
  } = req.body;

  try {
    // Check if a document with the same sessionId already exists
    const existingDocuments = await databases.listDocuments(
      "669ec60f003b49ce1606", // Your database ID
      "669ec6270000b46216c0", // Your collection ID
      [Query.equal("sessionId", [sessionId])]
    );

    if (existingDocuments.total > 0) {
      // Update the existing document
      const documentId = existingDocuments.documents[0].$id;
      const response = await databases.updateDocument(
        "669ec60f003b49ce1606",
        "669ec6270000b46216c0",
        documentId,
        {
          url,
          referrer,
          userAgent,
          timestamp,
          visitDuration,
          browser,
          device,
          interactions,
        }
      );
      res.status(200).json({ success: true, response });
    } else {
      // Create a new document
      const response = await databases.createDocument(
        "669ec60f003b49ce1606",
        "669ec6270000b46216c0",
        ID.unique(),
        {
          url,
          referrer,
          userAgent,
          timestamp,
          sessionId,
          visitDuration,
          browser,
          device,
          interactions,
        }
      );
      res.status(200).json({ success: true, response });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Analytics API listening at ${port}`);
});

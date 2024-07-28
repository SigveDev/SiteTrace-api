require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client, Databases, ID, Query } = require("node-appwrite");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
    userAgent = "Unknown",
    timestamp,
    sessionId,
    visitDuration = 0,
    browser,
    device = "Unknown",
    clicks = 0,
    scrollDepth = 0,
    screenResolution = "Unknown",
    viewportSize = "Unknown",
    loadTime = null,
    network = { effectiveType: "Unknown", downlink: null, rtt: null },
    focus = false,
  } = req.body;

  try {
    // Check if a document with the same sessionId already exists
    const existingDocuments = await databases.listDocuments(
      "669ec60f003b49ce1606", // Your database ID
      "66a2d232000302822fc1", // Your collection ID
      [Query.equal("sessionId", [sessionId])]
    );

    if (existingDocuments.total > 0) {
      // Update the existing document
      const documentId = existingDocuments.documents[0].$id;
      await databases.updateDocument(
        "669ec60f003b49ce1606",
        "66a2d2a0003a5153d113",
        existingDocuments.documents[0].browser.$id,
        {
          name: browser.name,
          version: browser.version,
        }
      );
      await databases.updateDocument(
        "669ec60f003b49ce1606",
        "66a2d4410005fece34aa",
        existingDocuments.documents[0].network.$id,
        {
          effectiveType: network.effectiveType,
          downlink: network.downlink,
          rtt: network.rtt,
        }
      );
      const response = await databases.updateDocument(
        "669ec60f003b49ce1606",
        "66a2d232000302822fc1",
        documentId,
        {
          userAgent,
          device,
          visitDuration,
          clicks,
          scrollDepth,
          screenResolution,
          viewportSize,
          loadTime,
          focus,
        }
      );
      res.status(200).json({ success: true, response });
    } else {
      // Create a new document
      const response = await databases.createDocument(
        "669ec60f003b49ce1606",
        "66a2d232000302822fc1",
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
          clicks,
          scrollDepth,
          screenResolution,
          viewportSize,
          loadTime,
          network,
          focus,
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
